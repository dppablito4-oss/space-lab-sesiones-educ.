/* ═══════════════════════════════════════════════════
   STORAGE — LocalStorage Manager
   CRUD de sesiones + auto-save con debounce
   ═══════════════════════════════════════════════════ */

const Storage = (() => {
    const STORAGE_KEY = 'spacelab_sessions';
    const CURRENT_KEY = 'spacelab_current';
    const SETTINGS_KEY = 'spacelab_settings';

    // ─── CRUD ───

    function getAllSessions() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[Storage] Error reading sessions:', e);
            return [];
        }
    }

    function getSession(id) {
        const sessions = getAllSessions();
        return sessions.find(s => s.id === id) || null;
    }

    function saveSession(session) {
        try {
            const sessions = getAllSessions();
            const idx = sessions.findIndex(s => s.id === session.id);

            session.lastSaved = new Date().toISOString();

            if (idx >= 0) {
                sessions[idx] = session;
            } else {
                sessions.unshift(session);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
            return true;
        } catch (e) {
            console.error('[Storage] Error saving session:', e);
            return false;
        }
    }

    function deleteSession(id) {
        try {
            const sessions = getAllSessions().filter(s => s.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
            return true;
        } catch (e) {
            console.error('[Storage] Error deleting session:', e);
            return false;
        }
    }

    // ─── CURRENT SESSION (working draft) ───

    function getCurrentSession() {
        try {
            const data = localStorage.getItem(CURRENT_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    function setCurrentSession(session) {
        try {
            localStorage.setItem(CURRENT_KEY, JSON.stringify(session));
        } catch (e) {
            console.error('[Storage] Error setting current session:', e);
        }
    }

    function clearCurrentSession() {
        localStorage.removeItem(CURRENT_KEY);
    }

    // ─── SETTINGS ───

    function getSettings() {
        try {
            const data = localStorage.getItem(SETTINGS_KEY);
            return data ? JSON.parse(data) : {
                editMode: true,
                autoSave: true,
                lastTemplate: 'estandar'
            };
        } catch (e) {
            return { editMode: true, autoSave: true, lastTemplate: 'estandar' };
        }
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error('[Storage] Error saving settings:', e);
        }
    }

    // ─── AUTO-SAVE (Debounced) ───

    let _autoSaveTimer = null;
    let _autoSaveCallback = null;

    function setupAutoSave(callback, delay = 3000) {
        _autoSaveCallback = callback;
        
        // Listen for changes in contenteditable areas
        document.addEventListener('input', (e) => {
            if (e.target.closest('#session-sheet') && e.target.hasAttribute('contenteditable')) {
                triggerAutoSave(delay);
            }
        });
    }

    function triggerAutoSave(delay = 3000) {
        clearTimeout(_autoSaveTimer);
        
        // Update save indicator to "saving..."
        updateSaveIndicator('saving');
        
        _autoSaveTimer = setTimeout(() => {
            if (_autoSaveCallback) {
                _autoSaveCallback();
                updateSaveIndicator('saved');
            }
        }, delay);
    }

    function updateSaveIndicator(state) {
        const indicator = document.getElementById('save-indicator');
        const text = indicator.querySelector('.save-text');
        
        indicator.classList.remove('saved', 'saving');

        switch (state) {
            case 'saving':
                indicator.classList.add('saving');
                text.textContent = 'Guardando...';
                break;
            case 'saved':
                indicator.classList.add('saved');
                text.textContent = 'Guardado ✓';
                // Reset after 5 seconds
                setTimeout(() => {
                    indicator.classList.remove('saved');
                    text.textContent = 'Sin cambios';
                }, 5000);
                break;
            default:
                text.textContent = 'Sin cambios';
        }
    }

    // ─── UTILITIES ───

    function generateId() {
        return 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    }

    function exportAsJSON(session) {
        const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sesion_${session.metadata?.titulo || 'sin_titulo'}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject(new Error('Archivo JSON inválido'));
                }
            };
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsText(file);
        });
    }

    return {
        getAllSessions,
        getSession,
        saveSession,
        deleteSession,
        getCurrentSession,
        setCurrentSession,
        clearCurrentSession,
        getSettings,
        saveSettings,
        setupAutoSave,
        triggerAutoSave,
        updateSaveIndicator,
        generateId,
        exportAsJSON,
        importFromJSON
    };
})();
