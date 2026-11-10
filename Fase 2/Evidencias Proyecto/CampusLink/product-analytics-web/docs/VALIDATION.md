# Validación de la integración

Fecha: 10 de noviembre de 2026. Rama: `feature/product-analytics-integration`, basada en `origin/prerelease` (`35eb688`). Host Windows/PowerShell, Node.js 24.14.1 y npm 11.11.0.

Las comprobaciones se ejecutaron sobre el código de `8fa68c1` más la integración. Antes de entregar se incorporó por rebase `35eb688`, que solo cambia `ANDROID_APK.md` y `RENDER_QA.md`; se comprobó que no hay diferencias en frontend/backend ni build de base. La actualización documental no invalida los resultados funcionales y no requirió repetir esas suites.

## Resultados

| Área | Resultado |
|---|---|
| Portal: `npm run typecheck` | Correcto, TypeScript estricto sin errores. |
| Portal: `npm test` | **29 pruebas correctas**, de métricas, scopes, fechas, proyección v2, autenticación y configuración. |
| Portal: `npm run test:browser` | **18 comprobaciones correctas** con Edge/CDP y API/Supabase ficticios de loopback. |
| Portal: build independiente e incorporado | Correcto. Bundle final aproximado: 527 kB JS, 30 kB CSS antes de compresión. |
| Frontend Expo: typecheck | Correcto. |
| Frontend Expo: suite existente | **452 de 453 correctas**. La prueba DEX Android restante requiere Python, no instalado; se confirmó el mismo límite fuera del sandbox. No se alteró ni omitió la prueba. |
| `frontendclink/npm run build:web` | Correcto: export Expo de 3666 módulos, 38 assets y portal integrado en el mismo dist. |
| Preservación del artefacto Expo | **42 archivos con hashes idénticos** antes/después de incorporar o regenerar el portal. |
| Backend: tipos y compilación | Correctos. No se inició API/worker real. |
| Backend: arquitectura | Correcta, 204 fuentes sin violaciones de capas/ciclos. |
| Backend: suite existente + prueba de lectura | **794 comprobaciones correctas**, combinando suite completa y repetición dirigida del archivo dependiente de frontend; 2 pruebas Redis real opt-in omitidas. Ver informe detallado. |
| YAML de hosting | Parseado y comprobado: backend y referencias prerelease sin cambios; sitio web con raíz/filtros/rutas del portal. |
| Bases reales | Ninguna conexión, migración ni cambio de datos/esquema. Fixtures de base de datos únicamente efímeros en memoria. |

Los resultados backend, comandos, primera incidencia de dependencia ausente y su resolución se conservan en [BACKEND_VALIDATION.md](BACKEND_VALIDATION.md). No se presenta una ejecución inicialmente fallida como si hubiera terminado con código cero.

## Navegador

Las 18 comprobaciones verifican:

1. URL propia protegida; sin sesión no se consulta analítica.
2. Gráficos con un único intervalo conservan puntos SVG visibles y centrados.
3. Login actual, permisos, datos reales por defecto y descarte de cuentas habilitadas como uso.
4. Persistencia de sesión web al recargar en el mismo origen.
5. Filtros reales que construyen parámetros autorizados de institución/campus/carrera/fechas.
6. Respuesta tardía de un campus anterior descartada, incluso simulando un transporte que ignora AbortSignal.
7. Navegación por seis vistas con estados claros para métricas aún no disponibles.
8. CSV real agregado, con fuente y alcance.
9. Error 503: se retiran las cifras anteriores y no se activa demostración.
10. Cambio manual a demostración y CSV separado.
11. Regreso explícito a real y recuperación mediante reintento.
12. Campus que deja de estar disponible: tras 403, Reintentar recarga opciones y recupera otro campus autorizado aunque la identidad/roles no hayan cambiado.
13. Sesión inválida: se retira el panel y se solicita login.
14. Revocación de permisos: desaparecen panel y cifras.
15. Resoluciones de 390 y 1024 px sin desbordamiento horizontal, además de escritorio de 1440 px.
16. Cierre de sesión y recarga sin consultas analíticas.
17. Acceso directo con y sin barra final.
18. Tráfico limitado a mocks de loopback, analítica solo GET y autenticación existente; sin excepciones JavaScript.

También se verifica que un valor privado **ficticio** de control no se incorpore al bundle. Los fixtures no son fuentes reales ni se presentan como datos de producción durante la validación.

## Evidencia local regenerable

En `.qa/`, ignorado por Git:

- `browser-results.json`: comprobaciones y tráfico de QA.
- `integration-login.png`, `integration-real-desktop.png`, `integration-real-mobile.png`: capturas revisadas.
- `integration-dist/`: build con configuración exclusivamente ficticia para el navegador.
- Logs de las suites de regresión cuando corresponda.

Hashes de referencia del artefacto Expo conservado:

```text
index.html: d1306ef8c5e04b394361f7b9910acb0de6b1beecdfc9b6d0b253abeee1af13d4
entry JS:   6951fd66d8ffe71e9618a0dfc7805f8c6c09905df2bcf93c844834feee7fca11
```

## Reproducción

Portal:

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run test:browser
```

La prueba de navegador detecta Edge/Chrome instalado o acepta `CAMPUSLINK_BROWSER_PATH`. No descarga navegadores. Construye con variables ficticias explícitas y servicios de loopback, sin cargar archivos `.env` reales. Requiere permiso para iniciar procesos y acceder a loopback en Windows; cierra sus servidores y navegador al terminar.

Frontend:

```powershell
npm ci --ignore-scripts
npm run typecheck
node --test tests/*.test.mjs
npm run build:web
```

Backend: ver comandos y dependencias de [BACKEND_VALIDATION.md](BACKEND_VALIDATION.md). No ejecutar `npm start`, `npm run dev` ni `src/server.ts` contra credenciales existentes para repetir estas pruebas: el arranque habitual activa workers que pueden escribir.

## Límites pendientes

- **Python ausente:** el único fallo de la suite frontend es `DEX verification accepts preserved obfuscated members and rejects native crash regressions` en `tests/android-release.test.mjs`. El alias WindowsApps responde que Python no está instalado (código 9009). Los otros tres casos del archivo pasan. No se cambió código Android ni su comprobador.
- **Versión de Node:** el backend declara Node `>=22.13 <23`; el host fue Node 24.14.1. Las comprobaciones pasaron en ese host, con aviso EBADENGINE al instalar. La validación en Node 22 del despliegue queda pendiente; no se cambió el requisito del backend.
- **Redis real:** dos pruebas son opt-in y requieren instancia real; se conservaron omitidas para no introducir conexiones externas.
- **Servicios reales:** no se probó una cuenta de producción ni conectividad con datos existentes. La conexión está implementada y se verificó contra el contrato actual y sus servicios simulados. No se hizo despliegue ni merge.
- **Regresiones:** fuentes del frontend/backend existentes y sus lockfiles permanecen intactos. Las suites y hashes aportan evidencia de integración, no una garantía absoluta de ausencia de errores en todo entorno/dispositivo.
- **Privacidad:** la supresión de presentación no sustituye una política de agregación/supresión en servidor. Demografía real y nuevos endpoints permanecen pendientes de autorización.

No se copiaron secretos, no se ejecutaron migraciones ni se alteró información de bases existentes. Las sesiones y cuotas operativas mantienen únicamente el comportamiento ya implementado por CampusLink.
