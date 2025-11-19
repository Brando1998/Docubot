require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const rateLimit = require("express-rate-limit");
const { RNDCBot } = require("./bot/rndcBot");
const { FileManager } = require("./storage/fileManager");
const { TaskQueue } = require("./queue/taskQueue");
const { validateRequest } = require("./middleware/validation");
const { createManifiestoRequestSchema } = require("./validation/schemas");
const { logger, createLogger } = require("./utils/logger");
const { withRetry, isRetryableError } = require("./utils/retry");

const app = express();
const PORT = process.env.PORT || 3001;
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || "/downloads";

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting: 10 requests por minuto por defecto
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minuto
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Instancias
const fileManager = new FileManager(DOWNLOAD_DIR);
const taskQueue = new TaskQueue();
let bot = null;
let botInitialized = false;

// Inicializar bot con validación de credenciales
async function initializeBot() {
  if (!botInitialized) {
    try {
      logger.info("Initializing RNDC bot");
      bot = new RNDCBot(createLogger({ component: "RNDCBot" }));
      
      await withRetry(
        async () => await bot.initialize(),
        {
          maxRetries: 2,
          shouldRetry: isRetryableError,
          onRetry: (error, attempt, delay) => {
            logger.warn(
              { error: error.message, attempt, delay },
              "Retrying bot initialization"
            );
          },
        }
      );
      
      botInitialized = true;
      logger.info("Bot initialized successfully");
    } catch (error) {
      logger.error({ error: error.message }, "Failed to initialize bot");
      throw error;
    }
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "playwright-bot",
    botInitialized,
    queueStats: taskQueue.getStats(),
  });
});

// Endpoint principal para crear manifiesto
app.post(
  "/api/manifiesto",
  limiter,
  validateRequest(createManifiestoRequestSchema),
  async (req, res) => {
    const requestLogger = createLogger({
      component: "ManifiestoEndpoint",
      remesaConsecutivo: req.body.remesa?.consecutivo,
    });

    try {
      const requestData = req.body;

      requestLogger.info("Received manifiesto creation request");

      // Asegurar que el bot esté inicializado
      if (!botInitialized) {
        await initializeBot();
      }

      // Agregar a la cola de tareas
      const result = await taskQueue.add(
        async () => {
          requestLogger.info(" Starting manifiesto creation task");

          // Crear directorio temporal para descarga
          const path = require("path");
          const tempDir = path.join(DOWNLOAD_DIR, "temp");

          // Ejecutar bot con retry logic
          const manifiestoResult = await withRetry(
            async () =>
              await bot.createManifiesto(
                requestData.remesa,
                requestData.manifiesto,
                tempDir
              ),
            {
              maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
              shouldRetry: isRetryableError,
              onRetry: (error, attempt, delay) => {
                requestLogger.warn(
                  { error: error.message, attempt, delay },
                  "Retrying manifiesto creation"
                );
              },
            }
          );

          // Guardar archivo y obtener registro
          const fileRecord = fileManager.saveFile(
            manifiestoResult.filePath,
            `manifiesto_${manifiestoResult.consecutivoManifiesto}.pdf`
          );

          requestLogger.info(
            { fileId: fileRecord.id },
            "File saved successfully"
          );

          return {
            manifiestoResult,
            fileRecord,
          };
        },
        {
          remesaConsecutivo: requestData.remesa?.consecutivo,
        }
      );

      // Construir URL de descarga
      const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
      const downloadUrl = `${baseUrl}/api/download/${result.fileRecord.id}`;

      const response = {
        success: true,
        consecutivoRemesa: result.manifiestoResult.consecutivoRemesa,
        consecutivoManifiesto:
          result.manifiestoResult.consecutivoManifiesto,
        downloadUrl: downloadUrl,
        expiresAt: result.fileRecord.expiresAt,
      };

      requestLogger.info({ downloadUrl }, "Manifiesto created successfully");
      res.json(response);
    } catch (error) {
      requestLogger.error(
        { error: error.message, stack: error.stack },
        "Error creating manifiesto"
      );

      res.status(500).json({
        success: false,
        error: error.message || "Error interno del servidor",
      });
    }
  }
);

// Endpoint para descargar archivo
app.get("/api/download/:fileId", (req, res) => {
  const requestLogger = createLogger({
    component: "DownloadEndpoint",
    fileId: req.params.fileId,
  });

  try {
    const { fileId } = req.params;
    const filePath = fileManager.getDownloadPath(fileId);

    if (!filePath) {
      requestLogger.warn("File not found or expired");
      return res.status(404).json({
        success: false,
        error: "Archivo no encontrado o expirado",
      });
    }

    const fileRecord = fileManager.getFile(fileId);
    if (!fileRecord) {
      requestLogger.warn("File record not found");
      return res.status(404).json({
        success: false,
        error: "Archivo no encontrado",
      });
    }

    requestLogger.info("Serving file download");
    res.download(filePath, fileRecord.filename);
  } catch (error) {
    requestLogger.error(
      { error: error.message },
      "Error downloading file"
    );
    
    res.status(500).json({
      success: false,
      error: "Error al descargar el archivo",
    });
  }
});

// Endpoint para estadísticas de la cola
app.get("/api/queue/stats", (req, res) => {
  res.json({
    success: true,
    stats: taskQueue.getStats(),
  });
});

// Cron job para limpiar archivos expirados (cada hora)
cron.schedule("0 * * * *", () => {
  logger.info("Running file cleanup cron job");
  const deleted = fileManager.cleanExpiredFiles();
  logger.info({ deletedCount: deleted }, "File cleanup completed");
});

// Manejo de cierre graceful
process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  if (bot) {
    await bot.close();
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully");
  if (bot) {
    await bot.close();
  }
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, async () => {
  logger.info({ port: PORT, downloadDir: DOWNLOAD_DIR }, "Server started");

  try {
    await initializeBot();
  } catch (error) {
    logger.warn(
      { error: error.message },
      "Bot not initialized at startup, will try on first request"
    );
  }
});
