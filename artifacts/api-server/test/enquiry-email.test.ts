import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enquiryEmailConfigFromEnv,
  reportEnquiryEmailOutcome,
  sendEnquiryEmails,
  type EnquiryEmailOutcome,
} from "../src/lib/enquiry-email";

const enquiry = { id: 42, name: "Test visitor", email: "visitor@example.com", phone: "123", topic: "Pasture\r\nquestion", message: "Which seed suits sandy soil?\nLocation: Perth" };
const config = { from: "sender@example.com", sales: "sales@example.com", developerCopy: "dev@example.com" };

type Call = { connector: string; path: string; key: string; body: Record<string, unknown> & { to: string[]; text: string; subject: string } };

function recordingProxy(respond: (to: string) => Response = (to) => Response.json({ id: `id-${to}` })) {
  const calls: Call[] = [];
  const proxy = async (connector: string, path: string, options: { headers: Record<string, string>; body: string }) => {
    const body = JSON.parse(options.body);
    calls.push({ connector, path, key: options.headers["Idempotency-Key"], body });
    return respond(body.to[0]);
  };
  return { calls, proxy };
}

function recordingLogger() {
  const entries: { level: string; fields: Record<string, unknown>; message: string }[] = [];
  const at = (level: string) => (fields: Record<string, unknown>, message: string) => { entries.push({ level, fields, message }); };
  return { entries, log: { info: at("info"), warn: at("warn"), error: at("error") } };
}

test("sends one separate email to sales and one to the developer copy, each with its own idempotency key", async () => {
  const { calls, proxy } = recordingProxy();
  const outcome = await sendEnquiryEmails(enquiry, config, proxy);

  assert.deepEqual(outcome, {
    sales: { status: "sent", emailId: "id-sales@example.com" },
    developerCopy: { status: "sent", emailId: "id-dev@example.com" },
  });
  assert.equal(calls.length, 2);
  const byRecipient = new Map(calls.map((call) => [call.body.to[0], call]));
  assert.equal(byRecipient.get("sales@example.com")?.key, "enquiry-42-sales");
  assert.equal(byRecipient.get("dev@example.com")?.key, "enquiry-42-developer");
  for (const call of calls) {
    assert.equal(call.connector, "resend");
    assert.equal(call.path, "/emails");
    assert.equal(call.body.to.length, 1, "each email names only its own recipient");
    assert.equal(call.body.reply_to, enquiry.email);
    assert.equal(call.body.from, "IH Seeds enquiries <sender@example.com>");
    assert.ok(!("cc" in call.body) && !("bcc" in call.body));
    assert.ok(!call.body.subject.includes("\n"));
    for (const value of [enquiry.name, enquiry.email, enquiry.phone, enquiry.message]) {
      assert.ok(call.body.text.includes(value));
    }
  }
  assert.equal(calls[0].body.text, calls[1].body.text);
  assert.equal(calls[0].body.subject, calls[1].body.subject);
});

test("a failed developer copy still sends the sales email and still tells the visitor it was sent", async () => {
  const { calls, proxy } = recordingProxy((to) => to === "dev@example.com"
    ? Response.json({ message: "private details" }, { status: 500 })
    : Response.json({ id: "sales-id" }));
  const outcome = await sendEnquiryEmails(enquiry, config, proxy);
  assert.equal(calls.length, 2);
  assert.deepEqual(outcome.sales, { status: "sent", emailId: "sales-id" });
  assert.equal(outcome.developerCopy.status, "failed");

  const { entries, log } = recordingLogger();
  assert.equal(reportEnquiryEmailOutcome(log, enquiry.id, outcome), true);
  const warning = entries.find((entry) => entry.level === "warn");
  assert.match(warning?.message ?? "", /developer copy failed/);
  assert.ok(!entries.some((entry) => entry.level === "error"));
});

test("a failed sales email still sends the developer copy and tells the visitor it was only saved", async () => {
  const { calls, proxy } = recordingProxy((to) => to === "sales@example.com"
    ? Response.json({ message: "private details" }, { status: 403 })
    : Response.json({ id: "dev-id" }));
  const outcome = await sendEnquiryEmails(enquiry, config, proxy);
  assert.equal(calls.length, 2);
  assert.deepEqual(outcome.developerCopy, { status: "sent", emailId: "dev-id" });
  assert.deepEqual(outcome.sales, { status: "failed", error: "Resend rejected enquiry notification (HTTP 403)" });

  const { entries, log } = recordingLogger();
  assert.equal(reportEnquiryEmailOutcome(log, enquiry.id, outcome), false);
  assert.match(entries.find((entry) => entry.level === "error")?.message ?? "", /sales email failed/);
});

test("a blank developer copy sends only the sales email", async () => {
  const { calls, proxy } = recordingProxy();
  const outcome = await sendEnquiryEmails(enquiry, { ...config, developerCopy: "" }, proxy);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.to, ["sales@example.com"]);
  assert.deepEqual(outcome.developerCopy, { status: "skipped" });
  const { entries, log } = recordingLogger();
  assert.equal(reportEnquiryEmailOutcome(log, enquiry.id, outcome), true);
  assert.ok(!entries.some((entry) => entry.level !== "info"));
});

test("an invalid developer copy is reported clearly and the sales email still goes out", async () => {
  const { calls, proxy } = recordingProxy();
  const outcome = await sendEnquiryEmails(enquiry, { ...config, developerCopy: "not-an-email" }, proxy);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.to, ["sales@example.com"]);
  assert.equal(outcome.developerCopy.status, "invalid");
  const { entries, log } = recordingLogger();
  assert.equal(reportEnquiryEmailOutcome(log, enquiry.id, outcome), true);
  assert.match(String(entries.find((entry) => entry.level === "warn")?.fields.reason), /developer copy address is invalid/);
});

test("a missing or invalid sales address or sender fails clearly without contacting Resend for sales", async () => {
  for (const broken of [{ sales: undefined }, { sales: "nope" }, { from: undefined }]) {
    const { calls, proxy } = recordingProxy();
    const outcome = await sendEnquiryEmails(enquiry, { ...config, ...broken }, proxy);
    assert.equal(outcome.sales.status, "invalid");
    assert.match((outcome.sales as { error: string }).error, /not configured/);
    assert.ok(!calls.some((call) => call.body.to[0] === "sales@example.com"));
    assert.equal(reportEnquiryEmailOutcome(recordingLogger().log, enquiry.id, outcome), false);
  }
  const { calls, proxy } = recordingProxy();
  await sendEnquiryEmails(enquiry, { ...config, sales: undefined }, proxy);
  assert.deepEqual(calls.map((call) => call.body.to[0]), ["dev@example.com"], "developer copy is still attempted");
});

test("a malformed Resend success is an explicit failure", async () => {
  const { proxy } = recordingProxy(() => Response.json({}));
  const outcome = await sendEnquiryEmails(enquiry, config, proxy);
  assert.deepEqual(outcome.sales, { status: "failed", error: "Resend did not return an email ID" });
});

test("failure logs never include the visitor's submitted details", () => {
  const outcome: EnquiryEmailOutcome = {
    sales: { status: "failed", error: "Resend rejected enquiry notification (HTTP 500)" },
    developerCopy: { status: "failed", error: "Resend rejected enquiry notification (HTTP 500)" },
  };
  const { entries, log } = recordingLogger();
  reportEnquiryEmailOutcome(log, enquiry.id, outcome);
  const logged = JSON.stringify(entries);
  for (const value of [enquiry.name, enquiry.email, enquiry.phone, "sandy soil"]) {
    assert.ok(!logged.includes(value));
  }
});

test("thrown connector errors and unreadable responses never carry visitor details into logs", async () => {
  const leaky = `connector failed for ${enquiry.email} ${enquiry.name} ${enquiry.message}`;
  const outcome = await sendEnquiryEmails(enquiry, config, async (_c, _p, options) => {
    const to = JSON.parse(options.body).to[0];
    if (to === "sales@example.com") throw new Error(leaky);
    return new Response(`not json: ${enquiry.email} ${enquiry.phone}`, { status: 200 });
  });
  assert.deepEqual(outcome.sales, { status: "failed", error: "Unexpected error while sending through Resend" });
  assert.deepEqual(outcome.developerCopy, { status: "failed", error: "Resend returned an unreadable response" });
  const { entries, log } = recordingLogger();
  assert.equal(reportEnquiryEmailOutcome(log, enquiry.id, outcome), false);
  const logged = JSON.stringify(entries);
  for (const value of [enquiry.name, enquiry.email, enquiry.phone, "sandy soil"]) {
    assert.ok(!logged.includes(value));
  }
});

test("reads the sales recipient and developer copy from separate settings", () => {
  assert.deepEqual(enquiryEmailConfigFromEnv({
    ENQUIRY_EMAIL_FROM: " from@example.com ",
    ENQUIRY_EMAIL_TO: "sales@example.com",
    ENQUIRY_EMAIL_DEVELOPER_COPY: "dev@example.com",
  }), { from: "from@example.com", sales: "sales@example.com", developerCopy: "dev@example.com" });
  assert.equal(enquiryEmailConfigFromEnv({}).developerCopy, undefined);
});
