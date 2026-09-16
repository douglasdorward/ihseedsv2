export const temporaryBuildApiCommand = Object.freeze({
  command: process.execPath,
  args: Object.freeze([
    "--enable-source-maps",
    "artifacts/api-server/dist/index.mjs",
  ]),
});