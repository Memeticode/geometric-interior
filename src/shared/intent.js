/**
 * Shared intent (seed phrase) generator with locale-specific word lists.
 *
 * Generates poetic seed phrases like "The memory of dissolving glass finds its shape."
 * Spanish phrases are authored equivalents, not literal translations.
 */

import { getLocale } from '../i18n/locale.js';

const INTENT_DATA = {
    en: {
        openings: [
            'the memory of', 'what remains after', 'a cathedral built from',
            'the weight of', 'somewhere between', 'the last breath of',
            'a geometry that dreams of', 'the silence inside', 'what light does to',
            'the space where', 'an architecture of', 'the slow collapse of',
            'a window into', 'the color of', 'what happens when',
            'the interior of', 'a prayer made of', 'the distance between',
            'the moment before', 'everything that follows',
        ],
        cores: [
            'dissolving glass', 'frozen lightning', 'crystallized doubt',
            'luminous absence', 'fractured stillness', 'translucent grief',
            'weightless stone', 'liquid geometry', 'burning fog',
            'quiet thunder', 'shattered calm', 'radiant emptiness',
            'suspended breath', 'infinite nearness', 'soft collapse',
            'bright silence', 'warm void', 'sharp tenderness',
            'slow fire', 'deep transparence',
        ],
        closings: [
            'finds its shape', 'meets the dark', 'begins to sing',
            'learns to fall', 'turns to light', 'forgets itself',
            'becomes a door', 'holds the room', 'touches the edge',
            'folds inward', 'drifts apart', 'catches fire',
            'refuses to land', 'remembers water', 'reaches through',
        ],
    },
    es: {
        openings: [
            'la memoria de', 'lo que queda después de', 'una catedral hecha de',
            'el peso de', 'en algún lugar entre', 'el último aliento de',
            'una geometría que sueña con', 'el silencio dentro de', 'lo que la luz le hace a',
            'el espacio donde', 'una arquitectura de', 'el lento colapso de',
            'una ventana hacia', 'el color de', 'lo que sucede cuando',
            'el interior de', 'una oración hecha de', 'la distancia entre',
            'el instante antes de', 'todo lo que sigue a',
        ],
        cores: [
            'cristal disuelto', 'relámpago congelado', 'duda cristalizada',
            'ausencia luminosa', 'quietud fracturada', 'duelo translúcido',
            'piedra sin peso', 'geometría líquida', 'niebla ardiente',
            'trueno silencioso', 'calma rota', 'vacío radiante',
            'respiración suspendida', 'cercanía infinita', 'colapso suave',
            'silencio brillante', 'vacío cálido', 'ternura afilada',
            'fuego lento', 'transparencia profunda',
        ],
        closings: [
            'encuentra su forma', 'se encuentra con la oscuridad', 'comienza a cantar',
            'aprende a caer', 'se convierte en luz', 'se olvida de sí mismo',
            'se vuelve una puerta', 'sostiene la sala', 'toca el borde',
            'se pliega hacia dentro', 'se desvanece', 'se enciende',
            'se niega a aterrizar', 'recuerda el agua', 'atraviesa',
        ],
    },
};

/**
 * Generate a poetic intent phrase in the given locale.
 * @param {string} [locale] - Locale code (defaults to current locale)
 * @returns {string}
 */
export function generateIntent(locale) {
    const lang = locale || getLocale();
    const data = INTENT_DATA[lang] || INTENT_DATA.en;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    let phrase;
    if (Math.random() < 0.4) {
        phrase = `${pick(data.openings)} ${pick(data.cores)}`;
    } else {
        phrase = `${pick(data.openings)} ${pick(data.cores)} ${pick(data.closings)}`;
    }
    return phrase.charAt(0).toUpperCase() + phrase.slice(1) + '.';
}
