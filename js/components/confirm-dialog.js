/* ═══════════════════════════════════════════════════
   CONFIRM DIALOG — Vanilla JS
   Adaptado de mibitacora ConfirmDialog.jsx
   ═══════════════════════════════════════════════════ */

const ConfirmDialog = (() => {
    let overlay = null;
    let titleEl = null;
    let messageEl = null;
    let cancelBtn = null;
    let acceptBtn = null;
    let initialized = false;
    let _resolve = null;

    function init() {
        if (initialized) return;
        overlay = document.getElementById('confirm-dialog');
        if (!overlay) return;

        titleEl = document.getElementById('confirm-title');
        messageEl = document.getElementById('confirm-message');
        cancelBtn = document.getElementById('confirm-cancel');
        acceptBtn = document.getElementById('confirm-accept');

        // Event listeners
        if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));
        if (acceptBtn) acceptBtn.addEventListener('click', () => close(true));

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) {
                close(false);
            }
        });

        initialized = true;
    }

    /**
     * Show a confirmation dialog
     * @param {Object} options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog message
     * @param {string} options.confirmText - Accept button text
     * @param {string} options.cancelText - Cancel button text
     * @returns {Promise<boolean>} - True if confirmed, false otherwise
     */
    function show({ title = '¿Estás seguro?', message = 'Esta acción no se puede deshacer.', confirmText = 'Confirmar', cancelText = 'Cancelar' } = {}) {
        init();
        if (!initialized) {
            // Fallback for pages without the dialog markup
            const confirmed = window.confirm(`${title}\n\n${message}`);
            return Promise.resolve(confirmed);
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        acceptBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        overlay.classList.remove('hidden');

        return new Promise((resolve) => {
            _resolve = resolve;
        });
    }

    function close(result) {
        if (overlay) overlay.classList.add('hidden');
        if (_resolve) {
            _resolve(result);
            _resolve = null;
        }
    }

    return { show };
})();
