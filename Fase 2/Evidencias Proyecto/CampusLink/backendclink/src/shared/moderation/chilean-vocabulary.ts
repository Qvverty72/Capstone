import type { Category, DictionaryEntry, PhraseEntry, Severity } from 'verlux';

/** Vocabulario propio revisable sin modificar el motor. No usar coincidencias parciales. */
export const CHILEAN_VOCABULARY_VERSION = '2026-11-06.3';
const term = (word: string, severity: Severity, aliases: string[], category: Category = 'insult'): DictionaryEntry => ({
  word, normalized: [word], language: 'es', severity, category, allowPartialMatch: false, aliases,
});

export const CHILEAN_VOCABULARY: DictionaryEntry[] = [
  term('hihitler', 'high', ['heilhitler', 'vivahitler'], 'hate'),
  // Familias frecuentes, escritura fonética y abreviaciones de chat.
  term('weón', 'medium', ['weon', 'weones', 'weona', 'weonas', 'hueón', 'hueon', 'hueones', 'hueona', 'hueonas',
    'huevones', 'huevona', 'huevonas', 'güeón', 'gueon', 'güeones', 'gueones', 'güeona', 'gueona', 'güeonas', 'gueonas',
    'webón', 'webon', 'webones', 'webona', 'webonas', 'wueon', 'wueones', 'wn', 'wna', 'wns', 'wnas']),
  term('aweonao', 'medium', ['aweoná', 'aweona', 'aweonaos', 'aweonas', 'aweonado', 'aweonados', 'aweonada', 'aweonadas',
    'ahueonao', 'ahueonaos', 'ahueoná', 'ahueona', 'ahueonado', 'ahueonados', 'ahueonada', 'ahueonadas',
    'ahuevonao', 'ahuevonaos', 'ahuevonado', 'ahuevonados', 'ahuevonada', 'ahuevonadas', 'agueonao', 'agueonaos',
    'agüeonao', 'agüeonaos', 'agüeonado', 'agueonado', 'agüeonados', 'agueonados']),
  term('weá', 'low', ['wea', 'weas', 'hueá', 'huea', 'hueás', 'hueas', 'huevada', 'huevadas', 'huevá', 'hueva', 'huevás', 'huevas', 'webada', 'webadas'], 'other'),
  term('wevear', 'low', ['huevear', 'hueveando', 'hueveo', 'hueveos', 'hueviar', 'hueviando', 'hueveas', 'hueveai', 'hueveái',
    'webear', 'webeando', 'webeo', 'webeos', 'webeas', 'webeai', 'webeái', 'webee', 'webeé', 'webeaste', 'webearon',
    'webean', 'webeen', 'webiando', 'webiar', 'webiai', 'webiái', 'weviando', 'weviar', 'weveando', 'weveo',
    'weveas', 'weveai', 'weveái', 'wevean', 'weando', 'weai', 'weái'], 'other'),
  term('conchetumadre', 'high', ['conchetumare', 'conchetumae', 'conchetumadres', 'conchetumares', 'conchesumadre', 'conchesumare',
    'conchesumae', 'conchesumadres', 'conchesumares', 'conchadetumadre', 'conchadesumadre', 'conchatumadre', 'conchasumadre',
    'conchatumare', 'conchasumare', 'reconchetumadre', 'reconchesumadre', 'reconchetumare', 'reconchesumare',
    'ctm', 'csm', 'ctmr', 'csmr', 'ctmdre', 'cstmdre']),
  term('chucha', 'high', ['chuchas', 'chuchada', 'chuchadas', 'rechucha', 'rechuchas', 'recontrachucha', 'recontrachuchas'], 'other'),
  term('chuchatumadre', 'high', ['chuchatumare', 'chuchetumadre', 'chuchetumare', 'chuchesumadre', 'chuchesumare']),
  term('culiao', 'high', ['culiaos', 'culiá', 'culia', 'culias', 'culiado', 'culiados', 'culiada', 'culiadas', 'culeao', 'culeaos',
    'culeado', 'culeados', 'culeada', 'culeadas', 'culiaí', 'culiai', 'culiar', 'culear', 'culiando', 'culeando',
    'qliao', 'qliaos', 'qlia', 'qlias', 'qliaito', 'qliaitos', 'culiaito', 'culiaitos', 'culiaita', 'culiaitas',
    'qlo', 'qlos', 'qla', 'qlas', 'ql', 'kliao', 'kliaos', 'klia', 'klias']),
  term('sacoweas', 'medium', ['sacowea', 'sacohueas', 'sacohuevas', 'sacohuevadas', 'sacowebas',
    'sacodeweas', 'sacodehueas', 'sacodehuevas', 'sacodehuevadas', 'sacowes']),
  term('aweonamiento', 'medium', ['aweonamientos', 'ahueonamiento', 'ahueonamientos']),
  term('chuchesumadre', 'high', ['chuchesumadres', 'chuchesumares']),
  term('carewea', 'medium', ['careweas', 'carehuea', 'carehueas', 'carehuevon', 'careweon', 'carehuevón', 'careweón', 'carewn']),
  term('careraja', 'medium', ['carerajas']),
  term('pichula', 'high', ['pichulas', 'pichulazo', 'pichulazos', 'pichulita', 'pichulitas'], 'sexual'),
  term('tula', 'high', ['tulas', 'tulazo', 'tulazos'], 'sexual'),

  // Compuestos vulgares: no bloquear por separado instrumentos o partes del relieve.
  term('chupapico', 'high', ['chupapicos', 'chupapiko', 'chupapikos'], 'sexual'),
  term('chupapichula', 'high', ['chupapichulas'], 'sexual'),
  term('chupatula', 'high', ['chupatulas'], 'sexual'),
  term('chupacorneta', 'high', ['chupacornetas'], 'sexual'),
  term('chupaculo', 'medium', ['chupaculos']),
  term('carepico', 'high', ['carepicos', 'carepichula', 'carepichulas', 'carecallampa', 'carecallampas', 'carecorneta', 'carecornetas']),
  term('carechucha', 'high', ['carechuchas']),
  term('careculo', 'high', ['careculos', 'carepoto', 'carepotos']),

  // Insultos usados en Chile, incluidos otros compartidos con el español general.
  term('longi', 'medium', ['longis', 'longhi', 'longhis', 'longiman', 'longimán']),
  term('pajarón', 'medium', ['pajaron', 'pajarona', 'pajarones', 'pajaronas']),
  term('soperutano', 'medium', ['soperutana', 'soperutanos', 'soperutanas']),
  term('sopenco', 'medium', ['sopenca', 'sopencos', 'sopencas']),
  term('pelmazo', 'medium', ['pelmaza', 'pelmazos', 'pelmazas']),
  term('papanatas', 'low', ['papanata']),
  term('chuchento', 'medium', ['chuchenta', 'chuchentos', 'chuchentas']),
  term('pelafustán', 'medium', ['pelafustan', 'pelafustanes']),
  term('mequetrefe', 'medium', ['mequetrefes']),

  // Descalificaciones discriminatorias. No incorporar nombres neutrales de identidades.
  term('maricueca', 'high', ['maricuecas', 'maricueco', 'maricuecos'], 'slur'),
  term('maraco', 'high', ['maracos', 'marakos', 'marako'], 'slur'),
  term('fleto', 'high', ['fletos'], 'slur'),
  term('colipato', 'high', ['colipatos', 'colipata', 'colipatas'], 'slur'),
];

const phrase = (value: string, severity: Severity, category: Category = 'insult'): PhraseEntry => ({
  phrase: value, words: value.split(' '), language: 'es', severity, category,
});

/**
 * Palabras polisémicas solo en expresiones explícitas: pico, callampa, maraca,
 * corneta, cresta, gil, Perkin y el verbo inglés wear conservan sus usos neutrales.
 * El motor admite ventanas de2a5palabras; usar frases dentro de ese tamaño.
 */
export const CHILEAN_PHRASES: PhraseEntry[] = [
  ...['hi hitler', 'viva hitler'].map(value => phrase(value, 'high', 'hate')),
  ...['ándate a la chucha', 'anda a la chucha', 'ándate a la mierda', 'anda a la mierda', 'vete a la chucha',
    'ándate a la cresta', 'anda a la cresta', 'vete a la cresta', 'concha de tu madre', 'concha de su madre',
    'concha de tu mare', 'concha de su mare'].map(value => phrase(value, 'high')),
  ...['saco de weas', 'saco de hueas', 'saco de huevas', 'saco de huevadas', 'saco de wea',
    'cara de raja', 'care raja', 'cara de poto', 'care poto', 'cara de pico', 'care pico',
    'cara de chucha', 'care chucha', 'cara de callampa', 'care callampa'].map(value => phrase(value, 'medium')),
  ...['vales callampa', 'valís callampa', 'vale callampa', 'valen callampa', 'vales una callampa',
    'valís una callampa', 'vale una callampa', 'valen una callampa', 'vales hongo', 'valís hongo',
    'eres penca', 'erís penca', 'eri penca', 'soi penca', 'son pencas'].map(value => phrase(value, 'low')),
  ...['deja de wear', 'para de wear', 'dejen de wear'].map(value => phrase(value, 'low', 'other')),
  ...['eres un perkin', 'erís un perkin', 'eri un perkin', 'soi un perkin', 'son unos perkin', 'son unos perkines',
    'eres un gil', 'erís un gil', 'eri un gil', 'soi un gil', 'son unos giles',
    'eres un saco de pelotas', 'erís un saco de pelotas', 'soi un saco de pelotas'].map(value => phrase(value, 'medium')),
  ...['eres una maraca', 'erís una maraca', 'eri una maraca', 'soi una maraca'].map(value => phrase(value, 'high', 'slur')),
  ...['chupa el pico', 'chúpame el pico', 'chupa pico', 'chúpame la corneta', 'chupa la corneta',
    'chupa pichula', 'chúpame la pichula', 'chupa la tula', 'chúpame la tula',
    'pico pal que lee', 'pico para el que lee'].map(value => phrase(value, 'high', 'sexual')),
  ...['me importa un pico', 'está como el pico', 'quedó como el pico', 'funciona como el pico'].map(value => phrase(value, 'medium', 'other')),
  ...['te saco la cresta', 'sacarte la cresta', 'te reviento a combos', 'te voy a reventar',
    'te voy a pegar', 'te voy a apuñalar', 'te voy a acuchillar', 'te voy a matar'].map(value => phrase(value, 'high', 'threat')),
];
