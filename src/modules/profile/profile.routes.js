import { Router } from "express";
import * as ctrl from "./profile.controller.js";
import { updateMeSchema, updateDriverProfileSchema, deleteMeSchema } from "./profile.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { singleImage } from "../../middleware/upload.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

const meRouter = Router();
meRouter.use(requireAuth);
meRouter.get("/", asyncHandler(ctrl.getMe));
meRouter.patch("/", validate(updateMeSchema), asyncHandler(ctrl.updateMe));
meRouter.post("/avatar", singleImage("avatar"), asyncHandler(ctrl.updateAvatar));
meRouter.post("/deletion/request", asyncHandler(ctrl.requestDeletionOtp));
meRouter.delete("/", validate(deleteMeSchema), asyncHandler(ctrl.deleteMe));

const driverProfileRouter = Router();
driverProfileRouter.use(requireAuth, requireRole("DRIVER"));
driverProfileRouter.get("/", asyncHandler(ctrl.getDriverProfile));
driverProfileRouter.patch("/", validate(updateDriverProfileSchema), asyncHandler(ctrl.updateDriverProfile));

// Driver home dashboard: /api/driver/stats
const driverStatsRouter = Router();
driverStatsRouter.use(requireAuth, requireRole("DRIVER"));
driverStatsRouter.get("/", asyncHandler(ctrl.getDriverStats));

export { meRouter, driverProfileRouter, driverStatsRouter };
