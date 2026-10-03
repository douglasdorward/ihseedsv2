import { useEffect, useRef, useState } from "react";

type RefineBatchResponse = {
  refined: number;
  skipped: number;
  failed: number;
  processed: number;
  total: number;
  nextCursor: string | null;
  done: boolean;
  error?: string;
};

type RefinePhase = "confirm" | "running" | "done" | "error";

export type RefineSummary = { refined: number; skipped: number; failed: number };

type RefineState = RefineSummary & {
  phase: RefinePhase;
  processed: number;
  total: number;
  cursor: string | null;
  error: string;
};

const INITIAL_STATE: RefineState = {
  phase: "confirm",
  refined: 0,
  skipped: 0,
  failed: 0,
  processed: 0,
  total: 0,
  cursor: null,
  error: "",
};

async function refineBatch(after: string | null): Promise<RefineBatchResponse> {
  const response = await fetch("/api/admin/media/refine", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(after ? { after } : {}),
  });
  const body = await response.json().catch(() => null) as RefineBatchResponse | null;
  if (!response.ok || !body) throw new Error(body?.error ?? "The server could not refine this batch of images.");
  return body;
}

/**
 * Confirms and runs "Refine existing images" batch by batch, so administrators
 * can watch progress. A failed batch keeps the cursor, so "Try again" resumes
 * where the run stopped instead of starting over.
 */
export function RefineImagesDialog({
  onClose,
  onFinished,
}: {
  onClose: (summary: RefineSummary | null) => void;
  onFinished: () => Promise<void> | void;
}) {
  const [state, setState] = useState<RefineState>(INITIAL_STATE);
  const mounted = useRef(true);
  const running = state.phase === "running";

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const run = async (startCursor: string | null) => {
    setState((current) => ({ ...current, phase: "running", error: "" }));
    let cursor = startCursor;
    try {
      for (;;) {
        const batch = await refineBatch(cursor);
        if (!mounted.current) return;
        cursor = batch.nextCursor;
        setState((current) => ({
          ...current,
          refined: current.refined + batch.refined,
          skipped: current.skipped + batch.skipped,
          failed: current.failed + batch.failed,
          processed: batch.processed,
          total: batch.total,
          cursor,
          phase: batch.done ? "done" : "running",
        }));
        if (batch.done) break;
      }
    } catch (caught) {
      if (!mounted.current) return;
      setState((current) => ({
        ...current,
        phase: "error",
        error: caught instanceof Error ? caught.message : "Could not refine images.",
      }));
      return;
    }
    // The run is complete at this point; a failed list reload must not offer a
    // retry that would start the whole library again.
    try {
      await onFinished();
    } catch {
      if (mounted.current) setState((current) => ({ ...current, error: "The image list could not reload. Refresh the page to see the refined images." }));
    }
  };

  const close = () => {
    if (running) return;
    onClose(state.phase === "confirm" ? null : { refined: state.refined, skipped: state.skipped, failed: state.failed });
  };

  const { phase, processed, total, refined, skipped, failed } = state;
  const title = phase === "confirm"
    ? "Refine existing images?"
    : phase === "done" ? "Images refined" : phase === "error" ? "Refining stopped" : "Refining images";
  const statusLine = total > 0
    ? `${phase === "done" ? "Refined" : "Refining"} ${processed} of ${total} images`
    : phase === "done" ? "There were no library images to refine." : "Starting…";

  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="admin-dialog admin-refine-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refine-images-title"
        aria-describedby="refine-images-status"
        aria-busy={running}
        data-testid="refine-images-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="refine-images-title">{title}</h2>
        {phase === "confirm" ? (
          <>
            <p id="refine-images-status">
              Recompress every library photo to a 1600px master and an 800px card. This can take a few minutes and cannot be undone.
            </p>
            <div className="admin-dialog-actions">
              <button className="admin-button primary" type="button" data-testid="refine-images-confirm" onClick={() => void run(null)}>
                Refine images
              </button>
              <button className="admin-button ghost" type="button" onClick={close}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className={`admin-refine-progress is-${phase}`}>
              <p id="refine-images-status" aria-live="polite" data-testid="refine-images-status">{statusLine}</p>
              <progress
                aria-label="Refine progress"
                max={Math.max(total, 1)}
                value={phase === "done" ? Math.max(total, 1) : processed}
              />
              <dl className="admin-refine-counts" data-testid="refine-images-counts">
                <div><dt>Refined</dt><dd>{refined}</dd></div>
                <div><dt>Skipped</dt><dd>{skipped}</dd></div>
                <div className={failed > 0 ? "has-failures" : undefined}><dt>Failed</dt><dd>{failed}</dd></div>
              </dl>
              {phase === "done" && state.error && (
                <p className="admin-refine-error" role="alert">{state.error}</p>
              )}
              {phase === "running" && (
                <p className="admin-refine-note">Keep this window open until it finishes.</p>
              )}
              {phase === "error" && (
                <p className="admin-refine-error" role="alert" data-testid="refine-images-error">
                  {state.error} {processed > 0 ? `${processed} of ${total} images were processed before it stopped.` : ""} Try again to continue from where it stopped.
                </p>
              )}
            </div>
            <div className="admin-dialog-actions">
              {phase === "error" && (
                <button className="admin-button primary" type="button" data-testid="refine-images-retry" onClick={() => void run(state.cursor)}>
                  Try again
                </button>
              )}
              <button
                className={`admin-button ${phase === "done" ? "primary" : "ghost"}`}
                type="button"
                data-testid="refine-images-close"
                onClick={close}
                disabled={running}
              >
                {running ? "Refining…" : phase === "done" ? "Done" : "Close"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
