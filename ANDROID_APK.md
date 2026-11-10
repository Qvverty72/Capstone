# CampusLink Android APK

Preparación: 6 de noviembre de 2026, America/Santiago.

## Configuración

- Aplicación: CampusLink 0.1.0, `versionCode: 1`.
- Paquete Android: `cl.campuslink.app`.
- API: https://campuslink-api-qa-mxwt.onrender.com (sin `/api/v1` en la variable base).
- Arquitecturas: `arm64-v8a` y `armeabi-v7a`.
- Compilación: variante `release`, con JavaScript/Hermes y assets incorporados; no requiere Expo Go ni Metro.
- Fuente inicial de la compilación: `8a89f168a0acb4b09ab441e830b0bd2cf2b80616`, rama `prerelease`.
- [Compilación en GitHub Actions](https://github.com/Qvverty72/Capstone/actions/runs/42324021424).

La compilación nativa se realiza en GitHub Actions sin firma. Las únicas variables de conexión suministradas al frontend son públicas. La APK se firma después de descargarla, con una clave que permanece en el equipo local.

## Validación previa

- Typecheck frontend correcto, incluido en instalación limpia de CI.
- 444 pruebas frontend aprobadas, sin fallos ni omisiones.
- Prebuild Android correcto.
- Exportación Android con Node 22.23.4 correcta: bundle Hermes de 15.6 MB.
- URL Render y clave pública Supabase presentes en ese bundle; ninguna coincidencia con los valores privados locales conocidos.
- Se añadió una referencia versionada a `expo/types` para que una instalación limpia no dependa del archivo ignorado `expo-env.d.ts`.

## Firma y futuras actualizaciones

El respaldo privado se conserva en `Fase 2/Evidencias Proyecto/CampusLink/backendclink/qa/local/android-signing/`, ignorado por Git. Contiene el PKCS#12, sus credenciales, el certificado público y el script local `sign-apk.cjs`. No se envía con la APK ni al servicio de compilación. Para poder instalar futuras versiones como actualización se debe conservar esta misma clave y aumentar `android.versionCode`.

Certificado SHA-256: `53:CC:85:2A:2D:DF:DB:76:0C:79:DF:68:94:42:3D:66:70:9F:DE:8B:E1:2A:8C:8E:A1:93:CE:3C:47:B9:29:6D`.

Herramientas de firma: Android Build Tools 37.0.0 y Temurin JRE 17.0.21, descargados de fuentes oficiales y verificados contra sus checksums. Se comprueba alineación de 16 KiB antes de firmar y después se valida la firma con `apksigner`.

## Entrega

**APK terminada, firmada y subida a Mi unidad en Google Drive.**

- [Descargar CampusLink 0.1.0 Android](https://drive.google.com/file/d/1HMZxckvdyNXvDs5N5faQTKwCs3YhxbtF/view?usp=drivesdk).
- Archivo: `CampusLink-0.1.0-android.apk`, **68 742 142 bytes** (aproximadamente 69 MB).
- Copia local: `Fase 2/Evidencias Proyecto/CampusLink/frontendclink/artifacts/CampusLink-0.1.0-android.apk` (ignorada por Git).
- SHA-256: `7066bc14faea6ecea7ade95f7dba5c80fb895f908f018ee70b2c10efdb2cfec2`.
- Requiere Android API 24 o superior (Android 7.0+), teléfonos ARM de 32 o 64 bits.

GitHub Actions terminó con **success**, `BUILD SUCCESSFUL in 18m 57s`. Antes de firmar se comparó el checksum del APK descargado con el generado en CI. La APK final pasa `apksigner verify` con esquemas **v2 y v3**, tiene el certificado esperado y conserva alineación ZIP de 16 KiB. El manifiesto confirma el paquete, versión, SDK mínimo, arquitecturas y ausencia de `debuggable`. El bundle final apunta a Render, incluye la clave pública Supabase y no contiene los valores privados conocidos ni archivos de firma/credenciales.

La subida a Drive devolvió éxito y la lectura posterior confirmó el identificador, nombre, MIME Android y tamaño exacto del archivo. No se cambiaron permisos de compartición. No se ha probado todavía en un teléfono físico.

Commits publicados en `prerelease`: `9bfb7de` (configuración y workflow Android) y `8a89f16` (tipos Expo para instalación limpia). Este informe queda actualizado localmente, junto al informe previo de Render.
