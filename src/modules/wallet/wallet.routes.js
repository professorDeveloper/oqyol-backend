import { Router } from "express";
import * as service from "./wallet.service.js";
import { adjustSchema, userIdParamSchema, transactionsQuerySchema } from "./wallet.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

// User-facing /api/wallet (driver & passenger) — own balance + transactions
const userRouter = Router();
userRouter.use(requireAuth);

userRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await service.getMyWallet(req.user.id)))
);

userRouter.get(
  "/transactions",
  validate(transactionsQuerySchema, "query"),
  asyncHandler(async (req, res) => ok(res, await service.listMyTransactions(req.user.id, req.query)))
);

// Admin /api/admin/wallets
const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.post(
  "/:id/adjust",
  validate(userIdParamSchema, "params"),
  validate(adjustSchema),
  asyncHandler(async (req, res) => ok(res, await service.adminAdjust(req.params.id, req.body)))
);

export { userRouter as walletUserRouter, adminRouter as walletAdminRouter };
