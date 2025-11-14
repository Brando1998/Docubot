const { chromium } = require("playwright");

class RNDCBot {
  constructor() {
    this.browser = null;
    this.loginUrl =
      process.env.RNDC_LOGIN_URL ||
      "https://rndc.mintransporte.gov.co/MenuPrincipal/tabid/204/language/es-MX/Default.aspx";
    this.username = process.env.RNDC_USUARIO || "";
    this.password = process.env.RNDC_CONTRASENA || "";
    this.remesaUrl =
      "https://rndc.mintransporte.gov.co/programasRNDC/creardocumento/tabid/69/ctl/Remesa/mid/396/procesoid/3/default.aspx";
    this.manifiestoUrl =
      "https://rndc.mintransporte.gov.co/programasRNDC/creardocumento/tabid/69/ctl/ManifiestoSCD/mid/396/procesoid/4/default.aspx";
  }

  async initialize() {
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
    await page.goto(this.loginUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Selectores múltiples para compatibilidad
    const usernameSelector =
      'input[id*="UserName"], input[name*="UserName"], input[type="text"][id*="Login"]';
    const passwordSelector =
      'input[id*="Password"], input[name*="Password"], input[type="password"][id*="Login"]';
    const submitSelector =
      'input[type="submit"][id*="Login"], input[type="submit"][name*="Login"], button[id*="Login"]';

    await page.fill(usernameSelector, this.username);
    await page.fill(passwordSelector, this.password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
      page.click(submitSelector),
    ]);

    await page.waitForTimeout(2000);
  }

  async fillRemesa(page, data) {
    await page.goto(this.remesaUrl, { waitUntil: "networkidle" });

    // Consecutivo
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

    // PROPIETARIO DE LA CARGA - Tipo: NIT, Número: 8600537463
    await page.selectOption("#dnn_ctr396_Remesa_TIPOIDPROPIETARIO", {
      label: "Nit",
    });
    await page.fill("#dnn_ctr396_Remesa_NUMIDPROPIETARIO", "8600537463");
    await page.waitForTimeout(1500);

    // SITIO DE CARGUE (Remitente) - Tipo: NIT, Número: 8600537463
    await page.selectOption("#dnn_ctr396_Remesa_TIPOIDREMITENTE", {
      label: "Nit",
    });
    await page.fill("#dnn_ctr396_Remesa_NUMIDREMITENTE", "8600537463");
    await page.waitForTimeout(1500);
    await page.selectOption(
      "#dnn_ctr396_Remesa_SEDEREMITENTELISTA",
      data.sedeCargue
    );

    // SITIO DE DESCARGUE (Destinatario) - Tipo: NIT, Número: 8600537463
    await page.selectOption("#dnn_ctr396_Remesa_TIPOIDDESTINATARIO", {
      label: "Nit",
    });
    await page.fill("#dnn_ctr396_Remesa_NUMIDDESTINATARIO", "8600537463");
    await page.waitForTimeout(1500);
    await page.selectOption(
      "#dnn_ctr396_Remesa_SEDEDESTINATARIOLISTA",
      data.sedeDescargue
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
    const origenInput = "#dnn_ctr396_ManifiestoSCD_ORIGENCARGAMANIFIESTO";
    await page.fill(origenInput, data.municipioOrigen);
    await page.waitForSelector(".ui-autocomplete li.ui-menu-item", {
      timeout: 5000,
    });
    await page.click(".ui-autocomplete li.ui-menu-item:first-child");
    await page.waitForTimeout(500);

    // Municipio Destino - Con autocomplete
    const destinoInput = "#dnn_ctr396_ManifiestoSCD_DESTINOCARGAMANIFIESTO";
    await page.fill(destinoInput, data.municipioDestino);
    await page.waitForSelector(".ui-autocomplete li.ui-menu-item", {
      timeout: 5000,
    });
    await page.click(".ui-autocomplete li.ui-menu-item:first-child");
    await page.waitForTimeout(500);

    // TITULAR MANIFIESTO
    const titularTipo = data.titularTipoId || "Cedula Ciudadania";
    await page.selectOption(
      "#dnn_ctr396_ManifiestoSCD_TIPOIDTITULARMANIFIESTO",
      { label: titularTipo }
    );
    await page.fill(
      "#dnn_ctr396_ManifiestoSCD_NUMIDTITULARMANIFIESTO",
      data.titularNumeroId
    );
    await page.waitForTimeout(1000);

    // Placa Vehículo
    await page.fill("#dnn_ctr396_ManifiestoSCD_NUMPLACA", data.placaVehiculo);
    await page.waitForTimeout(1000);

    // CONDUCTOR NRO. 1
    const conductorTipo = data.conductorTipoId || "Cedula Ciudadania";
    await page.selectOption("#dnn_ctr396_ManifiestoSCD_TIPOIDCONDUCTOR", {
      label: conductorTipo,
    });
    await page.fill(
      "#dnn_ctr396_ManifiestoSCD_NUMIDCONDUCTOR",
      data.conductorNumeroId
    );
    await page.waitForTimeout(1000);

    // Valor a pagar
    await page.fill(
      "#dnn_ctr396_ManifiestoSCD_VALORFLETEPACTADOVIAJE",
      data.valorPagar
    );

    // Lugar del Pago - Con autocomplete
    const lugarPagoInput = "#dnn_ctr396_ManifiestoSCD_MUNICIPIOPAGOSALDO";
    await page.fill(lugarPagoInput, data.lugarPago);
    await page.waitForSelector(".ui-autocomplete li.ui-menu-item", {
      timeout: 5000,
    });
    await page.click(".ui-autocomplete li.ui-menu-item:first-child");
    await page.waitForTimeout(500);

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
    await page.click("#dnn_ctr396_ManifiestoSCD_btnGuardar");
    await page.waitForTimeout(3000);

    // Esperar el botón de imprimir
    await page.waitForSelector(
      '#dnn_ctr396_ManifiestoSCD_btnImprimir, a[id*="btnImprimir"]',
      { timeout: 10000 }
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
    }

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

    const page = await this.browser.newPage();

    try {
      // 1. Login
      await this.login(page);

      // 2. Crear Remesa
      const consecutivoRemesa = await this.fillRemesa(page, remesaData);
      console.log(`Remesa creada: ${consecutivoRemesa}`);

      // 3. Actualizar consecutivo en datos del manifiesto
      manifiestoData.consecutivoRemesa = consecutivoRemesa;

      // 4. Crear Manifiesto
      const consecutivoManifiesto = await this.fillManifiesto(
        page,
        manifiestoData
      );
      console.log(`Manifiesto creado: ${consecutivoManifiesto}`);

      // 5. Descargar PDF
      const filePath = await this.downloadManifiesto(page, downloadPath);
      console.log(`PDF descargado: ${filePath}`);

      return {
        consecutivoRemesa,
        consecutivoManifiesto,
        filePath,
      };
    } finally {
      await page.close();
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
