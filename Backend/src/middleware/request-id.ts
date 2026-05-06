import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = req.header("x-request-id") ?? randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
