const { createLogger } = require("../utils/logger");

const logger = createLogger({ component: "ManifiestoWorker" });

/**
 * Worker que procesa tareas de creación de manifiestos en background
 */
class ManifiestoWorker {
  constructor(taskManager, bot, fileManager) {
    this.taskManager = taskManager;
    this.bot = bot;
    this.fileManager = fileManager;
    this.isProcessing = false;
  }

  /**
   * Procesa una tarea individual
   */
  async processTask(task) {
    logger.info({ taskId: task.id, attempts: task.attempts }, "Processing task");

    // Marcar como procesando
    this.taskManager.updateTask(task.id, { status: "processing" });

    try {
      // Intentar crear el manifiesto
      const result = await this.bot.createManifiesto(
        task.data.remesa,
        task.data.manifiesto,
        "/downloads/temp"
      );

      // Guardar archivo
      const fileRecord = this.fileManager.saveFile(
        result.filePath,
        `manifiesto_${result.consecutivoManifiesto}.pdf`
      );

      // Marcar como completada
      this.taskManager.updateTask(task.id, {
        status: "completed",
        result: {
          consecutivoRemesa: result.consecutivoRemesa,
          consecutivoManifiesto: result.consecutivoManifiesto,
          fileId: fileRecord.id,
          fileName: fileRecord.fileName,
          expiresAt: fileRecord.expiresAt,
        },
        error: null,
      });

      logger.info(
        {
          taskId: task.id,
          fileId: fileRecord.id,
          consecutivoManifiesto: result.consecutivoManifiesto,
        },
        "Task completed successfully"
      );

      return true;
    } catch (error) {
      logger.error(
        {
          taskId: task.id,
          attempts: task.attempts,
          error: error.message,
        },
        "Task failed"
      );

      // Verificar si es un timeout de RNDC
      if (this.isRNDCTimeout(error)) {
        // Si aún puede reintentar
        if (task.attempts < task.maxAttempts - 1) {
          this.taskManager.markForRetry(task.id, error.message);

          logger.warn(
            {
              taskId: task.id,
              attempts: task.attempts + 1,
              maxAttempts: task.maxAttempts,
              nextRetry: this.taskManager.getTask(task.id).nextRetryAt,
            },
            "Task will retry later"
          );

          return false;
        } else {
          // Agotó reintentos
          this.taskManager.updateTask(task.id, {
            status: "failed",
            error: `Max retries exceeded (${task.maxAttempts}). RNDC service unavailable.`,
          });

          logger.error(
            { taskId: task.id, attempts: task.attempts },
            "Task failed permanently - max retries exceeded"
          );

          return false;
        }
      } else {
        // Error no relacionado con timeout, fallar inmediatamente
        this.taskManager.updateTask(task.id, {
          status: "failed",
          error: error.message,
        });

        logger.error(
          { taskId: task.id, error: error.message },
          "Task failed permanently - non-retryable error"
        );

        return false;
      }
    }
  }

  /**
   * Verifica si un error es un timeout de RNDC (reintentable)
   */
  isRNDCTimeout(error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("navigation") ||
      message.includes("waiting for") ||
      message.includes("target closed") ||
      message.includes("page.goto")
    );
  }

  /**
   * Procesa la próxima tarea pendiente (si hay)
   */
  async processNextTask() {
    if (this.isProcessing) {
      logger.debug("Already processing a task, skipping");
      return;
    }

    const pendingTasks = this.taskManager.getPendingTasks();

    if (pendingTasks.length === 0) {
      return;
    }

    // Tomar la primera tarea pendiente (FIFO)
    const task = pendingTasks[0];

    this.isProcessing = true;

    try {
      await this.processTask(task);
    } catch (error) {
      logger.error(
        { error: error.message, taskId: task.id },
        "Unexpected error processing task"
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Procesa tareas que están listas para reintentar
   */
  async processRetries() {
    const tasksToRetry = this.taskManager.getTasksToRetry();

    if (tasksToRetry.length === 0) {
      return;
    }

    logger.info(
      { count: tasksToRetry.length },
      "Found tasks ready for retry"
    );

    // Marcar como pendientes para que sean procesadas
    for (const task of tasksToRetry) {
      this.taskManager.updateTask(task.id, {
        status: "pending",
        nextRetryAt: null,
      });

      logger.info(
        { taskId: task.id, attempts: task.attempts },
        "Task moved to pending for retry"
      );
    }
  }
}

module.exports = { ManifiestoWorker };
