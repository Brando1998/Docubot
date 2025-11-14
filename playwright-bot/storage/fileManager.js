const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

class FileManager {
  constructor(downloadsDir = "/downloads") {
    this.downloadsDir = downloadsDir;
    this.fileRecords = new Map();
    this.ensureDownloadsDir();
  }

  ensureDownloadsDir() {
    if (!fs.existsSync(this.downloadsDir)) {
      fs.mkdirSync(this.downloadsDir, { recursive: true });
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
