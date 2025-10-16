FROM rasa/rasa:latest-full

# Cambiar al directorio de trabajo
WORKDIR /app

# Crear directorios necesarios
RUN mkdir -p .rasa models /tmp/cache_db

# Copiar requirements.txt si existe
COPY requirements.txt* ./

# Instalar dependencias adicionales si existen
USER root
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir --default-timeout=100 -r requirements.txt; fi

# Copiar el proyecto Rasa
COPY . .

# Variables de entorno para el build
ENV RASA_HOME=/app/.rasa
ENV SQLALCHEMY_WARN_20=1

# Verificar archivos necesarios
RUN test -f domain.yml || (echo "ERROR: domain.yml not found" && exit 1)
RUN test -f config.yml || (echo "ERROR: config.yml not found" && exit 1)
RUN test -d data || (echo "ERROR: data directory not found" && exit 1)

# ⭐ LIMPIAR MODELOS VIEJOS Y ENTRENAR NUEVO ⭐
RUN echo "🧹 Cleaning old models..." && \
    rm -rf models/* && \
    echo "🤖 Training Rasa model during build..." && \
    rasa train --fixed-model-name current-model && \
    echo "✅ Model training completed!" && \
    echo "📦 Models in directory:" && \
    ls -la models/

# ✅ SOLUCIÓN CRÍTICA: Configurar permisos CORRECTAMENTE
COPY start.sh /app/start.sh

# ⚠️ ORDEN CRÍTICO: Permisos ANTES de cambiar usuario
RUN chmod +x /app/start.sh && \
    chmod 755 /app/start.sh && \
    chown -R 1001:1001 /app && \
    chmod -R 755 /app

# ⚠️ IMPORTANTE: Cambiar a usuario no root DESPUÉS de configurar permisos
USER 1001

# Exponer puerto
EXPOSE 5005

# Health check
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5005 || exit 1

# ✅ USAR ENTRYPOINT con array format para evitar problemas de shell
ENTRYPOINT ["/app/start.sh"]
CMD []