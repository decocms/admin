export class HttpError extends Error {
  readonly code?: number;
  readonly errorId?: string;

  constructor(message: string, errorId?: string) {
    super(message);
    this.errorId = errorId;
  }
}

export class UserInputError extends HttpError {
  override code = 400;
  constructor(message: string = "User input error", errorId?: string) {
    super(message, errorId);
  }
}

export class UnauthorizedError extends HttpError {
  override code = 401;
  constructor(message: string = "User is not logged in", errorId?: string) {
    super(message, errorId);
  }
}

export class ForbiddenError extends HttpError {
  override code = 403;
  constructor(
    message: string = "User does not have access to this resource",
    errorId?: string,
  ) {
    super(message, errorId);
  }
}

export class NotFoundError extends HttpError {
  override code = 404;
  constructor(message: string = "Resource not found", errorId?: string) {
    super(message, errorId);
  }
}

export class InternalServerError extends HttpError {
  override code = 500;
  constructor(message: string = "Internal server error", errorId?: string) {
    super(message, errorId);
  }
}

export const getErrorByStatusCode = (
  statusCode: number,
  message?: string,
  errorId?: string,
) => {
  if (statusCode === 400) {
    return new UserInputError(message, errorId);
  }

  if (statusCode === 401) {
    return new UnauthorizedError(message, errorId);
  }

  if (statusCode === 403) {
    return new ForbiddenError(message, errorId);
  }

  if (statusCode === 404) {
    return new NotFoundError(message, errorId);
  }

  return new InternalServerError(message, errorId);
};
