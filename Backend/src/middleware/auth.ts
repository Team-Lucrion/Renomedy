import { verifyToken } from "@clerk/backend";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

function getBearerToken(req: Request): string {
  const authHeader = req.header("authorization");
  console.log("[auth] authorization header present", Boolean(authHeader));
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }
  return authHeader.replace("Bearer ", "").trim();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    console.log("[auth] bearer token present", Boolean(token));
    const verified = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    console.log("[auth] token validation succeeded", { clerkUserId: verified.sub });
    req.auth = {
      clerkUserId: verified.sub,
      token,
      claims: verified.claims
    };
    next();
  } catch (error) {
    console.log("[auth] token validation failed", error);
    next(new HttpError(401, "Invalid or expired auth token", error));
  }
}
