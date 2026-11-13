# Resultado del piloto institucional

Verificado el **13 de noviembre de 2026**, zona America/Santiago, sobre la rama
`prerelease`, base `35eb6887`. El dataset nuevo está cargado en las bases
persistentes que utiliza la API QA pública de Render. **El saneamiento del
contenido anterior queda pendiente de identificarlo como prueba descartable.**
No se afirma que todos los listados estén ya libres de contenido informal.

## Archivos modificados

Solo se modificó `qa/README.md` y se añadió `qa/demo/`:

- `fixtures.mjs`: 8 perfiles, 6 actividades, 6 físicos y 5 digitales relacionados.
- `seed.mjs`: dry-run, carga reanudable, comprobación del catálogo y verificación.
- `build-assets.mjs`, `assets/*.png`, `assets/*.pdf`: seis ilustraciones originales
  y cinco apuntes originales, sin descargas de terceros.
- `cleanup-guards.mjs`, `sanitize.mjs`, `cleanup.example.json`: saneamiento por
  allowlist exacta, destino, respaldo y autorización del plan.
- `verify-render.mjs`: lectura HTTP del piloto en el QA ya desplegado.
- `tests/demo.test.mjs`, `README.md`, `REPORT.md`: pruebas y operación.

No hay cambios en frontend, servicios, controladores, endpoints, repositorios,
esquema, migraciones, RLS, dependencias ni infraestructura. La publicación de
estos archivos se realiza en `prerelease` con el mensaje
`chore(seed): prepare professional CampusLink demo dataset`; no ejecuta el
seeder ni retira contenido previo. Los archivos privados de `qa/local/`
continúan excluidos de Git y de la imagen de Render.

## Auditoría y catálogo

PostgreSQL/Supabase conserva perfiles, catálogo institucional/académico,
publicaciones y archivos, solicitudes, transacciones, confirmaciones,
adquisiciones, valoraciones, interacciones de recursos, permisos, auditoría,
notificaciones, denuncias y reportes. Supabase Auth conserva las identidades.
MongoDB conserva mapas, actividades, series, participación e interacciones de
actividades. Los originales se guardan en los buckets privados
`publication-images` y `digital-resources`; las URLs firmadas se regeneran.

La institución real del catálogo es `DUOC UC`, ID
`ec3d8b11-db67-4364-bd2d-5cbd482848ad`. Su único registro de sede es `San Andres`, ID
`22222222-2222-4222-8222-222222222222`. No se creó otra sede ni un nivel adicional
para San Andrés. Ciudad y región estaban vacías en ese registro y no se alteró
el catálogo. El escenario de las descripciones corresponde a Concepción,
Biobío, Chile.

Se reutilizaron Ingeniería en Informática Mención Desarrollo de Software y
Ingeniería en Redes y Telecomunicaciones, sus relaciones `campus_carrera` y cinco
asignaturas existentes. Analista Programador no existe en la oferta cargada;
se conservó el catálogo. No se crearon instituciones, carreras, asignaturas ni
mapas. Las actividades referencian POI reales del mapa activo.

El seeder QA general crea 54 publicaciones y sedes técnicas de aislamiento.
No se ejecutó. Había varias generaciones QA persistentes, que se conservaron.
El nuevo piloto tiene un manifiesto independiente y ocho cuentas ficticias
con dominio reservado `.invalid`. No se modificaron contraseñas, perfiles ni
asignaciones QA; su hash de integridad se comprobó antes y después.

## Datos agregados y comprobados

| Datos del piloto | Resultado |
|---|---:|
| Perfiles ficticios | 8 |
| Actividades comunitarias | 6 |
| Publicaciones físicas | 6 |
| Publicaciones digitales | 5 |
| Archivos originales privados | 11 |
| Solicitudes | 6 |
| Transacciones | 5 |
| Adquisiciones digitales completas | 1 |
| Valoraciones | 2 |
| Altas adicionales en actividades / retiros | 8 / 1 |
| Vistas explícitas de recursos / actividades | 14 / 3 |
| Reporte analítico calculado por la API | 1 |
| Denuncias nuevas | 0 |

El monitor está reservado con una confirmación; el cuaderno fue entregado y
valorado; el kit volvió a disponible tras cancelación. Catalina adquirió la guía
BD. Antonia todavía no puede descargar POO porque falta la segunda confirmación.
Los seis organizadores se inscribieron a través del flujo vigente; los contadores
coinciden con los participantes JOINED. Las fechas de las actividades abarcan el
16 al 20 de noviembre y no se extienden al reejecutar el seeder.

Los originales tienen autoría demostrativa y los textos públicos advierten que
el escenario es ficticio. Los párrafos sin puntuación obedecen al validador actual
de contenido; no se relajó su política. Las ilustraciones son neutras, de 960 x
640 píxeles. Se renderizaron e inspeccionaron las diez páginas de los PDF y las
seis imágenes. No se sustituyó una imagen de un registro anterior de procedencia
incierta ni se eliminó un objeto compartido.

## Seeder, dry-run y pruebas

- Dry-run contra las bases y buckets reales: catálogo, mapa, ubicaciones,
  categorías, asignaturas y referencias válidas; cero escrituras remotas.
- Carga completada: **73 checkpoints**. Los rechazos iniciales del validador
  (puntuación, fechas con offset y operación sin formato UUID v4) se corrigieron
  únicamente en los fixtures/scripts. Se reanudó cada paso sin duplicar los
  anteriores; no se modificó ninguna validación de la aplicación.
- Segunda carga completa: sin nuevos checkpoints ni registros y con los mismos
  IDs, volúmenes y métricas. Contraseñas y estados se conservaron.
- Verificación de todos los originales Storage: tamaño, ruta canónica y bytes
  idénticos al asset local. URL firmada HTTP 200.
- Descarga del recurso adquirido: bytes idénticos al PDF original. Descarga con
  una sola confirmación: **HTTP 403**.
- **13 pruebas de fixtures/seguridad aprobadas** (10 nuevas y 3 QA existentes).
- **410 pruebas existentes aprobadas**, sin fallos ni omisiones, de recursos
  físicos, biblioteca/PDF, creación/participación/interacciones de actividades,
  analítica, exportación y revisión de denuncias.
- Compilación TypeScript correcta. `git diff --check` correcto. Sin credenciales
  privadas detectadas en los archivos de entrega.
- Dry-run del saneamiento con allowlist vacía: **0 publicaciones, 0 actividades**.
  No se ejecutó `sanitize apply` ni el `clean` del seeder general.

Se usó Node **22.13.1** existente. El sandbox bloquea `tsx` con
`uv_os_get_passwd`; las 410 pruebas pasaron al ejecutarse fuera de ese sandbox.
No se instalaron dependencias. Logs y evidencias quedaron en `qa/local/demo/`.

## Verificación de Render y métricas

La API pública existente
`https://campuslink-api-qa-mxwt.onrender.com/api/v1` aceptó al perfil ficticio Tomás
con la sede correcta, mostró las seis actividades nuevas, las cinco publicaciones
digitales y los cuatro físicos disponibles. Monitor y cuaderno son consultables
en detalle; el listado físico excluye reservado/finalizado por su filtro actual.
La imagen privada se descargó mediante una URL firmada generada por Render.
El reporte guardado es consultable.

Para el período **13 al 16 de noviembre**, el cálculo existente devolvió:

| Métrica existente | Valor |
|---|---:|
| Demanda de recursos | 20 |
| Demanda por asignaturas | 9 |
| Inscripciones a actividades | 14 |

Son resultados derivados de vistas, solicitudes e inscripciones persistidas.
No se insertaron agregados, no se cambiaron fórmulas y no se inventó historia.
La pertenencia institucional sigue vigente: físicos y actividades por sede,
biblioteca dentro de la institución. No se alteraron filtros para hacerlos aparecer.

El Dockerfile ejecuta `dist/server.js`; no carga seeders y no copia `qa/` a la
imagen final. Supabase y MongoDB son externos y persistentes. La prueba HTTP con
IDs coincidentes comprueba que el QA público accede al piloto. No se modificó
la configuración de Render ni se inspeccionaron variables privadas remotas.
El autodeploy y el despliegue concreto del commit publicado deben comprobarse
contra el servicio, además de repetir el health check y la verificación de datos.
La evidencia operativa posterior se guarda en `qa/local/demo/`, sin versionar
credenciales ni resultados que requieran un nuevo deploy solo para documentarlos.

## Registros anteriores pendientes

Se preservaron **16 publicaciones y 11 actividades anteriores** de la sede.
Sus autores no tienen marca QA verificable. Parte de ese contenido es histórico,
oculto o retirado. Los listados de Render todavía muestran **estos 9 registros**:

| Tipo | Título actual | ID exacto |
|---|---|---|
| Físico | Wow | `13e3569a-2747-47d8-95df-35fbe277d3df` |
| Físico | Lentes Prueba | `9e151eba-bf47-49f9-bb60-6a37bd1330c9` |
| Físico | Prueba de panel de admin | `929afa2f-6799-4ecb-a7f4-e64466f3b6b5` |
| Físico | Mouse | `f185745e-eee6-4a93-a27d-05821eef9702` |
| Digital | wow 3 | `47692e50-8b8d-4056-98eb-a36908eed2e5` |
| Digital | Prueba | `744b823d-be7d-43f1-b8e8-088c78d99fc9` |
| Digital | apuntes test1 bd | `83386201-04f6-4d9d-b40e-996bb37abe65` |
| Digital | apuntes bd | `7e02df67-ae29-4dcc-9045-00ce8c8570c6` |
| Actividad | Wow Mañana | `6aea78dd9244d0e19b93ea11` |

Actualmente los listados devuelven 8 físicos, 9 digitales y 7 actividades en
total, sumando el piloto y ese contenido anterior. Para dejar únicamente el
piloto en los listados debe confirmarse qué IDs son pruebas descartables.
Después se puede usar el retiro reversible con respaldo, preservando autores,
solicitudes, transacciones, archivos, QA e historia. No se presume que un título
informal permita ocultar contenido real.

No se ejecutó una limpieza irreversible. No existe un respaldo de saneamiento
aplicado porque todavía no hay una selección autorizada de esos registros.
La navegación visual completa en navegador y móvil también queda pendiente;
las verificaciones realizadas son de datos, documentos, imágenes y HTTP.

## Comandos reproducibles

Desde `Fase 2/Evidencias Proyecto/CampusLink/backendclink` con Node 22 y el `.env`
QA privado existente:

```powershell
npm.cmd run build
node --test qa/demo/tests/demo.test.mjs qa/tests/fixtures.test.mjs
node qa/demo/seed.mjs plan --dry-run
node qa/demo/seed.mjs seed --apply --environment qa --target 1ac7b9e9f8f3baa844ff75cd60542630cc16b0a8eee5cd15c8b7aca058d42778
node qa/demo/seed.mjs verify --environment qa --target 1ac7b9e9f8f3baa844ff75cd60542630cc16b0a8eee5cd15c8b7aca058d42778
node qa/demo/verify-render.mjs
```

Revisar siempre la huella del nuevo dry-run antes de aplicar. Para ejecutar las
pruebas existentes seleccionadas:

```powershell
node --import tsx --test tests/physicalgoods.test.ts tests/elibrary.test.ts tests/elibrary-pdf.test.ts tests/activities-create.test.ts tests/activities-participation.test.ts tests/activities-interactions.test.ts tests/analytics-analysis.test.ts tests/analytics-dashboard.test.ts tests/analytics-export.test.ts tests/reports-review.test.ts
```

En este equipo se reemplazó `node` por
`& '.\qa\local\tools\node22\node.exe'`, porque el Node global es 24.
Las credenciales del piloto están en `qa/local/demo/credentials.md`, excluidas
de Git. Conservar una copia privada del manifiesto. Los pasos de allowlist,
respaldo y aplicación puntual de saneamiento están en [`README.md`](README.md).
