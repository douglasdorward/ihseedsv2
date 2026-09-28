import Link from "next/link";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`logo ${inverse ? "logo-inverse" : ""}`} aria-label="Back to home">
      <img src="/ih-seeds-logo.png" alt="IH Seeds — Irwin Hunter & Co" width={178} height={117} loading="eager" fetchPriority="low" decoding="async" />
    </Link>
  );
}