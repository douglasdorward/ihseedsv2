const OUTER = "50,2 57.5,13.4 69.6,5.3 71.5,19.1 86.6,14.7 81.9,29.4 97.2,31.4 87.1,43.4 98,50 87.1,56.6 97.2,68.6 81.9,70.6 86.6,85.3 71.5,80.9 69.6,94.7 57.5,86.6 50,98 42.5,86.6 30.4,94.7 28.5,80.9 13.4,85.3 18.1,70.6 2.8,68.6 12.9,56.6 2,50 12.9,43.4 2.8,31.4 18.1,29.4 13.4,14.7 28.5,19.1 30.4,5.3 42.5,13.4";

export function NewStamp({ size = "card" }: { size?: "card" | "hero" }) {
  return (
    <span className={`product-new-stamp${size === "hero" ? " is-hero" : ""}`} aria-label="New">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <polygon points={OUTER} fill="#fff6f0" stroke="#c1121f" strokeWidth="2.6" strokeLinejoin="miter" />
        <text
          x="50"
          y="57"
          textAnchor="middle"
          fill="#c1121f"
          fontFamily="Raleway, Tahoma, sans-serif"
          fontSize="22"
          fontWeight="800"
          letterSpacing="1.6"
        >
          NEW
        </text>
      </svg>
    </span>
  );
}

export function ProductNewStamp({
  listingState,
  size = "card",
}: {
  listingState?: unknown;
  size?: "card" | "hero";
}) {
  if (listingState !== "New") return null;
  return <NewStamp size={size} />;
}
