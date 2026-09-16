export type UploadBatchResult<T, R> =
  | { item: T; status: "fulfilled"; value: R }
  | { item: T; status: "rejected"; reason: unknown };

export async function runUploadBatch<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    onSettled?: (result: UploadBatchResult<T, R>, index: number) => void;
  } = {},
) {
  const results = new Array<UploadBatchResult<T, R>>(items.length);
  const concurrency = Math.max(1, Math.min(items.length || 1, options.concurrency ?? 3));
  let nextIndex = 0;

  const runNext = async (): Promise<void> => {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= items.length) return;
    const item = items[index];
    try {
      results[index] = { item, status: "fulfilled", value: await worker(item, index) };
    } catch (reason) {
      results[index] = { item, status: "rejected", reason };
    }
    options.onSettled?.(results[index], index);
    await runNext();
  };

  await Promise.all(Array.from({ length: concurrency }, () => runNext()));
  return results;
}

export function successfulUploadValues<T>(
  items: Array<{ status: string; value?: T }>,
) {
  return items.flatMap((item) => item.status === "complete" && item.value ? [item.value] : []);
}