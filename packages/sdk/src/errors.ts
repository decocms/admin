export class HttpError extends Error {
  readonly code?: number;
  constructor(message: string) {
    super(message);
  }
}

export class UserInputError extends HttpError {
  override code = 400;
  constructor(message: string = "User input error") {
    super(message);
  }
}

export class UnauthorizedError extends HttpError {
  override code = 401;
  constructor(message: string = "User is not logged in") {
    super(message);
  }
}

export class ForbiddenError extends HttpError {
  override code = 403;
  constructor(message: string = "User does not have access to this resource") {
    super(message);
  }
}

export class NotFoundError extends HttpError {
  override code = 404;
  constructor(message: string = "Resource not found") {
    super(message);
  }
}

export class InternalServerError extends HttpError {
  override code = 500;
  constructor(message: string = "Internal server error") {
    super(message);
  }
}

export const getErrorByStatusCode = (statusCode: number, message?: string) => {
  if (statusCode === 400) {
    return new UserInputError(message);
  }

  if (statusCode === 401) {
    return new UnauthorizedError(message);
  }

  if (statusCode === 403) {
    return new ForbiddenError(message);
  }

  if (statusCode === 404) {
    return new NotFoundError(message);
  }

  return new InternalServerError(message);
};
