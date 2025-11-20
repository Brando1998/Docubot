# Script de Pruebas - Playwright Bot

Write-Host "🧪 Iniciando pruebas del módulo Playwright Bot`n" -ForegroundColor Cyan

# 1. Health Check
Write-Host "1️⃣ Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET
    Write-Host "✅ Servicio OK" -ForegroundColor Green
    Write-Host "   Bot Inicializado: $($health.botInitialized)" -ForegroundColor Gray
    Write-Host "   Cola - Pendientes: $($health.queueStats.pending), En espera: $($health.queueStats.size)`n" -ForegroundColor Gray
} catch {
    Write-Host "❌ Servicio no disponible: $_`n" -ForegroundColor Red
    exit 1
}

# 2. Queue Stats
Write-Host "2️⃣ Estadísticas de Cola..." -ForegroundColor Yellow
try {
    $queue = Invoke-RestMethod -Uri "http://localhost:3001/api/queue/stats" -Method GET
    Write-Host "✅ Cola consultada" -ForegroundColor Green
    Write-Host "   $($queue | ConvertTo-Json -Depth 3)`n" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $_`n" -ForegroundColor Red
}

# 3. Selectores RNDC
Write-Host "3️⃣ Consultando Selectores RNDC..." -ForegroundColor Yellow
try {
    $selectors = Invoke-RestMethod -Uri "http://localhost:3001/api/selectors" -Method GET -ErrorAction Stop
    Write-Host "✅ Selectores disponibles" -ForegroundColor Green
    Write-Host "   Última actualización: $($selectors.lastUpdated)" -ForegroundColor Gray
    Write-Host "   Campos Remesa: $($selectors.data.remesa.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
    Write-Host "   Campos Manifiesto: $($selectors.data.manifiesto.PSObject.Properties.Name -join ', ')`n" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Selectores no disponibles (ejecuta: docker exec docubot-playwright npm run update-selectors)" -ForegroundColor Yellow
    Write-Host "   Error: $_`n" -ForegroundColor Gray
}

# 4. Test de Validación - Datos Inválidos (debe fallar con 400)
Write-Host "4️⃣ Test de Validación - NIT Inválido (debe fallar)..." -ForegroundColor Yellow
$invalidBody = @{
    remesa = @{
        consecutivo = "TEST001"
        descripcionCorta = "Test"
        cantidadEstimada = 10
        empresa = @{
            nit = "123"  # NIT inválido (debe ser 9-10 dígitos)
            sedeCargue = "SEDE-001"
            sedeDescargue = "SEDE-002"
        }
    }
    manifiesto = @{
        municipioOrigen = "Bogotá"
        municipioDestino = "Medellín"
        titularNumeroId = "1234567890"
        placaVehiculo = "ABC123"
        conductorNumeroId = "9876543210"
        valorPagar = "500000"
        lugarPago = "Medellín"
    }
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/manifiesto" -Method POST -Body $invalidBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "❌ No debería haber pasado la validación`n" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Validación funcionando correctamente (400 Bad Request)" -ForegroundColor Green
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "   Errores detectados:" -ForegroundColor Gray
        foreach ($detail in $errorBody.details) {
            Write-Host "     - Campo: $($detail.field)" -ForegroundColor Gray
            Write-Host "       Mensaje: $($detail.message)`n" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Error inesperado: $_`n" -ForegroundColor Red
    }
}

# 5. Test de Selector Específico
Write-Host "5️⃣ Consultando opciones de Tipo de Operación..." -ForegroundColor Yellow
try {
    $tipoOp = Invoke-RestMethod -Uri "http://localhost:3001/api/selectors/remesa/tipoOperacion" -Method GET
    Write-Host "✅ Opciones obtenidas:" -ForegroundColor Green
    foreach ($opt in $tipoOp.options) {
        Write-Host "   - $($opt.label) (valor: $($opt.value))" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "⚠️  No disponible aún`n" -ForegroundColor Yellow
}

# Resumen
Write-Host "`n📊 Resumen de Pruebas" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Para crear un manifiesto REAL, usa:" -ForegroundColor White
Write-Host "  `$body = Get-Content test-data.json -Raw" -ForegroundColor Gray
Write-Host "  Invoke-RestMethod -Uri http://localhost:3001/api/manifiesto ``" -ForegroundColor Gray
Write-Host "    -Method POST -Body `$body -ContentType 'application/json'" -ForegroundColor Gray
Write-Host ""
Write-Host "Para extraer selectores:" -ForegroundColor White
Write-Host "  docker exec docubot-playwright npm run update-selectors" -ForegroundColor Gray
Write-Host ""
