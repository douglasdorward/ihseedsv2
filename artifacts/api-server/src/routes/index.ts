import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import enquiriesRouter from "./enquiries";
import categoriesRouter from "./categories";
import importRouter from "./import";
import administratorsRouter from "./administrators";
import aiIngestRouter from "./ai-ingest";
import authRouter from "./auth";
import mediaRouter from "./media";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(enquiriesRouter);
router.use(categoriesRouter);
router.use(importRouter);
router.use(aiIngestRouter);
router.use(mediaRouter);
router.use(administratorsRouter);

export default router;
