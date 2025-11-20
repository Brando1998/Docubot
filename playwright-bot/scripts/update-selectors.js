const fs = require("fs");
const path = require("path");
const { SelectorExtractor } = require("./extract-selectors");
const { logger } = require("../utils/logger");

/**
 * Detecta cambios entre dos conjuntos de selectores
 */
function detectChanges(oldData, newData) {
  const changes = [];

  if (!oldData || !oldData.remesa) {
    return [{ type: "initial", message: "Initial selector extraction" }];
  }

  // Comparar remesa
  for (const field in newData.remesa) {
    const oldOptions = oldData.remesa[field] || [];
    const newOptions = newData.remesa[field] || [];

    // Opciones añadidas
    const added = newOptions.filter(
      (newOpt) => !oldOptions.some((oldOpt) => oldOpt.value === newOpt.value)
    );

    // Opciones removidas
    const removed = oldOptions.filter(
      (oldOpt) => !newOptions.some((newOpt) => newOpt.value === oldOpt.value)
    );

    if (added.length > 0) {
      changes.push({
        type: "added",
        form: "remesa",
        field,
        options: added,
      });
    }

    if (removed.length > 0) {
      changes.push({
        type: "removed",
        form: "remesa",
        field,
        options: removed,
      });
    }
  }

  // Comparar manifiesto
  for (const field in newData.manifiesto) {
    const oldOptions = oldData.manifiesto[field] || [];
    const newOptions = newData.manifiesto[field] || [];

    const added = newOptions.filter(
      (newOpt) => !oldOptions.some((oldOpt) => oldOpt.value === newOpt.value)
    );

    const removed = oldOptions.filter(
      (oldOpt) => !newOptions.some((newOpt) => newOpt.value === oldOpt.value)
    );

    if (added.length > 0) {
      changes.push({
        type: "added",
        form: "manifiesto",
        field,
        options: added,
      });
    }

    if (removed.length > 0) {
      changes.push({
        type: "removed",
        form: "manifiesto",
        field,
        options: removed,
      });
    }
  }

  return changes;
}

/**
 * Actualiza los selectores extrayéndolos del sitio RNDC
 */
async function updateSelectors() {
  const updateLogger = logger.child({ job: "selector-update" });

  updateLogger.info("Starting selector update job");

  try {
    // Extraer selectores actuales del sitio
    const extractor = new SelectorExtractor();
    const newSelectors = await extractor.extractAll();

    // Leer archivo actual
    const filePath = path.join(__dirname, "../data/rndc-selectors.json");
    let oldSelectors = {};

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      oldSelectors = JSON.parse(fileContent);
    }

    // Detectar cambios
    const changes = detectChanges(oldSelectors, newSelectors);

    if (changes.length > 0) {
      updateLogger.warn(
        { changeCount: changes.length, changes },
        "Selector options changed!"
      );

      // Aquí podrías enviar una alerta (email, Slack, webhook, etc.)
      // Por ejemplo:
      // await sendAlert({ message: "RNDC selectors changed", changes });
    } else {
      updateLogger.info("No changes detected in selectors");
    }

    // El archivo ya fue guardado por extractAll()
    updateLogger.info("Selectors updated successfully");

    return {
      success: true,
      changes,
      timestamp: newSelectors.lastUpdated,
    };
  } catch (error) {
    updateLogger.error(
      { error: error.message, stack: error.stack },
      "Failed to update selectors"
    );

    throw error;
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  updateSelectors()
    .then((result) => {
      console.log("✅ Update completed");
      console.log(`Changes detected: ${result.changes.length}`);
      if (result.changes.length > 0) {
        console.log(JSON.stringify(result.changes, null, 2));
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Update failed:", error.message);
      process.exit(1);
    });
}

module.exports = { updateSelectors, detectChanges };
