import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { env } from "../../config/env.js";

const REFRESH_HASH_ROUNDS = 10;

export function signAccessToken(userId, role, sessionId) {
  return jwt.sign(
    { sub: userId, role, sessionId },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY }
  );
}

export function signRefreshToken(userId, sessionId) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: userId, sessionId, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY }
  );
  return token;
}

export function signRegisterToken(phone, deviceId, deviceName, appType) {
  return jwt.sign(
    { phone, deviceId, deviceName, appType, purpose: "register" },
    env.JWT_REGISTER_SECRET,
    { expiresIn: env.JWT_REGISTER_EXPIRY }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

export function verifyRegisterToken(token) {
  const payload = jwt.verify(token, env.JWT_REGISTER_SECRET);
  if (payload.purpose !== "register") {
    throw new Error("Invalid register token purpose");
  }
  return payload;
}

export function hashRefreshToken(token) {
  return bcrypt.hash(token, REFRESH_HASH_ROUNDS);
}

export function compareRefreshToken(token, hash) {
  return bcrypt.compare(token, hash);
}

export async function issueTokens(userId, role, sessionId) {
  const accessToken = signAccessToken(userId, role, sessionId);
  const refreshToken = signRefreshToken(userId, sessionId);
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  return { accessToken, refreshToken, refreshTokenHash };
}
