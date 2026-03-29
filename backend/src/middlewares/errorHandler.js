export function errorHandler(err, req, res, next) {
  console.error("[Error]", err.message || err);
  const status = err.status || err.statusCode || 500;
  const detail = err.message || "Internal server error";
  res.status(status).json({ detail });
}
