# Changelog - Baileys-WS Multi-Sesión

## [2.0.0] - 2025-10-13

### 🎉 Nueva Funcionalidad: Soporte para Múltiples Sesiones

#### Características Principales
- ✅ Sistema completo de gestión de múltiples sesiones simultáneas
- ✅ Cada sesión con su propio socket, QR y credenciales independientes
- ✅ Límite configurable de sesiones concurrentes (default: 10)
- ✅ Gestión automática de recursos y limpieza de sesiones inactivas
- ✅ Reconexión automática con backoff exponencial por sesión

#### Nueva API REST

**Gestión de Sesiones:**
- `POST /sessions/:sessionId` - Crear nueva sesión
- `GET /sessions` - Listar todas las sesiones
- `GET /sessions/:sessionId/qr` - Obtener QR de sesión
- `GET /sessions/:sessionId/status` - Estado de sesión
- `POST /sessions/:sessionId/send` - Enviar mensaje
- `POST /sessions/:sessionId/restart` - Reiniciar sesión
- `DELETE /sessions/:sessionId` - Eliminar sesión

#### Archivos Nuevos

```
src/types/session.types.ts       # Tipos TypeScript
src/managers/SessionManager.ts   # Gestor de sesiones
src/index.old.ts                 # Backup versión anterior
README.md                        # Documentación completa
MIGRATION.md                     # Guía de migración
EXAMPLES.md                      # 11 ejemplos prácticos
CHANGELOG.md                     # Este archivo
```

#### Archivos Modificados

- `src/index.ts` - Refactorizado para usar SessionManager
- `src/sessions/auth.ts` - Soporte para sesiones por ID
- `.env.example` - Nuevas variables de configuración

#### Nuevas Variables de Entorno

```env
MAX_SESSIONS=10              # Límite de sesiones simultáneas
MAX_RECONNECT_ATTEMPTS=5     # Reintentos por sesión
SESSION_TIMEOUT=1800000      # Timeout de inactividad (30 min)
CLEANUP_INTERVAL=300000      # Intervalo de limpieza (5 min)
```

#### Estructura de Credenciales

**Antes:**
```
auth/
  ├── creds.json
  └── session-*.json
```

**Después:**
```
auth/
  ├── default/
  │   └── creds.json
  ├── cliente1/
  │   └── creds.json
  └── cliente2/
      └── creds.json
```

#### Migración

```bash
# Opción 1: Mover credenciales existentes
mkdir -p auth/default
mv auth/*.json auth/default/ 2>/dev/null || true

# Opción 2: Empezar desde cero
mv auth auth.backup
```

#### Casos de Uso

1. **Multi-Cliente**: Gestionar WhatsApp para múltiples clientes
2. **Departamentos**: Sesiones por departamento (ventas, soporte, marketing)
3. **Campañas**: Sesiones dedicadas para diferentes campañas
4. **Testing**: Múltiples sesiones de prueba sin afectar producción

#### Mejoras de Rendimiento

- Gestión automática de memoria
- Limpieza de sesiones inactivas
- Aislamiento completo entre sesiones
- Monitoreo con métricas detalladas

#### Documentación

- **README.md**: API completa y configuración
- **MIGRATION.md**: Guía paso a paso para migrar
- **EXAMPLES.md**: 11 ejemplos prácticos con código
- **CHANGELOG.md**: Registro de cambios

---

## [1.0.0] - Versión Anterior

### Características
- Soporte para sesión única
- Endpoints básicos: `/qr`, `/send`, `/restart`
- Autenticación con Baileys
- Reconexión automática básica

---

Para más información:
- [README.md](README.md) - Documentación completa
- [MIGRATION.md](MIGRATION.md) - Guía de migración
- [EXAMPLES.md](EXAMPLES.md) - Ejemplos de uso