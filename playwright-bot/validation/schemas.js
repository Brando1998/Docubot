const Joi = require("joi");

/**
 * Schema de validación para datos de Remesa
 */
const remesaSchema = Joi.object({
  consecutivo: Joi.string()
    .required()
    .pattern(/^[A-Z0-9-]+$/)
    .max(50)
    .description("Consecutivo de la remesa"),

  tipoOperacion: Joi.string()
    .valid("Mercancia Consolidada", "Otro")
    .default("Mercancia Consolidada")
    .description("Tipo de operación de carga"),

  tipoEmpaque: Joi.string()
    .valid("Varios", "Cajas", "Bultos", "Pallets")
    .default("Varios")
    .description("Tipo de empaque"),

  descripcionCorta: Joi.string()
    .required()
    .min(5)
    .max(200)
    .description("Descripción corta del producto"),

  capitulo: Joi.string()
    .default("Varios")
    .description("Capítulo arancelario"),

  partida: Joi.string()
    .default("Productos varios")
    .description("Partida arancelaria"),

  cantidadEstimada: Joi.number()
    .integer()
    .min(1)
    .required()
    .description("Cantidad estimada de la carga"),

  empresa: Joi.object({
    nit: Joi.string()
      .required()
      .pattern(/^\d{9,10}$/)
      .description("NIT de la empresa (9-10 dígitos)"),

    sedeCargue: Joi.string()
      .required()
      .description("Código de la sede de cargue"),

    sedeDescargue: Joi.string()
      .required()
      .description("Código de la sede de descargue"),
  })
    .required()
    .description("Información de la empresa"),

  horaCargue: Joi.date()
    .iso()
    .optional()
    .description("Fecha y hora de cargue (ISO 8601)"),

  horaDescargue: Joi.date()
    .iso()
    .optional()
    .min(Joi.ref("horaCargue"))
    .description("Fecha y hora de descargue (ISO 8601), debe ser después del cargue"),

  tiempoCargue: Joi.string()
    .pattern(/^\d{1,2}:\d{2}$/)
    .default("1:00")
    .description("Tiempo de cargue en formato HH:MM"),

  tiempoDescargue: Joi.string()
    .pattern(/^\d{1,2}:\d{2}$/)
    .default("1:00")
    .description("Tiempo de descargue en formato HH:MM"),
});

/**
 * Schema de validación para datos de Manifiesto
 */
const manifiestoSchema = Joi.object({
  consecutivoRemesa: Joi.string()
    .optional()
    .description(
      "Consecutivo de la remesa asociada (se pasa automáticamente al crear)"
    ),

  tipoManifiesto: Joi.string()
    .valid("General", "Individual")
    .default("General")
    .description("Tipo de manifiesto"),

  fechaExpedicion: Joi.date()
    .iso()
    .optional()
    .description("Fecha de expedición del manifiesto (ISO 8601)"),

  municipioOrigen: Joi.string()
    .required()
    .min(3)
    .max(100)
    .description("Municipio de origen (debe existir en RNDC)"),

  municipioDestino: Joi.string()
    .required()
    .min(3)
    .max(100)
    .description("Municipio de destino (debe existir en RNDC)"),

  titularTipoId: Joi.string()
    .valid("Cedula Ciudadania", "Nit", "Cedula Extranjeria")
    .default("Cedula Ciudadania")
    .description("Tipo de identificación del titular del manifiesto"),

  titularNumeroId: Joi.string()
    .required()
    .pattern(/^\d{6,10}$/)
    .description("Número de identificación del titular"),

  placaVehiculo: Joi.string()
    .required()
    .pattern(/^[A-Z]{3}\d{3}$/)
    .uppercase()
    .description("Placa del vehículo (formato: ABC123)"),

  conductorTipoId: Joi.string()
    .valid("Cedula Ciudadania", "Cedula Extranjeria")
    .default("Cedula Ciudadania")
    .description("Tipo de identificación del conductor"),

  conductorNumeroId: Joi.string()
    .required()
    .pattern(/^\d{6,10}$/)
    .description("Número de identificación del conductor"),

  valorPagar: Joi.string()
    .required()
    .pattern(/^\d+$/)
    .description("Valor a pagar (solo números)"),

  lugarPago: Joi.string()
    .required()
    .min(3)
    .max(100)
    .description("Lugar del pago (municipio)"),

  fechaPago: Joi.date()
    .iso()
    .optional()
    .description("Fecha del pago (ISO 8601)"),

  recomendaciones: Joi.string()
    .max(500)
    .optional()
    .description("Recomendaciones u observaciones del manifiesto"),
});

/**
 * Schema para el request completo del endpoint /api/manifiesto
 */
const createManifiestoRequestSchema = Joi.object({
  remesa: remesaSchema.required(),
  manifiesto: manifiestoSchema.required(),
});

module.exports = {
  remesaSchema,
  manifiestoSchema,
  createManifiestoRequestSchema,
};
