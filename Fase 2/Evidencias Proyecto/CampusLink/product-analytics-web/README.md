# CampusLink · portal de analítica de producto

Integración en la rama **`feature/product-analytics-integration`**, basada en `origin/prerelease` (`35eb688`). El portal está preparado para servirse como **`/analitica-producto/`** en el mismo sitio web de CampusLink, con frontend independiente y el backend existente. No se agrega al menú móvil ni se reemplazan informes actuales.

**Datos reales por defecto** después de validar sesión y permisos. El selector permite cambiar manualmente a demostración. Un error de red, sesión o permisos nunca activa cifras ficticias. Los indicadores sin respaldo permanecen como no disponibles.

## Desarrollo local

Desde `product-analytics-web/`, con Node.js 22.13 o superior:

```powershell
npm ci --ignore-scripts
Copy-Item .env.example .env
```

Completar `.env` **solo con las mismas tres variables públicas del frontend CampusLink**: URL de API, URL de Supabase y clave publishable/anon pública. Nunca usar claves secret/service-role. El archivo está ignorado por Git.

```powershell
node --env-file=.env scripts/dev.mjs
```

Abrir **http://127.0.0.1:4318/analitica-producto/**. Si las variables ya están definidas en el entorno del proceso, basta `npm run dev`. Sin configuración válida aparece «Configuración pendiente», sin consultas ni datos de demostración automáticos. La API debe permitir el origen local en su entorno de desarrollo; no se alteran permisos CORS del despliegue para esta prueba.

## Compilar con CampusLink

Desde `CampusLink/`, en un entorno que ya contenga esas variables públicas:

```powershell
npm --prefix frontendclink ci --ignore-scripts
npm --prefix frontendclink run build:web
```

El resultado conserva Expo en `frontendclink/dist/index.html` e incorpora el portal en `frontendclink/dist/analitica-producto/index.html`. En el mismo dominio y navegador, ambos usan la misma persistencia Supabase. El servidor local exclusivo del portal tiene otro origen que Expo en otro puerto, por lo que no comparte automáticamente esa sesión de desarrollo.

No se inició un despliegue. La configuración de Render queda preparada únicamente en esta rama. Véanse [guía e inventario](docs/README.md), [estado](docs/IMPLEMENTATION_STATUS.md), [fuentes](docs/DATA_SOURCES.md), [propuestas pendientes](docs/BACKEND_PROPOSALS.md), [despliegue](docs/DEPLOYMENT.md) y [validación](docs/VALIDATION.md).
