import React from "react";
import { useEnquiry } from "../hooks/useApi";

export default function Contact() {
  const { form, setForm, submitState, submitEnquiry } = useEnquiry();

  return (
    <section id="contact" className="section contact-section" style={{ minHeight: "calc(100vh - 140px - 340px)", display: "flex", alignItems: "center" }}>
      <div className="content-width contact-layout" style={{ width: "100%", margin: "0 auto", padding: "96px 40px" }}>
        <div className="contact-intro">
          <h2><span>Talk to</span> our team</h2>
          <p>Tell us about your country and we’ll help you find a mix and sowing approach that fits the season.</p>
          <p className="contact-detail">
            Western Australia · (08) 9479 1234<br />
            Advice before the order. Support after it.
          </p>
        </div>
        
        <form className="enquiry-form" onSubmit={submitEnquiry}>
          <div className="form-row">
            <label>Name
              <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-enquiry-name" />
            </label>
            <label>Email
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-enquiry-email" />
            </label>
          </div>
          <div className="form-row">
            <label>Phone <small>(optional)</small>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-enquiry-phone" />
            </label>
            <label>What can we help with?
              <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} data-testid="select-enquiry-topic">
                <option>General advice</option>
                <option>Product availability</option>
                <option>Finding a reseller</option>
                <option>Custom pasture mix</option>
              </select>
            </label>
          </div>
          <label>Message
            <textarea required minLength={10} rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us your region, rainfall zone and what you’re sowing." data-testid="input-enquiry-message" />
          </label>
          
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 24 }}>
            <button className="button button-primary" type="submit" disabled={submitState === "sending"} data-testid="button-submit-enquiry">
              {submitState === "sending" ? "Sending…" : "Send enquiry"}
            </button>
            {submitState === "sent" && <p className="form-status success" data-testid="status-enquiry-sent">Thanks — your enquiry is with the IH Seeds team.</p>}
            {submitState === "error" && <p className="form-status error" data-testid="status-enquiry-error">We couldn’t send that just now. Please try again.</p>}
          </div>
        </form>
      </div>
    </section>
  );
}
