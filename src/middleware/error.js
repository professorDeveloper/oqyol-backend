import { AppError } from "../shared/errors.js";
import { fail } from "../shared/response.js";
import { logger } from "../shared/logger.js";

function mapPrismaError(err) {
  if (err.code === "P2002") return { status: 409, message: "Resource already exists", code: "DUPLICATE" };
  if (err.code === "P2025") return { status: 404, message: "Resource not found", code: "NOT_FOUND" };
  return null;
}

export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, "ROUTE_NOT_FOUND"));
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return fail(res, err.statusCode, err.message, err.code);
  }

  const prismaMapped = err.code && typeof err.code === "string" && err.code.startsWith("P") ? mapPrismaError(err) : null;
  if (prismaMapped) {
    return fail(res, prismaMapped.status, prismaMapped.message, prismaMapped.code);
  }

  logger.error("unhandled error", {
    method: req.method,
    path: req.originalUrl,
    message: err.message,
    stack: err.stack,
  });

  return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
}
