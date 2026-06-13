/* ═══════════════════════════════════════════════════
   AUTH UI — Interfaz y Lógica de Autenticación
   Space Lab — Sesiones Educativas
   ═══════════════════════════════════════════════════ */

window.AuthUi = (() => {
    
    // referencias DOM
    let modal = null;
    let authForm = null;
    let inputEmail = null;
    let inputPassword = null;
    let inputConfirmPassword = null;
    let inputUsername = null;
    let checkboxTerms = null;
    let btnSubmit = null;
    let btnToggle = null;
    let btnClose = null;
    let authHeaderContainer = null;
    
    let authTitle = null;
    let authSubtitle = null;
    let groupUsername = null;
    let groupConfirmPassword = null;
    let groupTerms = null;
    let toggleText = null;

    let isLoginMode = true;

    function init() {
        modal = document.getElementById('auth-modal');
        authForm = document.getElementById('auth-form');
        inputEmail = document.getElementById('auth-email');
        inputPassword = document.getElementById('auth-password');
        inputConfirmPassword = document.getElementById('auth-confirm-password');
        inputUsername = document.getElementById('auth-username');
        checkboxTerms = document.getElementById('auth-terms');
        btnSubmit = document.getElementById('btn-submit-auth');
        btnToggle = document.getElementById('auth-toggle-mode');
        btnClose = document.getElementById('btn-close-auth');
        authHeaderContainer = document.getElementById('auth-header-container');

        authTitle = document.getElementById('auth-title');
        authSubtitle = document.getElementById('auth-subtitle');
        groupUsername = document.getElementById('auth-group-username');
        groupConfirmPassword = document.getElementById('auth-group-confirm-password');
        groupTerms = document.getElementById('auth-group-terms');
        toggleText = document.getElementById('auth-toggle-text');

        if (!authHeaderContainer) {
            console.warn('[AuthUi] #auth-header-container no encontrado en el DOM');
            return;
        }

        bindEvents();
        checkSessionState();
    }

    function bindEvents() {
        // Alternar modo
        btnToggle.addEventListener('click', (e) => {
            e.preventDefault();
            setMode(!isLoginMode);
        });

        // Enviar formulario
        authForm.addEventListener('submit', handleAuthSubmit);

        // Cerrar modal
        btnClose.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    function setMode(isLogin) {
        isLoginMode = isLogin;
        
        // Limpiar inputs
        inputEmail.value = '';
        inputPassword.value = '';
        inputConfirmPassword.value = '';
        inputUsername.value = '';
        checkboxTerms.checked = false;

        if (isLogin) {
            authTitle.textContent = 'Iniciar Sesión 🌌';
            authSubtitle.textContent = 'Ingresa con tu correo y contraseña para sincronizar tus sesiones en la nube.';
            btnSubmit.textContent = 'Iniciar Sesión 🚪';
            toggleText.textContent = '¿No tienes una cuenta?';
            btnToggle.textContent = 'Créala aquí';

            groupUsername.classList.add('hidden');
            groupConfirmPassword.classList.add('hidden');
            groupTerms.classList.add('hidden');

            inputUsername.removeAttribute('required');
            inputConfirmPassword.removeAttribute('required');
        } else {
            authTitle.textContent = 'Crear Cuenta 🚀';
            authSubtitle.textContent = 'Regístrate gratis para guardar y respaldar tus sesiones en la nube.';
            btnSubmit.textContent = 'Crear Cuenta 🔑';
            toggleText.textContent = '¿Ya tienes una cuenta?';
            btnToggle.textContent = 'Inicia sesión aquí';

            groupUsername.classList.remove('hidden');
            groupConfirmPassword.classList.remove('hidden');
            groupTerms.classList.remove('hidden');

            inputUsername.setAttribute('required', 'required');
            inputConfirmPassword.setAttribute('required', 'required');
        }
        
        setTimeout(() => inputEmail.focus(), 50);
    }

    function openModal() {
        setMode(true); // Empezar por defecto en Login
        modal.classList.remove('hidden');
    }

    function closeModal() {
        modal.classList.add('hidden');
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        
        const email = inputEmail.value.trim();
        const password = inputPassword.value;

        if (!email || !validateEmail(email)) {
            Toast.warning('Por favor ingresa un correo electrónico válido');
            return;
        }

        if (password.length < 6) {
            Toast.warning('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        btnSubmit.disabled = true;

        if (isLoginMode) {
            btnSubmit.textContent = 'Iniciando sesión...';
            try {
                const result = await SupabaseClient.signIn(email, password);
                if (result.user) {
                    Toast.success('¡Sesión iniciada correctamente en la nube!');
                    closeModal();
                    await afterSuccessAuth();
                } else {
                    Toast.error('Credenciales incorrectas');
                }
            } catch (err) {
                Toast.error('Error al iniciar sesión: ' + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Iniciar Sesión 🚪';
            }
        } else {
            // Modo Registro
            const username = inputUsername.value.trim();
            const confirmPassword = inputConfirmPassword.value;
            const acceptedTerms = checkboxTerms.checked;

            if (username.length < 3) {
                Toast.warning('El apodo debe tener al menos 3 caracteres');
                btnSubmit.disabled = false;
                return;
            }

            if (/\s/.test(username)) {
                Toast.warning('El apodo no puede tener espacios. Usa guiones (ej. mi-apodo)');
                btnSubmit.disabled = false;
                return;
            }

            if (password !== confirmPassword) {
                Toast.warning('Las contraseñas no coinciden');
                btnSubmit.disabled = false;
                return;
            }

            if (!acceptedTerms) {
                Toast.warning('Debes aceptar los Términos y Condiciones');
                btnSubmit.disabled = false;
                return;
            }

            btnSubmit.textContent = 'Creando cuenta...';
            try {
                const result = await SupabaseClient.signUp(email, password, username);
                if (result.user) {
                    Toast.success('¡Cuenta creada con éxito!');
                    
                    // Auto-login instantáneo si confirmación de correo está apagada
                    try {
                        const loginResult = await SupabaseClient.signIn(email, password);
                        if (loginResult.user) {
                            Toast.success('¡Sesión iniciada automáticamente!');
                            closeModal();
                            await afterSuccessAuth();
                        } else {
                            setMode(true);
                        }
                    } catch (loginErr) {
                        Toast.info('Por favor inicia sesión con tu nueva cuenta');
                        setMode(true);
                    }
                } else {
                    Toast.error('No se pudo registrar la cuenta');
                }
            } catch (err) {
                Toast.error('Error al registrar cuenta: ' + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Crear Cuenta 🔑';
            }
        }
    }

    async function afterSuccessAuth() {
        // Ejecutar sincronización de sesiones locales a la nube
        if (window.Storage && typeof window.Storage.syncSessions === 'function') {
            await window.Storage.syncSessions();
        }
        
        // Recargar cabecera y lista
        await checkSessionState();
        
        // Disparar recarga de sesiones en la UI principal
        if (window.appReloadSessions) {
            window.appReloadSessions();
        }
    }

    async function checkSessionState() {
        const user = await SupabaseClient.getCurrentUser();
        
        if (user) {
            const role = await SupabaseClient.getUserRole(user.id);
            const isAdmin = role === 'superadmin' || role === 'admin';
            const displayName = user.user_metadata?.username || truncateEmail(user.email);

            authHeaderContainer.innerHTML = `
                <div class="user-menu-container">
                    <span class="user-email-tag" title="${user.email}">
                        👤 ${displayName}
                    </span>
                    ${isAdmin ? `
                        <a href="admin.html" class="btn btn-accent btn-sm" style="text-decoration: none;">
                            👑 Admin
                        </a>
                    ` : ''}
                    <button id="btn-logout" class="btn btn-ghost btn-sm" title="Cerrar sesión">
                        🚪 Salir
                    </button>
                </div>
            `;

            // Vincular evento de logout
            document.getElementById('btn-logout').addEventListener('click', async () => {
                const confirmed = await ConfirmDialog.show({
                    title: '¿Cerrar sesión?',
                    message: 'Volverás a trabajar en modo offline con almacenamiento local.',
                    confirmText: 'Cerrar Sesión'
                });
                
                if (confirmed) {
                    try {
                        await SupabaseClient.logout();
                        Toast.info('Sesión cerrada');
                        checkSessionState();
                        
                        // Recargar lista de sesiones
                        if (window.appReloadSessions) {
                            window.appReloadSessions();
                        }
                    } catch (e) {
                        Toast.error('Error al cerrar sesión: ' + e.message);
                    }
                }
            });

        } else {
            authHeaderContainer.innerHTML = `
                <button id="btn-login-trigger" class="btn btn-ghost btn-sm">
                    👤 Iniciar Sesión
                </button>
            `;

            document.getElementById('btn-login-trigger').addEventListener('click', openModal);
        }
    }

    // utilidades sencillas
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function truncateEmail(email) {
        if (email.length <= 18) return email;
        const [user, domain] = email.split('@');
        if (user.length > 8) {
            return user.slice(0, 6) + '...' + '@' + domain;
        }
        return email;
    }

    return {
        init,
        openModal,
        checkSessionState
    };
})();
