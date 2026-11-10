# CampusLink: prerelease y Render QA

Validación realizada el **6 de noviembre de 2026**, zona America/Santiago.
Base: `prerelease` / `82a1469fae88dbd838187e6316bc2ae005d22d11`, inicialmente sin cambios locales.
El commit de entrega se identifica con `git rev-parse prerelease` y en la respuesta de entrega.

**Estado actualizado: despliegue público realizado con @Render el 6 de noviembre de 2026 (America/Santiago).** El frontend ejecuta `10fa5e9c6a2d05720cfc9bd0864a361220f3fee9`; la API incorpora la corrección de arranque publicada en `6480a26cf6c15409207281d8b77a394e9d3cf1b3`, ambos en `prerelease`. La sección siguiente contiene el estado remoto; los resultados locales posteriores corresponden a la preparación previa.

## Despliegue remoto con Render

Workspace confirmado por el propietario: **Brian's workspace**, `tea-dbn71gegekts7398nqp0`. El inventario inicial estaba vacío. Se aprobó el plan generado desde el Blueprint remoto y se conservaron exclusivamente los planes gratuitos previstos. Render añadió el sufijo `mxwt` a los nombres de los tres recursos.

| Recurso | Identificador | URL / configuración |
| --- | --- | --- |
| API Docker Free | `srv-dbn7eglg1s2s73btsam0` | https://campuslink-api-qa-mxwt.onrender.com |
| Web estática | `srv-dbn7efdg1s2s73btsabg` | https://campuslink-web-qa-mxwt.onrender.com |
| Key Value Free | `red-dbn7ef5g1s2s73btsab0` | Oregon, Valkey 8.1.10, `available`, `noeviction`, persistencia `off`, `ipAllowList: []` |
| Blueprint | `exs-dbn7dim1egvs73crc67g` | https://dashboard.render.com/blueprint/exs-dbn7dim1egvs73crc67g |

API y Redis están en Oregon. Las conexiones MongoDB y Supabase/PostgreSQL siguen siendo externas. No se creó Postgres Render, disco, cron ni worker separado. El proceso normal `dist/server.js` inicia los workers incorporados.

Se transfirieron las cinco variables privadas necesarias desde el `.env` local autorizado, sin incorporarlas al repositorio. Se mantuvo PostgreSQL con `sslmode=verify-full` y el certificado incluido en la imagen. El frontend incorpora únicamente la URL de la API y las dos variables públicas de Supabase. CORS permite exactamente el origen HTTPS del frontend.

Ambos servicios informan `repo: https://github.com/Qvverty72/Capstone`, `branch: prerelease`, `autoDeploy: yes` y `autoDeployTrigger: commit`. El Blueprint tiene `autoSync: true`. El push de `6480a26` generó automáticamente el despliegue API `dep-dbn7j5lg1s2s73b18180` con `trigger: new_commit`: el autodeploy backend sí se verificó con un evento real. El frontend conserva su revisión original porque el cambio no afecta a su `rootDir`; su autodeploy está configurado, sin un push adicional en ese directorio.

### Comprobaciones públicas

Realizadas con `curl.exe`, manteniendo la verificación TLS:

| Comprobación | Resultado |
| --- | --- |
| `/api/v1/health` | HTTP **200**, `{"status":"ok"}` |
| `/api/v1/ready` | HTTP **200**, MongoDB, PostgreSQL, Redis y Supabase en `ok` |
| Web `/`, `/login`, `/map`, `/analytics`, `/physicalgoods`, `/elibrary` | HTTP **200**, mismo `index.html`; rewrite SPA operativo |
| CSS y JavaScript referenciados en el HTML | HTTP **200**, tipos MIME correctos |
| CORS desde el frontend | `Access-Control-Allow-Origin` coincide exactamente |
| CORS desde un origen ajeno | Sin `Access-Control-Allow-Origin` |
| Preflight de login desde el frontend | HTTP **204** con origen permitido |
| URL API y configuración pública Supabase en bundle remoto | Presentes y correctas |
| Credenciales privadas locales conocidas y contraseñas de conexiones en bundle | Ninguna coincidencia |
| Ruta API inexistente bajo el middleware de Redis | HTTP **404**, sin fallo de dependencia |
| Prueba final con 20 logins inválidos y `X-Forwarded-For` distinto en cada solicitud | Primeras 15 respuestas **400**; siguientes cinco **429**, sin eludir la cuota |
| Health/readiness tras esa prueba con configuración final | Ambos **200**, cuatro dependencias en `ok`, CORS correcto |

No fue posible la inspección visual: el host de navegador y la conexión nativa de Computer Use no estaban disponibles. Estas comprobaciones HTTP no sustituyen las pruebas funcionales con cuentas autorizadas descritas abajo.

### Incidencias y configuración de proxy

El primer despliegue API, `dep-dbn7egtg1s2s73btsaug`, compiló la imagen pero terminó `update_failed` tras un rechazo Supabase **401 / PGRST303** en una sonda de lectura. Las lecturas directas posteriores con la clave de servidor devolvieron 200 y un nuevo arranque abrió el puerto. El despliegue del mismo commit `dep-dbn7fqe1egvs73crhd4g` quedó `live`; no se cambiaron claves ni se relajó TLS. El rechazo reapareció en `dep-dbn7hnec6qcc73cstm00`. La causa exacta del rechazo del proveedor no quedó confirmada.

Para tolerar fallos transitorios al arrancar se publicó **`6480a26`**: `startApi` hace como máximo tres verificaciones de solo lectura, esperando más que el TTL de caché entre intentos. No abre HTTP hasta que todas las dependencias y módulos están listos; si agota los intentos, cierra las conexiones y falla. Las excepciones de configuración/conexión conservan su fallo seguro. Validación con **Node 22.23.4**: **792 pruebas backend aprobadas, 0 fallos, 0 omitidas**, typecheck, build y arquitectura (204 archivos) correctos. Redis local se detuvo al terminar. La prueba nueva cubre la recuperación tras dos fallos; la prueba de indisponibilidad persistente verifica el máximo de tres intentos y que el puerto no se abre.

El frontend quedó `live` en `dep-dbn7eflg1s2s73btsai0`.

El despliegue API final **`dep-dbn7j5lg1s2s73b18180` quedó `live` a las 22:07 del 6 de noviembre (America/Santiago)**. Se verificaron después los endpoints públicos y la cuota. Los logs posteriores al arranque no mostraron coincidencias con `error`, `failed` o `retrying` en la consulta final. El Blueprint original aún informaba **`syncing`** en la última lectura, aunque ambos despliegues estaban `live`; no se afirma `in_sync`. Se conserva su enlace al Dashboard para revisar la finalización de esa sincronización y no se solicitó un plan simultáneo.

La comprobación real de ingreso encontró que **`TRUST_PROXY_HOPS=1` no es una configuración verificada y segura para este servicio**: al mantener una cabecera `X-Forwarded-For` falsificada se alcanzó HTTP 429, pero cambiarla permitió otra solicitud HTTP 400 de validación. Las solicitudes tenían cuerpo vacío: no crearon cuentas ni enviaron correos. No se publicó ningún endpoint que expusiera direcciones IP.

Se cambió `TRUST_PROXY_HOPS` a **`0`** en Render mediante una actualización que conserva las demás variables. El cambio quedó incluido en el despliegue API de `6480a26`. Este valor ignora las cabeceras reenviadas. **Pendiente de ajuste:** identificar de forma confiable la IP real por cliente; mientras se usa el socket, varios clientes detrás de un mismo proxy pueden compartir cuota. No aumentar el número de saltos por suposición. El Blueprint usa `sync: false` para esta variable y no reemplaza el valor guardado en sincronizaciones posteriores.

La validación CLI no pudo ejecutarse contra la cuenta porque la CLI local no tenía autenticación; la integración OAuth de Render sí generó y aceptó el plan remoto, sin avisos. No se copiaron tokens OAuth a la CLI.

No se aplicaron los índices MongoDB pendientes ni se modificaron roles/grants/RLS. Permanecen pendientes los siete avisos transitivos de Expo, las pruebas funcionales de usuarios y la revisión de Supabase Auth/redirecciones. Las limitaciones de Render Free siguen aplicando.

Entrega de esta sesión: `6480a26` publicado en `prerelease` con los dos archivos de corrección y pruebas. Este informe se actualizó localmente después de verificar el despliegue y queda como único cambio sin commit; no se publicaron secretos ni artefactos QA.

## Cambios

- `/api/v1/health` conserva HTTP 200 y `{ "status": "ok" }`, sin autenticación, consultas externas ni acceso a Redis.
- `/api/v1/ready` funciona también en producción. Lee MongoDB con `ping`, PostgreSQL con `SELECT 1`, Redis con `PING` y Supabase con una lectura limitada de `campus`. Responde 200/503 con `status` y cuatro dependencias, usando solo `ok` / `unavailable`. No devuelve módulos, consultas, causas, conexiones ni excepciones.
- Readiness tiene timeout por dependencia, caché breve para éxitos/fallos y un lote compartido entre solicitudes concurrentes. Una operación que excede el plazo conserva su espacio hasta terminar: solicitudes sucesivas no acumulan operaciones subyacentes abandonadas.
- El arranque verifica esas cuatro dependencias y las siete sondas existentes de módulos antes de abrir HTTP. `SUPABASE_DB_URL` pasa a ser necesario para que readiness esté operativo, también en desarrollo; sin Redis, liveness sigue disponible pero readiness devuelve 503.
- Redis sigue siendo obligatorio en producción y los fallos del limitador devuelven 503. No se añade fallback de memoria en producción. Se acota la cola, se limita la conexión y se habilita reconexión con espera progresiva.
- `TRUST_PROXY_HOPS` es un entero entre 0 y 5, con 0 para desarrollo directo. No se confía en todas las cabeceras. Su valor en Render queda pendiente de verificar en el ingreso real; la prueba de un salto es una simulación, no evidencia del proxy desplegado.
- `CORS_ALLOWED_ORIGINS` admite una lista de orígenes HTTP(S) exactos, sin barra final. En producción los otros orígenes no reciben permiso CORS. Los clientes nativos sin `Origin` siguen funcionando. Desarrollo sin lista conserva el comportamiento previo.
- La imagen Docker usa Node 22 y `NODE_ENV=production`; Compose conserva su override de desarrollo. SIGTERM deja de aceptar HTTP inmediatamente, espera workers y conexiones, y tiene un límite global de 29 segundos frente a la gracia predeterminada de 30 segundos de Render.
- Se actualizaron `body-parser` y `qs`; ExcelJS usa `uuid` 11 compatible con su importación CommonJS de `v4`. Frontend actualiza únicamente dependencias transitivas compatibles de Expo, `deepmerge` y `node-forge`. Se conserva Expo 58.
- `render.yaml` declara backend Docker Free, sitio estático, Key Value Free interno en la misma región, rewrite SPA y autodeploy por commit. No contiene credenciales ni bases Render.
- Scripts de comprobación de dependencias, metadatos de esquema e índices de mapas; su modo predeterminado no escribe datos.

## Resultados reales

| Verificación | Resultado |
| --- | --- |
| Backend `npm ci` con lockfile final y Node 22.23.4 | Correcto |
| Backend `npm run typecheck` | Correcto |
| Backend `npm test`, con `F22_REDIS_TEST_URL` local | **791 aprobadas, 0 fallos, 0 omitidas** |
| `npm run check:architecture` | 204 archivos, sin ciclos ni infracciones |
| Backend `npm run build` | Correcto |
| Frontend `npm ci`, lockfile final | Correcto |
| Frontend `npm run typecheck` | Correcto |
| `node --test tests/*.test.mjs` | **444 aprobadas, 0 fallos, 0 omitidas** |
| `npm run poi:images` | 19 imágenes registradas |
| `npx expo export --platform web` | Correcto; `dist/index.html` presente |
| Variables `EXPO_PUBLIC_*` en bundle | Las tres configuradas están incorporadas |
| Secretos privados conocidos en bundle | Ninguno encontrado |
| Imagen Docker final | `sha256:2999b28cc62cb16e11b4a539fb595041fd233a0e096e48387dffabbf288e8b0f` |
| Runtime Docker | Node 22.23.4, usuario UID 1000, CA Supabase y fuente PDF presentes, `.env` ausente |
| Memoria observada del contenedor | Aproximadamente 107 MiB, con límite de 512 MiB; no es prueba de carga |
| Healthcheck Docker | `healthy` |
| HTTP local en contenedor | Health **200**, readiness **200**, cuatro estados `ok` |
| SIGTERM del bootstrap de solo lectura | Salida 0, sin OOM |
| Fallback SPA local que emula la regla Render | 200 e index.html en `/`, `/login`, `/map`, `/analytics`, `/physicalgoods`, `/elibrary` |
| Blueprint | YAML y JSON Schema oficial 2020-12 válidos; falta validación de conflictos contra el workspace autenticado |
| `npm audit --omit=dev`, backend | 0 vulnerabilidades |
| `npm audit --omit=dev`, frontend | 7 avisos: 5 moderados, 2 altos; detalle abajo |

Se usó `npm.cmd` o el ejecutable de npm mediante Node 22 porque PowerShell bloquea `npm.ps1`; no se cambió la política del sistema. El primer intento de tests dentro del sandbox falló en `uv_os_get_passwd`; fuera del sandbox funcionó. Una repetición backend coincidió con `npm ci` frontend y falló al importar `zustand`: esas pruebas consumen código frontend. Terminada la instalación, la batería completa volvió a pasar. No se desactivaron pruebas.

El contenedor de comprobación ejecutó `startApi`/`stopApi` de la imagen con las conexiones reales, **sin iniciar workers**. Así se probaron bootstrap, HTTP, healthcheck y cierre sin procesar datos existentes. La ejecución completa de `dist/server.js` con workers y su recuperación en Render queda pendiente del deploy y de datos QA autorizados.

## Bases, Redis y esquema

Las comprobaciones reales fueron de solo lectura, desde el host y desde Docker; no demuestran acceso desde Render.

- MongoDB Atlas: conexión SRV operativa, sin opciones de TLS inseguras. Lecturas de los módulos correctas. Índices únicos de series y participación presentes.
- PostgreSQL: conexión operativa mediante **pooler de sesión Supabase**, TLS `verify-full` y CA configurada. Pool compartido máximo 5, timeouts de conexión, consulta y servidor. Las 33 tablas y cinco índices explícitos declarados en las migraciones SQL comprobadas están presentes. Esto no certifica todos los permisos, columnas, funciones o políticas del esquema.
- Supabase Data API: lectura real operativa; sondas de los siete módulos correctas. No equivale a probar login, envío de correo, OTP o escritura en Storage.
- Redis local: instancia Docker aislada, respuesta PONG; cuotas y TTL probados entre dos clientes y dos instancias HTTP. El contenedor Redis local quedó detenido al finalizar la preparación. **Render Key Value ya está disponible y readiness lo verifica desde la API desplegada**, según la sección de despliegue remoto.
- `campus_maps` solo tiene `_id_`: faltan `campus_version_uq` y `one_active_map_per_campus`. El preflight acotado no encontró duplicados. **No se modificaron los índices remotos**. Se preparó `scripts/ensure-map-indexes.mjs`, que evita ejecutar el bootstrap Mongo legado completo.
- El rol SQL existente no es superusuario, pero tiene `BYPASSRLS`. Debe revisarse su alcance antes de considerar mínimos privilegios verificados. No se crearon roles ni se cambiaron grants/RLS.

Comprobaciones reproducibles desde `backendclink/`, con Node 22 y `.env` privado:

```powershell
npm.cmd run build
node scripts/verify-dependencies.mjs
node scripts/verify-schema.mjs
node scripts/ensure-map-indexes.mjs
```

`verify-schema` actualmente termina con código 1 por los índices faltantes; no es una prueba omitida. El propietario puede aplicar la reparación aditiva revisada con:

```powershell
node scripts/ensure-map-indexes.mjs --apply
node scripts/verify-schema.mjs
```

El script comprueba duplicados antes de crear índices; ante duplicados no borra ni corrige registros. Si existe un índice incompatible o faltan permisos, detiene la operación con un error genérico. No ejecutar `001_create_collections.mongosh.js` para resolver este hallazgo.

## Seguridad de dependencias y secretos

El frontend conserva siete avisos en `@expo/cli`, `@expo/fingerprint`, `@expo/metro-config`, `expo`, `glob`, `minimatch` y `zod`. La CLI depende de Zod 3 y la corrección anunciada exige Zod 4; no se forzó un cambio incompatible ni un downgrade de Expo. Las actualizaciones compatibles redujeron los avisos de 11 a 7. Es una revisión pendiente del toolchain, no una auditoría de seguridad completamente limpia.

Se compararon las credenciales privadas locales y las contraseñas de sus URLs contra los 830 archivos inicialmente versionados: sin coincidencias. `.env` no está versionado ni en la imagen; el bundle incluye claves públicas, sin las credenciales privadas conocidas.

Gitleaks inspeccionó el historial de prerelease (161 commits): 16 candidatos. También inspeccionó una copia de los archivos actuales versionables: 15 candidatos. Los actuales corresponden a `poiKey`, `imageKey`, nombres de imágenes y fixtures de actividades; se revisaron sus contextos. El histórico adicional corresponde al README de imágenes anterior. Son falsos positivos de `generic-api-key`, no claves privadas confirmadas. Se conservan informes redactados en `backendclink/qa/local/`, ignorado por Git. No se reescribió historial ni se añadieron exclusiones amplias al detector.

## Workers y Render Free

Los workers existentes ejecutan una tanda al iniciar y programan la siguiente al terminar, sin solapamiento en el proceso. Los eventos pendientes se conservan en MongoDB hasta confirmar entrega. Las inserciones SQL de notificaciones usan una clave única y `ON CONFLICT DO NOTHING`, y los recordatorios usan transacciones/locks para conservar idempotencia. Sus pruebas cubren reintentos, concurrencia de datos, conciliación y detención.

Render Free suspende el servicio tras 15 minutos sin tráfico y su arranque en frío puede demorar alrededor de un minuto. Mientras duerme, no ejecuta workers: los pendientes se reconcilian al despertar, pero no se garantiza la hora exacta ni se reproducen todos los avisos de ocurrencias ya terminadas. El disco es efímero y Key Value Free puede reiniciarse perdiendo contadores. El Blueprint no añade discos, cron, workers pagos ni tráfico artificial de mantenimiento. Respetar los límites gratuitos de horas, transferencia y compilación del workspace. [Límites oficiales](https://render.com/docs/free).

## Procedimiento original de despliegue (referencia)

Estos pasos se conservaron de la preparación local. Para saber qué se ejecutó y qué sigue pendiente, consultar la sección de despliegue remoto al inicio del informe.

1. Abrir una sesión con la integración @Render que exponga sus herramientas. Aunque la instalación figuraba completada, esta sesión no recibió herramientas Render. Alternativa: CLI oficial 2.36.0 descargada y comprobada por SHA-256, disponible localmente:

   ```powershell
   & '.\Fase 2\Evidencias Proyecto\CampusLink\backendclink\qa\local\tools\render\render.exe' login
   & '.\Fase 2\Evidencias Proyecto\CampusLink\backendclink\qa\local\tools\render\render.exe' workspaces -o json
   & '.\Fase 2\Evidencias Proyecto\CampusLink\backendclink\qa\local\tools\render\render.exe' workspace set
   & '.\Fase 2\Evidencias Proyecto\CampusLink\backendclink\qa\local\tools\render\render.exe' blueprints validate '.\render.yaml' -o json
   ```

   La carpeta de herramientas no se versiona. En otra máquina instalar la [CLI oficial](https://render.com/docs/cli). No pegar tokens en el chat ni añadirlos al repo.

2. Inventariar todos los servicios existentes del workspace. Reutilizar los que correspondan a `campuslink-api-qa`, `campuslink-web-qa` y Key Value; adaptar los nombres/región del Blueprint a recursos existentes para evitar duplicados. Backend y Redis deben compartir región. El valor preparado para recursos nuevos es Oregon.
3. Revisar/aplicar los índices de mapas y el alcance del rol SQL. Configurar Atlas con los rangos de salida del servicio Render reales; no usar acceso universal. Conservar TLS verificado y el pooler de sesión existente. [IPs de salida](https://render.com/docs/outbound-ip-addresses), [conexión Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
4. Conectar el proveedor GitHub de Render a `Qvverty72/Capstone`, rama **prerelease**. La opción de repositorio público sin proveedor conectado no cumple autodeploy.
5. Importar/sincronizar el Blueprint usando únicamente planes Free. Sus rutas raíz y comandos están declarados en `render.yaml`. No crear Postgres Render ni servicios de pago. Key Value usa `ipAllowList: []`, `noeviction`, persistencia desactivada y su conexión interna.
6. Configurar de forma privada backend: `MONGODB_URI`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL` (incluyendo TLS/CA); la URL Redis se referencia desde el servicio. Opcionales usados: `MONGODB_DNS_SERVERS`, `DATABASE_TIMEOUT_MS`, `HEALTH_CACHE_TTL_MS` y las cuotas `RATE_LIMIT_*` de `.env.example`. `SUPABASE_JWKS_URL` no se consume en el código inspeccionado.
7. Verificar el número real de saltos del ingreso Render y configurar `TRUST_PROXY_HOPS` con ese número exacto, sin CDN adicional no contemplado. Contrastar clientes y cabeceras falsificadas sin publicar un endpoint que exponga IPs. Configurar `CORS_ALLOWED_ORIGINS` con el origen HTTPS real del frontend.
8. Desplegar backend; comprobar HTTP 200 en `/api/v1/health` y `/api/v1/ready`, respuesta genérica, Redis interno y acceso a las bases **desde Render**. El healthcheck periódico debe usar health. No introducir llamadas que eviten la suspensión.
9. Configurar frontend en tiempo de build: `EXPO_PUBLIC_API_URL` con el origen HTTPS definitivo del backend **sin `/api/v1`**, y las dos variables públicas Supabase. Ninguna clave de servidor bajo `EXPO_PUBLIC_*`. Compilar/exportar y confirmar `dist/index.html`, assets y rewrite `/*` a `/index.html`.
10. Revisar Supabase Auth Site URL, URLs de redirección permitidas, plantillas/OTP y el esquema nativo `campuslink://`. No se cambió la configuración remota de Auth.
11. Confirmar en ambos servicios `Auto-Deploy: On Commit`, repositorio y rama; verificar un despliegue del commit final y las URLs públicas reales. El campo `autoDeployTrigger: commit` del YAML por sí solo no prueba que esté aplicado. [Referencia del Blueprint](https://render.com/docs/blueprint-spec).

## QA pública pendiente

Sin despliegue ni cuentas/datos autorizados de prueba, quedan pendientes registro institucional y normas, OTP, login y persistencia de sesiones, mapa/actividades en navegador, publicaciones físicas/digitales, escrituras Storage, analítica por permisos, reinicio con workers y navegación/recarga pública en rutas internas.

Las pruebas locales de moderación rechazan `actividad para idiotas`, `idi0tas`, mayúsculas, tildes, puntuación intercalada y vocabulario chileno, y permiten corregir el texto y publicar con dependencias de prueba. **No se efectuaron publicaciones ni registros reales para afirmar QA pública.**

## Archivos de entrega

En la raíz: `render.yaml`, `RENDER_QA.md`.

En `Fase 2/Evidencias Proyecto/CampusLink/backendclink/`:

- `.env.example`, `Dockerfile`, `README.md`, `package.json`, `package-lock.json`.
- `src/app.ts`, `src/bootstrap.ts`, `src/config/env.ts`, `src/readiness.ts`, `src/routes/index.ts`, `src/server.ts`.
- `src/database/readiness.ts`, `src/database/redis/rate-limit.redis.ts`, `src/database/supabase/postgres.ts`.
- `src/shared/README.md`, `src/shared/health/readiness.ts`.
- `tests/bootstrap.test.ts`, `tests/postgres.test.ts`, `tests/readiness.test.ts`.
- `scripts/verify-dependencies.mjs`, `scripts/verify-schema.mjs`, `scripts/ensure-map-indexes.mjs`.

En `frontendclink/`: `package-lock.json`.

Los logs, informes redactados, herramientas, dependencias instaladas y builds quedan ignorados por Git. La infraestructura pública ya está desplegada; la aceptación funcional completa y la identificación confiable de clientes detrás del proxy siguen pendientes.
