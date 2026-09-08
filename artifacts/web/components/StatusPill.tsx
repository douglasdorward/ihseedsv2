export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { "in-stock": "In stock", low: "Low stock", "very-low": "Very low", unavailable: "Unavailable" };
  return (
    <span className={`status-pill status-${status}`} data-testid={`status-product-${status}`}>
      <i />{labels[status] ?? status}
    </span>
  );
}