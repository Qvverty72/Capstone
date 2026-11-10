# Validación ejecutada — 10 de noviembre de 2026

Rama experimental: `experiment/playwright-demo`. Origen actualizado con `git fetch origin`; SHA base: `35eb6887dc607f689014c7a9b07aa8a451abfcf4`. El árbol estaba limpio al comenzar. Se creó la rama directamente desde ese commit, sin stash, reset, merge ni modificaciones a `main`/`prerelease`.

## Resultados finales

| Ejecución | Recolectadas | Aprobadas | Fallidas | Omitidas |
| --- | ---: | ---: | ---: | ---: |
| Playwright Chromium | 17 | 15 | 0 | 2 |
| Tests anteriores frontend | 453 | 453 | 0 | 0 |
| Tests anteriores backend | 795 | 793 | 0 | 2 |
| Total de estas suites | 1265 | 1261 | 0 | 4 |

Los dos SKIPPED de Playwright tienen motivos en [`e2e-results.json`](e2e-results.json): falta una cuenta/entorno QA real autorizado y Expo GL nativo requiere dispositivos. Los dos SKIPPED del backend requieren Redis externo (`F22_REDIS_TEST_URL`). No se contabilizan como aprobados. [`regression-results.json`](regression-results.json) conserva los totales extraídos de las salidas de las suites existentes.

También pasaron `node tests/auth-session.qa.mjs` y `node tests/auth-forms.qa.mjs`. Son harnesses previos con React/RNWeb y transportes controlados; sus casos de plataforma Android/iOS simulan configuración y no equivalen a ejecución en dispositivos. El segundo generó 19 screenshots locales. `auth-flow-continuity.qa.mjs` no se volvió a ejecutar: requiere un export separado con su configuración específica; el nuevo E2E cubre la continuidad de sesión sobre Expo Router real.

`npm run typecheck` pasó en frontend y backend. Playwright se instaló como dependencia de desarrollo exacta 1.58.2. Se descargó Chromium 145.0.7632.6 (build Playwright 1208). Se ejecutó Expo Web con inicio/parada automática. `npm ci --dry-run --ignore-scripts --no-audit` confirmó consistencia de `package.json`/lockfile. No se reemplazó ningún test anterior ni se cambió código funcional de la aplicación.

Entorno: Windows, Node 24.19.0, npm 11.17.0. El frontend admite esa versión; el backend prescribe Node 22 y, aunque sus tests pasaron aquí, falta repetirlos bajo Node 22 para certificar ese runtime. No se ejecutaron pruebas en Linux.

## Evidencia audiovisual

`npm run demo:record` completó el recorrido y produjo el MP4. `npm run demo:build` se ejecutó además por separado y volvió a exportarlo correctamente.

- Archivo: [`../../demo/campuslink-demo.mp4`](../../demo/campuslink-demo.mp4).
- Duración: 68,73 segundos; 1280×720; 30 fps; H.264; yuv420p; SAR 1:1; faststart; sin audio.
- Tamaño: 1.213.558 bytes (1,16 MiB).
- La totalidad del archivo se decodificó con FFmpeg sin errores. Chromium pudo cargarlo y reproducir fotogramas: [`media-review.json`](media-review.json) registra el SHA-256 y las dimensiones obtenidas del elemento `<video>`.
- Revisión visual de los segundos 0,5 / 12 / 23 / 34 / 45 / 57 / 65 y de la miniatura. Interfaz real legible, proporciones móviles correctas, sin errores, terminales ni datos personales. Se mantiene el aviso de API simulada.
- Módulos efectivamente incluidos: acceso, perfil, actividades inscritas, mercado (catálogo, modalidad y detalle), biblioteca (búsqueda, detalle y vista previa), cierre Capstone Duoc UC.
- No se incluye el mapa 3D ni la administración. La demo muestra datos sintéticos y no acredita integraciones reales.

Metadatos y tiempos de capítulos: [`../../demo/metadata.json`](../../demo/metadata.json). Los WebM y capturas de revisión permanecen ignorados en `frontendclink/demo/.artifacts/`.

## README y GitHub

Se agregó una sección localizada al README de CampusLink. La miniatura y el MP4 existen en las rutas enlazadas; no se alteró el README académico principal. Se validaron los enlaces relativos de los nuevos documentos.

Se consultó `POST https://api.github.com/markdown` con modo GFM y contexto `Qvverty72/Capstone`, enviando solo un fragmento de miniatura/enlace y un `<video>` relativo. El resultado real está en [`github-markdown.html`](github-markdown.html): el enlace con imagen se conserva y el elemento de video es retirado. No se publicó un README ni se subió un asset. La reproducción pública después de un push o de adjuntar un asset sigue sin verificarse.

## Problemas resueltos y límites

Las primeras ejecuciones detectaron un JWT sintético con firma mal codificada, diferencias entre roles web `link` y `button`, etiquetas de publicación distintas y alertas de validación repetidas en dos ubicaciones. Se corrigieron las fixtures/selectores y expectativas; no se ocultaron errores de aplicación mediante reemplazos de UI. Una recarga de ruta protegida también reveló que el router puede volver al perfil durante la restauración de sesión; se documentó sin alterar producción.

Este sandbox devuelve `uv_os_get_passwd ... ENOMEM` al iniciar tsx. Las ejecuciones autorizadas fuera de esa restricción funcionaron. FFmpeg no estaba en el PATH: se utilizó el binario local de `ffmpeg-static`. El servidor Expo en Windows resolvió `localhost` por IPv6, por lo que la URL de pruebas usa `localhost`.

Pendiente de ambiente QA autorizado: persistencia real, correos/OTP, creación de contenido, moderación ofensiva del servidor desde UI, solicitudes/transacciones, descargas de Storage, administración/analítica y mapa con datos activos. No se hicieron escrituras contra producción ni se cambiaron servicios Render. npm reportó 8 vulnerabilidades de dependencias; su corrección queda fuera de esta implementación y se documenta en la guía.

## Repetir

Desde `frontendclink/`:

```bash
npm ci
npx playwright install chromium
node node_modules/ffmpeg-static/install.js
npm run typecheck
npm run test:unit
npm run test:e2e
npm run qa:evidence
npm run test:e2e:report
npm run demo:record
```

Desde `backendclink/`: `npm run typecheck` y `npm test`, con el runtime Node 22 prescrito. Para las variables y los casos reales, seguir [la guía de QA](../playwright.md). Los resultados describen esta ejecución concreta, no garantizan que una futura repetición obtenga el mismo resultado.
