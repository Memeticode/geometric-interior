/**
 * Phrase banks for alt-text generation.
 *
 * Organisation: each bank is a 2D array indexed [level][synonym].
 * Levels are quantised from [0,1] parameter values.
 * EN and ES are co-located for maintainability.
 *
 * Naming convention:
 *   SECTION_AXIS  e.g.  SCENE_LUM, GEO_DENSITY
 */

/* ── Types ── */

/** A graded bank: bank[level] holds synonyms for that intensity. */
export type GradedBank = readonly (readonly string[])[];

/** EN + ES graded banks side by side. */
export interface L10nBank { readonly en: GradedBank; readonly es: GradedBank }

/** Simple word list per locale. */
export interface L10nList { readonly en: readonly string[]; readonly es: readonly string[] }

/* ════════════════════════════════════════════════════════════════
   SUMMARY COMPONENTS  (composed into the ≤140-char brief line)
   ════════════════════════════════════════════════════════════════ */

/** density → population adjective */
export const SUM_DENSITY: L10nBank = {
    en: [
        ['sparse', 'isolated'],
        ['scattered', 'few'],
        ['moderate', 'measured'],
        ['layered', 'overlapping'],
        ['dense', 'concentrated'],
    ],
    es: [
        ['dispersas', 'aisladas'],
        ['esparcidas', 'escasas'],
        ['moderadas', 'mesuradas'],
        ['estratificadas', 'superpuestas'],
        ['densas', 'concentradas'],
    ],
};

/** faceting → surface character word */
export const SUM_FACETING: L10nBank = {
    en: [
        ['smooth', 'flowing'],
        ['broad', 'soft-edged'],
        ['translucent', 'mixed'],
        ['faceted', 'crystalline'],
        ['angular', 'sharp'],
    ],
    es: [
        ['suaves', 'fluidas'],
        ['amplias', 'de bordes suaves'],
        ['translúcidas', 'mixtas'],
        ['facetadas', 'cristalinas'],
        ['angulares', 'afiladas'],
    ],
};

/** scale → element noun */
export const SUM_SCALE: L10nBank = {
    en: [
        ['slabs', 'panels'],
        ['planes', 'plates'],
        ['forms', 'planes'],
        ['fragments', 'shards'],
        ['particles', 'points'],
    ],
    es: [
        ['losas', 'paneles'],
        ['planos', 'placas'],
        ['formas', 'planos'],
        ['fragmentos', 'esquirlas'],
        ['partículas', 'puntos'],
    ],
};

/** coherence × flow → arrangement verb phrase (3×3 = 9 combos, 2 synonyms) */
export const SUM_ARRANGEMENT: { en: readonly (readonly string[])[]; es: readonly (readonly string[])[] } = {
    en: [
        /* chaotic-radial   */ ['drift freely', 'scatter without order'],
        /* chaotic-organic   */ ['disperse in every direction', 'scatter chaotically'],
        /* chaotic-orbital   */ ['tumble in disorder', 'scatter turbulently'],
        /* loose-radial      */ ['radiate loosely', 'spread from center'],
        /* loose-organic     */ ['drift in organic paths', 'flow loosely'],
        /* loose-orbital     */ ['spiral gently', 'orbit loosely'],
        /* structured-radial */ ['emanate radially', 'radiate from center'],
        /* structured-organic*/ ['follow a coherent flow', 'stream in formation'],
        /* structured-orbital*/ ['orbit in arcs', 'wrap in orbital bands'],
    ],
    es: [
        ['derivan libremente', 'se dispersan sin orden'],
        ['se dispersan en toda dirección', 'se esparcen caóticamente'],
        ['se agitan en desorden', 'se dispersan turbulentamente'],
        ['irradian vagamente', 'se extienden desde el centro'],
        ['derivan en trayectorias orgánicas', 'fluyen libremente'],
        ['espiralan suavemente', 'orbitan sueltas'],
        ['emanan radialmente', 'irradian desde el centro'],
        ['siguen un flujo coherente', 'fluyen en formación'],
        ['orbitan en arcos', 'se envuelven en bandas orbitales'],
    ],
};

/** bloom → light quality phrase */
export const SUM_BLOOM: L10nBank = {
    en: [
        ['with concentrated light', 'with precise light'],
        ['with contained glow', 'with tight radiance'],
        ['with soft halos', 'with gentle glow'],
        ['with spreading light', 'with luminous halos'],
        ['in diffuse atmospheric glow', 'in radiant haze'],
    ],
    es: [
        ['con luz concentrada', 'con luz precisa'],
        ['con brillo contenido', 'con radiancia ajustada'],
        ['con halos suaves', 'con resplandor gentil'],
        ['con luz expansiva', 'con halos luminosos'],
        ['en brillo atmosférico difuso', 'en bruma radiante'],
    ],
};

/* ════════════════════════════════════════════════════════════════
   EXPANDED — Sentence 1: SCENE  (luminosity primary, bloom modifier)
   ════════════════════════════════════════════════════════════════ */

export const SCENE_LUM: L10nBank = {
    en: [
        /* 0  near-black */
        [
            'Against near-total darkness, the faintest geometric traces resolve at the threshold of visibility',
            'From impenetrable blackness, forms surface carrying barely perceptible light',
            'In the deepest darkness, structures exist as little more than the idea of geometry',
        ],
        /* 1  dark */
        [
            'Deep darkness holds these geometric forms, each surface a quiet assertion against the void',
            'From profound shadow, shapes emerge carrying their own faint interior light',
            'Geometric structures surface from deep shadow, their edges the only evidence of dimension',
        ],
        /* 2  dim */
        [
            'A dim interior suspends these forms in quiet twilight, surfaces catching residual light',
            'Subdued illumination reveals geometry in tonal whispers rather than declarations',
            'In low ambient light, the geometric planes become visible through gentle self-luminescence',
        ],
        /* 3  moderate-low */
        [
            'Soft contemplative light reveals the geometry of this interior space',
            'A gently lit field holds these geometric planes in readable suspension',
            'Moderate illumination fills the space, geometry neither hidden nor fully exposed',
        ],
        /* 4  moderate-high */
        [
            'Steady luminosity defines every geometric surface with quiet clarity',
            'Clear light fills the space, translucent planes revealing their full structural character',
            'The geometric forms inhabit a well-lit interior, every edge and surface articulated',
        ],
        /* 5  bright */
        [
            'Bright light radiates from and through every geometric surface with energetic presence',
            'Luminous intensity illuminates the structure from within, surfaces alive with radiance',
            'The forms glow with substantial internal energy, light pressing outward through every plane',
        ],
        /* 6  blazing */
        [
            'Intense, almost overwhelming radiance floods every surface of this geometric interior',
            'Maximum luminous energy saturates the field, geometry blazing at the edge of dissolution',
            'Brilliant intensity engulfs the structure, each plane a source of concentrated radiant power',
        ],
    ],
    es: [
        [
            'Contra una oscuridad casi total, los más tenues trazos geométricos se resuelven en el umbral de la visibilidad',
            'Desde una negrura impenetrable, las formas emergen portando luz apenas perceptible',
            'En la oscuridad más profunda, las estructuras existen como poco más que la idea de geometría',
        ],
        [
            'La oscuridad profunda sostiene estas formas geométricas, cada superficie una afirmación silenciosa contra el vacío',
            'Desde una sombra profunda, las formas emergen portando su propia luz interior tenue',
            'Estructuras geométricas emergen de la sombra profunda, sus bordes la única evidencia de dimensión',
        ],
        [
            'Un interior tenue suspende estas formas en un crepúsculo quieto, superficies capturando luz residual',
            'Una iluminación sutil revela la geometría en susurros tonales más que en declaraciones',
            'En luz ambiental baja, los planos geométricos se hacen visibles a través de una suave autoluminiscencia',
        ],
        [
            'Una luz contemplativa y suave revela la geometría de este espacio interior',
            'Un campo gentilmente iluminado sostiene estos planos geométricos en suspensión legible',
            'Una iluminación moderada llena el espacio, la geometría ni oculta ni plenamente expuesta',
        ],
        [
            'Una luminosidad estable define cada superficie geométrica con claridad tranquila',
            'La luz clara llena el espacio, planos translúcidos revelando su carácter estructural completo',
            'Las formas geométricas habitan un interior bien iluminado, cada borde y superficie articulados',
        ],
        [
            'Luz brillante irradia desde y a través de cada superficie geométrica con presencia energética',
            'Una intensidad luminosa ilumina la estructura desde dentro, superficies vivas de radiancia',
            'Las formas resplandecen con sustancial energía interna, la luz presionando hacia afuera por cada plano',
        ],
        [
            'Una radiancia intensa, casi abrumadora, inunda cada superficie de este interior geométrico',
            'La máxima energía luminosa satura el campo, la geometría ardiendo al borde de la disolución',
            'Una intensidad brillante envuelve la estructura, cada plano una fuente de poder radiante concentrado',
        ],
    ],
};

/** Bloom modifier clause appended to the scene sentence. */
export const SCENE_BLOOM: L10nBank = {
    en: [
        /* 0  tight */
        [
            ', each point of light sharply defined and precisely contained',
            ', illumination held in tight architectural precision at every edge',
            ', concentrated radiance with no atmospheric spread',
        ],
        /* 1 */
        [
            ', light pooling closely around each surface with contained radiance',
            ', faint halos barely visible at the brightest edges',
        ],
        /* 2 */
        [
            ', modest halos extending from the brightest points',
            ', a subtle glow surrounding the most luminous surfaces',
        ],
        /* 3  moderate */
        [
            ', visible halos framing each geometric surface',
            ', soft aureoles marking the boundary between form and void',
            ', light extending noticeably beyond every edge',
        ],
        /* 4 */
        [
            ', gentle light emanating well beyond each surface into surrounding darkness',
            ', the glow of each plane reaching into the space around it',
        ],
        /* 5 */
        [
            ', spreading aureoles of light merging between adjacent surfaces',
            ', atmospheric radiance softening every geometric boundary',
        ],
        /* 6  atmospheric */
        [
            ', the geometry floating in its own luminous atmosphere where boundaries dissolve',
            ', diffuse atmospheric glow filling the space until forms and light become inseparable',
            ', all-engulfing radiance in which geometry and emanation merge into continuous field',
        ],
    ],
    es: [
        [
            ', cada punto de luz definido con precisión y contenido nítidamente',
            ', la iluminación mantenida con precisa arquitectura en cada borde',
            ', radiancia concentrada sin dispersión atmosférica',
        ],
        [
            ', la luz agrupándose cerca de cada superficie con radiancia contenida',
            ', halos tenues apenas visibles en los bordes más brillantes',
        ],
        [
            ', modestos halos extendiéndose desde los puntos más brillantes',
            ', un brillo sutil rodeando las superficies más luminosas',
        ],
        [
            ', halos visibles enmarcando cada superficie geométrica',
            ', suaves aureolas marcando el límite entre forma y vacío',
            ', la luz extendiéndose notablemente más allá de cada borde',
        ],
        [
            ', luz gentil emanando más allá de cada superficie hacia la oscuridad circundante',
            ', el resplandor de cada plano alcanzando el espacio a su alrededor',
        ],
        [
            ', aureolas de luz expandiéndose y fusionándose entre superficies adyacentes',
            ', radiancia atmosférica suavizando cada límite geométrico',
        ],
        [
            ', la geometría flotando en su propia atmósfera luminosa donde los límites se disuelven',
            ', un brillo atmosférico difuso llenando el espacio hasta que formas y luz se vuelven inseparables',
            ', una radiancia envolvente en la que geometría y emanación se funden en campo continuo',
        ],
    ],
};

/* ════════════════════════════════════════════════════════════════
   EXPANDED — Sentence 2: GEOMETRY
   Primary: density × fracture (5×3 = 15 combos, cross-product)
   Modifiers: faceting clause, coherence×flow clause, division tag
   ════════════════════════════════════════════════════════════════ */

/**
 * Geometry base phrases: density (5 levels) × fracture (3 levels) = 15 cells.
 * Accessed as GEO_FORM[densityLevel * 3 + fractureLevel].
 */
export const GEO_FORM: L10nBank = {
    en: [
        /* sparse-compact */
        [
            'A few bold geometric planes hold together in close crystalline formation',
            'Only a handful of translucent surfaces cluster tightly, each individually legible',
        ],
        /* sparse-moderate */
        [
            'Sparse translucent planes are placed deliberately with moderate separation between them',
            'A small number of geometric forms drift apart at readable distances',
        ],
        /* sparse-shattered */
        [
            'Isolated geometric shards scatter across vast dark space, each a solitary presence',
            'A few fragments disperse widely, separated by expanses of emptiness',
        ],
        /* low-compact */
        [
            'A modest collection of translucent planes fold compactly over one another',
            'Several geometric surfaces layer in close proximity, maintaining structural cohesion',
        ],
        /* low-moderate */
        [
            'A small arrangement of translucent planes spreads with comfortable separation',
            'Geometric forms maintain gentle distance from one another in quiet dispersal',
        ],
        /* low-shattered */
        [
            'Scattered geometric fragments spread across the field in widening dispersal',
            'A handful of shattered forms fling outward from a remembered center',
        ],
        /* moderate-compact */
        [
            'A substantial collection of translucent planes accumulate in a compact crystalline mass',
            'Geometric surfaces layer and fold over one another in concentrated formation',
        ],
        /* moderate-moderate */
        [
            'Translucent planes overlap and drift apart in measured fragmentation',
            'A balanced arrangement of geometric forms occupies the space with moderate scatter',
        ],
        /* moderate-shattered */
        [
            'Geometric forms scatter outward in expanding dispersal, the space between them widening',
            'Translucent planes fragment and spread, structure dissolving into spatial distribution',
        ],
        /* high-compact */
        [
            'Many geometric surfaces crowd together in dense crystalline accumulation',
            'Thick layers of translucent planes pack tightly, surfaces almost merging',
        ],
        /* high-moderate */
        [
            'Many overlapping planes layer and fragment, the accumulation creating visual richness',
            'Dense geometry fills the field with translucent surfaces at varying distances',
        ],
        /* high-shattered */
        [
            'A multitude of geometric shards scatter explosively, filling the space with dispersed fragments',
            'Hundreds of translucent fragments spread in every direction in maximum dispersal',
        ],
        /* dense-compact */
        [
            'An immense concentration of geometric surfaces packs into a solid crystalline mass',
            'Countless translucent planes compress together so densely they approach opacity',
        ],
        /* dense-moderate */
        [
            'A vast population of geometric fragments fills the space, overlapping at every depth',
            'The field teems with translucent surfaces, each partially occluding those behind',
        ],
        /* dense-shattered */
        [
            'An overwhelming swarm of geometric shards explodes outward, each fragment a separate trajectory',
            'Hundreds upon hundreds of translucent particles scatter in every conceivable direction',
        ],
    ],
    es: [
        ['Unos pocos planos geométricos audaces se mantienen juntos en formación cristalina cerrada',
         'Solo un puñado de superficies translúcidas se agrupan estrechamente, cada una individualmente legible'],
        ['Planos translúcidos dispersos se ubican deliberadamente con separación moderada',
         'Un número reducido de formas geométricas se separan a distancias legibles'],
        ['Esquirlas geométricas aisladas se dispersan por el vasto espacio oscuro, cada una una presencia solitaria',
         'Unos pocos fragmentos se dispersan ampliamente, separados por extensiones de vacío'],
        ['Una modesta colección de planos translúcidos se pliegan compactamente unos sobre otros',
         'Varias superficies geométricas se superponen en proximidad cercana, manteniendo cohesión estructural'],
        ['Un pequeño arreglo de planos translúcidos se extiende con separación cómoda',
         'Formas geométricas mantienen distancia gentil entre sí en dispersión tranquila'],
        ['Fragmentos geométricos dispersos se extienden por el campo en dispersión creciente',
         'Un puñado de formas fragmentadas se lanzan hacia afuera desde un centro recordado'],
        ['Una colección sustancial de planos translúcidos se acumula en una masa cristalina compacta',
         'Superficies geométricas se superponen y pliegan unas sobre otras en formación concentrada'],
        ['Planos translúcidos se superponen y separan en fragmentación mesurada',
         'Una disposición equilibrada de formas geométricas ocupa el espacio con dispersión moderada'],
        ['Formas geométricas se dispersan hacia afuera en expansión creciente, el espacio entre ellas ampliándose',
         'Planos translúcidos se fragmentan y esparcen, la estructura disolviéndose en distribución espacial'],
        ['Muchas superficies geométricas se aglomeran en densa acumulación cristalina',
         'Espesas capas de planos translúcidos se comprimen estrechamente, superficies casi fusionándose'],
        ['Muchos planos superpuestos se estratifican y fragmentan, la acumulación creando riqueza visual',
         'Geometría densa llena el campo con superficies translúcidas a distancias variables'],
        ['Una multitud de esquirlas geométricas se dispersan explosivamente, llenando el espacio',
         'Cientos de fragmentos translúcidos se esparcen en toda dirección en máxima dispersión'],
        ['Una inmensa concentración de superficies geométricas se comprime en una masa cristalina sólida',
         'Incontables planos translúcidos se comprimen tan densamente que se aproximan a la opacidad'],
        ['Una vasta población de fragmentos geométricos llena el espacio, superponiéndose en cada profundidad',
         'El campo rebosa de superficies translúcidas, cada una ocluyendo parcialmente las de detrás'],
        ['Un enjambre abrumador de esquirlas geométricas explota hacia afuera, cada fragmento una trayectoria separada',
         'Cientos y cientos de partículas translúcidas se dispersan en toda dirección concebible'],
    ],
};

/** Faceting modifier clause (injected into geometry sentence). */
export const GEO_FACETING: L10nBank = {
    en: [
        [', their surfaces silk-smooth and continuously curved', ', with broad flowing panels and soft edges'],
        [', surfaces mostly smooth with occasional angular interruptions', ', broad panels blending with subtle faceted accents'],
        [', surfaces mixing smooth panels and angular faces in equal measure', ', a blend of flowing curves and crystalline edges'],
        [', their faces sharply faceted with defined crystal character', ', angular surfaces catching light at distinct geometric angles'],
        [', every surface a razor-sharp crystal face with maximum angular precision', ', bristling with tight angular geometry and hard crystalline edges'],
    ],
    es: [
        [', sus superficies suaves como seda y continuamente curvadas', ', con paneles fluidos amplios y bordes suaves'],
        [', superficies mayormente suaves con ocasionales interrupciones angulares', ', paneles amplios mezclándose con sutiles acentos facetados'],
        [', superficies mezclando paneles suaves y caras angulares en igual medida', ', una fusión de curvas fluidas y bordes cristalinos'],
        [', sus caras agudamente facetadas con definido carácter cristalino', ', superficies angulares capturando luz en ángulos geométricos distintos'],
        [', cada superficie una cara cristalina afilada con máxima precisión angular', ', erizadas de geometría angular estrecha y bordes cristalinos duros'],
    ],
};

/** Coherence × flow spatial organisation (3×3 = 9 combos). */
export const GEO_SPATIAL: L10nBank = {
    en: [
        /* chaotic-radial */
        ['The arrangement follows no legible order, fragments drifting without alignment.',
         'No organizing principle governs the dispersal — geometry scatters freely.'],
        /* chaotic-organic */
        ['Geometric planes disperse in every direction without preferred orientation.',
         'The forms scatter with entropic freedom, each element finding its own trajectory.'],
        /* chaotic-orbital */
        ['A turbulent storm of geometry overwhelms any orbital structure with disorder.',
         'Orbital currents barely register beneath the chaos of scattered elements.'],
        /* loose-radial */
        ['The forms loosely radiate from the interior, a suggestion of starburst only partially followed.',
         'A relaxed radial tendency organizes the forms without insisting upon it.'],
        /* loose-organic */
        ['Geometry organizes loosely around organic currents, structure present but unhurried.',
         'Gentle organic flow gives the arrangement a sense of direction without rigidity.'],
        /* loose-orbital */
        ['Elements drift in loose orbital paths, gently spiraling without strict adherence.',
         'A soft spiraling tendency carries the forms in unhurried circular drift.'],
        /* structured-radial */
        ['Ordered elements emanate radially, a starburst of planes diverging from the center.',
         'Precise radial symmetry governs the arrangement, every form aligned to the center.'],
        /* structured-organic */
        ['The forms follow a coherent flowing pattern, creating visible directional structure.',
         'A legible organic current carries every element in the same purposeful direction.'],
        /* structured-orbital */
        ['Orbital bands wrap around the form, arcs of geometry spiraling with architectural discipline.',
         'Concentric orbital paths carry the elements in disciplined spiraling formation.'],
    ],
    es: [
        ['La disposición no sigue orden legible, los fragmentos derivando sin alineación.',
         'Ningún principio organizador gobierna la dispersión — la geometría se esparce libremente.'],
        ['Los planos geométricos se dispersan en toda dirección sin orientación preferente.',
         'Las formas se dispersan con libertad entrópica, cada elemento encontrando su propia trayectoria.'],
        ['Una tormenta turbulenta de geometría abruma toda estructura orbital con desorden.',
         'Las corrientes orbitales apenas se registran bajo el caos de elementos dispersos.'],
        ['Las formas irradian vagamente desde el interior, una sugerencia de estallido solo parcialmente seguida.',
         'Una tendencia radial relajada organiza las formas sin insistir en ello.'],
        ['La geometría se organiza libremente alrededor de corrientes orgánicas, estructura presente pero sin prisa.',
         'Un flujo orgánico gentil da a la disposición un sentido de dirección sin rigidez.'],
        ['Los elementos derivan en trayectorias orbitales sueltas, espiraleando gentilmente sin adherencia estricta.',
         'Una suave tendencia espiral lleva las formas en deriva circular sin prisa.'],
        ['Elementos ordenados emanan radialmente, un estallido de planos divergiendo desde el centro.',
         'Una simetría radial precisa gobierna la disposición, cada forma alineada al centro.'],
        ['Las formas siguen un patrón de flujo coherente, creando estructura direccional visible.',
         'Una corriente orgánica legible lleva cada elemento en la misma dirección deliberada.'],
        ['Bandas orbitales envuelven la forma, arcos de geometría espiraleando con disciplina arquitectónica.',
         'Trayectorias orbitales concéntricas llevan los elementos en formación espiral disciplinada.'],
    ],
};

/** Division suffix (low / mid / high). */
export const GEO_DIVISION: L10nBank = {
    en: [
        [' A single unified core anchors the entire composition.', ' All geometry converges toward one luminous center.'],
        ['', ''],  /* mid-range: no suffix */
        [' Three luminous cores divide the form, each a separate gravitational center.',
         ' The structure splits into three distinct lobes of geometric activity.'],
    ],
    es: [
        [' Un solo núcleo unificado ancla toda la composición.', ' Toda la geometría converge hacia un centro luminoso.'],
        ['', ''],
        [' Tres núcleos luminosos dividen la forma, cada uno un centro gravitacional separado.',
         ' La estructura se divide en tres lóbulos distintos de actividad geométrica.'],
    ],
};

/* ════════════════════════════════════════════════════════════════
   EXPANDED — Sentence 3: COLOR + LIGHT
   Primary: chroma × spectrum (3×3 = 9 combos)
   Hue: injected via {color} / {Color} placeholders
   Light points: nodeCount phrasing + bloom light modifier
   ════════════════════════════════════════════════════════════════ */

/** Chroma × spectrum color description (3×3 = 9, with {color}/{Color} placeholders). */
export const COLOR_PHRASE: L10nBank = {
    en: [
        /* achromatic-mono */
        ['Pure achromatic structure in silver and white pervades the composition, geometry without chromatic identity.',
         'The forms carry no color — only gradations of luminous silver, pearl, and shadow.'],
        /* achromatic-ranged */
        ['Nearly colorless geometry carries faint spectral shifts, ghost-like tones barely distinguishable from white.',
         'Subtle spectral traces haunt the achromatic surfaces, the barest whisper of prismatic color.'],
        /* achromatic-prismatic */
        ['Faint rainbow ghosts inhabit achromatic forms, spectral traces emerging and dissolving against neutral geometry.',
         'Delicate prismatic refractions pass through otherwise colorless planes like light through ancient glass.'],
        /* muted-mono */
        ['A hushed {color} tone pervades the composition, evoking aged surface more than emitted light.',
         'Quiet, desaturated {color} washes through every plane, suggesting patina rather than illumination.'],
        /* muted-ranged */
        ['Muted {color} hues shift subtly across a narrow desaturated palette, suggesting memory more than presence.',
         'A restrained {color} spectrum moves quietly through the geometry, colors felt rather than seen.'],
        /* muted-prismatic */
        ['Faded spectral tints wash through the geometry like light through old glass, muted and atmospheric.',
         'A desaturated rainbow drifts through the forms, every hue present but none asserting itself.'],
        /* vivid-mono */
        ['Intense {color} saturates every surface with bold singular chromatic identity.',
         '{Color} dominates completely — a concentrated, unwavering chromatic statement across every plane.'],
        /* vivid-ranged */
        ['Rich {color} dominates with vivid accents from adjacent hues adding chromatic depth and complexity.',
         'Saturated {color} anchors the palette while neighboring wavelengths introduce harmonic variation.'],
        /* vivid-prismatic */
        ['Full prismatic color floods the geometry, every hue vivid and luminously present.',
         'The entire visible spectrum radiates through the forms, a prismatic explosion of saturated color.'],
    ],
    es: [
        ['Estructura acromática pura en plata y blanco impregna la composición, geometría sin identidad cromática.',
         'Las formas no portan color — solo gradaciones de plata luminosa, perla y sombra.'],
        ['Geometría casi incolora porta leves desplazamientos espectrales, tonos fantasmales apenas distinguibles del blanco.',
         'Sutiles trazos espectrales habitan las superficies acromáticas, el más leve susurro de color prismático.'],
        ['Tenues fantasmas de arcoíris habitan formas acromáticas, trazos espectrales emergiendo y disolviéndose contra geometría neutra.',
         'Delicadas refracciones prismáticas atraviesan planos por lo demás incoloros como luz a través de cristal antiguo.'],
        ['Un tono {color} apagado impregna la composición, evocando superficie envejecida más que luz emitida.',
         'Un {color} quieto y desaturado recorre cada plano, sugiriendo pátina más que iluminación.'],
        ['Matices {color} apagados cambian sutilmente en una paleta desaturada estrecha, sugiriendo memoria más que presencia.',
         'Un espectro {color} contenido se mueve tranquilamente por la geometría, colores sentidos más que vistos.'],
        ['Tintes espectrales desvanecidos recorren la geometría como luz a través de cristal antiguo, apagados y atmosféricos.',
         'Un arcoíris desaturado deriva por las formas, cada matiz presente pero ninguno imponiéndose.'],
        ['Un {color} intenso satura cada superficie con identidad cromática audaz y singular.',
         'El {color} domina completamente — una declaración cromática concentrada e inquebrantable en cada plano.'],
        ['Un rico {color} domina con acentos vívidos de matices adyacentes añadiendo profundidad y complejidad cromática.',
         'Un {color} saturado ancla la paleta mientras longitudes de onda vecinas introducen variación armónica.'],
        ['Color prismático pleno inunda la geometría, cada matiz vívido y luminosamente presente.',
         'El espectro visible entero irradia a través de las formas, una explosión prismática de color saturado.'],
    ],
};

/** Node count + bloom → light points description. */
export const LIGHT_POINTS: L10nBank = {
    en: [
        /* tight bloom */
        [
            'Among the structure, {N} points of white light appear as precise luminous anchors, each sharply defined against the geometry.',
            '{N} concentrated points of light punctuate the composition like bright pins holding the structure in place.',
        ],
        /* contained */
        [
            '{N} points of light are scattered through the geometry, each surrounded by a small contained halo.',
            'Across the structure, {N} luminous points glow with restrained radiance, their light staying close.',
        ],
        /* moderate */
        [
            '{N} luminous points scatter amongst the geometry like stars in a constellation, their halos softly visible.',
            'Floating amongst the planes, {N} orbs of white light create a gentle stellar distribution.',
        ],
        /* spreading */
        [
            '{N} points of light radiate outward through the illuminated planes, their halos merging where they overlap.',
            '{N} luminous orbs scatter through the structure, each casting visible light into the surrounding geometry.',
        ],
        /* atmospheric */
        [
            '{N} points of white light diffuse broadly through the composition, each orb dissolving into atmospheric radiance.',
            '{N} luminous sources scatter like stars drawn together, their combined radiance creating a continuous field of light.',
        ],
    ],
    es: [
        [
            'Entre la estructura, {N} puntos de luz blanca aparecen como anclajes luminosos precisos, cada uno definido contra la geometría.',
            '{N} puntos concentrados de luz puntúan la composición como pines brillantes sosteniendo la estructura.',
        ],
        [
            '{N} puntos de luz se dispersan por la geometría, cada uno rodeado por un pequeño halo contenido.',
            'A través de la estructura, {N} puntos luminosos resplandecen con radiancia contenida, su luz manteniéndose cercana.',
        ],
        [
            '{N} puntos luminosos se dispersan entre la geometría como estrellas en una constelación, sus halos suavemente visibles.',
            'Flotando entre los planos, {N} orbes de luz blanca crean una gentil distribución estelar.',
        ],
        [
            '{N} puntos de luz irradian hacia afuera a través de los planos iluminados, sus halos fusionándose donde se superponen.',
            '{N} orbes luminosos se dispersan por la estructura, cada uno proyectando luz visible en la geometría circundante.',
        ],
        [
            '{N} puntos de luz blanca se difunden ampliamente por la composición, cada orbe disolviéndose en radiancia atmosférica.',
            '{N} fuentes luminosas se dispersan como estrellas atraídas entre sí, su radiancia combinada creando un campo continuo de luz.',
        ],
    ],
};

/* ════════════════════════════════════════════════════════════════
   EXPANDED — Sentence 4: CODA  (seed-driven interpretive metaphor)

   9 families per slot (2 seed values each), 729 total combinations.
   Index: Math.floor(slotValue / 2)

   Cross-slot bridge: 3×3 matrix (arrangement-meta × detail-meta)
   connects the spatial metaphor to the emotional temperature.

   Parameter inflection: extreme control values can replace the
   bridge, tying the poetic ending back to the dominant visual.
   ════════════════════════════════════════════════════════════════ */

/**
 * Arrangement metaphor families (9 groups of 2 seed slots each).
 * Index: Math.floor(arrangementSlot / 2)
 */
export const CODA_ARRANGEMENT: L10nBank = {
    en: [
        /* 0-1  anchored/poised → geological, mineral */
        [
            'The image evokes a mineral formation caught mid-crystallization',
            'The composition suggests a geode viewed from within',
            'The structure recalls a mineral cathedral, ancient and still',
        ],
        /* 2-3  centered/settled → architectural, interior */
        [
            'The image evokes an interior seen from within — a space that contains and is contained',
            'The composition suggests architecture suspended in thought',
            'The structure recalls a room made of light, walls dissolving into geometry',
        ],
        /* 4-5  resting/balanced → contemplative, shrine */
        [
            'The image evokes a sanctuary built from pure geometry, a place of quiet intention',
            'The composition suggests a reliquary holding light instead of bone',
            'The structure recalls an altar of translucent planes, purpose without liturgy',
        ],
        /* 6-7  drifting/leaning → organic, botanical */
        [
            'The image evokes a bioluminescent organism, alive in its own quiet way',
            'The composition suggests a living structure, growing and reorienting',
            'The structure recalls coral or mycelium, organic intelligence in geometric form',
        ],
        /* 8-9  shifting/flowing → aquatic, fluid */
        [
            'The image evokes a current made visible, fluid dynamics frozen in crystal',
            'The composition suggests water crystallized at the moment of movement',
            'The structure recalls an ocean wave rendered in translucent geometry, perpetually about to break',
        ],
        /* 10-11  turning/arcing → kinetic, mechanical */
        [
            'The image evokes a clockwork mechanism stripped to its essential geometry',
            'The composition suggests an engine of light, every arc a transfer of energy',
            'The structure recalls a gyroscope caught between forces, rotation held in suspension',
        ],
        /* 12-13  swirling/rushing → atmospheric, weather */
        [
            'The image evokes a storm system rendered in geometric abstraction',
            'The composition suggests the eye of a turbulence, energy radiating outward',
            'The structure recalls lightning caught in crystal — energy seeking every possible path',
        ],
        /* 14-15  scattering/diverging → explosive, fragmentary */
        [
            'The image evokes an explosion frozen at its most beautiful instant',
            'The composition suggests shrapnel that chose to become architecture',
            'The structure recalls a detonation rendered in stained glass, violence become stillness',
        ],
        /* 16-17  spiraling/turbulent → cosmic, celestial */
        [
            'The image evokes a galaxy in miniature, gravitational forces rendered as geometric planes',
            'The composition suggests a supernova frozen at the instant of expansion',
            'The structure recalls the birth of a star, matter and energy still deciding what to become',
        ],
    ],
    es: [
        [
            'La imagen evoca una formación mineral capturada a mitad de cristalización',
            'La composición sugiere una geoda vista desde su interior',
            'La estructura recuerda una catedral mineral, antigua e inmóvil',
        ],
        [
            'La imagen evoca un interior visto desde dentro — un espacio que contiene y es contenido',
            'La composición sugiere arquitectura suspendida en pensamiento',
            'La estructura recuerda una habitación hecha de luz, paredes disolviéndose en geometría',
        ],
        [
            'La imagen evoca un santuario construido de geometría pura, un lugar de intención silenciosa',
            'La composición sugiere un relicario que guarda luz en lugar de hueso',
            'La estructura recuerda un altar de planos translúcidos, propósito sin liturgia',
        ],
        [
            'La imagen evoca un organismo bioluminiscente, vivo a su propia manera silenciosa',
            'La composición sugiere una estructura viva, creciendo y reorientándose',
            'La estructura recuerda coral o micelio, inteligencia orgánica en forma geométrica',
        ],
        [
            'La imagen evoca una corriente hecha visible, dinámica de fluidos congelada en cristal',
            'La composición sugiere agua cristalizada en el momento del movimiento',
            'La estructura recuerda una ola oceánica renderizada en geometría translúcida, perpetuamente a punto de romper',
        ],
        [
            'La imagen evoca un mecanismo de relojería reducido a su geometría esencial',
            'La composición sugiere un motor de luz, cada arco una transferencia de energía',
            'La estructura recuerda un giroscopio atrapado entre fuerzas, rotación sostenida en suspensión',
        ],
        [
            'La imagen evoca un sistema de tormentas renderizado en abstracción geométrica',
            'La composición sugiere el ojo de una turbulencia, energía irradiando hacia afuera',
            'La estructura recuerda un relámpago atrapado en cristal — energía buscando todo camino posible',
        ],
        [
            'La imagen evoca una explosión congelada en su instante más hermoso',
            'La composición sugiere metralla que eligió convertirse en arquitectura',
            'La estructura recuerda una detonación renderizada en vidriera, violencia vuelta quietud',
        ],
        [
            'La imagen evoca una galaxia en miniatura, fuerzas gravitacionales renderizadas como planos geométricos',
            'La composición sugiere una supernova congelada en el instante de expansión',
            'La estructura recuerda el nacimiento de una estrella, materia y energía aún decidiendo qué ser',
        ],
    ],
};

/**
 * Structure quality modifier for coda (9 groups of 2 slots).
 * Appended after the arrangement metaphor.
 */
export const CODA_STRUCTURE: L10nBank = {
    en: [
        /* 0-1  silken/draped */
        [', its geometry woven from translucent silk', ', surfaces draped rather than constructed'],
        /* 2-3  smooth/folded */
        [', built from carefully folded planes of light', ', its layers stacked with quiet architectural purpose'],
        /* 4-5  layered/woven */
        [', its planes interlaced like warp and weft', ', geometry layered with the patience of sediment'],
        /* 6-7  creased/pleated */
        [', its surfaces creased and pleated with angular precision', ', geometry folded along sharp deliberate lines'],
        /* 8-9  angular/faceted */
        [', carved from fractured crystal', ', its faces reflecting light at distinct geometric angles'],
        /* 10-11  carved/fractured */
        [', hewn from solid light with chisel-sharp intention', ', its faces broken along fault lines of luminous force'],
        /* 12-13  splintered/shattered */
        [', shattered into crystalline fragments that still hold formation', ', splintered into a constellation of crystalline debris'],
        /* 14-15  crystalline/serrated */
        [', every edge a blade of crystallized radiance', ', its surfaces tessellated with mineral precision'],
        /* 16-17  bristling/jagged */
        [', bristling with jagged edges like a structure forged in violence', ', every surface a serrated edge, geometry born from rupture'],
    ],
    es: [
        [', su geometría tejida de seda translúcida', ', superficies drapeadas más que construidas'],
        [', construida de planos de luz cuidadosamente plegados', ', sus capas apiladas con quieto propósito arquitectónico'],
        [', sus planos entrelazados como urdimbre y trama', ', geometría estratificada con la paciencia del sedimento'],
        [', sus superficies plegadas y plisadas con precisión angular', ', geometría doblada a lo largo de líneas deliberadas y afiladas'],
        [', tallada de cristal fracturado', ', sus caras reflejando luz en ángulos geométricos distintos'],
        [', labrada de luz sólida con intención de cincel', ', sus caras rotas a lo largo de líneas de fuerza luminosa'],
        [', fragmentada en esquirlas cristalinas que aún mantienen formación', ', astillada en una constelación de escombros cristalinos'],
        [', cada borde una hoja de radiancia cristalizada', ', sus superficies teseladas con precisión mineral'],
        [', erizada de bordes dentados como una estructura forjada en violencia', ', cada superficie un filo serrado, geometría nacida de la ruptura'],
    ],
};

/**
 * Detail emotional temperature for coda (9 groups of 2 slots).
 * Becomes the closing clause.
 */
export const CODA_DETAIL: L10nBank = {
    en: [
        /* 0-1  frozen/glacial */
        [
            'It holds a perfect, glacial stillness — architecture that has never known motion.',
            'The scene carries the silence of deep ice, geometry preserved in absolute zero.',
        ],
        /* 2-3  still/cool */
        [
            'A cool, contemplative quiet pervades the scene, as though observed through twilight.',
            'The atmosphere suggests dusk — the last light held in geometric suspension.',
        ],
        /* 4-5  misty/dim */
        [
            'The air itself seems to hold its breath, light arriving through distance and fog.',
            'A liminal haze softens every edge, the scene suspended between visibility and dream.',
        ],
        /* 6-7  dusky/neutral */
        [
            'The mood is one of quiet equilibrium, neither warm nor cold, geometry at rest with itself.',
            'A measured, neutral calm holds the composition in thoughtful balance.',
        ],
        /* 8-9  mild/warm */
        [
            'Warmth radiates from within, the geometry alive with internal fire.',
            'The scene glows with the warmth of something that has been held close, light as tenderness.',
        ],
        /* 10-11  glowing/bright */
        [
            'Light presses outward from every surface, the structure luminous with quiet conviction.',
            'The geometry carries its own daylight, bright without source, warm without heat.',
        ],
        /* 12-13  vivid/radiant */
        [
            'Radiant energy pulses through the structure, each surface a conduit for concentrated brilliance.',
            'The geometry blazes with vivid intensity, structure transformed into pure luminous event.',
        ],
        /* 14-15  blazing/molten */
        [
            'The structure burns with incandescent ferocity, geometry at the edge of its own transformation.',
            'Everything is molten — the forms carry the energy of their own becoming, light as origin.',
        ],
        /* 16-17  incandescent/burning */
        [
            'The scene has crossed beyond illumination into pure radiance, geometry as fire itself.',
            'Light has replaced matter entirely — what remains is the memory of structure, burning.',
        ],
    ],
    es: [
        [
            'Mantiene una quietud glacial perfecta — arquitectura que nunca ha conocido el movimiento.',
            'La escena porta el silencio del hielo profundo, geometría preservada en cero absoluto.',
        ],
        [
            'Una quietud fresca y contemplativa impregna la escena, como observada a través del crepúsculo.',
            'La atmósfera sugiere el anochecer — la última luz sostenida en suspensión geométrica.',
        ],
        [
            'El aire mismo parece contener la respiración, la luz llegando a través de distancia y niebla.',
            'Una bruma liminal suaviza cada borde, la escena suspendida entre visibilidad y sueño.',
        ],
        [
            'El ánimo es de equilibrio quieto, ni cálido ni frío, geometría en reposo consigo misma.',
            'Una calma mesurada y neutra mantiene la composición en balance reflexivo.',
        ],
        [
            'La calidez irradia desde dentro, la geometría viva con fuego interior.',
            'La escena resplandece con la calidez de algo sostenido cerca, la luz como ternura.',
        ],
        [
            'La luz presiona hacia afuera desde cada superficie, la estructura luminosa con quieta convicción.',
            'La geometría porta su propia luz diurna, brillante sin fuente, cálida sin calor.',
        ],
        [
            'Energía radiante pulsa a través de la estructura, cada superficie un conducto de brillantez concentrada.',
            'La geometría arde con intensidad vívida, estructura transformada en puro evento luminoso.',
        ],
        [
            'La estructura arde con ferocidad incandescente, geometría al borde de su propia transformación.',
            'Todo es fundido — las formas portan la energía de su propio devenir, la luz como origen.',
        ],
        [
            'La escena ha cruzado más allá de la iluminación hacia radiancia pura, geometría como fuego mismo.',
            'La luz ha reemplazado la materia por completo — lo que queda es la memoria de la estructura, ardiendo.',
        ],
    ],
};

/**
 * Cross-slot bridge: connects the structure clause to the emotional
 * temperature clause. Indexed by arrangement-meta (3) × detail-meta (3).
 *
 * Arrangement meta-groups:  earth (0-2), life (3-5), cosmos (6-8)
 * Detail meta-groups:       cold (0-2), neutral (3-5), hot (6-8)
 *
 * Index: arrMeta * 3 + detMeta
 */
export const CODA_BRIDGE: L10nBank = {
    en: [
        /* earth × cold */
        ['. Entombed in stillness,', '. Sealed beneath silence,'],
        /* earth × neutral */
        ['. Resting in its own gravity,', '. Held in place by quiet mass,'],
        /* earth × hot */
        ['. Lit from deep within the stone,', '. Heat rising through ancient mineral,'],
        /* life × cold */
        ['. Dormant beneath frost,', '. Alive but suspended, waiting for thaw,'],
        /* life × neutral */
        ['. Breathing in slow rhythm,', '. Growing at the pace of geology,'],
        /* life × hot */
        ['. Flushed with biological urgency,', '. Alive with the heat of its own metabolism,'],
        /* cosmos × cold */
        ['. Drifting through the cold between stars,', '. Suspended in the vacuum of deep space,'],
        /* cosmos × neutral */
        ['. Turning in the silence of orbit,', '. Carried by forces older than light,'],
        /* cosmos × hot */
        ['. Burning at the heart of formation,', '. Ignited by the pressure of its own collapse,'],
    ],
    es: [
        ['. Sepultada en quietud,', '. Sellada bajo el silencio,'],
        ['. Reposando en su propia gravedad,', '. Sostenida en su sitio por masa silenciosa,'],
        ['. Iluminada desde lo profundo de la piedra,', '. Calor ascendiendo por mineral antiguo,'],
        ['. Latente bajo la escarcha,', '. Viva pero suspendida, esperando el deshielo,'],
        ['. Respirando en ritmo lento,', '. Creciendo al paso de la geología,'],
        ['. Encendida de urgencia biológica,', '. Viva con el calor de su propio metabolismo,'],
        ['. A la deriva en el frío entre estrellas,', '. Suspendida en el vacío del espacio profundo,'],
        ['. Girando en el silencio de la órbita,', '. Llevada por fuerzas más antiguas que la luz,'],
        ['. Ardiendo en el corazón de la formación,', '. Encendida por la presión de su propio colapso,'],
    ],
};

/**
 * Parameter-sensitive inflection phrases. When a control parameter is
 * at an extreme, these can replace the bridge to tie the coda back
 * to the dominant visual characteristic. Each entry has 2 synonyms.
 *
 * Only one inflection activates per coda (highest priority wins).
 */
export const CODA_INFLECTION: { readonly [key: string]: L10nBank } = {
    /* ── Pair inflections (higher priority — more specific) ── */

    /** dark + high bloom → "night bloom" signature aesthetic */
    darkBloom: {
        en: [['. Glowing from within its own darkness like a deep-sea creature,', '. Light arriving not from outside but from somewhere inside the geometry,']],
        es: [['. Brillando desde dentro de su propia oscuridad como una criatura abisal,', '. La luz llegando no desde fuera sino desde algún lugar dentro de la geometría,']],
    },
    /** dark + tight bloom → precious jewel-box containment */
    darkJewel: {
        en: [['. Precious and contained, a jewel-box geometry visible only to those who look closely,', '. Geometry so dark it must be found rather than seen,']],
        es: [['. Preciosa y contenida, una geometría de joyero visible solo para quienes miran de cerca,', '. Geometría tan oscura que debe ser encontrada más que vista,']],
    },
    /** low coherence + high fracture → maximum entropy, storm */
    chaosStorm: {
        en: [['. Every fragment obeying its own trajectory, structure abandoned to the wind,', '. Order shattered past the point of recognition,']],
        es: [['. Cada fragmento obedeciendo su propia trayectoria, la estructura abandonada al viento,', '. El orden destrozado más allá del punto de reconocimiento,']],
    },
    /** sparse + high coherence → meditative solitude */
    sparseOrder: {
        en: [['. Each element an island of intention in a sea of void,', '. So few forms, and yet each one placed with absolute certainty,']],
        es: [['. Cada elemento una isla de intención en un mar de vacío,', '. Tan pocas formas, y sin embargo cada una colocada con certeza absoluta,']],
    },
    /** vivid chroma + narrow spectrum → jewel-like chromatic declaration */
    vividMono: {
        en: [['. Color so concentrated it becomes a material, not merely a quality,', '. A single hue raised to the intensity of conviction,']],
        es: [['. Color tan concentrado que se convierte en material, no meramente en cualidad,', '. Un solo matiz elevado a la intensidad de la convicción,']],
    },
    /** dense + low coherence → debris field, fog of geometry */
    denseChaos: {
        en: [['. A debris field where pattern has been overwhelmed by sheer quantity,', '. So many fragments that chaos itself becomes a texture,']],
        es: [['. Un campo de escombros donde el patrón ha sido abrumado por la pura cantidad,', '. Tantos fragmentos que el caos mismo se convierte en textura,']],
    },

    /* ── Single-parameter inflections (lower priority) ── */

    /** coherence > 0.88 → architectural order */
    coherenceHigh: {
        en: [['. Every element obeys a single architectural will,', '. Structure governs every plane with crystalline authority,']],
        es: [['. Cada elemento obedece una sola voluntad arquitectónica,', '. La estructura gobierna cada plano con autoridad cristalina,']],
    },
    /** coherence < 0.12 → entropic chaos */
    coherenceLow: {
        en: [['. Entropy has claimed the arrangement, order a distant memory,', '. Chaos scatters every plane beyond the reach of pattern,']],
        es: [['. La entropía ha reclamado la disposición, el orden un recuerdo lejano,', '. El caos dispersa cada plano más allá del alcance del patrón,']],
    },
    /** luminosity < 0.08 → submerged darkness */
    luminosityLow: {
        en: [['. Submerged in near-total darkness,', '. Visible only at the threshold of perception,']],
        es: [['. Sumergida en oscuridad casi total,', '. Visible solo en el umbral de la percepción,']],
    },
    /** bloom > 0.88 → atmospheric dissolution */
    bloomHigh: {
        en: [['. Dissolving into its own atmosphere,', '. Light and form merging into continuous radiance,']],
        es: [['. Disolviéndose en su propia atmósfera,', '. Luz y forma fundiéndose en radiancia continua,']],
    },
    /** density > 0.85 → overwhelming accumulation */
    densityHigh: {
        en: [['. Overwhelmed by its own abundance,', '. The sheer weight of accumulated geometry pressing inward,']],
        es: [['. Abrumada por su propia abundancia,', '. El peso puro de geometría acumulada presionando hacia dentro,']],
    },
};