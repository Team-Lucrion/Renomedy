import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./config/logger";
import { requestIdMiddleware } from "./middleware/request-id";
import { apiRateLimiter } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { observabilityMiddleware } from "./middleware/observability";
import { authRouter } from "./modules/auth/auth.routes";
import { clerkWebhookHandler } from "./modules/auth/auth.controller";
import { usersRouter } from "./modules/users/users.routes";
import { familyRouter } from "./modules/family/family.routes";
import { prescriptionScanRouter, prescriptionsRouter } from "./modules/prescriptions/prescriptions.routes";
import { prescriptionsV2Router } from "./modules/prescriptions/prescriptions-v2.routes";
import { medicationsRouter } from "./modules/medications/medications.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { subscriptionsRouter } from "./modules/subscriptions/subscriptions.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { betaRouter } from "./modules/beta/beta.routes";
import { corsAllowedOrigins, env } from "./config/env";
import { asyncHandler } from "./utils/async-handler";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsAllowedOrigins.length === 0 || corsAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    }
  })
);
app.post("/auth/clerk-webhook", express.raw({ limit: "2mb", type: "application/json" }), asyncHandler(clerkWebhookHandler));
app.use(express.json({ limit: `${Math.max(2, env.MAX_UPLOAD_MB * 2)}mb` }));
app.use(requestIdMiddleware);
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({ requestId: req.requestId })
  })
);
app.use(apiRateLimiter);
app.use(observabilityMiddleware);

app.get("/health", (_req, res) => res.status(200).json({ status: "ok", service: "renomedy-backend" }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/family", familyRouter);
app.use("/prescriptions", prescriptionsRouter);
app.use("/api/prescriptions", prescriptionsRouter);
app.use("/api/v2/prescriptions", prescriptionsV2Router);
app.use("/api", prescriptionScanRouter);
app.use("/medications", medicationsRouter);
app.use("/notifications", notificationsRouter);
app.use("/dashboard", dashboardRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/payments", paymentsRouter);
app.use("/beta", betaRouter);
app.use("/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);
