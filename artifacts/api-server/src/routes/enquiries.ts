import { Router, type IRouter } from "express";
import { db, enquiriesTable } from "@workspace/db";
import { CreateEnquiryBody } from "@workspace/api-zod";
import { sendEnquiryEmail } from "../lib/enquiry-email";

const router: IRouter = Router();
router.post("/enquiries", async (req, res): Promise<void> => {
  const parsed = CreateEnquiryBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid enquiry");
    res.status(400).json({ error: "Please check the form and try again." });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  const [enquiry] = await db.insert(enquiriesTable).values(parsed.data).returning({
    id: enquiriesTable.id,
    createdAt: enquiriesTable.createdAt,
  });
  req.log.info({ enquiryId: enquiry.id }, "Enquiry received");
  let emailSent = false;
  try {
    const emailId = await sendEnquiryEmail({ ...parsed.data, id: enquiry.id });
    emailSent = true;
    req.log.info({ enquiryId: enquiry.id, emailId }, "Enquiry notification accepted by Resend");
  } catch {
    req.log.error({ enquiryId: enquiry.id }, "Enquiry saved but email notification failed");
  }
  res.status(201).json({ ok: true, id: enquiry.id, createdAt: enquiry.createdAt, emailSent });
});

export default router;