"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="section">
      <div className="content-width">
        <div className="empty-state" role="alert">
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--green)", marginBottom: 12 }}>
            This page could not be loaded
          </h1>
          <p style={{ marginBottom: 24 }}>{error.message || "The catalogue service is unavailable."}</p>
          <button type="button" className="button button-primary" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}
