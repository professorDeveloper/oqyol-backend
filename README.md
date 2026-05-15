# Rideshare Matching API

Intercity passenger-driver matching marketplace backend.
Express + Prisma + PostgreSQL + Redis. Pure ESM JavaScript (Node 20+).

## Project structure

```
src/
  server.js              Process bootstrap (DB/Redis connect, graceful shutdown)
  app.js                 Express app factory (middleware + routers)
  swagger.js             OpenAPI document generator
  config/
    env.js               Environment variables — validated with Zod
  clients/               External system clients (DB, cache, SMS)
    prisma.js
    redis.js
    sms.js               Eskiz SMS provider
  shared/                Generic helpers (no domain logic)
    errors.js            AppError + BadRequest/Unauthorized/.../TooManyRequests
    response.js          ok(res, data) / fail(res, ...) helpers
    asyncHandler.js      Wraps async route handlers
    logger.js            Structured logger
  middleware/            HTTP-layer cross-cutting middleware
    auth.js              JWT verify + req.user
    roles.js             Role guard
    validate.js          Zod schema validation
    error.js             Global error handler + 404
    rateLimit.js         Rate limiters
  modules/               Feature modules
    auth/
      auth.routes.js     Endpoint declarations
      auth.controller.js HTTP I/O (req → service → response)
      auth.service.js    Business logic (orchestration)
      auth.repository.js DB queries (Prisma)
      auth.schemas.js    Zod validation schemas
      otp.service.js     OTP issue/verify (Redis + SMS)
      token.service.js   JWT sign/verify (access, refresh, register)
```

Each module follows SOLID separation of concerns:
- **routes** — URL + middleware wiring
- **controller** — HTTP I/O only, no business logic
- **service** — business rules, orchestrates other services
- **repository** — DB queries only
- Side services (otp, token) — each has a single responsibility (SRP)

## Auth flow

Phone-only authentication. No separate login/register screen — just one phone field.

```
1. POST /api/auth/send-otp           { phone }
   → OTP delivered via SMS (in demo mode: 123456)

2. POST /api/auth/verify-otp         { phone, code, deviceId, deviceName }
   - Existing user:
     → 200 { status: "AUTHENTICATED", accessToken, refreshToken, user }
   - New user:
     → 202 { status: "REGISTRATION_REQUIRED", registerToken }

3. (new users only)
   POST /api/auth/complete-register  { registerToken, firstName, lastName, referralCode? }
   → 201 { accessToken, refreshToken, user }
```

`registerToken` is a short-lived JWT (10 minutes) used solely for the
registration step. Both existing and new users enter through `verify-otp` —
there are no separate login/register endpoints.

## Other auth endpoints

```
POST   /api/auth/refresh             { refreshToken }
POST   /api/auth/logout              (Bearer)  { sessionId? }
GET    /api/auth/sessions            (Bearer)
DELETE /api/auth/sessions/:id        (Bearer)
```

## Getting started

```bash
# 1. Start PostgreSQL + Redis with Docker
docker compose up -d postgres redis

# 2. Install dependencies
npm install

# 3. Generate Prisma client + run migrations
npm run prisma:generate
npm run prisma:migrate

# 4. Dev server (watch mode)
npm run dev
```

Swagger: http://localhost:3000/api/docs
Health: http://localhost:3000/api/health

## Environment

Key settings in `.env`:

| Variable | Default | Description |
|---|---|---|
| `OTP_DEMO_MODE` | `false` | When `true`, no SMS is sent — the code is logged instead |
| `OTP_DEMO_CODE` | `123456` | Code used in demo mode |
| `OTP_LENGTH` | `6` | Number of digits in OTP |
| `OTP_TTL_SECONDS` | `120` | OTP validity window |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `30d` | Refresh token lifetime |
| `JWT_REGISTER_EXPIRY` | `10m` | Register token (for new users) lifetime |

## Response format

Uniform JSON envelope for every response:

```json
// Success
{ "success": true, "data": ... }

// Error
{ "success": false, "error": "...", "code": "VALIDATION_ERROR", "statusCode": 400 }
```

## Roadmap (upcoming modules)

Only the **auth** module is implemented for now. Remaining modules from the spec:
users, drivers, vehicles, regions, routes, orders, offers, announcements,
wallet, ratings, referrals, disputes, notifications, admin.
