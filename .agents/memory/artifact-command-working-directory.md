---
name: Artifact command working directory
description: Development and production artifact commands use different working directories in this workspace.
---

Managed artifact development commands execute from the artifact directory, while deployment production build and run commands execute from the workspace root. Relative `--dir` paths that are correct in development can therefore escape the project during deployment.

**Why:** A development command once launched the wrong package-local server when it assumed the workspace root; later, production commands using the development-safe `--dir ../..` resolved to `/home` and failed because no package manifest existed there.

**How to apply:** Treat development and production commands separately. Use an explicit root directory for development commands that need root scripts, but make production commands root-safe without parent traversal. Verify the exact configured commands in both contexts.