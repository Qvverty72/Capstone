# Fuentes y definición de los indicadores

## Fuente real implementada

El frontend consulta **el backend existente de CampusLink**, después de validar la sesión. No hay consultas SQL/Mongo ni SDK de datos en el navegador. El SDK Supabase se usa únicamente para la sesión existente.

| Operación | Uso |
|---|---|
| `POST /api/v1/auth/login` | Inicio de sesión con el endpoint actual; instala la sesión mediante el SDK. |
| `GET /api/v1/auth/me` | Confirma identidad y permisos antes de mostrar el panel y al revalidar la sesión. |
| `GET /api/v1/analytics/options` | Instituciones, campus y carreras autorizados; no contiene catálogos ficticios. |
| `GET /api/v1/analytics/dashboard` | Agregados existentes y análisis ampliado v2 de `prerelease`, filtrados por fecha, institución, campus y carrera. |

No se invocan generación de reportes, registro de vistas, transacciones, inscripciones ni endpoints operativos de escritura desde el portal. Las operaciones normales de sesión y las cuotas del rate limiter conservan su comportamiento previo.

Las pruebas de esta integración **no consultaron producción ni bases existentes**: usaron PGlite en memoria, transportes interceptados y API/Supabase ficticios en loopback. El inicio real del portal dependerá de la configuración pública y los permisos del entorno donde se ejecute.

## Arquitectura revisada

Se revisó `prerelease`, no se asumió que siguiera igual a la versión original del prototipo. La rama contiene análisis ampliado que ya permite más indicadores reales.

- Frontend: `app/_layout.tsx`, configuración Expo web, `features/auth/{api,hooks,types}`, cliente HTTP autenticado, permisos de analítica, paleta compartida, componentes y gráficos existentes.
- Backend: `analytics.routes.ts`, `analytics.service.ts`, `analytics.periods.ts`, repositorios dashboard/activities/analysis, `analytics.analysis.ts` y contratos correspondientes.
- Hosting: `render.yaml` y documentación primaria de Render para raíz de monorepo y reglas estáticas.
- Persistencia: esquema SQL de referencia y tipos de actividades, leídos como archivos. No se ejecutaron migraciones o inicializadores.

## Agregados consumidos

`src/data/realSnapshot.ts` valida y proyecta una lista permitida del dashboard:

| Campo recibido | Uso en el portal |
|---|---|
| `period`, `scope`, `generatedAt` | Período/corte/zona y alcance visible. IDs de institución/campus/carrera solo se usan para verificar la consulta y construir filtros de catálogo. |
| `resourceDemand.views`, `.requests` | Vistas y solicitudes de recursos físicos y digitales; `value: null` conserva no disponibilidad. |
| `activityParticipation.value`, `.legacyEvents` | Inscripciones registradas y advertencia de procedencia heredada. |
| `intervals[].metrics` | Series por semana/mes; nulos interrumpen la serie, no se convierten en ceros. |
| `analysis.resources.{subjects,careers}` | Solicitudes, vistas, recursos con demanda y solicitantes únicos; el portal representa solicitudes/vistas y usa personas únicas para proteger grupos pequeños. |
| `analysis.activities.summary` | Vistas, inscripciones, retiros, personas únicas, recurrencia y conversión observada. |
| `analysis.activities.{segments,careers}` | Inscripciones por tipo/categoría y afinidad por carrera con denominadores declarados. |
| `notes`, `analysis.definitions` | Definiciones y límites de cobertura informados por el backend. |

Se descartan `activeUsers`, autores, nombres/correos de otras personas y campos no necesarios. El campo `activeUsers` reconstruye cuentas ACTIVA al corte: **no demuestra uso**. No se descargan perfiles individuales para construir estadísticas demográficas.

## Tablas del backend que respaldan la respuesta existente

El portal no las consulta directamente. Su uso se verificó leyendo los repositorios actuales:

| Tablas | Campos y relaciones relevantes |
|---|---|
| `institucion`, `campus`, `carrera`, `campus_carrera` | IDs, nombres, pertenencia institucional, campus activos y carreras del alcance. |
| `perfil_usuario`, `usuario_carrera` | Institución, campus y asociaciones de carrera de participantes. Las asociaciones actuales no reconstruyen pertenencias históricas. |
| `publicacion_recurso` | `id`, `campus_id`, `tipo_recurso`; clasifica el alcance del recurso. |
| `interaccion_recurso` | `publicacion_id`, `perfil_usuario_id`, `tipo_interaccion='VISTA'`, `created_at`; vistas observadas. |
| `solicitud_recurso` | `publicacion_id`, `solicitante_id`, `solicitada_en`; solicitudes y solicitantes únicos. |
| `publicacion_asignatura`, `asignatura`, `publicacion_carrera` | Asociaciones múltiples para demanda por asignatura/carrera del recurso. Un hecho puede aparecer en varios grupos; no sumarlos como exclusivos. |
| `auditoria` y estado de `perfil_usuario` | El dashboard reconstruye cuentas habilitadas, indicador que este portal no presenta como usuarios activos. |

El esquema de referencia también contiene `perfil_usuario.fecha_nacimiento` y `genero`, y relaciones de solicitudes/transacciones/confirmaciones. **No se añadieron consultas a esos campos para esta integración.** Se documentan como posibilidad pendiente de autorización, no como datos disponibles al navegador.

## Colecciones del backend

| Colección | Campos observados / uso existente |
|---|---|
| `activity_interactions` | `campusId`, `userId`, `activityId`, `type`, `occurredAt`, `provenance`. Eventos VIEWED/JOINED/LEFT del período autorizado, agrupados internamente sin devolver identidades. |
| `activities` | `_id`, `campusId`, `type`, `category`; clasificación actual enlazada al evento. Categoría opcional se conserva como «Sin categoría». |
| `activity_participation` | Estado/contadores actuales y marcas de cobertura; no se utiliza para inventar historia de asistencia o inscripciones. |

Los eventos `LEGACY_STATE` pueden proceder de importación de estado. Se conserva la advertencia: no prueban el instante histórico de la interacción.

## Definiciones y métricas pendientes

- **Participantes únicos de actividades:** personas deduplicadas en todo el período con eventos de inscripción. No sumar únicos de categorías, carreras o intervalos.
- **Recurrencia entre actividades:** personas inscritas en al menos dos actividades distintas / personas inscritas en cualquier actividad del rango. No equivale a retención D7/D30 de CampusLink.
- **Afinidad por carrera:** participantes únicos de esa carrera en tipo/categoría / participantes de la carrera en cualquier actividad. No es la tasa activa de todos los perfiles registrados de esa carrera.
- **Conversión observada de actividades:** pares persona–actividad con inscripción no importada posterior a una vista del mismo período / pares con vistas. No representa asistencia o causalidad.
- **Demanda académica:** solicitudes de recursos clasificados por sus asociaciones; no prueba necesidad insatisfecha ni déficit de oferta.
- **No disponibles en real:** registrados/nuevos, actividad de personas entre módulos, DAU/WAU/MAU, demografía, cohortes/retención y embudo físico. Falta un contrato agregado y cobertura verificable; no se deducen del estado de una cuenta o de la suma de eventos.
- **Privacidad:** se ocultan grupos de menos de 10 personas y se aplica supresión complementaria en presentación y CSV. La respuesta agregada existente no implementa una política de supresión demográfica nueva; el umbral del frontend no garantiza resistencia a inferencias.

## Fuente de demostración

`src/data/demo.ts` genera de forma determinista 840 perfiles sin nombres, correos ni fechas de nacimiento individuales, con recursos/actividades/eventos ficticios entre julio y octubre de 2026. No se inserta nada en bases de datos.

Las reglas métricas del prototipo se conservan: actividad por eventos, ventanas móviles de 1/7/30 días, retención exacta D7/D30 solo con seguimiento suficiente y embudo por una misma cohorte de solicitudes. Se muestran únicamente al elegir Demostración y se identifican en pantalla y CSV. La selección no rellena métricas reales ausentes.
