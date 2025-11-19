/**
 * Middleware de validación utilizando schemas de Joi
 */
function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Retorna todos los errores, no solo el primero
      stripUnknown: true, // Remueve campos no definidos en el schema
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        type: detail.type,
      }));

      return res.status(400).json({
        success: false,
        error: "Validación de datos fallida",
        details: errors,
      });
    }

    // Reemplazar req.body con el valor validado y sanitizado
    req.body = value;
    next();
  };
}

module.exports = { validateRequest };
