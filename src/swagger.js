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
  verifyOtpExistingUserResponseSchema,
  verifyOtpRegistrationRequiredResponseSchema,
  completeRegisterResponseSchema,
  refreshResponseSchema,
  messageResponseSchema,
  sessionListResponseSchema,
  errorResponseSchema,
  userPublicSchema,
  sessionSchema,
} from "./modules/auth/auth.schemas.js";
import {
  vehicleIdParamSchema,
  vehicleSchema,
  vehicleResponseSchema,
  vehicleNullableResponseSchema,
  vehicleDeleteResponseSchema,
} from "./modules/vehicles/vehicle.schemas.js";

const AUDIENCES = ["driver", "passenger", "admin"];
const cache = {};

const FLOW_DESCRIPTION_PASSENGER = `
## Passenger app authentication

\`\`\`
1. POST /auth/send-otp        { phone }                          → 6-digit SMS
2. POST /auth/verify-otp      { phone, code, deviceId,
                                deviceName, appType: "PASSENGER" }
     existing user → 200 AUTHENTICATED
     new user      → 202 REGISTRATION_REQUIRED { registerToken }
     driver phone  → 403 WRONG_APP
3. POST /auth/complete-register (new users only)
     { registerToken, firstName, lastName, referralCode? }
     → 201 AUTHENTICATED, role=USER
\`\`\`

### OTP security
- Per-phone cooldown (60s) and hourly cap (3/hour) — skipped in demo mode.
- Per-IP rate limit on \`send-otp\` (1/min) and \`verify-otp\` (5/5min).
- After 5 wrong codes the OTP is invalidated; request a fresh one.
`;

const FLOW_DESCRIPTION_DRIVER = `
## Driver app authentication

\`\`\`
1. POST /auth/send-otp        { phone }                          → 6-digit SMS
2. POST /auth/verify-otp      { phone, code, deviceId,
                                deviceName, appType: "DRIVER" }
     existing user   → 200 AUTHENTICATED
     new user        → 202 REGISTRATION_REQUIRED { registerToken }
     passenger phone → 403 WRONG_APP
3. POST /auth/complete-register (new users only)
     { registerToken, firstName, lastName, referralCode? }
     → 201 AUTHENTICATED, role=DRIVER, DriverProfile auto-created
\`\`\`

### Driver onboarding
Anyone signing up in the driver app instantly gets \`role=DRIVER\` and a
default \`DriverProfile\`; they can manage their vehicle right away. Admin
approval is not required (will be added later).

### OTP security
- Per-phone cooldown (60s) and hourly cap (3/hour) — skipped in demo mode.
- Per-IP rate limit on \`send-otp\` (1/min) and \`verify-otp\` (5/5min).
- After 5 wrong codes the OTP is invalidated; request a fresh one.
`;

const FLOW_DESCRIPTION_ADMIN = `
## Admin web panel API

These endpoints all require \`role=ADMIN\`. Admins do not use the OTP flow
of the mobile apps — they have their own login (out of scope here) and
authenticate the same way as any other bearer-token holder.

Use this section to:
- Moderate users and drivers (status, suspension, role).
- CRUD regions and routes (with base prices).
- Force-cancel orders that get stuck.
- Manually adjust driver wallets (bonus/refund/correction).
`;

function json(schema) {
  return { content: { "application/json": { schema } } };
}

function errorResponse(description) {
  return { description, content: { "application/json": { schema: errorResponseSchema } } };
}

function buildDoc(audience) {
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
  if (audience === "driver") registry.register("Vehicle", vehicleSchema);

  const addPath = (audiences, spec) => {
    if (!audiences.includes(audience)) return;
    registry.registerPath(spec);
  };

  // ─── Auth ──────────────────────────────────────────────────────────────────
  // Passenger and driver apps both use the OTP flow. Admins authenticate via
  // a separate web-panel login (not documented here) but share refresh/logout
  // and session management.
  addPath(["passenger", "driver"], {
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

  addPath(["passenger", "driver"], {
    method: "post",
    path: "/api/auth/verify-otp",
    tags: ["auth"],
    summary: "Step 2 — Verify OTP",
    description: [
      "Verifies the OTP and decides the login outcome based on `appType`.",
      "",
      "**Possible statuses:**",
      "- `AUTHENTICATED` (200) — existing user, registeredApp matches.",
      "- `REGISTRATION_REQUIRED` (202) — phone is new; call `complete-register` with the returned `registerToken`.",
      "",
      "**Brute-force protection:** after 5 wrong codes the OTP is invalidated and a fresh `send-otp` is required.",
    ].join("\n"),
    request: { body: json(verifyOtpSchema) },
    responses: {
      200: { description: "Authenticated", ...json(verifyOtpExistingUserResponseSchema) },
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

  const completeRegisterOpenApi = {
    type: "object",
    required: ["registerToken", "firstName", "lastName"],
    properties: {
      registerToken: { type: "string" },
      firstName: { type: "string", example: "Sherzod" },
      lastName: { type: "string", example: "Yusupov" },
      referralCode: { type: "string", example: "SHZ4Q2" },
    },
  };

  addPath(["passenger", "driver"], {
    method: "post",
    path: "/api/auth/complete-register",
    tags: ["auth"],
    summary: "Step 3 — Complete registration (new users only)",
    description: [
      "Consumes the `registerToken` from `verify-otp` and creates the user. The `appType` is embedded in the register token so the client cannot change it between steps.",
      "",
      "Send as `multipart/form-data`. `avatar` is optional (jpeg/png/webp, max 5MB) and uploaded to R2.",
      "",
      audience === "driver"
        ? "- Driver app → user created with role=DRIVER and a default DriverProfile (no admin approval, for now)."
        : "- Passenger app → user created with role=USER.",
    ].join("\n"),
    request: {
      body: {
        content: {
          "multipart/form-data": {
            schema: {
              ...completeRegisterOpenApi,
              properties: {
                ...completeRegisterOpenApi.properties,
                avatar: { type: "string", format: "binary" },
              },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Created — authenticated", ...json(completeRegisterResponseSchema) },
      400: errorResponse("Already registered or invalid referral code"),
      401: errorResponse("Invalid or expired register token"),
    },
  });

  addPath(["passenger", "driver", "admin"], {
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

  addPath(["passenger", "driver", "admin"], {
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

  addPath(["passenger", "driver", "admin"], {
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

  addPath(["passenger", "driver", "admin"], {
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

  // ─── Driver vehicles ───────────────────────────────────────────────────────
  const multipart = (bodySchema) => ({
    content: {
      "multipart/form-data": {
        schema: {
          ...bodySchema,
          properties: {
            ...(bodySchema.properties || {}),
            photo: { type: "string", format: "binary" },
          },
        },
      },
    },
  });

  const vehicleCreateOpenApi = {
    type: "object",
    required: ["brand", "model", "color", "plateNumber", "year", "seatCount"],
    properties: {
      brand: { type: "string", example: "Chevrolet" },
      model: { type: "string", example: "Cobalt" },
      color: { type: "string", example: "White" },
      plateNumber: { type: "string", example: "01A123BC" },
      year: { type: "integer", example: 2022 },
      seatCount: { type: "integer", example: 4 },
    },
  };

  const vehicleUpdateOpenApi = {
    type: "object",
    properties: vehicleCreateOpenApi.properties,
  };

  addPath(["driver"], {
    method: "get",
    path: "/api/driver/vehicles",
    tags: ["vehicles"],
    summary: "Get my vehicle",
    description: "Returns the authenticated driver's vehicle, or `null` if none registered yet.",
    security: [{ bearer: [] }],
    responses: {
      200: { description: "Vehicle or null", ...json(vehicleNullableResponseSchema) },
      401: errorResponse("Missing or invalid access token"),
      403: errorResponse("Not a DRIVER, or driver profile missing"),
    },
  });

  addPath(["driver"], {
    method: "post",
    path: "/api/driver/vehicles",
    tags: ["vehicles"],
    summary: "Register my vehicle",
    description: [
      "Creates the driver's single vehicle. One driver may have only one vehicle — call DELETE first to replace it.",
      "",
      "`photo` is optional, multipart upload to R2 (jpeg/png/webp, max 5MB).",
      "Plate must match Uzbekistan format (e.g. `01A123BC`) and be unique globally.",
    ].join("\n"),
    security: [{ bearer: [] }],
    request: { body: multipart(vehicleCreateOpenApi) },
    responses: {
      201: { description: "Vehicle created", ...json(vehicleResponseSchema) },
      400: errorResponse("Invalid input or bad file"),
      401: errorResponse("Missing or invalid access token"),
      403: errorResponse("Not a DRIVER"),
      409: errorResponse("Vehicle already exists or plate taken"),
    },
  });

  addPath(["driver"], {
    method: "patch",
    path: "/api/driver/vehicles/{id}",
    tags: ["vehicles"],
    summary: "Update my vehicle",
    description: "Partial update. Send any subset of fields. Optional `photo` replaces the previous image.",
    security: [{ bearer: [] }],
    request: { params: vehicleIdParamSchema, body: multipart(vehicleUpdateOpenApi) },
    responses: {
      200: { description: "Vehicle updated", ...json(vehicleResponseSchema) },
      400: errorResponse("Invalid input or empty patch"),
      401: errorResponse("Missing or invalid access token"),
      403: errorResponse("Not your vehicle"),
      404: errorResponse("Vehicle not found"),
      409: errorResponse("Plate taken"),
    },
  });

  addPath(["driver"], {
    method: "delete",
    path: "/api/driver/vehicles/{id}",
    tags: ["vehicles"],
    summary: "Delete my vehicle",
    description: "Permanently removes the vehicle and its R2 photo.",
    security: [{ bearer: [] }],
    request: { params: vehicleIdParamSchema },
    responses: {
      200: { description: "Deleted", ...json(vehicleDeleteResponseSchema) },
      401: errorResponse("Missing or invalid access token"),
      403: errorResponse("Not your vehicle"),
      404: errorResponse("Vehicle not found"),
    },
  });

  // ─── Compact endpoint registry for the rest of the modules ─────────────────
  const envelopeSchema = z.object({ success: z.literal(true), data: z.any() });

  const okResponse = (example) => {
    const content = { schema: envelopeSchema };
    if (example !== undefined) content.example = { success: true, data: example };
    return { description: "OK", content: { "application/json": content } };
  };

  const define = ({ audiences, method, path, tags, summary, desc, body, auth = true, role = null, driverExample }) => {
    const example = audience === "driver" ? driverExample : undefined;
    addPath(audiences, {
      method,
      path,
      tags,
      summary: role ? `[${role}] ${summary}` : summary,
      description: desc,
      ...(auth ? { security: [{ bearer: [] }] } : {}),
      ...(body ? { request: { body: json(body) } } : {}),
      responses: {
        200: okResponse(example),
        400: errorResponse("Validation or business-rule error"),
        ...(auth ? { 401: errorResponse("Missing or invalid access token") } : {}),
        ...(role ? { 403: errorResponse(`Requires role ${role}`) } : {}),
        404: errorResponse("Not found"),
      },
    });
  };

  // ─── Reusable example payloads (driver docs) ───────────────────────────────
  const exMe = {
    id: "9f3b1c20-2c0e-4c47-9f9d-1f1a1f1a1f1a",
    phone: "+998901234567",
    firstName: "Sherzod",
    lastName: "Yusupov",
    role: "DRIVER",
    registeredApp: "DRIVER",
    avatarUrl: "https://cdn.example.com/u/9f3b1c20.jpg",
    referralCode: "SHZ4Q2",
    balance: 42500,
    createdAt: "2026-05-01T08:12:33.000Z",
  };
  const exDriverProfile = {
    id: "d1c2e3f4-5678-4abc-9def-123456789abc",
    status: "ACTIVE",
    smokingAllowed: false,
    acAvailable: true,
    musicAllowed: true,
    petsAllowed: false,
    bio: "Toza mashina, har kuni Toshkent–Samarqand qatnov.",
    avgRating: 4.87,
    totalRatings: 142,
  };
  const exRegion = {
    id: "r0000000-0000-4000-8000-000000000001",
    name: "Toshkent",
    code: "TAS",
    isActive: true,
  };
  const exRoute = {
    id: "rt000000-0000-4000-8000-000000000002",
    fromRegion: { id: exRegion.id, name: "Toshkent", code: "TAS" },
    toRegion: { id: "r0000000-0000-4000-8000-000000000003", name: "Samarqand", code: "SAM" },
    distanceKm: 308,
    estimatedDurationMin: 240,
    basePrice: 120000,
    isActive: true,
  };
  const exOrderOpen = {
    id: "ord00000-0000-4000-8000-000000000010",
    status: "OPEN",
    rideType: "SHARED",
    seatsRequested: 1,
    passengerPrice: 120000,
    finalPrice: null,
    route: {
      id: exRoute.id,
      distanceKm: 308,
      estimatedDurationMin: 240,
      basePrice: 120000,
      fromRegion: exRoute.fromRegion,
      toRegion: exRoute.toRegion,
    },
    passenger: { id: "u0000000-0000-4000-8000-000000000020", firstName: "Aziza", lastName: "K.", phone: null },
    driver: null,
    otpCode: null,
    scheduledAt: "2026-05-22T05:30:00.000Z",
    acceptedAt: null,
    arrivedAt: null,
    foundAt: null,
    cancelledAt: null,
    cancellationReason: null,
    expiresAt: "2026-05-21T19:00:00.000Z",
    createdAt: "2026-05-21T17:45:00.000Z",
  };
  const exOrderAccepted = {
    ...exOrderOpen,
    status: "ACCEPTED",
    finalPrice: 130000,
    passenger: { ...exOrderOpen.passenger, phone: "+998935554433" },
    driver: { id: exMe.id, firstName: exMe.firstName, lastName: exMe.lastName, phone: exMe.phone },
    acceptedAt: "2026-05-21T17:50:00.000Z",
  };
  const exOrderArrived = { ...exOrderAccepted, status: "ARRIVED", arrivedAt: "2026-05-21T18:25:00.000Z" };
  const exOrderFound = { ...exOrderArrived, status: "FOUND", foundAt: "2026-05-21T18:27:00.000Z" };
  const exOrderCancelled = {
    ...exOrderAccepted,
    status: "CANCELLED",
    cancelledAt: "2026-05-21T17:55:00.000Z",
    cancellationReason: "Driver cancelled",
  };
  const exOffer = {
    id: "off00000-0000-4000-8000-000000000030",
    orderId: exOrderOpen.id,
    driverId: exMe.id,
    offeredPrice: 130000,
    status: "PENDING",
    message: "5 daqiqada yetib boraman",
    expiresAt: "2026-05-21T18:00:00.000Z",
    respondedAt: null,
    createdAt: "2026-05-21T17:46:00.000Z",
  };
  const exOfferCancelled = { ...exOffer, status: "CANCELLED", respondedAt: "2026-05-21T17:48:00.000Z" };
  const exRating = {
    id: "rt000000-0000-4000-8000-000000000040",
    orderId: exOrderFound.id,
    fromUserId: exMe.id,
    toUserId: exOrderFound.passenger.id,
    score: 5,
    comment: "Hurmatli yo'lovchi, rahmat",
    createdAt: "2026-05-21T19:05:00.000Z",
  };
  const exPage = (items) => ({
    items,
    page: 1,
    limit: 20,
    total: items.length,
    totalPages: 1,
  });

  // Profile — common
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/me", tags: ["profile"], summary: "Get my profile", driverExample: exMe });
  define({ audiences: ["passenger", "driver"], method: "patch", path: "/api/me", tags: ["profile"], summary: "Update my profile (firstName/lastName/avatarUrl)", driverExample: { ...exMe, firstName: "Sherzodbek" } });
  define({ audiences: ["passenger", "driver"], method: "post", path: "/api/me/deletion/request", tags: ["profile"], summary: "Step 1 — Request OTP to delete account. SMS sent to phone." });
  define({ audiences: ["passenger", "driver"], method: "delete", path: "/api/me", tags: ["profile"], summary: "Step 2 — Confirm deletion with OTP. Soft delete + anonymize + cancel active orders + terminate sessions (Play 2024 requirement)" });
  addPath(["passenger", "driver"], {
    method: "post",
    path: "/api/me/avatar",
    tags: ["profile"],
    summary: "Update profile avatar (multipart)",
    security: [{ bearer: [] }],
    request: {
      body: {
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["avatar"],
              properties: { avatar: { type: "string", format: "binary" } },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Updated", ...json(z.object({ success: z.literal(true), data: z.any() })) },
      400: errorResponse("Invalid file or missing"),
      401: errorResponse("Missing or invalid access token"),
    },
  });

  // Notifications
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/notifications", tags: ["notifications"], summary: "List my notifications (paginated, unreadTotal included)" });
  define({ audiences: ["passenger", "driver"], method: "patch", path: "/api/notifications/{id}/read", tags: ["notifications"], summary: "Mark notification as read" });
  define({ audiences: ["passenger", "driver"], method: "patch", path: "/api/notifications/read-all", tags: ["notifications"], summary: "Mark all my notifications as read" });

  // Disputes
  define({ audiences: ["passenger", "driver"], method: "post", path: "/api/disputes", tags: ["disputes"], summary: "Open a dispute for an order" });
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/disputes", tags: ["disputes"], summary: "List my disputes (paginated, filter by status)" });
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/disputes/{id}", tags: ["disputes"], summary: "Dispute detail" });
  // Profile — driver-only
  define({ audiences: ["driver"], method: "get", path: "/api/driver/profile", tags: ["profile"], summary: "Get driver profile", role: "DRIVER", driverExample: exDriverProfile });
  define({ audiences: ["driver"], method: "patch", path: "/api/driver/profile", tags: ["profile"], summary: "Update driver preferences (smoking, ac, music, pets, bio)", role: "DRIVER", driverExample: { ...exDriverProfile, smokingAllowed: true } });

  // Wallet — admin only (drivers cannot top up or read their wallet through the API).
  define({ audiences: ["admin"], method: "post", path: "/api/admin/wallets/{id}/adjust", tags: ["admin-wallet"], summary: "Admin manual wallet adjustment (bonus/refund)", role: "ADMIN" });

  // Regions
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/regions", tags: ["regions"], summary: "List active regions (public)", auth: false, driverExample: [exRegion, { ...exRegion, id: "r0000000-0000-4000-8000-000000000003", name: "Samarqand", code: "SAM" }] });
  // Districts (tumanlar)
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/regions/{id}/districts", tags: ["regions"], summary: "List active districts of a region (public)", auth: false });
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/districts", tags: ["regions"], summary: "List all active districts with their region (public)", auth: false });
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/districts/by-region/{regionId}", tags: ["regions"], summary: "Alias — districts by region (public)", auth: false });
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/districts/{id}", tags: ["regions"], summary: "Get district detail (public)", auth: false });
  define({ audiences: ["admin"], method: "get", path: "/api/admin/regions", tags: ["admin-regions"], summary: "List all regions", role: "ADMIN" });
  define({ audiences: ["admin"], method: "post", path: "/api/admin/regions", tags: ["admin-regions"], summary: "Create region", role: "ADMIN" });
  define({ audiences: ["admin"], method: "patch", path: "/api/admin/regions/{id}", tags: ["admin-regions"], summary: "Update region", role: "ADMIN" });
  define({ audiences: ["admin"], method: "delete", path: "/api/admin/regions/{id}", tags: ["admin-regions"], summary: "Delete region", role: "ADMIN" });

  // Routes
  define({ audiences: ["passenger", "driver"], method: "get", path: "/api/routes", tags: ["routes"], summary: "List active routes (public, filter by from/to region)", auth: false, driverExample: [exRoute] });
  define({ audiences: ["admin"], method: "get", path: "/api/admin/routes", tags: ["admin-routes"], summary: "List all routes", role: "ADMIN" });
  define({ audiences: ["admin"], method: "post", path: "/api/admin/routes", tags: ["admin-routes"], summary: "Create route", role: "ADMIN" });
  define({ audiences: ["admin"], method: "patch", path: "/api/admin/routes/{id}", tags: ["admin-routes"], summary: "Update route", role: "ADMIN" });
  define({ audiences: ["admin"], method: "delete", path: "/api/admin/routes/{id}", tags: ["admin-routes"], summary: "Delete route", role: "ADMIN" });

  // Admin users/drivers
  define({ audiences: ["admin"], method: "get", path: "/api/admin/users", tags: ["admin-users"], summary: "List users (search, filter, paginate)", role: "ADMIN" });
  define({ audiences: ["admin"], method: "get", path: "/api/admin/users/{id}", tags: ["admin-users"], summary: "Get user detail (incl. driverProfile, wallet)", role: "ADMIN" });
  define({ audiences: ["admin"], method: "patch", path: "/api/admin/users/{id}", tags: ["admin-users"], summary: "Update user (role/active/name)", role: "ADMIN" });
  define({ audiences: ["admin"], method: "patch", path: "/api/admin/drivers/{id}", tags: ["admin-users"], summary: "Update driver profile (status, bio, suspendedUntil)", role: "ADMIN" });

  // Orders — passenger
  define({ audiences: ["passenger"], method: "post", path: "/api/orders", tags: ["orders"], summary: "Create order. Uses Route.basePrice as initial price." });
  define({ audiences: ["passenger"], method: "get", path: "/api/orders/mine", tags: ["orders"], summary: "List my orders (filter by status)" });
  define({ audiences: ["passenger"], method: "get", path: "/api/orders/{id}", tags: ["orders"], summary: "Order detail" });
  define({ audiences: ["passenger"], method: "post", path: "/api/orders/{id}/cancel", tags: ["orders"], summary: "Cancel order. Releases driver commission hold if any." });

  // Orders — driver
  define({ audiences: ["driver"], method: "get", path: "/api/driver/orders/open", tags: ["orders"], summary: "List OPEN orders to bid on", role: "DRIVER", driverExample: exPage([exOrderOpen]) });
  define({ audiences: ["driver"], method: "get", path: "/api/driver/orders/{id}", tags: ["orders"], summary: "Order detail (driver view)", role: "DRIVER", driverExample: exOrderAccepted });
  define({ audiences: ["driver"], method: "post", path: "/api/driver/orders/{id}/arrive", tags: ["orders"], summary: "Mark ARRIVED with GPS proof (lat/lng). Validated against pickup radius.", role: "DRIVER", driverExample: exOrderArrived });
  define({ audiences: ["driver"], method: "post", path: "/api/driver/orders/{id}/found", tags: ["orders"], summary: "Confirm passenger boarded with their OTP. Captures commission.", role: "DRIVER", driverExample: exOrderFound });
  define({ audiences: ["driver"], method: "post", path: "/api/driver/orders/{id}/cancel", tags: ["orders"], summary: "Driver cancels accepted order", role: "DRIVER", driverExample: exOrderCancelled });

  // Orders — admin
  define({ audiences: ["admin"], method: "post", path: "/api/admin/orders/{id}/force-cancel", tags: ["admin-orders"], summary: "Force-cancel an order (releases commission)", role: "ADMIN" });

  // Offers — driver
  define({ audiences: ["driver"], method: "post", path: "/api/driver/offers", tags: ["offers"], summary: "Submit offer with custom price on an OPEN order", role: "DRIVER", driverExample: exOffer });
  define({ audiences: ["driver"], method: "get", path: "/api/driver/offers/mine", tags: ["offers"], summary: "List my offers (filter by status)", role: "DRIVER", driverExample: exPage([exOffer]) });
  define({ audiences: ["driver"], method: "post", path: "/api/driver/offers/{id}/cancel", tags: ["offers"], summary: "Cancel my pending offer", role: "DRIVER", driverExample: exOfferCancelled });

  // Offers — passenger
  define({ audiences: ["passenger"], method: "get", path: "/api/orders/{orderId}/offers", tags: ["offers"], summary: "List offers received on my order" });
  define({ audiences: ["passenger"], method: "post", path: "/api/offers/{id}/accept", tags: ["offers"], summary: "Accept offer → order ACCEPTED, others auto-rejected, commission held" });
  define({ audiences: ["passenger"], method: "post", path: "/api/offers/{id}/reject", tags: ["offers"], summary: "Reject offer" });

  // Ratings — both sides rate after FOUND
  define({ audiences: ["passenger", "driver"], method: "post", path: "/api/orders/{id}/ratings", tags: ["ratings"], summary: "Rate counterparty after order FOUND (score 1-5). Updates driver avgRating.", driverExample: exRating });

  const info = {
    driver: {
      title: "Rideshare API — Driver",
      description: FLOW_DESCRIPTION_DRIVER,
    },
    passenger: {
      title: "Rideshare API — Passenger",
      description: FLOW_DESCRIPTION_PASSENGER,
    },
    admin: {
      title: "Rideshare API — Admin",
      description: FLOW_DESCRIPTION_ADMIN,
    },
  }[audience];

  const tagsByAudience = {
    driver: [
      { name: "auth", description: "Phone OTP authentication" },
      { name: "profile", description: "My profile + driver preferences + avatar + account deletion" },
      { name: "vehicles", description: "Driver vehicle (1 per driver)" },
      { name: "regions", description: "Public region/district list" },
      { name: "routes", description: "Public route list (with base price)" },
      { name: "orders", description: "Bid, accept, arrive, complete rides" },
      { name: "offers", description: "Driver bids on passenger orders" },
      { name: "ratings", description: "Post-ride mutual rating" },
      { name: "notifications", description: "Inbox: list, mark read" },
      { name: "disputes", description: "Open and track disputes on orders" },
    ],
    passenger: [
      { name: "auth", description: "Phone OTP authentication" },
      { name: "profile", description: "My profile + avatar + account deletion" },
      { name: "regions", description: "Public region/district list" },
      { name: "routes", description: "Public route list (with base price)" },
      { name: "orders", description: "Create and manage my orders" },
      { name: "offers", description: "Offers I receive from drivers" },
      { name: "ratings", description: "Post-ride mutual rating" },
      { name: "notifications", description: "Inbox: list, mark read" },
      { name: "disputes", description: "Open and track disputes on orders" },
    ],
    admin: [
      { name: "auth", description: "Shared session/refresh/logout endpoints" },
      { name: "admin-users", description: "User and driver moderation" },
      { name: "admin-regions", description: "Region CRUD" },
      { name: "admin-routes", description: "Route CRUD (with base price)" },
      { name: "admin-orders", description: "Force-cancel stuck orders" },
      { name: "admin-wallet", description: "Manual driver wallet adjustments" },
    ],
  }[audience];

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: { title: info.title, version: "1.0.0", description: info.description },
    servers: [{ url: "http://localhost:3000" }],
    tags: tagsByAudience,
  });
}

export function getSwaggerDoc(audience = "driver") {
  if (!AUDIENCES.includes(audience)) {
    throw new Error(`Unknown swagger audience: ${audience}`);
  }
  if (cache[audience]) return cache[audience];
  cache[audience] = buildDoc(audience);
  return cache[audience];
}
