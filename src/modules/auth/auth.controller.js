import * as authService from "./auth.service.js";
import { ok } from "../../shared/response.js";

export async function sendOtp(req, res) {
  const result = await authService.requestOtp(req.body.phone);
  ok(res, result);
}

export async function verifyOtp(req, res) {
  const result = await authService.verifyOtp(req.body);
  const statusCode = result.status === "REGISTRATION_REQUIRED" ? 202 : 200;
  ok(res, result, statusCode);
}

export async function completeRegister(req, res) {
  const result = await authService.completeRegister({
    ...req.body,
    avatarFile: req.file,
  });
  ok(res, result, 201);
}



export async function refresh(req, res) {
  const result = await authService.refresh(req.body.refreshToken);
  ok(res, result);
}

export async function logout(req, res) {
  const sessionId = req.body?.sessionId || req.sessionId;
  const result = await authService.logout(req.user.id, sessionId);
  ok(res, result);
}

export async function listSessions(req, res) {
  const sessions = await authService.listSessions(req.user.id);
  ok(res, sessions);
}

export async function revokeSession(req, res) {
  const result = await authService.revokeSession(req.user.id, req.params.id);
  ok(res, result);
}
