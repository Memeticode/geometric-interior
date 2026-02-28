/**
 * Animation Editor entry point — supports animation loop with
 * sparkle/drift/wobble, morph transitions, and fold animations.
 */
import { initEditor } from '../editor/editor-main.js';

initEditor({
    mode: 'animation',
    pageTitle: 'page.animation',
    animElements: {
        animToggle: document.getElementById('animToggle'),
        animConfigSection: document.getElementById('animConfigSection'),
        animSparkle: document.getElementById('animSparkle'),
        animSparkleVal: document.getElementById('animSparkleVal'),
        animDrift: document.getElementById('animDrift'),
        animDriftVal: document.getElementById('animDriftVal'),
        animWobble: document.getElementById('animWobble'),
        animWobbleVal: document.getElementById('animWobbleVal'),
    },
});
