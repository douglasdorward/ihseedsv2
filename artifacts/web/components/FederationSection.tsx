import Link from "next/link";

export const FEDERATION_PATH = "/australian-seed-federation";

/**
 * Australian Seed Federation membership blurb with logos.
 * Used as a short teaser on the homepage and About Us page (linking to the full page),
 * and as the page header on the dedicated Seed Federation page (`standalone`).
 */
export function FederationSection({ standalone = false }: { standalone?: boolean }) {
  const Heading = standalone ? "h1" : "h2";
  return (
    <section id="federation" className="section federation-section" aria-labelledby="federation-heading">
      <div className="federation-inner">
        <div className="federation-copy">
          <div className="federation-eyebrow">Part of a trusted industry</div>
          <Heading id="federation-heading"><span>Proudly part of the</span> Australian Seed Federation</Heading>
          <p>
            Family owned and operated in Western Australia since 1966, IH Seeds is a member of the Australian Seed Federation, the national association for Australia&apos;s seed industry.
            Every member must follow its Code of Practice: seed that is clearly labelled, backed by a seed test certificate, and checked by an audit every two years.
          </p>
          {standalone ? null : (
            <Link href={FEDERATION_PATH} className="button button-outline" data-testid="button-federation-learn-more">What the Code of Practice means</Link>
          )}
        </div>
        <div className="federation-logos">
          <div className="federation-logo-card is-member">
            <img src="/asf-member.webp" alt="Australian Seed Federation member" width={552} height={190} loading="lazy" decoding="async" />
          </div>
          <div className="federation-logo-card is-seal">
            <img src="/asf-code-of-practice-440.webp" alt="Australian Seed Federation Code of Practice accredited" width={440} height={441} loading="lazy" decoding="async" />
          </div>
          <div className="federation-logo-card is-anniversary">
            <img src="/ih-seeds-60-years-640.webp" alt="IH Seeds celebrating 60 years, 1966 to 2026" width={640} height={463} loading="lazy" decoding="async" />
          </div>
        </div>
      </div>
    </section>
  );
}
