# QA funcional de CampusLink con Playwright

La suite ejecuta Chromium sobre **la aplicación completa de Expo Router**. Complementa los tests de `frontendclink/tests/` y `backendclink/tests/`, que se conservan sin cambios. El escenario audiovisual de `frontendclink/demo/` es independiente del runner de tests.

## Base e inventario

Rama: `experiment/playwright-demo`. Base obtenida con `git fetch origin`: `35eb6887dc607f689014c7a9b07aa8a451abfcf4` de `origin/prerelease`. No se cambiaron despliegues ni las ramas `main`/`prerelease`.

[`routes.json`](routes.json) se descubre del árbol real `app/` mediante `npm run qa:inventory`. Hay 15 rutas de pantalla; los grupos y `_layout.tsx` no crean URLs propias. La pantalla inicial `/` redirige a `/login` o `/profile`. Las actividades se consultan desde `/personal?section=activities` y desde el mapa: no existe una ruta `/activities` independiente.

| Rutas y flujo | Cobertura E2E implementada | Dependencia real / límite |
| --- | --- | --- |
| `/`, `/login` | Campos, enlaces, credenciales inválidas, sesión, recarga, logout, cuenta suspendida; `@mock` | Login real requiere backend, Supabase y cuenta QA |
| `/recover`, `/register` | Enlace a recuperación; formularios detallados cubiertos además por QA anterior | Envío de correos/OTP real sin ejecutar |
| `/profile`, `/personal` | Perfil y actividades inscritas; navegación real | `/auth/me`, perfil PostgreSQL y actividades MongoDB se simulan |
| `/notifications` | Estado vacío | Entrega y mutación de avisos reales pendientes |
| `/physicalgoods` | Catálogo, búsqueda, modalidad donación, detalle, vacío, error/reintento y bloqueo de formulario sin foto | Backend/PostgreSQL/Storage para publicaciones, solicitudes y acuerdos reales |
| `/elibrary` | Catálogo, búsqueda, detalle, vista previa, selección de PDF, campos requeridos y rechazo de símbolos | PDF y vista previa de catálogo sintéticos; no hay carga ni descarga de Storage real |
| `/map` | Error de servicio y reintento con respuesta 503 explícita | El GLB y viewport WebGL2 existen. No hay mapa QA MongoDB validado; no se certifica el render 3D en esta ejecución |
| `/access`, `/audit`, `/reports`, `/analytics`, `/history` | Rutas administrativas protegidas; menú ausente para estudiante | Vistas privilegiadas, exportación y moderación ofensiva del servidor pendientes de QA autorizado |
| Expo GL, cámara/galería, compartir y teclado nativos | `SKIPPED @native` | Chromium no ejecuta Android/iOS; el selector de PDF web sí se ejercita |

La validación local de texto permite caracteres españoles y rechaza símbolos; la moderación de groserías se implementa en el **backend**. La suite de navegador no simula un rechazo del backend para afirmar que esa moderación real pasó. Las pruebas unitarias anteriores cubren esos contratos.

Los tests anteriores incluyen render de React/RNWeb, hooks con transportes controlados, contratos de sesión, recursos, moderación y pruebas del backend con fixtures y PGlite. Playwright añade recorridos por el router, interacción DOM, sesión del SDK y estados visibles. No sustituye pruebas de bases externas.

## Instalación (desde frontendclink)

```powershell
cd 'Fase 2/Evidencias Proyecto/CampusLink/frontendclink'
npm.cmd ci
npx.cmd playwright install chromium
node node_modules/ffmpeg-static/install.js
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:e2e
npm.cmd run qa:evidence
npm.cmd run test:e2e:report
```

En Bash/Linux se usan los mismos comandos como `npm`/`npx`; para las bibliotecas de Chromium, `npx playwright install --with-deps chromium` cuando el sistema lo permita. El frontend admite Node `^22.13.0 || ^24.3.0 || >=26.0.0`. Esta ejecución se validó en Windows con Node 24.19.0 y npm 11.17.0. Linux queda preparado, sin ejecución en esta máquina. En PowerShell, `.cmd` evita modificar la política de ejecución de scripts.

`ffmpeg-static` fija un binario **local**; no se versiona. Algunas configuraciones de npm omiten scripts de instalación: el comando `node node_modules/ffmpeg-static/install.js` descarga el binario si falta. Alternativa: definir `FFMPEG_PATH` con un FFmpeg del sistema que incluya `libx264`.

## Modos y variables

El modo por defecto es `@mock`: `qa/web.ts` inicia Expo en `http://localhost:8088`, con `EXPO_NO_DOTENV=1` y valores públicos sintéticos explícitos. No utiliza el `.env` privado del proyecto. API ficticia: `127.0.0.1:4010`; Supabase ficticio: `127.0.0.1:54321`. **No es necesario iniciar esos servicios.** `context.route()` responde dentro del navegador y bloquea solicitudes externas desconocidas. Una ruta no implementada hace fallar la fixture. Las credenciales y JWT en `e2e/fixtures/data.ts` son deliberadamente sintéticos, sin validez ante servidor alguno.

Cada test tiene un contexto limpio; las fixtures se reinician por caso. Los helpers usan el formulario real para iniciar sesión. Se usan roles y etiquetas accesibles existentes; no fue necesario cambiar componentes de producción ni añadir testID.

Para un servidor web que ya administras, establecer `E2E_BASE_URL`. En modo mock ese servidor debe haberse compilado con los mismos valores sintéticos de `qa/environment.ts`; de lo contrario la fixture bloqueará sus peticiones. Se evita reutilizar un servidor local automáticamente para no confundir builds o variables.

```powershell
$env:E2E_BASE_URL='http://localhost:8088'
npm.cmd run test:e2e
Remove-Item Env:E2E_BASE_URL
```

Ejemplo de variables, sin secretos: [`.env.e2e.example`](../../frontendclink/.env.e2e.example). No se carga automáticamente: definirlas en el proceso que ejecuta npm.

## Backend QA real (opcional y separado)

1. Crear una instancia QA independiente. Usar el `.env.example` y el [README del backend](../../backendclink/README.md) para PostgreSQL/Supabase, MongoDB y Redis. Aplicar las migraciones del repositorio exclusivamente sobre QA y preparar campus/cuenta institucional activa. No usar cuentas personales.
2. El backend prescribe Node `>=22.13 <23`. Instalar allí con `npm ci`; ejecutar `npm run typecheck`, `npm test` y `npm run dev`, o su Docker Compose. No modificar Render ni reutilizar producción.
3. Iniciar otro proceso Expo con las variables **QA** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` y una clave pública `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o ANON). Ninguna clave secret/service_role puede incorporarse al cliente.
4. Ejecutar la suite `@real` en otro terminal. La autorización explícita y URL son obligatorias; el proceso falla antes de navegar si faltan. La contraseña debe suministrarse por un mecanismo local privado; no escribirla en archivos versionados ni en capturas.

```powershell
$env:E2E_MODE='real'
$env:E2E_BASE_URL='http://localhost:8081'
$env:E2E_QA_AUTHORIZED='1'
# Definir E2E_QA_EMAIL y E2E_QA_PASSWORD con credenciales QA privadas.
npm.cmd run test:e2e -- --grep '@real'
```

En Bash: `E2E_MODE=real E2E_BASE_URL=http://localhost:8081 E2E_QA_AUTHORIZED=1 npm run test:e2e -- --grep @real`, con credenciales exportadas de forma privada previamente. Retirar las variables al terminar. El test real inicia sesión, recarga y cierra sesión; no publica contenido. Login/logout pueden registrar auditoría de la cuenta QA. Capturas, videos y trazas se desactivan para ese caso porque pueden contener datos de sesión.

Sin credenciales QA, el caso real aparece **SKIPPED**, nunca PASS. En esta entrega no se ejecutó una integración E2E real con Supabase/PostgreSQL/MongoDB/Redis.

## Reportes y comandos

| Comando | Resultado |
| --- | --- |
| `npm run test:e2e` | Suite Chromium; inicia/detiene Expo si no hay URL externa |
| `npm run test:e2e:ui` | Runner interactivo |
| `npm run test:e2e:report` | Reporte HTML en `playwright-report/` |
| `npm run qa:inventory` | Inventario reproducible de rutas y suites anteriores |
| `npm run qa:evidence` | Resumen de la última ejecución en `docs/qa/results/e2e-results.json` |
| `npm run demo:record` | Captura, composición, conversión, validación y miniatura |
| `npm run demo:build` | Reexporta el WebM local de la última captura |

Resultados versionables: [`results/e2e-results.json`](results/e2e-results.json) y [`results/validation.md`](results/validation.md). El reporte HTML y el JSON bruto en `test-results/results.json` permanecen locales. En fallos mock se conservan screenshot, video y traza. Abrir con `npx playwright show-trace test-results/<caso>/trace.zip`. Los artefactos y sesiones privadas están en `.gitignore`. No hay Actions ni servicios de pago.

## Diagnóstico y límites de Expo Web

- Puerto 8088 ocupado: detener el servidor propio o indicar URL externa. No se matan servidores ajenos.
- `uv_os_get_passwd ... ENOMEM` en este entorno administrado: fue una restricción al iniciar tsx dentro del sandbox, no una falta real de RAM; la ejecución autorizada fuera de él funcionó. Chromium y Expo necesitan permiso para abrir procesos/puertos.
- En Windows `--localhost` puede resolver a IPv6. Usar `localhost:8088`, como la configuración, en lugar de forzar `127.0.0.1:8088`.
- Primer bundle: el servidor dispone de hasta 180 s para iniciar. Los tests esperan elementos, respuestas o cambios de estado, sin pausas fijas. La demo sí tiene pausas deliberadas para lectura audiovisual.
- En una recarga de ruta protegida, `Stack.Protected` puede retirar esa ruta mientras restaura la identidad y volver al perfil. La continuidad de **sesión** se comprueba; la restauración de cada deep link no se certifica y no se corrigió en esta rama.
- Mapa: existe implementación `.web.tsx` con detección WebGL2 y recuperación. Sin datos activos QA, comprobar un error/reintento no equivale a aprobar el render 3D ni los controles de pisos.
- Foto/archivo/compartir: las APIs nativas difieren de sus implementaciones web. El PDF seleccionado en E2E es un pequeño buffer de transporte para validar el formulario; no se presenta como PDF analizado y aceptado por el servidor.
- npm informó 8 vulnerabilidades (1 baja, 5 moderadas, 2 altas). No se ejecutó `audit fix --force` ni se actualizaron dependencias funcionales fuera del alcance; revisar antes de adoptar la rama.

Referencias: [servidor de Playwright](https://playwright.dev/docs/test-webserver), [fixtures](https://playwright.dev/docs/test-fixtures) y [videos](https://playwright.dev/docs/videos).
