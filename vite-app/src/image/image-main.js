/**
 * Image Editor entry point — static single-render mode.
 * No animation loop, no sparkle/drift/wobble, no morph transitions.
 * Fold-in on initial render is kept.
 */
import { initEditor } from '../editor/editor-main.js';

initEditor({
    mode: 'image',
    pageTitle: 'page.image',
    animElements: null,
});
