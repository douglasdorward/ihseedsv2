---
name: Artifact command working directory
description: Replit managed artifact commands start from the registered artifact directory rather than the workspace root.
---

Managed artifact development and production commands execute with the artifact directory as their working directory. A command such as `pnpm run dev` therefore resolves that artifact package's script, not the workspace-root script.

**Why:** A public artifact intended to start the combined workspace runtime silently launched its retired package-local Vite server because the command assumed a root working directory.

**How to apply:** When an artifact service must invoke a workspace-root script, explicitly set pnpm's directory to the workspace root. Verify the restarted workflow log identifies the expected workspace package and framework, not merely that the configured command text changed.