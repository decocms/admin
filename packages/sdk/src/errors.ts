export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message ?? "Not found");
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message?: string) {
    super(message ?? "Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message?: string) {
    super(message ?? "Forbidden");
    this.name = "ForbiddenError";
  }
}
