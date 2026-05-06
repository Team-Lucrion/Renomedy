import type { Response } from "express";
import { TRUST_DISCLAIMER } from "../config/constants";

export function ok(res: Response, data: unknown, message = "OK", meta: Record<string, unknown> = {}) {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      ...meta,
      trust: TRUST_DISCLAIMER
    }
  });
}
