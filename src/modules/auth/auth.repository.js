import crypto from "node:crypto";
import { prisma } from "../../clients/prisma.js";

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_LENGTH = 8;

function generateReferralCode() {
  let result = "";
  for (let i = 0; i < REFERRAL_LENGTH; i += 1) {
    const idx = crypto.randomInt(0, REFERRAL_ALPHABET.length);
    result += REFERRAL_ALPHABET[idx];
  }
  return result;
}

async function uniqueReferralCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode();
    const exists = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
  throw new Error("Failed to generate unique referral code");
}

export function findUserByPhone(phone) {
  return prisma.user.findUnique({ where: { phone } });
}

export function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

export function findUserByReferralCode(referralCode) {
  return prisma.user.findUnique({ where: { referralCode } });
}

export async function createUser({ phone, firstName, lastName, registeredApp, referredBy = null }) {
  return prisma.user.create({
    data: {
      phone,
      firstName,
      lastName,
      registeredApp,
      referredBy,
      referralCode: await uniqueReferralCode(),
    },
  });
}

export function upsertSession({ userId, deviceId, deviceName, refreshTokenHash, expiresAt }) {
  return prisma.userSession.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    create: { userId, deviceId, deviceName, refreshTokenHash, expiresAt },
    update: { deviceName, refreshTokenHash, expiresAt, lastActiveAt: new Date() },
  });
}

export function findSessionById(id) {
  return prisma.userSession.findUnique({
    where: { id },
    include: { user: true },
  });
}

export function updateSessionTokens(id, refreshTokenHash, expiresAt) {
  return prisma.userSession.update({
    where: { id },
    data: { refreshTokenHash, expiresAt, lastActiveAt: new Date() },
  });
}

export function deleteSession(id) {
  return prisma.userSession.delete({ where: { id } });
}

export function deleteSessionOwnedBy(id, userId) {
  return prisma.userSession.deleteMany({ where: { id, userId } });
}

export function listSessionsByUser(userId) {
  return prisma.userSession.findMany({
    where: { userId },
    orderBy: { lastActiveAt: "desc" },
    select: {
      id: true,
      deviceId: true,
      deviceName: true,
      lastActiveAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}
