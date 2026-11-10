# Estado de implementación · integración web

Revisión: 10 de noviembre de 2026. **Datos reales por defecto** significa conexión implementada a la API actual, no que se hayan leído registros de producción durante estas pruebas. La validación utilizó exclusivamente servicios y datos ficticios de QA.

| Funcionalidad | Estado | Fuente de datos | Observaciones |
|---|---|---|---|
| Resumen general | Parcial | API existente / PostgreSQL y MongoDB; Mock manual | Reales: vistas y solicitudes de recursos, inscripciones, participantes/retiros/recurrencia de actividades si existe análisis v2. Registrados, nuevos y activos globales no están disponibles. |
| Perfil de usuarios | Parcial | Análisis v2 de actividades; Mock | Real: afinidad por carrera entre participantes, con denominador explícito. Demografía y población total por segmento pendientes. Demostración completa y rangos configurables. |
| Uso y retención | Parcial | Análisis v2 de actividades; Mock | Real: recurrencia entre actividades, identificada expresamente como tal. DAU/WAU/MAU globales y D7/D30 no disponibles. Cohortes y ventanas funcionan solo sobre eventos ficticios. |
| Marketplace | Parcial | Mock | Embudo, publicaciones, estados y espera funcionan en demostración. El endpoint real mezcla físicos/digitales y no devuelve cohorte solicitud–transacción, por lo que el embudo real permanece no disponible. |
| Demanda académica | Parcial | API existente / PostgreSQL; Mock | Reales: solicitudes/vistas por asignatura y carrera del recurso, con solicitantes únicos para supresión. Categorías y campus del solicitante no están disponibles; se filtra por alcance autorizado. |
| Actividades y comunidad | Parcial | API existente / MongoDB + relaciones PostgreSQL; Mock | Reales: vistas, inscripciones, retiros, participantes únicos, recurrencia, categorías/tipos y afinidad por carrera. Actividades publicadas y asistencia no están en el contrato. |
| Ruta web propia | Implementado | Sin datos | `/analitica-producto/`, navegación por fragmentos y acceso directo, fuera del menú habitual/móvil. |
| Login y sesión compartidos | Implementado | Auth existente y `/auth/me` | Mismas cuentas y SDK; sesión reutilizable en el mismo origen. Identidad y permisos comprobados antes de montar el panel. |
| Datos reales por defecto | Implementado | GET options/dashboard existentes | No hay fallback automático a Mock; errores, permisos y falta de cobertura tienen estados explícitos. |
| Filtros y limpieza | Implementado para contratos disponibles | Catálogos autorizados / Mock | Fechas, institución, campus, carrera y semana/mes en real. Edad/género solo en demostración; no se envían filtros que el backend no soporta. |
| Protección de grupos pequeños | Parcial | Personas agregadas del contrato / Mock | Supresión de grupos de menos de 10 y complementaria en presentación/CSV. No equivale a una política de privacidad resistente a inferencia aplicada en servidor. |
| Gráficos, tabla y CSV | Implementado | Fuente seleccionada | Se preservan nulos, origen y alcance; un único intervalo se representa con punto visible. CSV contiene únicamente agregados de la fuente activa. |
| Compilación integrada | Implementado y verificado localmente | Export Expo + bundle portal | 42 archivos Expo preservados idénticos al incorporar portal. |
| Publicación o merge a prerelease | Pendiente de decisión | Ninguna | No se hizo push, merge, sincronización de servicios ni despliegue. |
| Funciones adicionales de backend | Pendiente de autorización | Tablas/colecciones existentes | No se implementaron endpoints nuevos. Ver propuestas. |

## Límites de interpretación

- `activeUsers` del dashboard existente cuenta cuentas ACTIVA al corte. Se descarta como medida de uso; no se convierte en sesión, DAU o retención.
- La recurrencia de actividades usa personas inscritas en al menos dos actividades distintas durante el rango; no significa regreso a 7/30 días ni retención general.
- La demanda por carrera clasifica el recurso; no describe la carrera del solicitante. Los recursos pueden tener varias asociaciones y no se suman sus grupos como exclusivos.
- La afinidad por carrera usa como denominador los participantes de esa carrera en actividades, no todos los perfiles registrados de ella.
- Los registros `LEGACY_STATE` y la captura histórica parcial se informan; no se reconstruyen eventos o fechas inexistentes a partir del estado actual.
- El escenario Mock sigue fijo en julio–octubre de 2026. Seleccionar otra fuente cambia el conjunto completo de indicadores; nunca se rellenan huecos reales con ese escenario.
- El login existente puede renovar sesiones y el rate limiter conserva sus cuotas temporales. No se agregan escrituras analíticas ni alteraciones de datos/esquema.
- No se validó conectividad ni contenido contra servicios de producción. La conexión real depende de las mismas variables públicas y permisos del entorno CampusLink donde se sirva el portal.
