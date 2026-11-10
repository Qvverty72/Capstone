# Empaquetado y acceso web

## Decisión de integración

Se mantiene un frontend React DOM aislado en `product-analytics-web/` y el frontend Expo en `frontendclink/`. Ambos se compilan en el mismo sitio estático; el backend Express conserva su servicio y módulos actuales.

El portal está fuera de la carpeta Expo para no introducir DOM/CSS y dependencias del panel en sus rutas móviles o comprobación de tipos. La alternativa de ubicarlo dentro exigía excluirlo del `tsconfig.json` compartido o añadir rutas/layouts de Expo; se evitó ese impacto.

El script nuevo `frontendclink/scripts/build-web.mjs`:

1. Ejecuta la generación de imágenes POI actual.
2. Ejecuta la exportación web de Expo actual.
3. Instala con lockfile inmutable las dependencias aisladas del portal (`npm ci --ignore-scripts`).
4. Compila el portal en `frontendclink/dist/analitica-producto/`, conservando `index.html`, bundles y assets de Expo.

El build rechaza claves de servidor y solo incorpora las variables públicas declaradas. No despliega ni contacta bases de datos.

## Ajustes de Render contenidos en esta rama

Solo cambia la configuración del sitio estático `campuslink-web-qa`:

| Campo | Valor preparado |
|---|---|
| `rootDir` | `Fase 2/Evidencias Proyecto/CampusLink` |
| `buildCommand` | `npm --prefix frontendclink ci && npm --prefix frontendclink run build:web` |
| `staticPublishPath` | `./frontendclink/dist` |
| `buildFilter.paths` | Rutas del repositorio correspondientes a `frontendclink/**` y `product-analytics-web/**` |

La raíz común es necesaria porque Render excluye archivos fuera de `rootDir`; con raíz limitada a `frontendclink` no se podría compilar la carpeta hermana. Se conservan filtros de cambios por frontend/portal para no ampliar el disparador web a cambios del backend. [Render: monorepos](https://render.com/docs/monorepo-support).

Antes del fallback Expo `/* → /index.html` se agregan reglas exactas:

```text
/analitica-producto  → /analitica-producto/index.html
/analitica-producto/ → /analitica-producto/index.html
```

Los assets existen en `/analitica-producto/assets/`; Render sirve recursos existentes antes de aplicar rewrites. Las seis vistas usan fragmentos, por ejemplo `/analitica-producto/#profiles`, sin apropiarse de rutas de informes o del login habitual. [Render: redirects y rewrites](https://render.com/docs/redirects-rewrites).

El servicio backend, su Dockerfile/rootDir, las variables privadas y ambas referencias `branch: prerelease` permanecen como estaban. **No se sincronizó el Blueprint, no se cambió un servicio remoto, no se hizo merge y no se inició despliegue.** La rama de integración debe revisarse antes de cualquier incorporación a prerelease.

## Configuración y sesión

El sitio web ya declara las variables públicas necesarias para ambos frontends:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (alternativa pública anon si el entorno actual la utiliza)

Usar los mismos valores y servir bajo el mismo origen permite reutilizar la persistencia web del SDK. El portal valida `/auth/me` y permisos de reportería antes de consultar analítica. No necesita otro sistema de cuentas ni una tabla de usuarios nueva.

Un puerto/subdominio distinto es otro origen: una sesión existente allí no se transfiere automáticamente. La sesión móvil tampoco pasa al navegador. El login del portal delega en el endpoint actual. Si falta configuración aparece un estado explícito; no se publican cifras ficticias como sustitución.

El servidor local aplica una CSP con conexiones limitadas a API y Supabase configurados, no a destinos recibidos en respuestas. La política de hosting remota existente no se modifica para relajar conectividad.

## Verificación y límites

La exportación conjunta se ejecutó localmente y se comprobó por SHA-256 que los **42 archivos de Expo** se conservan idénticos al añadir/regenerar el portal. Se validó el YAML y se comprobó que la configuración del backend y las ramas de despliegue siguen iguales.

Los navegadores de QA usaron únicamente endpoints ficticios en loopback. No se confirmó un despliegue remoto, conectividad de producción ni acceso con una cuenta real. Esa validación debe realizarse en el entorno de prueba autorizado después de revisar la rama; las métricas faltantes permanecen no disponibles.
