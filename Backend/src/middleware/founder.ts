import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

const founderIds = env.FOUNDER_CLERK_USER_IDS.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export function requireFounder(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.clerkUserId || !founderIds.includes(req.auth.clerkUserId)) {
    return next(new HttpError(403, "Founder access required"));
  }

  next();
}
