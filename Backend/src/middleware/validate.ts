import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";
import { HttpError } from "../utils/http-error";

export function validateBody(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(new HttpError(400, "Invalid request body", parsed.error.flatten()));
    }
    req.body = parsed.data;
    return next();
  };
}
