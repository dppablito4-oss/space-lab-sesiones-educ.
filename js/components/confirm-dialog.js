/* ═══════════════════════════════════════════════════
   CONFIRM DIALOG — Vanilla JS
   Adaptado de mibitacora ConfirmDialog.jsx
   ═══════════════════════════════════════════════════ */

const ConfirmDialog = (() => {
    const overlay = document.getElementById('confirm-dialog');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('confirm-cancel');
    const acceptBtn = document.getElementById('confirm-accept');

    let _resolve = null;

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
        overlay.classList.add('hidden');
        if (_resolve) {
            _resolve(result);
            _resolve = null;
        }
    }

    // Event listeners
    cancelBtn.addEventListener('click', () => close(false));
    acceptBtn.addEventListener('click', () => close(true));

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
            close(false);
        }
    });

    return { show };
})();
