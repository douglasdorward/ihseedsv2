import { test } from "node:test";
import assert from "node:assert/strict";
import { sendEnquiryEmail } from "../src/lib/enquiry-email";

const enquiry = { id: 42, name: "Test visitor", email: "visitor@example.com", phone: "123", topic: "Pasture\r\nquestion", message: "Which seed suits sandy soil?\nLocation: Perth" };
const config = { from: "sender@example.com", to: "team@example.com" };

test("sends enquiry to the configured inbox with visitor reply-to and all context", async () => {
  const id = await sendEnquiryEmail(enquiry, config, async (connector, path, options) => {
    assert.equal(connector, "resend");
    assert.equal(path, "/emails");
    assert.equal(options.headers["Idempotency-Key"], "enquiry-42");
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, [config.to]);
    assert.equal(body.reply_to, enquiry.email);
    assert.equal(body.from, "IH Seeds enquiries <sender@example.com>");
    assert.ok(!body.subject.includes("\n"));
    for (const value of [enquiry.name, enquiry.email, enquiry.phone, enquiry.message]) {
      assert.ok(body.text.includes(value));
    }
    return Response.json({ id: "email-test-id" });
  });
  assert.equal(id, "email-test-id");
});

test("rejects missing configuration without contacting Resend", async () => {
  await assert.rejects(sendEnquiryEmail(enquiry, { from: undefined, to: config.to }, async () => {
    assert.fail("Must not send without a sender");
  }), /not configured/);
});

test("provider rejection and malformed success are explicit failures", async () => {
  await assert.rejects(sendEnquiryEmail(enquiry, config, async () => Response.json({ message: "private details" }, { status: 403 })), /HTTP 403/);
  await assert.rejects(sendEnquiryEmail(enquiry, config, async () => Response.json({})), /email ID/);
});