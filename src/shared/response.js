export function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function fail(res, statusCode, error, code) {
  return res.status(statusCode).json({
    success: false,
    error,
    code,
    statusCode,
  });
}
