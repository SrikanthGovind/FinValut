import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ExpressContextFunctionArgument } from "@as-integrations/express4";

export interface AuthUser {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser | null;
    }
  }
}

export interface AuthContext {
  req: Request;
  res: Response;
  user: AuthUser | null;
}

interface JwtPayload {
  userId: string;
  email: string;
}

function getUserFromRequest(req: Request): AuthUser | null {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const secret = process.env.JWT_SECRET || "default_banking_jwt_secret";

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    if (!decoded?.userId) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

/**
 * Apollo Server context: verifies Bearer token and exposes `user` to resolvers.
 */
export async function authContext({
  req,
  res,
}: ExpressContextFunctionArgument): Promise<AuthContext> {
  const user = getUserFromRequest(req);
  req.user = user;

  return { req, res, user };
}
