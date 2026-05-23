import { Router } from "express";
import * as service from "./district.service.js";
import { districtIdParamSchema, regionIdParamSchema } from "./district.schemas.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => ok(res, await service.listAll()))
);

router.get(
  "/by-region/:regionId",
  validate(regionIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.listByRegion(req.params.regionId)))
);

router.get(
  "/:id",
  validate(districtIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.getById(req.params.id)))
);

export default router;
