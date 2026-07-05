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

    // ─── SAFE LOCALSTORAGE SETTER ───
    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.error('[Storage] Error al escribir en localStorage:', e);
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                if (window.Toast && typeof Toast.warning === 'function') {
                    Toast.warning('⚠️ Almacenamiento local lleno. Guarda o sincroniza tus sesiones en la nube para no perder cambios.');
                }
            }
            return false;
        }
    }

    // ─── CRUD ───

    function getAllSessions(includeDeleted = false) {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            const sessions = data ? JSON.parse(data) : [];
            if (includeDeleted) return sessions;
            return sessions.filter(s => !s.deleted_at);
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

            safeSetItem(STORAGE_KEY, JSON.stringify(sessions));

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
            const sessions = getAllSessions(true);
            const session = sessions.find(s => s.id === id);
            
            if (session) {
                session.deleted_at = new Date().toISOString();
                session.lastSaved = new Date().toISOString();
                safeSetItem(STORAGE_KEY, JSON.stringify(sessions));

                // Sincronización asíncrona con Supabase en background
                if (window.SupabaseClient && typeof SupabaseClient.saveSessionCloud === 'function') {
                    incrementSync();
                    SupabaseClient.getCurrentUser().then(user => {
                        if (user) {
                            return SupabaseClient.saveSessionCloud(session)
                                .then(() => console.log('[Storage] Soft-deleted en la nube:', id))
                                .catch(err => console.warn('[Storage] Error al borrar de la nube (soft-delete):', err));
                        }
                    }).finally(() => {
                        decrementSync();
                    });
                }
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
        safeSetItem(CURRENT_KEY, JSON.stringify(session));
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
        safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
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
            // 1. Obtener todas las sesiones locales (incluidas las soft-deleted)
            const localSessions = getAllSessions(true);
            
            // 2. Obtener sesiones de la nube (que incluyen deleted_at)
            const cloudSessions = await SupabaseClient.getSessionsCloud();

            // 3. Fusionar local y nube
            const mergedMap = new Map();

            // Agregar primero locales
            localSessions.forEach(s => mergedMap.set(s.id, s));

            // Agregar/sobreescribir con las de la nube si son más recientes
            cloudSessions.forEach(cs => {
                const local = mergedMap.get(cs.id);
                if (!local) {
                    mergedMap.set(cs.id, cs);
                } else {
                    const localTime = new Date(local.lastSaved || 0);
                    const cloudTime = new Date(cs.lastSaved || cs.last_saved || 0);
                    if (cloudTime > localTime) {
                        mergedMap.set(cs.id, cs);
                    }
                }
            });

            // Procesar la lista consolidada
            const finalSessions = [];
            const savePromises = [];

            for (const session of mergedMap.values()) {
                const cloudVersion = cloudSessions.find(cs => cs.id === session.id);

                // Si está marcada como eliminada
                if (session.deleted_at) {
                    // Si no está en la nube, es porque el admin la purgó o borró físicamente. La purgamos local.
                    if (!cloudVersion) {
                        console.log('[Sync] Purgando sesión eliminada localmente (no existe en la nube):', session.id);
                        continue;
                    }
                    // Si está en la nube pero no marcada como eliminada en la nube, actualizamos la nube
                    if (!cloudVersion.deleted_at) {
                        savePromises.push(SupabaseClient.saveSessionCloud(session));
                    }
                    session.synced = true;
                    finalSessions.push(session);
                } else {
                    // Sesión activa
                    if (!cloudVersion) {
                        // No está en la nube
                        // ¿Ya había sido sincronizada anteriormente? (Si tiene la marca synced)
                        if (session.synced) {
                            // Si ya fue sincronizada pero ya no está en la nube, fue borrada de la nube por el admin.
                            // Por lo tanto, la borramos localmente para evitar resurrecciones.
                            console.log('[Sync] Borrando sesión eliminada por administrador en nube:', session.id);
                            continue;
                        } else {
                            // Nueva sesión local nunca subida. La subimos.
                            session.synced = true;
                            savePromises.push(SupabaseClient.saveSessionCloud(session));
                            finalSessions.push(session);
                        }
                    } else {
                        // Existe en ambos lados y está activa.
                        // Si la versión local es más nueva, la subimos a la nube.
                        const localTime = new Date(session.lastSaved || 0);
                        const cloudTime = new Date(cloudVersion.lastSaved || 0);
                        if (localTime > cloudTime) {
                            savePromises.push(SupabaseClient.saveSessionCloud(session));
                        }
                        session.synced = true;
                        finalSessions.push(session);
                    }
                }
            }

            // Ejecutar subidas/sincronizaciones en la nube en paralelo
            if (savePromises.length > 0) {
                console.log(`[Sync] Sincronizando ${savePromises.length} sesiones en la nube en paralelo...`);
                await Promise.all(savePromises);
            }

            // Ordenar por fecha
            finalSessions.sort((a, b) => new Date(b.lastSaved || 0) - new Date(a.lastSaved || 0));

            // Guardar el resultado consolidado en LocalStorage
            safeSetItem(STORAGE_KEY, JSON.stringify(finalSessions));

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

