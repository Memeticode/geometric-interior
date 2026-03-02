/**
 * Alt-text and animation alt-text generation from controls.
 */

import type { Controls } from '../image-models.js';
import { getHueWords } from './word-tables.js';

/* ── Alt-text classifiers ── */

function classifyLum(v: number): string {
    if (v < 0.15) return 'dark';
    if (v < 0.40) return 'dim';
    if (v < 0.65) return 'moderate';
    return 'bright';
}

function classifyBloom(v: number): string {
    if (v < 0.25) return 'tight';
    if (v < 0.60) return 'moderate';
    return 'atmospheric';
}

function classifyChroma(v: number): string {
    if (v <= 0.12) return 'achromatic';
    if (v < 0.30) return 'muted';
    if (v < 0.60) return 'moderate';
    return 'vivid';
}

function classifySpectrum(v: number): string {
    if (v < 0.20) return 'monochrome';
    if (v < 0.50) return 'ranged';
    return 'prismatic';
}

function classifyDensity(v: number): string {
    if (v < 0.06) return 'sparse';
    if (v < 0.20) return 'moderate';
    return 'dense';
}

function classifyScale(v: number): string {
    if (v < 0.30) return 'monumental';
    if (v < 0.70) return 'balanced';
    return 'atmospheric';
}

function classifyCoherence(v: number): string {
    if (v < 0.25) return 'chaotic';
    if (v < 0.60) return 'loose';
    return 'structured';
}

function classifyFlow(v: number): string {
    if (v < 0.30) return 'radial';
    if (v < 0.70) return 'organic';
    return 'orbital';
}

function classifyFracture(v: number): string {
    if (v < 0.30) return 'compact';
    if (v < 0.65) return 'moderate';
    return 'shattered';
}

function classifyFaceting(v: number): string {
    if (v < 0.20) return 'smooth';
    if (v < 0.70) return 'mixed';
    return 'angular';
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function getHueAdj(hue01: number, locale: string): string {
    return getHueWords(hue01, locale)[0].toLowerCase();
}

function injectColor(template: string, color: string): string {
    return template
        .replace(/\{Color\}/g, capitalize(color))
        .replace(/\{color\}/g, color);
}

/* ── Alt-text phrase tables ── */

const ATMOSPHERE: Record<string, Record<string, string>> = {
    en: {
        'dark-tight': 'Precious concentrated light surfaces from near-blackness, each point a gem against the void.',
        'dark-moderate': 'Geometric forms glow within deep darkness, soft halos reaching into the enveloping void.',
        'dark-atmospheric': 'Half-seen forms breathe through darkness, their light dissolving into atmospheric haze.',
        'dim-tight': 'Subdued geometry defines itself with precise edges against shadow, surfaces quietly catching faint light.',
        'dim-moderate': 'A dim interior holds geometry in gentle suspension, forms glowing through soft luminescence.',
        'dim-atmospheric': 'Geometry drifts behind veils of diffusing light, the space itself glowing with atmospheric warmth.',
        'moderate-tight': 'Crystalline planes float in clear space, their interior glow sharply defined and structurally precise.',
        'moderate-moderate': 'Luminous geometry fills the field with steady radiance, forms visible through spreading halos.',
        'moderate-atmospheric': 'Light emanates far beyond each surface, filling the composition with aureoles of atmospheric glow.',
        'bright-tight': 'Brilliant geometry blazes with architectural intensity, every edge defined by concentrated radiant light.',
        'bright-moderate': 'Radiant forms flood the space with light, bright halos maintaining structural clarity.',
        'bright-atmospheric': 'Intense radiance engulfs the field, geometric forms merging with their own spreading light.',
    },
    es: {
        'dark-tight': 'Puntos de luz preciosa emergen de la casi-oscuridad, cada uno una gema contra el vacío.',
        'dark-moderate': 'Formas geométricas brillan en la oscuridad profunda, halos suaves alcanzando el vacío envolvente.',
        'dark-atmospheric': 'Formas entrevistas respiran en la oscuridad, su luz disolviéndose en bruma atmosférica.',
        'dim-tight': 'Geometría tenue se define con bordes precisos contra la sombra, superficies capturando luz débil.',
        'dim-moderate': 'Un interior en penumbra sostiene geometría en suave suspensión, formas brillando a través de luminiscencia tenue.',
        'dim-atmospheric': 'La geometría se desliza tras velos de luz difusa, el espacio mismo resplandeciendo con calidez atmosférica.',
        'moderate-tight': 'Planos cristalinos flotan en espacio claro, su brillo interior definido con precisión estructural.',
        'moderate-moderate': 'Geometría luminosa llena el campo con radiancia estable, formas visibles a través de halos expansivos.',
        'moderate-atmospheric': 'La luz emana más allá de cada superficie, llenando la composición con aureolas de resplandor atmosférico.',
        'bright-tight': 'Geometría brillante arde con intensidad arquitectónica, cada borde definido por luz radiante concentrada.',
        'bright-moderate': 'Formas radiantes inundan el espacio con luz, halos brillantes manteniendo claridad estructural.',
        'bright-atmospheric': 'Radiancia intensa envuelve el campo, formas geométricas fundiéndose con su propia luz expansiva.',
    },
};

const COLOR: Record<string, Record<string, string>> = {
    en: {
        'achromatic-monochrome': 'Pure achromatic structure in silver and white, geometry without chromatic identity.',
        'achromatic-ranged': 'Nearly colorless forms carry faint spectral shifts, ghost-like tones barely distinguishable from white.',
        'achromatic-prismatic': 'Faint rainbow ghosts haunt achromatic forms, spectral traces emerging and dissolving against neutral geometry.',
        'muted-monochrome': 'A hushed {color} tone pervades the composition, evoking aged surface more than emitted light.',
        'muted-ranged': 'Quiet {color} hues shift subtly, a narrow desaturated palette suggesting memory more than presence.',
        'muted-prismatic': 'Faded spectral tints wash through geometry like light through old glass, muted and atmospheric.',
        'moderate-monochrome': 'A unified {color} identity pervades the composition with clear chromatic presence.',
        'moderate-ranged': '{Color} tones deepen and lighten across the geometry, shifting into neighboring hues.',
        'moderate-prismatic': 'Multiple hues disperse through the forms, {color} anchoring a broad shifting spectrum.',
        'vivid-monochrome': 'Intense {color} saturates every surface — a bold, singular chromatic identity.',
        'vivid-ranged': 'Rich {color} dominates with vivid accents from adjacent hues adding chromatic depth.',
        'vivid-prismatic': 'Full prismatic color floods the geometry, every hue vivid and luminously present.',
    },
    es: {
        'achromatic-monochrome': 'Estructura acromática pura en plata y blanco, geometría sin identidad cromática.',
        'achromatic-ranged': 'Formas casi incoloras portan leves desplazamientos espectrales, tonos fantasmales apenas distinguibles del blanco.',
        'achromatic-prismatic': 'Tenues fantasmas de arcoíris habitan formas acromáticas, trazos espectrales emergiendo y disolviéndose contra geometría neutra.',
        'muted-monochrome': 'Un tono {color} apagado impregna la composición, evocando superficie envejecida más que luz emitida.',
        'muted-ranged': 'Tonos {color} quietos cambian sutilmente, una paleta desaturada estrecha que sugiere memoria más que presencia.',
        'muted-prismatic': 'Tintes espectrales desvanecidos recorren la geometría como luz a través de cristal antiguo, apagados y atmosféricos.',
        'moderate-monochrome': 'Una identidad {color} unificada impregna la composición con presencia cromática clara.',
        'moderate-ranged': 'Tonos {color} se profundizan y aclaran a través de la geometría, desplazándose hacia matices vecinos.',
        'moderate-prismatic': 'Múltiples matices se dispersan entre las formas, tonos {color} anclando un amplio espectro cambiante.',
        'vivid-monochrome': 'Un intenso {color} satura cada superficie — una identidad cromática audaz y singular.',
        'vivid-ranged': 'Un rico {color} domina con acentos vívidos de matices adyacentes añadiendo profundidad cromática.',
        'vivid-prismatic': 'Color prismático pleno inunda la geometría, cada matiz vívido y luminosamente presente.',
    },
};

const POPULATION: Record<string, Record<string, string>> = {
    en: {
        'sparse-monumental': 'A few bold geometric slabs occupy the void — isolated monumental presences in vast darkness.',
        'sparse-balanced': 'Sparse fragments are carefully placed at readable scale, each form individually distinct.',
        'sparse-atmospheric': 'Fine scattered particles drift sparsely, starlike points in an open atmospheric field.',
        'moderate-monumental': 'Broad planes layer at commanding scale, filling the space with substantial readable forms.',
        'moderate-balanced': 'A measured arrangement of translucent planes fills the space, balancing density with legibility.',
        'moderate-atmospheric': 'A cloud of particles populates the field, forms blending into atmospheric texture.',
        'dense-monumental': 'Massive geometric forms crowd together, overlapping surfaces creating a concentrated architectural mass.',
        'dense-balanced': 'Densely layered forms accumulate and overlap, the space teeming with geometric activity.',
        'dense-atmospheric': 'Hundreds of fine particles swarm, individual elements dissolving into dense atmospheric haze.',
    },
    es: {
        'sparse-monumental': 'Unas pocas losas geométricas audaces ocupan el vacío — presencias monumentales aisladas en vasta oscuridad.',
        'sparse-balanced': 'Fragmentos dispersos están cuidadosamente ubicados a escala legible, cada forma individualmente distinta.',
        'sparse-atmospheric': 'Finas partículas dispersas derivan escasamente, puntos estelares en un campo atmosférico abierto.',
        'moderate-monumental': 'Amplios planos se superponen a escala imponente, llenando el espacio con formas sustanciales y legibles.',
        'moderate-balanced': 'Una disposición mesurada de planos translúcidos llena el espacio, equilibrando densidad con legibilidad.',
        'moderate-atmospheric': 'Una nube de partículas puebla el campo, formas fundiéndose en textura atmosférica.',
        'dense-monumental': 'Masivas formas geométricas se aglomeran, superficies superpuestas creando una masa arquitectónica concentrada.',
        'dense-balanced': 'Formas densamente estratificadas se acumulan y superponen, el espacio rebosante de actividad geométrica.',
        'dense-atmospheric': 'Cientos de finas partículas pululan, elementos individuales disolviéndose en densa bruma atmosférica.',
    },
};

const ORGANIZATION: Record<string, Record<string, string>> = {
    en: {
        'chaotic-radial': 'Scattered fragments drift freely, any radial structure dissolved into chaotic disorder.',
        'chaotic-organic': 'Geometric shards disperse in every direction with no preferred orientation.',
        'chaotic-orbital': 'A turbulent storm of scattered geometry, orbital currents overwhelmed by disorder.',
        'loose-radial': 'Forms loosely radiate from the interior, a suggestion of starburst only partially followed.',
        'loose-organic': 'Geometry organizes loosely around organic flow, structure present but unhurried.',
        'loose-orbital': 'Elements drift in loose orbital paths, gentle spiraling without strict adherence.',
        'structured-radial': 'Ordered elements emanate radially, a starburst of crystal planes diverging from the center.',
        'structured-organic': 'Forms follow a coherent flowing pattern, creating visible directional structure.',
        'structured-orbital': 'Orbital bands wrap around the form, arcs of geometry spiraling with architectural discipline.',
    },
    es: {
        'chaotic-radial': 'Fragmentos dispersos derivan libremente, toda estructura radial disuelta en desorden caótico.',
        'chaotic-organic': 'Esquirlas geométricas se dispersan en todas direcciones sin orientación preferente.',
        'chaotic-orbital': 'Una tormenta turbulenta de geometría dispersa, corrientes orbitales abrumadas por el desorden.',
        'loose-radial': 'Las formas irradian vagamente desde el interior, una sugerencia de estallido solo parcialmente seguida.',
        'loose-organic': 'La geometría se organiza libremente alrededor de flujo orgánico, estructura presente pero sin prisa.',
        'loose-orbital': 'Los elementos derivan en trayectorias orbitales sueltas, espiral suave sin adherencia estricta.',
        'structured-radial': 'Elementos ordenados emanan radialmente, un estallido de planos cristalinos divergiendo desde el centro.',
        'structured-organic': 'Las formas siguen un patrón de flujo coherente, creando estructura direccional visible.',
        'structured-orbital': 'Bandas orbitales envuelven la forma, arcos de geometría espiraleando con disciplina arquitectónica.',
    },
};

const SURFACE: Record<string, Record<string, string>> = {
    en: {
        'compact-smooth': 'Silk-smooth flowing panels with clean whole edges, liquid geometry without fracture',
        'compact-mixed': 'Compact geometry with mixed crystal character, smooth panels alongside angular faces',
        'compact-angular': 'Tightly clustered angular shards with sharp crystal faces in close formation',
        'moderate-smooth': 'Smooth flowing surfaces drift moderately apart, gentle curvature preserved in scatter',
        'moderate-mixed': 'Mixed surfaces with moderate fragmentation, some panels smooth, others faceted',
        'moderate-angular': 'Angular crystal faces catch and scatter light, sharp edges moderately dispersed',
        'shattered-smooth': 'Widely scattered smooth panels fragment across the field, gentle surfaces defying explosive dispersion',
        'shattered-mixed': 'Shattered geometry disperses in every direction, smooth and angular fragments intermixed',
        'shattered-angular': 'Razor-sharp crystal shards scatter explosively, maximum angular fragmentation in every direction',
    },
    es: {
        'compact-smooth': 'Paneles fluidos suaves como seda con bordes limpios y enteros, geometría líquida sin fractura',
        'compact-mixed': 'Geometría compacta con carácter cristalino mixto, paneles suaves junto a caras angulares',
        'compact-angular': 'Esquirlas angulares estrechamente agrupadas con caras cristalinas afiladas en formación cerrada',
        'moderate-smooth': 'Superficies fluidas suaves se separan moderadamente, curvatura gentil preservada en la dispersión',
        'moderate-mixed': 'Superficies mixtas con fragmentación moderada, algunos paneles suaves, otros facetados',
        'moderate-angular': 'Caras cristalinas angulares capturan y dispersan la luz, bordes afilados moderadamente distribuidos',
        'shattered-smooth': 'Paneles suaves ampliamente dispersos se fragmentan por el campo, superficies gentiles desafiando la dispersión explosiva',
        'shattered-mixed': 'Geometría fragmentada se dispersa en toda dirección, fragmentos suaves y angulares entremezclados',
        'shattered-angular': 'Esquirlas cristalinas afiladas se dispersan explosivamente, máxima fragmentación angular en toda dirección',
    },
};

const DIVISION_SUFFIX: Record<string, { unified: string; trifold: string }> = {
    en: { unified: ' A single unified core anchors the composition.', trifold: ' Three luminous cores divide the form.' },
    es: { unified: ' Un solo núcleo unificado ancla la composición.', trifold: ' Tres núcleos luminosos dividen la forma.' },
};

const NODE_SUFFIX: Record<string, string> = {
    en: ', anchored by {N} luminous points.',
    es: ', anclado por {N} puntos luminosos.',
};

export function generateAltText(controls: Controls, nodeCount: number, _title: string, locale: string = 'en'): string {
    const c = controls;
    const lang = locale === 'es' ? 'es' : 'en';
    const hueAdj = getHueAdj(c.hue, lang);

    const s1 = ATMOSPHERE[lang][`${classifyLum(c.luminosity)}-${classifyBloom(c.bloom)}`];
    const s2 = injectColor(COLOR[lang][`${classifyChroma(c.chroma)}-${classifySpectrum(c.spectrum)}`], hueAdj);
    const s3 = POPULATION[lang][`${classifyDensity(c.density)}-${classifyScale(c.scale)}`];

    const orgKey = `${classifyCoherence(c.coherence)}-${classifyFlow(c.flow)}`;
    const divSuffix = c.division > 0.70
        ? DIVISION_SUFFIX[lang].trifold
        : c.division < 0.30
        ? DIVISION_SUFFIX[lang].unified
        : '';
    const s4 = ORGANIZATION[lang][orgKey] + divSuffix;

    const surfKey = `${classifyFracture(c.fracture)}-${classifyFaceting(c.faceting)}`;
    const nodeSuffix = NODE_SUFFIX[lang].replace('{N}', String(nodeCount));
    const s5 = SURFACE[lang][surfKey] + nodeSuffix;

    return [s1, s2, s3, s4, s5].join('\n');
}

/* ── Animation alt-text ── */

const CONTROL_KEYS: (keyof Controls)[] = ['density', 'luminosity', 'fracture', 'coherence', 'scale', 'division', 'faceting'];

const DYNAMIC_PHRASES: Record<string, Record<string, string>> = {
    en: {
        density: 'plane density shifts, the field filling and emptying',
        luminosity: 'light swells and dims, energy arriving and receding',
        fracture: 'edges sharpen and smooth, fragmentation breathing',
        coherence: 'structure tightens and loosens, order questioning itself',
        scale: 'forms shift between monumental and atmospheric',
        division: 'the envelope splits and reunites, topology breathing',
        faceting: 'crystal faces broaden and sharpen, geometry reshaping',
        flow: 'the directional field shifts between radial, turbulent, and orbital patterns',
    },
    es: {
        density: 'la densidad de planos cambia, el campo llenándose y vaciándose',
        luminosity: 'la luz crece y mengua, la energía llegando y retrocediendo',
        fracture: 'los bordes se afilan y suavizan, la fragmentación respirando',
        coherence: 'la estructura se tensa y relaja, el orden cuestionándose a sí mismo',
        scale: 'las formas oscilan entre lo monumental y lo atmosférico',
        division: 'la envolvente se divide y reúne, la topología respirando',
        faceting: 'las caras cristalinas se amplían y agudizan, la geometría reformándose',
        flow: 'el campo direccional cambia entre patrones radiales, turbulentos y orbitales',
    },
};

const STABLE_PHRASES: Record<string, Record<string, string>> = {
    en: {
        density: 'structural density holds steady',
        luminosity: 'luminosity persists unchanged',
        fracture: 'edge complexity stays constant',
        coherence: 'topological coherence is maintained',
        scale: 'scale distribution remains fixed',
        division: 'form topology holds steady',
        faceting: 'crystal character stays constant',
        flow: 'directional field pattern holds steady',
    },
    es: {
        density: 'la densidad estructural se mantiene estable',
        luminosity: 'la luminosidad persiste sin cambios',
        fracture: 'la complejidad de los bordes permanece constante',
        coherence: 'la coherencia topológica se preserva',
        scale: 'la distribución de escala se mantiene fija',
        division: 'la topología de forma se mantiene estable',
        faceting: 'el carácter cristalino permanece constante',
        flow: 'el patrón del campo direccional se mantiene estable',
    },
};

const TRANSITION_VERBS: Record<string, Record<string, { rises: string; falls: string }>> = {
    en: {
        density: { rises: 'planes accumulating', falls: 'geometry thinning' },
        luminosity: { rises: 'light arriving', falls: 'glow receding' },
        fracture: { rises: 'edges shattering', falls: 'forms smoothing' },
        coherence: { rises: 'structure crystallizing', falls: 'order dissolving' },
        scale: { rises: 'forms scattering', falls: 'forms consolidating' },
        division: { rises: 'envelope splitting', falls: 'form reuniting' },
        faceting: { rises: 'faces sharpening', falls: 'panels broadening' },
        flow: { rises: 'field orbiting', falls: 'field radiating' },
    },
    es: {
        density: { rises: 'planos acumulándose', falls: 'geometría adelgazándose' },
        luminosity: { rises: 'luz llegando', falls: 'resplandor retrocediendo' },
        fracture: { rises: 'bordes fragmentándose', falls: 'formas suavizándose' },
        coherence: { rises: 'estructura cristalizándose', falls: 'orden disolviéndose' },
        scale: { rises: 'formas dispersándose', falls: 'formas consolidándose' },
        division: { rises: 'envolvente dividiéndose', falls: 'forma reuniéndose' },
        faceting: { rises: 'caras afilándose', falls: 'paneles ensanchándose' },
        flow: { rises: 'campo orbitando', falls: 'campo irradiando' },
    },
};

export function generateAnimAltText(
    landmarks: Array<{ name: string; controls: Controls }>,
    durationSecs: number,
    keyframeTexts: Array<{ name: string; title: string }>,
    locale: string = 'en',
): string {
    const n = landmarks.length;
    const lang = locale === 'es' ? 'es' : 'en';

    const ranges: Record<string, { min: number; max: number; spread: number }> = {};
    for (const key of CONTROL_KEYS) {
        const values = landmarks.map(l => l.controls[key] as number);
        const min = Math.min(...values);
        const max = Math.max(...values);
        ranges[key] = { min, max, spread: max - min };
    }

    const DYNAMIC_THRESHOLD = 0.15;
    const dynamicKeys = (CONTROL_KEYS as string[])
        .filter(k => ranges[k].spread >= DYNAMIC_THRESHOLD)
        .sort((a, b) => ranges[b].spread - ranges[a].spread);
    const stableKeys = (CONTROL_KEYS as string[])
        .filter(k => ranges[k].spread < DYNAMIC_THRESHOLD);

    const parts: string[] = [];

    if (lang === 'es') {
        parts.push(
            `Un bucle de ${durationSecs} segundos recorre ${n} punto${n !== 1 ? 's' : ''} de referencia, cada uno una geometría cristalina de luz y estructura.`
        );

        if (dynamicKeys.length > 0) {
            const phrases = dynamicKeys.map(k => DYNAMIC_PHRASES[lang][k]);
            parts.push(`A lo largo del ciclo, ${phrases.join('; ')}.`);
        }

        if (stableKeys.length > 0 && stableKeys.length < CONTROL_KEYS.length) {
            const phrases = stableKeys.map(k => STABLE_PHRASES[lang][k]);
            parts.push(`Mientras tanto, ${phrases.join('; ')}.`);
        }

        if (n >= 2) {
            const transitions: string[] = [];
            for (let i = 0; i < n; i++) {
                const from = landmarks[i];
                const to = landmarks[(i + 1) % n];
                const fromTitle = keyframeTexts[i]?.title || from.name;
                const toTitle = keyframeTexts[(i + 1) % n]?.title || to.name;

                let maxDelta = 0, maxKey: string = CONTROL_KEYS[0];
                for (const key of CONTROL_KEYS) {
                    const delta = Math.abs((to.controls[key] as number) - (from.controls[key] as number));
                    if (delta > maxDelta) { maxDelta = delta; maxKey = key; }
                }

                const direction: 'rises' | 'falls' = (to.controls[maxKey as keyof Controls] as number) > (from.controls[maxKey as keyof Controls] as number) ? 'rises' : 'falls';
                const verb = TRANSITION_VERBS[lang][maxKey]?.[direction] || 'el campo transformándose';
                transitions.push(`de \u201c${fromTitle}\u201d a \u201c${toTitle}\u201d: ${verb}`);
            }
            parts.push(`El recorrido avanza ${transitions.join('; ')}.`);
        }

        parts.push(
            'La geometría completa su ciclo, planos translúcidos superponiéndose sin colapsar, ' +
            'regresando a donde comenzó, sutilmente transformada por haberse movido.'
        );
    } else {
        parts.push(
            `A ${durationSecs}-second loop cycles through ${n} landmark${n !== 1 ? 's' : ''}, each a crystalline geometry of light and structure.`
        );

        if (dynamicKeys.length > 0) {
            const phrases = dynamicKeys.map(k => DYNAMIC_PHRASES[lang][k]);
            parts.push(`Across the cycle, ${phrases.join('; ')}.`);
        }

        if (stableKeys.length > 0 && stableKeys.length < CONTROL_KEYS.length) {
            const phrases = stableKeys.map(k => STABLE_PHRASES[lang][k]);
            parts.push(`Throughout, ${phrases.join('; ')}.`);
        }

        if (n >= 2) {
            const transitions: string[] = [];
            for (let i = 0; i < n; i++) {
                const from = landmarks[i];
                const to = landmarks[(i + 1) % n];
                const fromTitle = keyframeTexts[i]?.title || from.name;
                const toTitle = keyframeTexts[(i + 1) % n]?.title || to.name;

                let maxDelta = 0, maxKey: string = CONTROL_KEYS[0];
                for (const key of CONTROL_KEYS) {
                    const delta = Math.abs((to.controls[key] as number) - (from.controls[key] as number));
                    if (delta > maxDelta) { maxDelta = delta; maxKey = key; }
                }

                const direction: 'rises' | 'falls' = (to.controls[maxKey as keyof Controls] as number) > (from.controls[maxKey as keyof Controls] as number) ? 'rises' : 'falls';
                const verb = TRANSITION_VERBS[lang][maxKey]?.[direction] || 'the field shifting';
                transitions.push(`from \u201c${fromTitle}\u201d to \u201c${toTitle}\u201d: ${verb}`);
            }
            parts.push(`The journey moves ${transitions.join('; ')}.`);
        }

        parts.push(
            'The geometry completes its cycle, translucent planes overlapping without collapsing, ' +
            'returning to where it began, subtly changed by having moved.'
        );
    }

    return parts.join('\n');
}
