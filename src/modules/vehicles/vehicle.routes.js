import { Router } from "express";
import * as vehicleController from "./vehicle.controller.js";
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleIdParamSchema,
} from "./vehicle.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { singleImage } from "../../middleware/upload.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

const router = Router();

router.use(requireAuth, requireRole("DRIVER"));

router.get("/", asyncHandler(vehicleController.getMyVehicle));

router.post(
  "/",
  singleImage("photo"),
  validate(createVehicleSchema),
  asyncHandler(vehicleController.createVehicle)
);

router.patch(
  "/:id",
  validate(vehicleIdParamSchema, "params"),
  singleImage("photo"),
  validate(updateVehicleSchema),
  asyncHandler(vehicleController.updateVehicle)
);

router.delete(
  "/:id",
  validate(vehicleIdParamSchema, "params"),
  asyncHandler(vehicleController.deleteVehicle)
);

export default router;
