import app from "../src/app";

// This is the complete production-mode app composition. Only Clerk itself is
// replaced by the adjacent provider mock, so tests never mutate a live tenant.

export default app;
export {
  getTestClerkOperations,
  resetTestClerkOperations,
  setTestClerkIdentity,
} from "./clerk-express-mock";