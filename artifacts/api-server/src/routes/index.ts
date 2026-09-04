import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import enquiriesRouter from "./enquiries";
import categoriesRouter from "./categories";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(enquiriesRouter);
router.use(categoriesRouter);
router.use(importRouter);

export default router;
