# Funciones de backend pendientes de autorización

**No se implementó ninguna de estas propuestas.** La integración actual consume únicamente `GET /analytics/options` y `GET /analytics/dashboard`, ya existentes en `prerelease`. La solicitud de integrar el portal no se usó como aprobación para implementar todas las funciones propuestas en el prototipo.

El análisis v2 de esa rama ya cubre demanda por carrera/asignatura y audiencia de actividades, por lo que no se propone duplicar esas capacidades. Las métricas restantes se presentan como no disponibles. Las propuestas siguientes solo son viables sobre estructura y hechos ya existentes; si falta historia, se devuelve no disponibilidad.

## 1. Actividad y registros de producto

1. **Función:** `getProductUsageSummary`.
2. **Objetivo/problema:** contar registrados/nuevos y personas con uso observado entre módulos; construir DAU/WAU/MAU y días de actividad por persona.
3. **Justificación:** `activeUsers` actual es estado ACTIVA; no se pueden deduplicar personas sumando vistas, solicitudes o participantes de agregados distintos.
4. **Endpoint propuesto:** `GET /api/v1/product-analytics/usage`, en módulo propio con rutas/controladores/servicios/repositorios separados.
5. **Datos necesarios:** `perfil_usuario.created_at` y ámbito; actores/fechas verificables de `interaccion_recurso`, `solicitud_recurso`, transiciones de `transaccion_recurso`/`confirmacion_transaccion` y `activity_interactions` LIVE. Atribución de cada acción explícita.
6. **Respuesta:** agregados por período, definición/versionado/corte/cobertura, personas únicas en ventanas y valores nulos con motivo; nunca identificadores de personas.
7. **Base de datos y dificultad:** no requiere cambios ni escrituras; dificultad alta por unión y deduplicación SQL/Mongo.
8. **Riesgos:** registro parcial, pertenencias actuales frente a históricas, diferencias de corte entre motores y costo de lectura. Acotar rango, aplicar permisos por todos los campus y no inventar sesiones.

## 2. Perfiles agregados y cruces

1. **Función:** `getAggregatedProductProfiles`.
2. **Objetivo/problema:** distribución y participación relativa por edad, género declarado y segmentos institucionales, con denominadores de población.
3. **Justificación:** la afinidad actual por carrera usa participantes de actividades; no describe toda la población ni ofrece demografía. Descargar perfiles individuales al cliente sería una solución inadecuada.
4. **Endpoint propuesto:** `GET /api/v1/product-analytics/profiles` con dimensiones y rangos validados.
5. **Datos necesarios:** `perfil_usuario.fecha_nacimiento`, `genero`, `created_at`, ámbito; `usuario_carrera`, `carrera`, `campus`, `institucion`; uso observado autorizado de la propuesta 1.
6. **Respuesta:** grupos con tamaños, denominadores y tasas protegidos. Derivar edad al corte en servidor; preservar género no informado. Nunca nacimientos individuales, nombres, correos o IDs de persona.
7. **Base de datos y dificultad:** sin cambios estructurales; dificultad alta por supresión e identidades múltiples de carrera.
8. **Riesgos:** reidentificación, inferencia por diferencias y campos incompletos. Aplicar supresión primaria/complementaria en servidor y límites de dimensiones. El umbral de 10 del prototipo no es por sí solo garantía de anonimato.

## 3. Cohortes y retención

1. **Función:** `getProductRetentionCohorts`.
2. **Objetivo/problema:** retención exacta D7/D30 sobre cohortes que tengan seguimiento verificable.
3. **Justificación:** la recurrencia entre actividades actualmente disponible no prueba regreso en un día posterior al registro. No hay contrato de cohortes observables.
4. **Endpoint propuesto:** `GET /api/v1/product-analytics/retention`.
5. **Datos necesarios:** registro de perfil y actividad por actor/día de la propuesta 1, con cobertura temporal conocida; excluir procedencia heredada que no pruebe fecha.
6. **Respuesta:** cohorte, elegibles/retornos D7 y D30, porcentajes o nulos, definición, corte y supresión. Excluir registros cuyo día de seguimiento no se ha observado.
7. **Base de datos y dificultad:** sin cambios; dificultad alta. Si no se puede demostrar cobertura histórica suficiente, la alternativa válida es mantener no disponibilidad.
8. **Riesgos:** sesgo por inmadurez, eventos ausentes, cambios de segmento e inferencia en grupos pequeños. No reconstruir hechos pasados desde el estado actual.

## 4. Conversión del marketplace físico

1. **Función:** `getMarketplaceConversionCohort`.
2. **Objetivo/problema:** medir publicaciones, espera, estados y cohorte solicitud → reserva → intercambio completado.
3. **Justificación:** el dashboard actual combina físicos/digitales y no devuelve solicitudes enlazadas con sus transacciones al corte; su razón solicitudes/vistas no constituye un embudo de personas.
4. **Endpoint propuesto:** `GET /api/v1/product-analytics/marketplace`.
5. **Datos necesarios:** `publicacion_recurso` FISICO, `recurso_fisico`, `categoria_recurso_fisico`, `solicitud_recurso`, `transaccion_recurso.solicitud_id`, fechas de reserva/completada/cancelación y confirmaciones. Vistas solo como agregado aparte.
6. **Respuesta:** hitos del período y cohorte deduplicada por solicitud, denominadores explícitos y cobertura; espera media con publicaciones observadas/excluidas. No incluir vista → solicitud sin atribución verificable.
7. **Base de datos y dificultad:** sin cambios; dificultad media/alta. No agregar sesiones, relaciones de atribución, índices ni backfills en esta etapa.
8. **Riesgos:** mezcla de cohortes, doble conteo al unir confirmaciones, sesgo de supervivencia y confusión de propietario/solicitante. Distinguir actor, estado actual y transición fechada.

## Ampliaciones opcionales posteriores

Categorías/campus de demanda por perfil de solicitante y actividades publicadas/asistencia necesitan evaluación separada. No son necesarias para integrar los indicadores que ya devuelve `prerelease`. Si no existe un hecho persistido verificable, no se propone suplirlo mediante estructura nueva o datos artificiales.

En cualquier propuesta futura deben conservarse autenticación, institución y todos los campus autorizados, consultas parametrizadas y acotadas, fechas civiles America/Santiago y estados por métrica. No se autorizan migraciones, cambios RLS, funciones SQL, triggers, índices ni modificaciones de datos por este documento.
