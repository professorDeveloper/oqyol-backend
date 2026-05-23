import { prisma } from "../../clients/prisma.js";
import * as repo from "./profile.repository.js";
import * as walletService from "../wallet/wallet.service.js";
import * as otpService from "../auth/otp.service.js";
import * as r2 from "../../clients/r2.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors.js";

export async function publicUser(u) {
  const balance = u.role === "DRIVER" ? await walletService.getDriverBalance(u.id) : null;
  return {
    id: u.id,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    registeredApp: u.registeredApp,
    avatarUrl: u.avatarUrl,
    referralCode: u.referralCode,
    balance,
    createdAt: u.createdAt.toISOString(),
  };
}

export function publicDriverProfile(p) {
  return {
    id: p.id,
    status: p.status,
    smokingAllowed: p.smokingAllowed,
    acAvailable: p.acAvailable,
    musicAllowed: p.musicAllowed,
    petsAllowed: p.petsAllowed,
    bio: p.bio,
    avgRating: p.avgRating ? Number(p.avgRating) : null,
    totalRatings: p.totalRatings,
  };
}

export async function getMe(userId) {
  const user = await repo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found", "USER_NOT_FOUND");
  return await publicUser(user);
}

export async function updateMe(userId, data) {
  const updated = await repo.updateUser(userId, data);
  return await publicUser(updated);
}

export async function getDriverProfile(userId) {
  const profile = await repo.findDriverProfileByUserId(userId);
  if (!profile) throw new NotFoundError("Driver profile not found", "DRIVER_PROFILE_MISSING");
  return publicDriverProfile(profile);
}

export async function updateDriverProfile(userId, data) {
  const updated = await repo.updateDriverProfile(userId, data);
  return publicDriverProfile(updated);
}

export async function updateAvatar(userId, file) {
  if (!file) throw new BadRequestError("Avatar fayl talab qilinadi", "AVATAR_REQUIRED");
  const user = await repo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found", "USER_NOT_FOUND");

  const uploaded = await r2.uploadBuffer({
    buffer: file.buffer,
    contentType: file.mimetype,
    prefix: "avatars",
    originalName: file.originalname,
  });
  const oldAvatar = user.avatarUrl;
  const updated = await repo.updateUser(userId, { avatarUrl: uploaded.url });

  if (oldAvatar) await r2.deleteByUrl(oldAvatar);
  return await publicUser(updated);
}

/**
 * Hisobni o'chirish uchun SMS OTP yuborish (1-qadam).
 * Foydalanuvchi keyin DELETE /api/me { otpCode } chaqirish kerak (2-qadam).
 */
export async function requestDeletionOtp(userId) {
  const user = await repo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found", "USER_NOT_FOUND");
  if (user.role === "ADMIN") {
    throw new ForbiddenError(
      "Admin hisobini bu yo'l bilan o'chirib bo'lmaydi",
      "ADMIN_DELETE_FORBIDDEN"
    );
  }
  const result = await otpService.issueDeletionOtp(user.phone);
  return {
    message: "Tasdiqlash kodi SMS orqali yuborildi",
    phone: user.phone,
    ...result,
  };
}

/**
 * Soft-delete account: anonymize PII, clear avatar, cancel active orders,
 * terminate all sessions. Driver wallets are kept (financial trail).
 * Per Google Play 2024 talab — foydalanuvchi ilova ichidan hisobini o'chira oladi.
 * OTP tasdiqlash MAJBURIY — phone'ga yuborilgan kod bilan tasdiqlanadi.
 */
export async function deleteMyAccount(userId, { otpCode, reason }) {
  const user = await repo.findUserById(userId);
  if (!user) throw new NotFoundError("User not found", "USER_NOT_FOUND");
  if (user.role === "ADMIN") {
    throw new ForbiddenError("Admin hisobini bu yo'l bilan o'chirib bo'lmaydi", "ADMIN_DELETE_FORBIDDEN");
  }

  await otpService.verifyDeletionOtp(user.phone, otpCode);

  await prisma.$transaction(async (tx) => {
    await repo.cancelUserActiveOrders(userId, "Foydalanuvchi hisobini o'chirdi", tx);
    await repo.deleteAllUserSessions(userId, tx);
    await tx.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        phone: `deleted_${userId}@rideshare.local`,
        firstName: "O'chirilgan",
        lastName: "Foydalanuvchi",
        avatarUrl: null,
      },
    });
  });

  if (user.avatarUrl) await r2.deleteByUrl(user.avatarUrl);

  return {
    message: "Hisobingiz o'chirildi. Barcha aktiv sessiyalar tugatildi.",
    deletedAt: new Date().toISOString(),
  };
}
