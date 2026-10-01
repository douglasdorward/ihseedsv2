export function adminErrorMessage(error: unknown, fallback: string) {
  const record = error && typeof error === "object" ? error as { error?: unknown; message?: unknown } : null;
  const fromObject = typeof record?.error === "string" ? record.error : "";
  const fromMessage = !(error instanceof Error) && typeof record?.message === "string" ? record.message : "";
  const fromError = error instanceof Error
    ? error.message.replace(/^HTTP \d+\s+[^:\n]*:\s*/i, "").replace(/^HTTP \d+\s+/i, "")
    : "";
  for (const value of [fromObject, fromMessage, fromError]) {
    const trimmed = value.trim();
    if (!trimmed || isUnusableErrorText(trimmed)) continue;
    return trimmed;
  }
  return fallback;
}

function isUnusableErrorText(value: string) {
  return /<!DOCTYPE|<html[\s>]|<\/html>|<pre>internal\s+server\s+error/i.test(value);
}
