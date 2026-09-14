"use client";

type CategoryGroup = {
  id: number | "All";
  label: string;
  count: number;
  href: string;
};

export function CategoryFilterControls({
  groups,
  activeGroup,
  onSelect,
}: {
  groups: CategoryGroup[];
  activeGroup: number | "All";
  onSelect: (group: CategoryGroup) => void;
}) {
  return (
    <div className="chip-scroller category-group-chips" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      {groups.map((group) => {
        const selected = activeGroup === group.id;
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelect(group)}
            aria-pressed={selected}
            style={{
              padding: "9px 20px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              border: `2px solid ${selected ? "var(--green)" : "var(--line)"}`,
              background: selected ? "var(--green)" : "transparent",
              color: selected ? "#FFFFFF" : "var(--green)",
            }}
          >
            {group.label} ({group.count})
          </button>
        );
      })}
    </div>
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
