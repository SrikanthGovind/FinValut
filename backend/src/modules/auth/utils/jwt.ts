import jwt, { SignOptions } from "jsonwebtoken";
import { AuthUser } from "../../../middleware/authContext";

const DEFAULT_EXPIRES_IN = "1d";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function getJwtExpiresIn(): SignOptions["expiresIn"] {
  return (process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN) as SignOptions["expiresIn"];
}

export function signAccessToken(user: AuthUser): {
  accessToken: string;
  expiresAt: Date;
} {
  const expiresIn = getJwtExpiresIn();
  const accessToken = jwt.sign(
    { userId: user.userId, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn }
  );

  const decoded = jwt.decode(accessToken);
  const expiresAt =
    decoded && typeof decoded === "object" && decoded.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

  return { accessToken, expiresAt };
}
