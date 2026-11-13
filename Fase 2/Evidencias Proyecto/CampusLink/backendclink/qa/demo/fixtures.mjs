import {createHash, randomBytes} from 'node:crypto';

export const DATASET = 'campuslink-duoc-concepcion-20261116-v1';
export const DEMO_DATE = '2026-11-16';
export const NOTICE = 'Escenario ficticio del piloto académico CampusLink\nNo corresponde a una convocatoria ni a una oferta real';
export const careerNames = {
  software: 'Ingeniería en Informática Mención Desarrollo de Software',
  networks: 'Ingeniería en Redes y Telecomunicaciones',
};
export const students = [
  {key:'camila',name:'Camila Fernández Lagos',career:'software'},
  {key:'matias',name:'Matías González Vera',career:'software'},
  {key:'valentina',name:'Valentina Rojas Peña',career:'software'},
  {key:'sebastian',name:'Sebastián Morales Díaz',career:'networks'},
  {key:'catalina',name:'Catalina Herrera Soto',career:'software'},
  {key:'diego',name:'Diego Fuentes Araya',career:'networks'},
  {key:'antonia',name:'Antonia Muñoz Leiva',career:'software'},
  {key:'tomas',name:'Tomás Navarro Reyes',career:'software',consult:true},
];

export const physical = [
  {key:'calculadora',owner:'camila',title:'Calculadora científica para matemática aplicada',category:'Instrumentos y herramientas',condition:'BUEN_ESTADO',modality:'VENTA',price:18000,asset:'calculadora.png',description:'Calculadora científica no programable, con tapa protectora y teclas en buen estado. Útil para ejercicios de matemática aplicada. Entrega coordinada entre estudiantes en San Andrés.'},
  {key:'cuaderno',owner:'matias',title:'Cuaderno de ejercicios de programación',category:'Apuntes y material impreso',condition:'BUEN_ESTADO',modality:'DONACION',price:null,asset:'cuaderno.png',description:'Cuaderno de elaboración propia con ejercicios resueltos de lógica, ciclos y funciones. Se dona para apoyar el estudio entre pares. No contiene evaluaciones ni material comercial reproducido.'},
  {key:'monitor',owner:'valentina',title:'Monitor de 24 pulgadas para estudio',category:'Tecnología y accesorios',condition:'USADO',modality:'VENTA',price:65000,asset:'monitor.png',description:'Monitor de 24 pulgadas con conexión HDMI, base y cable de alimentación. Adecuado para trabajar con código y documentos. Presenta señales normales de uso; se puede revisar al coordinar la entrega en el campus.'},
  {key:'kit',owner:'sebastian',title:'Kit de regla y escuadras para diagramación',category:'Materiales académicos',condition:'BUEN_ESTADO',modality:'DONACION',price:null,asset:'kit.png',description:'Regla y dos escuadras reutilizables para esquemas y diagramas de proyectos. Piezas completas, limpias y sin bordes quebrados. Entrega en un espacio común de San Andrés.'},
  {key:'teclado',owner:'catalina',title:'Teclado USB compacto para estación de estudio',category:'Tecnología y accesorios',condition:'BUEN_ESTADO',modality:'VENTA',price:12000,asset:'teclado.png',description:'Teclado compacto con conexión USB y distribución en español. Todas las teclas funcionan. Incluye cable integrado; pensado para una estación de estudio o trabajo práctico.'},
  {key:'soporte',owner:'diego',title:'Soporte plegable para notebook',category:'Tecnología y accesorios',condition:'BUEN_ESTADO',modality:'DONACION',price:null,asset:'soporte.png',description:'Soporte liviano y plegable para elevar el notebook durante sesiones de estudio. Cuenta con apoyos antideslizantes. Se dona para su reutilización por otro estudiante del campus.'},
];

export const digital = [
  {key:'bd',owner:'camila',title:'Guía de introducción a bases de datos relacionales',career:'software',subject:'BASE DE DATOS APLICADA I',modality:'DONACION',price:null,description:'Guía original de estudio con claves primarias y foráneas, relaciones y consultas SQL básicas. Incluye un ejercicio de préstamo de recursos y criterios para revisar la integridad de los datos.',sections:[['Modelar antes de consultar','Una tabla representa un conjunto de entidades. Una clave primaria identifica cada fila; una clave foránea conecta filas de tablas relacionadas. Separar estudiantes, recursos y préstamos evita repetir datos.'],['Ejercicio guiado','Diseña Estudiante(id, nombre), Recurso(id, titulo) y Prestamo(id, estudiante_id, recurso_id). Identifica las dos claves foráneas. Explica por qué un préstamo debe referenciar un estudiante existente.'],['Consulta y revisión','SELECT titulo FROM Recurso ORDER BY titulo; obtiene un listado ordenado. Comprueba qué ocurre con valores nulos, filas duplicadas y referencias ausentes antes de interpretar los resultados.']]},
  {key:'poo',owner:'matias',title:'Apuntes de programación orientada a objetos',career:'software',subject:'DESARROLLO ORIENTADO A OBJETOS',modality:'DONACION',price:null,description:'Apuntes originales sobre clases, encapsulación y composición. Contienen un ejemplo de catálogo académico y preguntas para practicar diseño de objetos.',sections:[['Responsabilidades claras','Una clase reúne estado y comportamiento relacionado. Una clase Recurso puede conservar título y disponibilidad, y exponer operaciones que mantengan válidas sus transiciones.'],['Composición','Un Catálogo contiene recursos y ofrece búsquedas. Esta relación permite cambiar la forma de almacenar los recursos sin trasladar la responsabilidad de búsqueda a cada estudiante.'],['Ejercicio de diseño','Propón dos operaciones para reservar y devolver un recurso. Define sus precondiciones. Describe un caso de prueba que impida reservar un recurso ya reservado.']]},
  {key:'redes',owner:'sebastian',title:'Material de estudio de redes y protocolos',career:'networks',subject:'CONECTIVIDAD DE REDES',modality:'DONACION',price:null,description:'Síntesis original sobre direccionamiento, funciones de DNS y diagnóstico de conectividad. Incluye un caso práctico para un laboratorio académico.',sections:[['Conectividad por capas','El enlace local permite alcanzar equipos de la misma red. IP identifica destinos entre redes; TCP ofrece entrega ordenada y UDP transporte de datagramas. Cada herramienta responde una pregunta diferente.'],['Nombres y direcciones','DNS resuelve nombres a registros. Una falla de resolución no implica que el servidor esté apagado. Compara el resultado por nombre y por dirección antes de proponer una causa.'],['Práctica de diagnóstico','En una red de laboratorio autorizada, revisa configuración local, puerta de enlace y resolución DNS. Registra el resultado esperado y el observado. Evita explorar redes ajenas al ejercicio.']]},
  {key:'seguridad',owner:'diego',title:'Guía de buenas prácticas de ciberseguridad',career:'networks',subject:'INTRODUCCIÓN A CIBERSEGURIDAD',modality:'DONACION',price:null,description:'Material original de alfabetización digital sobre contraseñas, verificación de enlaces y cuidado de archivos académicos. No incluye instrucciones ofensivas ni información personal.',sections:[['Protección de cuentas','Usa contraseñas únicas y un gestor de contraseñas. Activa segundo factor cuando esté disponible. Una cuenta de demostración tampoco debe reutilizar claves personales.'],['Revisar antes de compartir','Comprueba el dominio y el destinatario antes de abrir un enlace o enviar archivos. Comparte únicamente la información necesaria para la actividad académica.'],['Respuesta básica','Si detectas un acceso inesperado, cambia las credenciales desde un dispositivo confiable y comunica el incidente por el canal institucional correspondiente. Conserva evidencia sin difundir datos personales.']]},
  {key:'moviles',owner:'catalina',title:'Introducción al desarrollo de aplicaciones móviles',career:'software',subject:'DESARROLLO DE APLICACIONES MÓVILES',modality:'DONACION',price:null,description:'Guía original con una propuesta de pantalla de catálogo, estados de carga y validaciones de formularios. Orientada a preparar un prototipo académico accesible.',sections:[['Una pantalla con propósito','Define la tarea principal del usuario antes de añadir controles. Un catálogo debe mostrar títulos legibles y una acción clara para consultar el detalle.'],['Estados de interfaz','Diseña estados de carga, lista vacía y error recuperable. Conserva el contenido de un formulario cuando una solicitud falla y ofrece una acción comprensible para reintentar.'],['Ejercicio de prototipo','Dibuja una lista de recursos y una pantalla de detalle. Describe la navegación y prueba el recorrido con teclado y lector de pantalla. Separa las validaciones locales de la autorización del servidor.']]},
];

export const activities = [
  {key:'moviles',owner:'camila',title:'Taller de desarrollo de aplicaciones móviles',day:'2026-11-17',start:'15:00',end:'17:00',poi:'cabin03-floor2-ciit',description:'Encuentro de estudio entre pares para revisar un prototipo móvil, practicar formularios accesibles y compartir experiencias de desarrollo. Traer notebook es opcional.'},
  {key:'comunidades',owner:'matias',title:'Encuentro de comunidades tecnológicas',day:'2026-11-18',start:'16:00',end:'17:30',poi:'hbuilding-floor1-auditorio',description:'Espacio de colaboración para presentar ideas de proyectos estudiantiles, compartir aprendizajes y formar pequeños equipos de trabajo.'},
  {key:'orientacion',owner:'valentina',title:'Jornada de orientación académica entre pares',day:'2026-11-16',start:'08:00',end:'20:00',poi:'cabin03-floor3-punto-estudiantil',description:'Punto de encuentro de estudiantes para conocer el catálogo del piloto, organizar el estudio y revisar cómo solicitar recursos académicos. Atención demostrativa durante la jornada.'},
  {key:'redes',owner:'sebastian',title:'Laboratorio colaborativo de redes y protocolos',day:'2026-11-19',start:'15:00',end:'17:00',poi:'cabin03-floor2-ciit',description:'Sesión de estudio para interpretar esquemas de red, reconocer protocolos y documentar un diagnóstico básico en un caso de laboratorio.'},
  {key:'bd',owner:'catalina',title:'Clínica de consultas SQL y modelamiento de datos',day:'2026-11-20',start:'14:00',end:'16:00',poi:'hbuilding-floor2-biblioteca',description:'Trabajo en grupos pequeños con ejercicios originales de tablas, relaciones y consultas SQL. Se revisarán dudas frecuentes y criterios de integridad referencial.'},
  {key:'seguridad',owner:'diego',title:'Conversatorio de seguridad digital para estudiantes',day:'2026-11-18',start:'12:00',end:'13:00',poi:'hbuilding-floor2-biblioteca',description:'Conversación entre pares sobre protección de cuentas, cuidado de archivos y verificación de enlaces durante el trabajo académico.'},
];

export function stableId(key) {
  const hex = createHash('sha256').update(`${DATASET}/${key}`).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
// Las APIs de interacciones exigen un operationId con formato UUID v4.
// Se conserva una clave estable para recuperar reintentos del fixture.
export const operationId = key => stableId(key).slice(0,14)+'4'+stableId(key).slice(15);
// El validador vigente admite letras, números, espacios y saltos de línea.
// Párrafos breves conservan la legibilidad sin cambiar las reglas del producto.
export const description = item => `${item.description.replace(/[.;]+\s*/g,'\n').replace(/,/g,'').trim()}\n\n${NOTICE}`;
export function newManifest(target, catalog) {
  return {version:1,dataset:DATASET,target,catalog,steps:{},publications:[],activities:[],transactions:[],
    users:students.map(s=>({...s,id:stableId(`user/${s.key}`),email:`demo.${s.key}.20261116@campuslink.invalid`,password:randomBytes(24).toString('base64url')+'Az1!'}))};
}
export async function runStep(manifest,key,fn,save) {
  if (Object.hasOwn(manifest.steps,key)) return manifest.steps[key];
  const value = await fn();
  manifest.steps[key] = value ?? true;
  await save();
  return manifest.steps[key];
}
export function requireTarget(actual, expected, environment) {
  if(environment!=='qa' || actual!==expected || !/^[a-f0-9]{64}$/.test(expected??''))
    throw new Error('Se requiere --environment qa y --target con la huella exacta del dry-run.');
}
export function unique(rows, label) {
  if(rows.length!==1) throw new Error(`Catálogo ausente o ambiguo: ${label}. No se crearán sustitutos.`);
  return rows[0];
}
