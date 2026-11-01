// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { imageWarmupEnabled, warmOptimisedImages } = await import("./lib/image-warmup");
  if (!imageWarmupEnabled(process.env)) return;
  const origin = `http://127.0.0.1:${process.env.PORT || 3000}`;
  // Wait for the server to start listening and the first visitors to be served.
  const delayMs = Number(process.env.IMAGE_WARMUP_DELAY_MS ?? 10000);
  const timer = setTimeout(() => {
    warmOptimisedImages({ origin }).catch((error) => {
      console.error("[image-warmup] stopped unexpectedly", error);
    });
  }, delayMs);
  timer.unref?.();
}
