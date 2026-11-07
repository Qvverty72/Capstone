# Investigación del cierre del mapa en Android

Fecha: 7 de noviembre de 2026, America/Santiago.

Rama: `investigate/android-map-crash`, creada desde `prerelease` en
`c07ea9bb70efe578f9d481e174e5009b3f3d644c`.

## Resultado

Se encontró un defecto concreto en la APK entregada: R8 eliminó el constructor
nativo de `expo-gl.GLView` y no conservó el nombre `GLContext.flush()`, necesario
para una llamada desde C++ por JNI. Es la explicación principal del cierre al
entrar al mapa. El registro del teléfono sigue pendiente para confirmar cuál de
los dos errores ocurrió allí y detectar cualquier problema adicional.

Esto coincide con el [reporte de Expo #51948](https://github.com/expo/expo/issues/51948)
y su [corrección #51951](https://github.com/expo/expo/pull/51951/files), integrada
en el repositorio de Expo el 29 de octubre de 2026. La instalación local fijada
por el lockfile todavía carece de esas reglas. Que el arreglo exista en el
repositorio upstream no implica que esté incorporado en el paquete instalado.

Limpiar la caché no restaura constructores ni nombres eliminados del código
compilado. La sugerencia del sistema no demuestra que la caché sea la causa.

## Evidencia de la APK instalada

Se inspeccionó `frontendclink/artifacts/CampusLink-0.1.0-android.apk`, sin
recompilar ni modificar el archivo. Su SHA-256 coincide con el de la entrega:

```text
7066bc14faea6ecea7ade95f7dba5c80fb895f908f018ee70b2c10efdb2cfec2
```

- Dependencia fijada: `expo-gl` **58.0.3**; Expo SDK 58, React Native 0.88.0.
- El Android generado activa `android.enableMinifyInReleaseBuilds=true`.
- `expo-gl/android/build.gradle` instalado no declara `consumerProguardFiles`,
  y las reglas de la aplicación solo protegen Reanimated y TurboModules.
- El `classes.dex` contiene la definición del módulo `ExpoGL` como `Lnz0;`.
  Su definición referencia la clase `Loz0;` para la vista.
- Android Build Tools 37.0.0, mediante `dexdump`, confirma que `Loz0;` hereda de
  `android.view.TextureView`, implementa `SurfaceTextureListener` y quedó
  **PUBLIC ABSTRACT, sin métodos directos, virtuales ni constructor**.
- La clase del contexto gráfico `Liz0;` conserva los campos EGL y métodos
  `<init>`, `a`, `b` y `c`, pero no tiene un método llamado `flush`.
- `libexpo-gl.so` está presente para ambas arquitecturas ARM. Conserva el
  literal `flush`; el código C++ instalado usa
  `GetMethodID(GLContextClass, "flush", "()V")` sin comprobar el resultado.

Expo crea la vista mediante reflexión. Su regla general para `ExpoView` no
cubre `GLView`, que hereda de `TextureView`. Al abrir el mapa, `CampusMap.tsx`
monta el `Canvas` nativo y este intenta crear esa vista. El constructor faltante
puede provocar el cierre antes de cargar el modelo. Aunque se proteja solo el
constructor, la llamada JNI a `flush()` seguiría necesitando protección.

Android documenta por qué las llamadas por reflexión y JNI necesitan
[reglas de conservación para R8](https://developer.android.com/topic/performance/app-optimization/keep-rule-examples).

## Comprobaciones adicionales

El GLB está incorporado en la APK como `res/QD.glb` y coincide byte por byte con
el original. No tiene buffers ni imágenes externos, ni extensiones obligatorias
de compresión. Contiene 6 668 664 bytes, 45 mallas, 254 primitivas, 177 287
vértices de posición, 60 materiales y 8 imágenes. Estos datos no prueban un
problema de memoria; una medición de GPU/memoria vendría después si persistieran
fallos con R8 corregido.

El código del mapa y sus dependencias no cambiaron entre el commit de la APK
(`8a89f16`) y la base de esta rama (`c07ea9b`). No hay un `ErrorBoundary` propio
del mapa. Añadirlo ayudaría ante errores de JavaScript o carga del modelo, pero
no puede recuperar un proceso terminado por un fallo nativo.

## Corrección propuesta

Conservar estos dos miembros, siguiendo el arreglo de Expo:

```proguard
-keepclassmembers class expo.modules.gl.GLView {
    public <init>(android.content.Context, expo.modules.kotlin.AppContext);
}

-keepclassmembers class expo.modules.gl.GLContext {
    public void flush();
}
```

La integración debe ser persistente: `android/` está ignorado y GitHub Actions
lo genera con `expo prebuild`. Editar únicamente el `proguard-rules.pro` local
no arreglaría la siguiente APK. Una opción directa es extender el script
versionado `scripts/configure-android-release.mjs`, ya ejecutado después del
prebuild, para añadir las reglas de forma idempotente. Otra opción es actualizar
a una versión compatible de `expo-gl` que realmente las incluya y verificar
sus reglas empaquetadas. No hace falta cambiar el mapa ni el backend para
abordar este defecto.

Desactivar R8 permitiría una comparación de diagnóstico en una compilación
futura, pero la solución preferida conserva R8 y protege solo los miembros
necesarios. No es preciso reemplazar el mapa por una WebView.

## Verificación pendiente, cuando se autorice otra APK

1. Obtener el modelo y versión Android del teléfono. Reproducir el cierre con
   la APK actual y recoger el registro nativo:
   `adb logcat -b crash -d -v threadtime`.
   Se esperan firmas como constructor inexistente de la vista o un error JNI
   al resolver `flush`; el registro decidirá la firma exacta.
2. Aplicar la corrección persistente y comprobar el Android regenerado.
3. Compilar **release con R8 activo**, misma clave de firma y `versionCode`
   incrementado. Revisar el DEX/mapping para confirmar el constructor y
   `flush()`. Una prueba solo en Expo Go o debug no cubre este defecto.
4. Probar en el teléfono: primera entrada al mapa, salir y volver, rotar,
   ampliar, seleccionar edificios/pisos y pasar la aplicación a segundo plano.
   Revisar también el registro tras estas pruebas.

Expo distingue los fallos de ejecución de los de compilación y recomienda
los [registros nativos para investigar cierres](https://docs.expo.dev/debugging/runtime-issues/).
Las pruebas JavaScript y una compilación exitosa no verifican que la vista GL
optimizada pueda instanciarse en un teléfono.

## Alcance de esta investigación

No se modificó el código de la aplicación, no se generó otra APK y no se
desplegó nada. La inspección estática del DEX se contrastó con `dexdump`; sus
archivos de trabajo permanecen ignorados en `backendclink/qa/local/`.
No se conectó un teléfono ni se reprodujo el cierre en un dispositivo local.
