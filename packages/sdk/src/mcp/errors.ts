export class MCPError extends Error {
  readonly code?: number;
  constructor(message: string) {
    super(message);
  }
}

export class CannotAccessWorkspaceError extends MCPError {
  override code = 401;
  constructor(message: string = "Unauthorized access") {
    super(message);
  }
}

export class ThreadNotFoundError extends MCPError {
  override code = 404;
  constructor(message: string = "Thread not found") {
    super(message);
  }
}

export class MissingDatabaseError extends MCPError {
  override code = 500;
  constructor(message: string = "Missing database") {
    super(message);
  }
}

export class UnauthorizedError extends MCPError {
  override code = 401;
  constructor(message: string = "Unauthorized") {
    super(message);
  }
}

export class ForbiddenError extends MCPError {
  override code = 403;
  constructor(message: string = "User does not have access to this workspace") {
    super(message);
  }
}

export class WebhookEventIgnoredError extends MCPError {
  override code = 400;
  constructor(message: string = "Event ignored") {
    super(message);
  }
}
