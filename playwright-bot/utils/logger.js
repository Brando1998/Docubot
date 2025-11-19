const pino = require("pino");

const isProduction = process.env.NODE_ENV === "production";

/**
 * Configuración del logger con Pino
 * - En desarrollo: formato pretty para lectura humana
 * - En producción: formato JSON para agregación de logs
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  // Agregar contexto base
  base: {
    service: "playwright-bot",
    env: process.env.NODE_ENV || "development",
  },
});

/**
 * Crear un logger hijo con contexto adicional
 * @param {Object} context - Contexto adicional para el logger
 * @returns {Logger} Logger con contexto
 */
function createLogger(context = {}) {
  return logger.child(context);
}

module.exports = { logger, createLogger };
