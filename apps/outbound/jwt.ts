import { type JWTPayload, jwtVerify, SignJWT } from "jose";
export type { JWTPayload };

export async function createJWT<T extends JWTPayload = JWTPayload>(
  payload: T,
  secret: string,
  expiresIn?: number | string | Date,
): Promise<string> {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn ?? "1h")
    .sign(new TextEncoder().encode(secret));

  return jwt;
}

export async function verifyJWT<T extends JWTPayload = JWTPayload>(
  token: string,
  secret: string,
): Promise<T | undefined> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );
    return payload as T;
  } catch {
    return undefined;
  }
}

export interface JwtIssuer<T extends JWTPayload = JWTPayload> {
  verify: (token: string) => Promise<T | undefined>;
  create: (payload: T) => Promise<string>;
}

const DECO_CHAT_ISSUER = "deco.chat";

const newSecret = () => {
  // 1. Generate 64 random bytes (512 bits)
  const rawSecret = crypto.getRandomValues(new Uint8Array(64));

  // 2. Base64-encode it
  return btoa(String.fromCharCode(...rawSecret));
};
let secret: string | null = null;

// local-dev only
const generateSecretOnce = () => {
  return secret ??= newSecret();
};

export const JwtIssuer = {
  forSecret: <T extends JWTPayload = JWTPayload>(
    secret?: string | undefined,
    issuer: string = DECO_CHAT_ISSUER,
  ): JwtIssuer<T> => ({
    verify: (token: string) =>
      verifyJWT<T>(token, secret ?? generateSecretOnce()),
    create: (payload: T) =>
      createJWT<T>({ ...payload, iss: issuer }, secret ?? generateSecretOnce()),
  }),
};
