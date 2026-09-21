import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const databaseName = `ih_catalogue_test_${process.pid}_${Date.now()}`;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for lifecycle tests");
}
if (process.env.CATALOGUE_TEST_DATABASE) {
  throw new Error("CATALOGUE_TEST_DATABASE is reserved for the isolated lifecycle-test runner");
}

function run(command, args, env = process.env) {
  execFileSync(command, args, {
    cwd: workspaceRoot,
    env,
    stdio: "inherit",
  });
}

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.pathname = `/${databaseName}`;
const isolatedEnv = {
  ...process.env,
  CATALOGUE_TEST_DATABASE: databaseName,
  DATABASE_URL: databaseUrl.toString(),
};

try {
  run("createdb", [`--maintenance-db=${process.env.DATABASE_URL}`, databaseName]);
  const schemaDump = execFileSync(
    "pg_dump",
    [process.env.DATABASE_URL, "--schema-only", "--no-owner", "--no-privileges"],
    { cwd: workspaceRoot, env: process.env, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  execFileSync(
    "psql",
    [isolatedEnv.DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1"],
    { cwd: workspaceRoot, env: isolatedEnv, input: schemaDump, stdio: ["pipe", "inherit", "inherit"] },
  );
  run(process.execPath, ["artifacts/api-server/build.mjs"]);
  run(process.execPath, ["lib/db/migrate.mjs"], isolatedEnv);
  run(process.execPath, ["lib/db/seed.mjs"], isolatedEnv);
  run(process.execPath, ["--test", "artifacts/claude-design/test/persist-latest-product.test.mjs"], isolatedEnv);
  run(process.execPath, ["--test", "artifacts/claude-design/test/site-settings.test.mjs"], isolatedEnv);
  run(process.execPath, ["--test", "lib/db/test/site-settings.test.ts"], isolatedEnv);
  run(process.execPath, ["artifacts/api-server/test/products-lifecycle.test.mjs"], isolatedEnv);
  run(process.execPath, ["--test", "artifacts/api-server/test/site-settings.test.mjs"], isolatedEnv);
  run(process.execPath, ["--test", "artifacts/api-server/test/resellers.test.mjs"], isolatedEnv);
} finally {
  run("dropdb", [`--maintenance-db=${process.env.DATABASE_URL}`, "--if-exists", databaseName]);
}