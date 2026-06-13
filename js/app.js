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
        // Form
        form: $('#session-form'),
        selectTemplate: $('#select-template'),
        inputInstitucion: $('#input-institucion'),
        inputDocente: $('#input-docente'),
        inputFecha: $('#input-fecha'),
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
        // CNEB Dropdowns
        selectCnebCompetencia: $('#select-cneb-competencia'),
        selectCnebCapacidad: $('#select-cneb-capacidad'),
        selectCnebEnfoque: $('#select-cneb-enfoque'),
        // Import/Export
        btnExportJson: $('#btn-export-json'),
        btnImportJson: $('#btn-import-json'),
        inputImportFile: $('#input-import-file'),
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
        };

        // Load last session if exists
        loadLastSession();

        // Render saved sessions list
        renderSavedList();

        // Load curriculum database
        loadCurriculum();

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

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);
    }

    // ═══════════════════════════════════════
    // FORM DATA COLLECTION
    // ═══════════════════════════════════════

    function getFormData() {
        return {
            metadata: {
                institucion: DOM.inputInstitucion.value,
                docente: DOM.inputDocente.value,
                fecha: DOM.inputFecha.value,
                grado: DOM.inputGrado.value,
                seccion: DOM.inputSeccion.value,
                area: DOM.inputArea.value,
                duracion: DOM.inputDuracion.value,
                unidad: DOM.inputUnidad.value,
                titulo: DOM.inputTitulo.value
            },
            proposito: {
                competencia: DOM.inputCompetencia.value,
                capacidad: DOM.inputCapacidad.value,
                desempeno: DOM.inputDesempeno.value,
                enfoque: DOM.inputEnfoque.value
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
        DOM.inputDocente.value = m.docente || '';
        DOM.inputFecha.value = m.fecha || '';
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

        if (session.template) {
            DOM.selectTemplate.value = session.template;
        }

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
                metadata: formData.metadata,
                proposito: aiData.proposito || formData.proposito,
                momentos: aiData.momentos || {},
                evaluacion: aiData.evaluacion || {},
                createdAt: new Date().toISOString()
            };

            AppState.currentSession = session;

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
            let html = el.innerHTML;
            // Normalize common line break tags to temporary newlines
            html = html.replace(/<br\s*\/?>/gi, '\n');
            html = html.replace(/<\/div>\s*<div>/gi, '\n');
            html = html.replace(/<div>/gi, '');
            html = html.replace(/<\/div>/gi, '');
            html = html.replace(/<\/p>\s*<p>/gi, '\n');
            html = html.replace(/<p>/gi, '');
            html = html.replace(/<\/p>/gi, '');

            const temp = document.createElement('div');
            temp.innerHTML = html;
            const plainText = temp.textContent;

            // Restore linebreaks as <br> while removing style cruft
            el.innerHTML = plainText.trim().replace(/\n/g, '<br>');
        });

        Toast.success('Formato limpiado');
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
            const count = Math.floor((canvas.width * canvas.height) / 8000);
            for (let i = 0; i < count; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    size: Math.random() * 1.5 + 0.3,
                    speed: Math.random() * 0.3 + 0.05,
                    opacity: Math.random() * 0.8 + 0.2,
                    pulse: Math.random() * Math.PI * 2
                });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const star of stars) {
                star.pulse += 0.01;
                const alpha = star.opacity * (0.6 + 0.4 * Math.sin(star.pulse));

                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(180, 200, 255, ${alpha})`;
                ctx.fill();

                // Subtle drift
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
        
        DOM.selectCnebEnfoque.innerHTML = '<option value="">-- Seleccionar Enfoque Oficial --</option>' +
            curriculumData.enfoques_transversales.map(e => `<option value="${escHTML(e)}">${escHTML(e)}</option>`).join('');
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
