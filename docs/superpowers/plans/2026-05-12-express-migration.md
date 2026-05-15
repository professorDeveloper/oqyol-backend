# NestJS → Express.js Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the NestJS backend with a simple Express.js + TypeScript backend that preserves all existing functionality (auth module) and infrastructure (Prisma, Redis, SMS).

**Architecture:** Feature-based modules with plain functions — no DI, no decorators. Each module has routes, service, and Zod schema. Global middleware handles auth, roles, errors, and rate limiting.

**Tech Stack:** Express, TypeScript, Prisma, ioredis, Zod, jsonwebtoken, bcrypt, swagger-ui-express, @asteasolutions/zod-to-openapi, express-rate-limit, tsx (dev), tsc (prod)

---

## File Structure

```
src/
├── index.ts              ← entry point, app.listen()
├── app.ts                ← express app, middleware, routes
├── config/
│   └── env.ts            ← reads .env, exports typed object
├── lib/
│   ├── prisma.ts         ← PrismaClient singleton
│   ├── redis.ts          ← ioredis singleton
│   └── sms.ts            ← Eskiz SMS helper
├── middleware/
│   ├── auth.ts           ← JWT verify middleware
│   ├── roles.ts          ← role check middleware
│   ├── error-handler.ts  ← global error catch
│   ├── rate-limiter.ts   ← express-rate-limit config
│   └── validate.ts       ← Zod validation middleware
├── modules/
│   └── auth/
│       ├── auth.routes.ts
│       ├── auth.service.ts
│       └── auth.schema.ts
├── swagger.ts            ← OpenAPI registry + swagger-ui setup
└── types/
    └── index.ts          ← shared types (Request extension, etc.)
```

**Kept unchanged:**
- `prisma/schema.prisma`
- `prisma.config.ts`
- `docker-compose.yml`
- `.env`
- `.gitignore`

**Deleted:** Everything in current `src/`, `nest-cli.json`, `test/`, `dist/`, `eslint.config.mjs`

---

### Task 1: Clean NestJS and setup new project

**Files:**
- Delete: `src/` (all contents), `nest-cli.json`, `test/`, `dist/`, `eslint.config.mjs`, `tsconfig.build.json`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `src/index.ts`

- [ ] **Step 1: Remove old source and config**

```bash
rm -rf src dist test nest-cli.json eslint.config.mjs tsconfig.build.json .prettierrc
mkdir src
```

- [ ] **Step 2: Replace package.json**

```json
{
  "name": "rideshare-api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@asteasolutions/zod-to-openapi": "^7.3.0",
    "bcrypt": "^6.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.5.0",
    "express": "^5.1.0",
    "express-rate-limit": "^7.5.0",
    "ioredis": "^5.10.1",
    "jsonwebtoken": "^9.0.2",
    "swagger-ui-express": "^5.0.1",
    "zod": "^3.24.0",
    "axios": "^1.16.0",
    "@prisma/client": "^7.8.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/node": "^24.0.0",
    "@types/swagger-ui-express": "^4.1.8",
    "prisma": "^7.8.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.3"
  }
}
```

- [ ] **Step 3: Replace tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create minimal entry point**

Create `src/index.ts`:

```ts
console.log("server starting...")
```

- [ ] **Step 5: Install dependencies**

```bash
rm -rf node_modules package-lock.json
npm install
```

- [ ] **Step 6: Verify it runs**

```bash
npx tsx src/index.ts
```

Expected: prints "server starting..."

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: strip NestJS, setup Express project"
```

---

### Task 2: Config and lib layer

**Files:**
- Create: `src/config/env.ts`
- Create: `src/lib/prisma.ts`
- Create: `src/lib/redis.ts`
- Create: `src/lib/sms.ts`

- [ ] **Step 1: Create src/config/env.ts**

```ts
import "dotenv/config"

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || "30d",
  ESKIZ_EMAIL: process.env.ESKIZ_EMAIL || "",
  ESKIZ_PASSWORD: process.env.ESKIZ_PASSWORD || "",
  ESKIZ_FROM: process.env.ESKIZ_FROM || "4546",
  OTP_DEMO_MODE: process.env.OTP_DEMO_MODE === "true",
  OTP_DEMO_CODE: process.env.OTP_DEMO_CODE || "123456",
  DEFAULT_COMMISSION_RATE: Number(process.env.DEFAULT_COMMISSION_RATE) || 0.1,
  ARRIVAL_RADIUS_METERS: Number(process.env.ARRIVAL_RADIUS_METERS) || 500,
  ORDER_EXPIRY_MINUTES: Number(process.env.ORDER_EXPIRY_MINUTES) || 30,
  OFFER_EXPIRY_MINUTES: Number(process.env.OFFER_EXPIRY_MINUTES) || 10,
  REFERRAL_BONUS_AMOUNT: Number(process.env.REFERRAL_BONUS_AMOUNT) || 10000,
  MAX_CANCELS_PER_DAY: Number(process.env.MAX_CANCELS_PER_DAY) || 5,
  THROTTLE_TTL: Number(process.env.THROTTLE_TTL) || 60,
  THROTTLE_LIMIT: Number(process.env.THROTTLE_LIMIT) || 100,
}
```

- [ ] **Step 2: Create src/lib/prisma.ts**

```ts
import { PrismaClient } from "@prisma/client"

export const prisma = new PrismaClient()
```

- [ ] **Step 3: Create src/lib/redis.ts**

```ts
import Redis from "ioredis"
import { env } from "../config/env.js"

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: 3,
})
```

- [ ] **Step 4: Create src/lib/sms.ts**

```ts
import axios from "axios"
import { env } from "../config/env.js"

let token = ""
let tokenExpiresAt = 0

async function getToken(): Promise<string> {
  const now = Date.now()
  if (token && tokenExpiresAt > now + 5 * 60 * 1000) {
    return token
  }

  const res = await axios.post("https://notify.eskiz.uz/api/auth/login", {
    email: env.ESKIZ_EMAIL,
    password: env.ESKIZ_PASSWORD,
  })

  token = res.data.data.token
  tokenExpiresAt = now + 29 * 24 * 60 * 60 * 1000
  return token
}

export async function sendSms(phone: string, message: string): Promise<void> {
  if (env.OTP_DEMO_MODE) {
    console.log(`[SMS DEMO] ${phone}: ${message}`)
    return
  }

  const authToken = await getToken()
  const normalizedPhone = phone.replace(/^\+/, "")

  try {
    await axios.post(
      "https://notify.eskiz.uz/api/message/sms/send",
      {
        mobile_phone: normalizedPhone,
        message,
        from: env.ESKIZ_FROM,
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    )
  } catch (err: any) {
    if (err.response?.data?.message === "token_invalid") {
      token = ""
      tokenExpiresAt = 0
      return sendSms(phone, message)
    }
    throw err
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add config and lib layer (prisma, redis, sms)"
```

---

### Task 3: Types and validation middleware

**Files:**
- Create: `src/types/index.ts`
- Create: `src/middleware/validate.ts`

- [ ] **Step 1: Create src/types/index.ts**

```ts
import { Request } from "express"
import { UserRole } from "@prisma/client"

export interface AuthUser {
  id: string
  phone: string
  role: UserRole
  isActive: boolean
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

export interface RefreshUser {
  userId: string
  sessionId: string
}

export interface RefreshRequest extends Request {
  user?: RefreshUser
}
```

- [ ] **Step 2: Create src/middleware/validate.ts**

```ts
import { Request, Response, NextFunction } from "express"
import { ZodSchema } from "zod"

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error.errors[0].message,
        statusCode: 400,
      })
      return
    }
    req.body = result.data
    next()
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add types and validation middleware"
```

---

### Task 4: Auth, roles, and error middleware

**Files:**
- Create: `src/middleware/auth.ts`
- Create: `src/middleware/roles.ts`
- Create: `src/middleware/error-handler.ts`
- Create: `src/middleware/rate-limiter.ts`

- [ ] **Step 1: Create src/middleware/auth.ts**

```ts
import { Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { env } from "../config/env.js"
import { AuthRequest, RefreshRequest } from "../types/index.js"

export function authRequired(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Token required", statusCode: 401 })
    return
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as { sub: string; role: string }
    prisma.user.findUnique({ where: { id: payload.sub } }).then((user) => {
      if (!user || !user.isActive) {
        res.status(401).json({ success: false, error: "User not found", statusCode: 401 })
        return
      }
      req.user = { id: user.id, phone: user.phone, role: user.role, isActive: user.isActive }
      next()
    })
  } catch {
    res.status(401).json({ success: false, error: "Invalid token", statusCode: 401 })
  }
}

export function refreshAuth(req: RefreshRequest, res: Response, next: NextFunction) {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(401).json({ success: false, error: "Refresh token required", statusCode: 401 })
    return
  }

  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string; sessionId: string }
    req.user = { userId: payload.sub, sessionId: payload.sessionId }
    next()
  } catch {
    res.status(401).json({ success: false, error: "Invalid refresh token", statusCode: 401 })
  }
}
```

- [ ] **Step 2: Create src/middleware/roles.ts**

```ts
import { Response, NextFunction } from "express"
import { UserRole } from "@prisma/client"
import { AuthRequest } from "../types/index.js"

export function roles(...allowed: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      res.status(403).json({ success: false, error: "Forbidden", statusCode: 403 })
      return
    }
    next()
  }
}
```

- [ ] **Step 3: Create src/middleware/error-handler.ts**

```ts
import { Request, Response, NextFunction } from "express"

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500
  const message = err.message || "Internal server error"

  if (statusCode === 500) {
    console.error(err)
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    statusCode,
  })
}
```

- [ ] **Step 4: Create src/middleware/rate-limiter.ts**

```ts
import rateLimit from "express-rate-limit"
import { env } from "../config/env.js"

export const globalLimiter = rateLimit({
  windowMs: env.THROTTLE_TTL * 1000,
  max: env.THROTTLE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests", statusCode: 429 },
})

export const otpSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  message: { success: false, error: "Wait before requesting another OTP", statusCode: 429 },
})

export const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { success: false, error: "Too many attempts", statusCode: 429 },
})
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add auth, roles, error, rate-limit middleware"
```

---

### Task 5: Auth module

**Files:**
- Create: `src/modules/auth/auth.schema.ts`
- Create: `src/modules/auth/auth.service.ts`
- Create: `src/modules/auth/auth.routes.ts`

- [ ] **Step 1: Create src/modules/auth/auth.schema.ts**

```ts
import { z } from "zod"

export const SendOtpSchema = z.object({
  phone: z.string().min(12).max(13),
})

export const VerifyOtpSchema = z.object({
  phone: z.string().min(12).max(13),
  code: z.string().length(6),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
})

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
})
```

- [ ] **Step 2: Create src/modules/auth/auth.service.ts**

```ts
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { prisma } from "../../lib/prisma.js"
import { redis } from "../../lib/redis.js"
import { sendSms } from "../../lib/sms.js"
import { env } from "../../config/env.js"

function generateOtp(): string {
  const chars = "0123456789"
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function generateTokens(userId: string, role: string, sessionId: string) {
  const accessToken = jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  })
  const refreshToken = jwt.sign({ sub: userId, sessionId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  })
  return { accessToken, refreshToken }
}

export async function sendOtp(phone: string) {
  const rateKey = `otp_rate:${phone}`
  const count = await redis.incr(rateKey)
  if (count === 1) await redis.expire(rateKey, 3600)
  if (count > 5) {
    const err: any = new Error("Too many OTP requests")
    err.statusCode = 429
    throw err
  }

  const code = env.OTP_DEMO_MODE ? env.OTP_DEMO_CODE : generateOtp()
  await redis.set(`otp:${phone}`, code, "EX", 120)
  await sendSms(phone, `Tasdiqlash kodi: ${code}. Kodni hech kimga bermang!`)

  return { message: "OTP sent" }
}

export async function verifyOtp(data: {
  phone: string
  code: string
  firstName: string
  lastName: string
  deviceId: string
  deviceName: string
}) {
  const stored = await redis.get(`otp:${data.phone}`)
  if (!stored || stored !== data.code) {
    const err: any = new Error("Invalid or expired OTP")
    err.statusCode = 401
    throw err
  }

  await redis.del(`otp:${data.phone}`)

  let user = await prisma.user.findUnique({ where: { phone: data.phone } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        referralCode: generateReferralCode(),
      },
    })
  }

  if (!user.isActive) {
    const err: any = new Error("Account is deactivated")
    err.statusCode = 403
    throw err
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const session = await prisma.userSession.upsert({
    where: { userId_deviceId: { userId: user.id, deviceId: data.deviceId } },
    update: { deviceName: data.deviceName, expiresAt },
    create: {
      userId: user.id,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      refreshTokenHash: "",
      expiresAt,
    },
  })

  const tokens = generateTokens(user.id, user.role, session.id)
  const hash = await bcrypt.hash(tokens.refreshToken, 10)
  await prisma.userSession.update({ where: { id: session.id }, data: { refreshTokenHash: hash } })

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: { id: user.id, phone: user.phone, firstName: user.firstName, lastName: user.lastName, role: user.role },
  }
}

export async function refresh(userId: string, sessionId: string, refreshToken: string) {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })

  if (!session || session.userId !== userId) {
    const err: any = new Error("Invalid session")
    err.statusCode = 401
    throw err
  }

  if (!session.user.isActive) {
    const err: any = new Error("Account is deactivated")
    err.statusCode = 403
    throw err
  }

  if (session.expiresAt < new Date()) {
    await prisma.userSession.delete({ where: { id: sessionId } })
    const err: any = new Error("Session expired")
    err.statusCode = 401
    throw err
  }

  const valid = await bcrypt.compare(refreshToken, session.refreshTokenHash)
  if (!valid) {
    await prisma.userSession.delete({ where: { id: sessionId } })
    const err: any = new Error("Token reuse detected")
    err.statusCode = 401
    throw err
  }

  const tokens = generateTokens(userId, session.user.role, sessionId)
  const hash = await bcrypt.hash(tokens.refreshToken, 10)
  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await prisma.userSession.update({
    where: { id: sessionId },
    data: { refreshTokenHash: hash, expiresAt: newExpiry },
  })

  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
}

export async function logout(userId: string, sessionId: string) {
  await prisma.userSession.deleteMany({ where: { id: sessionId, userId } })
  return { message: "Logged out" }
}

export async function getSessions(userId: string) {
  return prisma.userSession.findMany({
    where: { userId },
    select: { id: true, deviceName: true, deviceId: true, lastActiveAt: true, createdAt: true },
  })
}

export async function deleteSession(userId: string, sessionId: string) {
  const session = await prisma.userSession.findFirst({ where: { id: sessionId, userId } })
  if (!session) {
    const err: any = new Error("Session not found")
    err.statusCode = 404
    throw err
  }
  await prisma.userSession.delete({ where: { id: sessionId } })
  return { message: "Session deleted" }
}
```

- [ ] **Step 3: Create src/modules/auth/auth.routes.ts**

```ts
import { Router, Request, Response, NextFunction } from "express"
import * as authService from "./auth.service.js"
import { SendOtpSchema, VerifyOtpSchema, RefreshSchema } from "./auth.schema.js"
import { validate } from "../../middleware/validate.js"
import { authRequired, refreshAuth } from "../../middleware/auth.js"
import { otpSendLimiter, otpVerifyLimiter } from "../../middleware/rate-limiter.js"
import { AuthRequest, RefreshRequest } from "../../types/index.js"

const router = Router()

router.post("/send-otp", otpSendLimiter, validate(SendOtpSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.sendOtp(req.body.phone)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

router.post("/verify-otp", otpVerifyLimiter, validate(VerifyOtpSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.verifyOtp(req.body)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

router.post("/refresh", validate(RefreshSchema), refreshAuth as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, sessionId } = (req as RefreshRequest).user!
    const result = await authService.refresh(userId, sessionId, req.body.refreshToken)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

router.post("/logout", authRequired as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user!
    const result = await authService.logout(user.id, req.body.sessionId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

router.get("/sessions", authRequired as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user!
    const sessions = await authService.getSessions(user.id)
    res.json({ success: true, data: sessions })
  } catch (err) {
    next(err)
  }
})

router.delete("/sessions/:id", authRequired as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user!
    const result = await authService.deleteSession(user.id, req.params.id)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add auth module (routes, service, schema)"
```

---

### Task 6: Swagger setup

**Files:**
- Create: `src/swagger.ts`

- [ ] **Step 1: Create src/swagger.ts**

```ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi"
import { z } from "zod"
import { SendOtpSchema, VerifyOtpSchema, RefreshSchema } from "./modules/auth/auth.schema.js"

const registry = new OpenAPIRegistry()

registry.registerPath({
  method: "post",
  path: "/api/auth/send-otp",
  request: { body: { content: { "application/json": { schema: SendOtpSchema } } } },
  responses: { 200: { description: "OTP sent" } },
})

registry.registerPath({
  method: "post",
  path: "/api/auth/verify-otp",
  request: { body: { content: { "application/json": { schema: VerifyOtpSchema } } } },
  responses: { 200: { description: "Tokens returned" } },
})

registry.registerPath({
  method: "post",
  path: "/api/auth/refresh",
  request: { body: { content: { "application/json": { schema: RefreshSchema } } } },
  responses: { 200: { description: "New tokens" } },
})

registry.registerPath({
  method: "post",
  path: "/api/auth/logout",
  responses: { 200: { description: "Logged out" } },
})

registry.registerPath({
  method: "get",
  path: "/api/auth/sessions",
  responses: { 200: { description: "Session list" } },
})

registry.registerPath({
  method: "delete",
  path: "/api/auth/sessions/{id}",
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: "Session deleted" } },
})

const generator = new OpenApiGeneratorV3(registry.definitions)

export const swaggerDoc = generator.generateDocument({
  openapi: "3.0.0",
  info: { title: "Rideshare API", version: "1.0.0" },
  servers: [{ url: "http://localhost:3000" }],
})
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add swagger auto-generation from Zod schemas"
```

---

### Task 7: App and entry point

**Files:**
- Create: `src/app.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create src/app.ts**

```ts
import express from "express"
import cors from "cors"
import swaggerUi from "swagger-ui-express"
import { globalLimiter } from "./middleware/rate-limiter.js"
import { errorHandler } from "./middleware/error-handler.js"
import { swaggerDoc } from "./swagger.js"
import authRoutes from "./modules/auth/auth.routes.js"

const app = express()

app.use(cors())
app.use(express.json())
app.use(globalLimiter)

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc))
app.use("/api/auth", authRoutes)

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } })
})

app.use(errorHandler)

export default app
```

- [ ] **Step 2: Replace src/index.ts**

```ts
import app from "./app.js"
import { env } from "./config/env.js"
import { prisma } from "./lib/prisma.js"
import { redis } from "./lib/redis.js"

async function main() {
  await prisma.$connect()
  console.log("database connected")

  app.listen(env.PORT, () => {
    console.log(`server running on port ${env.PORT}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

process.on("SIGTERM", async () => {
  await prisma.$disconnect()
  redis.disconnect()
  process.exit(0)
})
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire up Express app with entry point"
```

---

### Task 8: Update .gitignore and final verification

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore**

```
node_modules
dist
.env
```

- [ ] **Step 2: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 3: Run the server**

```bash
npx tsx src/index.ts
```

Expected: "database connected" then "server running on port 3000"

- [ ] **Step 4: Test endpoints**

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/auth/send-otp -X POST -H "Content-Type: application/json" -d '{"phone":"+998901234567"}'
```

Expected: health returns `{"success":true,"data":{"status":"ok"}}`, send-otp returns success with OTP sent message.

- [ ] **Step 5: Verify swagger UI**

Open `http://localhost:3000/api/docs` in browser. Should show all auth endpoints.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: finalize Express migration, verify all endpoints"
```

---

## Summary

| Before (NestJS) | After (Express) |
|---|---|
| 30+ files, decorators, DI | 15 files, plain functions |
| `nest start --watch` | `npx tsx watch src/index.ts` |
| class-validator + DTOs | Zod schemas |
| Passport strategies | jwt.verify in middleware |
| APP_GUARD chain | Simple middleware |
| ~50 dependencies | ~15 dependencies |
| Swagger plugin magic | zod-to-openapi explicit |

All existing auth functionality is preserved: OTP send/verify, JWT access/refresh with rotation, multi-device sessions, rate limiting, role-based access control.
