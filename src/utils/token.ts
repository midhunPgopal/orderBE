import jwt, { SignOptions } from "jsonwebtoken";

const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

if (!accessSecret || !refreshSecret) {
  throw new Error("JWT secrets are not defined in environment variables");
}

const accessExpires = process.env.ACCESS_TOKEN_EXPIRES || "15m";
const refreshExpires = process.env.REFRESH_TOKEN_EXPIRES || "7d";

export const generateAccessToken = (payload: object): string => {
  const options: SignOptions = {
    expiresIn: accessExpires as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, accessSecret, options);
};

export const generateRefreshToken = (payload: object): string => {
  const options: SignOptions = {
    expiresIn: refreshExpires as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, refreshSecret, options);
};
