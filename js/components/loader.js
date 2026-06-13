/* ═══════════════════════════════════════════════════
   LOADER COMPONENT — Vanilla JS
   ═══════════════════════════════════════════════════ */

const Loader = (() => {
    const overlay = document.getElementById('loader-overlay');
    const textEl = document.getElementById('loader-text');

    function show(message = 'Generando sesión con IA...') {
        textEl.textContent = message;
        overlay.classList.remove('hidden');
    }

    function hide() {
        overlay.classList.add('hidden');
    }

    function updateText(message) {
        textEl.textContent = message;
    }

    return { show, hide, updateText };
})();
