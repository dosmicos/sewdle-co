/**
 * Colombian Geography: Complete City-Department mapping for address validation.
 * Source: DANE DIVIPOLA (Division Politico-Administrativa de Colombia)
 * ~1,103 municipalities across 32 departments + Bogota D.C.
 *
 * Used to detect when a Shopify order has a city that doesn't match its department.
 */

/**
 * Normalize a geographic name: lowercase, strip accents, trim extra spaces.
 */
export function normalizeGeoName(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize Shopify province/department field to a canonical department key.
 * Handles variants like "Bogota D.C.", "Bogota, D.C.", "Distrito Capital", etc.
 */
function normalizeProvince(province: string): string {
  let p = normalizeGeoName(province);
  // Bogota variants
  if (p.includes('bogota') || p.includes('distrito capital') || p === 'dc') {
    return 'bogota dc';
  }
  // Remove common suffixes
  p = p.replace(/\s*dc$/, '').replace(/\s*d\s*c$/, '');
  return p;
}

// ============================================================
// DEPARTMENT -> CITIES MAP (DANE DIVIPOLA - Complete)
// All names must be normalized (lowercase, no accents).
// ============================================================
const DEPARTMENT_CITIES: Record<string, string[]> = {
  'bogota dc': [
    'bogota', 'bogota dc', 'bogota d c',
  ],

  'amazonas': [
    'leticia', 'puerto narino',
  ],

  'antioquia': [
    'abejorral', 'abriaqui', 'alejandria', 'amaga', 'amalfi', 'andes',
    'angelopolis', 'angostura', 'anori', 'anza', 'apartado', 'arboletes',
    'argelia', 'armenia', 'barbosa', 'bello', 'belmira', 'betania',
    'betulia', 'briceno', 'buritica', 'caceres', 'caicedo', 'caldas',
    'campamento', 'canasgordas', 'caracoli', 'caramanta', 'carepa',
    'carolina del principe', 'caucasia', 'chigorodo', 'cisneros',
    'ciudad bolivar', 'cocorna', 'concepcion', 'concordia', 'copacabana',
    'dabeiba', 'donmatias', 'ebejico', 'el bagre', 'el carmen de viboral',
    'el penol', 'el retiro', 'el santuario', 'entrerios', 'envigado',
    'fredonia', 'frontino', 'giraldo', 'girardota', 'gomez plata',
    'granada', 'guadalupe', 'guarne', 'guatape', 'heliconia', 'hispania',
    'itagui', 'ituango', 'jardin', 'jerico', 'la ceja', 'la estrella',
    'la pintada', 'la union', 'liborina', 'maceo', 'marinilla', 'medellin',
    'montebello', 'murindo', 'mutata', 'narino', 'nechi', 'necocli',
    'olaya', 'peque', 'pueblorrico', 'puerto berrio', 'puerto nare',
    'puerto triunfo', 'remedios', 'rionegro', 'sabanalarga', 'sabaneta',
    'salgar', 'san andres de cuerquia', 'san carlos', 'san francisco',
    'san jeronimo', 'san jose de la montana', 'san juan de uraba',
    'san luis', 'san pedro de los milagros', 'san pedro de uraba',
    'san rafael', 'san roque', 'san vicente', 'santa barbara',
    'santa fe de antioquia', 'santa rosa de osos', 'santo domingo',
    'segovia', 'sonson', 'sopetran', 'tamesis', 'taraza', 'tarso',
    'titiribi', 'toledo', 'turbo', 'uramita', 'urrao', 'valdivia',
    'valparaiso', 'vegachi', 'venecia', 'vigia del fuerte', 'yali',
    'yarumal', 'yolombo', 'yondo', 'zaragoza',
  ],

  'arauca': [
    'arauca', 'arauquita', 'cravo norte', 'fortul', 'puerto rondon',
    'saravena', 'tame',
  ],

  'atlantico': [
    'baranoa', 'barranquilla', 'campo de la cruz', 'candelaria', 'galapa',
    'juan de acosta', 'luruaco', 'malambo', 'manati', 'palmar de varela',
    'piojo', 'polonuevo', 'ponedera', 'puerto colombia', 'repelon',
    'sabanagrande', 'sabanalarga', 'santa lucia', 'santo tomas', 'soledad',
    'suan', 'tubara', 'usiacuri',
  ],

  'bolivar': [
    'achi', 'altos del rosario', 'arenal', 'arjona', 'arroyohondo',
    'barranco de loba', 'calamar', 'cantagallo', 'cartagena',
    'cartagena de indias', 'cicuco', 'clemencia', 'cordoba',
    'el carmen de bolivar', 'el guamo', 'el penon', 'hatillo de loba',
    'magangue', 'mahates', 'margarita', 'maria la baja', 'mompos',
    'montecristo', 'morales', 'norosi', 'pinillos', 'regidor',
    'rio viejo', 'san cristobal', 'san estanislao', 'san fernando',
    'san jacinto', 'san jacinto del cauca', 'san juan nepomuceno',
    'san martin de loba', 'san pablo', 'santa catalina', 'santa rosa',
    'santa rosa del sur', 'simiti', 'soplaviento', 'talaigua nuevo',
    'tiquisio', 'turbaco', 'turbana', 'villanueva', 'zambrano',
  ],

  'boyaca': [
    'almeida', 'aquitania', 'arcabuco', 'belen', 'berbeo', 'beteitiva',
    'boavita', 'boyaca', 'briceno', 'buenavista', 'busbanza', 'caldas',
    'campohermoso', 'cerinza', 'chinavita', 'chiquinquira', 'chiquiza',
    'chiscas', 'chita', 'chitaraque', 'chivata', 'chivor', 'cienega',
    'combita', 'coper', 'corrales', 'covarachia', 'cubara', 'cucaita',
    'cuitiva', 'duitama', 'el cocuy', 'el espino', 'firavitoba',
    'floresta', 'gachantiva', 'gameza', 'garagoa', 'guacamayas',
    'guateque', 'guayata', 'guican', 'iza', 'jenesano', 'jerico',
    'la capilla', 'la uvita', 'la victoria', 'labranzagrande', 'macanal',
    'maripi', 'miraflores', 'mongua', 'mongui', 'moniquira', 'motavita',
    'muzo', 'nobsa', 'nuevo colon', 'oicata', 'otanche', 'pachavita',
    'paez', 'paipa', 'pajarito', 'panqueba', 'pauna', 'paya',
    'paz del rio', 'pesca', 'pisba', 'puerto boyaca', 'quipama',
    'ramiriqui', 'raquira', 'rondon', 'saboya', 'sachica', 'samaca',
    'san eduardo', 'san jose de pare', 'san luis de gaceno', 'san mateo',
    'san miguel de sema', 'san pablo de borbur', 'santa maria',
    'santa rosa de viterbo', 'santa sofia', 'santana', 'sativanorte',
    'sativasur', 'siachoque', 'soata', 'socha', 'socota', 'sogamoso',
    'somondoco', 'sora', 'soraca', 'sotaquira', 'susacon', 'sutamarchan',
    'sutatenza', 'tasco', 'tenza', 'tibana', 'tibasosa', 'tinjaca',
    'tipacoque', 'toca', 'togui', 'topaga', 'tota', 'tunja', 'tunungua',
    'turmeque', 'tuta', 'tutaza', 'umbita', 'ventaquemada',
    'villa de leyva', 'viracacha', 'zetaquira',
  ],

  'caldas': [
    'aguadas', 'anserma', 'aranzazu', 'belalcazar', 'chinchina',
    'filadelfia', 'la dorada', 'la merced', 'manizales', 'manzanares',
    'marmato', 'marquetalia', 'marulanda', 'neira', 'norcasia', 'pacora',
    'palestina', 'pensilvania', 'riosucio', 'risaralda', 'salamina',
    'samana', 'san jose', 'supia', 'victoria', 'villamaria', 'viterbo',
  ],

  'caqueta': [
    'albania', 'belen de los andaquies', 'cartagena del chaira', 'curillo',
    'el doncello', 'el paujil', 'florencia', 'la montanita', 'milan',
    'morelia', 'puerto rico', 'san jose del fragua', 'san vicente del caguan',
    'solano', 'solita', 'valparaiso',
  ],

  'casanare': [
    'aguazul', 'chameza', 'hato corozal', 'la salina', 'mani', 'monterrey',
    'nunchia', 'orocue', 'paz de ariporo', 'pore', 'recetor', 'sabanalarga',
    'sacama', 'san luis de palenque', 'tamara', 'tauramena', 'trinidad',
    'villanueva', 'yopal',
  ],

  'cauca': [
    'almaguer', 'argelia', 'balboa', 'bolivar', 'buenos aires', 'cajibio',
    'caldono', 'caloto', 'corinto', 'el tambo', 'florencia', 'guachene',
    'guapi', 'inza', 'jambalo', 'la sierra', 'la vega', 'lopez de micay',
    'mercaderes', 'miranda', 'morales', 'padilla', 'paez', 'patia',
    'piamonte', 'piendamo', 'popayan', 'puerto tejada', 'purace', 'rosas',
    'san sebastian', 'santa rosa', 'santander de quilichao', 'silvia',
    'sotara', 'suarez', 'sucre', 'timbio', 'timbiqui', 'toribio',
    'totoro', 'villa rica',
  ],

  'cesar': [
    'aguachica', 'agustin codazzi', 'astrea', 'becerril', 'bosconia',
    'chimichagua', 'chiriguana', 'codazzi', 'curumani', 'el copey',
    'el paso', 'gamarra', 'gonzalez', 'la gloria', 'la jagua de ibirico',
    'la paz', 'manaure balcon del cesar', 'manaure', 'pailitas', 'pelaya',
    'pueblo bello', 'rio de oro', 'robles la paz', 'san alberto',
    'san diego', 'san martin', 'tamalameque', 'valledupar',
  ],

  'choco': [
    'acandi', 'alto baudo', 'atrato', 'bagado', 'bahia solano',
    'bajo baudo', 'bojaya', 'canton de san pablo', 'certegui', 'condoto',
    'el atrato', 'el carmen de atrato', 'el carmen del darien',
    'el canton del san pablo', 'istmina', 'jurado', 'litoral de san juan',
    'litoral del san juan', 'lloro', 'medio atrato', 'medio baudo',
    'medio san juan', 'novita', 'nuqui', 'quibdo', 'rio iro', 'rio quito',
    'riosucio', 'san jose del palmar', 'sipi', 'tado',
    'union panamericana', 'unguia',
  ],

  'cordoba': [
    'ayapel', 'buenavista', 'canalete', 'cerete', 'chima', 'chinu',
    'cienaga de oro', 'cotorra', 'la apartada', 'lorica', 'los cordobas',
    'momil', 'montelibano', 'monteria', 'monitos', 'planeta rica',
    'pueblo nuevo', 'puerto escondido', 'puerto libertador', 'purisima',
    'sahagun', 'san andres de sotavento', 'san antero',
    'san bernardo del viento', 'san carlos', 'san jose de ure',
    'san pelayo', 'tierralta', 'tuchin', 'valencia',
  ],

  'cundinamarca': [
    'agua de dios', 'alban', 'anapoima', 'anolaima', 'apulo', 'arbelaez',
    'beltran', 'bituima', 'bojaca', 'cabrera', 'cachipay', 'cajica',
    'caparrapi', 'caqueza', 'carmen de carupa', 'chaguani', 'chia',
    'chipaque', 'choachi', 'choconta', 'cogua', 'cota', 'cucunuba',
    'el colegio', 'el penon', 'el rosal', 'facatativa', 'fomeque',
    'fosca', 'funza', 'fuquene', 'fusagasuga', 'gachala', 'gachancipa',
    'gacheta', 'gama', 'girardot', 'granada', 'guacheta', 'guaduas',
    'guasca', 'guataqui', 'guatavita', 'guayabal de siquima',
    'guayabetal', 'gutierrez', 'jerusalen', 'junin', 'la calera',
    'la mesa', 'la palma', 'la pena', 'la vega', 'lenguazaque',
    'macheta', 'madrid', 'manta', 'medina', 'mosquera', 'narino',
    'nemocon', 'nilo', 'nimaima', 'nocaima', 'pacho', 'paime', 'pandi',
    'paratebueno', 'pasca', 'puerto salgar', 'puli', 'quebradanegra',
    'quetame', 'quipile', 'ricaurte', 'san antonio del tequendama',
    'san bernardo', 'san cayetano', 'san francisco', 'san juan de rioseco',
    'sasaima', 'sesquile', 'sibate', 'silvania', 'simijaca', 'soacha',
    'sopo', 'subachoque', 'suesca', 'supata', 'susa', 'sutatausa',
    'tabio', 'tausa', 'tena', 'tenjo', 'tibacuy', 'tibirita', 'tocaima',
    'tocancipa', 'topaipi', 'ubala', 'ubaque', 'ubate', 'une', 'utica',
    'venecia', 'vergara', 'viani', 'villagomez', 'villapinzon', 'villeta',
    'viota', 'yacopi', 'zipacon', 'zipaquira',
  ],

  'guainia': [
    'inirida',
  ],

  'guaviare': [
    'calamar', 'el retorno', 'miraflores', 'san jose del guaviare',
  ],

  'huila': [
    'acevedo', 'agrado', 'aipe', 'algeciras', 'altamira', 'baraya',
    'campoalegre', 'colombia', 'el pital', 'elias', 'garzon', 'gigante',
    'guadalupe', 'hobo', 'iquira', 'isnos', 'la argentina', 'la plata',
    'nataga', 'neiva', 'oporapa', 'paicol', 'palermo', 'palestina',
    'pitalito', 'rivera', 'saladoblanco', 'san agustin', 'santa maria',
    'suaza', 'tarqui', 'tello', 'teruel', 'tesalia', 'timana',
    'villavieja', 'yaguara',
  ],

  'la guajira': [
    'albania', 'barrancas', 'dibulla', 'distraccion', 'el molino',
    'fonseca', 'hatonuevo', 'la jagua del pilar', 'maicao', 'manaure',
    'riohacha', 'san juan del cesar', 'uribia', 'urumita', 'villanueva',
  ],

  'magdalena': [
    'algarrobo', 'aracataca', 'ariguani', 'cerro de san antonio',
    'chibolo', 'cienaga', 'concordia', 'el banco', 'el pinon', 'el reten',
    'fundacion', 'guamal', 'nueva granada', 'pedraza', 'pijino del carmen',
    'pivijay', 'plato', 'pueblo viejo', 'remolino',
    'sabanas de san angel', 'salamina', 'san sebastian de buenavista',
    'san zenon', 'santa ana', 'santa barbara de pinto', 'santa marta',
    'sitionuevo', 'tenerife', 'zapayan', 'zona bananera',
  ],

  'meta': [
    'acacias', 'barranca de upia', 'cabuyaro', 'castilla la nueva',
    'cubarral', 'cumaral', 'el calvario', 'el castillo', 'el dorado',
    'fuente de oro', 'granada', 'guamal', 'la macarena', 'la uribe',
    'lejanias', 'mapiripan', 'mesetas', 'puerto concordia', 'puerto gaitan',
    'puerto lleras', 'puerto lopez', 'puerto rico', 'restrepo',
    'san carlos de guaroa', 'san juan de arama', 'san juanito',
    'san martin', 'villavicencio', 'vista hermosa',
  ],

  'narino': [
    'aldana', 'ancuya', 'arboleda', 'barbacoas', 'belen', 'buesaco',
    'chachagui', 'colon', 'consaca', 'contadero', 'cordoba', 'cuaspud',
    'cumbal', 'cumbitara', 'el charco', 'el penol', 'el rosario',
    'el tablon', 'el tambo', 'francisco pizarro', 'funes', 'guachucal',
    'guaitarilla', 'gualmatan', 'iles', 'imuez', 'ipiales', 'la cruz',
    'la florida', 'la llanada', 'la tola', 'la union', 'leiva', 'linares',
    'los andes', 'magui payan', 'mallama', 'mosquera', 'narino',
    'olaya herrera', 'ospina', 'pasto', 'policarpa', 'potosi',
    'providencia', 'puerres', 'pupiales', 'ricaurte', 'roberto payan',
    'samaniego', 'san bernardo', 'san jose de alban', 'san lorenzo',
    'san pablo', 'san pedro de cartago', 'sandona', 'santa barbara',
    'santacruz', 'sapuyes', 'taminango', 'tangua', 'tumaco', 'tuquerres',
    'yacuanquer',
  ],

  'norte de santander': [
    'abrego', 'arboledas', 'bochalema', 'bucarasica', 'cachira', 'cacota',
    'chinacota', 'chitaga', 'convencion', 'cucuta', 'cucutilla', 'durania',
    'el carmen', 'el tarra', 'el zulia', 'gramalote', 'hacari', 'herran',
    'la esperanza', 'la playa de belen', 'la playa', 'labateca',
    'los patios', 'lourdes', 'mutiscua', 'ocana', 'pamplona',
    'pamplonita', 'puerto santander', 'ragonvalia',
    'salazar de las palmas', 'salazar', 'san calixto', 'san cayetano',
    'santiago', 'santo domingo de silos', 'silos', 'sardinata', 'teorama',
    'tibu', 'toledo', 'villa caro', 'villa del rosario',
  ],

  'putumayo': [
    'colon', 'mocoa', 'orito', 'puerto asis', 'puerto caicedo',
    'puerto guzman', 'puerto leguizamo', 'leguizamo', 'san francisco',
    'san miguel', 'santiago', 'sibundoy', 'valle del guamuez',
    'la hormiga', 'villagarzon',
  ],

  'quindio': [
    'armenia', 'buenavista', 'calarca', 'circasia', 'cordoba', 'filandia',
    'genova', 'la tebaida', 'montenegro', 'pijao', 'quimbaya', 'salento',
  ],

  'risaralda': [
    'apia', 'balboa', 'belen de umbria', 'dosquebradas', 'guatica',
    'la celia', 'la virginia', 'marsella', 'mistrato', 'pereira',
    'pueblo rico', 'quinchia', 'santa rosa de cabal', 'santuario',
  ],

  'san andres y providencia': [
    'san andres', 'providencia', 'providencia y santa catalina',
  ],

  'santander': [
    'aguada', 'albania', 'aratoca', 'barbosa', 'barichara',
    'barrancabermeja', 'betulia', 'bolivar', 'bucaramanga', 'cabrera',
    'california', 'capitanejo', 'carcasi', 'cepita', 'cerrito', 'charala',
    'charta', 'chima', 'chipata', 'cimitarra', 'concepcion', 'confines',
    'contratacion', 'coromoro', 'curiti', 'el carmen de chucuri',
    'el guacamayo', 'el penon', 'el playon', 'el socorro', 'encino',
    'enciso', 'florian', 'floridablanca', 'galan', 'gambita', 'giron',
    'guaca', 'guadalupe', 'guapota', 'guavata', 'guepsa', 'hato',
    'jesus maria', 'jordan', 'la belleza', 'la paz', 'landazuri',
    'lebrija', 'los santos', 'macaravita', 'malaga', 'matanza', 'mogotes',
    'molagavita', 'ocamonte', 'oiba', 'onzaga', 'palmar',
    'palmas del socorro', 'paramo', 'piedecuesta', 'pinchote',
    'puente nacional', 'puerto parra', 'puerto wilches', 'rionegro',
    'sabana de torres', 'san andres', 'san benito', 'san gil',
    'san joaquin', 'san jose de miranda', 'san miguel',
    'san vicente de chucuri', 'santa barbara', 'santa helena del opon',
    'simacota', 'socorro', 'suaita', 'sucre', 'surata', 'tona',
    'valle de san jose', 'velez', 'vetas', 'villanueva', 'zapatoca',
  ],

  'sucre': [
    'buenavista', 'caimito', 'chalan', 'coloso', 'corozal', 'covenas',
    'el roble', 'galeras', 'guaranda', 'la union', 'los palmitos',
    'majagual', 'morroa', 'ovejas', 'sampues', 'san antonio de palmito',
    'san benito abad', 'san juan de betulia', 'san marcos', 'san onofre',
    'san pedro', 'since', 'sincelejo', 'sucre', 'santiago de tolu', 'tolu',
    'tolu viejo', 'toluviejo',
  ],

  'tolima': [
    'alpujarra', 'alvarado', 'ambalema', 'anzoategui', 'armero',
    'armero guayabal', 'ataco', 'cajamarca', 'carmen de apicala',
    'casabianca', 'chaparral', 'coello', 'coyaima', 'cunday', 'dolores',
    'espinal', 'el espinal', 'falan', 'flandes', 'fresno', 'guamo',
    'herveo', 'honda', 'ibague', 'icononzo', 'lerida', 'libano',
    'mariquita', 'melgar', 'murillo', 'natagaima', 'ortega',
    'palocabildo', 'piedras', 'planadas', 'prado', 'purificacion',
    'rioblanco', 'roncesvalles', 'rovira', 'saldana', 'san antonio',
    'san luis', 'santa isabel', 'suarez', 'valle de san juan', 'venadillo',
    'villahermosa', 'villarrica',
  ],

  'valle del cauca': [
    'alcala', 'andalucia', 'ansermanuevo', 'argelia', 'bolivar',
    'buenaventura', 'buga', 'guadalajara de buga', 'bugalagrande',
    'caicedonia', 'cali', 'calima', 'calima el darien', 'candelaria',
    'cartago', 'dagua', 'el aguila', 'el cairo', 'el cerrito', 'el dovio',
    'florida', 'ginebra', 'guacari', 'jamundi', 'la cumbre', 'la union',
    'la victoria', 'obando', 'palmira', 'pradera', 'restrepo', 'riofrio',
    'roldanillo', 'san pedro', 'sevilla', 'toro', 'trujillo', 'tulua',
    'ulloa', 'versalles', 'vijes', 'yotoco', 'yumbo', 'zarzal',
  ],

  'vaupes': [
    'caruru', 'mitu', 'taraira',
  ],

  'vichada': [
    'cumaribo', 'la primavera', 'puerto carreno', 'santa rosalia',
  ],
};

// ============================================================
// Build reverse lookup: city -> department(s)
// ============================================================
const CITY_TO_DEPARTMENTS = new Map<string, string[]>();
const ALL_DEPARTMENTS = new Set<string>();

for (const [dept, cities] of Object.entries(DEPARTMENT_CITIES)) {
  ALL_DEPARTMENTS.add(dept);
  for (const city of cities) {
    const existing = CITY_TO_DEPARTMENTS.get(city) || [];
    existing.push(dept);
    CITY_TO_DEPARTMENTS.set(city, existing);
  }
}

// Bogota is its own district (Bogota D.C.), NOT part of Cundinamarca
// If someone puts city=Bogota + province=Cundinamarca, that's a mismatch

// Cities that exist in multiple departments
const AMBIGUOUS_CITIES = new Set<string>();
for (const [city, depts] of CITY_TO_DEPARTMENTS) {
  if (depts.length > 1) {
    AMBIGUOUS_CITIES.add(city);
  }
}

// Province code -> department name mapping (Shopify uses these)
const PROVINCE_CODE_TO_DEPT: Record<string, string> = {
  'bog': 'bogota dc', 'dc': 'bogota dc', 'co-dc': 'bogota dc',
  'ant': 'antioquia', 'co-ant': 'antioquia',
  'atl': 'atlantico', 'co-atl': 'atlantico',
  'bol': 'bolivar', 'co-bol': 'bolivar',
  'boy': 'boyaca', 'co-boy': 'boyaca',
  'cal': 'caldas', 'co-cal': 'caldas',
  'caq': 'caqueta', 'co-caq': 'caqueta',
  'cas': 'casanare', 'co-cas': 'casanare',
  'cau': 'cauca', 'co-cau': 'cauca',
  'ces': 'cesar', 'co-ces': 'cesar',
  'cho': 'choco', 'co-cho': 'choco',
  'cor': 'cordoba', 'co-cor': 'cordoba',
  'cun': 'cundinamarca', 'co-cun': 'cundinamarca',
  'gua': 'guainia', 'co-gua': 'guainia',
  'guv': 'guaviare', 'co-guv': 'guaviare',
  'hui': 'huila', 'co-hui': 'huila',
  'lag': 'la guajira', 'co-lag': 'la guajira',
  'mag': 'magdalena', 'co-mag': 'magdalena',
  'met': 'meta', 'co-met': 'meta',
  'nar': 'narino', 'co-nar': 'narino',
  'nsa': 'norte de santander', 'co-nsa': 'norte de santander',
  'put': 'putumayo', 'co-put': 'putumayo',
  'qui': 'quindio', 'co-qui': 'quindio',
  'ris': 'risaralda', 'co-ris': 'risaralda',
  'sap': 'san andres y providencia', 'co-sap': 'san andres y providencia',
  'san': 'santander', 'co-san': 'santander',
  'suc': 'sucre', 'co-suc': 'sucre',
  'tol': 'tolima', 'co-tol': 'tolima',
  'vac': 'valle del cauca', 'co-vac': 'valle del cauca',
  'vau': 'vaupes', 'co-vau': 'vaupes',
  'vid': 'vichada', 'co-vid': 'vichada', 'vic': 'vichada', 'co-vic': 'vichada',
  'ara': 'arauca', 'co-ara': 'arauca',
  'ama': 'amazonas', 'co-ama': 'amazonas',
};

/**
 * Validate that a city belongs to the claimed department/province.
 * Returns { valid: true } if the pair is correct or unverifiable.
 * Returns { valid: false, expectedDepartment } if there's a mismatch.
 */
export function validateCityDepartment(
  city: string,
  province: string,
  provinceCode?: string
): { valid: boolean; expectedDepartment?: string } {
  const normalizedCity = normalizeGeoName(city);
  const normalizedProvince = normalizeProvince(province);

  // Also try province_code for the claimed department
  let claimedDept = normalizedProvince;
  if (provinceCode) {
    const codeNorm = normalizeGeoName(provinceCode);
    const fromCode = PROVINCE_CODE_TO_DEPT[codeNorm];
    if (fromCode) {
      claimedDept = fromCode;
    }
  }

  // Look up the city
  const validDepts = CITY_TO_DEPARTMENTS.get(normalizedCity);

  if (!validDepts) {
    // City not in our database — can't validate, assume valid
    return { valid: true };
  }

  // Check if the claimed department matches any valid department for this city
  for (const validDept of validDepts) {
    if (validDept === claimedDept) {
      return { valid: true };
    }
    // Fuzzy: check if one contains the other (handles "bogota dc" vs "bogota d.c.")
    if (claimedDept.includes(validDept) || validDept.includes(claimedDept)) {
      return { valid: true };
    }
  }

  // Mismatch! Return the most likely correct department
  // For ambiguous cities, return the first (most common) department
  const expectedDept = validDepts[0];

  // Convert back to a displayable department name
  const displayDept = getDisplayDepartment(expectedDept);

  return { valid: false, expectedDepartment: displayDept };
}

/**
 * Convert a normalized department key back to display form.
 */
function getDisplayDepartment(normalized: string): string {
  const DISPLAY_NAMES: Record<string, string> = {
    'bogota dc': 'Bogotá, D.C.',
    'cundinamarca': 'Cundinamarca',
    'antioquia': 'Antioquia',
    'valle del cauca': 'Valle del Cauca',
    'atlantico': 'Atlantico',
    'bolivar': 'Bolivar',
    'santander': 'Santander',
    'norte de santander': 'Norte de Santander',
    'risaralda': 'Risaralda',
    'tolima': 'Tolima',
    'caldas': 'Caldas',
    'meta': 'Meta',
    'huila': 'Huila',
    'narino': 'Narino',
    'cordoba': 'Cordoba',
    'boyaca': 'Boyaca',
    'cauca': 'Cauca',
    'magdalena': 'Magdalena',
    'cesar': 'Cesar',
    'quindio': 'Quindio',
    'sucre': 'Sucre',
    'la guajira': 'La Guajira',
    'casanare': 'Casanare',
    'arauca': 'Arauca',
    'putumayo': 'Putumayo',
    'caqueta': 'Caqueta',
    'choco': 'Choco',
    'amazonas': 'Amazonas',
    'guainia': 'Guainia',
    'guaviare': 'Guaviare',
    'vaupes': 'Vaupes',
    'vichada': 'Vichada',
    'san andres y providencia': 'San Andres y Providencia',
  };
  return DISPLAY_NAMES[normalized] || normalized;
}
