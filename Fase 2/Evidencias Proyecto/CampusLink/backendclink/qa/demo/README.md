# Piloto institucional CampusLink - 16 de noviembre de 2026

Carga exclusiva de datos y archivos de demostración en `prerelease`. No cambia
frontend, reglas de negocio, consultas, migraciones, RLS ni despliegue.

## Escenario

| Módulo | Cantidad | Preparación |
|---|---:|---|
| Perfiles ficticios | 8 | Mismos estudiantes entre todos los módulos |
| Actividades comunitarias | 6 | 16 al 20 de noviembre; orientación durante el día 16 |
| Recursos físicos | 6 | Venta y donación; disponible, reservado y finalizado |
| Biblioteca | 5 | Apuntes originales de dos páginas con carrera y asignatura |
| Solicitudes | 6 | Una pendiente, acuerdos en curso, completados y cancelado |
| Transacciones | 5 | Dos completas, dos con una confirmación, una cancelada |
| Participación | 8 altas adicionales y 1 retiro | Además de la inscripción de cada organizador |
| Vistas de recursos / actividades | 14 / 3 | Operaciones estables, sin añadir vistas al reejecutar |
| Reportes analíticos | 1 | Calculado por la API existente a partir de los hechos |
| Denuncias nuevas | 0 | QA ya conserva escenarios de moderación |

Todos los perfiles son ficticios, con correo reservado `campuslink.invalid` y
contraseña aleatoria local. Tomás tiene exclusivamente la asignación autorizada
para consultar analítica y reportería del campus. No se cambian cuentas QA.

El catálogo inspeccionado identifica Duoc UC como `DUOC UC`, con una sola sede
`San Andres`. Se reutilizan los IDs consultados; no se crea una segunda sede
Concepción ni un campus adicional. El modelo no tiene un nivel campus separado.
Las ubicaciones de las actividades son POI visibles del mapa existente: CIIT,
Punto estudiantil, Auditorio y Biblioteca; no se inventan números de sala.

Se eligen las carreras existentes **Ingeniería en Informática Mención Desarrollo
de Software** e **Ingeniería en Redes y Telecomunicaciones** y sus asignaturas.
Analista Programador no figura en la oferta actualmente cargada: no se introduce
un registro sustituto. Referencia institucional de contexto:
[Duoc UC Concepción](https://www.duoc.cl/sedes/concepcion/),
[oferta de Informática y Telecomunicaciones](https://www.duoc.cl/escuela/informatica-telecomunicaciones/oferta-academica/).
La autoridad para las relaciones es el catálogo de la base, no esas páginas.

## Ejecución segura

Desde `backendclink`, con Node 22.13-22.x y dependencias ya instaladas:

```powershell
npm.cmd run build
node --test qa/demo/tests/demo.test.mjs qa/tests/fixtures.test.mjs
node qa/demo/seed.mjs plan --dry-run
```

El dry-run lee PostgreSQL, MongoDB y la configuración de los buckets; escribe
únicamente `qa/local/demo/plan.json`. No crea cuentas, sesiones, archivos remotos,
publicaciones ni métricas. Devuelve una huella SHA-256 del destino. Revisar el
plan antes de copiar esa huella en los siguientes comandos:

```powershell
node qa/demo/seed.mjs seed --apply --environment qa --target HUELLA_DEL_DRY_RUN
node qa/demo/seed.mjs verify --environment qa --target HUELLA_DEL_DRY_RUN
```

`seed` sin `--apply`, o con `--dry-run`, solo produce el plan. Rechaza otro
ambiente y otra huella. Nunca ejecuta limpieza. El destino incorpora el proyecto
Supabase, servidor/base/usuario PostgreSQL y servidor/base MongoDB sin guardar
contraseñas de conexión. Un lock PostgreSQL impide dos cargas simultáneas.

La carga confirma únicamente sus cuentas ficticias mediante Auth administrativo
y luego usa una API temporal local para publicar, subir archivos, solicitar,
confirmar, cancelar, participar, registrar vistas y generar el reporte. No inicia
workers ni eventos oficiales que anuncien una convocatoria a toda la sede.
Perfiles y asignaciones iniciales son fixtures directas. Los textos públicos
usan párrafos sin puntuación porque así lo exige el validador vigente.

Los IDs de usuarios son estables por dataset. Los demás IDs se recuperan por
identidad exacta y autor propio si se pierde una respuesta. El manifiesto guarda
checkpoints, credenciales y destino. No borra ni reinicia acciones al reejecutar.
Si se pierde el manifiesto y existen cuentas demo, se detiene: recuperar la copia
privada, sin resetear contraseñas. Ante ediciones manuales o cambios de catálogo,
revisar la causa del fallo antes de reanudar.

Archivos privados, excluidos de Git y Docker:

- `qa/local/demo/manifest.json`: identidad, contraseñas y checkpoints; respaldar.
- `qa/local/demo/credentials.md`: acceso a los ocho perfiles ficticios.
- `qa/local/demo/plan.json`: catálogo, volúmenes y contenido previo preservado.
- `qa/local/demo/verification.json`: integridad, archivos y métricas observadas.
- `qa/local/demo/previews/`: render local de las diez páginas y las ilustraciones.

## Archivos e imágenes

`assets/` contiene seis PNG de 960 x 640 y cinco PDF originales de dos páginas.
Las ilustraciones neutras representan cada objeto y se identifican como
demostrativas. Los apuntes no reproducen libros comerciales. No hay enlaces
externos, rutas Storage inventadas, fotos de personas ni imágenes compartidas
reemplazadas. La API asigna las rutas de los buckets privados y genera previews.

`verify` descarga todos los objetos de las once publicaciones, comprueba tamaño,
compara cada original con su asset local y solicita una URL firmada que debe
responder HTTP 200. También verifica que todos los paths pertenezcan a la sede,
autor y publicación correctos. Los enlaces firmados no se persisten.

Para regenerar los assets se utiliza `build-assets.mjs`, con `pdf-lib`, PDF.js y
el canvas ya presente en las dependencias instaladas. No se agregó dependencia
ni se necesita regenerar para ejecutar el seeder. Inspeccionar los renders tras
cualquier cambio de contenido.

## Contenido anterior y saneamiento

El piloto **no elimina ni oculta automáticamente el contenido anterior**. La
auditoría encontró 16 publicaciones y 11 actividades en San Andrés cuyos autores
no llevan una marca QA verificable. Un título informal no demuestra que el
registro sea descartable. El inventario privado conserva sus IDs para revisión;
incluye registros ocultos, retirados o finalizados que no necesariamente aparecen
en el listado público. Tampoco se eliminan generaciones QA de otras sedes.

`sanitize.mjs` permite ocultar de forma reversible solo IDs que el propietario
confirme como pruebas. No elimina usuarios, archivos, relaciones ni historia.
Conserva las cuentas QA de todas las generaciones y las cuentas del piloto.
La allowlist de ejemplo está vacía deliberadamente. Copiarla a la carpeta local
y añadir únicamente registros confirmados con este formato:

```json
{
  "environment": "qa",
  "target": "HUELLA_DEL_DRY_RUN",
  "publications": [
    {
      "id": "ID_REAL_DEL_INVENTARIO",
      "ownerId": "AUTOR_REAL_DEL_INVENTARIO",
      "campusId": "SEDE_REAL_DEL_INVENTARIO",
      "expectedTitle": "TÍTULO_EXACTO_ACTUAL",
      "confirmedTestData": true,
      "reason": "Confirmado por el propietario como prueba descartable"
    }
  ],
  "activities": []
}
```

Las actividades usan las mismas propiedades, con un ObjectId real en `id`.
No incluir contenido real, cuentas ni registros QA necesarios. Antes de aplicar:

```powershell
node qa/demo/sanitize.mjs plan --allowlist qa/local/demo/cleanup.json
node qa/demo/sanitize.mjs backup --allowlist qa/local/demo/cleanup.json
```

Revisar `cleanup-preview.json` y su respaldo privado. Solo después de la
autorización explícita del propietario para esos registros:

```powershell
node qa/demo/sanitize.mjs apply --allowlist qa/local/demo/cleanup.json --approval SHA256_DEL_PLAN --backup qa/local/demo/cleanup-backup-SHA256_DEL_PLAN.json
```

El respaldo contiene las filas/documentos completos que se cambiarían. Storage
queda intacto. Cambios concurrentes impiden sobrescrituras. SQL usa transacción;
Mongo usa comparación del documento y revisión por registro. Un diario registra
el avance entre bases; la misma orden con el mismo respaldo permite reanudar.
No existe una transacción distribuida. Ante divergencias se detiene y conserva
el diario. Para restaurar, revisar el respaldo y los cambios posteriores antes
de efectuar una actualización puntual autorizada; no hay restauración masiva.

## Render y demostración

El Dockerfile ejecuta `dist/server.js` y no copia `qa/` ni ejecuta seeders.
`render.yaml` usa `prerelease`; Supabase y MongoDB son externos y persistentes.
No se cambia ninguna configuración ni se despliega. Ejecutar los comandos desde
una máquina local controlada conectada al QA correcto; no asumir que los scripts
están disponibles en la imagen de Render. Un deploy no limpia las bases.

Variables existentes: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY` (o alias `SUPABASE_SERVICE_ROLE_KEY`), `SUPABASE_DB_URL`,
`MONGODB_URI`, `MONGODB_DB_NAME`, certificados TLS y las demás requeridas por la
configuración actual del backend. Conservar las rutas de certificados relativas
al backend. No copiar secretos a comandos, al informe ni a Git.

Para presentar: Camila publica, Catalina coordina y posee el material BD,
Antonia tiene un intercambio físico completo y uno digital aún sin derecho de
descarga, y Tomás consulta analítica/reportería. El cuaderno está finalizado, el
monitor reservado y el kit disponible tras cancelación. La biblioteca conserva
su visibilidad por institución; los físicos y actividades usan la sede actual.
Elegir el período **13 al 16 de noviembre de 2026** en analítica. No hay datos
históricos de relleno ni indicadores precalculados insertados directamente.

Las actividades tienen fechas fijas para esta presentación, zona Santiago
(UTC-03 en esas fechas). No se renuevan automáticamente en ejecuciones futuras.
El reporte guardado es una instantánea; las acciones manuales posteriores se
observan en el tablero y requieren generar una nueva instantánea desde la UI.

Consultar [`REPORT.md`](REPORT.md) para los resultados realmente ejecutados y
los pendientes. Una verificación de datos no sustituye la navegación visual en
web/móvil ni autoriza ocultar los registros anteriores de procedencia incierta.
