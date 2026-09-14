import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import enquiriesRouter from "./enquiries";
import categoriesRouter from "./categories";
import importRouter from "./import";
import authRouter from "./auth";
import productImagesRouter from "./product-images";
import mediaRouter from "./media";
import administratorsRouter from "./administrators";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(enquiriesRouter);
router.use(categoriesRouter);
router.use(importRouter);
router.use(productImagesRouter);
router.use(mediaRouter);
router.use(administratorsRouter);

export default router;
