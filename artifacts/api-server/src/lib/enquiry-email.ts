import { ReplitConnectors } from "@replit/connectors-sdk";

type Enquiry = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  topic: string;
  message: string;
};

type Proxy = (connector: string, path: string, options: {
  method: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<Response>;

export async function sendEnquiryEmail(
  enquiry: Enquiry,
  config = { from: process.env.ENQUIRY_EMAIL_FROM, to: process.env.ENQUIRY_EMAIL_TO },
  proxy: Proxy = (connector, path, options) => new ReplitConnectors().proxy(connector, path, options),
): Promise<string> {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!config.from || !config.to || !emailPattern.test(config.from) || !emailPattern.test(config.to)) {
    throw new Error("Enquiry email sender or recipient is not configured");
  }
  const response = await proxy("resend", "/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `enquiry-${enquiry.id}`,
    },
    body: JSON.stringify({
      from: `IH Seeds enquiries <${config.from}>`,
      to: [config.to],
      reply_to: enquiry.email,
      subject: `IH Seeds enquiry #${enquiry.id}: ${enquiry.topic.replace(/[\r\n]/g, " ")}`,
      text: [
        `New website enquiry #${enquiry.id}`,
        `Name: ${enquiry.name}`,
        `Email: ${enquiry.email}`,
        `Phone: ${enquiry.phone || "Not provided"}`,
        `Topic: ${enquiry.topic}`,
        "",
        enquiry.message,
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    // Do not include provider response bodies: they may contain submitted personal data.
    throw new Error(`Resend rejected enquiry notification (HTTP ${response.status})`);
  }
  const result = await response.json() as { id?: string };
  if (!result.id) throw new Error("Resend did not return an email ID");
  return result.id;
}