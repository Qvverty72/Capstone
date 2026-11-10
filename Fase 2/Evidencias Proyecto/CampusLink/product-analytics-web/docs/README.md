# Guía de la integración

## Organización y alcance

El portal proviene del prototipo visual local. La nueva rama es `feature/product-analytics-integration`, basada en `origin/prerelease` (`35eb6887dc607f689014c7a9b07aa8a451abfcf4`). Se creó inicialmente sobre `8fa68c1` y se rebasó al detectar una actualización de documentación de Android/Render; ambos commits tienen idéntico código de frontend/backend y configuración de build previa a esta integración. No se modificó `prerelease` ni su despliegue.

Estructura bajo `Fase 2/Evidencias Proyecto/CampusLink/`:

```text
backendclink/          API existente: autenticación y consultas analíticas
frontendclink/         Aplicación Expo existente y empaquetado web conjunto
product-analytics-web/ Portal React DOM independiente
```

Se mantiene el portal fuera del `tsconfig.json` de Expo, que incluye todos los TS/TSX bajo el frontend. Así no se incorporan componentes DOM a las compilaciones móviles ni se necesita modificar rutas protegidas, layouts, informes o navegación existentes.

La experiencia tiene seis apartados, filtros globales, gráficos SVG, tablas alternativas, metodología, protección de grupos pequeños y exportación CSV. Los datos reales proceden exclusivamente de endpoints ya implementados en el backend. No se crea un backend paralelo ni se trasladan consultas SQL al navegador.

## Acceso, configuración y ejecución

La URL integrada es **`https://<mismo-sitio-campuslink>/analitica-producto/`**; admite acceso directo y fragmentos como `#demand`. La pantalla de login usa las mismas cuentas y el endpoint de autenticación actual. Si ya existe sesión web válida en el mismo origen y proyecto Supabase, se restaura; `/auth/me` comprueba identidad y permisos antes de montar el panel.

El portal requiere la misma configuración pública que el frontend: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, con alternativa `EXPO_PUBLIC_SUPABASE_ANON_KEY`. El build usa una lista permitida de variables y rechaza secretos de servidor. No copia archivos `.env` ni lee credenciales para realizar pruebas.

Desarrollo desde `product-analytics-web/`:

```powershell
npm ci --ignore-scripts
node --env-file=.env scripts/dev.mjs
```

Crear `.env` desde `.env.example` y completar únicamente valores públicos del entorno autorizado. Si ya están en el proceso, `npm run dev`. URL local: **http://127.0.0.1:4318/analitica-producto/**. Puerto alternativo: `npm run dev -- --port=4319`.

`npm run build` y `npm run preview` permiten servir el portal compilado. Si se usa archivo local, construir con `node --env-file=.env scripts/build.mjs`; preview conserva los orígenes públicos de ese build para su CSP. Los cambios de JS/CSS se recompilan al guardar en modo dev; actualizar el navegador para verlos.

Compilación conjunta desde `frontendclink/`, con las variables públicas disponibles en el proceso:

```powershell
npm ci --ignore-scripts
npm run build:web
```

Render ya inyecta las variables públicas declaradas para el sitio. El script ejecuta imágenes POI, export Expo y build aislado del portal dentro del mismo `dist`. Los detalles y motivos de configuración están en [DEPLOYMENT.md](DEPLOYMENT.md).

## Sesión, permisos y fuentes

- Se requiere cuenta activa y rol administrador o usuario autorizado con `ACCEDER_REPORTERIA` vinculado al mismo campus. El backend vuelve a autorizar todos los campus de cada consulta; un enlace o sesión por sí solos no dan acceso a datos.
- El cierre de sesión usa el SDK existente. La sesión móvil no se transfiere al navegador. En desarrollo, un puerto distinto también representa otro origen.
- El modo inicial siempre es **Datos reales**. El período inicial son los últimos 30 días civiles de America/Santiago y el campus autorizado del perfil, o el primero disponible.
- Los catálogos reales solo contienen instituciones, campus y carreras autorizados. Período, campus, carrera y agrupación se envían al backend; edad/género se deshabilitan en modo real porque el contrato actual no los soporta.
- El modo **Demostración** se activa únicamente mediante el selector y conserva su escenario fijo julio–octubre de 2026. No consulta el backend para calcular sus cifras y no se mezcla con resultados reales.
- Los resultados están vinculados a identidad, filtros y fuente; se retiran al cambiar alcance, cerrar sesión o recibir un rechazo. Las solicitudes previas se cancelan y sus respuestas tardías se descartan incluso si el transporte ignora la cancelación.
- La importación manual de JSON del prototipo ya no es la fuente real del portal integrado. `realSnapshot.ts` es ahora el adaptador de respuestas HTTP existentes, con proyección por lista permitida.

## Inventario de archivos nuevos

Todos pertenecen a `product-analytics-web/`, salvo las cuatro integraciones descritas después:

| Archivo | Función |
|---|---|
| `README.md`, `docs/README.md` | Inicio rápido y esta guía |
| `package.json`, `package-lock.json` | Dependencias aisladas: React/DOM, SDK Supabase y tooling |
| `tsconfig.json`, `.gitignore`, `.env.example` | Tipos, artefactos excluidos y variables públicas esperadas |
| `index.html`, `src/main.tsx` | Entrada propia `/analitica-producto/` y montaje de AuthGate |
| `src/App.tsx`, `src/styles.css`, `src/environment.d.ts` | Navegación, fuentes, exportación, metodología y presentación |
| `src/auth/client.ts`, `types.ts`, `AuthGate.tsx`, `auth.css` | Sesión compartida, transporte, permisos, login, logout y estados |
| `src/auth/client.test.mjs` | Reglas de autenticación, configuración y transporte |
| `src/domain/types.ts`, `analytics.ts` | Contratos agregados, cálculos de demostración y supresión |
| `src/data/demo.ts` | Datos exclusivamente ficticios y reproducibles |
| `src/data/liveFilters.ts`, `useLiveAnalytics.ts` | Catálogos, consulta real, fechas y descarte de respuestas antiguas |
| `src/data/realSnapshot.ts` | Proyección validada del contrato de dashboard y análisis v2 |
| `src/components/Icon.tsx`, `UI.tsx`, `Charts.tsx` | Componentes y SVG locales, con alternativa tabular |
| `src/components/PortalFilters.tsx` | Filtros separados para fuente real y demostración |
| `src/components/Sections.tsx`, `RealSections.tsx` | Seis vistas de demostración e indicadores reales disponibles |
| `scripts/build.mjs`, `dev.mjs` | Bundle y servidor estático local con CSP limitada a API/Supabase |
| `scripts/browser-check.mjs`, `tests/integration-mocks.mjs` | QA de navegador con servicios ficticios de loopback |
| `tests/analytics.test.mjs`, `liveFilters.test.mjs`, `realSnapshot.test.mjs` | Reglas métricas, alcance autorizado y contrato v2 |
| `docs/IMPLEMENTATION_STATUS.md`, `DATA_SOURCES.md` | Estado real frente a demostración y fuentes |
| `docs/BACKEND_PROPOSALS.md` | Consultas adicionales aún pendientes de autorización |
| `docs/DEPLOYMENT.md`, `VALIDATION.md`, `BACKEND_VALIDATION.md` | Integración de hosting, evidencia y límites |

## Cambios mínimos fuera del portal

| Archivo | Motivo |
|---|---|
| `frontendclink/package.json` | Añadir únicamente el comando `build:web`; no cambia dependencias. |
| `frontendclink/scripts/build-web.mjs` (nuevo) | Conservar export Expo e incorporar portal en el mismo sitio. |
| `render.yaml` | Raíz de build común del sitio web, filtros por frontend/portal y dos reglas de acceso antes del fallback existente. No cambia rama ni servicio de backend. |
| `backendclink/tests/product-analytics-readonly.test.ts` (nuevo) | Verificar que las consultas analíticas existentes no ejecutan mutaciones SQL/Mongo. |

No se modifican los lockfiles de frontend/backend, sus fuentes, endpoints, autenticación compartida, rutas móviles, esquema ni datos de las bases existentes. La carpeta original del prototipo y el cambio local previo del lockfile del usuario se conservaron en el checkout original; no se incorporaron accidentalmente a esta rama.
