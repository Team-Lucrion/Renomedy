import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

type BodySchema = {
  safeParse: (input: unknown) => { success: true; data: unknown } | { success: false; error: { flatten: () => unknown } };
};

export function validateBody(schema: BodySchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(new HttpError(400, "Invalid request body", parsed.error.flatten()));
    }
    req.body = parsed.data as Request["body"];
    return next();
  };
}
