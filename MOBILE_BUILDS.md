# CampusLink: Android, iPhone y web móvil

Versión en preparación: **0.1.2**. Rama: `build/mobile-cross-platform`.
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

## Validaciones programadas

- Typecheck y pruebas frontend.
- Android: DEX real, arquitecturas, versión, firma y alineación del APK.
- Inicio de la variante release en emuladores Android API 24, 34 y 36.
- iOS: compilación para dispositivo, bundle/versiones, arm64, JavaScript y GLB.
- Inicio de una build release en dos simuladores iPhone y capturas de pantalla.
- Web: pruebas móviles en Chromium/WebKit y comprobación de la web de Render.

Las pruebas de inicio de simulador/emulador no comprueban por sí solas los
flujos autenticados ni la interacción con el mapa. Los resultados, fuentes y
descargables se añadirán aquí al terminar las comprobaciones.

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
