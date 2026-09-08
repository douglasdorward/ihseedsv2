export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "menu") return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
  return <svg {...common}><path d="M12 20V11m0 0c-3.4 0-5.5-1.8-5.5-5.5C10.3 5.5 12 7.4 12 11Zm0 0c3.4 0 5.5-1.8 5.5-5.5C13.7 5.5 12 7.4 12 11Z" /></svg>;
}