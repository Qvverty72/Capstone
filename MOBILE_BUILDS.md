# CampusLink: Android, iPhone y web móvil

Versión entregada: **0.1.2**. Código publicado en `prerelease` y conservado en
la rama de trabajo `build/mobile-cross-platform`.
Dispositivo iPhone disponible comunicado por el usuario: **iPhone 17, iOS 26.3**.

## Compatibilidad objetivo

- Android: Android 7.0/API 24 o posterior. APK universal con ARM de 32/64 bits
  y x86/x86_64; firma de actualización igual a la APK 0.1.1.
- iPhone/iPad: iOS 16.4 o posterior y arm64. `ExpoModulesCore` y `ExpoGL`
  instalados exigen iOS 16.4. Un mínimo inferior requiere cambiar dependencias.
- Web móvil: navegador con las funciones necesarias; el mapa 3D requiere WebGL.
  Se revisarán Chromium y WebKit con pantallas pequeñas, grandes y horizontales.

Estos mínimos no certifican todos los modelos. Las pruebas automatizadas y de
simulador no sustituyen la validación física, especialmente del mapa y la GPU.
El usuario confirmó que el mapa de la APK 0.1.1 se muestra en Android 14.

## Builds gratuitas desde Windows

El workflow manual `Mobile builds` permite elegir `android`, `ios` o `all`.
Los runners son estándar; el repositorio es público. Los artefactos se retienen
un día para limitar almacenamiento. No se configura ningún runner de pago.

Android se genera sin firma en CI; se firma localmente con la clave existente.
El verificador del DEX exige que R8 conserve el constructor de `GLView` y el
método `GLContext.flush()` que necesita el código nativo.

iOS se compila en el Mac de GitHub como **IPA de dispositivo sin firmar**,
con el JavaScript y assets incorporados. No es una build de simulador ni una
entrega de TestFlight. No se envían cuentas, claves ni contraseñas de Apple a CI.
La prueba de simulador se compila por separado.

Para instalar la IPA gratuitamente en un iPhone desde Windows:

1. Descargar Sideloadly desde <https://sideloadly.io/> y sus requisitos oficiales.
2. Conectar el iPhone al PC por USB y aceptar la conexión de confianza.
3. Abrir la IPA en Sideloadly y usar la cuenta Apple gratuita del propietario.
   La contraseña se introduce en la aplicación local, no en el chat ni GitHub.
4. Completar la confianza del perfil y activar el modo desarrollador si iOS
   lo solicita. Probar inicio, sesión, mapa, archivos y navegación.
5. Renovar la firma desde el PC antes de siete días. La cuenta gratuita limita
   las apps instaladas por esta vía; no permite distribución normal por App Store.

Fuente de los límites e instalación: <https://sideloadly.io/faq>.

Drive sirve para descargar los archivos; una IPA sin firmar no se instala
directamente al abrir el enlace en Safari.

## Alcance de las validaciones

- Typecheck y pruebas frontend.
- Android: DEX real, arquitecturas, versión, firma y alineación del APK.
- Inicio de la variante release en emuladores Android API 24, 34 y 36.
- iOS: compilación para dispositivo, bundle/versiones, arm64, JavaScript y GLB.
- Inicio de una build release en dos simuladores iPhone y capturas de pantalla.
- Web: pruebas móviles en Chromium/WebKit y comprobación de la web de Render.

Las pruebas de inicio de simulador/emulador no comprueban por sí solas los
flujos autenticados ni la interacción con el mapa. Los resultados y los
descargables de esta entrega se detallan más abajo.

## Web móvil: primeras comprobaciones

- Typecheck y exportación web correctos; 453 pruebas frontend aprobadas.
- Pantalla de acceso en Chromium y WebKit: 320×568, 393×852, 412×915 y 852×393;
  sin errores JavaScript ni desbordamiento horizontal en los ocho casos.
- Mapa con GLB real y configuración lógica de los diez edificios, obtenida
  mediante una lectura de MongoDB sin modificaciones. La sesión y las respuestas
  de API se simulan localmente, sin escribir datos de usuarios en producción.
- Renderizado y navegación perfil → mapa → perfil → mapa comprobados en
  Chromium/WebKit actuales, y en Chromium 112 y WebKit 16.4.
- Protección web ante ausencia de WebGL2: aviso recuperable, reintento y regreso
  al perfil comprobados en los dos motores actuales.

La protección está en `CampusMapViewport.web.tsx`, que Metro excluye de Android
e iOS. Las builds nativas en curso proceden de `19d5213`; el cambio posterior
solo afecta a la web y a documentación.

En la pantalla de navegador 402×681/DPR 3 del perfil iPhone 17, Chromium y WebKit
pasaron selección de edificio, regreso al campus, rotación y zoom con eventos
táctiles DOM simulados, además de salir al perfil y volver al mapa. No se trata
de una ejecución física en el iPhone 17 con iOS 26.3.

## Descargables verificados en Drive

| Plataforma | Archivo | Instalación/uso |
| --- | --- | --- |
| Android | [CampusLink 0.1.2 Android universal ZIP](https://drive.google.com/file/d/13_eNxJgGny6am4MYJ1HUjWQK0YrF9Jpq/view?usp=drivesdk) | Extraer el ZIP e instalar la APK; permite actualizar 0.1.1. |
| iPhone/iPad | [CampusLink 0.1.2 IPA sin firmar](https://drive.google.com/file/d/1VOCgt-Uq75LovdrCcFglSOJaEZoNNVEA/view?usp=drivesdk) | Abrir la IPA en Sideloadly para Windows, firmar con cuenta Apple gratuita e instalar por USB. No extraer la IPA. |
| Web | [Exportación web ZIP](https://drive.google.com/file/d/1CYcz3sI0jl9ZCrPYV5iC2h3dMBGjN7cf/view?usp=drivesdk) | Paquete estático de respaldo; la web ya está publicada en Render. |

Web móvil: <https://campuslink-web-qa-mxwt.onrender.com>.
API: <https://campuslink-api-qa-mxwt.onrender.com>.

Los tres archivos se subieron a la carpeta Capstone existente. La lectura de
metadatos de Drive confirmó nombre, tamaño y tipo. No se cambiaron permisos.
El conector limita cada archivo a 100 MiB: por eso la APK universal se entrega
en ZIP, conservando la APK original completa, su checksum e instrucciones.

| Archivo | Bytes | SHA-256 |
| --- | ---: | --- |
| APK firmada dentro del ZIP | 120318800 | `ec96896b60bb70393dbd98d60ae2823e954d144a35282c9dde6df13c413465cc` |
| ZIP Android universal | 50271842 | `7faa2070cbe29a44d5e46f608c4ae95c5a77df764b62407be3fefbceecb1f98e` |
| IPA sin firmar | 24376216 | `9766d970115e9af824d2c4f94d5c3a3cd09bf6bdc74edd05a4ec02f581f24be9` |
| ZIP web | 11375598 | `4dbe59740c0233a58a66d92187d34f0d1893e85a108ed59259f6930a9c49f687` |

## Resultados nativos

Compilación de APK e IPA: [Actions 42419182624](https://github.com/Qvverty72/Capstone/actions/runs/42419182624),
fuente `19d52134fbc054a5aebeee6ec53e46779880b71e`. Ambos trabajos de compilación
terminaron con éxito. Las primeras pruebas Android de ese workflow fallaron por
configuración de las herramientas del runner, antes de instalar la aplicación.
La matriz definitiva, corregida, terminó con éxito en
[Actions 42421837684](https://github.com/Qvverty72/Capstone/actions/runs/42421837684).

Android:

- Inicio release comprobado en Android 7.0/API 24, Android 14/API 34 y Android
  16/API 36, emuladores x86_64. Proceso vivo tras la espera, sin crash nativo en
  el registro revisado; capturas de la pantalla de acceso inspeccionadas.
- La copia de CI se firmó con una clave temporal solo para los emuladores.
  La APK entregada lleva la clave original de CampusLink: certificado SHA-256
  `53cc852a2ddfdb760c79df6894423d66709fde8be12a8c8ea193ce3c47b9296d`.
- Firma v2/v3 y alineación ZIP de 16 KiB correctas; 52 bibliotecas nativas de
  64 bits con segmentos ELF compatibles con alineación de 16 KiB.
- R8 activo; constructor de GLView y `GLContext.flush()` presentes en DEX.
  Los payloads originales de CI no cambiaron al firmar. GLB idéntico al original.
- Paquete `cl.campuslink.app`, versión 0.1.2, `versionCode` 3, sin debuggable.

iOS:

- Archivo de dispositivo ARM64 y plataforma Mach-O iOS, no Simulator.
  `CFBundleSupportedPlatforms=iPhoneOS`, familias iPhone/iPad, mínimo iOS 16.4,
  versión 0.1.2 y build 1. Checksum coincidente con CI; GLB original incorporado.
- Build release de simulador iniciada en iPhone 18 Pro e iPhone 18 Pro Max con
  runtime iOS 27.0. Procesos vivos; capturas de acceso inspeccionadas.
- La IPA para dispositivo no tiene firma Apple válida para instalarse por sí
  sola: requiere la firma local con Sideloadly. La firma ad hoc del simulador
  solo sirve para ejecutar la prueba en el Mac de CI.

En APK, IPA y web se comprobó la configuración pública de Render/Supabase y
la ausencia de coincidencias con los valores privados locales revisados. No se
empaquetaron `.env`, keystores ni credenciales privadas de firma.

## Render y web publicada

Web y API quedaron `live` desde `9de1ed471afc729980434c4111e9df296a01c648`:

- API: deploy `dep-dbnqds142hec73cokc5g`.
- Web: deploy `dep-dbnqds142hec73cokc1g`.
- Health y readiness: HTTP 200. MongoDB, PostgreSQL, Redis y Supabase: `ok`.
- CORS real: OPTIONS HTTP 204 y origen autorizado igual al de la web publicada.
- Se observó un probe transitorio de Supabase durante el arranque; readiness
  posterior fue correcto y no hubo errores de aplicación en la ventana revisada
  desde 22:35 UTC del 7 de noviembre de 2026.
- El mapa y sus gestos se repitieron sobre los assets publicados en Render con
  Chromium/WebKit, usando sesión y API simuladas. No se crearon cuentas ni se
  escribieron datos de usuarios de producción para esas pruebas.

## Límites y prueba física pendiente

**No se certifican todos los Android ni todos los iPhone.** Las versiones mínimas,
arquitecturas y pruebas anteriores cubren una matriz concreta, no cada combinación
de modelo, GPU, memoria, navegador y sistema operativo.

Pendiente con los dispositivos del usuario: instalar 0.1.2, iniciar sesión real,
abrir el mapa, rotar/ampliar, seleccionar pisos, probar recursos y volver desde
segundo plano. En particular, **iPhone 17 con iOS 26.3 no se probó físicamente**.
La prueba previa comunicada por el usuario fue el mapa de Android 14 en 0.1.1.
Los emuladores/simuladores de esta entrega verifican inicio, no esos flujos nativos
autenticados. Las pruebas de mapa/gestos descritas son de la web con mocks de API.

La instalación gratuita de iOS requiere renovar la firma cada siete días; Drive
no elimina esa condición. Para acceso inmediato sin firma, usar la web publicada.
