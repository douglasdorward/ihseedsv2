export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "menu") return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
  if (name === "users") return <svg {...common}><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20c.7-3.4 2.6-5 5.7-5s5 1.6 5.7 5" /><path d="M13.5 15.5c1-.7 2.1-1 3.5-1 2.5 0 4 1.4 4.5 4.5" /></svg>;
  if (name === "arrow-right") return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
  if (name === "map-pin") return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  if (name === "sprout") return <svg {...common}><path d="M12 21V10M12 14c-4.5 0-6.5-2.5-6.5-6.5C9.5 7.5 12 9.5 12 14Zm0-4c0-4.1 2.2-6.2 6.5-6.2 0 3.8-2.1 6.2-6.5 6.2Z" /></svg>;
  return <svg {...common}><path d="M12 20V11m0 0c-3.4 0-5.5-1.8-5.5-5.5C10.3 5.5 12 7.4 12 11Zm0 0c3.4 0 5.5-1.8 5.5-5.5C13.7 5.5 12 7.4 12 11Z" /></svg>;
}