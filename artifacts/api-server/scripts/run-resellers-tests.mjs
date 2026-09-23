import { execFileSync } from "node:child_process";

const workspaceRoot = new URL("../../..", import.meta.url);
const databaseName = `ih_catalogue_test_${process.pid}_${Date.now()}`;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for reseller tests");
}
if (process.env.CATALOGUE_TEST_DATABASE) {
  throw new Error("CATALOGUE_TEST_DATABASE is reserved for the isolated test runner");
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
  for (const file of ["lib/db/drizzle/0026_resellers.sql", "lib/db/drizzle/0035_reseller_outlet_coordinates.sql"]) {
    execFileSync("psql", [isolatedEnv.DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1", "-f", file], {
      cwd: workspaceRoot,
      env: isolatedEnv,
      stdio: "inherit",
    });
  }
  run(process.execPath, ["--test", "artifacts/api-server/test/resellers.test.mjs"], isolatedEnv);
} finally {
  run("dropdb", [`--maintenance-db=${process.env.DATABASE_URL}`, "--if-exists", databaseName]);
}
