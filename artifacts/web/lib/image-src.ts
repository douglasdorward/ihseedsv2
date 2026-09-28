/**
 * The Next image optimiser reads local paths from `public/`. A relative
 * `/api/media/…` src is not a file there, and the optimiser does not follow
 * the `/api` rewrite. Point it at the Express process on the same machine
 * instead. The browser only ever requests `/_next/image`.
 *
 * This origin matches the rewrite in `next.config.mjs`. It is a constant so
 * server render and client hydration produce the same `src`.
 */
export const IMAGE_FETCH_ORIGIN = "http://127.0.0.1:8080";

export function optimizableSrc(src: string) {
  if (src.startsWith("/api/media/") || src.startsWith("/api/site/")) {
    return `${IMAGE_FETCH_ORIGIN}${src}`;
  }
  return src;
}
