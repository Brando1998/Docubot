const { chromium } = require("playwright");
const { createLogger } = require("../utils/logger");

class RNDCBot {
  constructor(logger = null) {
    // Validar credenciales
    this.username = process.env.RNDC_USUARIO;
    this.password = process.env.RNDC_CONTRASENA;

    if (!this.username || !this.password) {
      throw new Error(
        "RNDC credentials not configured. Please set RNDC_USUARIO and RNDC_CONTRASENA environment variables."
      );
    }

    this.browser = null;
    this.logger = logger || createLogger({ component: "RNDCBot" });
    
    this.loginUrl =
      process.env.RNDC_LOGIN_URL ||
      "https://rndc.mintransporte.gov.co/MenuPrincipal/tabid/204/language/es-MX/Default.aspx";
    this.remesaUrl =
      "https://rndc.mintransporte.gov.co/programasRNDC/creardocumento/tabid/69/ctl/Remesa/mid/396/procesoid/3/default.aspx";
    this.manifiestoUrl =
      "https://rndc.mintransporte.gov.co/programasRNDC/creardocumento/tabid/69/ctl/ManifiestoSCD/mid/396/procesoid/4/default.aspx";
  }

  async initialize() {
    this.logger.info("Initializing browser");
    
    this.browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    this.logger.info("Browser initialized successfully");
  }

  async close() {
    if (this.browser) {
      this.logger.info("Closing browser");
      await this.browser.close();
      this.browser = null;
    }
  }

  async login(page) {
    this.logger.info("Starting login to RNDC");
    
    await page.goto(this.loginUrl, { 
      waitUntil: "networkidle",
      timeout: 30000 
    });

    // Selectores con IDs reales de DNN (solo el número de control varía)
    const usernameSelector = 'input[id$="FormLogIn_edUsername"]';
    const passwordSelector = 'input[id$="FormLogIn_edPassword"]';
    const submitSelector = 'input[id$="FormLogIn_btIngresar"]';

    await page.fill(usernameSelector, this.username);
    await page.fill(passwordSelector, this.password);

    this.logger.debug("Credentials filled, submitting login form");

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
      page.click(submitSelector),
    ]);

    // Verificar login exitoso
    const url = page.url();
    if (url.includes("Login") || url.includes("login")) {
      this.logger.error({ url }, "Login failed - still on login page");
      throw new Error("Login failed. Please check RNDC credentials.");
    }

    this.logger.info("Login successful");
  }

  async fillRemesa(page, data) {
    this.logger.info("Starting to fill Remesa form");
    
    await page.goto(this.remesaUrl, { 
      waitUntil: "networkidle",
      timeout: 30000 
    });

    // Consecutivo
    this.logger.debug({ consecutivo: data.consecutivo }, "Setting consecutivo");
    await page.fill("#dnn_ctr396_Remesa_CONSECUTIVOREMESA", data.consecutivo);

    // Tipo Operación
    const tipoOp = data.tipoOperacion || "Mercancia Consolidada";
    await page.selectOption("#dnn_ctr396_Remesa_TIPOOPERACIONCARGA", {
      label: tipoOp,
    });

    // Tipo Empaque
    const tipoEmp = data.tipoEmpaque || "Varios";
    await page.selectOption("#dnn_ctr396_Remesa_TIPOEMPAQUE", {
      label: tipoEmp,
    });

    // Descripción Corta
    await page.fill(
      "#dnn_ctr396_Remesa_DESCRIPCIONCORTAPRODUCTO",
      data.descripcionCorta
    );

    // Capítulo y Partida
    const cantidad = data.cantidadEstimada || 10;
    const capitulo = cantidad < 10 ? "Varios" : data.capitulo || "Varios";
    const partida =
      cantidad < 10 ? "Productos varios" : data.partida || "Productos varios";

    await page.selectOption("#dnn_ctr396_Remesa_CAPITULO", { label: capitulo });
    await page.selectOption("#dnn_ctr396_Remesa_PARTIDA", { label: partida });

    // Cantidad estimada
    await page.fill(
      "#dnn_ctr396_Remesa_CANTIDADINFORMACIONCARGA",
      cantidad.toString()
    );

    // PROPIETARIO DE LA CARGA
    const empresaNit = data.empresa?.nit || data.nit;
    if (!empresaNit) {
      throw new Error("NIT de empresa es requerido en data.empresa.nit");
    }

    this.logger.debug({ nit: empresaNit }, "Setting empresa NIT");

    await page.selectOption("#dnn_ctr396_Remesa_TIPOIDPROPIETARIO", {
      label: "Nit",
    });
    
    // Esperar la respuesta AJAX que valida el NIT
    const propietarioResponse = page.waitForResponse(
      (response) => response.url().includes("Remesa") && response.status() === 200,
      { timeout: 10000 }
    );
    
    await page.fill("#dnn_ctr396_Remesa_NUMIDPROPIETARIO", empresaNit);
    await propietarioResponse.catch(() => {}); // No fallar si no hay AJAX
    
    // Esperar que el campo esté habilitado
    await page.waitForLoadState("networkidle");

    // SITIO DE CARGUE (Remitente)
    this.logger.debug("Setting remitente (cargue)");
    
    await page.selectOption("#dnn_ctr396_Remesa_TIPOIDREMITENTE", {
      label: "Nit",
    });
    
    const remitenteResponse = page.waitForResponse(
      (response) => response.url().includes("Remesa") && response.status() === 200,
      { timeout: 10000 }
    );
    
    await page.fill("#dnn_ctr396_Remesa_NUMIDREMITENTE", empresaNit);
    await remitenteResponse.catch(() => {});
    
    // Esperar que el dropdown de sede se cargue
    await page.waitForSelector(
      "#dnn_ctr396_Remesa_SEDEREMITENTELISTA option:not([value=''])",
      { timeout: 10000 }
    );
    
    await page.selectOption(
      "#dnn_ctr396_Remesa_SEDEREMITENTELISTA",
      data.empresa?.sedeCargue || data.sedeCargue
    );

    // SITIO DE DESCARGUE (Destinatario)
    this.logger.debug("Setting destinatario (descargue)");
    
    await page.selectOption("#dnn_ctr396_Remesa_TIPOIDDESTINATARIO", {
      label: "Nit",
    });
    
    const destinatarioResponse = page.waitForResponse(
      (response) => response.url().includes("Remesa") && response.status() === 200,
      { timeout: 10000 }
    );
    
    await page.fill("#dnn_ctr396_Remesa_NUMIDDESTINATARIO", empresaNit);
    await destinatarioResponse.catch(() => {});
    
    // Esperar que el dropdown de sede se cargue
    await page.waitForSelector(
      "#dnn_ctr396_Remesa_SEDEDESTINATARIOLISTA option:not([value=''])",
      { timeout: 10000 }
    );
    
    await page.selectOption(
      "#dnn_ctr396_Remesa_SEDEDESTINATARIOLISTA",
      data.empresa?.sedeDescargue || data.sedeDescargue
    );

    // Tomador de la Póliza
    await page.selectOption("#dnn_ctr396_Remesa_TOMADORPOLIZA", {
      label: "No existe poliza",
    });

    // Cita para el Cargue (fecha y hora actual)
    const horaCargue = data.horaCargue ? new Date(data.horaCargue) : new Date();
    await page.fill(
      "#dnn_ctr396_Remesa_FECHACARGUE",
      this.formatDate(horaCargue)
    );
    await page.fill(
      "#dnn_ctr396_Remesa_HORACARGUE",
      this.formatTime(horaCargue)
    );

    // Cita para el Descargue (mañana)
    const horaDescargue = data.horaDescargue
      ? new Date(data.horaDescargue)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.fill(
      "#dnn_ctr396_Remesa_FECHADESCARGUE",
      this.formatDate(horaDescargue)
    );
    await page.fill(
      "#dnn_ctr396_Remesa_HORADESCARGUE",
      this.formatTime(horaDescargue)
    );

    // Tiempos (formato HH:MM)
    await page.fill(
      "#dnn_ctr396_Remesa_TIEMPOTOTALCARGUE",
      data.tiempoCargue || "1:00"
    );
    await page.fill(
      "#dnn_ctr396_Remesa_TIEMPOTOTALDESCARGUE",
      data.tiempoDescargue || "1:00"
    );

    // Guardar
    await page.click("#dnn_ctr396_Remesa_btnGuardar");

    // Esperar el diálogo con el consecutivo
    await page.waitForSelector("#dnn_ctr396_Remesa_lbIngreso", {
      timeout: 10000,
    });
    const consecutivoRemesa = await page.textContent(
      "#dnn_ctr396_Remesa_lbIngreso"
    );

    if (!consecutivoRemesa || consecutivoRemesa === "0") {
      throw new Error("No se pudo crear la remesa correctamente");
    }

    return consecutivoRemesa.trim();
  }

  async fillManifiesto(page, data) {
    await page.goto(this.manifiestoUrl, { waitUntil: "networkidle" });

    // Consecutivo de remesa
    await page.fill(
      "#dnn_ctr396_ManifiestoSCD_NUMMANIFIESTOCARGA",
      data.consecutivoRemesa
    );

    // Tipo Manifiesto
    const tipoManif = data.tipoManifiesto || "General";
    await page.selectOption("#dnn_ctr396_ManifiestoSCD_TIPOMANIFIESTO", {
      label: tipoManif,
    });

    // Fecha Expedición
    const fechaExp = data.fechaExpedicion
      ? new Date(data.fechaExpedicion)
      : new Date();
    await page.fill(
      "#dnn_ctr396_ManifiestoSCD_FECHAEXPEDICIONMANIFIESTO",
      this.formatDate(fechaExp)
    );

    // Municipio Origen - Con autocomplete
    this.logger.debug("Setting municipio origen with autocomplete");
    const origenInput = "#dnn_ctr396_ManifiestoSCD_ORIGENCARGAMANIFIESTO";
    await page.fill(origenInput, data.municipioOrigen);
    await page.waitForSelector(".ui-autocomplete li.ui-menu-item", {
      state: "visible",
      timeout: 5000,
    });
    await page.click(".ui-autocomplete li.ui-menu-item:first-child");
    // Esperar que el autocomplete se cierre
    await page.waitForSelector(".ui-autocomplete", {
      state: "hidden",
      timeout: 3000,
    }).catch(() => {});

    // Municipio Destino - Con autocomplete
    this.logger.debug("Setting municipio destino with autocomplete");
    const destinoInput = "#dnn_ctr396_ManifiestoSCD_DESTINOCARGAMANIFIESTO";
    await page.fill(destinoInput, data.municipioDestino);
    await page.waitForSelector(".ui-autocomplete li.ui-menu-item", {
      state: "visible",
      timeout: 5000,
    });
    await page.click(".ui-autocomplete li.ui-menu-item:first-child");
    // Esperar que el autocomplete se cierre
    await page.waitForSelector(".ui-autocomplete", {
      state: "hidden",
      timeout: 3000,
    }).catch(() => {});

    // TITULAR MANIFIESTO
    this.logger.debug("Setting titular manifiesto");
    const titularTipo = data.titularTipoId || "Cedula Ciudadania";
    await page.selectOption(
      "#dnn_ctr396_ManifiestoSCD_TIPOIDTITULARMANIFIESTO",
      { label: titularTipo }
    );
    
    const titularResponse = page.waitForResponse(
      (response) => response.url().includes("Manifiesto") && response.status() === 200,
      { timeout: 10000 }
    );
    
    await page.fill(
      "#dnn_ctr396_ManifiestoSCD_NUMIDTITULARMANIFIESTO",
      data.titularNumeroId
    );
    await titularResponse.catch(() => {});
    await page.waitForLoadState("networkidle");

    // Placa Vehículo
    this.logger.debug({ placa: data.placaVehiculo }, "Setting placa vehiculo");
    
    const placaResponse = page.waitForResponse(
      (response) => response.url().includes("Manifiesto") && response.status() === 200,
      { timeout: 10000 }
    );
    
    await page.fill("#dnn_ctr396_ManifiestoSCD_NUMPLACA", data.placaVehiculo);
    await placaResponse.catch(() => {});
    await page.waitForLoadState("networkidle");

    // CONDUCTOR NRO. 1
    this.logger.debug("Setting conductor");
    const conductorTipo = data.conductorTipoId || "Cedula Ciudadania";
    await page.selectOption("#dnn_ctr396_ManifiestoSCD_TIPOIDCONDUCTOR", {
      label: conductorTipo,
    });
    
    const conductorResponse = page.waitForResponse(
      (response) => response.url().includes("Manifiesto") && response.status() === 200,
      { timeout: 10000 }
    );
    
    await page.fill(
      "#dnn_ctr396_ManifiestoSCD_NUMIDCONDUCTOR",
      data.conductorNumeroId
    );
    await conductorResponse.catch(() => {});
    await page.waitForLoadState("networkidle");

    // Valor a pagar
    await page.fill(
      "#dnn_ctr396_ManifiestoSCD_VALORFLETEPACTADOVIAJE",
      data.valorPagar
    );

    // Lugar del Pago - Con autocomplete
    this.logger.debug("Setting lugar de pago with autocomplete");
    const lugarPagoInput = "#dnn_ctr396_ManifiestoSCD_MUNICIPIOPAGOSALDO";
    await page.fill(lugarPagoInput, data.lugarPago);
    await page.waitForSelector(".ui-autocomplete li.ui-menu-item", {
      state: "visible",
      timeout: 5000,
    });
    await page.click(".ui-autocomplete li.ui-menu-item:first-child");
    // Esperar que el autocomplete se cierre
    await page.waitForSelector(".ui-autocomplete", {
      state: "hidden",
      timeout: 3000,
    }).catch(() => {});

    // Fecha del Pago (mañana)
    const fechaPago = data.fechaPago
      ? new Date(data.fechaPago)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    await page.fill(
      "#dnn_ctr396_ManifiestoSCD_FECHAPAGOSALDOMANIFIESTO",
      this.formatDate(fechaPago)
    );

    // Responsable del Pago
    await page.selectOption("#dnn_ctr396_ManifiestoSCD_PAGADORCARGUE", {
      label: "Remitente",
    });
    await page.selectOption("#dnn_ctr396_ManifiestoSCD_PAGADORDESCARGUE", {
      label: "Destinatario",
    });

    // Recomendaciones
    if (data.recomendaciones) {
      await page.fill(
        "#dnn_ctr396_ManifiestoSCD_OBSERVACIONESMANIFIESTO",
        data.recomendaciones
      );
    }

    // Remesa deseada
    const remesaSelector = "#dnn_ctr396_ManifiestoSCD_NUMREMESA";
    await page.fill(remesaSelector, data.consecutivoRemesa);

    // Guardar Manifiesto
    this.logger.info("Saving manifiesto");
    await page.click("#dnn_ctr396_ManifiestoSCD_btnGuardar");
    
    // Esperar el botón de imprimir (indica que se guardó correctamente)
    await page.waitForSelector(
      '#dnn_ctr396_ManifiestoSCD_btnImprimir, a[id*="btnImprimir"]',
      { state: "visible", timeout: 15000 }
    );

    // Obtener consecutivo del manifiesto
    let consecutivoManifiesto = data.consecutivoRemesa;
    try {
      const manifiestoLabel = await page.textContent(
        "#dnn_ctr396_ManifiestoSCD_lblManifiesto"
      );
      if (manifiestoLabel) {
        consecutivoManifiesto = manifiestoLabel.trim();
      }
    } catch (e) {
      // Si no encuentra el label, usa el consecutivo de remesa
      this.logger.warn("Could not find manifiesto label, using remesa consecutivo");
    }

    this.logger.info({ consecutivo: consecutivoManifiesto }, "Manifiesto saved successfully");
    return consecutivoManifiesto;
  }

  async downloadManifiesto(page, downloadPath) {
    const fs = require("fs");

    // Crear directorio si no existe
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    // Configurar descarga
    const downloadPromise = page.waitForEvent("download");

    // Click en imprimir
    await page.click("#dnn_ctr396_ManifiestoSCD_btnImprimir");

    const download = await downloadPromise;
    const filename = `manifiesto_${Date.now()}.pdf`;
    const fullPath = `${downloadPath}/${filename}`;

    await download.saveAs(fullPath);

    return fullPath;
  }

  async createManifiesto(remesaData, manifiestoData, downloadPath) {
    if (!this.browser) {
      throw new Error("Bot no inicializado. Llama a initialize() primero.");
    }

    this.logger.info("Starting createManifiesto process");
    const page = await this.browser.newPage();

    try {
      // 1. Login
      await this.login(page);

      // 2. Crear Remesa
      const consecutivoRemesa = await this.fillRemesa(page, remesaData);
      this.logger.info({ consecutivo: consecutivoRemesa }, "Remesa created");

      // 3. Actualizar consecutivo en datos del manifiesto
      manifiestoData.consecutivoRemesa = consecutivoRemesa;

      // 4. Crear Manifiesto
      const consecutivoManifiesto = await this.fillManifiesto(
        page,
        manifiestoData
      );
      this.logger.info({ consecutivo: consecutivoManifiesto }, "Manifiesto created");

      // 5. Descargar PDF
      const filePath = await this.downloadManifiesto(page, downloadPath);
      this.logger.info({ path: filePath }, "PDF downloaded");

      return {
        consecutivoRemesa,
        consecutivoManifiesto,
        filePath,
      };
    } catch (error) {
      this.logger.error(
        { error: error.message, stack: error.stack },
        "Error creating manifiesto"
      );
      throw error;
    } finally {
      await page.close();
      this.logger.debug("Page closed");
    }
  }

  formatDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
}

module.exports = { RNDCBot };
