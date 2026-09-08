import { spawn } from "node:child_process";

const workspaceRoot = new URL("../", import.meta.url);
const supportedArgs = new Set(["--skip-api-build"]);
const args = process.argv.slice(2);
const unsupportedArg = args.find((arg) => !supportedArgs.has(arg));

if (unsupportedArg) {
  throw new Error(`Unsupported argument: ${unsupportedArg}`);
}

const skipApiBuild = args.includes("--skip-api-build");

function runPnpm(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, {
      cwd: workspaceRoot,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm ${args.join(" ")} failed (${signal ?? code})`));
    });
  });
}

async function waitForApi(apiProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`Temporary build API exited with code ${apiProcess.exitCode}.`);
    }
    try {
      const response = await fetch("http://localhost:5101/api/healthz");
      if (response.ok) return;
    } catch {
      // The API is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Temporary build API did not become ready.");
}

function stopProcessGroup(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

if (!skipApiBuild) {
  await runPnpm(["run", "typecheck"]);
  await runPnpm(["--filter", "@workspace/api-server", "run", "build"]);
}

const apiProcess = spawn(
  "pnpm",
  ["--filter", "@workspace/api-server", "run", "start"],
  {
    cwd: workspaceRoot,
    detached: true,
    env: { ...process.env, PORT: "5101" },
    stdio: "inherit",
  },
);

try {
  await waitForApi(apiProcess);
  await runPnpm(
    ["--filter", "@workspace/web", "run", "build"],
    { API_BASE: "http://localhost:5101" },
  );
} finally {
  stopProcessGroup(apiProcess);
}