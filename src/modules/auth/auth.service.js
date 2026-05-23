import { env } from "../../config/env.js";
import * as authRepo from "./auth.repository.js";
import * as otpService from "./otp.service.js";
import * as tokenService from "./token.service.js";
import * as walletService from "../wallet/wallet.service.js";
import * as r2 from "../../clients/r2.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../shared/errors.js";

function parseDurationToMs(value) {
  const match = String(value).match(/^(\d+)([smhd])$/u);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * multipliers[unit];
}

const REFRESH_TTL_MS = parseDurationToMs(env.JWT_REFRESH_EXPIRY);

async function publicUser(user) {
  const balance = user.role === "DRIVER" ? await walletService.getDriverBalance(user.id) : null;
  return {
    id: user.id,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    registeredApp: user.registeredApp,
    avatarUrl: user.avatarUrl,
    referralCode: user.referralCode,
    balance,
  };
}

async function createSessionAndTokens(user, deviceId, deviceName) {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const draftSession = await authRepo.upsertSession({
    userId: user.id,
    deviceId,
    deviceName,
    refreshTokenHash: "",
    expiresAt,
  });

  const { accessToken, refreshToken, refreshTokenHash } = await tokenService.issueTokens(
    user.id,
    user.role,
    draftSession.id
  );

  await authRepo.updateSessionTokens(draftSession.id, refreshTokenHash, expiresAt);

  return { accessToken, refreshToken, sessionId: draftSession.id };
}

/**
 * Decides login outcome based on user role and which app is requesting.
 * - PASSENGER app: only registeredApp=PASSENGER users may log in.
 * - DRIVER app: registeredApp=DRIVER users; legacy non-driver-role users are
 *   auto-promoted at login (no admin approval required for now).
 * - ADMIN role: never allowed in either mobile app.
 */
function resolveLoginStatus(user, appType) {
  // Admins (role=ADMIN) may log in from any appType — the web panel sends
  // PASSENGER; mobile apps will block admin endpoints via requireRole anyway.
  if (user.role === "ADMIN") {
    return "AUTHENTICATED";
  }

  if (user.registeredApp !== appType) {
    throw new ForbiddenError(
      appType === "DRIVER"
        ? "This phone is registered as a passenger. Use the passenger app."
        : "This phone is registered as a driver. Use the driver app.",
      "WRONG_APP"
    );
  }

  return "AUTHENTICATED";
}

export async function requestOtp(phone) {
  const result = await otpService.issueOtp(phone);
  return { message: "OTP sent", ...result };
}

export async function verifyOtp({ phone, code, deviceId, deviceName, appType }) {
  await otpService.verifyOtp(phone, code);

  let user = await authRepo.findUserByPhone(phone);

  if (!user) {
    const registerToken = tokenService.signRegisterToken(phone, deviceId, deviceName, appType);
    return {
      isNewUser: true,
      status: "REGISTRATION_REQUIRED",
      registerToken,
    };
  }

  if (!user.isActive) {
    throw new ForbiddenError("Account deactivated", "ACCOUNT_DEACTIVATED");
  }

  if (appType === "DRIVER" && user.registeredApp === "DRIVER" && user.role !== "DRIVER") {
    user = await authRepo.promoteToDriver(user.id);
  }

  const status = resolveLoginStatus(user, appType);
  const tokens = await createSessionAndTokens(user, deviceId, deviceName);

  return {
    isNewUser: false,
    status,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: await publicUser(user),
  };
}

export async function completeRegister({ registerToken, firstName, lastName, referralCode, avatarFile }) {
  let payload;
  try {
    payload = tokenService.verifyRegisterToken(registerToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired register token", "REGISTER_TOKEN_INVALID");
  }

  const existing = await authRepo.findUserByPhone(payload.phone);
  if (existing) {
    throw new BadRequestError("User already registered, please log in", "ALREADY_REGISTERED");
  }

  let referredBy = null;
  if (referralCode) {
    const referrer = await authRepo.findUserByReferralCode(referralCode);
    if (!referrer) {
      throw new BadRequestError("Referral code not found", "REFERRAL_INVALID");
    }
    referredBy = referrer.id;
  }

  let avatarUrl = null;
  if (avatarFile) {
    const uploaded = await r2.uploadBuffer({
      buffer: avatarFile.buffer,
      contentType: avatarFile.mimetype,
      prefix: "avatars",
      originalName: avatarFile.originalname,
    });
    avatarUrl = uploaded.url;
  }

  const user = await authRepo.createUser({
    phone: payload.phone,
    firstName,
    lastName,
    registeredApp: payload.appType,
    referredBy,
    avatarUrl,
  });

  const tokens = await createSessionAndTokens(user, payload.deviceId, payload.deviceName);

  return {
    status: "AUTHENTICATED",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: await publicUser(user),
  };
}

export async function refresh(refreshToken) {
  let payload;
  try {
    payload = tokenService.verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token", "REFRESH_TOKEN_INVALID");
  }

  const session = await authRepo.findSessionById(payload.sessionId);
  if (!session || session.userId !== payload.sub) {
    throw new UnauthorizedError("Session not found", "SESSION_NOT_FOUND");
  }
  if (!session.user.isActive) {
    throw new ForbiddenError("Account deactivated", "ACCOUNT_DEACTIVATED");
  }
  if (session.expiresAt < new Date()) {
    await authRepo.deleteSession(session.id);
    throw new UnauthorizedError("Session expired", "SESSION_EXPIRED");
  }

  const matches = await tokenService.compareRefreshToken(refreshToken, session.refreshTokenHash);
  if (!matches) {
    await authRepo.deleteSession(session.id);
    throw new UnauthorizedError("Refresh token reuse detected", "REFRESH_TOKEN_REUSE");
  }

  const tokens = await tokenService.issueTokens(session.userId, session.user.role, session.id);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await authRepo.updateSessionTokens(session.id, tokens.refreshTokenHash, expiresAt);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function logout(userId, sessionId) {
  if (!sessionId) {
    throw new BadRequestError("sessionId required", "SESSION_ID_REQUIRED");
  }
  await authRepo.deleteSessionOwnedBy(sessionId, userId);
  return { message: "Logged out" };
}

export async function listSessions(userId) {
  return authRepo.listSessionsByUser(userId);
}

export async function revokeSession(userId, sessionId) {
  const session = await authRepo.findSessionById(sessionId);
  if (!session || session.userId !== userId) {
    throw new NotFoundError("Session not found", "SESSION_NOT_FOUND");
  }
  await authRepo.deleteSession(sessionId);
  return { message: "Session revoked" };
}
