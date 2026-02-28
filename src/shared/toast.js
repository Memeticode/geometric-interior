/**
 * Toast notification module.
 * Self-contained — manages its own DOM references.
 */

let toastTimer = 0;

function getToastEl() {
    return document.getElementById('toast');
}

export function toast(msg) {
    if (!msg) return;
    clearTimeout(toastTimer);
    document.getElementById('toastMsg').textContent = msg;
    getToastEl().classList.add('visible');
    toastTimer = setTimeout(() => {
        getToastEl().classList.remove('visible');
    }, 1000);
}

export function initToastClose() {
    const closeBtn = document.getElementById('toastClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            clearTimeout(toastTimer);
            getToastEl().classList.remove('visible');
        });
    }
}
