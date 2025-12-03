export type CORSOrigin =
  | string
  | string[]
  | ((origin: string, req: Request) => string | null | undefined);

export interface CORSOptions {
  /**
   * The value of "Access-Control-Allow-Origin" CORS header.
   * Can be a string, array of strings, or a function that returns the allowed origin.
   * @default '*'
   */
  origin?: CORSOrigin;
  /**
   * The value of "Access-Control-Allow-Methods" CORS header.
   * @default ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH']
   */
  allowMethods?: string[];
  /**
   * The value of "Access-Control-Allow-Headers" CORS header.
   * @default []
   */
  allowHeaders?: string[];
  /**
   * The value of "Access-Control-Max-Age" CORS header (in seconds).
   */
  maxAge?: number;
  /**
   * The value of "Access-Control-Allow-Credentials" CORS header.
   */
  credentials?: boolean;
  /**
   * The value of "Access-Control-Expose-Headers" CORS header.
   * @default []
   */
  exposeHeaders?: string[];
}

const DEFAULT_ALLOW_METHODS = ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"];

const resolveOrigin = (
  origin: CORSOrigin | undefined,
  requestOrigin: string | null,
  req: Request,
): string | null => {
  if (!requestOrigin) return null;

  if (origin === undefined || origin === "*") {
    return "*";
  }

  if (typeof origin === "string") {
    return origin === requestOrigin ? origin : null;
  }

  if (Array.isArray(origin)) {
    return origin.includes(requestOrigin) ? requestOrigin : null;
  }

  if (typeof origin === "function") {
    return origin(requestOrigin, req) ?? null;
  }

  return null;
};

const setCORSHeaders = (
  headers: Headers,
  req: Request,
  options: CORSOptions,
): void => {
  const requestOrigin = req.headers.get("Origin");
  const allowedOrigin = resolveOrigin(options.origin, requestOrigin, req);

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }

  if (options.credentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  if (options.exposeHeaders?.length) {
    headers.set(
      "Access-Control-Expose-Headers",
      options.exposeHeaders.join(", "),
    );
  }
};

export const handlePreflight = (
  req: Request,
  options: CORSOptions,
): Response => {
  const headers = new Headers();
  const requestOrigin = req.headers.get("Origin");
  const allowedOrigin = resolveOrigin(options.origin, requestOrigin, req);

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }

  if (options.credentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  const allowMethods = options.allowMethods ?? DEFAULT_ALLOW_METHODS;
  headers.set("Access-Control-Allow-Methods", allowMethods.join(", "));

  const requestHeaders = req.headers.get("Access-Control-Request-Headers");
  if (options.allowHeaders?.length) {
    headers.set(
      "Access-Control-Allow-Headers",
      options.allowHeaders.join(", "),
    );
  } else if (requestHeaders) {
    // Mirror the requested headers if no explicit allowHeaders configured
    headers.set("Access-Control-Allow-Headers", requestHeaders);
  }

  if (options.maxAge !== undefined) {
    headers.set("Access-Control-Max-Age", options.maxAge.toString());
  }

  return new Response(null, { status: 204, headers });
};

export const withCORS = (
  response: Response,
  req: Request,
  options: CORSOptions,
): Response => {
  const newHeaders = new Headers(response.headers);
  setCORSHeaders(newHeaders, req, options);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};
