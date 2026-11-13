# Capstone Grupo 5 — CampusLink

**CampusLink** es una aplicación para la comunidad estudiantil de Duoc UC. Reúne material académico, intercambio de recursos físicos, actividades del campus y un mapa 3D para explorar sus espacios.

Este repositorio contiene **los entregables académicos y el código fuente del frontend y backend**. El software está en [`Fase 2/Evidencias Proyecto/Evidencias Sistema/CampusLink`](https://github.com/Qvverty72/Capstone/tree/main/Fase%202/Evidencias%20Proyecto/Evidencias%20de%20sistema/CampusLink), junto con su [documentación técnica](https://github.com/Qvverty72/Capstone/tree/main/Fase%202/Evidencias%20Proyecto/Evidencias%20de%20documentacion).

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
      └── Evidencias de Documentacion/
        ├── Diagramas UML/
        ├── Documentación de arquitectura/
        ├── Documentación de RNF/
        ├── Documentación de despliegue/
        ├── Documentación de pruebas/
        └── Evidencias Marco Ágil/   
      └── Evidencias de Sistema/
        ├── Base de datos/     
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

https://github.com/user-attachments/assets/45af7840-2831-409b-a8d4-a07bfb0beadb


## Equipo

Proyecto Capstone de Ingeniería en Informática, **Duoc UC — Sede Concepción**.

- Brian Chávez
- Carlos Soto
- Juan Pablo Arriagada

**Última actualización:** 13 de noviembre de 2026.
