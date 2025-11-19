/**
 * Ejecuta una función con lógica de reintentos y exponential backoff
 * @param {Function} fn - Función a ejecutar
 * @param {Object} options - Opciones de configuración
 * @param {number} options.maxRetries - Número máximo de reintentos
 * @param {number} options.initialDelay - Delay inicial en ms
 * @param {number} options.maxDelay - Delay máximo en ms
 * @param {Function} options.shouldRetry - Función que determina si se debe reintentar
 * @param {Function} options.onRetry - Callback llamado en cada reintento
 * @returns {Promise<any>} Resultado de la función
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = parseInt(process.env.MAX_RETRIES) || 3,
    initialDelay = parseInt(process.env.RETRY_DELAY_MS) || 2000,
    maxDelay = parseInt(process.env.RETRY_MAX_DELAY_MS) || 10000,
    shouldRetry = () => true,
    onRetry = () => {},
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // No reintentar si se alcanzó el máximo o si la función shouldRetry dice que no
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Llamar callback de reintento
      onRetry(error, attempt + 1, delay);

      // Esperar con exponential backoff
      await sleep(delay);

      // Incrementar delay (exponencial) pero no exceder maxDelay
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Determina si un error es retryable (transitorio)
 * @param {Error} error - Error a evaluar
 * @returns {boolean} true si es retryable
 */
function isRetryableError(error) {
  const message = error.message ? error.message.toLowerCase() : "";

  // Errores de red
  if (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("network")
  ) {
    return true;
  }

  // Errores de Playwright transitorios
  if (
    message.includes("navigation") ||
    message.includes("waiting") ||
    message.includes("target closed")
  ) {
    return true;
  }

  // Errores del servidor RNDC
  if (message.includes("503") || message.includes("502")) {
    return true;
  }

  return false;
}

/**
 * Helper para sleep
 * @param {number} ms - Milisegundos a esperar
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  withRetry,
  isRetryableError,
  sleep,
};
