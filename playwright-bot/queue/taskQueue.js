const PQueue = require("p-queue").default;
const { createLogger } = require("../utils/logger");

const logger = createLogger({ component: "TaskQueue" });

/**
 * Cola de tareas para procesar manifiestos secuencialmente
 * Previene sobrecarga del navegador y errores de concurrencia
 */
class TaskQueue {
  constructor(options = {}) {
    const concurrency =
      parseInt(process.env.QUEUE_CONCURRENCY) || options.concurrency || 1;
    const timeout =
      parseInt(process.env.QUEUE_TIMEOUT_MS) || options.timeout || 300000; // 5 min default

    this.queue = new PQueue({
      concurrency, // Solo una tarea a la vez por defecto
      timeout, // Timeout por tarea
      throwOnTimeout: true,
    });

    this.setupEventHandlers();

    logger.info(
      { concurrency, timeout },
      "TaskQueue initialized"
    );
  }

  setupEventHandlers() {
    this.queue.on("active", () => {
      logger.debug(
        {
          size: this.queue.size,
          pending: this.queue.pending,
        },
        "Task started processing"
      );
    });

    this.queue.on("idle", () => {
      logger.debug("Queue is idle - all tasks completed");
    });

    this.queue.on("error", (error) => {
      logger.error({ error: error.message }, "Queue error occurred");
    });
  }

  /**
   * Agregar tarea a la cola
   * @param {Function} fn - Función async a ejecutar
   * @param {Object} context - Contexto adicional para logs
   * @returns {Promise} Resultado de la tarea
   */
  async add(fn, context = {}) {
    const startTime = Date.now();

    logger.info(
      {
        ...context,
        queueSize: this.queue.size,
        pending: this.queue.pending,
      },
      "Adding task to queue"
    );

    try {
      const result = await this.queue.add(fn);
      const duration = Date.now() - startTime;

      logger.info(
        {
          ...context,
          duration,
        },
        "Task completed successfully"
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          ...context,
          duration,
          error: error.message,
        },
        "Task failed"
      );

      throw error;
    }
  }

  /**
   * Obtener estadísticas de la cola
   */
  getStats() {
    return {
      size: this.queue.size, // Tareas en espera
      pending: this.queue.pending, // Tareas en ejecución
      isPaused: this.queue.isPaused,
    };
  }

  /**
   * Pausar la cola
   */
  pause() {
    logger.info("Pausing queue");
    this.queue.pause();
  }

  /**
   * Reanudar la cola
   */
  resume() {
    logger.info("Resuming queue");
    this.queue.start();
  }

  /**
   * Limpiar la cola (cancelar tareas pendientes)
   */
  clear() {
    logger.warn("Clearing queue - canceling pending tasks");
    this.queue.clear();
  }
}

module.exports = { TaskQueue };
