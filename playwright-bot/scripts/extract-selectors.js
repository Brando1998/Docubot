const { chromium } = require("playwright");
const { createLogger } = require("../utils/logger");
const fs = require("fs");
const path = require("path");

const logger = createLogger({ component: "SelectorExtractor" });

/**
 * Extrae todas las opciones de los campos select del formulario RNDC
 */
class SelectorExtractor {
  constructor() {
    this.browser = null;
    this.username = process.env.RNDC_USUARIO;
    this.password = process.env.RNDC_CONTRASENA;
    this.loginUrl =
      process.env.RNDC_LOGIN_URL ||
      "https://rndc.mintransporte.gov.co/MenuPrincipal/tabid/204/language/es-MX/Default.aspx";
    this.remesaUrl =
      "https://rndc.mintransporte.gov.co/programasRNDC/creardocumento/tabid/69/ctl/Remesa/mid/396/procesoid/3/default.aspx";
    this.manifiestoUrl =
      "https://rndc.mintransporte.gov.co/programasRNDC/creardocumento/tabid/69/ctl/ManifiestoSCD/mid/396/procesoid/4/default.aspx";
  }

  async initialize() {
    logger.info("Initializing browser for selector extraction");
    this.browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async login(page) {
    logger.info("Logging in to RNDC");
    
    try {
      await page.goto(this.loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      // Esperar a que la página esté completamente cargada
      await page.waitForLoadState("networkidle", { timeout: 30000 });
      
      logger.debug("Login page loaded, looking for form elements");

      // IDs reales de DNN (dnn_ctrXXX varía, pero el sufijo es estable)
      const usernameSelector = 'input[id$="FormLogIn_edUsername"]';
      const passwordSelector = 'input[id$="FormLogIn_edPassword"]';
      const submitSelector = 'input[id$="FormLogIn_btIngresar"]';

      // Intentar encontrar el campo de usuario con timeout más largo
      try {
        await page.waitForSelector(usernameSelector, { 
          state: "visible",
          timeout: 15000 
        });
        logger.debug("Username field found");
      } catch (error) {
        logger.error("Username field not found");
        const url = page.url();
        logger.error({ url }, "Current page URL");
        throw new Error(`Username field not found at ${url}`);
      }

      await page.fill(usernameSelector, this.username);
      await page.fill(passwordSelector, this.password);

      logger.debug("Credentials filled, submitting form");

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 60000 }),
        page.click(submitSelector),
      ]);

      const url = page.url();
      if (url.includes("Login") || url.includes("login")) {
        logger.error({ url }, "Still on login page after submit");
        throw new Error("Login failed - still on login page");
      }

      logger.info("Login successful");
    } catch (error) {
      logger.error({ error: error.message }, "Login process failed");
      throw error;
    }
  }

  /**
   * Extrae opciones de un select específico
   */
  async extractSelectOptions(page, selector) {
    try {
      const options = await page.$$eval(selector + " option", (opts) =>
        opts
          .filter((opt) => opt.value && opt.value !== "")
          .map((opt) => ({
            value: opt.value,
            label: opt.textContent.trim(),
          }))
      );

      logger.debug({ selector, count: options.length }, "Extracted options");
      return options;
    } catch (error) {
      logger.warn({ selector, error: error.message }, "Failed to extract options");
      return [];
    }
  }

  /**
   * Extrae todos los selectores del formulario de Remesa
   */
  async extractRemesaSelectors() {
    const page = await this.browser.newPage();

    try {
      logger.info("Navigating to Remesa form");
      await this.login(page);
      await page.goto(this.remesaUrl, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      const selectors = {};

      // Tipo Operación
      selectors.tipoOperacion = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_Remesa_TIPOOPERACIONCARGA"
      );

      // Tipo Empaque
      selectors.tipoEmpaque = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_Remesa_TIPOEMPAQUE"
      );

      // Capítulo
      selectors.capitulo = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_Remesa_CAPITULO"
      );

      // Partida (depende del capítulo, extraer la lista inicial)
      selectors.partida = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_Remesa_PARTIDA"
      );

      // Tipo ID (mismo para propietario, remitente, destinatario)
      selectors.tipoIdentificacion = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_Remesa_TIPOIDPROPIETARIO"
      );

      // Tomador Póliza
      selectors.tomadorPoliza = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_Remesa_TOMADORPOLIZA"
      );

      logger.info({ fieldCount: Object.keys(selectors).length }, "Remesa selectors extracted");
      return selectors;
    } finally {
      await page.close();
    }
  }

  /**
   * Extrae todos los selectores del formulario de Manifiesto
   */
  async extractManifiestoSelectors() {
    const page = await this.browser.newPage();

    try {
      logger.info("Navigating to Manifiesto form");
      await this.login(page);
      await page.goto(this.manifiestoUrl, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      const selectors = {};

      // Tipo Manifiesto
      selectors.tipoManifiesto = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_ManifiestoSCD_TIPOMANIFIESTO"
      );

      // Tipo ID Titular
      selectors.tipoIdTitular = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_ManifiestoSCD_TIPOIDTITULARMANIFIESTO"
      );

      // Tipo ID Conductor
      selectors.tipoIdConductor = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_ManifiestoSCD_TIPOIDCONDUCTOR"
      );

      // Pagador Cargue
      selectors.pagadorCargue = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_ManifiestoSCD_PAGADORCARGUE"
      );

      // Pagador Descargue
      selectors.pagadorDescargue = await this.extractSelectOptions(
        page,
        "#dnn_ctr396_ManifiestoSCD_PAGADORDESCARGUE"
      );

      logger.info({ fieldCount: Object.keys(selectors).length }, "Manifiesto selectors extracted");
      return selectors;
    } finally {
      await page.close();
    }
  }

  /**
   * Extrae todos los selectores y los guarda en JSON
   */
  async extractAll() {
    try {
      await this.initialize();

      const remesaSelectors = await this.extractRemesaSelectors();
      const manifiestoSelectors = await this.extractManifiestoSelectors();

      const data = {
        lastUpdated: new Date().toISOString(),
        remesa: remesaSelectors,
        manifiesto: manifiestoSelectors,
      };

      // Guardar en archivo
      const dataDir = path.join(__dirname, "../data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const filePath = path.join(dataDir, "rndc-selectors.json");
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

      logger.info({ path: filePath }, "Selectors saved successfully");

      return data;
    } finally {
      await this.close();
    }
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  const extractor = new SelectorExtractor();

  extractor
    .extractAll()
    .then((data) => {
      console.log("✅ Extraction completed successfully");
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Extraction failed:", error.message);
      process.exit(1);
    });
}

module.exports = { SelectorExtractor };
