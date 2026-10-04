"use client";

import Link from "next/link";

type CategoryGroup = {
  id: number | "All";
  label: string;
  count: number;
  href: string;
};

/**
 * Sub-category pills. Each pill is a real link to that sub-category's own page
 * (and "All" to the root page), so every group is crawlable and shareable.
 */
export function CategoryFilterControls({
  groups,
  activeGroup,
}: {
  groups: CategoryGroup[];
  activeGroup: number | "All";
}) {
  return (
    <nav aria-label="Sub-categories" className="chip-scroller category-group-chips" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      {groups.map((group) => {
        const selected = activeGroup === group.id;
        return (
          <Link
            key={group.id}
            href={group.href}
            scroll={false}
            aria-current={selected ? "page" : undefined}
            style={{
              padding: "9px 20px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              border: `2px solid ${selected ? "var(--green)" : "var(--line)"}`,
              background: selected ? "var(--green)" : "transparent",
              color: selected ? "#FFFFFF" : "var(--green)",
            }}
          >
            {group.label} ({group.count})
          </Link>
        );
      })}
    </nav>
  );
}

export function CategoryViewToggle({
  viewMode,
  onToggle,
}: {
  viewMode: "grid" | "table";
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className="button button-outline" style={{ padding: "6px 16px", fontSize: 14 }}>
      {viewMode === "grid" ? "Compare as a table" : "View as grid"}
    </button>
  );
}
