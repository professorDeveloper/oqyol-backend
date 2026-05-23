import { verifyAccessToken } from "../modules/auth/token.service.js";
import { findUserById } from "../modules/auth/auth.repository.js";
import { UnauthorizedError, ForbiddenError } from "../shared/errors.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Access token required", "TOKEN_MISSING");
  }

  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    throw new UnauthorizedError("Invalid or expired access token", "TOKEN_INVALID");
  }

  const user = await findUserById(payload.sub);
  if (!user) throw new UnauthorizedError("User not found", "USER_NOT_FOUND");
  if (!user.isActive) throw new ForbiddenError("Account deactivated", "ACCOUNT_DEACTIVATED");

  req.user = {
    id: user.id,
    phone: user.phone,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  };
  req.sessionId = payload.sessionId;
  next();
});

export function requireRole(...roles) {
  const allowed = new Set(roles);
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required", "TOKEN_MISSING"));
    }
    if (!allowed.has(req.user.role)) {
      return next(new ForbiddenError("Insufficient role", "FORBIDDEN_ROLE"));
    }
    next();
  };
}
