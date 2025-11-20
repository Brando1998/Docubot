const fs = require("fs");
const path = require("path");
const { createLogger } = require("../utils/logger");

const logger = createLogger({ component: "TaskManager" });

/**
 * Gestor de tareas con persistencia en JSON
 * taskId = consecutivo de la remesa (proporcionado por el usuario)
 */
class TaskManager {
  constructor(tasksDir = "/downloads/tasks") {
    this.tasksDir = tasksDir;
    this.tasksFile = path.join(tasksDir, "tasks.json");
    this.tasks = new Map();

    // Crear directorio si no existe
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
      logger.info({ tasksDir }, "Tasks directory created");
    }

    this.loadTasks();
  }

  /**
   * Crea una nueva tarea
   * @param {string} taskId - Consecutivo de la remesa
   * @param {object} data - Datos de remesa y manifiesto
   */
  createTask(taskId, data) {
    // Verificar si ya existe una tarea con este consecutivo
    if (this.tasks.has(taskId)) {
      const existingTask = this.tasks.get(taskId);
      
      // Si está completada o fallida, permitir recrear
      if (existingTask.status === "completed" || existingTask.status === "failed") {
        logger.info({ taskId }, "Recreating existing task");
      } else {
        // Si está pendiente o procesando, retornar la existente
        logger.info({ taskId }, "Task already exists");
        return existingTask;
      }
    }

    const task = {
      id: taskId, // Consecutivo de la remesa
      status: "pending", // pending, processing, completed, failed, retrying
      data: data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: parseInt(process.env.TASK_MAX_RETRIES) || 10,
      nextRetryAt: null,
      error: null,
      result: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
    };

    this.tasks.set(taskId, task);
    this.saveTasks();

    logger.info({ taskId, status: task.status }, "Task created");

    return task;
  }

  /**
   * Obtiene una tarea por su ID
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * Actualiza una tarea
   */
  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn({ taskId }, "Task not found for update");
      return null;
    }

    Object.assign(task, updates, {
      updatedAt: new Date().toISOString(),
    });

    this.saveTasks();

    logger.debug({ taskId, status: task.status }, "Task updated");

    return task;
  }

  /**
   * Marca una tarea para reintentar en 15 minutos
   */
  markForRetry(taskId, error) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const retryIntervalMinutes =
      parseInt(process.env.TASK_RETRY_INTERVAL_MINUTES) || 15;

    task.attempts++;
    task.status = "retrying";
    task.error = error;
    task.nextRetryAt = new Date(
      Date.now() + retryIntervalMinutes * 60 * 1000
    ).toISOString();
    task.updatedAt = new Date().toISOString();

    this.saveTasks();

    logger.warn(
      {
        taskId,
        attempts: task.attempts,
        nextRetryAt: task.nextRetryAt,
      },
      "Task marked for retry"
    );

    return task;
  }

  /**
   * Obtiene tareas que están listas para reintentar
   */
  getTasksToRetry() {
    const now = new Date();
    return Array.from(this.tasks.values()).filter(
      (task) =>
        task.status === "retrying" &&
        task.nextRetryAt &&
        new Date(task.nextRetryAt) <= now &&
        task.attempts < task.maxAttempts
    );
  }

  /**
   * Obtiene tareas pendientes
   */
  getPendingTasks() {
    return Array.from(this.tasks.values()).filter(
      (task) => task.status === "pending"
    );
  }

  /**
   * Limpia tareas expiradas (más de 24 horas)
   */
  cleanExpiredTasks() {
    const now = new Date();
    let deletedCount = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if (task.expiresAt && new Date(task.expiresAt) < now) {
        this.tasks.delete(taskId);
        deletedCount++;
        logger.info({ taskId }, "Expired task deleted");
      }
    }

    if (deletedCount > 0) {
      this.saveTasks();
    }

    return deletedCount;
  }

  /**
   * Obtiene estadísticas de tareas
   */
  getStats() {
    const stats = {
      total: this.tasks.size,
      pending: 0,
      processing: 0,
      retrying: 0,
      completed: 0,
      failed: 0,
    };

    for (const task of this.tasks.values()) {
      if (stats.hasOwnProperty(task.status)) {
        stats[task.status]++;
      }
    }

    return stats;
  }

  /**
   * Carga tareas desde el archivo JSON
   */
  loadTasks() {
    try {
      if (fs.existsSync(this.tasksFile)) {
        const data = fs.readFileSync(this.tasksFile, "utf-8");
        const tasksArray = JSON.parse(data);

        this.tasks = new Map(tasksArray.map((task) => [task.id, task]));

        logger.info({ count: this.tasks.size }, "Tasks loaded from disk");
      } else {
        logger.info("No tasks file found, starting fresh");
      }
    } catch (error) {
      logger.error(
        { error: error.message },
        "Failed to load tasks, starting fresh"
      );
      this.tasks = new Map();
    }
  }

  /**
   * Guarda tareas al archivo JSON
   */
  saveTasks() {
    try {
      const tasksArray = Array.from(this.tasks.values());
      fs.writeFileSync(
        this.tasksFile,
        JSON.stringify(tasksArray, null, 2),
        "utf-8"
      );

      logger.debug({ count: tasksArray.length }, "Tasks saved to disk");
    } catch (error) {
      logger.error({ error: error.message }, "Failed to save tasks");
    }
  }
}

module.exports = { TaskManager };
