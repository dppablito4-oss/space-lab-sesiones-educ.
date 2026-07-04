/* ═══════════════════════════════════════════════════
   ADMIN.JS — Controlador del Panel Maestro
   Space Lab — Sesiones Educativas
   ═══════════════════════════════════════════════════ */

;(function() {
    'use strict';

    // ─── AUTHENTICATION CHECK ───
    async function checkAdminAuth() {
        if (!window.SupabaseClient) {
            alert('Supabase no está configurado');
            window.location.href = 'index.html';
            return;
        }

        try {
            const user = await SupabaseClient.getCurrentUser();
            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            const role = await SupabaseClient.getUserRole(user.id);
            if (role !== 'superadmin' && role !== 'admin') {
                alert('No tienes permisos de administrador para ver esta página');
                window.location.href = 'index.html';
                return;
            }

            // Mostrar el email del admin
            document.getElementById('admin-user-email').textContent = `👑 ${user.email}`;
            
            // Iniciar aplicación
            initAdmin();
        } catch (e) {
            console.error('[Admin] Error en autenticación:', e);
            window.location.href = 'index.html';
        }
    }

    // ─── ADMIN SYSTEM ───
    function initAdmin() {
        bindTabEvents();
        bindFormEvents();
        
        // Cargar primera tab
        loadTabData('smtp');

        // Logout
        document.getElementById('btn-admin-logout').addEventListener('click', async () => {
            const confirmed = await ConfirmDialog.show({
                title: '¿Cerrar sesión de Admin?',
                message: 'Se cerrará la sesión de administrador.',
                confirmText: 'Cerrar Sesión'
            });

            if (confirmed) {
                await SupabaseClient.logout();
                window.location.href = 'index.html';
            }
        });
    }

    // Navegación de Pestañas
    function bindTabEvents() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;

                tabButtons.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.add('hidden'));

                btn.classList.add('active');
                document.getElementById(`tab-${targetTab}`).classList.remove('hidden');

                // Cargar datos al cambiar de tab
                loadTabData(targetTab);
            });
        });

        // Botones de actualización
        document.getElementById('btn-refresh-logs').addEventListener('click', () => loadTabData('logs'));
        document.getElementById('btn-refresh-sessions').addEventListener('click', () => loadTabData('sessions'));
    }

    // Carga de datos correspondientes a cada pestaña
    function loadTabData(tabName) {
        switch (tabName) {
            case 'smtp':
                fetchSmtpConfig();
                break;
            case 'logs':
                fetchSecurityLogs();
                break;
            case 'sessions':
                fetchServerSessions();
                break;
        }
    }

    // ─── SMTP CONFIGURATION ───
    async function fetchSmtpConfig() {
        try {
            const { data, error } = await SupabaseClient.client
                .from('corporate_email_settings')
                .select('smtp_email, smtp_host, smtp_port, smtp_secure')
                .eq('id', 1)
                .maybeSingle();

            if (error) throw error;
            
            if (data) {
                document.getElementById('smtp-email').value = data.smtp_email || '';
                document.getElementById('smtp-host').value = data.smtp_host || 'smtp.gmail.com';
                document.getElementById('smtp-port').value = data.smtp_port || 465;
                document.getElementById('smtp-secure').checked = data.smtp_secure !== undefined ? data.smtp_secure : true;
            }
        } catch (e) {
            console.error('[Admin] Error al cargar configuración SMTP:', e);
        }
    }

    // ─── AUDIT SECURITY LOGS ───
    async function fetchSecurityLogs() {
        const tbody = document.getElementById('logs-tbody');
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Cargando registros...</td></tr>';

        try {
            const { data, error } = await SupabaseClient.client
                .from('security_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No hay logs registrados</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(log => `
                <tr>
                    <td style="white-space: nowrap;">${formatDate(log.created_at)}</td>
                    <td style="font-family: var(--font-mono); font-size: 0.8rem;">${log.user_id || 'Sistema/Anónimo'}</td>
                    <td><span class="badge ${getLogBadgeClass(log.action)}">${log.action}</span></td>
                    <td>${escHTML(log.details)}</td>
                </tr>
            `).join('');

        } catch (e) {
            Toast.error('Error al cargar logs: ' + e.message);
            tbody.innerHTML = '<tr><td colspan="4" class="table-empty" style="color: var(--danger);">Error al cargar registros</td></tr>';
        }
    }

    // ─── SESSIONS MONITORING ───
    async function fetchServerSessions() {
        const tbody = document.getElementById('sessions-tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Cargando sesiones...</td></tr>';

        try {
            // Obtenemos sesiones
            const { data: sessions, error: sesError } = await SupabaseClient.client
                .from('sesiones')
                .select('*')
                .order('last_saved', { ascending: false });

            if (sesError) throw sesError;

            // Obtenemos perfiles de usuario para traducir user_id a email
            const { data: profiles, error: profError } = await SupabaseClient.client
                .from('profiles')
                .select('id, email');
            
            const profileMap = new Map();
            if (!profError && profiles) {
                profiles.forEach(p => profileMap.set(p.id, p.email));
            }

            if (!sessions || sessions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No hay sesiones guardadas en el servidor</td></tr>';
                return;
            }

            tbody.innerHTML = sessions.map(s => {
                const email = profileMap.get(s.user_id) || s.user_id;
                const metadata = s.session_data?.metadata || {};
                
                return `
                    <tr>
                        <td style="font-family: var(--font-mono); font-size: 0.75rem;">${s.id}</td>
                        <td title="${s.user_id}">${escHTML(email)}</td>
                        <td>${escHTML(metadata.area || 'Sin Área')} / ${escHTML(metadata.grado || 'Sin Grado')}</td>
                        <td><strong>${escHTML(s.titulo || 'Sin Título')}</strong></td>
                        <td>${formatDate(s.last_saved)}</td>
                        <td>
                            <div style="display: flex; gap: 4px; justify-content: center;">
                                <button class="btn btn-ghost btn-sm btn-preview" data-id="${s.id}" title="Previsualizar Sesión">👁️ Previsualizar</button>
                                <button class="btn btn-ghost btn-sm btn-inspect" data-id="${s.id}" title="Ver JSON de la sesión">📦 JSON</button>
                                <button class="btn btn-danger-ghost btn-sm btn-delete-session" data-id="${s.id}" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2);" title="Eliminar Sesión">🗑️ Eliminar</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Vincular evento de inspección
            tbody.querySelectorAll('.btn-inspect').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const session = sessions.find(s => s.id === id);
                    if (session) {
                        inspectSessionJSON(session);
                    }
                });
            });

            // Vincular evento de previsualización
            tbody.querySelectorAll('.btn-preview').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const session = sessions.find(s => s.id === id);
                    if (session) {
                        previewSessionHtml(session);
                    }
                });
            });

            // Vincular evento de eliminación
            tbody.querySelectorAll('.btn-delete-session').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    deleteServerSession(id);
                });
            });

        } catch (e) {
            Toast.error('Error al cargar sesiones: ' + e.message);
            tbody.innerHTML = '<tr><td colspan="6" class="table-empty" style="color: var(--danger);">Error al cargar sesiones</td></tr>';
        }
    }

    // Previsualizar la sesión en HTML con estilos e iframe aislado
    function previewSessionHtml(session) {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.zIndex = '1000';
        
        overlay.innerHTML = `
            <div class="glass-card" style="width: 95%; max-width: 900px; height: 90vh; padding: 1.5rem; display: flex; flex-direction: column; position: relative; gap: 1rem;">
                <button id="btn-close-preview" class="btn btn-ghost btn-sm" style="position: absolute; top: 1rem; right: 1rem;">✕</button>
                <h3 style="margin-top: 0; margin-bottom: 0;">Previsualización de Sesión: ${escHTML(session.titulo || 'Sin Título')}</h3>
                
                <div style="flex: 1; border-radius: 8px; border: 1px solid var(--border); overflow: hidden; background: #ffffff;">
                    <iframe id="preview-iframe" style="width: 100%; height: 100%; border: none;"></iframe>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.8rem; color: #a1a1aa;">Docente: ${escHTML(session.user_id)}</span>
                    <button id="btn-print-preview" class="btn btn-primary">Imprimir / Guardar PDF 🖨️</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const iframe = overlay.querySelector('#preview-iframe');
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${escHTML(session.titulo || 'Sesión de Aprendizaje')}</title>
                <link rel="stylesheet" href="css/style.css">
                <link rel="stylesheet" href="css/print.css" media="print">
                <style>
                    body {
                        background: #f1f5f9;
                        padding: 20px;
                        display: flex;
                        justify-content: center;
                        font-family: Arial, sans-serif;
                    }
                    .session-sheet {
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                        background-color: #ffffff;
                        width: 100%;
                        max-width: 800px;
                    }
                    .no-print {
                        display: none !important;
                    }
                </style>
            </head>
            <body>
                <div class="session-sheet" style="--theme-border-color: ${session.session_data?.design?.themeColor || '#000000'}; --session-font-family: ${session.session_data?.design?.fontFamily || 'Arial, sans-serif'}; --session-font-size: ${session.session_data?.design?.fontSize || '10pt'}; --session-cell-padding: ${session.session_data?.design?.padding || '4px 6px'}; --session-line-height: ${session.session_data?.design?.lineHeight || '1.4'}; --theme-label-bg: ${session.session_data?.design?.headerBg || '#f1f5f9'};">
                    ${session.htmlContent || '<h3>No hay contenido HTML guardado para esta sesión</h3>'}
                </div>
            </body>
            </html>
        `);
        doc.close();

        const close = () => document.body.removeChild(overlay);
        overlay.querySelector('#btn-close-preview').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        overlay.querySelector('#btn-print-preview').addEventListener('click', () => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        });
    }

    // Eliminar la sesión del servidor con diálogo de confirmación
    async function deleteServerSession(id) {
        const confirmed = await ConfirmDialog.show({
            title: '¿Eliminar Sesión?',
            message: `¿Estás seguro de que deseas eliminar permanentemente la sesión con ID: ${id}? Esta acción no se puede deshacer y afectará al docente creador.`,
            confirmText: 'Eliminar',
            cancelText: 'Cancelar'
        });

        if (!confirmed) return;

        try {
            const { error } = await SupabaseClient.client
                .from('sesiones')
                .delete()
                .eq('id', id);

            if (error) throw error;

            Toast.success('Sesión eliminada correctamente');
            fetchServerSessions(); // Recargar lista
        } catch (e) {
            console.error('[Admin] Error al eliminar sesión:', e);
            Toast.error('Error al eliminar sesión: ' + e.message);
        }
    }

    // Mostrar ventana emergente/JSON de la sesión
    function inspectSessionJSON(session) {
        const jsonStr = JSON.stringify(session.session_data, null, 2);
        
        // Crear un modal temporal de visualización
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.zIndex = '1000';
        
        overlay.innerHTML = `
            <div class="glass-card" style="width: 90%; max-width: 700px; padding: 2rem; max-height: 80vh; display: flex; flex-direction: column; position: relative;">
                <button id="btn-close-inspect" class="btn btn-ghost btn-sm" style="position: absolute; top: 1rem; right: 1rem;">✕</button>
                <h3 style="margin-top: 0; margin-bottom: 1rem;">Detalle de Sesión: ${escHTML(session.titulo || 'Sin Título')}</h3>
                <div style="flex: 1; overflow-y: auto; text-align: left; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 1rem; border: 1px solid var(--border);">
                    <pre style="font-family: var(--font-mono); font-size: 0.8rem; margin: 0; color: #a78bfa; white-space: pre-wrap; word-break: break-all;">${escHTML(jsonStr)}</pre>
                </div>
                <div style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: var(--space-sm);">
                    <button id="btn-download-inspect" class="btn btn-primary">Descargar JSON 📥</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Cerrar modal
        const close = () => document.body.removeChild(overlay);
        overlay.querySelector('#btn-close-inspect').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        // Descargar JSON
        overlay.querySelector('#btn-download-inspect').addEventListener('click', () => {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sesion_${session.titulo || 'sin_titulo'}_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    // Formularios de envío y guardado
    function bindFormEvents() {
        // Guardar SMTP
        const smtpForm = document.getElementById('smtp-form');
        const btnTogglePass = document.getElementById('btn-toggle-password');
        const smtpPass = document.getElementById('smtp-password');

        btnTogglePass.addEventListener('click', () => {
            if (smtpPass.type === 'password') {
                smtpPass.type = 'text';
                btnTogglePass.textContent = '🔒';
            } else {
                smtpPass.type = 'password';
                btnTogglePass.textContent = '👁️';
            }
        });

        smtpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('smtp-email').value.trim();
            const password = smtpPass.value.trim();
            const host = document.getElementById('smtp-host').value.trim();
            const port = parseInt(document.getElementById('smtp-port').value.trim(), 10);
            const secure = document.getElementById('smtp-secure').checked;

            if (!email || !password || !host || isNaN(port)) {
                Toast.warning('Completa todos los campos de SMTP');
                return;
            }

            const btnSave = document.getElementById('btn-save-smtp');
            btnSave.disabled = true;
            btnSave.textContent = 'Guardando...';

            try {
                const { error } = await SupabaseClient.client
                    .from('corporate_email_settings')
                    .upsert({
                        id: 1,
                        smtp_email: email,
                        smtp_app_password: password,
                        smtp_host: host,
                        smtp_port: port,
                        smtp_secure: secure,
                        updated_at: new Date().toISOString()
                    });

                if (error) throw error;
                
                await SupabaseClient.logAction('SMTP_CONFIG_UPDATE', `Configuración SMTP actualizada para el remitente: ${email}`);
                Toast.success('¡Credenciales SMTP guardadas exitosamente en la base de datos!');
                smtpPass.value = ''; // Limpiar campo por seguridad
            } catch (e) {
                Toast.error('Error al guardar credenciales: ' + e.message);
            } finally {
                btnSave.disabled = false;
                btnSave.textContent = 'Guardar Credenciales SMTP 💾';
            }
        });

        // Despachar Email Blast
        const blastForm = document.getElementById('blast-form');
        blastForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const target = document.getElementById('blast-target').value;
            const subject = document.getElementById('blast-subject').value.trim();
            const message = document.getElementById('blast-message').value.trim();

            if (!subject || !message) {
                Toast.warning('Asunto y Mensaje son obligatorios');
                return;
            }

            const confirmed = await ConfirmDialog.show({
                title: '¿Confirmar Envío Masivo?',
                message: 'Esta acción enviará este correo electrónico a TODOS los usuarios registrados de la aplicación. Esta acción no se puede deshacer.',
                confirmText: 'Enviar Correos 🚀'
            });

            if (!confirmed) return;

            const btnFire = document.getElementById('btn-fire-blast');
            btnFire.disabled = true;
            btnFire.textContent = 'Despachando Correos...';

            try {
                console.log('[Admin] Invocando Edge Function pablito-mailer...');
                const { data, error } = await SupabaseClient.client.functions.invoke('pablito-mailer', {
                    body: {
                        action: 'MANUAL_BLAST',
                        payload: {
                            target: target,
                            subject: subject,
                            customHtml: message
                        }
                    }
                });

                if (error) throw error;

                await SupabaseClient.logAction('EMAIL_BLAST_SENT', `Despacho masivo enviado: ${subject}`);
                Toast.success(data?.message || '¡Oleada de correos enviada con éxito!');
                blastForm.reset();
            } catch (e) {
                Toast.error('Error al despachar correos: ' + e.message);
            } finally {
                btnFire.disabled = false;
                btnFire.textContent = '🚀 Despachar Oleada de Correos';
            }
        });
    }

    // Utilidades de diseño
    function getLogBadgeClass(action) {
        if (action.includes('SUCCESS') || action === 'LOGOUT') return 'badge-success';
        if (action.includes('FAIL') || action.includes('ERROR') || action.includes('INTRUSION')) return 'badge-danger';
        if (action.includes('UPDATE') || action.includes('DELETE')) return 'badge-warning';
        return 'badge-info';
    }

    function escHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(isoString) {
        if (!isoString) return '';
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('es-PE', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    }

    // Iniciar verificación de autenticidad en la carga del documento
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAdminAuth);
    } else {
        checkAdminAuth();
    }

})();
