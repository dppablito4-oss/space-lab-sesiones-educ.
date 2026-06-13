/* ═══════════════════════════════════════════════════
   AUTH UI — Interfaz y Lógica de Autenticación OTP
   Space Lab — Sesiones Educativas
   ═══════════════════════════════════════════════════ */

window.AuthUi = (() => {
    
    // referencias DOM
    let modal = null;
    let stepEmail = null;
    let stepOtp = null;
    let inputEmail = null;
    let inputOtp = null;
    let labelSentEmail = null;
    let btnSendOtp = null;
    let btnVerifyOtp = null;
    let btnBack = null;
    let btnClose = null;
    let btnLoginTrigger = null;
    let authHeaderContainer = null;

    let targetEmail = '';

    function init() {
        modal = document.getElementById('auth-modal');
        stepEmail = document.getElementById('auth-step-email');
        stepOtp = document.getElementById('auth-step-otp');
        inputEmail = document.getElementById('auth-email');
        inputOtp = document.getElementById('auth-otp');
        labelSentEmail = document.getElementById('auth-sent-email-label');
        btnSendOtp = document.getElementById('btn-send-otp');
        btnVerifyOtp = document.getElementById('btn-verify-otp');
        btnBack = document.getElementById('btn-auth-back');
        btnClose = document.getElementById('btn-close-auth');
        authHeaderContainer = document.getElementById('auth-header-container');

        // Insertar login trigger si no existe
        if (!authHeaderContainer) {
            console.warn('[AuthUi] #auth-header-container no encontrado en el DOM');
            return;
        }

        bindEvents();
        checkSessionState();
    }

    function bindEvents() {
        // Enviar OTP
        btnSendOtp.addEventListener('click', handleSendOtp);
        // Verificar OTP
        btnVerifyOtp.addEventListener('click', handleVerifyOtp);
        // Volver al paso de email
        btnBack.addEventListener('click', () => {
            showStep('email');
        });
        // Cerrar modal
        btnClose.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Eventos teclado
        inputEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendOtp();
            }
        });

        inputOtp.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleVerifyOtp();
            }
        });
    }

    function showStep(step) {
        if (step === 'email') {
            stepEmail.classList.remove('hidden');
            stepOtp.classList.add('hidden');
            inputOtp.value = '';
        } else {
            stepEmail.classList.add('hidden');
            stepOtp.classList.remove('hidden');
            labelSentEmail.textContent = targetEmail;
            inputOtp.focus();
        }
    }

    function openModal() {
        showStep('email');
        inputEmail.value = '';
        modal.classList.remove('hidden');
        inputEmail.focus();
    }

    function closeModal() {
        modal.classList.add('hidden');
    }

    async function handleSendOtp() {
        const email = inputEmail.value.trim();
        if (!email || !validateEmail(email)) {
            Toast.warning('Por favor ingresa un correo electrónico válido');
            return;
        }

        targetEmail = email;
        btnSendOtp.disabled = true;
        btnSendOtp.textContent = 'Enviando...';

        try {
            await SupabaseClient.sendOtp(email);
            Toast.success('¡Código OTP enviado! Revisa tu bandeja de entrada.');
            showStep('otp');
        } catch (e) {
            Toast.error('Error al enviar OTP: ' + e.message);
        } finally {
            btnSendOtp.disabled = false;
            btnSendOtp.textContent = 'Enviar Código OTP 📨';
        }
    }

    async function handleVerifyOtp() {
        const otp = inputOtp.value.trim();
        if (otp.length < 6) {
            Toast.warning('El código OTP debe tener 6 dígitos');
            return;
        }

        btnVerifyOtp.disabled = true;
        btnVerifyOtp.textContent = 'Verificando...';

        try {
            const result = await SupabaseClient.verifyOtp(targetEmail, otp);
            if (result.user) {
                Toast.success('¡Sesión iniciada correctamente en la nube!');
                closeModal();
                
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
            } else {
                Toast.error('Código incorrecto o expirado');
            }
        } catch (e) {
            Toast.error('Error de verificación: ' + e.message);
        } finally {
            btnVerifyOtp.disabled = false;
            btnVerifyOtp.textContent = 'Verificar Código 🔑';
        }
    }

    async function checkSessionState() {
        const user = await SupabaseClient.getCurrentUser();
        
        if (user) {
            const role = await SupabaseClient.getUserRole(user.id);
            const isAdmin = role === 'superadmin' || role === 'admin';

            authHeaderContainer.innerHTML = `
                <div class="user-menu-container">
                    <span class="user-email-tag" title="${user.email}">
                        👤 ${truncateEmail(user.email)}
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
