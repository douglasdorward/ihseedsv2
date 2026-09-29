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

export type EnquiryEmailConfig = {
  from?: string;
  /** Business inbox. Its outcome decides what the visitor is told. */
  sales?: string;
  /** Optional developer copy. Its outcome is logged only. */
  developerCopy?: string;
};

export type RecipientOutcome =
  | { status: "sent"; emailId: string }
  | { status: "failed"; error: string }
  | { status: "invalid"; error: string }
  | { status: "skipped" };

export type EnquiryEmailOutcome = {
  sales: RecipientOutcome;
  developerCopy: RecipientOutcome;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Failures whose message is fixed text and therefore safe to log. */
class EnquiryEmailError extends Error {}

export function enquiryEmailConfigFromEnv(env: NodeJS.ProcessEnv = process.env): EnquiryEmailConfig {
  return {
    from: env.ENQUIRY_EMAIL_FROM?.trim(),
    sales: env.ENQUIRY_EMAIL_TO?.trim(),
    developerCopy: env.ENQUIRY_EMAIL_DEVELOPER_COPY?.trim(),
  };
}

const defaultProxy: Proxy = (connector, path, options) => new ReplitConnectors().proxy(connector, path, options);

async function sendOne(
  enquiry: Enquiry,
  from: string,
  to: string,
  role: "sales" | "developer",
  proxy: Proxy,
): Promise<string> {
  const response = await proxy("resend", "/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // One key per enquiry and recipient role: a retry never duplicates an
      // email Resend already accepted, and the two emails never collide.
      "Idempotency-Key": `enquiry-${enquiry.id}-${role}`,
    },
    body: JSON.stringify({
      from: `IH Seeds enquiries <${from}>`,
      to: [to],
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
    throw new EnquiryEmailError(`Resend rejected enquiry notification (HTTP ${response.status})`);
  }
  let result: { id?: unknown };
  try {
    result = await response.json() as { id?: unknown };
  } catch {
    throw new EnquiryEmailError("Resend returned an unreadable response");
  }
  if (typeof result?.id !== "string" || !result.id) throw new EnquiryEmailError("Resend did not return an email ID");
  return result.id;
}

async function attempt(send: () => Promise<string>): Promise<RecipientOutcome> {
  try {
    return { status: "sent", emailId: await send() };
  } catch (error) {
    // Only our own fixed messages are kept: connector or parser errors can echo
    // request or response text containing the visitor's details.
    return {
      status: "failed",
      error: error instanceof EnquiryEmailError ? error.message : "Unexpected error while sending through Resend",
    };
  }
}

/**
 * Sends one separate email to the sales inbox and, when configured, one to the
 * developer copy. Both are always attempted; neither failure stops the other.
 */
export async function sendEnquiryEmails(
  enquiry: Enquiry,
  config: EnquiryEmailConfig = enquiryEmailConfigFromEnv(),
  proxy: Proxy = defaultProxy,
): Promise<EnquiryEmailOutcome> {
  const from = config.from && emailPattern.test(config.from) ? config.from : undefined;
  const salesConfigured = !!config.sales && emailPattern.test(config.sales);
  const developerCopy = config.developerCopy || "";

  const sales: Promise<RecipientOutcome> = !from || !salesConfigured
    ? Promise.resolve({ status: "invalid", error: "Enquiry email sender or sales recipient is not configured" })
    : attempt(() => sendOne(enquiry, from, config.sales!, "sales", proxy));

  const developer: Promise<RecipientOutcome> = !developerCopy
    ? Promise.resolve({ status: "skipped" })
    : !emailPattern.test(developerCopy)
      ? Promise.resolve({ status: "invalid", error: "Enquiry developer copy address is invalid" })
      : !from
        ? Promise.resolve({ status: "invalid", error: "Enquiry email sender is not configured" })
        : attempt(() => sendOne(enquiry, from, developerCopy, "developer", proxy));

  const [salesOutcome, developerOutcome] = await Promise.all([sales, developer]);
  return { sales: salesOutcome, developerCopy: developerOutcome };
}

type OutcomeLogger = {
  info: (fields: Record<string, unknown>, message: string) => void;
  warn: (fields: Record<string, unknown>, message: string) => void;
  error: (fields: Record<string, unknown>, message: string) => void;
};

/**
 * Logs each recipient separately and returns whether the visitor should be told
 * the enquiry was sent. Only the sales email decides that. Log fields never
 * include the visitor's submitted details.
 */
export function reportEnquiryEmailOutcome(
  log: OutcomeLogger,
  enquiryId: number,
  outcome: EnquiryEmailOutcome,
): boolean {
  const { sales, developerCopy } = outcome;
  if (sales.status === "sent") {
    log.info({ enquiryId, emailId: sales.emailId }, "Enquiry sales email accepted by Resend");
  } else if (sales.status !== "skipped") {
    log.error({ enquiryId, reason: sales.error }, "Enquiry saved but sales email failed");
  }
  if (developerCopy.status === "sent") {
    log.info({ enquiryId, emailId: developerCopy.emailId }, "Enquiry developer copy accepted by Resend");
  } else if (developerCopy.status !== "skipped") {
    log.warn({ enquiryId, reason: developerCopy.error }, "Enquiry developer copy failed");
  }
  return sales.status === "sent";
}
