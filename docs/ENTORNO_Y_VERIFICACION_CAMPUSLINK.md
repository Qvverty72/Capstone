# Entorno y verificación de CampusLink

Revisión local: **8 de noviembre de 2026**, rama `JP_comments`.
Ruta de la aplicación: `Fase 2/Evidencias Proyecto/CampusLink/`.
Este documento explica la configuración existente; no la reemplaza.

## Entorno observado

Se utilizó Windows con PowerShell, Node **24.21.0**, npm **11.19.0** y Docker
CLI **29.8.1**. El backend declara `>=22.13 <23`, por lo que npm mostró
`EBADENGINE`; ejecutar correctamente con Node 24 no certifica Node 22.
El frontend admite esta rama de Node y usa Expo SDK 58.

Los dos proyectos tienen sus propios `package-lock.json`. Se instaló con
`npm ci --no-audit --no-fund`; no se cambiaron manifiestos ni locks. La instalación
offline inicial no pudo completarse por paquetes ausentes en caché. La instalación
con acceso al registro sí terminó. npm avisó de dependencias transitivas obsoletas
y del postinstall de esbuild no aprobado en su política `allowScripts`; los comandos
de compilación y pruebas pudieron ejecutarse con los binarios instalados.
No se ejecutó una auditoría de vulnerabilidades ni se deducen CVE de esos avisos.

## Qué significa cada familia de variables

No se consultaron ni modificaron archivos `.env`. La siguiente tabla proviene de
`backendclink/src/config/env.ts` y de los clientes frontend, sin valores privados.

| Variables | Responsabilidad real |
| --- | --- |
| `MONGODB_URI`, `MONGODB_DB_NAME` | Acceso y selección de base documental; el nombre tiene un valor por defecto en código. |
| `MONGODB_DNS_SERVERS` | Resolutores opcionales para este proceso; valida direcciones IP. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Origen Supabase y clave pública usados por SDK/Auth. |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Credencial exclusiva del servidor para operaciones técnicas; la primera tiene prioridad. |
| `SUPABASE_DB_URL` | Pool SQL `pg`; conexiones remotas verifican TLS. El parser la permite ausente, pero las sondas actuales de arranque requieren PostgreSQL. |
| `RATE_LIMIT_REDIS_URL` | Contadores distribuidos; obligatoria en producción. Existe una inconsistencia con el modo local que se detalla abajo. |
| `RATE_LIMIT_*` | Tamaño de ventana y cuotas de autenticación, lectura, escritura y origen. Se validan como enteros acotados. |
| `DATABASE_TIMEOUT_MS`, `HEALTH_CACHE_TTL_MS` | Esperas máximas de dependencia y caché de disponibilidad. |
| `NODE_ENV`, `PORT` | Modo y puerto de la API, con validación de valores admitidos. |
| `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY_HOPS` | Orígenes web admitidos y cantidad de proxies confiables para calcular la IP. CORS no concede permisos de negocio. |
| `HEALTH_DIAGNOSTICS_ENABLED` | Opt-in de diagnóstico que solo tiene efecto en desarrollo. |
| `EXPO_PUBLIC_API_URL` | Dirección de la API incluida en el bundle; debe ser accesible desde el dispositivo. |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Configuración pública del SDK Expo. Se conserva compatibilidad con `EXPO_PUBLIC_SUPABASE_ANON_KEY`. |

Toda variable `EXPO_PUBLIC_*` se distribuye al cliente. `supabaseClient.ts` rechaza
claves secretas y claves JWT legacy cuyo rol no sea `anon`. Las credenciales del
servidor no deben copiarse a ese espacio público.

## Dockerfile y Compose existentes

El Dockerfile usa dos etapas `node:22-alpine`: instala dependencias con lock,
compila TypeScript y copia `dist` al runtime. La segunda etapa instala solo
dependencias de producción, copia certificados de Supabase y ejecuta como `node`.
El healthcheck consulta `/api/v1/health`: mide vida HTTP; el arranque verifica
disponibilidad y `/api/v1/ready` informa el estado de las cuatro dependencias.

Compose levanta **API y Redis**. MongoDB y Supabase/PostgreSQL son dependencias
externas; no se aprovisionan con este Compose. Redis no publica puerto, tiene
healthcheck y almacena contadores temporales sin persistencia AOF/snapshot.
El servicio backend fuerza `NODE_ENV=development`, aunque el runtime de la imagen
define producción por defecto: este Compose es de desarrollo, no una receta
completa de producción. `HOST_PORT` controla la publicación del puerto.

Las etiquetas de imágenes son flotantes. El lock reduce variación de paquetes,
pero no fija un digest de imagen ni configura los servicios externos. El inicio
también depende de migraciones y permisos aplicados en esos proveedores.
Nada de ello se aplicó durante esta tarea.

## Inconsistencia reproducida: Redis opcional en desarrollo

1. `loadEnv` permite omitir la URL Redis fuera de producción.
2. `createRateLimits` elige `MemoryRateLimitStore` cuando falta esa URL.
3. `connectRateLimitRedis` termina sin conectar si no hay URL.
4. `database/readiness.ts` siempre instala `probeRateLimitRedis`.
5. La sonda rechaza al no existir cliente listo; el arranque exige todas las sondas.

Se reprodujeron los pasos 3–5 invocando las funciones del build en un proceso de
prueba con entorno sintético: conectar sin URL resolvió y la sonda rechazó.
No se abrieron conexiones externas. Por inspección de `startApi` y su agregador,
ese resultado impide completar el arranque predeterminado con Redis omitido,
aunque las cuotas HTTP tengan implementación local. No se ejecutó el arranque
integral con bases reales ni se corrigió esta política durante la documentación.
Conviene decidir explícitamente si desarrollo debe aceptar memoria o exigir Redis
y hacer concordar configuración, readiness, pruebas y guía de instalación.

## Repetir las verificaciones locales

Desde `backendclink/`:

```powershell
npm ci --no-audit --no-fund
npm run typecheck
npm run build
npm test
npm run check:architecture
node --test qa/tests/fixtures.test.mjs
docker compose config --no-env-resolution --no-interpolate --quiet
```

Desde `frontendclink/`:

```powershell
npm ci --no-audit --no-fund
npm run typecheck
node --test tests/*.test.mjs
npx --no-install expo export --platform web --output-dir <directorio-temporal>
```

El frontend no declara script `test`; por eso se invoca directamente `node --test`.
En el sandbox inicial el runner falló con `spawn EPERM` antes de ejecutar casos.
Al permitir subprocesos locales, las suites completas pasaron. Las pruebas SQL usan
PGlite aislado y los tests HTTP usan servidores locales/dobles; eso no comprueba la
configuración real del proyecto Supabase ni un clúster MongoDB de despliegue.

La validación Compose anterior solo comprueba su estructura: deliberadamente no
resuelve `.env` ni su interpolación. Docker Desktop no tenía disponible el pipe del
motor Linux, por lo que no se construyó ni inició una imagen. No se ejecutaron
migraciones, seeds, despliegues, push, merge ni operaciones sobre bases externas.

Los resultados completos, límites de evidencia y pendientes están en
[`REVISION_TECNICA_CAMPUSLINK.md`](REVISION_TECNICA_CAMPUSLINK.md).
