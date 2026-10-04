import Link from "next/link";
import { Icon } from "./Icon";

const EXPLAINERS = [
  {
    icon: "users",
    title: "What the ASF is",
    body: "The Australian Seed Federation (ASF) is the national association for Australia's seed industry. Its members agree shared standards for how seed is handled, labelled and sold.",
  },
  {
    icon: "scale",
    title: "What membership means",
    body: "Following the ASF Code of Practice is a condition of membership. Every member accepts it, including IH Seeds.",
  },
  {
    icon: "file-text",
    title: "What the Code requires",
    body: "Seed must be clearly and accurately labelled, and backed by a seed testing analysis certificate available on request. Members also respect plant breeders' rights.",
  },
  {
    icon: "shield",
    title: "Checked, not just claimed",
    body: "Members are audited every two years on their labelling, and only those who pass may display the Code of Practice logo.",
  },
] as const;

const CODE_URL = "https://www.ausseed.org.au/code-of-practice/";

export function FederationExplainer() {
  return (
    <section className="federation-section federation-detail" aria-labelledby="federation-explainer-heading">
      <div className="federation-explainer">
        <h2 id="federation-explainer-heading" className="federation-explainer-heading">What it means to be an ASF member</h2>
        <div className="federation-explainer-grid">
          {EXPLAINERS.map((item) => (
            <div className="federation-explainer-item" key={item.title}>
              <span className="federation-explainer-icon"><Icon name={item.icon} size={26} /></span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>

        <div className="federation-why">
          <h2>Why it matters in your paddock</h2>
          <p>
            Pasture seed is a long-term investment, and you cannot judge it by looking at the bag. A clear label and a seed test certificate
            tell you what is actually in the seed you are paying for, so you can work out sowing rates and compare one lot with another
            with confidence.
          </p>
          <p>
            The Code of Practice sets the same labelling standard for every member, and the two-yearly audit means that standard is checked.
            It is one of the ways we make sure the seed we supply is true to type and consistent with its description.
          </p>
          <div className="federation-why-actions">
            <Link href="/contact" className="button button-primary" data-testid="button-federation-contact">Talk to our team</Link>
            <a className="button button-outline" href={CODE_URL} target="_blank" rel="noopener noreferrer">Read the Code on the ASF website <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>
    </section>
  );
}
