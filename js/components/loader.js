/* ═══════════════════════════════════════════════════
   LOADER COMPONENT — Vanilla JS
   ═══════════════════════════════════════════════════ */

const Loader = (() => {
    let overlay = null;
    let textEl = null;
    let initialized = false;

    function init() {
        if (initialized) return;
        overlay = document.getElementById('loader-overlay');
        textEl = document.getElementById('loader-text');
        initialized = true;
    }

    function show(message = 'Generando sesión con IA...') {
        init();
        if (textEl) textEl.textContent = message;
        if (overlay) overlay.classList.remove('hidden');
    }

    function hide() {
        init();
        if (overlay) overlay.classList.add('hidden');
    }

    function updateText(message) {
        init();
        if (textEl) textEl.textContent = message;
    }

    return { show, hide, updateText };
})();
