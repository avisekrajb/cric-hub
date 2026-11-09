export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Please sign in to continue") {
    return new ApiError(401, message);
  }
  static forbidden(message = "You do not have permission to do this") {
    return new ApiError(403, message);
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }
  static conflict(message, details) {
    return new ApiError(409, message, details);
  }
  static tooMany(message = "Too many requests, please slow down") {
    return new ApiError(429, message);
  }
  static server(message = "Something went wrong on our side") {
    return new ApiError(500, message);
  }
}

export default ApiError;
