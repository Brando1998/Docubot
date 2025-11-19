const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { createLogger } = require("../utils/logger");

class FileManager {
  constructor(downloadsDir = "/downloads") {
    this.downloadsDir = downloadsDir;
    this.recordsFile = path.join(downloadsDir, "records.json");
    this.fileRecords = new Map();
    this.logger = createLogger({ component: "FileManager" });
    this.ensureDownloadsDir();
    this.loadRecords();
  }

  ensureDownloadsDir() {
    if (!fs.existsSync(this.downloadsDir)) {
      fs.mkdirSync(this.downloadsDir, { recursive: true });
      this.logger.info(
        { path: this.downloadsDir },
        "Created downloads directory"
      );
    }
  }

  /**
   * Cargar registros desde el archivo JSON
   */
  loadRecords() {
    try {
      if (fs.existsSync(this.recordsFile)) {
        const data = fs.readFileSync(this.recordsFile, "utf-8");
        const records = JSON.parse(data);

        // Convertir de objeto a Map y parsear fechas
        for (const [id, record] of Object.entries(records)) {
          this.fileRecords.set(id, {
            ...record,
            createdAt: new Date(record.createdAt),
            expiresAt: new Date(record.expiresAt),
          });
        }

        this.logger.info(
          { count: this.fileRecords.size },
          "Loaded file records from disk"
        );
      }
    } catch (error) {
      this.logger.error(
        { error: error.message },
        "Error loading file records"
      );
      // Si hay error, empezar con Map vacío
      this.fileRecords = new Map();
    }
  }

  /**
   * Guardar registros al archivo JSON
   */
  saveRecords() {
    try {
      // Convertir Map a objeto simple para JSON
      const recordsObj = {};
      for (const [id, record] of this.fileRecords.entries()) {
        recordsObj[id] = record;
      }

      fs.writeFileSync(
        this.recordsFile,
        JSON.stringify(recordsObj, null, 2),
        "utf-8"
      );
    } catch (error) {
      this.logger.error(
        { error: error.message },
        "Error saving file records"
      );
    }
  }

  saveFile(sourceFile, originalName) {
    const fileId = uuidv4();
    const filename = `${fileId}_${originalName}`;
    const destinationPath = path.join(this.downloadsDir, filename);

    // Copiar archivo
    fs.copyFileSync(sourceFile, destinationPath);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas

    const record = {
      id: fileId,
      filename,
      path: destinationPath,
      createdAt: now,
      expiresAt,
    };

    this.fileRecords.set(fileId, record);
    this.saveRecords(); // Persistir cambios
    return record;
  }

  getFile(fileId) {
    return this.fileRecords.get(fileId) || null;
  }

  cleanExpiredFiles() {
    let deletedCount = 0;
    const now = new Date();

    // Limpiar archivos expirados del registro
    for (const [id, record] of this.fileRecords.entries()) {
      if (record.expiresAt < now) {
        if (fs.existsSync(record.path)) {
          fs.unlinkSync(record.path);
          deletedCount++;
        }
        this.fileRecords.delete(id);
      }
    }

    // Limpiar archivos huérfanos (sin registro)
    const files = fs.readdirSync(this.downloadsDir);
    for (const file of files) {
      // Saltar el archivo de registros
      if (file === "records.json") {
        continue;
      }

      const filePath = path.join(this.downloadsDir, file);

      // Saltar si es un directorio
      if (fs.statSync(filePath).isDirectory()) {
        continue;
      }

      const stats = fs.statSync(filePath);
      const fileAge = now.getTime() - stats.mtime.getTime();

      // Eliminar archivos mayores de 24 horas
      if (fileAge > 24 * 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    // Persistir cambios en registros
    if (deletedCount > 0) {
      this.saveRecords();
    }

    return deletedCount;
  }

  getDownloadPath(fileId) {
    const record = this.fileRecords.get(fileId);
    if (!record) return null;

    // Verificar si no ha expirado
    if (record.expiresAt < new Date()) {
      this.cleanExpiredFiles();
      return null;
    }

    return record.path;
  }
}

module.exports = { FileManager };
