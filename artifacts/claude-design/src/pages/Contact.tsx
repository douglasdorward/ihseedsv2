import React, { useMemo, useState } from "react";
import { useEnquiry } from "../hooks/useApi";
import { Icon } from "../components/ui";

const RESELLERS = [
  { name: "Elders Katanning", address: "15 Clive St, Katanning WA 6317", region: "Great Southern", phone: "(08) 9821 1455" },
  { name: "Landmark Albany", address: "92 Sanford Rd, Albany WA 6330", region: "Great Southern", phone: "(08) 9841 2233" },
  { name: "CRT Esperance Rural", address: "2 Dempster St, Esperance WA 6450", region: "Esperance", phone: "(08) 9071 3300" },
  { name: "Elders Northam", address: "188 Fitzgerald St, Northam WA 6401", region: "Wheatbelt", phone: "(08) 9622 1166" },
  { name: "Landmark Merredin", address: "10 Great Eastern Hwy, Merredin WA 6415", region: "Wheatbelt", phone: "(08) 9041 1022" },
  { name: "Nutrien Ag Bunbury", address: "45 Spencer St, Bunbury WA 6230", region: "South West", phone: "(08) 9721 4477" },
  { name: "CRT Manjimup Rural", address: "33 Rose St, Manjimup WA 6258", region: "South West", phone: "(08) 9771 1099" },
  { name: "Elders Geraldton", address: "5 Utakarra Rd, Geraldton WA 6530", region: "Midwest", phone: "(08) 9964 2244" },
  { name: "Landmark Broome", address: "18 Frederick St, Broome WA 6725", region: "Kimberley", phone: "(08) 9192 1188" },
];

const EMPTY_DETAILS = { location: "", soil: "", rainfall: "", landSize: "" };

export default function Contact() {
  const { form, setForm, submitState, submitEnquiry } = useEnquiry();
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [region, setRegion] = useState("All");
  const [showAll, setShowAll] = useState(false);
  const regions = ["All", ...Array.from(new Set(RESELLERS.map((reseller) => reseller.region)))];
  const filteredResellers = useMemo(
    () => (region === "All" ? RESELLERS : RESELLERS.filter((reseller) => reseller.region === region)),
    [region],
  );
  const visibleResellers = showAll ? filteredResellers : filteredResellers.slice(0, 6);

  const updateDetail = (key: keyof typeof EMPTY_DETAILS, value: string) => {
    setDetails((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const extraContext = [
      details.location && `Location: ${details.location}`,
      details.soil && `Soil type: ${details.soil}`,
      details.rainfall && `Annual rainfall / irrigation: ${details.rainfall}`,
      details.landSize && `Land size: ${details.landSize}`,
    ].filter(Boolean).join("\n");
    void submitEnquiry(event, extraContext);
  };

  return (
    <>
      <section className="contact-section contact-page">
        <div className="contact-layout contact-layout-expanded">
          <div className="contact-info-column">
            <div className="contact-intro">
              <div className="eyebrow">Contact</div>
              <h1>Get in <span>Touch</span></h1>
              <p>Questions on a mix, a sowing rate, or which reseller to order through — call the office or send an enquiry and we will get back to you.</p>
            </div>

            <div className="contact-info-cards">
              <a className="contact-info-card" href="tel:+61891234567">
                <Icon name="phone" size={24} />
                <span><small>Call the office</small><strong>(08) 9123 4567</strong></span>
              </a>
              <a className="contact-info-card" href="mailto:info@irwinhunter.com.au">
                <Icon name="mail" size={24} />
                <span><small>Email</small><strong>info@irwinhunter.com.au</strong></span>
              </a>
              <div className="contact-info-card">
                <Icon name="clock" size={24} />
                <span><small>Office hours</small><strong>Monday to Friday, 8am–5pm AWST</strong></span>
              </div>
              <div className="contact-info-card">
                <Icon name="map-pin" size={24} />
                <span><small>Address</small><strong>14 Robinson Rd, Picton East WA 6229</strong></span>
              </div>
            </div>
          </div>

          <form className="enquiry-form contact-form-card" onSubmit={handleSubmit}>
            <h2>Send an enquiry</h2>
            <div className="form-row">
              <label>Name
                <input required minLength={2} placeholder="Your name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} data-testid="input-enquiry-name" />
              </label>
              <label>Phone
                <input placeholder="Your phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} data-testid="input-enquiry-phone" />
              </label>
            </div>
            <label>Email
              <input required type="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} data-testid="input-enquiry-email" />
            </label>
            <label>What is this about
              <select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} data-testid="select-enquiry-topic">
                <option>A sowing rate or mix recommendation</option>
                <option>Availability and pricing</option>
                <option>Becoming a reseller</option>
                <option>Tech sheets and the Seed Guide</option>
                <option>Something else</option>
              </select>
            </label>
            <label>Location
              <input placeholder="Nearest town or region" value={details.location} onChange={(event) => updateDetail("location", event.target.value)} />
            </label>
            <div className="form-row">
              <label>Soil type
                <select value={details.soil} onChange={(event) => updateDetail("soil", event.target.value)}>
                  <option value="">Choose a soil type</option>
                  <option>Light sand</option>
                  <option>Sand</option>
                  <option>Loam</option>
                  <option>Heavy / clay</option>
                  <option>Mixed / not sure</option>
                </select>
              </label>
              <label>Annual rainfall / irrigation
                <input placeholder="e.g. 450mm or irrigated" value={details.rainfall} onChange={(event) => updateDetail("rainfall", event.target.value)} />
              </label>
            </div>
            <label>Land size
              <input placeholder="e.g. 120 ha, 300 acres or 1,200,000 m²" value={details.landSize} onChange={(event) => updateDetail("landSize", event.target.value)} />
            </label>
            <label>Message
              <textarea required minLength={10} rows={5} placeholder="Tell us what you're sowing, your rainfall zone, or the question you have" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} data-testid="input-enquiry-message" />
            </label>
            <div className="form-submit-row">
              <button className="button button-primary" type="submit" disabled={submitState === "sending"} data-testid="button-submit-enquiry">
                {submitState === "sending" ? "Sending…" : "Send enquiry"}
              </button>
              {submitState === "sent" && <p className="form-status success" data-testid="status-enquiry-sent">Thanks — your enquiry is with the IH Seeds team.</p>}
              {submitState === "error" && <p className="form-status error" data-testid="status-enquiry-error">We couldn’t send that just now. Please try again.</p>}
            </div>
          </form>
        </div>
      </section>

      <section className="reseller-section">
        <div className="reseller-content">
          <div className="reseller-heading">
            <div>
              <div className="eyebrow">Reseller</div>
              <h2>near you</h2>
            </div>
            <button className="button button-outline" type="button" onClick={() => setRegion("All")}>
              <Icon name="map-pin" size={18} /> Show all resellers
            </button>
          </div>
          <p className="reseller-lead">We sell through rural resellers across Western Australia. Filter by region to find your closest store, or call the office and we will point you the right way.</p>
          <div className="region-chips" aria-label="Filter resellers by region">
            {regions.map((currentRegion) => (
              <button key={currentRegion} className={region === currentRegion ? "active" : ""} type="button" onClick={() => { setRegion(currentRegion); setShowAll(false); }}>
                {currentRegion}
              </button>
            ))}
          </div>
          <div className="reseller-list">
            {visibleResellers.map((reseller) => (
              <div className="reseller-row" key={reseller.name}>
                <div><strong>{reseller.name}</strong><span>{reseller.address}</span></div>
                <span>{reseller.region}</span>
                <a href={`tel:${reseller.phone.replace(/[^\d+]/g, "")}`}>{reseller.phone}</a>
                <a className="button button-outline button-small" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reseller.address)}`} target="_blank" rel="noreferrer">Get directions</a>
              </div>
            ))}
            {visibleResellers.length === 0 && <div className="reseller-empty">No resellers listed in that region yet — call the office and we will find your closest.</div>}
          </div>
          {filteredResellers.length > 6 && (
            <div className="centered-action">
              <button className="button button-outline" type="button" onClick={() => setShowAll((current) => !current)}>{showAll ? "Show fewer" : "View all"}</button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}