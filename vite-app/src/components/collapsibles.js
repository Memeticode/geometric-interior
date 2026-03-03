/**
 * Generic collapsible section toggle logic.
 * Attaches click handlers to `.collapsible-toggle` and `.sub-collapsible-toggle`
 * elements that toggle `aria-expanded` and the `collapsed` class on their target.
 */

export function initCollapsibles() {
    document.querySelectorAll('.collapsible-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const expanded = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!expanded));
            document.getElementById(btn.dataset.target).classList.toggle('collapsed', expanded);
        });
    });

    document.querySelectorAll('.sub-collapsible-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const expanded = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!expanded));
            document.getElementById(btn.dataset.target).classList.toggle('collapsed', expanded);
        });
    });
}
