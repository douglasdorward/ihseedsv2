import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import enquiriesRouter from "./enquiries";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(enquiriesRouter);

export default router;
