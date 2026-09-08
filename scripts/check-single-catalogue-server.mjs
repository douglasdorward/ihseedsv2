import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const apiPort = 8080;
const webPort = Number(process.env.ROUTING_CHECK_WEB_PORT ?? 4300);
const retiredApiPort = 5101;
const startupTimeoutMs = Number(
  process.env.ROUTING_CHECK_STARTUP_TIMEOUT_MS ?? 120_000,
);
const children = [];

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function assertPortFree(port, label) {
  assert.equal(
    await isPortOpen(port),
    false,
    `${label} port ${port} is already in use; stop that process before running this check`,
  );
}

function start(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: new URL("..", import.meta.url),
    detached: true,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push({ child, label, output: "" });

  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      const entry = children.find(
        ({ child: candidate }) => candidate === child,
      );
      entry.output = `${entry.output}${chunk}`.slice(-20_000);
      process.stdout.write(`[${label}] ${chunk}`);
    });
  }

  return child;
}

function assertRunning(child, label) {
  assert.equal(
    child.exitCode,
    null,
    `${label} exited before the routing check completed`,
  );
}

async function waitForResponse(url, processes) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    for (const [child, label] of processes) assertRunning(child, label);
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for ${url}: ${lastError?.message ?? "no response"}`,
  );
}

async function assertRoute(path, bodyPattern) {
  const response = await fetch(`http://127.0.0.1:${webPort}${path}`, {
    redirect: "manual",
  });
  const body = await response.text();
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  if (bodyPattern)
    assert.match(body, bodyPattern, `${path} returned wrong app`);
}

function descendantProcesses(rootPid) {
  const result = spawnSync("ps", ["-eo", "pid=,ppid=,args="], {
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `Could not inspect process tree: ${result.stderr}`,
  );

  const processes = result.stdout
    .trim()
    .split("\n")
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
      return match
        ? { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] }
        : null;
    })
    .filter(Boolean);
  const descendants = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const process of processes) {
      if (descendants.has(process.ppid) && !descendants.has(process.pid)) {
        descendants.add(process.pid);
        changed = true;
      }
    }
  }
  return processes.filter((process) => descendants.has(process.pid));
}

function stopChildren() {
  for (const { child } of children.reverse()) {
    if (child.exitCode !== null) continue;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

process.once("SIGINT", () => {
  stopChildren();
  process.exit(130);
});
process.once("SIGTERM", () => {
  stopChildren();
  process.exit(143);
});

try {
  await Promise.all([
    assertPortFree(apiPort, "managed API"),
    assertPortFree(webPort, "web"),
    assertPortFree(retiredApiPort, "retired private API"),
  ]);

  const api = start(
    "api",
    "pnpm",
    ["--filter", "@workspace/api-server", "run", "dev"],
    { PORT: String(apiPort) },
  );
  await waitForResponse(`http://127.0.0.1:${apiPort}/api/healthz`, [
    [api, "API command"],
  ]);

  const web = start("web", "pnpm", ["run", "dev"], {
    PORT: String(webPort),
  });
  await waitForResponse(`http://127.0.0.1:${webPort}/`, [
    [api, "API command"],
    [web, "web command"],
  ]);

  await assertRoute("/", /\/_next\/static\//);
  await assertRoute("/api/healthz");
  await assertRoute("/admin", /<title>Admin — IH Seeds<\/title>/);
  await assertRoute("/admin/products", /<title>Admin — IH Seeds<\/title>/);

  assert.equal(
    await isPortOpen(retiredApiPort),
    false,
    `web command bound retired private API port ${retiredApiPort}`,
  );
  const duplicateApiProcesses = descendantProcesses(web.pid).filter(
    ({ command }) =>
      /@workspace\/api-server|api-server\/dist\/index\.mjs/.test(command),
  );
  assert.deepEqual(
    duplicateApiProcesses,
    [],
    `web command launched an API process:\n${duplicateApiProcesses
      .map(({ pid, command }) => `  ${pid} ${command}`)
      .join("\n")}`,
  );

  console.info("Single catalogue server routing check passed");
} catch (error) {
  for (const { label, output } of children) {
    console.error(`\n--- ${label} output (tail) ---\n${output}`);
  }
  throw error;
} finally {
  stopChildren();
}
