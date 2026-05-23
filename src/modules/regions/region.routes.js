import { Router } from "express";
import * as service from "./region.service.js";
import * as districtService from "../districts/district.service.js";
import {
  createRegionSchema,
  updateRegionSchema,
  regionIdParamSchema,
} from "./region.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

const publicRouter = Router();
publicRouter.get(
  "/",
  asyncHandler(async (_req, res) => ok(res, await service.listPublic()))
);

publicRouter.get(
  "/:id/districts",
  validate(regionIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await districtService.listByRegion(req.params.id)))
);

const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get(
  "/",
  asyncHandler(async (_req, res) => ok(res, await service.listAdmin()))
);

adminRouter.post(
  "/",
  validate(createRegionSchema),
  asyncHandler(async (req, res) => ok(res, await service.create(req.body), 201))
);

adminRouter.patch(
  "/:id",
  validate(regionIdParamSchema, "params"),
  validate(updateRegionSchema),
  asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body)))
);

adminRouter.delete(
  "/:id",
  validate(regionIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.remove(req.params.id)))
);

export { publicRouter as regionsPublicRouter, adminRouter as regionsAdminRouter };
