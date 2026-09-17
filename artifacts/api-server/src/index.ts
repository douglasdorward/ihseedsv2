import app from "./app";
import { appStorageBackend } from "./lib/app-storage";
import { logger } from "./lib/logger";
import { configureSimpleAdminAccounts } from "./lib/admin-accounts";
import { setAdminAuthReady } from "./lib/admin-readiness";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const storageBackend = appStorageBackend();

try {
  await configureSimpleAdminAccounts();
  setAdminAuthReady(true);
} catch (err) {
  setAdminAuthReady(false);
  logger.error(
    { err },
    "Administrator account bootstrap failed; public API will continue without administrator access",
  );
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, storageBackend }, "Server listening");
});
