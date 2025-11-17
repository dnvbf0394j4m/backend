export function errorHandler(err, req, res, next) {
  console.error(err);
  const code = err.statusCode || 400;
  res.status(code).json({ error: err.message || "Unexpected error" });
}
