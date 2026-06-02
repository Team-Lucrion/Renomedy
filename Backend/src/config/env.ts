import dotenv from "dotenv";
import path from "path";
import { z } from "zod/v3";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().default("prescriptions"),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  CORS_ALLOWED_ORIGINS: z.string().default(""),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  POSTHOG_ENABLED: z.string().default("false"),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  OCR_PROVIDER: z.enum(["mock", "vision_gemini", "tesseract_groq", "prescripto_ai"]).default("vision_gemini"),
  OCR_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_VISION_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FOUNDER_BYPASS_IDENTIFIERS: z.string().default(""),
  FOUNDER_CLERK_USER_IDS: z.string().default(""),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  ENABLE_SCHEDULER: z.string().default("true"),
  CRON_REMINDER_SCAN: z.string().default("*/5 * * * *"),
  CRON_REFILL_SCAN: z.string().default("0 */6 * * *"),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120)
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment config: ${parsed.error.message}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS
  .split(",")
  .map((origin: string) => origin.trim())
  .filter(Boolean);

if (isProduction && corsAllowedOrigins.length === 0) {
  throw new Error("CORS_ALLOWED_ORIGINS must be configured in production");
}
