import { Router } from "express";
import * as ctrl from "./order.controller.js";
import {
  createOrderSchema,
  passengerOrderListQuerySchema,
  openOrdersQuerySchema,
  orderIdParamSchema,
  cancelOrderSchema,
  arriveSchema,
  foundSchema,
} from "./order.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

// Passenger-facing /api/orders
const passengerRouter = Router();
passengerRouter.use(requireAuth);

passengerRouter.post("/", validate(createOrderSchema), asyncHandler(ctrl.createOrder));
passengerRouter.get(
  "/mine",
  validate(passengerOrderListQuerySchema, "query"),
  asyncHandler(ctrl.listMyOrders)
);
passengerRouter.get(
  "/:id",
  validate(orderIdParamSchema, "params"),
  asyncHandler(ctrl.getOrder)
);
passengerRouter.post(
  "/:id/cancel",
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema),
  asyncHandler(ctrl.cancelOrder)
);

// Driver-facing /api/driver/orders
const driverRouter = Router();
driverRouter.use(requireAuth, requireRole("DRIVER"));

driverRouter.get(
  "/open",
  validate(openOrdersQuerySchema, "query"),
  asyncHandler(ctrl.listOpenOrders)
);
driverRouter.get(
  "/:id",
  validate(orderIdParamSchema, "params"),
  asyncHandler(ctrl.getOrder)
);
driverRouter.post(
  "/:id/arrive",
  validate(orderIdParamSchema, "params"),
  validate(arriveSchema),
  asyncHandler(ctrl.arrive)
);
driverRouter.post(
  "/:id/found",
  validate(orderIdParamSchema, "params"),
  validate(foundSchema),
  asyncHandler(ctrl.found)
);
driverRouter.post(
  "/:id/cancel",
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema),
  asyncHandler(ctrl.cancelOrder)
);

// Admin facing /api/admin/orders
const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.post(
  "/:id/force-cancel",
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema),
  asyncHandler(ctrl.adminForceCancel)
);

export {
  passengerRouter as ordersPassengerRouter,
  driverRouter as ordersDriverRouter,
  adminRouter as ordersAdminRouter,
};
