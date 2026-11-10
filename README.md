# Capstone Grupo 5 — CampusLink

**CampusLink** es una aplicación para la comunidad estudiantil de Duoc UC. Reúne material académico, intercambio de recursos físicos, actividades del campus y un mapa 3D para explorar sus espacios.

Este repositorio contiene **los entregables académicos y el código fuente del frontend y backend**. El software está en [`Fase 2/Evidencias Proyecto/CampusLink`](Fase%202/Evidencias%20Proyecto/CampusLink/), junto con su [documentación técnica](Fase%202/Evidencias%20Proyecto/CampusLink/README.md).

## Estado del proyecto

El proyecto continúa en desarrollo e integración durante la **Fase 2**, con metodología **Scrum**. La documentación y evidencias de la Fase 1 se conservan para consulta. Ya existen pantallas, servicios y pruebas para los principales módulos; su presencia en el código no significa que todos los recorridos estén validados en producción o en cada plataforma.

| Módulo | Alcance presente en el código |
| --- | --- |
| Acceso institucional | Registro, inicio de sesión, recuperación y autorización por identidad, roles y capacidades |
| Perfil y notificaciones | Perfil académico, consultas personales, inscripciones y avisos al usuario |
| Actividades | Consulta, creación, participación, ubicación, eventos oficiales y recurrencia |
| Mercado estudiantil | Catálogo físico, venta o donación, publicaciones, solicitudes, coordinación y transacciones |
| Biblioteca digital | Recursos PDF, búsqueda, clasificación académica, vista previa y materiales adquiridos |
| Mapa 3D | Modelo del campus, edificios, pisos y puntos de interés, con datos suministrados por el backend |
| Administración y analítica | Gestión de accesos, denuncias, auditoría, indicadores y exportación de reportes según permisos |

La experiencia principal es **móvil con Expo**. También existe salida web; las funciones nativas y el renderizado 3D requieren validación específica por plataforma. CampusLink no procesa pagos electrónicos: los acuerdos se realizan entre los usuarios.

## Organización del repositorio

```text
Capstone/
├── Fase 1/
│   ├── Evidencias Grupales/
│   └── Evidencias Individuales/
└── Fase 2/
    ├── Evidencias Grupales/
    ├── Evidencias Individuales/
    └── Evidencias Proyecto/
        └── CampusLink/
            ├── frontendclink/
            ├── backendclink/
            └── README.md
```

Los documentos académicos incluyen planificación, backlog, historias de usuario, arquitectura, modelos de datos y evidencias de los sprints. Las carpetas de software contienen la implementación y sus pruebas.

## Tecnologías y arquitectura

| Capa | Tecnologías principales |
| --- | --- |
| Aplicación | TypeScript, React Native 0.88, React 19.3, Expo SDK 58 y Expo Router |
| Interfaz y estado | NativeWind, Zustand y componentes React Native |
| Visualización 3D | Three.js, React Three Fiber, Drei y Expo GL |
| API | Node.js, Express y TypeScript |
| Autenticación y datos relacionales | Supabase y PostgreSQL |
| Mapa y actividades | MongoDB |
| Control de solicitudes | Redis para rate limiting compartido |

La aplicación consume una API REST. El backend autoriza cada operación y coordina la persistencia; el frontend no accede directamente a MongoDB. Las credenciales privadas permanecen en el servidor.

## Ejecutar el proyecto localmente

Se recomienda **Node 22.13 o posterior dentro de la rama 22**, compatible con el requisito del backend. El frontend también admite Node 24.3+ o 26+. Se necesita acceso a un entorno propio de Supabase/PostgreSQL y MongoDB. Docker es opcional; el Compose del backend incluye Redis.

### Backend

Desde la raíz del repositorio:

```bash
cd "Fase 2/Evidencias Proyecto/CampusLink/backendclink"
npm ci
```

Preparar un `.env` privado a partir de `.env.example`, configurar las conexiones y aplicar el esquema/migraciones del entorno correspondiente. Después, ejecutar `npm run dev` o `docker compose up --build` desde esa carpeta.

Consultar el [README del backend](Fase%202/Evidencias%20Proyecto/CampusLink/backendclink/README.md) para conexiones, migraciones, CORS y Redis. El contenedor no sustituye la preparación de las bases de datos externas.

### Frontend

En otra terminal, desde la raíz:

```bash
cd "Fase 2/Evidencias Proyecto/CampusLink/frontendclink"
npm ci
npm run start -- --clear
```

Antes de iniciar Expo, preparar el `.env` local con `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` y una **clave pública** de Supabase. Consultar los ejemplos del [README de CampusLink](Fase%202/Evidencias%20Proyecto/CampusLink/README.md). Para web, ejecutar `npm run web`.

Desde un teléfono físico, la API debe apuntar a una IP o URL accesible por el dispositivo; `localhost` corresponde al teléfono. No incorporar claves secret/service_role ni credenciales de bases de datos en variables `EXPO_PUBLIC_*` o en Git. En PowerShell, usar `npm.cmd` y `npx.cmd` si la política del equipo bloquea los scripts `.ps1`.

## Pruebas y demostración automatizada

El frontend conserva sus pruebas en `frontendclink/tests/` y el backend en `backendclink/tests/`. Ambos incluyen `npm run typecheck`; el backend ejecuta su suite con `npm test`.

La suite **Playwright y el pipeline audiovisual están en la rama [`experiment/playwright-demo`](https://github.com/Qvverty72/Capstone/tree/experiment/playwright-demo)**, creada desde `prerelease`. No se han fusionado automáticamente a `main`.

En esa rama, la ejecución documentada del **10 de noviembre de 2026** obtuvo:

| Suite | Aprobadas | Fallidas | Omitidas |
| --- | ---: | ---: | ---: |
| Playwright en Chromium | 15 | 0 | 2 |
| Pruebas anteriores del frontend | 453 | 0 | 0 |
| Pruebas anteriores del backend | 793 | 0 | 2 |

Estos resultados corresponden a la **rama experimental**, no certifican automáticamente este `main`. Los E2E aprobados utilizan API simulada y datos sintéticos. Se omitieron el acceso QA real sin credenciales, Expo GL nativo y dos casos del backend que requieren Redis externo.

[![Abrir demostración de CampusLink](https://raw.githubusercontent.com/Qvverty72/Capstone/experiment/playwright-demo/Fase%202/Evidencias%20Proyecto/CampusLink/docs/demo/thumbnail.png)](https://github.com/Qvverty72/Capstone/blob/experiment/playwright-demo/Fase%202/Evidencias%20Proyecto/CampusLink/docs/demo/campuslink-demo.mp4?raw=1)

La demo MP4 dura aproximadamente **69 segundos** y muestra acceso, perfil, actividades, mercado y biblioteca en una vista móvil de Expo Web. Mantiene un aviso visible de **datos sintéticos y API simulada**. No certifica la persistencia real ni incluye el mapa 3D o la administración.

- [Guía de Playwright y limitaciones](https://github.com/Qvverty72/Capstone/blob/experiment/playwright-demo/Fase%202/Evidencias%20Proyecto/CampusLink/docs/qa/playwright.md).
- [Resultados y evidencias de ejecución](https://github.com/Qvverty72/Capstone/blob/experiment/playwright-demo/Fase%202/Evidencias%20Proyecto/CampusLink/docs/qa/results/validation.md).
- [Regenerar el MP4](https://github.com/Qvverty72/Capstone/blob/experiment/playwright-demo/Fase%202/Evidencias%20Proyecto/CampusLink/docs/demo/README.md).

Desde `frontendclink/` **en la rama experimental**:

```bash
npm run test:e2e
npm run test:e2e:report
npm run demo:record
```

La guía incluye la instalación de Chromium y FFmpeg local. No se depende de GitHub Actions ni de servicios de video de pago.

## Equipo

Proyecto Capstone de Ingeniería en Informática, **Duoc UC — Sede Concepción**.

- Brian Chávez
- Carlos Soto
- Juan Pablo Arriagada

**Última actualización:** 10 de noviembre de 2026.
