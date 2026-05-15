import { ForbiddenError } from "../shared/errors.js";

export function requireRoles(...allowed) {
  return (req, _res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return next(new ForbiddenError("Forbidden", "ROLE_FORBIDDEN"));
    }
    next();
  };
}
