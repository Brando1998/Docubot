require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { RNDCBot } = require("./bot/rndcBot");
const { FileManager } = require("./storage/fileManager");

const app = express();
const PORT = process.env.PORT || 3001;
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || "/downloads";

// Middleware
app.use(cors());
app.use(express.json());

// Instancias
const fileManager = new FileManager(DOWNLOAD_DIR);
const bot = new RNDCBot();

// Estado del bot
let botInitialized = false;

// Inicializar bot
async function initializeBot() {
  if (!botInitialized) {
    try {
      await bot.initialize();
      botInitialized = true;
      console.log("✅ Bot RNDC inicializado correctamente");
    } catch (error) {
      console.error("❌ Error inicializando bot:", error);
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
  });
});

// Endpoint principal para crear manifiesto
app.post("/api/manifiesto", async (req, res) => {
  try {
    const requestData = req.body;

    // Validación básica
    if (!requestData.remesa || !requestData.manifiesto) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos de remesa o manifiesto",
      });
    }

    // Asegurar que el bot esté inicializado
    if (!botInitialized) {
      await initializeBot();
    }

    console.log("🤖 Creando manifiesto...");

    // Crear directorio temporal para descarga
    const path = require("path");
    const tempDir = path.join(DOWNLOAD_DIR, "temp");

    // Ejecutar bot
    const result = await bot.createManifiesto(
      requestData.remesa,
      requestData.manifiesto,
      tempDir
    );

    // Guardar archivo y obtener registro
    const fileRecord = fileManager.saveFile(
      result.filePath,
      `manifiesto_${result.consecutivoManifiesto}.pdf`
    );

    // Construir URL de descarga
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const downloadUrl = `${baseUrl}/api/download/${fileRecord.id}`;

    const response = {
      success: true,
      consecutivoRemesa: result.consecutivoRemesa,
      consecutivoManifiesto: result.consecutivoManifiesto,
      downloadUrl: downloadUrl,
      expiresAt: fileRecord.expiresAt,
    };

    console.log("✅ Manifiesto creado exitosamente");
    res.json(response);
  } catch (error) {
    console.error("❌ Error creando manifiesto:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error interno del servidor",
    });
  }
});

// Endpoint para descargar archivo
app.get("/api/download/:fileId", (req, res) => {
  try {
    const { fileId } = req.params;
    const filePath = fileManager.getDownloadPath(fileId);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: "Archivo no encontrado o expirado",
      });
    }

    const fileRecord = fileManager.getFile(fileId);
    if (!fileRecord) {
      return res.status(404).json({
        success: false,
        error: "Archivo no encontrado",
      });
    }

    res.download(filePath, fileRecord.filename);
  } catch (error) {
    console.error("❌ Error descargando archivo:", error);
    res.status(500).json({
      success: false,
      error: "Error al descargar el archivo",
    });
  }
});

// Cron job para limpiar archivos expirados (cada hora)
cron.schedule("0 * * * *", () => {
  console.log("🧹 Ejecutando limpieza de archivos expirados...");
  const deleted = fileManager.cleanExpiredFiles();
  console.log(`🗑️  ${deleted} archivo(s) eliminado(s)`);
});

// Manejo de cierre graceful
process.on("SIGTERM", async () => {
  console.log("🛑 Cerrando servidor...");
  await bot.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 Cerrando servidor...");
  await bot.close();
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Playwright Bot escuchando en puerto ${PORT}`);
  console.log(`📁 Directorio de descargas: ${DOWNLOAD_DIR}`);

  try {
    await initializeBot();
  } catch (error) {
    console.error(
      "⚠️  El bot no se pudo inicializar al arrancar, se intentará en la primera petición"
    );
  }
});
