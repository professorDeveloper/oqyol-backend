import * as profileService from "./profile.service.js";
import { ok } from "../../shared/response.js";

export async function getMe(req, res) {
  const me = await profileService.getMe(req.user.id);
  ok(res, me);
}

export async function updateMe(req, res) {
  const me = await profileService.updateMe(req.user.id, req.body);
  ok(res, me);
}

export async function updateAvatar(req, res) {
  const me = await profileService.updateAvatar(req.user.id, req.file);
  ok(res, me);
}

export async function requestDeletionOtp(req, res) {
  const result = await profileService.requestDeletionOtp(req.user.id);
  ok(res, result);
}

export async function deleteMe(req, res) {
  const result = await profileService.deleteMyAccount(req.user.id, {
    otpCode: req.body.otpCode,
    reason: req.body.reason ?? null,
  });
  ok(res, result);
}

export async function getDriverProfile(req, res) {
  const profile = await profileService.getDriverProfile(req.user.id);
  ok(res, profile);
}

export async function updateDriverProfile(req, res) {
  const profile = await profileService.updateDriverProfile(req.user.id, req.body);
  ok(res, profile);
}
