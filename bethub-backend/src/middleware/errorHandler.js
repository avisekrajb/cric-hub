import logger from "../config/logger.js";
import ApiError from "../utils/ApiError.js";

const errorHandler = (err, req, res, _next) => {
  let error = err;

  if (err?.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = new ApiError(422, "Please check the highlighted fields", details);
  } else if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    error = new ApiError(409, `That ${field} is already in use`);
  } else if (err?.name === "CastError") {
    error = new ApiError(400, "Invalid identifier supplied");
  } else if (err?.name === "MulterError") {
    const messages = {
      LIMIT_FILE_SIZE: err.limitMb
        ? `File is too large. Maximum allowed size is ${err.limitMb} MB`
        : "File is too large",
      LIMIT_UNEXPECTED_FILE: err.message || "Unexpected upload field",
    };
    if (err.code === "LIMIT_FILE_SIZE") {
      error = new ApiError(413, err.limitMb ? messages.LIMIT_FILE_SIZE : "File is too large");
    } else {
      error = new ApiError(400, messages[err.code] || "Upload failed");
    }
  } else if (err?.type === "entity.too.large") {
    error = new ApiError(413, "Request body is too large");
  }

  const status = error.statusCode || 500;
  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} →`, err.message, err.stack?.split("\n")[1] || "");
  }

  const body = {
    success: false,
    message: status >= 500 && process.env.NODE_ENV === "production" ? "Something went wrong" : error.message,
  };
  if (error.details) body.details = error.details;
  if (process.env.NODE_ENV !== "production" && status >= 500) body.stack = err.stack;

  res.status(status).json(body);
};

export default errorHandler;
