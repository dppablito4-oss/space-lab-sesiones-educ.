/* ═══════════════════════════════════════════════════
   APP.JS — Main Application Logic
   Space Lab — Sesiones Educativas
   ═══════════════════════════════════════════════════ */

;(function() {
    'use strict';

    // ─── APP STATE ───
    const AppState = {
        currentSession: null,
        editMode: true,
        previewMode: false,
        sidebarOpen: false
    };

    // ─── DOM REFERENCES ───
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const DOM = {
        // Sections
        sidebar: $('#sidebar'),
        emptyState: $('#empty-state'),
        printPreview: $('#print-preview'),
        sessionSheet: $('#session-sheet'),
        previewArea: $('#preview-area'),
        // Buttons
        btnGenerate: $('#btn-generate'),
        btnGenerateAI: $('#btn-generate-ai'),
        btnToggleEdit: $('#btn-toggle-edit'),
        btnPreview: $('#btn-preview'),
        btnPrint: $('#btn-print'),
        btnSave: $('#btn-save'),
        btnLoad: $('#btn-load'),
        btnNew: $('#btn-new'),
        btnCleanFormat: $('#btn-clean-format'),
        btnMenuMobile: $('#btn-menu-mobile'),
        btnCloseSidebar: $('#btn-close-sidebar'),
        btnCloseLoad: $('#btn-close-load'),
        btnSaveDefaults: $('#btn-save-defaults'),
        // Form
        form: $('#session-form'),
        selectTemplate: $('#select-template'),
        selectMethodology: $('#select-methodology'),
        inputInstitucion: $('#input-institucion'),
        inputDre: $('#input-dre'),
        inputUgel: $('#input-ugel'),
        inputDocente: $('#input-docente'),
        inputDirector: $('#input-director'),
        inputFecha: $('#input-fecha'),
        inputNivel: $('#input-nivel'),
        inputNumeroSesion: $('#input-numero-sesion'),
        inputGrado: $('#input-grado'),
        inputSeccion: $('#input-seccion'),
        inputArea: $('#input-area'),
        inputDuracion: $('#input-duracion'),
        inputUnidad: $('#input-unidad'),
        inputTitulo: $('#input-titulo'),
        inputCompetencia: $('#input-competencia'),
        inputCapacidad: $('#input-capacidad'),
        inputDesempeno: $('#input-desempeno'),
        inputEnfoque: $('#input-enfoque'),
        inputEnfoque2: $('#input-enfoque2'),
        // CNEB Dropdowns
        selectCnebCompetencia: $('#select-cneb-competencia'),
        selectCnebCapacidad: $('#select-cneb-capacidad'),
        selectCnebEnfoque: $('#select-cneb-enfoque'),
        selectCnebEnfoque2: $('#select-cneb-enfoque2'),
        // Import/Export
        btnExportJson: $('#btn-export-json'),
        btnImportJson: $('#btn-import-json'),
        inputImportFile: $('#input-import-file'),
        // Logo Upload & Gallery
        inputUploadLogo: $('#input-upload-logo'),
        btnTriggerUploadLogo: $('#btn-trigger-upload-logo'),
        btnRefreshLogos: $('#btn-refresh-logos'),
        logosContainer: $('#logos-container'),
        // Other
        editModeBadge: $('#edit-mode-badge'),
        savedList: $('#saved-list'),
        loadModal: $('#load-modal'),
        loadList: $('#load-list'),
        saveIndicator: $('#save-indicator'),
        spaceBg: $('#space-bg')
    };

    // ═══════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════

    function init() {
        // Set today's date as default
        DOM.inputFecha.valueAsDate = new Date();

        // Bind all events
        bindEvents();

        // Initialize space background
        initSpaceBackground();

        // Setup auto-save
        Storage.setupAutoSave(() => {
            saveCurrentState();
        });

        // Listen for form inputs to auto-save metadata changes
        DOM.form.addEventListener('input', () => {
            if (AppState.currentSession) {
                const data = getFormData();
                AppState.currentSession.metadata = {
                    ...AppState.currentSession.metadata,
                    ...data.metadata
                };
                AppState.currentSession.proposito = {
                    ...AppState.currentSession.proposito,
                    ...data.proposito
                };
                Storage.triggerAutoSave();
            }
        });

        // Initialize Auth UI if available
        if (window.AuthUi) {
            AuthUi.init();
        }

        // Initialize Chatbot if available
        if (window.Chatbot) {
            Chatbot.init();
        }

        // Global callback to refresh session lists after login/logout
        window.appReloadSessions = () => {
            renderSavedList();
            loadLastSession();
            loadProfileDefaults();
            loadLogosGallery();
        };

        // Load last session if exists
        loadLastSession();

        // Render saved sessions list
        renderSavedList();

        // Load curriculum database
        loadCurriculum();

        // Load profile defaults if user is logged in
        loadProfileDefaults();

        // Load logo gallery
        loadLogosGallery();

        // Setup drag and drop on sheet
        setupDragAndDrop();

        // Sync local and cloud sessions in the background
        if (window.Storage && typeof Storage.syncSessions === 'function') {
            Storage.syncSessions().then(() => {
                renderSavedList();
            }).catch(e => console.warn('[Sync] Sync failed at startup:', e));
        }

        console.log('🚀 Space Lab initialized');
    }


    // ═══════════════════════════════════════
    // EVENT BINDING
    // ═══════════════════════════════════════

    function bindEvents() {
        // Generate buttons
        DOM.btnGenerate.addEventListener('click', handleGenerate);
        DOM.btnGenerateAI.addEventListener('click', handleGenerateAI);

        // Action buttons
        DOM.btnToggleEdit.addEventListener('click', toggleEditMode);
        DOM.btnPreview.addEventListener('click', togglePreviewMode);
        DOM.btnPrint.addEventListener('click', handlePrint);
        DOM.btnSave.addEventListener('click', handleSave);
        DOM.btnLoad.addEventListener('click', handleShowLoadModal);
        DOM.btnNew.addEventListener('click', handleNew);
        DOM.btnCleanFormat.addEventListener('click', handleCleanFormat);

        // CNEB Curriculum dropdowns
        DOM.inputArea.addEventListener('change', handleAreaChange);
        DOM.selectCnebCompetencia.addEventListener('change', handleCompetenciaChange);
        DOM.selectCnebCapacidad.addEventListener('change', handleCapacidadChange);
        DOM.selectCnebEnfoque.addEventListener('change', handleEnfoqueChange);
        DOM.selectCnebEnfoque2.addEventListener('change', handleEnfoque2Change);

        // Import / Export JSON
        DOM.btnExportJson.addEventListener('click', handleExportJson);
        DOM.btnImportJson.addEventListener('click', () => DOM.inputImportFile.click());
        DOM.inputImportFile.addEventListener('change', handleImportJson);

        // Mobile sidebar
        DOM.btnMenuMobile.addEventListener('click', toggleSidebar);
        DOM.btnCloseSidebar.addEventListener('click', () => closeSidebar());

        // Load modal
        DOM.btnCloseLoad.addEventListener('click', () => DOM.loadModal.classList.add('hidden'));
        DOM.loadModal.addEventListener('click', (e) => {
            if (e.target === DOM.loadModal) DOM.loadModal.classList.add('hidden');
        });

        // Clean paste in contenteditable
        document.addEventListener('paste', handleCleanPaste);

        // Save defaults in profile
        DOM.btnSaveDefaults.addEventListener('click', handleSaveDefaults);

        // Upload logo trigger and event
        DOM.btnTriggerUploadLogo.addEventListener('click', () => DOM.inputUploadLogo.click());
        DOM.inputUploadLogo.addEventListener('change', handleUploadLogo);
        DOM.btnRefreshLogos.addEventListener('click', loadLogosGallery);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);
    }

    // ═══════════════════════════════════════
    // FORM DATA COLLECTION
    // ═══════════════════════════════════════

    function getFormData() {
        const logoImg = $('#header-logo-regional');
        const logoUrl = logoImg ? logoImg.getAttribute('src') : '';

        return {
            metadata: {
                institucion: DOM.inputInstitucion.value,
                dre: DOM.inputDre.value,
                ugel: DOM.inputUgel.value,
                docente: DOM.inputDocente.value,
                director: DOM.inputDirector.value,
                fecha: DOM.inputFecha.value,
                nivel: DOM.inputNivel.value,
                numero_sesion: DOM.inputNumeroSesion.value,
                grado: DOM.inputGrado.value,
                seccion: DOM.inputSeccion.value,
                area: DOM.inputArea.value,
                duracion: DOM.inputDuracion.value,
                unidad: DOM.inputUnidad.value,
                titulo: DOM.inputTitulo.value,
                methodology: DOM.selectMethodology.value,
                logo_regional_url: logoUrl
            },
            proposito: {
                competencia: DOM.inputCompetencia.value,
                capacidad: DOM.inputCapacidad.value,
                desempeno: DOM.inputDesempeno.value,
                enfoque: DOM.inputEnfoque.value,
                enfoque2: DOM.inputEnfoque2.value
            },
            momentos: {},
            evaluacion: {}
        };
    }

    function populateForm(session) {
        if (!session) return;
        const m = session.metadata || {};
        const p = session.proposito || {};

        DOM.inputInstitucion.value = m.institucion || '';
        DOM.inputDre.value = m.dre || '';
        DOM.inputUgel.value = m.ugel || '';
        DOM.inputDocente.value = m.docente || '';
        DOM.inputDirector.value = m.director || '';
        DOM.inputFecha.value = m.fecha || '';
        DOM.inputNivel.value = m.nivel || 'SECUNDARIA';
        DOM.inputNumeroSesion.value = m.numero_sesion || '';
        DOM.inputGrado.value = m.grado || '';
        DOM.inputSeccion.value = m.seccion || '';
        DOM.inputArea.value = m.area || '';
        DOM.inputDuracion.value = m.duracion || '';
        DOM.inputUnidad.value = m.unidad || '';
        DOM.inputTitulo.value = m.titulo || '';
        DOM.inputCompetencia.value = p.competencia || '';
        DOM.inputCapacidad.value = p.capacidad || '';
        DOM.inputDesempeno.value = p.desempeno || '';
        DOM.inputEnfoque.value = p.enfoque || '';
        DOM.inputEnfoque2.value = p.enfoque2 || '';

        if (session.template) {
            DOM.selectTemplate.value = session.template;
        }
        DOM.selectMethodology.value = m.methodology || '';

        // Sync curriculum selectors with loaded area
        handleAreaChange();
    }

    // ═══════════════════════════════════════
    // SESSION GENERATION
    // ═══════════════════════════════════════

    function handleGenerate() {
        const data = getFormData();
        const template = DOM.selectTemplate.value;

        // Create session object
        const session = {
            id: AppState.currentSession?.id || Storage.generateId(),
            template: template,
            ...data,
            createdAt: AppState.currentSession?.createdAt || new Date().toISOString()
        };

        AppState.currentSession = session;

        // Render
        renderSession(session);
        Toast.success('Sesión generada correctamente');
    }

    async function handleGenerateAI() {
        // Check if AI is configured
        if (!AiCopilot.isConfigured()) {
            const configured = AiCopilot.showConfigPrompt();
            if (!configured) {
                Toast.warning('Necesitas configurar una API Key para usar la IA');
                return;
            }
        }

        const formData = getFormData();

        // Validate minimum data
        if (!formData.metadata.area && !formData.metadata.titulo) {
            Toast.warning('Llena al menos el Área Curricular o el Título de la sesión');
            return;
        }

        Loader.show('🤖 Generando sesión con IA...');

        try {
            const aiData = await AiCopilot.generateSession({
                ...formData.metadata,
                ...formData.proposito
            });

            // Merge AI data with form data
            const session = {
                id: AppState.currentSession?.id || Storage.generateId(),
                template: DOM.selectTemplate.value,
                metadata: { ...formData.metadata },
                proposito: aiData.proposito || formData.proposito,
                momentos: aiData.momentos || {},
                evaluacion: aiData.evaluacion || {},
                createdAt: new Date().toISOString()
            };

            AppState.currentSession = session;

            // Update form with AI-generated title
            if (aiData.titulo_sesion_retador) {
                DOM.inputTitulo.value = aiData.titulo_sesion_retador;
                session.metadata.titulo = aiData.titulo_sesion_retador;
            }

            // Update form with AI-generated propósito
            if (aiData.proposito) {
                DOM.inputCompetencia.value = aiData.proposito.competencia || '';
                DOM.inputCapacidad.value = aiData.proposito.capacidad || '';
                DOM.inputDesempeno.value = aiData.proposito.desempeno || '';
                DOM.inputEnfoque.value = aiData.proposito.enfoque || '';
            }

            renderSession(session);
            Loader.hide();
            Toast.success('¡Sesión generada con IA exitosamente!');

        } catch (error) {
            Loader.hide();

            if (error.message === 'API_NOT_CONFIGURED') {
                AiCopilot.showConfigPrompt();
            } else {
                Toast.error(`Error: ${error.message}`);
            }
        }
    }

    // ═══════════════════════════════════════
    // SESSION RENDERING
    // ═══════════════════════════════════════

    function renderSession(session) {
        const template = session.template || 'estandar';
        const html = Templates.render(template, session, AppState.editMode);

        DOM.sessionSheet.innerHTML = html;
        DOM.emptyState.classList.add('hidden');
        DOM.printPreview.classList.remove('hidden');

        // Close sidebar on mobile
        closeSidebar();

        // Save current state
        Storage.setCurrentSession(session);
    }

    // ═══════════════════════════════════════
    // EDIT MODE
    // ═══════════════════════════════════════

    function enforceEditMode() {
        const editables = DOM.sessionSheet.querySelectorAll('[contenteditable]');
        editables.forEach(el => {
            el.setAttribute('contenteditable', AppState.editMode ? 'true' : 'false');
        });
    }

    function toggleEditMode() {
        AppState.editMode = !AppState.editMode;

        enforceEditMode();

        // Update UI
        const btnLabel = DOM.btnToggleEdit.querySelector('.btn-label');
        const btnIcon = DOM.btnToggleEdit.querySelector('.icon');

        if (AppState.editMode) {
            btnLabel.textContent = 'Editar';
            btnIcon.textContent = '✏️';
            DOM.editModeBadge.textContent = '✏️ Modo Edición';
            DOM.editModeBadge.classList.remove('read-only');
        } else {
            btnLabel.textContent = 'Lectura';
            btnIcon.textContent = '👁️';
            DOM.editModeBadge.textContent = '🔒 Modo Lectura';
            DOM.editModeBadge.classList.add('read-only');
        }

        Toast.info(AppState.editMode ? 'Modo edición activado' : 'Modo lectura activado');
    }

    // ═══════════════════════════════════════
    // PREVIEW & PRINT
    // ═══════════════════════════════════════

    function togglePreviewMode() {
        if (!AppState.currentSession) {
            Toast.warning('Genera una sesión primero');
            return;
        }

        AppState.previewMode = !AppState.previewMode;

        if (AppState.previewMode) {
            document.body.classList.add('preview-active');
            DOM.sidebar.style.display = 'none';
            DOM.previewArea.style.maxWidth = '900px';
            DOM.previewArea.style.margin = '0 auto';
            Toast.info('Vista previa activada. Clic de nuevo para salir.');
        } else {
            document.body.classList.remove('preview-active');
            DOM.sidebar.style.display = '';
            DOM.previewArea.style.maxWidth = '';
            DOM.previewArea.style.margin = '';
        }
    }

    function handlePrint() {
        if (!AppState.currentSession) {
            Toast.warning('Genera una sesión primero');
            return;
        }

        // Save before printing
        saveCurrentState();

        window.print();
    }

    // ═══════════════════════════════════════
    // SAVE / LOAD
    // ═══════════════════════════════════════

    function handleSave() {
        if (!AppState.currentSession) {
            Toast.warning('No hay sesión para guardar');
            return;
        }

        saveCurrentState();

        // Also persist to the sessions list
        const session = {
            ...AppState.currentSession,
            htmlContent: DOM.sessionSheet.innerHTML
        };

        if (Storage.saveSession(session)) {
            Toast.success('💾 Sesión guardada correctamente');
            renderSavedList();
        } else {
            Toast.error('Error al guardar la sesión');
        }
    }

    function saveCurrentState() {
        if (!AppState.currentSession) return;

        // Capture current HTML content (with user edits)
        AppState.currentSession.htmlContent = DOM.sessionSheet.innerHTML;
        AppState.currentSession.lastSaved = new Date().toISOString();

        Storage.setCurrentSession(AppState.currentSession);

        // If this session already exists in the saved list, auto-save it there too
        if (Storage.getSession(AppState.currentSession.id)) {
            Storage.saveSession(AppState.currentSession);
            renderSavedList();
        }
    }

    function loadLastSession() {
        const current = Storage.getCurrentSession();
        if (current && current.htmlContent) {
            AppState.currentSession = current;
            populateForm(current);

            DOM.sessionSheet.innerHTML = current.htmlContent;
            enforceEditMode();
            DOM.emptyState.classList.add('hidden');
            DOM.printPreview.classList.remove('hidden');

            if (current.template) {
                DOM.selectTemplate.value = current.template;
            }

            Toast.info('Última sesión restaurada');
        }
    }

    function handleShowLoadModal() {
        const sessions = Storage.getAllSessions();

        if (sessions.length === 0) {
            Toast.info('No hay sesiones guardadas');
            return;
        }

        DOM.loadList.innerHTML = sessions.map(s => `
            <li class="load-item" data-id="${s.id}">
                <div class="load-item-info">
                    <span class="load-item-title">${escHTML(s.metadata?.titulo || 'Sin título')}</span>
                    <span class="load-item-meta">
                        ${escHTML(s.metadata?.area || '')} · ${escHTML(s.metadata?.grado || '')} · 
                        ${formatDate(s.lastSaved)}
                    </span>
                </div>
                <div class="load-item-actions">
                    <button class="btn btn-ghost btn-sm load-item-select" data-id="${s.id}" title="Cargar">📂</button>
                    <button class="btn btn-ghost btn-sm load-item-delete" data-id="${s.id}" title="Eliminar">🗑️</button>
                </div>
            </li>
        `).join('');

        // Bind load events
        DOM.loadList.querySelectorAll('.load-item-select').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadSession(btn.dataset.id);
            });
        });

        DOM.loadList.querySelectorAll('.load-item-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = await ConfirmDialog.show({
                    title: '¿Eliminar sesión?',
                    message: 'Esta acción no se puede deshacer.',
                    confirmText: 'Eliminar'
                });
                if (confirmed) {
                    Storage.deleteSession(btn.dataset.id);
                    Toast.success('Sesión eliminada');
                    handleShowLoadModal(); // Refresh
                    renderSavedList();
                }
            });
        });

        // Also allow clicking the whole item
        DOM.loadList.querySelectorAll('.load-item').forEach(item => {
            item.addEventListener('click', () => loadSession(item.dataset.id));
        });

        DOM.loadModal.classList.remove('hidden');
    }

    function loadSession(id) {
        const session = Storage.getSession(id);
        if (!session) {
            Toast.error('Sesión no encontrada');
            return;
        }

        AppState.currentSession = session;
        populateForm(session);

        if (session.htmlContent) {
            DOM.sessionSheet.innerHTML = session.htmlContent;
            enforceEditMode();
        } else {
            renderSession(session);
        }

        DOM.emptyState.classList.add('hidden');
        DOM.printPreview.classList.remove('hidden');
        DOM.loadModal.classList.add('hidden');

        Storage.setCurrentSession(session);
        Toast.success('Sesión cargada correctamente');
    }

    async function handleNew() {
        if (AppState.currentSession) {
            const confirmed = await ConfirmDialog.show({
                title: '¿Nueva sesión?',
                message: 'Los cambios no guardados se perderán.',
                confirmText: 'Continuar'
            });
            if (!confirmed) return;
        }

        // Reset
        AppState.currentSession = null;
        DOM.form.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.type === 'date') {
                el.valueAsDate = new Date();
            } else if (el.tagName === 'SELECT') {
                el.selectedIndex = 0;
            } else {
                el.value = '';
            }
        });

        DOM.sessionSheet.innerHTML = '';
        DOM.printPreview.classList.add('hidden');
        DOM.emptyState.classList.remove('hidden');

        // Hide CNEB selectors
        DOM.selectCnebCompetencia.classList.add('hidden');
        DOM.selectCnebCapacidad.classList.add('hidden');

        Storage.clearCurrentSession();
        await loadProfileDefaults();
        Toast.info('Nueva sesión iniciada');
    }

    // ═══════════════════════════════════════
    // SAVED LIST (Sidebar)
    // ═══════════════════════════════════════

    function renderSavedList() {
        const sessions = Storage.getAllSessions();

        if (sessions.length === 0) {
            DOM.savedList.innerHTML = '<li class="saved-empty">No hay sesiones guardadas</li>';
            return;
        }

        // Show only last 5
        DOM.savedList.innerHTML = sessions.slice(0, 5).map(s => `
            <li class="saved-item" data-id="${s.id}">
                <div class="saved-item-info">
                    <span class="saved-item-title">${escHTML(s.metadata?.titulo || 'Sin título')}</span>
                    <span class="saved-item-date">${formatDate(s.lastSaved)}</span>
                </div>
                <button class="saved-item-delete" data-id="${s.id}" title="Eliminar">🗑️</button>
            </li>
        `).join('');

        // Bind events
        DOM.savedList.querySelectorAll('.saved-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('saved-item-delete')) {
                    loadSession(item.dataset.id);
                }
            });
        });

        DOM.savedList.querySelectorAll('.saved-item-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = await ConfirmDialog.show({
                    title: '¿Eliminar sesión?',
                    message: 'Se borrará permanentemente.',
                    confirmText: 'Eliminar'
                });
                if (confirmed) {
                    Storage.deleteSession(btn.dataset.id);
                    renderSavedList();
                    Toast.success('Sesión eliminada');
                }
            });
        });
    }

    // ═══════════════════════════════════════
    // CLEAN PASTE
    // ═══════════════════════════════════════

    function handleCleanPaste(e) {
        const target = e.target;
        if (target.closest('#session-sheet') && target.hasAttribute('contenteditable')) {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        }
    }

    function handleCleanFormat() {
        if (!AppState.currentSession) return;

        const editables = DOM.sessionSheet.querySelectorAll('[contenteditable]');
        editables.forEach(el => {
            // Utilizar el DOMParser del navegador para limpiar de manera robusta
            const parser = new DOMParser();
            const doc = parser.parseFromString(el.innerHTML, 'text/html');
            
            // Lista de etiquetas permitidas
            const allowedTags = ['STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'P', 'BR'];
            
            // Función recursiva para sanear nodos
            function sanitizeNode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.cloneNode(true);
                }
                
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName;
                    
                    // Si la etiqueta está permitida, recreamos el elemento sin atributos
                    if (allowedTags.includes(tagName)) {
                        const newEl = document.createElement(tagName);
                        
                        // Recursivamente sanear y añadir hijos
                        node.childNodes.forEach(child => {
                            const cleanChild = sanitizeNode(child);
                            if (cleanChild) newEl.appendChild(cleanChild);
                        });
                        return newEl;
                    } else {
                        // Si la etiqueta no está permitida (ej: span, div, font, table, etc.),
                        // extraemos recursivamente sus hijos y los retornamos en un DocumentFragment
                        const fragment = document.createDocumentFragment();
                        node.childNodes.forEach(child => {
                            const cleanChild = sanitizeNode(child);
                            if (cleanChild) fragment.appendChild(cleanChild);
                        });
                        return fragment;
                    }
                }
                return null;
            }
            
            const cleanFragment = document.createDocumentFragment();
            doc.body.childNodes.forEach(child => {
                const cleanChild = sanitizeNode(child);
                if (cleanChild) cleanFragment.appendChild(cleanChild);
            });
            
            // Reemplazar el HTML original
            el.innerHTML = '';
            el.appendChild(cleanFragment);
            
            // Limpieza de espacios en blanco
            el.innerHTML = el.innerHTML.trim();
        });

        Toast.success('Formato limpiado (conservando negritas y listas)');
    }

    // ═══════════════════════════════════════
    // SIDEBAR (Mobile)
    // ═══════════════════════════════════════

    function toggleSidebar() {
        AppState.sidebarOpen = !AppState.sidebarOpen;
        DOM.sidebar.classList.toggle('open', AppState.sidebarOpen);
    }

    function closeSidebar() {
        AppState.sidebarOpen = false;
        DOM.sidebar.classList.remove('open');
    }

    // ═══════════════════════════════════════
    // KEYBOARD SHORTCUTS
    // ═══════════════════════════════════════

    function handleKeyboard(e) {
        // Ctrl+S: Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            handleSave();
        }
        // Ctrl+P: Print
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            handlePrint();
        }
        // Ctrl+E: Toggle edit
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            toggleEditMode();
        }
        // Escape: Close modals/sidebar
        if (e.key === 'Escape') {
            closeSidebar();
            DOM.loadModal.classList.add('hidden');
            if (AppState.previewMode) togglePreviewMode();
        }
    }

    // ═══════════════════════════════════════
    // SPACE BACKGROUND (Canvas Animation)
    // ═══════════════════════════════════════
 
    function initSpaceBackground() {
        const canvas = DOM.spaceBg;
        if (!canvas) return;
 
        const ctx = canvas.getContext('2d');
        let stars = [];
        let animFrame;
 
        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            createStars();
        }
 
        function createStars() {
            stars = [];
            const count = Math.floor((canvas.width * canvas.height) / 5000);
            for (let i = 0; i < count; i++) {
                const layer = Math.random() < 0.6 ? 1 : (Math.random() < 0.85 ? 2 : 3);
                let size, speed, opacity, twinkleSpeed;
                
                if (layer === 1) { // Background stars
                    size = Math.random() * 0.8 + 0.3;
                    speed = Math.random() * 0.05 + 0.01;
                    opacity = Math.random() * 0.5 + 0.2;
                    twinkleSpeed = Math.random() * 0.02 + 0.005;
                } else if (layer === 2) { // Midground stars
                    size = Math.random() * 1.2 + 0.8;
                    speed = Math.random() * 0.15 + 0.05;
                    opacity = Math.random() * 0.7 + 0.3;
                    twinkleSpeed = Math.random() * 0.04 + 0.01;
                } else { // Foreground / Glowing stars
                    size = Math.random() * 2.0 + 1.5;
                    speed = Math.random() * 0.3 + 0.15;
                    opacity = Math.random() * 0.8 + 0.4;
                    twinkleSpeed = Math.random() * 0.06 + 0.02;
                }
 
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    size: size,
                    speed: speed,
                    opacity: opacity,
                    pulse: Math.random() * Math.PI * 2,
                    twinkleSpeed: twinkleSpeed,
                    layer: layer,
                    color: Math.random() < 0.7 ? 'rgba(224, 231, 255, ' : (Math.random() < 0.5 ? 'rgba(0, 212, 255, ' : 'rgba(139, 92, 246, ')
                });
            }
        }
 
        function draw() {
            // Dark base background
            ctx.fillStyle = '#06060f';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
 
            // Draw Nebulas (Cyan + Purple overlay)
            const grad1 = ctx.createRadialGradient(
                canvas.width * 0.15, canvas.height * 0.2, 50, 
                canvas.width * 0.25, canvas.height * 0.2, canvas.width * 0.65
            );
            grad1.addColorStop(0, 'rgba(0, 212, 255, 0.04)');
            grad1.addColorStop(0.5, 'rgba(139, 92, 246, 0.02)');
            grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
 
            const grad2 = ctx.createRadialGradient(
                canvas.width * 0.85, canvas.height * 0.75, 50, 
                canvas.width * 0.75, canvas.height * 0.8, canvas.width * 0.55
            );
            grad2.addColorStop(0, 'rgba(139, 92, 246, 0.05)');
            grad2.addColorStop(0.5, 'rgba(0, 212, 255, 0.02)');
            grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
 
            ctx.fillStyle = grad1;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = grad2;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
 
            // Draw Stars
            for (const star of stars) {
                star.pulse += star.twinkleSpeed;
                const alpha = star.opacity * (0.5 + 0.5 * Math.sin(star.pulse));
 
                // Core star
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fillStyle = `${star.color}${alpha})`;
                ctx.fill();
 
                // Lens flare / Cross glow for foreground glowing stars (layer 3)
                if (star.layer === 3 && alpha > 0.7) {
                    ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha - 0.7) * 0.5})`;
                    ctx.lineWidth = 0.5;
                    
                    // Horizontal flare
                    ctx.beginPath();
                    ctx.moveTo(star.x - star.size * 4, star.y);
                    ctx.lineTo(star.x + star.size * 4, star.y);
                    ctx.stroke();
 
                    // Vertical flare
                    ctx.beginPath();
                    ctx.moveTo(star.x, star.y - star.size * 4);
                    ctx.lineTo(star.x, star.y + star.size * 4);
                    ctx.stroke();
                }
 
                // Drift downwards
                star.y += star.speed;
                if (star.y > canvas.height) {
                    star.y = 0;
                    star.x = Math.random() * canvas.width;
                }
            }
 
            animFrame = requestAnimationFrame(draw);
        }

        window.addEventListener('resize', resize);
        resize();
        draw();
    }

    // ═══════════════════════════════════════
    // CNEB CURRICULUM INTEGRATION & IMPORT/EXPORT
    // ═══════════════════════════════════════

    let curriculumData = null;

    async function loadCurriculum() {
        try {
            const response = await fetch('data/competencias.json');
            curriculumData = await response.json();

            populateEnfoques();

            // Sync with existing selection if any
            if (DOM.inputArea.value) {
                handleAreaChange();
            }

            console.log('📚 CNEB curriculum database loaded');
        } catch (e) {
            console.warn('⚠️ Could not load CNEB curriculum json:', e);
        }
    }

    function populateEnfoques() {
        if (!curriculumData || !curriculumData.enfoques_transversales) return;
        
        const optionsHtml = '<option value="">-- Seleccionar Enfoque Oficial --</option>' +
            curriculumData.enfoques_transversales.map(e => `<option value="${escHTML(e)}">${escHTML(e)}</option>`).join('');
        
        DOM.selectCnebEnfoque.innerHTML = optionsHtml;
        DOM.selectCnebEnfoque2.innerHTML = optionsHtml;
    }

    function handleAreaChange() {
        const area = DOM.inputArea.value;

        if (!curriculumData || !curriculumData.areas || !curriculumData.areas[area]) {
            DOM.selectCnebCompetencia.classList.add('hidden');
            DOM.selectCnebCapacidad.classList.add('hidden');
            return;
        }

        const areaInfo = curriculumData.areas[area];

        DOM.selectCnebCompetencia.innerHTML = '<option value="">-- Seleccionar Competencia Oficial --</option>' +
            areaInfo.competencias.map((c, i) => `<option value="${i}">${escHTML(c.nombre)}</option>`).join('');

        DOM.selectCnebCompetencia.classList.remove('hidden');
        DOM.selectCnebCapacidad.classList.add('hidden');
    }

    function handleCompetenciaChange() {
        const area = DOM.inputArea.value;
        const compIdx = DOM.selectCnebCompetencia.value;

        if (compIdx === '' || !curriculumData || !curriculumData.areas || !curriculumData.areas[area]) {
            DOM.selectCnebCapacidad.classList.add('hidden');
            return;
        }

        const comp = curriculumData.areas[area].competencias[compIdx];

        // Fill textarea
        DOM.inputCompetencia.value = comp.nombre;

        // Populate capacities select
        DOM.selectCnebCapacidad.innerHTML = '<option value="">-- Seleccionar Capacidad Oficial --</option>' +
            comp.capacidades.map(c => `<option value="${escHTML(c)}">${escHTML(c)}</option>`).join('');

        DOM.selectCnebCapacidad.classList.remove('hidden');
    }

    function handleCapacidadChange() {
        const capValue = DOM.selectCnebCapacidad.value;
        if (!capValue) return;

        const currentText = DOM.inputCapacidad.value.trim();
        if (currentText) {
            if (!currentText.includes(capValue)) {
                DOM.inputCapacidad.value = currentText + '\n• ' + capValue;
            }
        } else {
            DOM.inputCapacidad.value = '• ' + capValue;
        }
    }

    function handleEnfoqueChange() {
        const enfoqueValue = DOM.selectCnebEnfoque.value;
        if (!enfoqueValue) return;
        DOM.inputEnfoque.value = enfoqueValue;
    }

    function handleEnfoque2Change() {
        const enfoqueValue = DOM.selectCnebEnfoque2.value;
        if (!enfoqueValue) return;
        DOM.inputEnfoque2.value = enfoqueValue;
    }

    function handleExportJson() {
        if (!AppState.currentSession) {
            Toast.warning('No hay sesión para exportar');
            return;
        }
        saveCurrentState();
        Storage.exportAsJSON(AppState.currentSession);
        Toast.success('Sesión exportada correctamente');
    }

    async function handleImportJson(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const session = await Storage.importFromJSON(file);
            if (!session.id || !session.template || !session.metadata) {
                throw new Error('El archivo no tiene la estructura de Space Lab');
            }

            Storage.saveSession(session);
            loadSession(session.id);
            renderSavedList();

            Toast.success('Sesión importada correctamente');
        } catch (err) {
            Toast.error('Error al importar sesión: ' + err.message);
        } finally {
            DOM.inputImportFile.value = '';
        }
    }

    // ═══════════════════════════════════════
    // PROFILE DEFAULTS & LOGO STORAGE GALLERY
    // ═══════════════════════════════════════

    async function loadProfileDefaults() {
        try {
            const profile = await SupabaseClient.getUserProfile();
            if (profile) {
                if (profile.institucion) DOM.inputInstitucion.value = profile.institucion;
                if (profile.dre) DOM.inputDre.value = profile.dre;
                if (profile.ugel) DOM.inputUgel.value = profile.ugel;
                if (profile.docente) DOM.inputDocente.value = profile.docente;
                if (profile.director) DOM.inputDirector.value = profile.director;
                if (profile.nivel) DOM.inputNivel.value = profile.nivel;
                console.log('⚡ Predeterminados de perfil cargados');
            }
        } catch (e) {
            console.warn('[Profile] Error al cargar predeterminados:', e);
        }
    }

    async function handleSaveDefaults() {
        const user = await SupabaseClient.getCurrentUser();
        if (!user) {
            Toast.warning('Debes iniciar sesión para guardar tus datos predeterminados en la nube');
            return;
        }

        Loader.show('Guardando datos predeterminados...');
        try {
            const data = {
                institucion: DOM.inputInstitucion.value.trim(),
                dre: DOM.inputDre.value.trim(),
                ugel: DOM.inputUgel.value.trim(),
                docente: DOM.inputDocente.value.trim(),
                director: DOM.inputDirector.value.trim(),
                nivel: DOM.inputNivel.value
            };

            await SupabaseClient.updateUserProfile(data);
            Loader.hide();
            Toast.success('⚙️ Datos predeterminados guardados en la nube');
        } catch (e) {
            Loader.hide();
            Toast.error('Error al guardar predeterminados: ' + e.message);
        }
    }

    async function loadLogosGallery() {
        const user = await SupabaseClient.getCurrentUser();
        if (!user) {
            DOM.logosContainer.innerHTML = `<span style="grid-column: span 4; font-size: 0.7rem; text-align: center; color: var(--text-muted); padding: 4px;">Inicia sesión para ver logos</span>`;
            return;
        }

        DOM.logosContainer.innerHTML = `<span style="grid-column: span 4; font-size: 0.7rem; text-align: center; color: var(--text-muted); padding: 4px;">Cargando...</span>`;
        try {
            const logos = await SupabaseClient.listLogos();
            if (logos.length === 0) {
                DOM.logosContainer.innerHTML = `<span style="grid-column: span 4; font-size: 0.7rem; text-align: center; color: var(--text-muted); padding: 4px;">No hay logos subidos</span>`;
                return;
            }

            DOM.logosContainer.innerHTML = logos.map(logo => `
                <div class="logo-gallery-item" draggable="true" data-url="${logo.url}" style="position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 6px; padding: 4px; cursor: grab; transition: all var(--transition-fast);" title="Haz clic para aplicar o arrastra al documento">
                    <img src="${logo.url}" alt="${logo.name}" style="max-width: 100%; max-height: 100%; object-fit: contain; pointer-events: none;">
                </div>
            `).join('');

            // Bind events for gallery items
            DOM.logosContainer.querySelectorAll('.logo-gallery-item').forEach(item => {
                item.addEventListener('click', () => {
                    applyLogoToDocument(item.dataset.url);
                });

                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', item.dataset.url);
                    item.style.opacity = '0.5';
                });

                item.addEventListener('dragend', () => {
                    item.style.opacity = '1';
                });
            });

        } catch (e) {
            console.error('[Gallery] Error loading logos:', e);
            DOM.logosContainer.innerHTML = `<span style="grid-column: span 4; font-size: 0.7rem; text-align: center; color: var(--danger); padding: 4px;">Error al cargar</span>`;
        }
    }

    async function handleUploadLogo(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            Toast.warning('Por favor selecciona una imagen válida (PNG, JPG)');
            return;
        }

        Loader.show('Subiendo logo...');
        try {
            const publicUrl = await SupabaseClient.uploadLogo(file);
            Loader.hide();
            Toast.success('Logo subido correctamente');
            
            // Reload the gallery
            await loadLogosGallery();

            // Ask the user if they want to apply the logo they just uploaded
            const confirmed = await ConfirmDialog.show({
                title: '¿Aplicar logo?',
                message: '¿Quieres aplicar el logo subido al encabezado del documento actual?',
                confirmText: 'Aplicar'
            });
            if (confirmed) {
                applyLogoToDocument(publicUrl);
            }
        } catch (err) {
            Loader.hide();
            Toast.error('Error al subir logo: ' + err.message);
        } finally {
            DOM.inputUploadLogo.value = ''; // Reset file input
        }
    }

    function applyLogoToDocument(url) {
        const logoImg = document.getElementById('header-logo-regional');
        if (logoImg) {
            logoImg.src = url;
            logoImg.style.display = 'block'; // Ensure it's shown if onerror hid it
            
            // Highlight effect
            logoImg.style.transform = 'scale(1.15)';
            setTimeout(() => {
                logoImg.style.transform = '';
            }, 300);

            // Save state
            saveCurrentState();
            Toast.success('Logo regional actualizado');
        } else {
            Toast.warning('Genera la sesión primero para poder aplicar el logo');
        }
    }

    function setupDragAndDrop() {
        const sheet = DOM.sessionSheet;
        if (!sheet) return;

        sheet.addEventListener('dragover', (e) => {
            const target = e.target;
            if (target && (target.id === 'header-logo-regional' || target.closest('.official-logo-cell'))) {
                e.preventDefault();
                target.style.outline = '2px dashed var(--accent)';
            }
        });

        sheet.addEventListener('dragleave', (e) => {
            const target = e.target;
            if (target && (target.id === 'header-logo-regional' || target.closest('.official-logo-cell'))) {
                target.style.outline = '';
            }
        });

        sheet.addEventListener('drop', (e) => {
            const target = e.target;
            if (target && (target.id === 'header-logo-regional' || target.closest('.official-logo-cell'))) {
                e.preventDefault();
                target.style.outline = '';
                
                const url = e.dataTransfer.getData('text/plain');
                if (url) {
                    applyLogoToDocument(url);
                }
            }
        });
    }

    // ═══════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════

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
        } catch (e) {
            return isoString;
        }
    }

    // ═══════════════════════════════════════
    // BOOT
    // ═══════════════════════════════════════

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
