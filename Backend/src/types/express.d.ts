import type { JwtReturnType } from "@clerk/backend";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        clerkUserId: string;
        token: string;
        claims: JwtReturnType["claims"];
      };
      requestId?: string;
    }
  }
}

export {};
