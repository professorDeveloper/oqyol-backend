import { Router } from "express";
import * as authController from "./auth.controller.js";
import {
  sendOtpSchema,
  verifyOtpSchema,
  completeRegisterSchema,
  refreshSchema,
  logoutSchema,
  sessionIdParamSchema,
} from "./auth.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { singleImage } from "../../middleware/upload.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { otpSendLimiter, otpVerifyLimiter } from "../../middleware/rateLimit.js";

const router = Router();

router.post(
  "/send-otp",
  otpSendLimiter,
  validate(sendOtpSchema),
  asyncHandler(authController.sendOtp)
);

router.post(
  "/verify-otp",
  otpVerifyLimiter,
  validate(verifyOtpSchema),
  asyncHandler(authController.verifyOtp)
);

router.post(
  "/complete-register",
  singleImage("avatar"),
  validate(completeRegisterSchema),
  asyncHandler(authController.completeRegister)
);

router.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(authController.refresh)
);

router.post(
  "/logout",
  requireAuth,
  validate(logoutSchema),
  asyncHandler(authController.logout)
);

router.get(
  "/sessions",
  requireAuth,
  asyncHandler(authController.listSessions)
);

router.delete(
  "/sessions/:id",
  requireAuth,
  validate(sessionIdParamSchema, "params"),
  asyncHandler(authController.revokeSession)
);

export default router;
