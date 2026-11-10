# Validación del backend reutilizado por el portal

Fecha: 10 de noviembre de 2026. Rama de trabajo: `feature/product-analytics-integration`, creada desde `origin/prerelease` (`8fa68c1`).

Antes de entregar, la rama se rebasó sobre `35eb688`, actualización de `prerelease` que solo incorpora documentación Android/Render. El código de backend y frontend de base permanece idéntico; los resultados siguientes conservan su validez y la referencia inicial para trazabilidad.

## Alcance y cambios

El portal reutiliza `GET /api/v1/analytics/options` y `GET /api/v1/analytics/dashboard` de prerelease. No se añadieron endpoints, repositorios, servicios de producción ni migraciones de backend. Las propuestas de funciones analíticas nuevas permanecen sin implementar y requieren autorización explícita posterior.

Se añadió únicamente `backendclink/tests/product-analytics-readonly.test.ts`: ejecuta los servicios existentes de opciones y dashboard con PostgreSQL en memoria (PGlite), transporte `pg` simulado y MongoDB simulado. Una guardia rechaza cada sentencia SQL que contenga escritura/DDL y cada pipeline Mongo con `$out` o `$merge`. La prueba también comprueba que sí se ejecutan las consultas analíticas y que no se accede a instantáneas `public.reporte`.

Las pruebas existentes ya cubren autenticación, permisos de todos los campus solicitados y aislamiento institucional. Se reutilizaron en lugar de duplicar esa batería.

## Resultados

| Comprobación | Resultado |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | Correcto: 320 paquetes; lockfile original conservado. |
| `npm run typecheck` | Correcto, sin errores. |
| `npm run build` | Correcto, sin errores. No inicia la API ni procesos de negocio. |
| `npm run check:architecture` | Correcto: 204 fuentes, imports resueltos, sin ciclos ni infracciones de capas. |
| Pruebas focalizadas | 85 correctas, 0 fallidas, 0 omitidas. |
| Suite completa en serie, primera ejecución | 792 resultados: 789 correctos, 1 archivo sin cargar por dependencia ausente del frontend, 2 omitidos por requerir Redis real opt-in. |
| Repetición dirigida tras instalar dependencias del frontend | `tests/map-campus.test.ts`: 5 pruebas correctas, 0 fallidas. Resuelve el único fallo de carga anterior sin cambios en código. |
| Cobertura completa, combinando ambas ejecuciones | 794 comprobaciones correctas y 2 Redis opt-in omitidas; ningún fallo de aserción pendiente. La primera ejecución completa conservó su código 1 y su log para trazabilidad. |

Pruebas focalizadas ejecutadas:

```powershell
node node_modules/tsx/dist/cli.mjs --test --test-concurrency=1 tests/product-analytics-readonly.test.ts tests/analytics-analysis.test.ts tests/analytics-dashboard.test.ts tests/authorization.test.ts tests/api.test.ts tests/architecture.test.ts tests/readiness.test.ts
```

La batería verifica, entre otros casos:

- Sesión inválida → 401; permiso insuficiente, revocado o de otro campus → 403.
- Autorización de **todos** los campus y de la institución antes de consultar métricas de MongoDB.
- Administrador o usuario autorizado con permiso `ACCEDER_REPORTERIA`; `ACCEDER_ANALITICA` por sí solo no habilita este dashboard existente.
- Filtros y fechas estrictos, límites de intervalos, zona America/Santiago y cortes de horario de verano.
- Personas únicas y conversión observada sin sumar únicos de intervalos o categorías; asociaciones múltiples de carreras/asignaturas.
- Diferencia entre cero observado, períodos futuros no disponibles y fallo de dependencia sanitizado.
- Reportes e informes existentes, exportación y persistencia de instantáneas en fixtures de memoria.
- Lectura analítica sin SQL mutante, sin pipelines Mongo de escritura y sin generación de reportes persistidos desde la consulta del portal.

## Entorno y limitaciones

La primera ejecución completa terminó con código 1 por `tests/map-campus.test.ts`: ese test existente importa `frontendclink/src/three/store/mapDataStore.ts`, que depende de `zustand`. En ese momento solo se habían instalado las dependencias de backend; `frontendclink/node_modules` todavía no existía. El fallo ocurrió antes de ejecutar los cinco casos del archivo y no fue una aserción fallida del backend ni un cambio causado por el portal. Después de instalar las dependencias exactas del frontend, sin alterar su lockfile, se repitió únicamente el archivo afectado: **5/5 pruebas correctas**, código 0. No se modificó el test existente ni el código de mapas.

Las dos pruebas omitidas son `[F2.2-09] real Redis serializes concurrent requests from two clients and shares its TTL` y `[F2.2-09] two HTTP application instances enforce the same Redis quota and an outage denies instead of bypassing it`. Requieren un Redis real habilitado expresamente; no se activaron conexiones externas para esta integración.

- Host: Windows, Node.js **24.14.1**, npm **11.11.0**. El backend declara `node >=22.13 <23`; npm emitió `EBADENGINE`. No se alteró ese requisito. Los resultados en Node 24 no sustituyen una validación adicional con Node 22 antes de desplegar.
- La instalación emitió avisos de dependencias heredadas (`inflight`, `lodash.isequal`, `rimraf`, `glob`, `fstream`). No se actualizaron dependencias ajenas a esta integración.
- `check:architecture` usa APIs experimentales de Node y emite sus avisos habituales (`stripTypeScriptTypes`, VM Modules).
- Dentro del sandbox Windows, `tsx` falló antes de cargar pruebas con `uv_os_get_passwd returned ENOMEM`. La ejecución local autorizada fuera de esa restricción permitió correr la batería con fixtures simulados. Esto es una limitación del entorno, no un fallo del producto.
- No se leyó `.env`, no se cargaron credenciales reales y no se contactaron PostgreSQL, MongoDB o Supabase de producción. Las operaciones de creación/inserción que contienen los tests preparan bases **efímeras en memoria**, nunca instancias existentes.
- No se ejecutó `src/server.ts`, `npm run dev` ni `npm start` del backend: el arranque normal activa workers de notificaciones y recordatorios que pueden escribir. Los tests montan `createApp` con dependencias simuladas.
- La garantía de lectura se refiere a los servicios analíticos SQL/Mongo. La autenticación y las cuotas temporales del rate limiter mantienen su comportamiento previo; no se añadieron escrituras operativas para analítica.
- No se prueba conectividad ni contenido de producción. El portal debe conservar estados de error/no disponible cuando el backend o los permisos no permitan recuperar información, sin cambiar automáticamente a demostración.

## Reproducción y evidencia

Desde `backendclink/`:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run build
npm run check:architecture
node node_modules/tsx/dist/cli.mjs --test --test-concurrency=1 tests/*.test.ts
```

Para la suite completa deben estar instaladas también las dependencias de `frontendclink/`, porque las pruebas existentes de mapas importan su store. La repetición dirigida ejecutada después de esa instalación fue:

```powershell
node node_modules/tsx/dist/cli.mjs --test tests/map-campus.test.ts
```

El log local de la suite se guarda en `product-analytics-web/.qa/backend-suite.log`, excluido de Git. Ninguna configuración de despliegue se modificó para estas comprobaciones.
