import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import enquiriesRouter from "./enquiries";
import categoriesRouter from "./categories";
import importRouter from "./import";
import uploadsRouter from "./uploads";
import aiIngestRouter from "./ai-ingest";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(enquiriesRouter);
router.use(categoriesRouter);
router.use(importRouter);
router.use(uploadsRouter);
router.use(aiIngestRouter);

export default router;
