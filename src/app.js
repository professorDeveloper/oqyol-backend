import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { getSwaggerDoc } from "./swagger.js";

import authRoutes from "./modules/auth/auth.routes.js";
import vehicleRoutes from "./modules/vehicles/vehicle.routes.js";
import { meRouter, driverProfileRouter, driverStatsRouter } from "./modules/profile/profile.routes.js";
import { regionsPublicRouter, regionsAdminRouter } from "./modules/regions/region.routes.js";
import districtsRouter from "./modules/districts/district.routes.js";
import { routesPublicRouter, routesAdminRouter } from "./modules/routes/route.routes.js";
import { walletUserRouter, walletAdminRouter } from "./modules/wallet/wallet.routes.js";
import {
  ordersPassengerRouter,
  ordersDriverRouter,
  ordersAdminRouter,
} from "./modules/orders/order.routes.js";
import {
  offersDriverRouter,
  offersOnOrderRouter,
  offersActionRouter,
} from "./modules/offers/offer.routes.js";
import ratingsRouter, { ratingsPublicRouter } from "./modules/ratings/rating.routes.js";
import notificationsRouter from "./modules/notifications/notification.routes.js";
import disputesRouter from "./modules/disputes/dispute.routes.js";
import adminRouter from "./modules/admin/admin.routes.js";
import {
  announcementsDriverRouter,
  announcementsPublicRouter,
} from "./modules/announcements/announcement.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.CORS_ORIGINS === "*" ? true : env.CORS_ORIGINS.split(",") }));
  app.use(express.json({ limit: "1mb" }));
  app.use(globalLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
  });

  // Three separate Swagger UIs — one per audience.
  const docsIndex = `<!doctype html>
<html><head><meta charset="utf-8"><title>API docs</title>
<style>body{font-family:system-ui,sans-serif;max-width:540px;margin:48px auto;padding:0 16px;color:#222}
h1{font-size:20px}ul{padding-left:18px;line-height:1.9}a{color:#1763d6;text-decoration:none}a:hover{text-decoration:underline}</style>
</head><body>
<h1>Rideshare API docs</h1>
<ul>
  <li><a href="/api/docs/driver">Driver app</a></li>
  <li><a href="/api/docs/passenger">Passenger app</a></li>
  <li><a href="/api/docs/admin">Admin web panel</a></li>
</ul>
</body></html>`;
  app.get("/api/docs", (_req, res) => res.type("html").send(docsIndex));
  app.use("/api/docs/driver", swaggerUi.serveFiles(getSwaggerDoc("driver")), swaggerUi.setup(getSwaggerDoc("driver")));
  app.use("/api/docs/passenger", swaggerUi.serveFiles(getSwaggerDoc("passenger")), swaggerUi.setup(getSwaggerDoc("passenger")));
  app.use("/api/docs/admin", swaggerUi.serveFiles(getSwaggerDoc("admin")), swaggerUi.setup(getSwaggerDoc("admin")));

  // Auth
  app.use("/api/auth", authRoutes);

  // Profile (any auth)
  app.use("/api/me", meRouter);

  // Driver-specific
  app.use("/api/driver/profile", driverProfileRouter);
  app.use("/api/driver/stats", driverStatsRouter);
  app.use("/api/driver/vehicles", vehicleRoutes);
  app.use("/api/driver/orders", ordersDriverRouter);
  app.use("/api/driver/offers", offersDriverRouter);
  app.use("/api/driver/announcements", announcementsDriverRouter);

  // Passenger-facing
  app.use("/api/orders", ordersPassengerRouter);
  app.use("/api/orders/:orderId/offers", offersOnOrderRouter);
  app.use("/api/orders/:id/ratings", ratingsRouter);
  app.use("/api/ratings", ratingsPublicRouter);
  app.use("/api/offers", offersActionRouter);
  app.use("/api/wallet", walletUserRouter);
  app.use("/api/announcements", announcementsPublicRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/disputes", disputesRouter);

  // Public read-only
  app.use("/api/regions", regionsPublicRouter);
  app.use("/api/districts", districtsRouter);
  app.use("/api/routes", routesPublicRouter);

  // Admin
  app.use("/api/admin", adminRouter);
  app.use("/api/admin/regions", regionsAdminRouter);
  app.use("/api/admin/routes", routesAdminRouter);
  app.use("/api/admin/orders", ordersAdminRouter);
  app.use("/api/admin/wallets", walletAdminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
