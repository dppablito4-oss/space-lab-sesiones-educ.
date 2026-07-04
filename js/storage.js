/* ═══════════════════════════════════════════════════
   STORAGE — LocalStorage Manager
   CRUD de sesiones + auto-save con debounce
   ═══════════════════════════════════════════════════ */

const Storage = (() => {
    const STORAGE_KEY = 'spacelab_sessions';
    const CURRENT_KEY = 'spacelab_current';
    const SETTINGS_KEY = 'spacelab_settings';

    // ─── ACTIVE SYNC TRACKING ───
    let activeSyncsCount = 0;

    function incrementSync() {
        activeSyncsCount++;
    }

    function decrementSync() {
        activeSyncsCount = Math.max(0, activeSyncsCount - 1);
    }

    window.addEventListener('beforeunload', (e) => {
        if (activeSyncsCount > 0) {
            e.preventDefault();
            e.returnValue = 'Hay sincronizaciones de base de datos activas en segundo plano. ¿Estás seguro de que quieres salir?';
            return e.returnValue;
        }
    });

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

            // Sincronización asíncrona con Supabase en background si está logueado
            if (window.SupabaseClient && typeof SupabaseClient.saveSessionCloud === 'function') {
                incrementSync();
                SupabaseClient.getCurrentUser().then(user => {
                    if (user) {
                        return SupabaseClient.saveSessionCloud(session)
                            .then(() => console.log('[Storage] Sincronizado en la nube:', session.id))
                            .catch(err => console.warn('[Storage] Error al subir a la nube:', err));
                    }
                }).finally(() => {
                    decrementSync();
                });
            }

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

            // Sincronización asíncrona con Supabase en background
            if (window.SupabaseClient && typeof SupabaseClient.deleteSessionCloud === 'function') {
                incrementSync();
                SupabaseClient.getCurrentUser().then(user => {
                    if (user) {
                        return SupabaseClient.deleteSessionCloud(id)
                            .then(() => console.log('[Storage] Eliminado de la nube:', id))
                            .catch(err => console.warn('[Storage] Error al borrar de la nube:', err));
                    }
                }).finally(() => {
                    decrementSync();
                });
            }

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
        } catch {
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
        } catch {
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
                } catch {
                    reject(new Error('Archivo JSON inválido'));
                }
            };
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsText(file);
        });
    }

    async function syncSessions() {
        if (!window.SupabaseClient) return;
        const user = await SupabaseClient.getCurrentUser();
        if (!user) return;

        incrementSync();
        try {
            // 1. Obtener sesiones locales
            const localSessions = getAllSessions();
            
            // 2. Obtener sesiones de la nube
            const cloudSessions = await SupabaseClient.getSessionsCloud();

            // 3. Fusionar sin duplicados. Si hay conflicto, prevalece la versión más reciente (lastSaved)
            const mergedMap = new Map();

            // Agregar primero locales
            localSessions.forEach(s => mergedMap.set(s.id, s));

            // Agregar/sobreescribir con las de la nube si son más recientes
            cloudSessions.forEach(s => {
                const existing = mergedMap.get(s.id);
                if (!existing || new Date(s.lastSaved || 0) > new Date(existing.lastSaved || 0)) {
                    mergedMap.set(s.id, s);
                }
            });

            const mergedSessions = Array.from(mergedMap.values());
            
            // Ordenar por fecha
            mergedSessions.sort((a, b) => new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0));

            // Guardar el resultado consolidado en LocalStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSessions));

            // 4. Subir a la nube aquellas que falten o sean más recientes localmente
            for (const session of mergedSessions) {
                const cloudVersion = cloudSessions.find(cs => cs.id === session.id);
                if (!cloudVersion || new Date(session.lastSaved || 0) > new Date(cloudVersion.lastSaved || 0)) {
                    await SupabaseClient.saveSessionCloud(session);
                }
            }

            console.log('🔄 Sesiones sincronizadas con Supabase con éxito');
        } catch (e) {
            console.error('[Storage] Error al sincronizar sesiones:', e);
        } finally {
            decrementSync();
        }
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
        importFromJSON,
        syncSessions
    };
})();

window.StorageManager = Storage;

