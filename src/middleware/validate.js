import { BadRequestError } from "../shared/errors.js";

function formatIssue(issue) {
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export function validate(schema, source = "body") {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues.map(formatIssue).join("; ");
      return next(new BadRequestError(message, "VALIDATION_ERROR"));
    }
    if (source === "query") {
      // Express 5 makes req.query a getter-only property — bypass it.
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
      });
    } else {
      req[source] = result.data;
    }
    next();
  };
}
