import { ResourceAccessContext } from "./mcp/index.ts";
import { arrayProp } from "./utils/fns.ts";

export class HttpError extends Error {
  readonly code?: number;
  readonly traceId?: string;

  constructor(message: string, traceId?: string) {
    super(message);
    this.traceId = traceId;
  }

  override toString() {
    return `HttpError[${this.code}] ${this.message}\n${this.stack}`;
  }
}

export class UserInputError extends HttpError {
  override code = 400;
  constructor(message: string = "User input error", traceId?: string) {
    super(message, traceId);
  }
}

export class UnauthorizedError extends HttpError {
  override code = 401;
  constructor(message: string = "User is not logged in", traceId?: string) {
    super(message, traceId);
  }
}

export class ForbiddenError extends HttpError {
  override code = 403;
  constructor(
    message: string = "User does not have access to this resource",
    public detail?: { resources: ResourceAccessContext[] },
    traceId?: string,
  ) {
    super(message, traceId);
  }
}

export class NotFoundError extends HttpError {
  override code = 404;
  constructor(message: string = "Resource not found", traceId?: string) {
    super(message, traceId);
  }
}

export class InternalServerError extends HttpError {
  override code = 500;
  constructor(message: string = "Internal server error", traceId?: string) {
    super(message, traceId);
  }
}

export class FeatureNotAvailableError extends HttpError {
  override code = 403;
  constructor(message: string = "Feature not available", traceId?: string) {
    super(message, traceId);
  }
}

export class WebhookEventIgnoredError extends HttpError {
  override code = 400;
  constructor(message: string = "Event ignored", traceId?: string) {
    super(message, traceId);
  }
}

export class PaymentRequiredError extends HttpError {
  override code = 402;
  constructor(message: string = "Payment required", traceId?: string) {
    super(message, traceId);
  }
}

export const getErrorByStatusCode = (
  statusCode: number,
  message?: string,
  traceId?: string,
  errorObject?: unknown,
) => {
  if (statusCode === 400) {
    return new UserInputError(message, traceId);
  }

  if (statusCode === 401) {
    return new UnauthorizedError(message, traceId);
  }

  if (statusCode === 402) {
    return new PaymentRequiredError(message, traceId);
  }

  if (statusCode === 403) {
    return new ForbiddenError(
      message,
      { resources: arrayProp(errorObject, "resources") ?? [] },
      traceId,
    );
  }

  if (statusCode === 404) {
    return new NotFoundError(message, traceId);
  }

  return new InternalServerError(message, traceId);
};
