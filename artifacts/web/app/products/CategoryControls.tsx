"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CategoryGroup = {
  id: number | "All";
  label: string;
  count: number;
  href: string;
};

export function CategoryFilterControls({
  groups,
  initialGroup,
  rootHeading,
  navigates,
}: {
  groups: CategoryGroup[];
  initialGroup: number | "All";
  rootHeading: string;
  navigates: boolean;
}) {
  const router = useRouter();
  const [activeGroup, setActiveGroup] = useState<number | "All">(initialGroup);

  const selectGroup = (group: CategoryGroup) => {
    if (navigates) {
      router.push(group.href);
      return;
    }

    setActiveGroup(group.id);
    document.querySelectorAll<HTMLElement>("[data-category-product]").forEach((element) => {
      element.hidden =
        group.id !== "All" &&
        element.dataset.subcategoryId !== String(group.id);
    });

    const heading = document.getElementById("category-products-heading");
    if (heading) {
      heading.textContent =
        group.id === "All" ? rootHeading : group.label;
    }
  };

  return (
    <section className="category-sticky" style={{ background: "#FFFFFF", borderBottom: "1px solid var(--line)", position: "sticky", top: 141, zIndex: 15 }}>
      <div className="chip-scroller" style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 40px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => selectGroup(group)}
            style={{
              padding: "9px 20px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              border: `2px solid ${activeGroup === group.id ? "var(--green)" : "var(--line)"}`,
              background: activeGroup === group.id ? "var(--green)" : "transparent",
              color: activeGroup === group.id ? "#FFFFFF" : "var(--green)",
            }}
          >
            {group.label} ({group.count})
          </button>
        ))}
      </div>
    </section>
  );
}

export function CategoryViewToggle() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const toggle = () => {
    const nextMode = viewMode === "grid" ? "table" : "grid";
    const grid = document.getElementById("category-products-grid");
    const table = document.getElementById("category-products-table");
    if (grid) grid.hidden = nextMode !== "grid";
    if (table) table.hidden = nextMode !== "table";
    setViewMode(nextMode);
  };

  return (
    <button onClick={toggle} className="button button-outline" style={{ padding: "6px 16px", fontSize: 14 }}>
      {viewMode === "grid" ? "Compare as a table" : "View as grid"}
    </button>
  );
}