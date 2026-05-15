function format(level, message, meta) {
  const time = new Date().toISOString();
  const base = `[${time}] ${level} ${message}`;
  if (!meta) return base;
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return base;
  }
}

export const logger = {
  info: (msg, meta) => console.log(format("INFO", msg, meta)),
  warn: (msg, meta) => console.warn(format("WARN", msg, meta)),
  error: (msg, meta) => console.error(format("ERROR", msg, meta)),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(format("DEBUG", msg, meta));
    }
  },
};
