import pino from "pino";

const globalForLogger = globalThis as typeof globalThis & {
  __happinessLogger__?: pino.Logger;
};

export const logger =
  globalForLogger.__happinessLogger__ ??
  pino({
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "development" ? "debug" : "info"),
    base: undefined
  });

if (process.env.NODE_ENV !== "production") {
  globalForLogger.__happinessLogger__ = logger;
}
