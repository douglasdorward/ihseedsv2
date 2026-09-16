import app from "./app";
import { appStorageBackend } from "./lib/app-storage";
import { logger } from "./lib/logger";
import { configureInvitationOnlyClerk } from "./lib/admin-invitations";

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

await configureInvitationOnlyClerk();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, storageBackend }, "Server listening");
});
