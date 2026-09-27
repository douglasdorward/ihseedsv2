import { execFileSync } from "node:child_process";

const workspaceRoot = new URL("../../..", import.meta.url);
const databaseName = `ih_catalogue_test_${process.pid}_${Date.now()}`;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for isolated browser tests");
if (process.env.CATALOGUE_TEST_DATABASE) throw new Error("CATALOGUE_TEST_DATABASE is reserved for the isolated test runner");

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.pathname = `/${databaseName}`;
const isolatedEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl.toString(),
  CATALOGUE_TEST_DATABASE: databaseName,
};
let created = false;
try {
  execFileSync("createdb", [`--maintenance-db=${process.env.DATABASE_URL}`, databaseName], { cwd: workspaceRoot, stdio: "inherit" });
  created = true;
  const schema = execFileSync("pg_dump", [process.env.DATABASE_URL, "--schema-only", "--no-owner", "--no-privileges"], {
    cwd: workspaceRoot, encoding: "utf8", maxBuffer: 10 * 1024 * 1024,
  });
  execFileSync("psql", [isolatedEnv.DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1"], {
    cwd: workspaceRoot, env: isolatedEnv, input: schema, stdio: ["pipe", "inherit", "inherit"],
  });
  execFileSync(process.execPath, ["--test", "artifacts/api-server/test/social-sharing-browser.test.mjs"], {
    cwd: workspaceRoot, env: isolatedEnv, stdio: "inherit",
  });
} finally {
  if (created) execFileSync("dropdb", [`--maintenance-db=${process.env.DATABASE_URL}`, "--if-exists", databaseName], {
    cwd: workspaceRoot, stdio: "inherit",
  });
}