import { Router } from "express";
import * as service from "./route.service.js";
import {
  createRouteSchema,
  updateRouteSchema,
  routeIdParamSchema,
  routeQuerySchema,
} from "./route.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

const publicRouter = Router();
publicRouter.get(
  "/",
  validate(routeQuerySchema, "query"),
  asyncHandler(async (req, res) => ok(res, await service.listPublic(req.query)))
);

const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get(
  "/",
  validate(routeQuerySchema, "query"),
  asyncHandler(async (req, res) => ok(res, await service.listAdmin(req.query)))
);

adminRouter.post(
  "/",
  validate(createRouteSchema),
  asyncHandler(async (req, res) => ok(res, await service.create(req.body), 201))
);

adminRouter.patch(
  "/:id",
  validate(routeIdParamSchema, "params"),
  validate(updateRouteSchema),
  asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body)))
);

adminRouter.delete(
  "/:id",
  validate(routeIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.remove(req.params.id)))
);

export { publicRouter as routesPublicRouter, adminRouter as routesAdminRouter };
