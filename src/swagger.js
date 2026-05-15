import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  sendOtpSchema,
  verifyOtpSchema,
  completeRegisterSchema,
  refreshSchema,
  logoutSchema,
  sessionIdParamSchema,
  sendOtpResponseSchema,
  verifyOtpAuthenticatedResponseSchema,
  verifyOtpDriverPendingResponseSchema,
  verifyOtpRegistrationRequiredResponseSchema,
  completeRegisterAuthenticatedResponseSchema,
  completeRegisterDriverPendingResponseSchema,
  refreshResponseSchema,
  messageResponseSchema,
  sessionListResponseSchema,
  errorResponseSchema,
  userPublicSchema,
  sessionSchema,
} from "./modules/auth/auth.schemas.js";

let cachedDoc = null;

const FLOW_DESCRIPTION = `
## Authentication flow (phone-only, two-app aware)

There are no login/register screens. The same OTP flow serves both apps:

\`\`\`
┌────────────────────────────────────────────────────────────────────────┐
│  PASSENGER app                       DRIVER app                        │
│  ───────────────                     ─────────────                     │
│  appType: "PASSENGER"                appType: "DRIVER"                 │
│                                                                        │
│  1. POST /auth/send-otp              same                              │
│       { phone }                                                        │
│       → 6-digit SMS                                                    │
│                                                                        │
│  2. POST /auth/verify-otp                                              │
│       { phone, code, deviceId,                                         │
│         deviceName, appType }                                          │
│                                                                        │
│       New user      → 202 REGISTRATION_REQUIRED { registerToken }      │
│       Existing user → 200 AUTHENTICATED  (matching app)                │
│       Driver app +  → 200 DRIVER_APPROVAL_PENDING (limited tokens)     │
│         unapproved                                                     │
│       Wrong app     → 403 WRONG_APP                                    │
│                                                                        │
│  3. POST /auth/complete-register   (new users only)                    │
│       { registerToken, firstName, lastName, referralCode? }            │
│       → 201 AUTHENTICATED          (passenger)                         │
│       → 201 DRIVER_APPROVAL_PENDING (driver — must contact admin)      │
└────────────────────────────────────────────────────────────────────────┘
\`\`\`

### Cross-app rules

- One phone belongs to one app (registeredApp is set at sign-up).
- Passenger phone in driver app → 403 WRONG_APP.
- Driver phone in passenger app → 403 WRONG_APP.
- Admin role → 403 WRONG_APP everywhere (admins use the web panel).

### Driver approval

After a driver registers in the driver app the user is created with role=USER
and registeredApp=DRIVER. Tokens are returned, but role-based guards block
all DRIVER-only endpoints. The driver app should display admin contact info
(handled in UI) until the admin approves them in the web panel — at which
point role becomes DRIVER and subsequent logins return AUTHENTICATED.

### OTP security

- Per-phone cooldown between sends (default 60s).
- Per-phone hourly cap (default 3/hour).
- Per-IP rate limit on \`send-otp\` (1/min) and \`verify-otp\` (5/5min).
- Brute-force protection: after 5 wrong codes the OTP is invalidated and a
  new \`send-otp\` is required.
`;

function json(schema) {
  return { content: { "application/json": { schema } } };
}

function errorResponse(description) {
  return { description, content: { "application/json": { schema: errorResponseSchema } } };
}

export function getSwaggerDoc() {
  if (cachedDoc) return cachedDoc;

  extendZodWithOpenApi(z);
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "bearer", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  registry.register("User", userPublicSchema);
  registry.register("Session", sessionSchema);
  registry.register("ErrorResponse", errorResponseSchema);

  registry.registerPath({
    method: "post",
    path: "/api/auth/send-otp",
    tags: ["auth"],
    summary: "Step 1 — Send OTP",
    description:
      "Issues a numeric OTP and delivers it via SMS. Rate-limited: 1/min per IP, 60s cooldown per phone, 3/hour per phone.",
    request: { body: json(sendOtpSchema) },
    responses: {
      200: { description: "OTP sent", ...json(sendOtpResponseSchema) },
      400: errorResponse("Invalid phone format"),
      429: errorResponse("Rate limited (cooldown, hourly limit, or IP limit)"),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/auth/verify-otp",
    tags: ["auth"],
    summary: "Step 2 — Verify OTP",
    description: [
      "Verifies the OTP and decides the login outcome based on `appType`.",
      "",
      "**Possible statuses:**",
      "- `AUTHENTICATED` (200) — existing user, registeredApp matches, role grants access.",
      "- `DRIVER_APPROVAL_PENDING` (200) — driver app, user exists but role is still USER (waiting for admin approval).",
      "- `REGISTRATION_REQUIRED` (202) — phone is new; call `complete-register` with the returned `registerToken`.",
      "",
      "**Brute-force protection:** after 5 wrong codes the OTP is invalidated and a fresh `send-otp` is required.",
    ].join("\n"),
    request: { body: json(verifyOtpSchema) },
    responses: {
      200: {
        description: "Authenticated or driver awaiting approval",
        content: {
          "application/json": {
            schema: {
              oneOf: [
                verifyOtpAuthenticatedResponseSchema,
                verifyOtpDriverPendingResponseSchema,
              ],
            },
          },
        },
      },
      202: {
        description: "New user — registration required, use returned registerToken",
        ...json(verifyOtpRegistrationRequiredResponseSchema),
      },
      400: errorResponse("Invalid input"),
      401: errorResponse("Invalid OTP / locked out"),
      403: errorResponse("WRONG_APP — phone registered for the other app, or account deactivated"),
      429: errorResponse("Rate limited"),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/auth/complete-register",
    tags: ["auth"],
    summary: "Step 3 — Complete registration (new users only)",
    description: [
      "Consumes the `registerToken` from `verify-otp` and creates the user. The `appType` is embedded in the register token so the client cannot change it between steps.",
      "",
      "- Passenger app → status `AUTHENTICATED`, ready to ride.",
      "- Driver app → status `DRIVER_APPROVAL_PENDING`, tokens returned but DRIVER-only endpoints stay locked until admin approval.",
    ].join("\n"),
    request: { body: json(completeRegisterSchema) },
    responses: {
      201: {
        description: "Created — authenticated or pending driver approval",
        content: {
          "application/json": {
            schema: {
              oneOf: [
                completeRegisterAuthenticatedResponseSchema,
                completeRegisterDriverPendingResponseSchema,
              ],
            },
          },
        },
      },
      400: errorResponse("Already registered or invalid referral code"),
      401: errorResponse("Invalid or expired register token"),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/auth/refresh",
    tags: ["auth"],
    summary: "Refresh tokens",
    description:
      "Exchanges a valid refresh token for a new access/refresh pair. The previous refresh token is invalidated (rotation).",
    request: { body: json(refreshSchema) },
    responses: {
      200: { description: "New token pair", ...json(refreshResponseSchema) },
      401: errorResponse("Invalid, expired, or reused refresh token"),
      403: errorResponse("Account deactivated"),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/auth/logout",
    tags: ["auth"],
    summary: "Logout (terminate session)",
    security: [{ bearer: [] }],
    request: { body: json(logoutSchema) },
    responses: {
      200: { description: "Session terminated", ...json(messageResponseSchema) },
      401: errorResponse("Missing or invalid access token"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/auth/sessions",
    tags: ["auth"],
    summary: "List active sessions",
    description: "Returns every active session for the current user.",
    security: [{ bearer: [] }],
    responses: {
      200: { description: "Active sessions", ...json(sessionListResponseSchema) },
      401: errorResponse("Missing or invalid access token"),
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/auth/sessions/{id}",
    tags: ["auth"],
    summary: "Revoke a session",
    description: "Terminates another device's session.",
    security: [{ bearer: [] }],
    request: { params: sessionIdParamSchema },
    responses: {
      200: { description: "Session revoked", ...json(messageResponseSchema) },
      401: errorResponse("Missing or invalid access token"),
      404: errorResponse("Session not found"),
    },
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  cachedDoc = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Rideshare Matching API",
      version: "1.0.0",
      description: FLOW_DESCRIPTION,
    },
    servers: [{ url: "http://localhost:3000" }],
    tags: [{ name: "auth", description: "Phone-only OTP authentication, two-app aware" }],
  });

  return cachedDoc;
}
