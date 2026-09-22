"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import type { CatalogueResellerBrand } from "../../lib/catalogue";
import { companyMapsUrl, companyTelHref, type CompanyContact } from "../../lib/company";
import { publicMediaSrc } from "../../lib/site-settings";

const EMPTY_DETAILS = { location: "", soil: "", rainfall: "", landSize: "" };
const EMPTY_FORM = { name: "", email: "", phone: "", topic: "General advice", message: "" };

function outletAddress(outlet: { address: string; suburb: string; postcode: string }) {
  return [outlet.address, outlet.suburb, outlet.postcode].filter(Boolean).join(", ");
}

function directionsUrl(outlet: { address: string; suburb: string; postcode: string; mapsUrl: string }) {
  if (outlet.mapsUrl.trim()) return outlet.mapsUrl.trim();
  const query = outletAddress(outlet);
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function outletPoint(mapsUrl: string) {
  try {
    const query = new URL(mapsUrl).searchParams.get("query") ?? "";
    const match = query.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function distanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistance(km: number) {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

function listingSortName(brand: CatalogueResellerBrand, outlet: { name: string }) {
  if (brand.kind === "elders" || brand.kind === "nutrien") return outlet.name;
  return `${brand.name} ${outlet.name}`;
}

function compareListingNames(
  a: { brand: CatalogueResellerBrand; outlet: { name: string } },
  b: { brand: CatalogueResellerBrand; outlet: { name: string } },
) {
  return listingSortName(a.brand, a.outlet).localeCompare(listingSortName(b.brand, b.outlet), "en-AU", { sensitivity: "base" });
}

export function ContactPage({ resellers, company }: { resellers: CatalogueResellerBrand[]; company: CompanyContact }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [region, setRegion] = useState("All");
  const [showAll, setShowAll] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const hasOfficePhone = Boolean(company.phone.trim() && companyTelHref(company.phone));
  const listings = useMemo(() => {
    const rows = resellers.flatMap((brand) => brand.outlets.map((outlet) => {
      const point = outletPoint(outlet.mapsUrl);
      return { brand, outlet, distanceKm: userLocation && point ? distanceKm(userLocation, point) : null };
    }));
    if (userLocation) {
      return rows.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return compareListingNames(a, b);
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }
    return rows.sort(compareListingNames);
  }, [resellers, userLocation]);

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("This browser can’t share a location. Filter by region instead.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setRegion("All");
        setShowAll(false);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError("Location wasn’t shared. You can still filter by region.");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    );
  };
  const regions = ["All", ...Array.from(new Set(listings.map((listing) => listing.outlet.region).filter(Boolean)))];
  const filteredResellers = useMemo(
    () => (region === "All" ? listings : listings.filter((listing) => listing.outlet.region === region)),
    [listings, region],
  );
  const visibleResellers = showAll ? filteredResellers : filteredResellers.slice(0, 6);

  const updateDetail = (key: keyof typeof EMPTY_DETAILS, value: string) => setDetails((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState("sending");
    const extraContext = [
      details.location && `Location: ${details.location}`,
      details.soil && `Soil type: ${details.soil}`,
      details.rainfall && `Annual rainfall / irrigation: ${details.rainfall}`,
      details.landSize && `Land size: ${details.landSize}`,
    ].filter(Boolean).join("\n");
    try {
      const message = [form.message, extraContext].filter(Boolean).join("\n\n");
      const response = await fetch("/api/enquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, message }) });
      if (!response.ok) throw new Error("Unable to send enquiry");
      setSubmitState("sent");
      setForm(EMPTY_FORM);
    } catch {
      setSubmitState("error");
    }
  };

  return (
    <>
      <section className="contact-section contact-page">
        <div className="contact-layout contact-layout-expanded">
          <div className="contact-info-column">
            <div className="contact-intro"><div className="eyebrow">Contact</div><h1>Get in <span>Touch</span></h1><p>Questions on a mix, a sowing rate, or which reseller to order through — {hasOfficePhone ? "call the office or send an enquiry" : "send an enquiry"} and we will get back to you.</p></div>
            <div className="contact-info-cards">
              {hasOfficePhone ? (
                <a className="contact-info-card" href={companyTelHref(company.phone)} data-testid="link-office-phone">
                  <Icon name="phone" size={24} /><span><small>Call the office</small><strong>{company.phone}</strong></span>
                </a>
              ) : null}
              {company.email.trim() ? (
                <a className="contact-info-card" href={`mailto:${company.email}`}><Icon name="mail" size={24} /><span><small>Email</small><strong>{company.email}</strong></span></a>
              ) : null}
              {company.officeHours.trim() ? (
                <div className="contact-info-card"><Icon name="clock" size={24} /><span><small>Office hours</small><strong>{company.officeHours}</strong></span></div>
              ) : null}
              {company.address.trim() ? (
                companyMapsUrl(company.address) ? (
                  <a className="contact-info-card" href={companyMapsUrl(company.address)} target="_blank" rel="noreferrer"><Icon name="map-pin" size={24} /><span><small>Address</small><strong>{company.address}</strong></span></a>
                ) : (
                  <div className="contact-info-card"><Icon name="map-pin" size={24} /><span><small>Address</small><strong>{company.address}</strong></span></div>
                )
              ) : null}
            </div>
          </div>

          <form className="enquiry-form contact-form-card" onSubmit={handleSubmit}>
            <h2>Send an enquiry</h2>
            <div className="form-row">
              <label>Name<input required minLength={2} placeholder="Your name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} data-testid="input-enquiry-name" /></label>
              <label>Phone<input placeholder="Your phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} data-testid="input-enquiry-phone" /></label>
            </div>
            <label>Email<input required type="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} data-testid="input-enquiry-email" /></label>
            <label>What is this about<select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} data-testid="select-enquiry-topic"><option>A sowing rate or mix recommendation</option><option>Availability and pricing</option><option>Becoming a reseller</option><option>Tech sheets and the Seed Guide</option><option>Something else</option></select></label>
            <label>Location<input placeholder="Nearest town or region" value={details.location} onChange={(event) => updateDetail("location", event.target.value)} /></label>
            <div className="form-row">
              <label>Soil type<select value={details.soil} onChange={(event) => updateDetail("soil", event.target.value)}><option value="">Choose a soil type</option><option>Light sand</option><option>Sand</option><option>Loam</option><option>Heavy / clay</option><option>Mixed / not sure</option></select></label>
              <label>Annual rainfall / irrigation<input placeholder="e.g. 450mm or irrigated" value={details.rainfall} onChange={(event) => updateDetail("rainfall", event.target.value)} /></label>
            </div>
            <label>Land size<input placeholder="e.g. 120 ha, 300 acres or 1,200,000 m²" value={details.landSize} onChange={(event) => updateDetail("landSize", event.target.value)} /></label>
            <label>Message<textarea required minLength={10} rows={5} placeholder="Tell us what you're sowing, your rainfall zone, or the question you have" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} data-testid="input-enquiry-message" /></label>
            <div className="form-submit-row">
              <button className="button button-primary" type="submit" disabled={submitState === "sending"} data-testid="button-submit-enquiry">{submitState === "sending" ? "Sending…" : "Send enquiry"}</button>
              {submitState === "sent" && <p className="form-status success" data-testid="status-enquiry-sent">Thanks — your enquiry is with the IH Seeds team.</p>}
              {submitState === "error" && <p className="form-status error" data-testid="status-enquiry-error">We couldn’t send that just now. Please try again.</p>}
            </div>
          </form>
        </div>
      </section>

      <section className="reseller-section" id="locations">
        <div className="reseller-content">
          <div className="reseller-heading">
            <div><div className="eyebrow">Reseller</div><h2>near you</h2></div>
            <button className="button button-outline" type="button" onClick={shareLocation} disabled={locating}><Icon name="map-pin" size={18} /> {locating ? "Locating…" : "Share location"}</button>
          </div>
          {locationError ? <p className="reseller-location-status" role="alert">{locationError}</p> : null}
          <p className="reseller-lead">{userLocation ? "Closest stores first, from the location you shared." : `We sell through rural resellers across Western Australia. Filter by region to find your closest store${hasOfficePhone ? ", or call the office and we will point you the right way" : ""}.`}</p>
          {regions.length > 1 && (
            <div className="region-chips" aria-label="Filter resellers by region">
              {regions.map((currentRegion) => <button key={currentRegion} className={region === currentRegion ? "active" : ""} type="button" onClick={() => { setRegion(currentRegion); setShowAll(false); }}>{currentRegion}</button>)}
            </div>
          )}
          <div className="reseller-list">
            {visibleResellers.map(({ brand, outlet, distanceKm: distance }) => {
              const address = outletAddress(outlet);
              const maps = directionsUrl(outlet);
              const logo = publicMediaSrc({ src: brand.logoSrc, assetId: brand.logoAssetId })
                || (brand.kind === "elders" ? "/elders-logo.webp" : brand.kind === "nutrien" ? "/nutrien-logo.webp" : "");
              return (
                <div className="reseller-row" key={`${brand.id}-${outlet.id}`}>
                  <div className="reseller-identity">
                    {logo ? (
                      <img className="reseller-logo" src={logo} alt="" />
                    ) : brand.kind === "independent" ? (
                      <span className="reseller-logo reseller-logo-shop" aria-hidden="true">
                        <Icon name="store" size={24} />
                      </span>
                    ) : null}
                    <div>
                      <strong>{brand.name} {outlet.name}</strong>
                      <span>{address || (hasOfficePhone ? "Call the office for this store’s address." : "Address on request.")}</span>
                    </div>
                  </div>
                  <span>{outlet.region || "Western Australia"}{distance != null ? ` · ${formatDistance(distance)}` : ""}</span>
                  <div className="reseller-contacts">
                    {outlet.phone ? <a href={`tel:${outlet.phone.replace(/[^\d+]/g, "")}`}>{outlet.phone}</a> : <span>Phone on request</span>}
                    {outlet.email ? <a href={`mailto:${outlet.email}`}>{outlet.email}</a> : null}
                  </div>
                  {maps
                    ? <a className="button button-outline button-small" href={maps} target="_blank" rel="noreferrer">Get directions</a>
                    : <span />}
                </div>
              );
            })}
            {visibleResellers.length === 0 && <div className="reseller-empty">No resellers listed in that region yet{hasOfficePhone ? " — call the office and we will find your closest" : ""}.</div>}
          </div>
          {filteredResellers.length > 6 && <div className="centered-action"><button className="button button-outline" type="button" onClick={() => setShowAll((current) => !current)}>{showAll ? "Show fewer" : "View all"}</button></div>}
        </div>
      </section>
    </>
  );
}
