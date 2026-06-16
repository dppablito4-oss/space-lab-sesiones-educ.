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
        sidebarOpen: false,
        sourceFileData: null, // Stores { name, type, base64, textContent }
        activeLogoTarget: null, // Stores target logo id: 'header-logo-left' or 'header-logo-regional'
        activeTableCell: null, // Stores currently active/focused table cell
        zoomScale: 1.0, // Custom zoom level for the sheet (1.0 = 100%)
        undoStack: [],
        redoStack: []
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
        btnExportPdf: $('#btn-export-pdf'),
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
        selectAiProvider: $('#select-ai-provider'),
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
        // Design customization controls
        designColor: $('#input-design-theme-color'),
        designColorHex: $('#input-design-theme-color-hex'),
        designFontFamily: $('#select-design-font-family'),
        designFontSize: $('#select-design-font-size'),
        designPadding: $('#select-design-padding'),
        designLineHeight: $('#select-design-line-height'),
        designHeaderBg: $('#select-design-header-bg'),
        // Ribbon customizer controls
        ribbonColor: $('#ribbon-theme-color'),
        ribbonFontFamily: $('#ribbon-font-family'),
        ribbonFontSize: $('#ribbon-font-size'),
        ribbonPadding: $('#ribbon-padding'),
        ribbonLineHeight: $('#ribbon-line-height'),
        ribbonHeaderBg: $('#ribbon-header-bg'),
        btnRibbonLogoLeft: $('#btn-ribbon-logo-left'),
        btnRibbonLogoRight: $('#btn-ribbon-logo-right'),
        // Ribbon Text formatting manual controls
        btnFormatUndo: $('#btn-format-undo'),
        btnFormatRedo: $('#btn-format-redo'),
        btnFormatForeColor: $('#btn-format-forecolor'),
        btnFormatBackColor: $('#btn-format-backcolor'),
        btnFormatAlignLeft: $('#btn-format-align-left'),
        btnFormatAlignCenter: $('#btn-format-align-center'),
        btnFormatAlignRight: $('#btn-format-align-right'),
        btnFormatAlignJustify: $('#btn-format-align-justify'),
        btnTableRowInsert: $('#btn-table-row-insert'),
        btnTableRowDelete: $('#btn-table-row-delete'),
        // Source File Upload
        inputSourceFile: $('#input-source-file'),
        sourceFileDropzone: $('#source-file-dropzone'),
        sourceFileInfo: $('#source-file-info'),
        sourceFileNameText: $('#source-file-name-text'),
        btnRemoveSourceFile: $('#btn-remove-source-file'),
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
            window.AuthUi.init();
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
        // Sidebar tabs switcher
        const tabs = $$('.sidebar-tab');
        const panes = $$('.tab-pane');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTabId = tab.dataset.tab;
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const targetPane = $(`#${targetTabId}`);
                if (targetPane) targetPane.classList.add('active');
            });
        });

        // Generate buttons
        DOM.btnGenerate.addEventListener('click', handleGenerate);
        DOM.btnGenerateAI.addEventListener('click', handleGenerateAI);

        // Action buttons
        DOM.btnToggleEdit.addEventListener('click', toggleEditMode);
        DOM.btnPreview.addEventListener('click', togglePreviewMode);
        DOM.btnExportPdf.addEventListener('click', handleExportPDF);
        
        // Word export listeners removed (can be restored if needed in the future)
        /*
        const btnExportWord = document.getElementById('btn-export-word');
        if (btnExportWord) {
            btnExportWord.addEventListener('click', handleExportWord);
        }
        const btnExportWordPreview = document.getElementById('btn-export-word-preview');
        if (btnExportWordPreview) {
            btnExportWordPreview.addEventListener('click', handleExportWord);
        }
        */
        
        const btnAiRubrica = document.getElementById('btn-ai-rubrica');
        if (btnAiRubrica) {
            btnAiRubrica.addEventListener('click', handleAiRubrica);
        }
        
        const btnAiImproveText = document.getElementById('btn-ai-improve-text');
        if (btnAiImproveText) {
            btnAiImproveText.addEventListener('click', () => handleAiImproveText('improve'));
        }

        // Live Time Balance updates
        DOM.sessionSheet.addEventListener('input', checkTimeBalance);
        if (DOM.inputDuracion) {
            DOM.inputDuracion.addEventListener('input', checkTimeBalance);
            DOM.inputDuracion.addEventListener('change', checkTimeBalance);
        }

        DOM.btnPrint.addEventListener('click', handlePrint);
        DOM.btnSave.addEventListener('click', handleSave);
        DOM.btnLoad.addEventListener('click', handleShowLoadModal);
        DOM.btnNew.addEventListener('click', handleNew);
        DOM.btnCleanFormat.addEventListener('click', handleCleanFormat);

        // CNEB Curriculum dropdowns
        DOM.inputArea.addEventListener('change', handleAreaChange);
        DOM.selectAiProvider.addEventListener('change', handleAiProviderChange);
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
        DOM.btnTriggerUploadLogo.addEventListener('click', () => {
            AppState.activeLogoTarget = null; // Reset target so it asks
            DOM.inputUploadLogo.click();
        });
        DOM.inputUploadLogo.addEventListener('change', handleUploadLogo);
        DOM.btnRefreshLogos.addEventListener('click', loadLogosGallery);

        // Selection range holder for manual formatting (letter colors & highlight)
        let lastSelectionRange = null;

        function saveSelection() {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (DOM.sessionSheet.contains(range.commonAncestorContainer)) {
                    lastSelectionRange = range;
                }
            }
        }

        function restoreSelection() {
            if (lastSelectionRange) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(lastSelectionRange);
            }
        }

        DOM.sessionSheet.addEventListener('mouseup', saveSelection);
        DOM.sessionSheet.addEventListener('keyup', saveSelection);
        DOM.sessionSheet.addEventListener('focusout', saveSelection);

        // Keep track of active table cell for row insertions/deletions
        DOM.sessionSheet.addEventListener('focusin', (e) => {
            const cell = e.target.closest('td, th');
            if (cell) {
                AppState.activeTableCell = cell;
            }
        });
        DOM.sessionSheet.addEventListener('click', (e) => {
            const cell = e.target.closest('td, th');
            if (cell) {
                AppState.activeTableCell = cell;
            }
        });

        // Helper to update session design styles from DOM inputs
        function updateStylesFromSidebar() {
            applyDesignStyles({
                themeColor: DOM.designColor.value,
                fontFamily: DOM.designFontFamily.value,
                fontSize: DOM.designFontSize.value,
                padding: DOM.designPadding.value,
                lineHeight: DOM.designLineHeight.value,
                headerBg: DOM.designHeaderBg.value
            });
            saveCurrentState();
        }

        function updateStylesFromRibbon() {
            applyDesignStyles({
                themeColor: DOM.ribbonColor.value,
                fontFamily: DOM.ribbonFontFamily.value,
                fontSize: DOM.ribbonFontSize.value,
                padding: DOM.ribbonPadding.value,
                lineHeight: DOM.ribbonLineHeight.value,
                headerBg: DOM.ribbonHeaderBg.value
            });
            saveCurrentState();
        }

        // Design customizer controls events (Sidebar)
        DOM.designColor.addEventListener('input', updateStylesFromSidebar);
        DOM.designColorHex.addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                DOM.designColor.value = e.target.value;
                updateStylesFromSidebar();
            }
        });
        if (DOM.designFontFamily) DOM.designFontFamily.addEventListener('change', updateStylesFromSidebar);
        DOM.designFontSize.addEventListener('change', updateStylesFromSidebar);
        DOM.designPadding.addEventListener('change', updateStylesFromSidebar);
        DOM.designLineHeight.addEventListener('change', updateStylesFromSidebar);
        DOM.designHeaderBg.addEventListener('change', updateStylesFromSidebar);

        // Design customizer controls events (Ribbon)
        if (DOM.ribbonColor) DOM.ribbonColor.addEventListener('input', updateStylesFromRibbon);
        if (DOM.ribbonFontFamily) DOM.ribbonFontFamily.addEventListener('change', updateStylesFromRibbon);
        if (DOM.ribbonFontSize) DOM.ribbonFontSize.addEventListener('change', updateStylesFromRibbon);
        if (DOM.ribbonPadding) DOM.ribbonPadding.addEventListener('change', updateStylesFromRibbon);
        if (DOM.ribbonLineHeight) DOM.ribbonLineHeight.addEventListener('change', updateStylesFromRibbon);
        if (DOM.ribbonHeaderBg) DOM.ribbonHeaderBg.addEventListener('change', updateStylesFromRibbon);

        // Text formatting command triggers (Word Style)
        const formatBtnBold = document.getElementById('btn-format-bold');
        if (formatBtnBold) {
            formatBtnBold.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('bold', false, null);
            });
        }
        const formatBtnItalic = document.getElementById('btn-format-italic');
        if (formatBtnItalic) {
            formatBtnItalic.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('italic', false, null);
            });
        }
        const formatBtnUnderline = document.getElementById('btn-format-underline');
        if (formatBtnUnderline) {
            formatBtnUnderline.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('underline', false, null);
            });
        }
        const formatBtnListBullet = document.getElementById('btn-format-list-bullet');
        if (formatBtnListBullet) {
            formatBtnListBullet.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('insertUnorderedList', false, null);
            });
        }
        const formatBtnListNumber = document.getElementById('btn-format-list-number');
        if (formatBtnListNumber) {
            formatBtnListNumber.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('insertOrderedList', false, null);
            });
        }

        // Alignments manual editing
        const formatBtnAlignLeft = document.getElementById('btn-format-align-left');
        if (formatBtnAlignLeft) {
            formatBtnAlignLeft.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('justifyLeft', false, null);
            });
        }
        const formatBtnAlignCenter = document.getElementById('btn-format-align-center');
        if (formatBtnAlignCenter) {
            formatBtnAlignCenter.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('justifyCenter', false, null);
            });
        }
        const formatBtnAlignRight = document.getElementById('btn-format-align-right');
        if (formatBtnAlignRight) {
            formatBtnAlignRight.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('justifyRight', false, null);
            });
        }
        const formatBtnAlignJustify = document.getElementById('btn-format-align-justify');
        if (formatBtnAlignJustify) {
            formatBtnAlignJustify.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('justifyFull', false, null);
            });
        }

        // Undo and Redo triggers
        if (DOM.btnFormatUndo) {
            DOM.btnFormatUndo.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('undo', false, null);
                saveCurrentState();
            });
        }
        if (DOM.btnFormatRedo) {
            DOM.btnFormatRedo.addEventListener('click', (e) => {
                e.preventDefault();
                document.execCommand('redo', false, null);
                saveCurrentState();
            });
        }

        // Table row management triggers
        if (DOM.btnTableRowInsert) {
            DOM.btnTableRowInsert.addEventListener('click', (e) => {
                e.preventDefault();
                handleInsertRow();
            });
        }
        if (DOM.btnTableRowDelete) {
            DOM.btnTableRowDelete.addEventListener('click', (e) => {
                e.preventDefault();
                handleDeleteRow();
            });
        }

        // Color formatting using last saved selection
        if (DOM.btnFormatForeColor) {
            DOM.btnFormatForeColor.addEventListener('change', (e) => {
                restoreSelection();
                document.execCommand('foreColor', false, e.target.value);
                saveCurrentState();
            });
        }
        if (DOM.btnFormatBackColor) {
            DOM.btnFormatBackColor.addEventListener('change', (e) => {
                restoreSelection();
                document.execCommand('hiliteColor', false, e.target.value);
                saveCurrentState();
            });
        }

        // Ribbon Logo triggers (opens interactive editor)
        if (DOM.btnRibbonLogoLeft) {
            DOM.btnRibbonLogoLeft.addEventListener('click', (e) => {
                e.preventDefault();
                const logoImg = document.getElementById('header-logo-left');
                if (logoImg) {
                    logoImg.style.display = 'block';
                    openLogoEditor(logoImg);
                } else {
                    Toast.warning('Genera la sesión primero para poder editar el logo');
                }
            });
        }
        if (DOM.btnRibbonLogoRight) {
            DOM.btnRibbonLogoRight.addEventListener('click', (e) => {
                e.preventDefault();
                const logoImg = document.getElementById('header-logo-regional');
                if (logoImg) {
                    logoImg.style.display = 'block';
                    openLogoEditor(logoImg);
                } else {
                    Toast.warning('Genera la sesión primero para poder editar el logo');
                }
            });
        }

        // Click on logo images inside document to open floating editor popover
        DOM.sessionSheet.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.classList.contains('official-logo-img')) {
                e.stopPropagation();
                openLogoEditor(target);
            }
        });

        // Initialize Floating Logo Editor global listeners once
        initLogoEditorListeners();

        // Source file upload drag & drop events
        DOM.sourceFileDropzone.addEventListener('click', () => DOM.inputSourceFile.click());
        DOM.inputSourceFile.addEventListener('change', handleSourceFileSelect);
        DOM.sourceFileDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            DOM.sourceFileDropzone.classList.add('dragover');
        });
        DOM.sourceFileDropzone.addEventListener('dragleave', () => {
            DOM.sourceFileDropzone.classList.remove('dragover');
        });
        DOM.sourceFileDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            DOM.sourceFileDropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processSourceFile(e.dataTransfer.files[0]);
            }
        });
        DOM.btnRemoveSourceFile.addEventListener('click', handleRemoveSourceFile);

        // Ctrl + Scroll Zoom on sheet
        DOM.previewArea.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault(); // Prevent standard browser zoom
                
                const delta = e.deltaY;
                const scaleChange = 0.05;
                if (delta < 0) {
                    AppState.zoomScale = Math.min(AppState.zoomScale + scaleChange, 2.0); // max 200%
                } else {
                    AppState.zoomScale = Math.max(AppState.zoomScale - scaleChange, 0.5); // min 50%
                }
                
                applyZoom();
            }
        }, { passive: false });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        // Word-like Right-Click Context Menu
        initContextMenu();

        // Logos Gallery Modal listeners
        initLogosGalleryModal();

        // Refine text modal listeners
        initRefineTextModal();
    }

    // ═══════════════════════════════════════
    // FORM DATA COLLECTION
    // ═══════════════════════════════════════


    function getFormData() {
        const logoImg = $('#header-logo-regional');
        const logoUrl = logoImg ? logoImg.getAttribute('src') : '';
        const logoLeftImg = $('#header-logo-left');
        const logoLeftUrl = logoLeftImg ? logoLeftImg.getAttribute('src') : '';

        // Capture style attributes to save customizations (width, height, display, objectFit)
        const logoLeftStyle = logoLeftImg ? logoLeftImg.getAttribute('style') : '';
        const logoRegionalStyle = logoImg ? logoImg.getAttribute('style') : '';

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
                ai_provider: DOM.selectAiProvider.value,
                logo_regional_url: logoUrl,
                logo_left_url: logoLeftUrl,
                logo_left_style: logoLeftStyle,
                logo_regional_style: logoRegionalStyle
            },
            proposito: {
                competencia: DOM.inputCompetencia.value,
                capacidad: DOM.inputCapacidad.value,
                desempeno: DOM.inputDesempeno.value,
                enfoque: DOM.inputEnfoque.value,
                enfoque2: DOM.inputEnfoque2.value
            },
            design: {
                themeColor: DOM.designColor.value,
                fontFamily: DOM.designFontFamily.value,
                fontSize: DOM.designFontSize.value,
                padding: DOM.designPadding.value,
                lineHeight: DOM.designLineHeight.value,
                headerBg: DOM.designHeaderBg.value
            },
            momentos: {},
            evaluacion: {}
        };
    }

    function populateForm(session) {
        if (!session) return;
        const m = session.metadata || {};
        const p = session.proposito || {};
        const d = session.design || {
            themeColor: '#000000',
            fontFamily: 'Arial, sans-serif',
            fontSize: '10pt',
            padding: '4px 6px',
            lineHeight: '1.4',
            headerBg: '#f1f5f9'
        };

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
        DOM.selectAiProvider.value = m.ai_provider || 'gemini';
        handleAiProviderChange();

        // Design config inputs
        DOM.designColor.value = d.themeColor || '#000000';
        DOM.designColorHex.value = d.themeColor || '#000000';
        if (DOM.designFontFamily) DOM.designFontFamily.value = d.fontFamily || 'Arial, sans-serif';
        DOM.designFontSize.value = d.fontSize || '10pt';
        DOM.designPadding.value = d.padding || '4px 6px';
        DOM.designLineHeight.value = d.lineHeight || '1.4';
        DOM.designHeaderBg.value = d.headerBg || '#f1f5f9';

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
        // Intercept: Check user authentication
        const user = await SupabaseClient.getCurrentUser();
        if (!user) {
            Toast.warning('Debes crear una cuenta para generar sesiones con IA');
            if (window.AuthUi && typeof window.AuthUi.openRegister === 'function') {
                window.AuthUi.openRegister();
            }
            return;
        }

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
        if (!AppState.sourceFileData && !formData.metadata.area && !formData.metadata.titulo) {
            Toast.warning('Llena al menos el Área Curricular, el Título de la sesión o sube un archivo de referencia.');
            return;
        }

        Loader.show('🤖 Generando sesión con IA...');

        try {
            const aiData = await AiCopilot.generateSession({
                ...formData.metadata,
                ...formData.proposito,
                sourceFile: AppState.sourceFileData
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
            clearSourceFile();

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

        // Apply design customizer variables
        applyDesignStyles(session.design);

        // Apply zoom scale
        applyZoom();

        // Close sidebar on mobile
        closeSidebar();

        // Save current state
        Storage.setCurrentSession(session);

        // Check time balance
        checkTimeBalance();
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

    async function handleExportPDF() {
        if (!AppState.currentSession) {
            Toast.warning('Genera una sesión primero');
            return;
        }

        // Save current state first
        saveCurrentState();

        Loader.show('Generando archivo PDF...');

        try {
            const element = DOM.sessionSheet;
            
            // Temporarily set editMode to false to clean up contenteditable outlines/focus rings
            const wasEditMode = AppState.editMode;
            if (wasEditMode) {
                AppState.editMode = false;
                enforceEditMode();
            }

            // Temporarily reset zoom to 1.0 to ensure correct PDF page rendering layout
            const currentZoom = DOM.sessionSheet.style.zoom;
            DOM.sessionSheet.style.zoom = '1';

            const opt = {
                margin:       [12, 10, 12, 10], // top, left, bottom, right in mm
                filename:     `Sesion_${AppState.currentSession.metadata?.titulo || 'aprendizaje'}.pdf`.replace(/[\s/]+/g, '_'),
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // Run html2pdf
            await html2pdf().set(opt).from(element).save();
            
            // Restore zoom
            DOM.sessionSheet.style.zoom = currentZoom;

            // Restore edit mode if it was active
            if (wasEditMode) {
                AppState.editMode = true;
                enforceEditMode();
            }

            Loader.hide();
            Toast.success('PDF exportado y descargado con éxito');
        } catch (error) {
            console.error('[PDF] Error exporting PDF:', error);
            Loader.hide();
            Toast.error('Error al exportar a PDF: ' + error.message);
        }
    }

    async function handleExportWord() {
        if (!AppState.currentSession) {
            Toast.warning('No hay ninguna sesión activa para exportar.');
            return;
        }

        const titulo = AppState.currentSession.metadata?.titulo || 'Sesion-de-Aprendizaje';
        const filename = `${titulo.replace(/[^a-zA-Z0-9-_\s]/g, '')}.docx`;

        Loader.show('📝 Generando archivo de Word (.docx)...');

        try {
            // Save before exporting
            saveCurrentState();

            // Clone the session sheet to clean up
            const clone = DOM.sessionSheet.cloneNode(true);
            
            // Remove no-print and resize handle elements
            const noPrintElements = clone.querySelectorAll('.no-print, #logo-resize-handle');
            noPrintElements.forEach(el => el.remove());

            // Convert images in the clone to base64 to ensure they embed in the docx
            const images = clone.querySelectorAll('img');
            
            function urlToBase64(url) {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = function() {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth || img.width;
                            canvas.height = img.naturalHeight || img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        } catch (e) {
                            reject(e);
                        }
                    };
                    img.onerror = function(err) {
                        reject(err);
                    };
                    
                    // Break cache for CORS if needed, but not for dataURIs
                    if (url.startsWith('data:')) {
                        resolve(url);
                        return;
                    }
                    
                    if (url.indexOf('?') === -1) {
                        img.src = url + '?t=' + Date.now();
                    } else {
                        img.src = url + '&t=' + Date.now();
                    }
                });
            }

            for (let img of images) {
                if (img.src) {
                    try {
                        const base64 = await urlToBase64(img.src);
                        img.src = base64;
                    } catch (e) {
                        console.warn('Could not convert image to base64 for Word export:', img.src, e);
                        // Fallback: keep original URL
                    }
                }
            }

            const cleanHtml = clone.innerHTML;
            
            // Get current styles from sheets to embed in docx
            let styles = '';
            const styleSheets = document.styleSheets;
            for (let i = 0; i < styleSheets.length; i++) {
                try {
                    const rules = styleSheets[i].cssRules || styleSheets[i].rules;
                    if (rules) {
                        for (let j = 0; j < rules.length; j++) {
                            styles += rules[j].cssText;
                        }
                    }
                } catch (e) {
                    // Ignore cross-origin stylesheet errors
                }
            }

            // Fallback design properties
            const activeColor = DOM.designColor ? DOM.designColor.value : '#3b82f6';
            const activeFont = DOM.designFontFamily ? DOM.designFontFamily.value : 'Arial, sans-serif';
            const activeSize = DOM.designFontSize ? DOM.designFontSize.value : '11pt';
            
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>${titulo}</title>
                    <style>
                        body {
                            font-family: ${activeFont};
                            font-size: ${activeSize};
                            color: #000000;
                            background-color: #ffffff;
                            margin: 1in;
                        }
                        table {
                            border-collapse: collapse;
                            width: 100%;
                            margin-bottom: 15px;
                        }
                        th, td {
                            border: 1px solid ${activeColor};
                            padding: 6px;
                            font-size: 9.5pt;
                            vertical-align: top;
                        }
                        th {
                            background-color: #f1f5f9;
                            font-weight: bold;
                        }
                        .session-title-bar-official {
                            text-align: center;
                            font-size: 13pt;
                            font-weight: bold;
                            margin-top: 10px;
                            margin-bottom: 10px;
                            text-transform: uppercase;
                        }
                        .subsection-title-bar {
                            background-color: #e2e8f0;
                            font-weight: bold;
                            font-size: 9.5pt;
                            padding: 4px 6px;
                            margin-top: 15px;
                            margin-bottom: 6px;
                            border-left: 4px solid #000000;
                            text-transform: uppercase;
                        }
                        .subsection-content-box {
                            border: 1px solid #000000;
                            padding: 8px;
                            margin-bottom: 10px;
                            font-size: 9pt;
                        }
                        .official-logo-cell {
                            border: none !important;
                            text-align: center;
                            vertical-align: middle;
                        }
                        .cell-peru {
                            background-color: #c0392b !important;
                            color: #ffffff !important;
                            text-align: center;
                        }
                        .cell-minedu {
                            background-color: #2c3e50 !important;
                            color: #ffffff !important;
                            text-align: center;
                        }
                        .cell-dre, .cell-ugel, .cell-agp {
                            background-color: #7f8c8d !important;
                            color: #ffffff !important;
                            text-align: center;
                        }
                        /* General application print styles */
                        ${styles}
                    </style>
                </head>
                <body>
                    ${cleanHtml}
                </body>
                </html>
            `;

            if (typeof htmlDocx === 'undefined') {
                throw new Error('La librería de conversión html-docx-js no se cargó correctamente.');
            }

            const blob = htmlDocx.asBlob(htmlContent, {
                orientation: 'portrait',
                margins: { top: 720, right: 720, bottom: 720, left: 720 }
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Loader.hide();
            Toast.success('¡Sesión exportada a Word (.docx) correctamente!');
        } catch (error) {
            console.error('[Word Export] Error:', error);
            Loader.hide();
            Toast.error('Error al exportar a Word: ' + error.message);
        }
    }

    function parseMinutes(text) {
        if (!text) return 0;
        const clean = text.toLowerCase().trim();
        
        // Check for ranges or sum of numbers, e.g. "15 + 5" or "15-20"
        // Let's first search for hours and multiply by 45 (or 60)
        const hoursMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:hora|h)/);
        if (hoursMatch) {
            const hours = parseFloat(hoursMatch[1]);
            const multiplier = clean.includes('pedag') ? 45 : 45;
            return Math.round(hours * multiplier);
        }
        
        const numbers = clean.match(/\d+/g);
        if (numbers) {
            let sum = 0;
            numbers.forEach(n => {
                sum += parseInt(n, 10);
            });
            return sum;
        }
        return 0;
    }

    function checkTimeBalance() {
        if (!AppState.currentSession) return;
        
        // 1. Get planned duration
        const totalDurationText = DOM.inputDuracion ? DOM.inputDuracion.value : '';
        const plannedMinutes = parseMinutes(totalDurationText || AppState.currentSession.metadata?.duracion);
        
        if (plannedMinutes <= 0) {
            hideTimeBalanceWarning();
            return;
        }
        
        // 2. Sum minutes of the moments in the sheet
        let parsedSum = 0;
        
        // For Estandar template (.momento-time)
        const timeElements = DOM.sessionSheet.querySelectorAll('.momento-time');
        timeElements.forEach(el => {
            const txt = el.textContent || '';
            const cleaned = txt.replace(/TIEMPO\s*:\s*/i, '');
            parsedSum += parseMinutes(cleaned);
        });
        
        // For Laboratorio/Refuerzo templates (.time-cell)
        const cellElements = DOM.sessionSheet.querySelectorAll('.time-cell');
        cellElements.forEach(el => {
            const txt = el.textContent || '';
            parsedSum += parseMinutes(txt);
        });
        
        if (parsedSum === 0) {
            hideTimeBalanceWarning();
            return;
        }
        
        // 3. Compare
        if (parsedSum !== plannedMinutes) {
            showTimeBalanceWarning(`La suma de los momentos da ${parsedSum} min, pero tu sesión está planificada para ${plannedMinutes} min.`);
        } else {
            hideTimeBalanceWarning();
        }
    }

    function showTimeBalanceWarning(message) {
        const banner = document.getElementById('time-balance-warning');
        const bannerText = document.getElementById('time-balance-warning-text');
        if (banner && bannerText) {
            bannerText.textContent = message;
            banner.style.display = 'flex';
            banner.classList.remove('hidden');
        }
    }

    function hideTimeBalanceWarning() {
        const banner = document.getElementById('time-balance-warning');
        if (banner) {
            banner.style.display = 'none';
            banner.classList.add('hidden');
        }
    }

    async function handleAiRubrica() {
        // Intercept: Check user authentication
        const user = await SupabaseClient.getCurrentUser();
        if (!user) {
            Toast.warning('Debes crear una cuenta para usar el asistente de evaluación con IA');
            if (window.AuthUi && typeof window.AuthUi.openRegister === 'function') {
                window.AuthUi.openRegister();
            }
            return;
        }

        if (!AiCopilot.isConfigured()) {
            const configured = AiCopilot.showConfigPrompt();
            if (!configured) {
                Toast.warning('Necesitas configurar una API Key para usar el Asistente IA');
                return;
            }
        }

        // Search for target cell inside sheet
        let criteriaTarget = DOM.sessionSheet.querySelector('.propositos-table td:nth-child(3)');
        if (!criteriaTarget) {
            const tables = DOM.sessionSheet.querySelectorAll('table');
            for (const table of tables) {
                const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.toLowerCase());
                const criteriaColIndex = headers.findIndex(h => h.includes('criterios'));
                if (criteriaColIndex !== -1) {
                    criteriaTarget = table.querySelector(`tbody tr td:nth-child(${criteriaColIndex + 1})`);
                    if (criteriaTarget) break;
                }
            }
        }

        if (!criteriaTarget) {
            Toast.warning('No se pudo encontrar la columna "Criterios de Evaluación" en la hoja actual.');
            return;
        }

        Loader.show('🤖 Generando criterios de evaluación con IA...');

        try {
            const formData = getFormData();
            const competencia = formData.proposito?.competencia || DOM.inputCompetencia.value || '';
            const tema = formData.metadata?.titulo || DOM.inputTitulo.value || '';
            const grado = formData.metadata?.grado || DOM.inputGrado.value || '';
            const area = formData.metadata?.area || DOM.inputArea.value || '';

            const listItemsHtml = await AiCopilot.generateCriterios(competencia, tema, grado, area);
            
            // Wrap in ul.session-list
            criteriaTarget.innerHTML = `<ul class="session-list">${listItemsHtml}</ul>`;

            saveCurrentState();
            checkTimeBalance();
            Loader.hide();
            Toast.success('🎯 Criterios de evaluación generados con éxito');
        } catch (error) {
            Loader.hide();
            Toast.error('Error al generar criterios: ' + error.message);
        }
    }

    async function handleAiImproveText() {
        // Intercept: Check user authentication
        const user = await SupabaseClient.getCurrentUser();
        if (!user) {
            Toast.warning('Debes crear una cuenta para refinar texto con IA');
            if (window.AuthUi && typeof window.AuthUi.openRegister === 'function') {
                window.AuthUi.openRegister();
            }
            return;
        }

        if (!AiCopilot.isConfigured()) {
            const configured = AiCopilot.showConfigPrompt();
            if (!configured) {
                Toast.warning('Necesitas configurar una API Key para usar el Asistente IA');
                return;
            }
        }

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (!selectedText) {
            Toast.warning('Selecciona primero un fragmento de texto en la hoja para mejorar su redacción.');
            return;
        }

        // Store selection range and text globally in AppState
        AppState.selectionRange = selection.getRangeAt(0).cloneRange();
        AppState.selectedText = selectedText;

        // Open Refine Text Modal
        const modal = document.getElementById('refine-text-modal');
        const preview = document.getElementById('refine-text-preview');
        const customInput = document.getElementById('input-refine-custom');
        const optBtns = document.querySelectorAll('.refine-opt-btn');

        if (modal) {
            if (preview) preview.textContent = selectedText;
            if (customInput) customInput.value = '';
            
            // Set first option active by default
            optBtns.forEach((btn, index) => {
                if (index === 0) btn.classList.add('active');
                else btn.classList.remove('active');
            });

            modal.classList.remove('hidden');
        }
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
    let isUndoingOrRedoing = false;

    function saveCurrentState() {
        if (!AppState.currentSession) return;
        if (isUndoingOrRedoing) return;

        const currentHtml = DOM.sessionSheet.innerHTML;
        const previousState = AppState.currentSession.htmlContent || '';

        // If the HTML changed, push the previous state to the undo stack
        if (currentHtml && currentHtml !== previousState) {
            AppState.undoStack.push({
                html: previousState,
                metadata: JSON.parse(JSON.stringify(AppState.currentSession.metadata || {}))
            });
            if (AppState.undoStack.length > 50) {
                AppState.undoStack.shift();
            }
            AppState.redoStack = []; // Clear redo stack on new action
        }

        AppState.currentSession.htmlContent = currentHtml;
        AppState.currentSession.lastSaved = new Date().toISOString();

        Storage.setCurrentSession(AppState.currentSession);

        if (Storage.getSession(AppState.currentSession.id)) {
            Storage.saveSession(AppState.currentSession);
            renderSavedList();
        }
    }

    function undo() {
        if (!AppState.undoStack || AppState.undoStack.length === 0) {
            Toast.warning('No hay más acciones para deshacer.');
            return;
        }

        isUndoingOrRedoing = true;
        const currentHtml = DOM.sessionSheet.innerHTML;
        AppState.redoStack.push({
            html: currentHtml,
            metadata: JSON.parse(JSON.stringify(AppState.currentSession.metadata || {}))
        });
        if (AppState.redoStack.length > 50) {
            AppState.redoStack.shift();
        }

        const prevState = AppState.undoStack.pop();
        DOM.sessionSheet.innerHTML = prevState.html;

        AppState.currentSession.metadata = prevState.metadata;
        populateForm(AppState.currentSession);

        AppState.currentSession.htmlContent = prevState.html;
        Storage.setCurrentSession(AppState.currentSession);
        if (Storage.getSession(AppState.currentSession.id)) {
            Storage.saveSession(AppState.currentSession);
            renderSavedList();
        }

        // Hide resize handle if active logo target is modified
        const resizeHandle = document.getElementById('logo-resize-handle');
        if (resizeHandle) resizeHandle.style.display = 'none';

        checkTimeBalance();
        isUndoingOrRedoing = false;
        Toast.success('Deshecho');
    }

    function redo() {
        if (!AppState.redoStack || AppState.redoStack.length === 0) {
            Toast.warning('No hay más acciones para rehacer.');
            return;
        }

        isUndoingOrRedoing = true;
        const currentHtml = DOM.sessionSheet.innerHTML;
        AppState.undoStack.push({
            html: currentHtml,
            metadata: JSON.parse(JSON.stringify(AppState.currentSession.metadata || {}))
        });
        if (AppState.undoStack.length > 50) {
            AppState.undoStack.shift();
        }

        const nextState = AppState.redoStack.pop();
        DOM.sessionSheet.innerHTML = nextState.html;

        AppState.currentSession.metadata = nextState.metadata;
        populateForm(AppState.currentSession);

        AppState.currentSession.htmlContent = nextState.html;
        Storage.setCurrentSession(AppState.currentSession);
        if (Storage.getSession(AppState.currentSession.id)) {
            Storage.saveSession(AppState.currentSession);
            renderSavedList();
        }

        const resizeHandle = document.getElementById('logo-resize-handle');
        if (resizeHandle) resizeHandle.style.display = 'none';

        checkTimeBalance();
        isUndoingOrRedoing = false;
        Toast.success('Rehecho');
    }

    function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        if (width > height) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        } else {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Canvas compression failed'));
                            return;
                        }
                        const compressedFile = new File([blob], file.name, {
                            type: file.type || 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    }, file.type || 'image/jpeg', quality);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    function loadLastSession() {
        const current = Storage.getCurrentSession();
        if (current && current.htmlContent) {
            AppState.currentSession = current;
            populateForm(current);

            DOM.sessionSheet.innerHTML = current.htmlContent;
            applyDesignStyles(current.design);
            applyZoom();
            enforceEditMode();
            DOM.emptyState.classList.add('hidden');
            DOM.printPreview.classList.remove('hidden');

            if (current.template) {
                DOM.selectTemplate.value = current.template;
            }

            Toast.info('Última sesión restaurada');
            
            // Check time balance
            checkTimeBalance();
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
            applyDesignStyles(session.design);
            applyZoom();
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

        // Reset zoom scale to 100%
        AppState.zoomScale = 1.0;
        applyZoom();

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
        const key = e.key.toLowerCase();
        
        // Ctrl+S: Save
        if (e.ctrlKey && key === 's') {
            e.preventDefault();
            handleSave();
        }
        // Ctrl+P: Print
        if (e.ctrlKey && key === 'p') {
            e.preventDefault();
            handlePrint();
        }
        // Ctrl+E: Toggle edit
        if (e.ctrlKey && key === 'e') {
            e.preventDefault();
            toggleEditMode();
        }
        // Ctrl+Z: Undo
        if (e.ctrlKey && key === 'z') {
            e.preventDefault();
            undo();
        }
        // Ctrl+Y: Redo
        if (e.ctrlKey && key === 'y') {
            e.preventDefault();
            redo();
        }
        // Ctrl+B or Ctrl+N: Bold (N is bold in Spanish MS Word)
        if (e.ctrlKey && (key === 'b' || key === 'n')) {
            e.preventDefault();
            document.execCommand('bold', false, null);
            saveCurrentState();
        }
        // Ctrl+I or Ctrl+K: Italic (K is italic in Spanish MS Word)
        if (e.ctrlKey && (key === 'i' || key === 'k')) {
            e.preventDefault();
            document.execCommand('italic', false, null);
            saveCurrentState();
        }
        // Ctrl+U: Underline
        if (e.ctrlKey && key === 'u') {
            e.preventDefault();
            document.execCommand('underline', false, null);
            saveCurrentState();
        }
        // Escape: Close modals/sidebar
        if (e.key === 'Escape') {
            closeSidebar();
            DOM.loadModal.classList.add('hidden');
            const galleryModal = document.getElementById('logos-gallery-modal');
            if (galleryModal) galleryModal.classList.add('hidden');
            const menu = document.getElementById('editor-context-menu');
            if (menu) {
                menu.style.display = 'none';
                menu.classList.add('hidden');
            }
            hideResizeHandle();
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
 
            requestAnimationFrame(draw);
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

    function applyDesignStyles(design) {
        const sheet = DOM.sessionSheet;
        if (!sheet) return;

        // If no design object is provided, read current values from inputs
        const d = design || {
            themeColor: DOM.designColor.value,
            fontFamily: DOM.designFontFamily.value,
            fontSize: DOM.designFontSize.value,
            padding: DOM.designPadding.value,
            lineHeight: DOM.designLineHeight.value,
            headerBg: DOM.designHeaderBg.value
        };

        // Sync Sidebar inputs
        DOM.designColor.value = d.themeColor || '#000000';
        DOM.designColorHex.value = d.themeColor || '#000000';
        if (DOM.designFontFamily) DOM.designFontFamily.value = d.fontFamily || 'Arial, sans-serif';
        DOM.designFontSize.value = d.fontSize || '10pt';
        DOM.designPadding.value = d.padding || '4px 6px';
        DOM.designLineHeight.value = d.lineHeight || '1.4';
        DOM.designHeaderBg.value = d.headerBg || '#f1f5f9';

        // Sync Ribbon inputs
        if (DOM.ribbonColor) DOM.ribbonColor.value = d.themeColor || '#000000';
        if (DOM.ribbonFontFamily) DOM.ribbonFontFamily.value = d.fontFamily || 'Arial, sans-serif';
        if (DOM.ribbonFontSize) DOM.ribbonFontSize.value = d.fontSize || '10pt';
        if (DOM.ribbonPadding) DOM.ribbonPadding.value = d.padding || '4px 6px';
        if (DOM.ribbonLineHeight) DOM.ribbonLineHeight.value = d.lineHeight || '1.4';
        if (DOM.ribbonHeaderBg) DOM.ribbonHeaderBg.value = d.headerBg || '#f1f5f9';

        sheet.style.setProperty('--theme-border-color', d.themeColor || '#000000');
        sheet.style.setProperty('--session-font-family', d.fontFamily || 'Arial, sans-serif');
        sheet.style.setProperty('--session-font-size', d.fontSize || '10pt');
        sheet.style.setProperty('--session-cell-padding', d.padding || '4px 6px');
        sheet.style.setProperty('--session-line-height', d.lineHeight || '1.4');
        sheet.style.setProperty('--theme-label-bg', d.headerBg || '#f1f5f9');

        if (AppState.currentSession) {
            AppState.currentSession.design = d;
        }
    }

    async function applyLogoToDocument(url, targetId) {
        let id = targetId || AppState.activeLogoTarget;
        
        if (!id) {
            const confirmed = await ConfirmDialog.show({
                title: 'Seleccionar Posición',
                message: '¿En qué posición deseas colocar este logo?',
                confirmText: 'Derecha (Regional/I.E.)',
                cancelText: 'Izquierda (Escudo/Nacional)'
            });
            id = confirmed ? 'header-logo-regional' : 'header-logo-left';
        }

        const logoImg = document.getElementById(id);
        if (logoImg) {
            logoImg.src = url;
            logoImg.style.display = 'block';
            
            // Highlight effect
            logoImg.style.transform = 'scale(1.15)';
            setTimeout(() => {
                logoImg.style.transform = '';
            }, 300);

            // Close popover if open
            const popover = document.getElementById('logo-editor-popover');
            if (popover) {
                popover.classList.add('hidden');
            }

            // Save state
            saveCurrentState();
            Toast.success('Logo actualizado');
        } else {
            Toast.warning('Genera la sesión primero para poder aplicar el logo');
        }
    }

    function openLogoEditor(target) {
        if (!target) return;
        AppState.activeLogoTarget = target.id;
        
        const popover = document.getElementById('logo-editor-popover');
        const widthSlider = document.getElementById('logo-editor-width-slider');
        const widthVal = document.getElementById('logo-editor-width-val');
        const heightSlider = document.getElementById('logo-editor-height-slider');
        const heightVal = document.getElementById('logo-editor-height-val');
        const heightContainer = document.getElementById('logo-editor-height-container');
        const fitContainer = document.getElementById('logo-editor-fit-container');
        const aspectRatioCheckbox = document.getElementById('logo-editor-aspect-ratio');
        const fitBtns = popover.querySelectorAll('.btn-fit');

        if (!popover) return;

        // 1. Position the popover relative to the image
        popover.style.display = 'block';
        popover.classList.remove('hidden');

        const rect = target.getBoundingClientRect();
        let top = window.scrollY + rect.bottom + 10;
        let left = window.scrollX + rect.left + (rect.width / 2) - (popover.offsetWidth / 2);

        if (left < 10) left = 10;
        if (left + popover.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - popover.offsetWidth - 10;
        }

        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;

        // 2. Load current values
        let currentWidth = parseInt(target.style.width, 10);
        if (isNaN(currentWidth)) {
            currentWidth = target.offsetWidth || 65;
        }
        widthSlider.value = currentWidth;
        widthVal.textContent = `${currentWidth}px`;

        let currentHeight = target.style.height;
        let isAutoHeight = !currentHeight || currentHeight === 'auto';
        
        aspectRatioCheckbox.checked = isAutoHeight;
        
        if (isAutoHeight) {
            heightContainer.classList.add('hidden');
            heightContainer.style.display = 'none';
            fitContainer.classList.add('hidden');
            fitContainer.style.display = 'none';
        } else {
            heightContainer.classList.remove('hidden');
            heightContainer.style.display = 'flex';
            fitContainer.classList.remove('hidden');
            fitContainer.style.display = 'flex';
            let numericHeight = parseInt(currentHeight, 10);
            if (isNaN(numericHeight)) {
                numericHeight = target.offsetHeight || 65;
            }
            heightSlider.value = numericHeight;
            heightVal.textContent = `${numericHeight}px`;
        }

        const currentFit = target.style.objectFit || 'contain';
        fitBtns.forEach(btn => {
            if (btn.dataset.fit === currentFit) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 3. Position the Resize Handle
        const handle = getOrCreateResizeHandle();
        handle.style.display = 'block';
        handle.style.top = `${window.scrollY + rect.bottom - 5}px`;
        handle.style.left = `${window.scrollX + rect.right - 5}px`;
    }

    function initLogoEditorListeners() {
        const popover = document.getElementById('logo-editor-popover');
        if (!popover) return;

        const closeBtn = document.getElementById('logo-editor-close');
        const galleryTrigger = document.getElementById('logo-editor-gallery-trigger');
        const swapBtn = document.getElementById('logo-editor-swap');
        const deleteBtn = document.getElementById('logo-editor-delete');
        const widthSlider = document.getElementById('logo-editor-width-slider');
        const widthVal = document.getElementById('logo-editor-width-val');
        const heightSlider = document.getElementById('logo-editor-height-slider');
        const heightVal = document.getElementById('logo-editor-height-val');
        const heightContainer = document.getElementById('logo-editor-height-container');
        const fitContainer = document.getElementById('logo-editor-fit-container');
        const aspectRatioCheckbox = document.getElementById('logo-editor-aspect-ratio');
        const fitBtns = popover.querySelectorAll('.btn-fit');
        const resetBtn = document.getElementById('logo-editor-reset');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                popover.style.display = 'none';
                popover.classList.add('hidden');
                hideResizeHandle();
            });
        }

        if (galleryTrigger) {
            galleryTrigger.addEventListener('click', () => {
                openLogosGalleryModal();
            });
        }

        if (swapBtn) {
            swapBtn.addEventListener('click', () => {
                swapLogos();
            });
        }

        widthSlider.addEventListener('input', () => {
            if (!AppState.activeLogoTarget) return;
            const target = document.getElementById(AppState.activeLogoTarget);
            if (!target) return;

            const w = widthSlider.value;
            widthVal.textContent = `${w}px`;
            target.style.width = `${w}px`;
            target.style.maxWidth = 'none';
            target.style.maxHeight = 'none';

            if (aspectRatioCheckbox.checked) {
                target.style.height = 'auto';
            } else {
                target.style.height = `${heightSlider.value}px`;
            }

            // Reposition handle dynamically when width changes
            const rect = target.getBoundingClientRect();
            const handle = document.getElementById('logo-resize-handle');
            if (handle) {
                handle.style.top = `${window.scrollY + rect.bottom - 5}px`;
                handle.style.left = `${window.scrollX + rect.right - 5}px`;
            }
            saveCurrentState();
        });

        heightSlider.addEventListener('input', () => {
            if (!AppState.activeLogoTarget) return;
            const target = document.getElementById(AppState.activeLogoTarget);
            if (!target) return;

            const h = heightSlider.value;
            heightVal.textContent = `${h}px`;
            target.style.height = `${h}px`;
            target.style.maxWidth = 'none';
            target.style.maxHeight = 'none';

            // Reposition handle dynamically when height changes
            const rect = target.getBoundingClientRect();
            const handle = document.getElementById('logo-resize-handle');
            if (handle) {
                handle.style.top = `${window.scrollY + rect.bottom - 5}px`;
                handle.style.left = `${window.scrollX + rect.right - 5}px`;
            }
            saveCurrentState();
        });

        aspectRatioCheckbox.addEventListener('change', () => {
            if (!AppState.activeLogoTarget) return;
            const target = document.getElementById(AppState.activeLogoTarget);
            if (!target) return;

            if (aspectRatioCheckbox.checked) {
                heightContainer.classList.add('hidden');
                heightContainer.style.display = 'none';
                fitContainer.classList.add('hidden');
                fitContainer.style.display = 'none';
                target.style.height = 'auto';
                target.style.objectFit = 'contain';
            } else {
                heightContainer.classList.remove('hidden');
                heightContainer.style.display = 'flex';
                fitContainer.classList.remove('hidden');
                fitContainer.style.display = 'flex';
                const h = heightSlider.value;
                heightVal.textContent = `${h}px`;
                target.style.height = `${h}px`;

                const activeBtn = popover.querySelector('.btn-fit.active');
                target.style.objectFit = activeBtn ? activeBtn.dataset.fit : 'contain';
            }

            // Reposition handle dynamically
            const rect = target.getBoundingClientRect();
            const handle = document.getElementById('logo-resize-handle');
            if (handle) {
                handle.style.top = `${window.scrollY + rect.bottom - 5}px`;
                handle.style.left = `${window.scrollX + rect.right - 5}px`;
            }
            saveCurrentState();
        });

        fitBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (!AppState.activeLogoTarget) return;
                const target = document.getElementById(AppState.activeLogoTarget);
                if (!target) return;

                fitBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                target.style.objectFit = btn.dataset.fit;
                saveCurrentState();
            });
        });

        deleteBtn.addEventListener('click', () => {
            if (!AppState.activeLogoTarget) return;
            const target = document.getElementById(AppState.activeLogoTarget);
            if (!target) return;

            target.style.display = 'none';
            popover.style.display = 'none';
            popover.classList.add('hidden');
            hideResizeHandle();
            saveCurrentState();
            Toast.success('Logo removido');
        });

        resetBtn.addEventListener('click', () => {
            if (!AppState.activeLogoTarget) return;
            const target = document.getElementById(AppState.activeLogoTarget);
            if (!target) return;

            if (AppState.activeLogoTarget === 'header-logo-left') {
                target.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Escudo_Nacional_del_Per%C3%BA.svg/130px-Escudo_Nacional_del_Per%C3%BA.svg.png';
            } else {
                target.src = 'https://sesiones.sypablitodp.site/assets/logo.png';
            }

            target.style.width = '65px';
            target.style.height = 'auto';
            target.style.objectFit = 'contain';
            target.style.display = 'block';
            target.removeAttribute('style');
            target.style.cursor = 'pointer';

            popover.style.display = 'none';
            popover.classList.add('hidden');
            hideResizeHandle();
            saveCurrentState();
            Toast.success('Valores restablecidos');
        });

        window.addEventListener('click', (e) => {
            if (!popover.classList.contains('hidden') && !popover.contains(e.target)) {
                const clickedLogo = e.target.classList.contains('official-logo-img');
                const clickedRibbonLeft = e.target.id === 'btn-ribbon-logo-left';
                const clickedRibbonRight = e.target.id === 'btn-ribbon-logo-right';
                const clickedResizeHandle = e.target.id === 'logo-resize-handle' || e.target.classList.contains('logo-resize-handle');
                const clickedContextMenu = e.target.closest('#editor-context-menu');
                const clickedModal = e.target.closest('#logos-gallery-modal');
                if (!clickedLogo && !clickedRibbonLeft && !clickedRibbonRight && !clickedResizeHandle && !clickedContextMenu && !clickedModal) {
                    popover.style.display = 'none';
                    popover.classList.add('hidden');
                    hideResizeHandle();
                }
            }
        });
    }

    function setupDragAndDrop() {
        const sheet = DOM.sessionSheet;
        if (!sheet) return;

        sheet.addEventListener('dragover', (e) => {
            const target = e.target;
            const logoCell = target.closest('.official-logo-cell');
            if (logoCell) {
                e.preventDefault();
                logoCell.style.outline = '2px dashed var(--accent)';
            }
        });

        sheet.addEventListener('dragleave', (e) => {
            const target = e.target;
            const logoCell = target.closest('.official-logo-cell');
            if (logoCell) {
                logoCell.style.outline = '';
            }
        });

        sheet.addEventListener('drop', (e) => {
            const target = e.target;
            const logoCell = target.closest('.official-logo-cell');
            if (logoCell) {
                e.preventDefault();
                logoCell.style.outline = '';
                
                const url = e.dataTransfer.getData('text/plain');
                if (url) {
                    const img = logoCell.querySelector('img');
                    if (img) {
                        applyLogoToDocument(url, img.id);
                    }
                }
            }
        });
    }

    // ═══════════════════════════════════════
    // SOURCE FILE UPLOAD & PARSING
    // ═══════════════════════════════════════

    function handleAiProviderChange() {
        const provider = DOM.selectAiProvider.value;
        const fileGroup = $('.source-file-group');
        
        if (provider === 'deepseek') {
            if (fileGroup) fileGroup.classList.add('hidden');
            clearSourceFile();
        } else {
            if (fileGroup) fileGroup.classList.remove('hidden');
        }
    }

    function handleSourceFileSelect(e) {
        if (e.target.files && e.target.files.length > 0) {
            processSourceFile(e.target.files[0]);
        }
    }

    function processSourceFile(file) {
        if (!file) return;

        // Check file size (max 8MB)
        const maxSizeBytes = 8 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            Toast.warning('El archivo excede el tamaño límite de 8 MB.');
            DOM.inputSourceFile.value = '';
            return;
        }

        const fileName = file.name;
        const fileType = file.type;

        // Determine if it's a text file
        const textExtensions = ['.txt', '.csv', '.json', '.md', '.xml', '.html', '.css', '.js'];
        const isTextExtension = textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
        const isTextType = fileType.startsWith('text/') || isTextExtension;

        if (isTextType) {
            Loader.show('Leyendo archivo de texto...');
            const reader = new FileReader();
            reader.onload = function(e) {
                Loader.hide();
                const content = e.target.result;
                AppState.sourceFileData = {
                    name: fileName,
                    type: fileType || 'text/plain',
                    textContent: content,
                    base64: null
                };
                showSourceFileInfo(fileName);
            };
            reader.onerror = function() {
                Loader.hide();
                Toast.error('Error al leer el archivo de texto.');
            };
            reader.readAsText(file);
        } else {
            // It's a binary file (PDF, image, audio)
            Loader.show('Cargando archivo multimedia...');
            const reader = new FileReader();
            reader.onload = function(e) {
                Loader.hide();
                const dataUrl = e.target.result;
                // Strip metadata from data URL
                const base64Data = dataUrl.split(',')[1];
                AppState.sourceFileData = {
                    name: fileName,
                    type: fileType || getBinaryMimeFallback(fileName),
                    textContent: null,
                    base64: base64Data
                };
                showSourceFileInfo(fileName);
            };
            reader.onerror = function() {
                Loader.hide();
                Toast.error('Error al procesar el archivo multimedia.');
            };
            reader.readAsDataURL(file);
        }
    }

    function getBinaryMimeFallback(fileName) {
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.pdf')) return 'application/pdf';
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
        if (lower.endsWith('.webp')) return 'image/webp';
        if (lower.endsWith('.mp3')) return 'audio/mp3';
        if (lower.endsWith('.wav')) return 'audio/wav';
        return 'application/octet-stream';
    }

    function showSourceFileInfo(name) {
        DOM.sourceFileNameText.textContent = `📄 ${name}`;
        DOM.sourceFileInfo.classList.remove('hidden');
        DOM.sourceFileDropzone.classList.add('hidden');
        Toast.success('Archivo cargado correctamente');
    }

    function handleRemoveSourceFile() {
        AppState.sourceFileData = null;
        DOM.inputSourceFile.value = '';
        DOM.sourceFileNameText.textContent = '';
        DOM.sourceFileInfo.classList.add('hidden');
        DOM.sourceFileDropzone.classList.remove('hidden');
        Toast.success('Archivo de referencia removido');
    }

    // Standard clearing without notifications
    function clearSourceFile() {
        AppState.sourceFileData = null;
        DOM.inputSourceFile.value = '';
        DOM.sourceFileNameText.textContent = '';
        DOM.sourceFileInfo.classList.add('hidden');
        DOM.sourceFileDropzone.classList.remove('hidden');
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
        } catch {
            return isoString;
        }
    }

    function handleInsertRow() {
        let cell = AppState.activeTableCell;
        if (!cell) {
            const activeEl = document.activeElement;
            if (activeEl && DOM.sessionSheet.contains(activeEl)) {
                cell = activeEl.closest('td, th');
            }
        }

        if (!cell) {
            Toast.warning("Por favor, selecciona una celda en una tabla editable.");
            return;
        }

        const table = cell.closest('table');
        if (!table) {
            Toast.warning("Esta celda no pertenece a ninguna tabla.");
            return;
        }

        // Only allow dynamic rows in .content-table, .eval-table, and .momentos-table
        const allowedClasses = ['content-table', 'eval-table', 'momentos-table'];
        const isAllowed = allowedClasses.some(cls => table.classList.contains(cls));
        if (!isAllowed) {
            Toast.warning("Esta acción está deshabilitada en tablas de encabezados.");
            return;
        }

        const activeRow = cell.closest('tr');
        if (!activeRow) {
            Toast.warning("No se pudo identificar la fila.");
            return;
        }

        // Avoid modifying headers
        if (activeRow.closest('thead') || (activeRow.querySelectorAll('th').length > 0 && !activeRow.querySelectorAll('td').length)) {
            Toast.warning("No se pueden modificar las filas de cabecera.");
            return;
        }

        // Clone active row
        const clone = activeRow.cloneNode(true);

        // Reset text content of cells & ensure they are contenteditable
        clone.querySelectorAll('td, th').forEach(el => {
            el.innerHTML = '';
            el.setAttribute('contenteditable', 'true');
        });

        // Insert clone after active row
        activeRow.after(clone);

        // Ensure newly created cells are active and editable
        enforceEditMode();

        // Focus the first cell of the inserted row
        const nextCell = clone.querySelector('[contenteditable="true"]') || clone.querySelector('td');
        if (nextCell) {
            nextCell.focus();
            AppState.activeTableCell = nextCell;
        }

        saveCurrentState();
        Toast.success("Fila insertada correctamente");
    }

    function handleDeleteRow() {
        let cell = AppState.activeTableCell;
        if (!cell) {
            const activeEl = document.activeElement;
            if (activeEl && DOM.sessionSheet.contains(activeEl)) {
                cell = activeEl.closest('td, th');
            }
        }

        if (!cell) {
            Toast.warning("Por favor, selecciona una celda en la fila que deseas eliminar.");
            return;
        }

        const table = cell.closest('table');
        if (!table) {
            Toast.warning("Esta celda no pertenece a ninguna tabla.");
            return;
        }

        const allowedClasses = ['content-table', 'eval-table', 'momentos-table'];
        const isAllowed = allowedClasses.some(cls => table.classList.contains(cls));
        if (!isAllowed) {
            Toast.warning("Esta acción está deshabilitada en tablas de encabezados.");
            return;
        }

        const activeRow = cell.closest('tr');
        if (!activeRow) {
            Toast.warning("No se pudo identificar la fila.");
            return;
        }

        // Avoid modifying headers
        if (activeRow.closest('thead') || (activeRow.querySelectorAll('th').length > 0 && !activeRow.querySelectorAll('td').length)) {
            Toast.warning("No se pueden eliminar las filas de cabecera.");
            return;
        }

        const tbody = activeRow.parentNode;
        if (!tbody) return;

        // Find all non-header rows in the same tbody
        const allBodyRows = Array.from(tbody.querySelectorAll('tr')).filter(r => {
            return !r.closest('thead') && !(r.querySelectorAll('th').length > 0 && !r.querySelectorAll('td').length);
        });

        if (allBodyRows.length <= 1) {
            Toast.warning("No se puede eliminar la única fila restante de la tabla.");
            return;
        }

        // Determine next cell focus
        const activeIdx = allBodyRows.indexOf(activeRow);
        let siblingToFocus = null;
        if (activeIdx > 0) {
            siblingToFocus = allBodyRows[activeIdx - 1];
        } else if (activeIdx < allBodyRows.length - 1) {
            siblingToFocus = allBodyRows[activeIdx + 1];
        }

        activeRow.remove();

        if (siblingToFocus) {
            const nextCell = siblingToFocus.querySelector('[contenteditable="true"]') || siblingToFocus.querySelector('td');
            if (nextCell) {
                nextCell.focus();
                AppState.activeTableCell = nextCell;
            }
        } else {
            AppState.activeTableCell = null;
        }

        saveCurrentState();
        Toast.success("Fila eliminada correctamente");
    }

    function applyZoom() {
        const sheet = DOM.sessionSheet;
        if (!sheet) return;
        
        // Apply scale using CSS zoom
        sheet.style.zoom = AppState.zoomScale;
        
        // Show temporary zoom floating percentage indicator
        showZoomIndicator();
    }

    let zoomIndicatorTimeout = null;
    function showZoomIndicator() {
        let indicator = document.getElementById('zoom-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'zoom-indicator';
            indicator.style.position = 'fixed';
            indicator.style.bottom = '20px';
            indicator.style.right = '20px';
            indicator.style.background = 'rgba(12, 12, 29, 0.85)';
            indicator.style.backdropFilter = 'blur(8px)';
            indicator.style.border = '1px solid var(--border-accent)';
            indicator.style.borderRadius = 'var(--radius-sm)';
            indicator.style.padding = '8px 12px';
            indicator.style.color = 'var(--text-accent)';
            indicator.style.fontFamily = 'var(--font-mono)';
            indicator.style.fontSize = '0.8rem';
            indicator.style.fontWeight = 'bold';
            indicator.style.zIndex = '9999';
            indicator.style.pointerEvents = 'none';
            indicator.style.boxShadow = 'var(--shadow-md)';
            indicator.style.transition = 'opacity 0.2s ease';
            document.body.appendChild(indicator);
        }
        
        indicator.textContent = `🔍 Zoom: ${Math.round(AppState.zoomScale * 100)}%`;
        indicator.style.opacity = '1';
        
        clearTimeout(zoomIndicatorTimeout);
        zoomIndicatorTimeout = setTimeout(() => {
            indicator.style.opacity = '0';
        }, 1200);
    }

    // ═══════════════════════════════════════
    // WORD-STYLE EDITING & LOGO GALERIA FEATURES
    // ═══════════════════════════════════════

    let selectedGalleryLogoUrl = null;

    function swapLogos() {
        const logoLeft = document.getElementById('header-logo-left');
        const logoRegional = document.getElementById('header-logo-regional');
        if (!logoLeft || !logoRegional) {
            Toast.warning('Genera la sesión primero para poder intercambiar los logos');
            return;
        }

        const srcLeft = logoLeft.getAttribute('src');
        const srcRegional = logoRegional.getAttribute('src');
        logoLeft.setAttribute('src', srcRegional || '');
        logoRegional.setAttribute('src', srcLeft || '');

        const styleLeft = logoLeft.getAttribute('style');
        const styleRegional = logoRegional.getAttribute('style');
        
        if (styleRegional !== null) {
            logoLeft.setAttribute('style', styleRegional);
        } else {
            logoLeft.removeAttribute('style');
        }
        if (styleLeft !== null) {
            logoRegional.setAttribute('style', styleLeft);
        } else {
            logoRegional.removeAttribute('style');
        }
        
        logoLeft.style.transform = 'scale(1.15)';
        logoRegional.style.transform = 'scale(1.15)';
        setTimeout(() => {
            logoLeft.style.transform = '';
            logoRegional.style.transform = '';
        }, 300);

        if (AppState.activeLogoTarget) {
            AppState.activeLogoTarget = AppState.activeLogoTarget === 'header-logo-left' ? 'header-logo-regional' : 'header-logo-left';
            const newActiveLogo = document.getElementById(AppState.activeLogoTarget);
            if (newActiveLogo) {
                openLogoEditor(newActiveLogo);
            }
        }

        saveCurrentState();
        Toast.success('Posición de logos intercambiada');
    }

    function getOrCreateResizeHandle() {
        let handle = document.getElementById('logo-resize-handle');
        if (!handle) {
            handle = document.createElement('div');
            handle.id = 'logo-resize-handle';
            handle.className = 'logo-resize-handle no-print';
            document.body.appendChild(handle);
            handle.addEventListener('mousedown', initResizeDrag);
        }
        return handle;
    }

    function hideResizeHandle() {
        const handle = document.getElementById('logo-resize-handle');
        if (handle) {
            handle.style.display = 'none';
        }
    }

    function initResizeDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!AppState.activeLogoTarget) return;
        const target = document.getElementById(AppState.activeLogoTarget);
        if (!target) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const rect = target.getBoundingClientRect();
        const startWidth = rect.width;
        const startHeight = rect.height;
        const aspectRatio = startWidth / startHeight;

        const handle = document.getElementById('logo-resize-handle');
        const popover = document.getElementById('logo-editor-popover');
        const widthSlider = document.getElementById('logo-editor-width-slider');
        const widthVal = document.getElementById('logo-editor-width-val');
        const heightSlider = document.getElementById('logo-editor-height-slider');
        const heightVal = document.getElementById('logo-editor-height-val');
        const heightContainer = document.getElementById('logo-editor-height-container');
        const fitContainer = document.getElementById('logo-editor-fit-container');
        const aspectRatioCheckbox = document.getElementById('logo-editor-aspect-ratio');

        document.body.style.cursor = 'se-resize';
        document.body.style.userSelect = 'none';

        function onMouseMove(moveEvt) {
            const zoom = AppState.zoomScale || 1.0;
            const deltaX = (moveEvt.clientX - startX) / zoom;
            const deltaY = (moveEvt.clientY - startY) / zoom;

            let newWidth = Math.max(30, Math.min(300, startWidth + deltaX));
            let newHeight;

            const keepAspect = !moveEvt.ctrlKey;
            
            if (keepAspect) {
                newHeight = newWidth / aspectRatio;
                target.style.height = 'auto';
                target.style.width = `${newWidth}px`;
                target.style.maxWidth = 'none';
                target.style.maxHeight = 'none';
                
                aspectRatioCheckbox.checked = true;
                heightContainer.classList.add('hidden');
                heightContainer.style.display = 'none';
                fitContainer.classList.add('hidden');
                fitContainer.style.display = 'none';
            } else {
                newHeight = Math.max(30, Math.min(300, startHeight + deltaY));
                target.style.width = `${newWidth}px`;
                target.style.height = `${newHeight}px`;
                target.style.maxWidth = 'none';
                target.style.maxHeight = 'none';
                
                aspectRatioCheckbox.checked = false;
                heightContainer.classList.remove('hidden');
                heightContainer.style.display = 'flex';
                fitContainer.classList.remove('hidden');
                fitContainer.style.display = 'flex';
                
                heightSlider.value = Math.round(newHeight);
                heightVal.textContent = `${Math.round(newHeight)}px`;
            }

            widthSlider.value = Math.round(newWidth);
            widthVal.textContent = `${Math.round(newWidth)}px`;

            const newRect = target.getBoundingClientRect();
            handle.style.top = `${window.scrollY + newRect.bottom - 5}px`;
            handle.style.left = `${window.scrollX + newRect.right - 5}px`;

            if (popover && !popover.classList.contains('hidden')) {
                let popTop = window.scrollY + newRect.bottom + 10;
                let popLeft = window.scrollX + newRect.left + (newRect.width / 2) - (popover.offsetWidth / 2);
                if (popLeft < 10) popLeft = 10;
                if (popLeft + popover.offsetWidth > window.innerWidth - 10) {
                    popLeft = window.innerWidth - popover.offsetWidth - 10;
                }
                popover.style.top = `${popTop}px`;
                popover.style.left = `${popLeft}px`;
            }
        }

        function onMouseUp() {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            saveCurrentState();
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    async function openLogosGalleryModal() {
        const modal = document.getElementById('logos-gallery-modal');
        if (!modal) return;

        const posSelector = document.getElementById('modal-logo-position-selector');
        if (posSelector) posSelector.classList.add('hidden');
        selectedGalleryLogoUrl = null;

        modal.classList.remove('hidden');
        await refreshModalLogosList();
    }

    async function refreshModalLogosList() {
        const container = document.getElementById('modal-logos-container');
        if (!container) return;

        const user = await SupabaseClient.getCurrentUser();
        if (!user) {
            container.innerHTML = `<span style="grid-column: span 4; font-size: 0.8rem; text-align: center; color: #a1a1aa; padding: 10px;">Inicia sesión para ver tus logos subidos</span>`;
            return;
        }

        container.innerHTML = `<span style="grid-column: span 4; font-size: 0.8rem; text-align: center; color: #a1a1aa; padding: 10px;">Cargando logos de Supabase...</span>`;
        try {
            const logos = await SupabaseClient.listLogos();
            if (logos.length === 0) {
                container.innerHTML = `<span style="grid-column: span 4; font-size: 0.8rem; text-align: center; color: #a1a1aa; padding: 10px;">No tienes logos subidos previamente</span>`;
                return;
            }

            container.innerHTML = logos.map(logo => `
                <div class="modal-logo-item" data-url="${logo.url}" style="position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 6px; cursor: pointer; transition: all 0.2s;" title="Clic para seleccionar">
                    <img src="${logo.url}" alt="${logo.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                </div>
            `).join('');

            container.querySelectorAll('.modal-logo-item').forEach(item => {
                item.addEventListener('click', () => {
                    const url = item.dataset.url;
                    handleSelectModalLogo(url);
                });
            });
        } catch (e) {
            console.error('[Modal Gallery] Error loading logos:', e);
            container.innerHTML = `<span style="grid-column: span 4; font-size: 0.8rem; text-align: center; color: var(--danger); padding: 10px;">Error al cargar logos</span>`;
        }
    }

    function handleSelectModalLogo(url) {
        if (AppState.activeLogoTarget) {
            applyLogoToDocument(url, AppState.activeLogoTarget);
            document.getElementById('logos-gallery-modal').classList.add('hidden');
        } else {
            selectedGalleryLogoUrl = url;
            const posSelector = document.getElementById('modal-logo-position-selector');
            if (posSelector) posSelector.classList.remove('hidden');
        }
    }

    async function handleModalLogoUpload(file) {
        const user = await SupabaseClient.getCurrentUser();
        if (!user) {
            Toast.warning('Debes iniciar sesión para subir logos a la galería.');
            if (window.AuthUi && typeof window.AuthUi.openRegister === 'function') {
                window.AuthUi.openRegister();
            }
            return;
        }

        if (!file.type.startsWith('image/')) {
            Toast.warning('Por favor selecciona una imagen válida (PNG, JPG)');
            return;
        }

        Loader.show('Comprimiendo y subiendo logo...');
        try {
            const compressedFile = await compressImage(file, 800, 800, 0.8);
            const publicUrl = await SupabaseClient.uploadLogo(compressedFile);
            Toast.success('Logo subido correctamente');
            
            await refreshModalLogosList();
            await loadLogosGallery();
            
            handleSelectModalLogo(publicUrl);
        } catch (err) {
            Toast.error('Error al subir logo: ' + err.message);
        } finally {
            Loader.hide();
            const modalFileInput = document.getElementById('input-modal-upload-logo');
            if (modalFileInput) modalFileInput.value = '';
        }
    }

    function initContextMenu() {
        const menu = document.getElementById('editor-context-menu');
        if (!menu) return;

        DOM.sessionSheet.addEventListener('contextmenu', (e) => {
            if (AppState.previewMode) return;

            e.preventDefault();
            e.stopPropagation();

            const isLogo = e.target.classList.contains('official-logo-img');
            const itemEditLogo = document.getElementById('menu-item-edit-logo');
            const itemSwapLogos = document.getElementById('menu-item-swap-logos');

            if (isLogo) {
                AppState.activeLogoTarget = e.target.id;
                if (itemEditLogo) itemEditLogo.classList.remove('hidden');
                if (itemSwapLogos) itemSwapLogos.classList.remove('hidden');
            } else {
                if (itemEditLogo) itemEditLogo.classList.add('hidden');
                if (itemSwapLogos) itemSwapLogos.classList.add('hidden');
            }

            menu.style.display = 'block';
            menu.classList.remove('hidden');

            let top = window.scrollY + e.clientY;
            let left = window.scrollX + e.clientX;

            if (left + menu.offsetWidth > window.innerWidth - 10) {
                left = window.innerWidth - menu.offsetWidth - 10;
            }
            if (e.clientY + menu.offsetHeight > window.innerHeight - 10) {
                top = window.scrollY + e.clientY - menu.offsetHeight;
            }

            menu.style.top = `${top}px`;
            menu.style.left = `${left}px`;
        });

        window.addEventListener('click', (e) => {
            if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
                menu.style.display = 'none';
                menu.classList.add('hidden');
            }
        });

        document.getElementById('menu-item-bold').addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand('bold', false, null);
            saveCurrentState();
            menu.style.display = 'none';
            menu.classList.add('hidden');
        });

        document.getElementById('menu-item-italic').addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand('italic', false, null);
            saveCurrentState();
            menu.style.display = 'none';
            menu.classList.add('hidden');
        });

        document.getElementById('menu-item-underline').addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand('underline', false, null);
            saveCurrentState();
            menu.style.display = 'none';
            menu.classList.add('hidden');
        });

        document.getElementById('menu-item-cut').addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand('cut');
            saveCurrentState();
            menu.style.display = 'none';
            menu.classList.add('hidden');
        });

        document.getElementById('menu-item-copy').addEventListener('click', (e) => {
            e.preventDefault();
            document.execCommand('copy');
            menu.style.display = 'none';
            menu.classList.add('hidden');
        });

        document.getElementById('menu-item-paste').addEventListener('click', async (e) => {
            e.preventDefault();
            menu.style.display = 'none';
            menu.classList.add('hidden');
            try {
                const text = await navigator.clipboard.readText();
                document.execCommand('insertText', false, text);
                saveCurrentState();
            } catch (err) {
                Toast.info('Usa Ctrl+V para pegar contenido');
            }
        });

        document.getElementById('menu-item-ai-improve').addEventListener('click', (e) => {
            e.preventDefault();
            handleAiImproveText('improve');
            menu.style.display = 'none';
            menu.classList.add('hidden');
        });

        document.getElementById('menu-item-ai-rubrica').addEventListener('click', (e) => {
            e.preventDefault();
            handleAiRubrica();
            menu.style.display = 'none';
            menu.classList.add('hidden');
        });

        document.getElementById('menu-item-edit-logo').addEventListener('click', (e) => {
            e.preventDefault();
            if (AppState.activeLogoTarget) {
                const logo = document.getElementById(AppState.activeLogoTarget);
                if (logo) openLogoEditor(logo);
            }
            menu.style.display = 'none';
            menu.classList.add('hidden');
        });

        document.getElementById('menu-item-swap-logos').addEventListener('click', (e) => {
            e.preventDefault();
            swapLogos();
            menu.style.display = 'none';
            menu.classList.add('hidden');
        });
    }

    function initLogosGalleryModal() {
        const btnApplyLeft = document.getElementById('btn-modal-apply-left');
        const btnApplyRight = document.getElementById('btn-modal-apply-right');
        const btnCloseModal = document.getElementById('btn-close-gallery-modal');
        const btnCloseModal2 = document.getElementById('btn-modal-gallery-close');
        const modalDropzone = document.getElementById('modal-logo-dropzone');
        const modalFileInput = document.getElementById('input-modal-upload-logo');

        if (btnApplyLeft) {
            btnApplyLeft.addEventListener('click', () => {
                if (selectedGalleryLogoUrl) {
                    applyLogoToDocument(selectedGalleryLogoUrl, 'header-logo-left');
                    document.getElementById('logos-gallery-modal').classList.add('hidden');
                }
            });
        }
        if (btnApplyRight) {
            btnApplyRight.addEventListener('click', () => {
                if (selectedGalleryLogoUrl) {
                    applyLogoToDocument(selectedGalleryLogoUrl, 'header-logo-regional');
                    document.getElementById('logos-gallery-modal').classList.add('hidden');
                }
            });
        }
        [btnCloseModal, btnCloseModal2].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    document.getElementById('logos-gallery-modal').classList.add('hidden');
                });
            }
        });

        if (modalDropzone) {
            modalDropzone.addEventListener('click', () => {
                modalFileInput.click();
            });
            modalDropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                modalDropzone.style.borderColor = '#00d2ff';
                modalDropzone.style.background = 'rgba(0, 210, 255, 0.05)';
            });
            modalDropzone.addEventListener('dragleave', () => {
                modalDropzone.style.borderColor = 'rgba(0, 210, 255, 0.2)';
                modalDropzone.style.background = 'rgba(0, 210, 255, 0.02)';
            });
            modalDropzone.addEventListener('drop', async (e) => {
                e.preventDefault();
                modalDropzone.style.borderColor = 'rgba(0, 210, 255, 0.2)';
                modalDropzone.style.background = 'rgba(0, 210, 255, 0.02)';
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    await handleModalLogoUpload(e.dataTransfer.files[0]);
                }
            });
        }
        if (modalFileInput) {
            modalFileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    await handleModalLogoUpload(e.target.files[0]);
                }
            });
        }
    }

    function initRefineTextModal() {
        const modal = document.getElementById('refine-text-modal');
        if (!modal) return;

        const closeBtn = document.getElementById('btn-close-refine-modal');
        const cancelBtn = document.getElementById('btn-refine-cancel');
        const submitBtn = document.getElementById('btn-refine-submit');
        const customInput = document.getElementById('input-refine-custom');
        const optBtns = document.querySelectorAll('.refine-opt-btn');

        const closeModal = () => {
            modal.classList.add('hidden');
            AppState.selectionRange = null;
            AppState.selectedText = '';
        };

        [closeBtn, cancelBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', closeModal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        optBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                optBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (customInput) customInput.value = '';
            });
        });

        if (customInput) {
            customInput.addEventListener('focus', () => {
                optBtns.forEach(b => b.classList.remove('active'));
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const range = AppState.selectionRange;
                const text = AppState.selectedText;

                if (!text || !range) {
                    Toast.warning('Se perdió la selección del texto original.');
                    closeModal();
                    return;
                }

                let instruction = '';
                const customText = customInput ? customInput.value.trim() : '';
                if (customText) {
                    instruction = customText;
                } else {
                    const activeOpt = document.querySelector('.refine-opt-btn.active');
                    if (activeOpt) {
                        instruction = activeOpt.dataset.instruction;
                    } else {
                        Toast.warning('Por favor selecciona una opción o escribe una instrucción.');
                        return;
                    }
                }

                closeModal();
                Loader.show('🤖 Refinando redacción con IA...');

                try {
                    const resultText = await AiCopilot.improveText(text, instruction);
                    
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    
                    range.deleteContents();
                    
                    const container = document.createElement('span');
                    container.innerHTML = resultText;
                    range.insertNode(container);
                    
                    sel.removeAllRanges();
                    const newRange = document.createRange();
                    newRange.selectNode(container);
                    sel.addRange(newRange);

                    saveCurrentState();
                    checkTimeBalance();
                    Loader.hide();
                    Toast.success('✨ Texto refinado correctamente por la IA');
                } catch (error) {
                    Loader.hide();
                    console.error('[AI Refinement] Error:', error);
                    Toast.error('Error al refinar texto: ' + error.message);
                }
            });
        }
    }

    // Expose styling API globally for agentic chatbot features
    window.AppDesign = {
        apply: (design) => {
            if (typeof applyDesignStyles === 'function') {
                applyDesignStyles(design);
            }
        },
        save: () => {
            if (typeof saveCurrentState === 'function') {
                saveCurrentState();
            }
        },
        getCurrent: () => {
            if (!DOM.designColor) return null;
            return {
                themeColor: DOM.designColor.value,
                fontSize: DOM.designFontSize.value,
                padding: DOM.designPadding.value,
                lineHeight: DOM.designLineHeight.value,
                headerBg: DOM.designHeaderBg.value
            };
        }
    };

    // ═══════════════════════════════════════
    // BOOT
    // ═══════════════════════════════════════

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
