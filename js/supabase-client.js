/* ═══════════════════════════════════════════════════
   SUPABASE CLIENT — Configuración & Helpers de Base de Datos
   Space Lab — Sesiones Educativas
   ═══════════════════════════════════════════════════ */

window.SupabaseClient = (() => {
    // Credenciales dadas por el usuario
    const SUPABASE_URL = 'https://koptglmifwpzrfzvipnm.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_erAiat0Q6VFXk5gveRnj4A_3WKFzBzI';

    let supabase = null;

    // Inicializar cliente de Supabase
    try {
        if (window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true
                }
            });
            console.log('⚡ Supabase Client initialized successfully');
        } else {
            console.error('[Supabase] SDK no encontrado. Asegúrate de incluir la etiqueta de script en tu HTML.');
        }
    } catch (e) {
        console.error('[Supabase] Error al inicializar el cliente:', e);
    }

    // ─── AUTHENTICATION HELPERS ───

    /**
     * Envía un correo electrónico con código OTP
     */
    async function sendOtp(email) {
        if (!supabase) throw new Error('Supabase no inicializado');
        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                emailRedirectTo: window.location.origin
            }
        });
        if (error) throw error;
        return true;
    }

    /**
     * Verifica el código OTP ingresado por el usuario
     */
    async function verifyOtp(email, token) {
        if (!supabase) throw new Error('Supabase no inicializado');
        
        // Intentar con type 'email' (login)
        let { data, error } = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: token.trim(),
            type: 'email'
        });

        // Si falla, intentar como 'signup' por si es un nuevo usuario
        if (error) {
            const signupResult = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: token.trim(),
                type: 'signup'
            });
            if (signupResult.error) throw signupResult.error;
            data = signupResult.data;
        }

        // Registrar log de seguridad
        if (data?.user) {
            await logAction('LOGIN_SUCCESS', `Usuario ingresó correctamente por OTP: ${email}`);
            // Verificar si el perfil existe, sino crearlo en el cliente como fallback
            await ensureUserProfile(data.user);
        }

        return data;
    }

    /**
     * Asegura la creación del perfil si falla el trigger de BD
     */
    async function ensureUserProfile(user) {
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (!data) {
                const isMaster = user.email === 'pabloclsa87@gmail.com';
                await supabase.from('profiles').insert([{
                    id: user.id,
                    email: user.email,
                    role: isMaster ? 'superadmin' : 'user'
                }]);
            }
        } catch (e) {
            console.warn('[Supabase] Error al asegurar el perfil del usuario:', e);
        }
    }

    /**
     * Cierra la sesión del usuario actual
     */
    async function logout() {
        if (!supabase) throw new Error('Supabase no inicializado');
        const user = await getCurrentUser();
        if (user) {
            await logAction('LOGOUT', `Usuario cerró sesión: ${user.email}`);
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return true;
    }

    /**
     * Obtiene el usuario actual autenticado
     */
    async function getCurrentUser() {
        if (!supabase) return null;
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }

    /**
     * Obtiene el rol del usuario actual desde su perfil
     */
    async function getUserRole(userId) {
        if (!supabase || !userId) return 'user';
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();
            if (error) throw error;
            return data?.role || 'user';
        } catch (e) {
            console.error('[Supabase] Error al obtener el rol del usuario:', e);
            return 'user';
        }
    }

    // ─── DATABASE CRUD HELPERS ───

    /**
     * Obtiene todas las sesiones guardadas en la nube para el usuario
     */
    async function getSessionsCloud() {
        if (!supabase) return [];
        const { data, error } = await supabase
            .from('sesiones')
            .select('*')
            .order('last_saved', { ascending: false });
        
        if (error) {
            console.error('[Supabase] Error al leer sesiones:', error);
            throw error;
        }

        return data.map(row => ({
            ...row.session_data,
            id: row.id,
            lastSaved: row.last_saved
        }));
    }

    /**
     * Guarda una sesión en la nube
     */
    async function saveSessionCloud(session) {
        if (!supabase) return false;
        const user = await getCurrentUser();
        if (!user) return false;

        const { error } = await supabase
            .from('sesiones')
            .upsert({
                id: session.id,
                user_id: user.id,
                titulo: session.metadata?.titulo || 'Sin título',
                template: session.template || 'estandar',
                session_data: session,
                last_saved: new Date().toISOString()
            });

        if (error) {
            console.error('[Supabase] Error al guardar sesión en nube:', error);
            throw error;
        }
        return true;
    }

    /**
     * Elimina una sesión de la nube
     */
    async function deleteSessionCloud(id) {
        if (!supabase) return false;
        const { error } = await supabase
            .from('sesiones')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[Supabase] Error al eliminar sesión de la nube:', error);
            throw error;
        }
        return true;
    }

    /**
     * Inserta un log de seguridad
     */
    async function logAction(action, details) {
        if (!supabase) return;
        try {
            const user = await getCurrentUser();
            await supabase.from('security_logs').insert([{
                user_id: user ? user.id : null,
                action: action,
                details: details
            }]);
        } catch (e) {
            console.warn('[Supabase] No se pudo escribir el log de seguridad:', e);
        }
    }

    return {
        get client() { return supabase; },
        sendOtp,
        verifyOtp,
        logout,
        getCurrentUser,
        getUserRole,
        getSessionsCloud,
        saveSessionCloud,
        deleteSessionCloud,
        logAction
    };
})();
