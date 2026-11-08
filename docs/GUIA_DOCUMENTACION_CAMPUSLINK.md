# Recorrido de documentación de CampusLink

Fecha de revisión: 8 de noviembre de 2026. Rama de trabajo: `JP_comments`.
Punto de partida: `8fa68c1c29fc2b86102924822a12a5009981dc15`, sin cambios locales.

## Dónde está el código

La aplicación está en `Fase 2/Evidencias Proyecto/CampusLink/`:

```text
CampusLink/
  backendclink/
    src/
      server.ts, bootstrap.ts, app.ts, readiness.ts
      config/                  # Validación de entorno y compatibilidad histórica
      database/                # Clientes MongoDB, Supabase/PostgreSQL y Redis
      routes/                  # Montaje HTTP versionado
      modules/                 # Auth, users, maps, activities, marketplace, reports, analytics
      shared/                  # HTTP, errores, salud, paginación, moderación y cuotas
    tests/, scripts/, qa/      # Comprobaciones y herramientas existentes
  frontendclink/
    app/                       # Rutas y layouts de Expo Router
    src/features/              # API, componentes, hooks y tipos por funcionalidad
    src/three/                 # Frontera de visualización e interacción 3D
    src/lib/, src/components/  # Transporte y presentación compartidos
    tests/, scripts/           # Contratos, renderizado y herramientas móviles
```

El README de la raíz del repositorio todavía describe un repositorio exclusivo
de entregables. Para estudiar la implementación hay que partir de esta ruta real,
de los manifiestos `package.json` y de los imports vigentes.

## Orden de lectura

1. `backendclink/src/server.ts` carga el entorno y delega el arranque.
2. `bootstrap.ts` conecta dependencias y verifica disponibilidad antes de escuchar.
3. `app.ts` compone Express; `routes/index.ts` monta `/api/v1`.
4. Cada ruta declara su política de acceso antes de validadores y controladores.
5. Los servicios coordinan permisos y casos de uso; los repositorios acceden a persistencia.
6. `frontendclink/app/_layout.tsx` instala la sesión y los guards de navegación.
7. Los componentes consumen hooks; los hooks coordinan estado y clientes API.
8. El transporte común adjunta la sesión Supabase a rutas relativas de la API.

No todos los flujos atraviesan las mismas capas: autenticación, uploads, respuestas
binarias y workers requieren revisar su recorrido concreto.

## Criterio de trabajo

Los comentarios se agregan en español y explican responsabilidades, decisiones,
entradas, resultados y límites que existen en el código. Cada bloque funcional se
registra progresivamente con Conventional Commits. El objetivo de 50–70 commits
se subordina a cambios útiles, sin commits vacíos ni cambios de lógica.

Se preservan rutas, configuración, migraciones y archivos de entorno. La revisión
no ejecuta migraciones ni altera bases externas. Las pruebas y sus limitaciones,
la comparación histórica y los hallazgos se consolidarán en
[`REVISION_TECNICA_CAMPUSLINK.md`](REVISION_TECNICA_CAMPUSLINK.md).

## Historia disponible

Git conserva el refactor del backend (`7d86cb1` a `af8d613`) y la reorganización
del frontend `43b5106`. En esos commits el código aún estaba en las carpetas
raíz `backendclink/` y `frontendclink/`; la comparación debe tener en cuenta su
ubicación actual dentro de los entregables. `ARCHITECTURE.md`, `REFACTOR.md` y
`REFACTOR_FILES.md` del backend son evidencia complementaria, que debe contrastarse
con el código actual y no interpretarse como prueba de ejecución.
