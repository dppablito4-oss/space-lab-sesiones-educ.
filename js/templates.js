/* ═══════════════════════════════════════════════════
   TEMPLATES — Plantillas de Sesión MINEDU
   3 formatos: estándar, laboratorio, refuerzo
   ═══════════════════════════════════════════════════ */

const Templates = (() => {

    // ─── MAPA DE DATOS OFICIALES DE ENFOQUES CNEB ───
    const ENFOQUES_DATA_MAP = {
        "enfoque de derechos": {
            valor: "Conciencia de derechos / Libertad y responsabilidad / Diálogo y concertación",
            actitudes: "Los estudiantes deliberan sobre asuntos públicos, formulan propuestas y participan en la toma de decisiones para el bien común."
        },
        "enfoque inclusivo o de atención a la diversidad": {
            valor: "Respeto por las diferencias / Equidad en la enseñanza / Confianza en la persona",
            actitudes: "Docentes y estudiantes demuestran tolerancia, apertura y respeto a todos, evitando cualquier forma de exclusión o discriminación."
        },
        "enfoque intercultural": {
            valor: "Respeto a la identidad cultural / Justicia / Diálogo intercultural",
            actitudes: "Los miembros de la comunidad escolar acogen con respeto a todos, propiciando un diálogo abierto y valorando las diversas identidades."
        },
        "enfoque de igualdad de género": {
            valor: "Igualdad y Dignidad / Justicia / Empatía",
            actitudes: "Estudiantes y docentes reconocen que tanto hombres como mujeres tienen igualdad de derechos, deberes y oportunidades."
        },
        "enfoque ambiental": {
            valor: "Solidaridad planetaria y equidad intergeneracional / Justicia y solidaridad",
            actitudes: "Docentes y estudiantes promueven estilos de vida saludables y ecoeficientes, reduciendo el consumo de plástico y cuidando el entorno escolar."
        },
        "enfoque de orientación al bien común": {
            valor: "Equidad y justicia / Solidaridad / Empatía / Responsabilidad",
            actitudes: "Los estudiantes demuestran solidaridad con sus compañeros y asumen responsabilidades por el bienestar del grupo en el aula."
        },
        "enfoque de búsqueda de la excelencia": {
            valor: "Flexibilidad y apertura / Superación personal",
            actitudes: "Estudiantes y docentes adquieren cualidades que mejoren el propio desempeño para el éxito de sus metas de aprendizaje."
        }
    };

    function getEnfoqueData(name) {
        if (!name) return null;
        const cleanName = name.trim().toLowerCase();
        return ENFOQUES_DATA_MAP[cleanName] || null;
    }

    /**
     * Render a session template
     * @param {string} type - 'estandar' | 'laboratorio' | 'refuerzo'
     * @param {Object} data - Session data
     * @param {boolean} editable - Enable contenteditable
     * @returns {string} HTML string
     */
    function render(type, data, editable = true) {
        const ce = `contenteditable="${editable ? 'true' : 'false'}"`;
        const m = data.metadata || {};
        const p = data.proposito || {};
        const momentos = data.momentos || {};
        const evalData = data.evaluacion || {};
        const ct = data.competencias_transversales || {};
        const enfoques = data.enfoques || [];
        const recursos = data.recursos || {};

        switch (type) {
            case 'laboratorio':
                return renderLaboratorio(m, p, momentos, evalData, ce);
            case 'refuerzo':
                return renderRefuerzo(m, p, momentos, evalData, ce);
            case 'inicial':
                return renderInicial(m, p, momentos, evalData, ct, enfoques, recursos, data.juego_libre_sectores, data.ficha_trabajo, ce);
            default:
                return renderEstandar(m, p, momentos, evalData, ct, enfoques, recursos, data.ficha_trabajo, ce);
        }
    }

    // ═══════════════════════════════════════
    // SESIÓN ESTÁNDAR MINEDU (Formato PDF Oficial)
    // ═══════════════════════════════════════

    function renderEstandar(m, p, momentos, evalData, ct, enfoques, recursos, fichaTrabajo, ce) {

        // Build enfoques rows (at least 2)
        let enfoquesRows = '';
        if (enfoques && enfoques.length > 0) {
            enfoques.forEach(enf => {
                enfoquesRows += `
                    <tr>
                        <td ${ce}>${esc(enf.nombre || '')}</td>
                        <td ${ce}>${esc(enf.valor || '')}</td>
                        <td ${ce}>${esc(enf.actitudes || '')}</td>
                    </tr>`;
            });
        } else {
            // Default 2 rows from form data (resolviendo dinámicamente valor y actitudes)
            const enf1Name = p.enfoque || 'Enfoque de búsqueda de la excelencia';
            const enf1Data = getEnfoqueData(enf1Name) || {
                valor: p.enfoque_valor || 'Equidad y Justicia',
                actitudes: p.enfoque_actitudes || 'Dialoga con tus compañeros para resolver desacuerdos y escucha con atención.'
            };

            const enf2Name = p.enfoque2 || 'Enfoque ambiental';
            const enf2Data = getEnfoqueData(enf2Name) || {
                valor: p.enfoque2_valor || 'Justicia y solidaridad (orientados a la ecoeficiencia)',
                actitudes: p.enfoque2_actitudes || 'Reduce el uso de materiales desechables, reutilizando cuadernos, hojas y envases cuando sea posible durante las actividades del aula.'
            };

            enfoquesRows = `
                <tr>
                    <td ${ce}>${esc(enf1Name)}</td>
                    <td ${ce}>${esc(enf1Data.valor)}</td>
                    <td ${ce}>${esc(enf1Data.actitudes)}</td>
                </tr>
                <tr>
                    <td ${ce}>${esc(enf2Name)}</td>
                    <td ${ce}>${esc(enf2Data.valor)}</td>
                    <td ${ce}>${esc(enf2Data.actitudes)}</td>
                </tr>`;
        }

        // Build competencias transversales
        const ticItems = ct.tic && ct.tic.length > 0 ? ct.tic : [
            'Personaliza entornos virtuales',
            'Gestiona información del entorno virtual',
            'Interactúa en entornos virtuales',
            'Crea objetos virtuales en diversos formatos'
        ];
        const autonomaItems = ct.autonoma && ct.autonoma.length > 0 ? ct.autonoma : [
            'Define metas de aprendizaje',
            'Organiza acciones estratégicas para alcanzar sus metas',
            'Monitorea y ajusta su desempeño durante el proceso de aprendizaje'
        ];

        // Build capacities rows (split string by newline to render multiple <li> items)
        let capacidades = [];
        if (Array.isArray(p.capacidades)) {
            capacidades = p.capacidades;
        } else if (p.capacidad) {
            capacidades = p.capacidad
                .split('\n')
                .map(line => line.replace(/^[•\s\-\*\d\.\)]+\s*/, '').trim())
                .filter(line => line.length > 0);
        }
        if (capacidades.length === 0) capacidades = [''];

        // Build criteria rows (split string by newline to render multiple <li> items)
        let criterios = [];
        if (Array.isArray(p.criterios_evaluacion)) {
            criterios = p.criterios_evaluacion;
        } else if (p.desempeno) {
            criterios = p.desempeno
                .split('\n')
                .map(line => line.replace(/^[•\s\-\*\d\.\)]+\s*/, '').trim())
                .filter(line => line.length > 0);
        }
        if (criterios.length === 0) criterios = [''];

        let capacidadesHtml = '';
        capacidades.forEach(cap => {
            capacidadesHtml += `<li ${ce}>${esc(cap)}</li>`;
        });

        let criteriosHtml = '';
        criterios.forEach(crit => {
            criteriosHtml += `<li ${ce}>${esc(crit)}</li>`;
        });

        // ── MOMENTOS: Build dynamic rows for PDF paging ──
        let inicioRowsHtml = '';
        const inicio = momentos.inicio || {};
        const subMomentsInicio = [];

        if (inicio.motivacion) {
            subMomentsInicio.push({
                title: 'Motivación (5 min)',
                content: inicio.motivacion
            });
        }
        if (inicio.saberes_previos) {
            subMomentsInicio.push({
                title: `Saberes previos (${inicio.saberes_tiempo || '8 min'})`,
                content: inicio.saberes_previos
            });
        }
        if (inicio.problematizacion) {
            subMomentsInicio.push({
                title: `Problematización (${inicio.problematizacion_tiempo || '5 min'})`,
                content: inicio.problematizacion
            });
        }
        if (inicio.proposito_organizacion) {
            subMomentsInicio.push({
                title: `Propósito y organización (${inicio.proposito_tiempo || '5 min'})`,
                content: inicio.proposito_organizacion
            });
        }

        if (subMomentsInicio.length > 0) {
            const contentHtml = subMomentsInicio.map(sm => `
                <div class="momento-subsection" style="margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid;">
                    <div class="momento-subsection-title">${esc(sm.title)}</div>
                    <div>${escHtml(sm.content)}</div>
                </div>
            `).join('');

            inicioRowsHtml = `
                <tr>
                    <td class="momento-label-cell">
                        <div class="momento-name">INICIO:</div>
                        <div class="momento-sublabels">
                            <span>• Saberes Previos</span>
                            <span>• Problematización</span>
                            <span>• Propósito y organización</span>
                        </div>
                        <div class="momento-time">TIEMPO: ${esc(inicio.tiempo_total || '')}</div>
                    </td>
                    <td class="momento-content-cell" ${ce}>
                        <div class="momento-section">
                            ${contentHtml}
                        </div>
                    </td>
                    <td class="eval-column-cell">
                        <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                    </td>
                </tr>`;
        } else {
            const defaultText = inicio.actividades || '• El docente empieza la sesión saludando muy cordialmente a los estudiantes...\n• Se consensuan los acuerdos de convivencia para la interacción en clases.\n• Motivación: activity inicial.\n• Saberes previos: preguntas exploratorias.\n• Problematización: situación significativa.\n• Propósito y organización: comunicar el propósito de la sesión y los criterios de evaluación.';
            inicioRowsHtml = `
                <tr>
                    <td class="momento-label-cell">
                        <div class="momento-name">INICIO:</div>
                        <div class="momento-sublabels">
                            <span>• Saberes Previos</span>
                            <span>• Problematización</span>
                            <span>• Propósito y organización</span>
                        </div>
                        <div class="momento-time">TIEMPO: ${esc(inicio.tiempo_total || '')}</div>
                    </td>
                    <td class="momento-content-cell" ${ce}>
                        <div class="momento-section">
                            <div>${escHtml(defaultText)}</div>
                        </div>
                    </td>
                    <td class="eval-column-cell">
                        <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                    </td>
                </tr>`;
        }

        let desarrolloRowsHtml = '';
        const desarrollo = momentos.desarrollo || {};
        const desarrolloKeys = Object.keys(desarrollo)
            .filter(k => k.startsWith('proceso_') || k.startsWith('paso_'))
            .sort((a, b) => {
                const numA = parseInt(a.replace(/^\D+/g, ''), 10) || 0;
                const numB = parseInt(b.replace(/^\D+/g, ''), 10) || 0;
                return numA - numB;
            });

        const mappings = {
            'familiarizacion': 'Familiarización con el problema',
            'busqueda_estrategias': 'Búsqueda y ejecución de estrategias',
            'socializacion': 'Socialización de representaciones',
            'formalizacion_reflexion': 'Reflexión y Formalización',
            'experiencia': 'Experiencia',
            'reflexion': 'Reflexión',
            'conceptualizacion': 'Conceptualización',
            'aplicacion': 'Aplicación',
            'lanzamiento': 'Lanzamiento / Desafío',
            'indagacion': 'Indagación / Investigación',
            'desarrollo_producto': 'Desarrollo del Producto',
            'difusion_evaluacion': 'Difusión y Evaluación',
            'conexion_externa': 'Conexión de saberes externos',
            'aplicacion_guiada': 'Aplicación guiada / Taller activo',
            'consolidacion_retroalimentacion': 'Consolidación y retroalimentación interactiva',
            'problematizacion': 'Problematización de situaciones',
            'diseno_estrategias': 'Diseño de estrategias para hacer indagación',
            'generacion_analisis_datos': 'Generación, registro y análisis de datos',
            'estructuracion_comunicacion': 'Estructuración del saber construido y comunicación',
            'organizacion_roles': 'Organización de equipos y roles',
            'interdependencia_positiva': 'Interdependencia positiva',
            'interaccion_promotora': 'Interacción promotora',
            'autoevaluacion_grupal': 'Autoevaluación grupal'
        };

        if (desarrolloKeys.length > 0) {
            const contentHtml = desarrolloKeys.map(key => {
                const value = desarrollo[key];
                if (!value) return '';
                const cleanKey = key.replace(/^(proceso|paso)_\d+_/, '');
                let title = mappings[cleanKey] || cleanKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return `
                    <div class="momento-subsection" style="margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid;">
                        <div class="momento-subsection-title">${esc(title)}</div>
                        <div>${escHtml(value)}</div>
                    </div>
                `;
            }).join('');

            desarrolloRowsHtml = `
                <tr>
                    <td class="momento-label-cell">
                        <div class="momento-name">DESARROLLO:</div>
                        <div class="momento-sublabels">
                            <span>Gestión y Acompañamiento del Desarrollo de las Competencias</span>
                            <span>(Procesos didácticos del Área — monitoreo y retroalimentación)</span>
                        </div>
                        <div class="momento-time">TIEMPO: ${esc(desarrollo.tiempo_total || '')}</div>
                    </td>
                    <td class="momento-content-cell" ${ce}>
                        <div class="momento-section">
                            <div class="momento-subsection" style="page-break-inside: avoid; break-inside: avoid;">
                                <div class="momento-subsection-title" style="color:#c0392b; font-weight:700; text-decoration:underline; text-transform:uppercase; margin-bottom:8px;">
                                    GESTIÓN Y ACOMPAÑAMIENTO DEL DESARROLLO DE COMPETENCIAS
                                </div>
                            </div>
                            ${contentHtml}
                        </div>
                    </td>
                    <td class="eval-column-cell">
                        <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                    </td>
                </tr>`;
        } else {
            const defaultText = desarrollo.actividades || '• Presentación de la situación significativa.\n• Familiarización con el problema: lectura y comprensión.\n• Búsqueda y ejecución de estrategias.\n• Resolución del reto propuesto.\n• Socialización de resultados.\n• Formalización: el docente sistematiza los aprendizajes.\n• Reflexión: ¿qué procesos seguimos? ¿qué dificultades tuvimos?\n• Transferencia: aplicación a nuevas situaciones.';
            desarrolloRowsHtml = `
                <tr>
                    <td class="momento-label-cell">
                        <div class="momento-name">DESARROLLO:</div>
                        <div class="momento-sublabels">
                            <span>Gestión y Acompañamiento del Desarrollo de las Competencias</span>
                            <span>(Procesos didácticos del Área — monitoreo y retroalimentación)</span>
                        </div>
                        <div class="momento-time">TIEMPO: ${esc(desarrollo.tiempo_total || '')}</div>
                    </td>
                    <td class="momento-content-cell" ${ce}>
                        <div class="momento-section">
                            <div class="momento-subsection">
                                <div class="momento-subsection-title" style="color:#c0392b; font-weight:700; text-decoration:underline; text-transform:uppercase; margin-bottom:8px;">
                                    GESTIÓN Y ACOMPAÑAMIENTO DEL DESARROLLO DE COMPETENCIAS
                                </div>
                            </div>
                            <div>${escHtml(defaultText)}</div>
                        </div>
                    </td>
                    <td class="eval-column-cell">
                        <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                    </td>
                </tr>`;
        }

        let cierreRowsHtml = '';
        const cierre = momentos.cierre || {};
        const defaultCierre = cierre.actividades || '• <strong>Metacognición:</strong> ¿Qué aprendimos hoy? ¿Cómo lo aprendimos? ¿Para qué nos sirve?<br>• <strong>Evaluación formativa:</strong> revisión de los criterios de evaluación.<br>• <strong>Extensión para casa:</strong> actividad de refuerzo.';

        cierreRowsHtml = `
            <tr>
                <td class="momento-label-cell">
                    <div class="momento-name">CIERRE:</div>
                    <div class="momento-sublabels">
                        <span>• Metacognición</span>
                        <span>• Evaluación</span>
                        <span>• Extensión</span>
                    </div>
                    <div class="momento-time">TIEMPO: ${esc(cierre.tiempo_total || '')}</div>
                </td>
                <td class="momento-content-cell" ${ce}>
                    <div class="momento-section">${escHtml(defaultCierre)}</div>
                </td>
                <td class="eval-column-cell">
                    <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                </td>
            </tr>`;

        let fichaTrabajoHtml = '';
        if (fichaTrabajo && typeof fichaTrabajo === 'object') {
            const ft = fichaTrabajo;
            fichaTrabajoHtml = `
                <div class="html2pdf__page-break" style="break-before: page; margin-top: 30px;"></div>
                <div class="session-title-bar-official" style="margin-top: 20px; background: #2980b9 !important; color:#fff !important;">
                    <span>FICHA DE TRABAJO INDEPENDIENTE PARA EL ESTUDIANTE</span>
                </div>
                <div class="ficha-estudiante-container" style="border: 2px dashed #3498db; padding: 25px; border-radius: 12px; margin-top: 15px; background: #ffffff;">
                    <table style="width: 100%; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px;">
                        <tr>
                            <td style="font-size: 14px; font-weight: 700; color: #2c3e50; border:none !important; background:transparent !important; padding:0 !important;">
                                Nombre: __________________________________________________
                            </td>
                            <td style="font-size: 14px; font-weight: 700; color: #2c3e50; text-align: right; border:none !important; background:transparent !important; padding:0 !important; width: 220px;">
                                Grado y Sección: ________________
                            </td>
                        </tr>
                    </table>
                    
                    <div style="font-size: 16px; font-weight: 800; color: #2980b9; margin-bottom: 8px; text-transform: uppercase;" ${ce} data-key="ficha_titulo">
                        🎨 Actividad: ${esc(ft.titulo || 'Mi Ficha Práctica')}
                    </div>
                    <div style="font-size: 11px; font-style: italic; color: #7f8c8d; margin-bottom: 20px; padding: 8px; background: #ecf0f1; border-radius: 6px;" ${ce} data-key="ficha_indicaciones">
                        <strong>Indicaciones:</strong> ${esc(ft.indicaciones || 'Realiza la actividad según las indicaciones.')}
                    </div>
                    
                    <div class="ficha-actividades-render" style="min-height: 400px; padding: 15px; border: 1px solid #bdc3c7; border-radius: 8px; background: #fafafa;" ${ce} data-key="ficha_actividades">
                        ${ft.actividades || '<p style="text-align:center; color:#95a5a6; margin-top:150px;">Escribe o genera las actividades del estudiante aquí...</p>'}
                    </div>
                </div>`;
        }

        return `
            <table class="print-layout-table">
                <thead>
                    <tr>
                        <td>
                            <!-- ════════ HEADER INSTITUCIONAL OFICIAL ════════ -->
                            <table class="official-header-table">
                                <tr>
                                    <td class="official-header-logos-cell">
                                        <div class="official-header-logos-list" id="official-header-logos-list">
                                            ${buildLogosListHtml(m, ce)}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>

            <!-- ════════ TÍTULO PRINCIPAL ════════ -->
            <div class="session-title-bar-official">
                <span ${ce}>SESIÓN DE APRENDIZAJE N° ${esc(m.numero_sesion || '01')}</span>
            </div>

            <!-- ════════ DATOS GENERALES ════════ -->
            <table class="session-header-table">
                <tr>
                    <td class="label-cell">Institución Educativa</td>
                    <td class="value-cell" ${ce} colspan="3">${esc(m.institucion || 'I.E. N° — Nombre')}</td>
                    <td class="label-cell">Nivel</td>
                    <td class="value-cell" ${ce}>${esc(m.nivel || 'SECUNDARIA')}</td>
                </tr>
                <tr>
                    <td class="label-cell">Docente</td>
                    <td class="value-cell" ${ce} colspan="3">${esc(m.docente || '')}</td>
                    <td class="label-cell">Área</td>
                    <td class="value-cell" ${ce}>${esc(m.area || '')}</td>
                </tr>
                <tr>
                    <td class="label-cell">Grado</td>
                    <td class="value-cell" ${ce}>${esc(m.grado || '')}</td>
                    <td class="label-cell">Sección</td>
                    <td class="value-cell" ${ce}>${esc(m.seccion || '')}</td>
                    <td class="label-cell">Unidad/<br>Proyecto</td>
                    <td class="value-cell" ${ce}>${esc(m.unidad || '')}</td>
                </tr>
                <tr>
                    <td class="label-cell" colspan="4" style="text-align: left;">
                        <strong>Fecha</strong>&nbsp;&nbsp;
                        <span ${ce} style="font-weight:400">${esc(m.fecha || '')}</span>
                    </td>
                    <td class="label-cell">Duración</td>
                    <td class="value-cell" ${ce}>${esc(m.duracion || '4 horas pedagógicas')}</td>
                </tr>
            </table>

            <!-- ════════ TÍTULO DE LA SESIÓN ════════ -->
            <div class="subsection-title-bar">TÍTULO DE LA SESIÓN</div>
            <div class="subsection-content-box" ${ce}>
                ${esc(m.titulo || 'Título de la sesión de aprendizaje')}
            </div>

            <!-- ════════ PROPÓSITO DE LA SESIÓN ════════ -->
            <div class="subsection-title-bar">PROPÓSITO DE LA SESIÓN</div>
            <div class="subsection-content-box" ${ce}>
                ${escHtml(p.proposito_texto || p.desempeno || 'Describir el propósito de la sesión...')}
            </div>

            <!-- ════════ CONOCIMIENTOS ════════ -->
            <div class="subsection-title-bar">CONOCIMIENTOS</div>
            <div class="subsection-content-box" ${ce}>
                ${escHtml(p.conocimientos || 'Temas y subtemas que se abordarán...')}
            </div>

            <!-- ════════ PROPÓSITOS DE APRENDIZAJE ════════ -->
            <div class="subsection-title-bar">PROPÓSITOS DE APRENDIZAJE</div>

            <!-- Competencia y Estándar -->
            <table class="content-table">
                <tr>
                    <td class="label-cell" style="width: 160px">Competencia</td>
                    <td ${ce}><strong>${esc(p.competencia || 'Nombre de la competencia')}</strong></td>
                </tr>
                <tr>
                    <td class="label-cell">Estándar de aprendizaje</td>
                    <td ${ce} style="font-size:10px; line-height:1.4">${escHtml(p.estandar || 'Estándar de aprendizaje correspondiente al ciclo...')}</td>
                </tr>
            </table>

            <!-- Tabla de Competencias / Capacidades / Criterios / Producto / Instrumento -->
            <table class="content-table propositos-table">
                <thead>
                    <tr>
                        <th>COMPETENCIAS</th>
                        <th>CAPACIDADES</th>
                        <th>CRITERIOS DE EVALUACIÓN</th>
                        <th>PRODUCTO /<br>EVIDENCIA</th>
                        <th>INSTRUMENTOS DE<br>EVALUACIÓN</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td ${ce} rowspan="${Math.max(capacidades.length, 1)}" style="vertical-align:top; font-weight:600">
                            ${esc(p.competencia || 'Resuelve problemas de cantidad')}
                        </td>
                        <td ${ce} style="vertical-align:top">
                            <ul class="session-list">${capacidadesHtml || '<li>Capacidades...</li>'}</ul>
                        </td>
                        <td ${ce} style="vertical-align:top">
                            <ul class="session-list">${criteriosHtml || '<li>Criterios...</li>'}</ul>
                        </td>
                        <td ${ce} rowspan="${Math.max(capacidades.length, 1)}" style="vertical-align:top">
                            ${esc(p.producto_evidencia || 'Desarrollo de actividades de la ficha de actividades.\n\nResolución de la pág. XX del texto escolar Minedu')}
                        </td>
                        <td ${ce} rowspan="${Math.max(capacidades.length, 1)}" style="vertical-align:top">
                            ${esc(p.instrumento || 'Lista de Cotejo')}
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- ════════ COMPETENCIAS TRANSVERSALES ════════ -->
            <table class="content-table ct-table">
                <thead>
                    <tr>
                        <th style="width: 35%">COMPETENCIAS TRANSVERSALES</th>
                        <th>DESEMPEÑOS PRECISADOS<br>PRODUCTO / EVIDENCIA<br>INSTRUMENTOS DE EVALUACIÓN</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="ct-label" ${ce}>Se desenvuelve en los entornos virtuales generados por las TIC</td>
                        <td ${ce}>
                            <ul class="session-list">
                                ${ticItems.map(i => `<li>${esc(i)}</li>`).join('')}
                            </ul>
                        </td>
                    </tr>
                    <tr>
                        <td class="ct-label" ${ce}>Gestiona su aprendizaje de manera autónoma</td>
                        <td ${ce}>
                            <ul class="session-list">
                                ${autonomaItems.map(i => `<li>${esc(i)}</li>`).join('')}
                            </ul>
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- ════════ ENFOQUES TRANSVERSALES ════════ -->
            <table class="content-table enfoques-table">
                <thead>
                    <tr>
                        <th style="width:30%">Enfoque(s) transversal(es)</th>
                        <th style="width:20%">Valores</th>
                        <th>Actitudes o acciones observables</th>
                    </tr>
                </thead>
                <tbody>
                    ${enfoquesRows}
                </tbody>
            </table>

            <!-- ════════ RECURSOS Y MATERIALES ════════ -->
            <table class="content-table recursos-table">
                <tbody>
                    <tr>
                        <td class="label-cell" style="width:35%">Páginas de: Texto de, otros textos de consulta/ Enlace web, etc.</td>
                        <td ${ce}>${escHtml(recursos.paginas_consulta || 'https://www.perueduca.pe/#/home/materiales-educativos')}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Materiales y recursos</td>
                        <td ${ce}>${esc(recursos.materiales || 'Ficha de actividades, Texto de Minedu')}</td>
                    </tr>
                    <tr>
                        <td class="label-cell">Actividades de Refuerzo Escolar (N° ficha y Título)</td>
                        <td ${ce}>${esc(recursos.actividades_refuerzo || '')}</td>
                    </tr>
                </tbody>
            </table>

            <!-- ════════ MOMENTOS DE LA SESIÓN ════════ -->
            <table class="momentos-table">
                <thead>
                    <tr>
                        <th class="momentos-header-left" style="width: 120px">MOMENTOS DE<br>LA SESIÓN</th>
                        <th class="momentos-header-center">ESTRATEGIAS / ACTIVIDADES</th>
                        <th class="momentos-header-eval" style="width: 30px">
                            <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${inicioRowsHtml}
                    ${desarrolloRowsHtml}
                    ${cierreRowsHtml}
                </tbody>
            </table>

            <!-- ════════ FIRMAS ════════ -->
            <div style="margin-top: 40px; display: flex; justify-content: space-between; padding: 0 40px;" class="no-break">
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 200px; margin: 0 auto;"></div>
                    <div style="font-size: 9.5px; margin-top: 4px; font-weight: 700; color: #000;" ${ce} data-key="firma_docente">${esc(m.docente || '')}</div>
                    <div style="font-size: 8.5px; color: #555; font-weight: 600;">Docente de la Sesión</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 200px; margin: 0 auto;"></div>
                    <div style="font-size: 9.5px; margin-top: 4px; font-weight: 700; color: #000;" ${ce} data-key="firma_director">${esc(m.director || '')}</div>
                    <div style="font-size: 8.5px; color: #555; font-weight: 600;">Director(a) / Subdirector(a)</div>
                </div>
            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            ${fichaTrabajoHtml}
        `;
    }

    // ── Build INICIO moment content ──
    function buildMomentoInicio(inicio, ce) {
        if (inicio.saberes_previos || inicio.motivacion || inicio.problematizacion) {
            return `
                <div class="momento-section">
                    ${inicio.motivacion ? `
                    <div class="momento-subsection">
                        <div class="momento-subsection-title">Motivación (5 min)</div>
                        <div>${escHtml(inicio.motivacion)}</div>
                    </div>` : ''}

                    ${inicio.saberes_previos ? `
                    <div class="momento-subsection">
                        <div class="momento-subsection-title">Saberes previos (${inicio.saberes_tiempo || '8 min'})</div>
                        <div>${escHtml(inicio.saberes_previos)}</div>
                    </div>` : ''}

                    ${inicio.problematizacion ? `
                    <div class="momento-subsection">
                        <div class="momento-subsection-title">Problematización (${inicio.problematizacion_tiempo || '5 min'})</div>
                        <div>${escHtml(inicio.problematizacion)}</div>
                    </div>` : ''}

                    ${inicio.proposito_organizacion ? `
                    <div class="momento-subsection">
                        <div class="momento-subsection-title">Propósito y organización (${inicio.proposito_tiempo || '5 min'})</div>
                        <div>${escHtml(inicio.proposito_organizacion)}</div>
                    </div>` : ''}
                </div>`;
        }

        // Fallback: old format with single 'actividades' field
        return `<div class="momento-section">${escHtml(inicio.actividades || '• El docente empieza la sesión saludando muy cordialmente a los estudiantes.\n• Se consensuan los acuerdos de convivencia para la interacción en clases.\n• Motivación: actividad inicial.\n• Saberes previos: preguntas exploratorias.\n• Problematización: situación significativa.\n• Propósito y organización: comunicar el propósito de la sesión y los criterios de evaluación.')}</div>`;
    }

    // ── Build DESARROLLO moment content ──
    function buildMomentoDesarrollo(desarrollo, ce) {
        if (!desarrollo || typeof desarrollo !== 'object') {
            return `<div class="momento-section">No hay actividades de desarrollo registradas.</div>`;
        }

        // Fallback: old format with single 'actividades' field
        if (typeof desarrollo.actividades === 'string' && desarrollo.actividades.length > 0) {
            return `
                <div class="momento-section">
                    <div class="momento-subsection">
                        <div class="momento-subsection-title" style="color:#c0392b; font-weight:700; text-decoration:underline; text-transform:uppercase;">
                            GESTIÓN Y ACOMPAÑAMIENTO DEL DESARROLLO DE COMPETENCIAS
                        </div>
                    </div>
                    <div class="momento-subsection">
                        <div class="momento-subsection-title">PROCESOS DIDÁCTICOS</div>
                        <div>${escHtml(desarrollo.actividades)}</div>
                    </div>
                </div>`;
        }

        // Dynamically find and sort keys starting with 'proceso_' or 'paso_'
        const keys = Object.keys(desarrollo)
            .filter(k => k.startsWith('proceso_') || k.startsWith('paso_'))
            .sort((a, b) => {
                const numA = parseInt(a.replace(/^\D+/g, ''), 10) || 0;
                const numB = parseInt(b.replace(/^\D+/g, ''), 10) || 0;
                return numA - numB;
            });

        if (keys.length > 0) {
            const mappings = {
                // Matemática (Polya)
                'familiarizacion': 'Familiarización con el problema',
                'busqueda_estrategias': 'Búsqueda y ejecución de estrategias',
                'socializacion': 'Socialización de representaciones',
                'formalizacion_reflexion': 'Reflexión y Formalización',
                
                // Ciclo ERCA
                'experiencia': 'Experiencia',
                'reflexion': 'Reflexión',
                'conceptualizacion': 'Conceptualización',
                'aplicacion': 'Aplicación',
                
                // ABP
                'lanzamiento': 'Lanzamiento / Desafío',
                'indagacion': 'Indagación / Investigación',
                'desarrollo_producto': 'Desarrollo del Producto',
                'difusion_evaluacion': 'Difusión y Evaluación',
                
                // Flipped Classroom
                'conexion_externa': 'Conexión de saberes externos',
                'aplicacion_guiada': 'Aplicación guiada / Taller activo',
                'consolidacion_retroalimentacion': 'Consolidación y retroalimentación interactiva',
                
                // Indagación STEAM
                'problematizacion': 'Problematización de situaciones',
                'diseno_estrategias': 'Diseño de estrategias para hacer indagación',
                'generacion_analisis_datos': 'Generación, registro y análisis de datos',
                'estructuracion_comunicacion': 'Estructuración del saber construido y comunicación',
                
                // Cooperativo
                'organizacion_roles': 'Organización de equipos y roles',
                'interdependencia_positiva': 'Interdependencia positiva',
                'interaccion_promotora': 'Interacción promotora',
                'autoevaluacion_grupal': 'Autoevaluación grupal'
            };

            let html = `
                <div class="momento-section">
                    <div class="momento-subsection">
                        <div class="momento-subsection-title" style="color:#c0392b; font-weight:700; text-decoration:underline; text-transform:uppercase;">
                            GESTIÓN Y ACOMPAÑAMIENTO DEL DESARROLLO DE COMPETENCIAS
                        </div>
                    </div>`;

            keys.forEach(key => {
                const value = desarrollo[key];
                if (!value) return;

                // Extract base key without prefix like 'proceso_1_' or 'paso_1_'
                const cleanKey = key.replace(/^(proceso|paso)_\d+_/, '');
                
                // Get title from mappings or fallback
                let title = mappings[cleanKey];
                if (!title) {
                    title = cleanKey
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase());
                }

                html += `
                    <div class="momento-subsection">
                        <div class="momento-subsection-title">${esc(title)}</div>
                        <div>${escHtml(value)}</div>
                    </div>`;
            });

            html += `</div>`;
            return html;
        }

        // Fallback for default empty state
        return `
            <div class="momento-section">
                <div class="momento-subsection">
                    <div class="momento-subsection-title" style="color:#c0392b; font-weight:700; text-decoration:underline; text-transform:uppercase;">
                        GESTIÓN Y ACOMPAÑAMIENTO DEL DESARROLLO DE COMPETENCIAS
                    </div>
                </div>
                <div class="momento-subsection">
                    <div class="momento-subsection-title">PROCESOS DIDÁCTICOS</div>
                    <div>
                        • Presentación de la situación significativa.<br>
                        • Familiarización con el problema: lectura y comprensión.<br>
                        • Búsqueda y ejecución de estrategias.<br>
                        • Resolución del reto propuesto.<br>
                        • Socialización de resultados.<br>
                        • Formalización: el docente sistematiza los aprendizajes.<br>
                        • Reflexión: ¿qué procesos seguimos? ¿qué dificultades tuvimos?<br>
                        • Transferencia: aplicación a nuevas situaciones.
                    </div>
                </div>
            </div>`;
    }

    // ── Build CIERRE moment content ──
    function buildMomentoCierre(cierre, ce) {
        if (typeof cierre.actividades === 'string' && cierre.actividades.length > 0) {
            return `<div class="momento-section">${escHtml(cierre.actividades)}</div>`;
        }

        return `
            <div class="momento-section">
                • <strong>Metacognición:</strong> ¿Qué aprendimos hoy? ¿Cómo lo aprendimos? ¿Para qué nos sirve?<br>
                • <strong>Evaluación formativa:</strong> revisión de los criterios de evaluación.<br>
                • <strong>Extensión para casa:</strong> actividad de refuerzo.
            </div>`;
    }


    // ═══════════════════════════════════════
    // SESIÓN DE LABORATORIO
    // ═══════════════════════════════════════

    function renderLaboratorio(m, p, momentos, evalData, ce) {
        return `
            <table class="session-header-table">
                <tr>
                    <td class="logo-cell" rowspan="3">
                        <div ${ce} style="font-size:24px; text-align:center;">🔬</div>
                    </td>
                    <td class="label-cell">Institución Educativa</td>
                    <td class="value-cell" ${ce}>${esc(m.institucion || '')}</td>
                    <td class="label-cell">Fecha</td>
                    <td class="value-cell" ${ce}>${esc(m.fecha || '')}</td>
                </tr>
                <tr>
                    <td class="label-cell">Docente</td>
                    <td class="value-cell" ${ce}>${esc(m.docente || '')}</td>
                    <td class="label-cell">Grado / Sección</td>
                    <td class="value-cell" ${ce}>${esc(m.grado || '')} "${esc(m.seccion || '')}"</td>
                </tr>
                <tr>
                    <td class="label-cell">Área</td>
                    <td class="value-cell" ${ce}>${esc(m.area || 'Ciencia y Tecnología')}</td>
                    <td class="label-cell">Duración</td>
                    <td class="value-cell" ${ce}>${esc(m.duracion || '90 min')}</td>
                </tr>
            </table>

            <div class="session-title-bar" style="background: linear-gradient(135deg, #065f46, #059669);">
                🔬 <span ${ce}>${esc(m.titulo || 'SESIÓN DE LABORATORIO')}</span>
            </div>

            <div class="section-title" style="border-left-color: #059669;">I. Propósito de Aprendizaje</div>
            <table class="content-table">
                <tr><th>Competencia</th><td ${ce}>${esc(p.competencia || '')}</td></tr>
                <tr><th>Capacidad</th><td ${ce}>${esc(p.capacidad || '')}</td></tr>
                <tr><th>Desempeño</th><td ${ce}>${esc(p.desempeno || '')}</td></tr>
            </table>

            <div class="section-title" style="border-left-color: #059669;">II. Materiales de Laboratorio</div>
            <table class="content-table">
                <thead>
                    <tr>
                        <th>Material / Equipo</th>
                        <th>Cantidad</th>
                        <th>Observaciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td ${ce}>${esc(momentos.materiales?.items || 'Microscopio, tubos de ensayo...')}</td>
                        <td ${ce}>${esc(momentos.materiales?.cantidad || '')}</td>
                        <td ${ce}>${esc(momentos.materiales?.observaciones || '')}</td>
                    </tr>
                </tbody>
            </table>

            <div class="section-title" style="border-left-color: #059669;">III. Procedimiento Experimental</div>
            <table class="content-table">
                <thead>
                    <tr>
                        <th style="width:80px">Fase</th>
                        <th>Actividades</th>
                        <th style="width:60px">Tiempo</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="moment-label" style="background:#ecfdf5;">HIPÓTESIS</td>
                        <td ${ce}>${esc(momentos.inicio?.actividades || '• Planteamiento del problema.\n• Formulación de hipótesis.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.inicio?.tiempo || momentos.inicio?.tiempo_total || '15 min')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label" style="background:#ecfdf5;">EXPERIMENTACIÓN</td>
                        <td ${ce}>${escHtml(compileDesarrolloText(momentos.desarrollo) || '• Ejecución del experimento.\n• Registro de datos y observaciones.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.desarrollo?.tiempo || momentos.desarrollo?.tiempo_total || '50 min')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label" style="background:#ecfdf5;">RESULTADOS</td>
                        <td ${ce}>${esc(momentos.cierre?.actividades || '• Análisis de resultados.\n• Conclusiones y validación de hipótesis.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.cierre?.tiempo || momentos.cierre?.tiempo_total || '25 min')}</td>
                    </tr>
                </tbody>
            </table>

            <div class="section-title" style="border-left-color: #059669;">IV. Evaluación</div>
            <table class="eval-table">
                <thead>
                    <tr><th>Criterio</th><th>Evidencia</th><th>Instrumento</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td ${ce}>${esc(evalData.criterio || '')}</td>
                        <td ${ce}>${esc(evalData.evidencia || 'Informe de laboratorio')}</td>
                        <td ${ce}>${esc(evalData.instrumento || 'Rúbrica')}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 35px; display: flex; justify-content: space-between; padding: 0 40px;" class="no-break">
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 180px; margin: 0 auto;"></div>
                    <div style="font-size: 9.5px; margin-top: 4px; font-weight: 700; color: #000;" ${ce} data-key="firma_docente">${esc(m.docente || '')}</div>
                    <div style="font-size: 8.5px; color: #555; font-weight: 600;">Firma del Docente</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 180px; margin: 0 auto;"></div>
                    <div style="font-size: 9.5px; margin-top: 4px; font-weight: 700; color: #000;" ${ce} data-key="firma_director">${esc(m.director || '')}</div>
                    <div style="font-size: 8.5px; color: #555; font-weight: 600;">V°B° Director(a)</div>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════
    // SESIÓN DE REFUERZO
    // ═══════════════════════════════════════

    function renderRefuerzo(m, p, momentos, evalData, ce) {
        return `
            <table class="session-header-table">
                <tr>
                    <td class="logo-cell" rowspan="3">
                        <div ${ce} style="font-size:24px; text-align:center;">📚</div>
                    </td>
                    <td class="label-cell">Institución Educativa</td>
                    <td class="value-cell" ${ce}>${esc(m.institucion || '')}</td>
                    <td class="label-cell">Fecha</td>
                    <td class="value-cell" ${ce}>${esc(m.fecha || '')}</td>
                </tr>
                <tr>
                    <td class="label-cell">Docente</td>
                    <td class="value-cell" ${ce}>${esc(m.docente || '')}</td>
                    <td class="label-cell">Grado / Sección</td>
                    <td class="value-cell" ${ce}>${esc(m.grado || '')} "${esc(m.seccion || '')}"</td>
                </tr>
                <tr>
                    <td class="label-cell">Área</td>
                    <td class="value-cell" ${ce}>${esc(m.area || '')}</td>
                    <td class="label-cell">Duración</td>
                    <td class="value-cell" ${ce}>${esc(m.duracion || '45 min')}</td>
                </tr>
            </table>

            <div class="session-title-bar" style="background: linear-gradient(135deg, #92400e, #d97706);">
                📚 <span ${ce}>${esc(m.titulo || 'SESIÓN DE REFUERZO ESCOLAR')}</span>
            </div>

            <div class="section-title" style="border-left-color: #d97706;">I. Diagnóstico</div>
            <table class="content-table">
                <thead>
                    <tr>
                        <th style="width:50%">Dificultades Identificadas</th>
                        <th style="width:50%">Nivel Actual del Estudiante</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td ${ce}>${esc(momentos.diagnostico?.dificultades || 'Describir las dificultades detectadas...')}</td>
                        <td ${ce}>${esc(momentos.diagnostico?.nivel || 'En inicio / En proceso / Logrado')}</td>
                    </tr>
                </tbody>
            </table>

            <div class="section-title" style="border-left-color: #d97706;">II. Propósito del Refuerzo</div>
            <table class="content-table">
                <tr><th style="width:30%">Competencia</th><td ${ce}>${esc(p.competencia || '')}</td></tr>
                <tr><th>Desempeño a reforzar</th><td ${ce}>${esc(p.desempeno || '')}</td></tr>
                <tr><th>Meta de aprendizaje</th><td ${ce}>${esc(p.meta || 'Al finalizar la sesión, el estudiante podrá...')}</td></tr>
            </table>

            <div class="section-title" style="border-left-color: #d97706;">III. Actividades de Refuerzo</div>
            <table class="content-table">
                <thead>
                    <tr>
                        <th style="width:80px">Momento</th>
                        <th>Estrategias de Refuerzo</th>
                        <th style="width:60px">Tiempo</th>
                        <th style="width:120px">Recursos</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="moment-label" style="background:#fef3c7;">REPASO</td>
                        <td ${ce}>${esc(momentos.inicio?.actividades || '• Retroalimentación del tema anterior.\n• Aclarar dudas previas.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.inicio?.tiempo || momentos.inicio?.tiempo_total || '10 min')}</td>
                        <td class="resources-cell" ${ce}>${esc(momentos.inicio?.recursos || '')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label" style="background:#fef3c7;">PRÁCTICA</td>
                        <td ${ce}>${escHtml(compileDesarrolloText(momentos.desarrollo) || '• Ejercicios diferenciados por nivel.\n• Trabajo guiado con acompañamiento.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.desarrollo?.tiempo || momentos.desarrollo?.tiempo_total || '25 min')}</td>
                        <td class="resources-cell" ${ce}>${esc(momentos.desarrollo?.recursos || '')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label" style="background:#fef3c7;">AVANCE</td>
                        <td ${ce}>${esc(momentos.cierre?.actividades || '• Verificar avance respecto al diagnóstico.\n• Compromiso para la siguiente sesión.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.cierre?.tiempo || momentos.cierre?.tiempo_total || '10 min')}</td>
                        <td class="resources-cell" ${ce}>${esc(momentos.cierre?.recursos || '')}</td>
                    </tr>
                </tbody>
            </table>

            <div class="section-title" style="border-left-color: #d97706;">IV. Seguimiento</div>
            <table class="eval-table">
                <thead>
                    <tr>
                        <th>¿Superó la dificultad?</th>
                        <th>Nuevo nivel</th>
                        <th>Acciones de seguimiento</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td ${ce}>${esc(evalData.superado || 'Sí / Parcialmente / No')}</td>
                        <td ${ce}>${esc(evalData.nuevoNivel || '')}</td>
                        <td ${ce}>${esc(evalData.seguimiento || '')}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 35px; display: flex; justify-content: space-between; padding: 0 40px;" class="no-break">
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 180px; margin: 0 auto;"></div>
                    <div style="font-size: 9.5px; margin-top: 4px; font-weight: 700; color: #000;" ${ce} data-key="firma_docente">${esc(m.docente || '')}</div>
                    <div style="font-size: 8.5px; color: #555; font-weight: 600;">Firma del Docente</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 180px; margin: 0 auto;"></div>
                    <div style="font-size: 9.5px; margin-top: 4px; font-weight: 700; color: #000;" ${ce} data-key="firma_director">${esc(m.director || '')}</div>
                    <div style="font-size: 8.5px; color: #555; font-weight: 600;">V°B° Director(a)</div>
                </div>
            </div>
        `;
    }

    // ─── HELPER: Render the dynamic logos list for the official header ───
    // ─── HELPER: Render the dynamic logos list for the official header ───
    function buildLogosListHtml(m, ce) {
        let logos = m.logos;
        if (!logos || !Array.isArray(logos) || logos.length === 0) {
            // Fallback for backward compatibility
            logos = [
                {
                    id: 'header-logo-left',
                    url: m.logo_left_url || 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Escudo_Nacional_del_Per%C3%BA.svg/130px-Escudo_Nacional_del_Per%C3%BA.svg.png',
                    style: m.logo_left_style || 'cursor: pointer; max-height: 48px; width: auto;'
                },
                {
                    id: 'header-logo-regional',
                    url: m.logo_regional_url || 'https://sesiones.sypablitodp.site/assets/logo.png',
                    style: m.logo_regional_style || 'cursor: pointer; max-height: 48px; width: auto;'
                }
            ];
        }

        let html = '';

        // Columna Izquierda: Primer Logo
        const leftLogo = logos[0] || {
            id: 'header-logo-left',
            url: m.logo_left_url || 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Escudo_Nacional_del_Per%C3%BA.svg/130px-Escudo_Nacional_del_Per%C3%BA.svg.png',
            style: m.logo_left_style || 'cursor: pointer; max-height: 48px; width: auto;'
        };
        html += `
            <div class="official-logo-item" draggable="true">
                <img id="${leftLogo.id}" src="${leftLogo.url}" class="official-logo-img" onerror="this.src='assets/logo.png'; this.onerror=function(){this.style.display='none';};" style="${leftLogo.style || 'cursor: pointer; max-height: 48px; width: auto;'}" title="Haz clic para editar" draggable="false">
                <button type="button" class="btn-remove-logo no-print" title="Eliminar logo" onclick="this.parentElement.remove(); window.dispatchEvent(new CustomEvent('logo-removed'));">✕</button>
            </div>
        `;

        // Columna Central: Textos Oficiales (MINEDU, DRE, UGEL, AGP)
        html += `
            <div class="official-header-text-block">
                <div class="header-text-minedu">MINISTERIO DE EDUCACIÓN</div>
                <div class="header-text-dre" ${ce} data-key="dre">${esc(m.dre || 'DIRECCIÓN REGIONAL DE EDUCACIÓN UCAYALI')}</div>
                <div class="header-text-ugel" ${ce} data-key="ugel">${esc(m.ugel || 'UNIDAD DE GESTIÓN EDUCATIVA LOCAL PADRE ABAD')}</div>
                <div class="header-text-agp">ÁREA DE GESTIÓN PEDAGÓGICA</div>
            </div>
        `;

        // Columna Derecha: Segundo Logo (Regional)
        const rightLogo = logos[1] || {
            id: 'header-logo-regional',
            url: m.logo_regional_url || 'https://sesiones.sypablitodp.site/assets/logo.png',
            style: m.logo_regional_style || 'cursor: pointer; max-height: 48px; width: auto;'
        };
        html += `
            <div class="official-logo-item" draggable="true">
                <img id="${rightLogo.id}" src="${rightLogo.url}" class="official-logo-img" onerror="this.src='assets/logo.png'; this.onerror=function(){this.style.display='none';};" style="${rightLogo.style || 'cursor: pointer; max-height: 48px; width: auto;'}" title="Haz clic para editar" draggable="false">
                <button type="button" class="btn-remove-logo no-print" title="Eliminar logo" onclick="this.parentElement.remove(); window.dispatchEvent(new CustomEvent('logo-removed'));">✕</button>
            </div>
        `;

        // Otros logos (si existieran más de 2)
        for (let i = 2; i < logos.length; i++) {
            const logo = logos[i];
            html += `
                <div class="official-logo-item" draggable="true">
                    <img id="${logo.id}" src="${logo.url}" class="official-logo-img" onerror="this.src='assets/logo.png'; this.onerror=function(){this.style.display='none';};" style="${logo.style || 'cursor: pointer; max-height: 48px; width: auto;'}" title="Haz clic para editar" draggable="false">
                    <button type="button" class="btn-remove-logo no-print" title="Eliminar logo" onclick="this.parentElement.remove(); window.dispatchEvent(new CustomEvent('logo-removed'));">✕</button>
                </div>
            `;
        }

        // Placeholder para añadir logos
        html += `
            <div class="add-logo-placeholder no-print" id="btn-add-header-logo" title="Añadir logo">
                <span>➕</span>
            </div>
        `;
        return html;
    }


    // ─── HELPER: Escape HTML + preserve newlines ───
    function esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/\n/g, '<br>');
    }

    // ─── HELPER: Allow HTML through (for AI-generated rich content) ───
    function escHtml(str) {
        if (!str) return '';
        // Only allow rendering if it contains real HTML tag elements we use
        const containsRealHtml = /<\/?(strong|b|em|i|u|ul|ol|li|p|br)\b/i.test(str);
        if (containsRealHtml) {
            return str;
        }
        // Otherwise treat as plain text with newlines
        return esc(str);
    }

    // ─── HELPER: Compile decomposed development keys into HTML for non-standard templates ───
    function compileDesarrolloText(desarrollo) {
        if (!desarrollo || typeof desarrollo !== 'object') return '';
        if (typeof desarrollo.actividades === 'string') return desarrollo.actividades;

        const keys = Object.keys(desarrollo)
            .filter(k => k.startsWith('proceso_') || k.startsWith('paso_'))
            .sort((a, b) => {
                const numA = parseInt(a.replace(/^\D+/g, ''), 10) || 0;
                const numB = parseInt(b.replace(/^\D+/g, ''), 10) || 0;
                return numA - numB;
            });

        if (keys.length === 0) return '';

        const mappings = {
            'familiarizacion': 'Familiarización con el problema',
            'busqueda_estrategias': 'Búsqueda y ejecución de estrategias',
            'socializacion': 'Socialización de representaciones',
            'formalizacion_reflexion': 'Reflexión y Formalización',
            'experiencia': 'Experiencia',
            'reflexion': 'Reflexión',
            'conceptualizacion': 'Conceptualización',
            'aplicacion': 'Aplicación',
            'lanzamiento': 'Lanzamiento / Desafío',
            'indagacion': 'Indagación / Investigación',
            'desarrollo_producto': 'Desarrollo del Producto',
            'difusion_evaluacion': 'Difusión y Evaluación',
            'conexion_externa': 'Conexión de saberes externos',
            'aplicacion_guiada': 'Aplicación guiada / Taller activo',
            'consolidacion_retroalimentacion': 'Consolidación y retroalimentación interactiva',
            'problematizacion': 'Problematización de situaciones',
            'diseno_estrategias': 'Diseño de estrategias para hacer indagación',
            'generacion_analisis_datos': 'Generación, registro y análisis de datos',
            'estructuracion_comunicacion': 'Estructuración del saber construido y comunicación',
            'organizacion_roles': 'Organización de equipos y roles',
            'interdependencia_positiva': 'Interdependencia positiva',
            'interaccion_promotora': 'Interacción promotora',
            'autoevaluacion_grupal': 'Autoevaluación grupal'
        };

        return keys.map(key => {
            const cleanKey = key.replace(/^(proceso|paso)_\d+_/, '');
            let title = mappings[cleanKey] || cleanKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return `<strong>${title}:</strong><br>${desarrollo[key]}`;
        }).join('<br><br>');
    }

    function renderInicial(m, p, momentos, evalData, ct, enfoques, recursos, juegoLibre, fichaTrabajo, ce) {
        // 1. Build enfoques rows
        let enfoquesRows = '';
        enfoques.forEach(enf => {
            enfoquesRows += `
                <tr>
                    <td class="label-cell" ${ce}>${esc(enf.nombre || 'Enfoque Transversal')}</td>
                    <td class="value-cell" ${ce}>${esc(enf.valor || '')}</td>
                    <td class="value-cell" ${ce} colspan="4">${esc(enf.actitudes || '')}</td>
                </tr>`;
        });
        if (!enfoquesRows) {
            enfoquesRows = `
                <tr>
                    <td class="label-cell" ${ce}>Enfoque de Derechos</td>
                    <td class="value-cell" ${ce}>Conciencia de derechos</td>
                    <td class="value-cell" ${ce} colspan="4">Los estudiantes participan activamente en las asambleas de aula.</td>
                </tr>`;
        }

        // 2. Build capacidades list
        let capacidadesListHtml = '';
        const caps = p.capacidades || [];
        caps.forEach(cap => {
            capacidadesListHtml += `<li ${ce}>${esc(cap)}</li>`;
        });

        // 3. Build criterios list
        let criteriosHtml = '';
        const criterios = p.criterios_evaluacion || [];
        criterios.forEach(crit => {
            criteriosHtml += `<li ${ce}>${esc(crit)}</li>`;
        });

        // 4. Build Inicio Moments (stacked in single row)
        let inicioRowsHtml = '';
        const inicio = momentos.inicio || {};
        const subMomentsInicio = [];
        if (inicio.motivacion) subMomentsInicio.push({ title: 'Motivación', content: inicio.motivacion });
        if (inicio.saberes_previos) subMomentsInicio.push({ title: 'Saberes Previos', content: inicio.saberes_previos });
        if (inicio.problematizacion) subMomentsInicio.push({ title: 'Problematización', content: inicio.problematizacion });
        if (inicio.proposito_organizacion) subMomentsInicio.push({ title: 'Propósito y Organización', content: inicio.proposito_organizacion });

        if (subMomentsInicio.length > 0) {
            const contentHtml = subMomentsInicio.map(sm => `
                <div class="momento-subsection" style="margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid;">
                    <div class="momento-subsection-title">${esc(sm.title)}</div>
                    <div>${escHtml(sm.content)}</div>
                </div>
            `).join('');

            inicioRowsHtml = `
                <tr>
                    <td class="momento-label-cell">
                        <div class="momento-name">INICIO:</div>
                        <div class="momento-sublabels">
                            <span>• Motivación / Asamblea</span>
                            <span>• Saberes Previos</span>
                            <span>• Problematización</span>
                            <span>• Propósito y acuerdos</span>
                        </div>
                        <div class="momento-time">TIEMPO: ${esc(inicio.tiempo_total || '15 min')}</div>
                    </td>
                    <td class="momento-content-cell" ${ce}>
                        <div class="momento-section">
                            ${contentHtml}
                        </div>
                    </td>
                    <td class="eval-column-cell">
                        <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                    </td>
                </tr>`;
        } else {
            const defaultText = inicio.actividades || '• Motivación lúdica con títeres/canciones.\n• Asamblea inicial y acuerdos de convivencia.\n• Planteamiento del reto y propósito de la sesión.';
            inicioRowsHtml = `
                <tr>
                    <td class="momento-label-cell">
                        <div class="momento-name">INICIO:</div>
                        <div class="momento-sublabels">
                            <span>• Motivación / Asamblea</span>
                            <span>• Saberes Previos</span>
                            <span>• Problematización</span>
                            <span>• Propósito y acuerdos</span>
                        </div>
                        <div class="momento-time">TIEMPO: ${esc(inicio.tiempo_total || '15 min')}</div>
                    </td>
                    <td class="momento-content-cell" ${ce}>
                        <div class="momento-section">
                            <div>${escHtml(defaultText)}</div>
                        </div>
                    </td>
                    <td class="eval-column-cell">
                        <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                    </td>
                </tr>`;
        }

        // 5. Build Desarrollo Moments (stacked in single row)
        let desarrolloRowsHtml = '';
        const desarrollo = momentos.desarrollo || {};
        const desarrolloKeys = Object.keys(desarrollo)
            .filter(k => k.startsWith('proceso_') || k.startsWith('paso_'))
            .sort((a, b) => {
                const numA = parseInt(a.replace(/^\D+/g, ''), 10) || 0;
                const numB = parseInt(b.replace(/^\D+/g, ''), 10) || 0;
                return numA - numB;
            });

        const mappings = {
            'familiarizacion': 'Familiarización con el problema',
            'busqueda_estrategias': 'Búsqueda y ejecución de estrategias',
            'socializacion': 'Socialización de representaciones',
            'formalizacion_reflexion': 'Reflexión y Formalización',
            'experiencia': 'Experiencia',
            'reflexion': 'Reflexión',
            'conceptualizacion': 'Conceptualización',
            'aplicacion': 'Aplicación',
            'lanzamiento': 'Lanzamiento / Desafío',
            'indagacion': 'Indagación / Investigación',
            'desarrollo_producto': 'Desarrollo del Producto',
            'difusion_evaluacion': 'Difusión y Evaluación',
            'conexion_externa': 'Conexión de saberes externos',
            'aplicacion_guiada': 'Aplicación guiada / Taller activo',
            'consolidacion_retroalimentacion': 'Consolidación y retroalimentación interactiva',
            'problematizacion': 'Problematización de situaciones',
            'diseno_estrategias': 'Diseño de estrategias para hacer indagación',
            'generacion_analisis_datos': 'Generación, registro y análisis de datos',
            'estructuracion_comunicacion': 'Estructuración del saber construido y comunicación',
            'organizacion_roles': 'Organización de equipos y roles',
            'interdependencia_positiva': 'Interdependencia positiva',
            'interaccion_promotora': 'Interacción promotora',
            'autoevaluacion_grupal': 'Autoevaluación grupal'
        };

        if (desarrolloKeys.length > 0) {
            const contentHtml = desarrolloKeys.map(key => {
                const value = desarrollo[key];
                if (!value) return '';
                const cleanKey = key.replace(/^(proceso|paso)_\d+_/, '');
                let title = mappings[cleanKey] || cleanKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return `
                    <div class="momento-subsection" style="margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid;">
                        <div class="momento-subsection-title">${esc(title)}</div>
                        <div>${escHtml(value)}</div>
                    </div>
                `;
            }).join('');

            desarrolloRowsHtml = `
                <tr>
                    <td class="momento-label-cell">
                        <div class="momento-name">DESARROLLO:</div>
                        <div class="momento-sublabels">
                            <span>Gestión del Acompañamiento en el Desarrollo de Competencias</span>
                            <span>(Vivenciación, manipulación concreta, representación gráfica/plástica y verbalización)</span>
                        </div>
                        <div class="momento-time">TIEMPO: ${esc(desarrollo.tiempo_total || '20 min')}</div>
                    </td>
                    <td class="momento-content-cell" ${ce}>
                        <div class="momento-section">
                            <div class="momento-subsection" style="page-break-inside: avoid; break-inside: avoid;">
                                <div class="momento-subsection-title" style="color:#c0392b; font-weight:700; text-decoration:underline; text-transform:uppercase; margin-bottom:8px;">
                                    GESTIÓN Y ACOMPAÑAMIENTO (PROCESOS DIDÁCTICOS VIVENCIALES)
                                </div>
                            </div>
                            ${contentHtml}
                        </div>
                    </td>
                    <td class="eval-column-cell">
                        <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                    </td>
                </tr>`;
        } else {
            const defaultText = desarrollo.actividades || '• Planteamiento de la situación o juego.\n• Manipulación de material didáctico/concreto.\n• Representación plástica (modelado o dibujo).\n• Socialización de sus creaciones y verbalización.';
            desarrolloRowsHtml = `
                <tr>
                    <td class="momento-label-cell">
                        <div class="momento-name">DESARROLLO:</div>
                        <div class="momento-sublabels">
                            <span>Gestión del Acompañamiento en el Desarrollo de Competencias</span>
                            <span>(Vivenciación, manipulación concreta, representación gráfica/plástica y verbalización)</span>
                        </div>
                        <div class="momento-time">TIEMPO: ${esc(desarrollo.tiempo_total || '20 min')}</div>
                    </td>
                    <td class="momento-content-cell" ${ce}>
                        <div class="momento-section">
                            <div class="momento-subsection">
                                <div class="momento-subsection-title" style="color:#c0392b; font-weight:700; text-decoration:underline; text-transform:uppercase; margin-bottom:8px;">
                                    GESTIÓN Y ACOMPAÑAMIENTO (PROCESOS DIDÁCTICOS VIVENCIALES)
                                </div>
                            </div>
                            <div>${escHtml(defaultText)}</div>
                        </div>
                    </td>
                    <td class="eval-column-cell">
                        <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                    </td>
                </tr>`;
        }

        // 6. Build Cierre Moments
        const cierre = momentos.cierre || {};
        const defaultCierre = cierre.actividades || '• <strong>Asamblea de Metacognición:</strong> ¿A qué jugamos hoy? ¿Qué descubrimos? ¿Qué materiales usamos? ¿Cómo nos sentimos?<br>• <strong>Evaluación formativa:</strong> Felicitación colectiva por el trabajo y orden del aula.';
        const cierreRowsHtml = `
            <tr>
                <td class="momento-label-cell">
                    <div class="momento-name">CIERRE:</div>
                    <div class="momento-sublabels">
                        <span>• Asamblea Final</span>
                        <span>• Metacognición</span>
                        <span>• Felicitación</span>
                    </div>
                    <div class="momento-time">TIEMPO: ${esc(cierre.tiempo_total || '10 min')}</div>
                </td>
                <td class="momento-content-cell" ${ce}>
                    <div class="momento-section">${escHtml(defaultCierre)}</div>
                </td>
                <td class="eval-column-cell">
                    <div class="eval-vertical-text">E V A L U A C I Ó N</div>
                </td>
            </tr>`;

        // 7. Build Juego Libre Sectores Section
        let juegoLibreHtml = '';
        const jl = juegoLibre || {};
        
        const jlPlan = jl.planificacion || 'Los niños dialogan en asamblea sobre el sector donde desean jugar y eligen libremente.';
        const jlOrg = jl.organizacion || 'Se distribuyen en grupos de 4 o 5 niños para cada sector y seleccionan los materiales.';
        const jlEj = jl.ejecucion || 'Los niños juegan libremente en los sectores de su elección mientras la docente observa y media.';
        const jlOrd = jl.orden || 'A través de la canción de orden, guardan los juguetes y limpian el espacio.';
        const jlSoc = jl.socializacion || 'En asamblea, comentan qué hicieron en los sectores, con quién jugaron y qué les gustó.';
        const jlRep = jl.representacion || 'Los niños dibujan o modelan libremente con plastilina lo que hicieron durante el juego.';

        juegoLibreHtml = `
            <div class="html2pdf__page-break" style="break-before: page; margin-top: 30px;"></div>
            <div class="session-title-bar-official" style="margin-top: 20px;">
                <span>ANEXO: PLANIFICACIÓN DE JUEGO LIBRE EN LOS SECTORES</span>
            </div>
            <table class="session-header-table content-table" style="margin-top: 10px;">
                <thead>
                    <tr>
                        <th style="width: 150px; text-align: left;">MOMENTO</th>
                        <th style="text-align: left;">ACTIVIDADES / ESTRATEGIAS PEDAGÓGICAS</th>
                        <th style="width: 180px; text-align: left;">RECURSOS</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="label-cell" style="font-weight: 700;">Planificación</td>
                        <td ${ce}>${escHtml(jlPlan)}</td>
                        <td ${ce}>Carteles de sectores, normas.</td>
                    </tr>
                    <tr>
                        <td class="label-cell" style="font-weight: 700;">Organización</td>
                        <td ${ce}>${escHtml(jlOrg)}</td>
                        <td ${ce}>Identificadores o distintivos.</td>
                    </tr>
                    <tr>
                        <td class="label-cell" style="font-weight: 700;">Ejecución o Desarrollo</td>
                        <td ${ce}>${escHtml(jlEj)}</td>
                        <td ${ce}>Juguetes y materiales de sectores.</td>
                    </tr>
                    <tr>
                        <td class="label-cell" style="font-weight: 700;">Orden</td>
                        <td ${ce}>${escHtml(jlOrd)}</td>
                        <td ${ce}>Cajas de guardado, organizadores.</td>
                    </tr>
                    <tr>
                        <td class="label-cell" style="font-weight: 700;">Socialización</td>
                        <td ${ce}>${escHtml(jlSoc)}</td>
                        <td ${ce}>Asamblea, círculo de conversación.</td>
                    </tr>
                    <tr>
                        <td class="label-cell" style="font-weight: 700;">Representación</td>
                        <td ${ce}>${escHtml(jlRep)}</td>
                        <td ${ce}>Hojas de papel, plastilinas, colores.</td>
                    </tr>
                </tbody>
            </table>`;

        // 8. Build Ficha de Trabajo Section
        let fichaTrabajoHtml = '';
        if (fichaTrabajo && typeof fichaTrabajo === 'object') {
            const ft = fichaTrabajo;
            fichaTrabajoHtml = `
                <div class="html2pdf__page-break" style="break-before: page; margin-top: 30px;"></div>
                <div class="session-title-bar-official" style="margin-top: 20px; background: #2980b9 !important; color:#fff !important;">
                    <span>FICHA DE TRABAJO INDEPENDIENTE PARA EL ESTUDIANTE</span>
                </div>
                <div class="ficha-estudiante-container" style="border: 2px dashed #3498db; padding: 25px; border-radius: 12px; margin-top: 15px; background: #ffffff;">
                    <table style="width: 100%; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px;">
                        <tr>
                            <td style="font-size: 14px; font-weight: 700; color: #2c3e50; border:none !important; background:transparent !important; padding:0 !important;">
                                Nombre: __________________________________________________
                            </td>
                            <td style="font-size: 14px; font-weight: 700; color: #2c3e50; text-align: right; border:none !important; background:transparent !important; padding:0 !important; width: 120px;">
                                Edad: ______ años
                            </td>
                        </tr>
                    </table>
                    
                    <div style="font-size: 16px; font-weight: 800; color: #2980b9; margin-bottom: 8px; text-transform: uppercase;" ${ce}>
                        🎨 Actividad: ${esc(ft.titulo || 'Mi Ficha Práctica')}
                    </div>
                    <div style="font-size: 11px; font-style: italic; color: #7f8c8d; margin-bottom: 20px; padding: 8px; background: #ecf0f1; border-radius: 6px;" ${ce}>
                        <strong>Instrucciones para el docente/adulto:</strong> ${esc(ft.indicaciones || 'Realiza la actividad según las indicaciones.')}
                    </div>
                    
                    <div class="ficha-actividades-render" style="min-height: 400px; padding: 15px; border: 1px solid #bdc3c7; border-radius: 8px; background: #fafafa;" ${ce}>
                        ${ft.actividades || '<p style="text-align:center; color:#95a5a6; margin-top:150px;">Escribe o genera las actividades del estudiante aquí...</p>'}
                    </div>
                </div>`;
        } else {
            fichaTrabajoHtml = `
                <div class="html2pdf__page-break" style="break-before: page; margin-top: 30px;"></div>
                <div class="session-title-bar-official" style="margin-top: 20px; background: #2980b9 !important; color:#fff !important;">
                    <span>FICHA DE TRABAJO INDEPENDIENTE PARA EL ESTUDIANTE</span>
                </div>
                <div class="ficha-estudiante-container" style="border: 2px dashed #3498db; padding: 25px; border-radius: 12px; margin-top: 15px; background: #ffffff;">
                    <table style="width: 100%; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px;">
                        <tr>
                            <td style="font-size: 14px; font-weight: 700; color: #2c3e50; border:none !important; background:transparent !important; padding:0 !important;">
                                Nombre: __________________________________________________
                            </td>
                            <td style="font-size: 14px; font-weight: 700; color: #2c3e50; text-align: right; border:none !important; background:transparent !important; padding:0 !important; width: 120px;">
                                Edad: ______ años
                            </td>
                        </tr>
                    </table>
                    
                    <div style="font-size: 16px; font-weight: 800; color: #2980b9; margin-bottom: 8px; text-transform: uppercase;">
                        🎨 Actividad de Aprendizaje: Dibujo del Conteo del Día
                    </div>
                    <div style="font-size: 11px; font-style: italic; color: #7f8c8d; margin-bottom: 20px; padding: 8px; background: #ecf0f1; border-radius: 6px;">
                        <strong>Instrucciones:</strong> Observa y cuenta los elementos que trabajamos hoy. Luego dibújalos en el recuadro grande y delinea el número correspondiente.
                    </div>
                    
                    <div class="ficha-actividades-render" style="min-height: 400px; padding: 15px; border: 1px solid #bdc3c7; border-radius: 8px; background: #fafafa;">
                        <div style="border: 2px dashed #bdc3c7; border-radius:8px; height:250px; text-align:center; padding:100px 0; color:#95a5a6; font-size:14px; font-weight:600; margin-bottom:20px; background:#fff;">
                            ÁREA DE DIBUJO Y EXPRESIÓN PLÁSTICA
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px;">
                            <span style="font-size:12px; font-weight:700;">¡Delinea el número del día!</span>
                            <span style="font-size:36px; font-weight:800; letter-spacing:15px; color:#bdc3c7; border: 1px dashed #bdc3c7; padding: 0 15px; border-radius:6px; background:#fff;">1 2 3 4 5</span>
                        </div>
                    </div>
                </div>`;
        }

        // 9. Build Instrumento de Evaluacion grid
        let checklistRows = '';
        const studentsList = [
            'ACOSTA MURGA, CLIFEER AMELEX',
            'AGUILAR JAVIER, FARID OMAR',
            'DURAND PLÁCIDO, JENS BRYAN STAM',
            'MURGA CARBAJAL, JHOSSUÉ GODOFREDO',
            'MURGS CECILIO, LIAM ERICK',
            'PALOMINO VEGA, ARELIZ XIMENA',
            'PALOMINO VEGA, ANDRÉ ANGELO',
            'QUISPE SAICEDO, MARA JOSELYN',
            'SILVA BARRETO, ESLIN LIZANDRO',
            'TARAZONA PACHECO, WALDO',
            'VALENCIA ROMERO, KIARA ALESSIA'
        ];
        studentsList.forEach((stud, idx) => {
            checklistRows += `
                <tr>
                    <td style="text-align: center; font-weight:700;">${idx + 1}</td>
                    <td style="text-align: left; padding-left: 8px;">${esc(stud)}</td>
                    <td></td><td></td><td></td><td></td>
                </tr>`;
        });

        const instrumentoHtml = `
            <div class="html2pdf__page-break" style="break-before: page; margin-top: 30px;"></div>
            <div class="session-title-bar-official" style="margin-top: 20px;">
                <span>ANEXO: INSTRUMENTO DE EVALUACIÓN (GUÍA DE OBSERVACIÓN / REGISTRO DE LOGRO)</span>
            </div>
            <div style="font-size: 10px; margin-bottom: 8px; color: #555;">
                <strong>Competencia:</strong> ${esc(p.competencia || 'Resuelve problemas de cantidad')}<br>
                <strong>Criterio de Evaluación:</strong> ${esc(criterios[0] || 'Cuenta correctamente utilizando el conteo uno a uno hasta 5.')}
            </div>
            <table class="session-header-table eval-table" style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center; background:#f1f5f9;">N°</th>
                        <th style="text-align: left; padding-left: 8px; background:#f1f5f9;">APELLIDOS Y NOMBRES DE LOS NIÑOS</th>
                        <th style="width: 40px; text-align: center; background:#e74c3c; color:#fff !important;">C (Inicio)</th>
                        <th style="width: 40px; text-align: center; background:#f39c12; color:#fff !important;">B (Proceso)</th>
                        <th style="width: 40px; text-align: center; background:#2ecc71; color:#fff !important;">A (Logrado)</th>
                        <th style="width: 40px; text-align: center; background:#2980b9; color:#fff !important;">AD (Destacado)</th>
                    </tr>
                </thead>
                <tbody>
                    ${checklistRows}
                </tbody>
            </table>`;

        // 10. Assemble
        return `
            <table class="print-layout-table">
                <thead>
                    <tr>
                        <td>
                            <!-- ════════ HEADER INSTITUCIONAL INICIAL ════════ -->
                            <table class="official-header-table" style="width:100%; margin-bottom:10px;">
                                <tr>
                                    <td class="official-header-logos-cell" style="border:none !important; padding:0 !important; background:transparent !important;">
                                        <div class="official-header-logos-list" style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:15px; width:100%;">
                                            <div class="official-logo-item">
                                                <img class="official-logo-img" src="${m.logo_url || 'assets/logo.png'}" alt="Logo IE" style="max-height: 48px; object-fit: contain;">
                                            </div>
                                            <div class="official-header-text-block" style="text-align:center; flex:1; font-family:'Times New Roman', Georgia, serif; line-height:1.2;">
                                                <div style="font-size:10pt; font-weight:700; text-transform:uppercase; color:#000;">UNIVERSIDAD NACIONAL HERMILIO VALDIZAN</div>
                                                <div style="font-size:9.5pt; font-weight:700; text-transform:uppercase; color:#000;">FACULTAD DE CIENCIAS DE LA EDUCACIÓN</div>
                                                <div style="font-size:9.5pt; font-weight:600; font-style:italic; color:#000;">Escuela Profesional de Educación Inicial</div>
                                                <div style="font-size:8pt; font-weight:600; color:#333; margin-top:2px;">PROYECTO FORMATIVO GESTIONANDO LA PRÁCTICA Y EL TRABAJO ACADÉMICO IV</div>
                                            </div>
                                            <div class="official-logo-item">
                                                <img class="official-logo-img" src="assets/logo.png" alt="Logo UNHEVAL" style="max-height: 48px; object-fit: contain; opacity: 0.85;">
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div class="session-title-bar-official">
                                <span>ANEXO 01: PLANIFICACIÓN DE LA ACTIVIDAD DE APRENDIZAJE</span>
                            </div>
                            
                            <table class="session-header-table" style="margin-top: 10px;">
                                <tr>
                                    <td class="label-cell">Institución Educativa</td>
                                    <td class="value-cell" ${ce} colspan="3">${esc(m.institucion || 'I.E. N° 145 Sector 5 Amarilis')}</td>
                                    <td class="label-cell">Edad de los niños</td>
                                    <td class="value-cell" ${ce}>${esc(m.grado || '4 años')}</td>
                                </tr>
                                <tr>
                                    <td class="label-cell">Practicante / Docente</td>
                                    <td class="value-cell" ${ce} colspan="3">${esc(m.docente || 'Claudio Inocente Nayra Nelyda')}</td>
                                    <td class="label-cell">Fecha</td>
                                    <td class="value-cell" ${ce}>${esc(m.fecha || new Date().toLocaleDateString('es-PE'))}</td>
                                </tr>
                                <tr>
                                    <td class="label-cell">Nombre de Actividad</td>
                                    <td class="value-cell" ${ce} colspan="3" style="font-weight:700; color:#2c3e50;">“${esc(m.titulo || 'Cuantas maestras hay en el jardín')}”</td>
                                    <td class="label-cell">Tiempo aprox.</td>
                                    <td class="value-cell" ${ce}>${esc(m.duracion || '45 minutos')}</td>
                                </tr>
                            </table>

                            <div style="margin-top: 12px; padding: 10px; border: 1px solid #000; background:#f8fafc; font-size:10px;">
                                <strong>PROPÓSITO DE APRENDIZAJE:</strong> <span ${ce}>${esc(p.proposito_sesion || p.proposito || 'Que los niños exploren, descubran y comuniquen utilizando sus sentidos y materiales.')}</span>
                            </div>

                            <table class="session-header-table content-table" style="margin-top: 15px;">
                                <thead>
                                    <tr>
                                        <th style="width: 140px; text-align: left;">Área / Competencia / Capacidades</th>
                                        <th style="text-align: left;">Estándar de Aprendizaje</th>
                                        <th style="width: 160px; text-align: left;">Desempeño del Grado</th>
                                        <th style="width: 130px; text-align: left;">Criterio de Evaluación</th>
                                        <th style="width: 110px; text-align: left;">Evidencia / Instrumento</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="momento-label-cell" style="width: 140px; border-right: 1px solid #000 !important;">
                                            <div style="font-weight:700; text-transform:uppercase; color:#c0392b; font-size:8pt; margin-bottom:4px;">Área: ${esc(m.area || 'Matemática')}</div>
                                            <div style="font-weight:700; font-size:8.5pt;" ${ce}>“${esc(p.competencia || 'Resuelve problemas de cantidad')}”</div>
                                            <div style="margin-top:8px; border-top:1px dashed #7f8c8d; padding-top:6px;">
                                                <strong style="font-size:7.5pt; text-transform:uppercase;">Capacidades:</strong>
                                                <ul style="padding-left:10px; margin-top:2px; font-size:7.5pt; list-style-type:circle;">
                                                    ${capacidadesListHtml}
                                                </ul>
                                            </div>
                                        </td>
                                        <td ${ce} style="font-size:8.5pt; line-height:1.35; padding: 6px;">${esc(p.estandar || '')}</td>
                                        <td ${ce} style="font-size:8.5pt; line-height:1.35; padding: 6px;">${esc(p.desempeno || '')}</td>
                                        <td style="font-size:8.5pt; line-height:1.35; padding: 6px;">
                                            <ul style="padding-left:10px; list-style-type:square;">
                                                ${criteriosHtml}
                                            </ul>
                                        </td>
                                        <td style="font-size:8.5pt; padding: 6px;">
                                            <div style="margin-bottom:6px;">
                                                <strong>Evidencia:</strong><br>
                                                <span ${ce}>${esc(p.producto_evidencia || '')}</span>
                                            </div>
                                            <div style="border-top:1px dashed #bdc3c7; padding-top:4px;">
                                                <strong>Inst.:</strong> <span ${ce}>${esc(p.instrumento || 'Lista de Cotejo')}</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <div style="margin-top:12px; font-size:8.5pt;">
                                <strong>Recursos y Materiales:</strong> <span ${ce}>${esc(recursos.materiales || 'Material de sectores, fichas, colores, crayones, hojas bond.')}</span>
                            </div>

                            <div class="session-title-bar-official" style="margin-top: 20px;">
                                <span>EJECUCIÓN DE PROCESOS PEDAGÓGICOS (MOMENTOS DE LA ACTIVIDAD)</span>
                            </div>
                            <table class="momentos-table">
                                <thead>
                                    <tr>
                                        <th class="momentos-header-left" style="width: 140px">MOMENTOS</th>
                                        <th class="momentos-header-center">ESTRATEGÍAS PEDAGÓGICAS / PROCESOS DIDÁCTICOS</th>
                                        <th class="momentos-header-eval" style="width: 30px">EVALUACIÓN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${inicioRowsHtml}
                                    ${desarrolloRowsHtml}
                                    ${cierreRowsHtml}
                                </tbody>
                            </table>
                            
                            <table style="width: 100%; border:none !important; margin-top: 40px; margin-bottom: 20px;">
                                <tr>
                                    <td style="width: 45%; border:none !important; text-align: center; background:transparent !important; padding:0 !important;">
                                        <div style="border-top: 1px solid #000; width: 220px; margin: 0 auto; padding-top: 5px; font-size: 9px; font-weight:700;">
                                            Silvia Carrasco Valenzuela<br>
                                            <span style="font-weight:normal; color:#555;">Docente de Aula / Mentora</span>
                                        </div>
                                    </td>
                                    <td style="border:none !important; background:transparent !important; padding:0 !important;"></td>
                                    <td style="width: 45%; border:none !important; text-align: center; background:transparent !important; padding:0 !important;">
                                        <div style="border-top: 1px solid #000; width: 220px; margin: 0 auto; padding-top: 5px; font-size: 9px; font-weight:700;">
                                            ${esc(m.docente || 'Claudio Inocente Nayra Nelyda')}<br>
                                            <span style="font-weight:normal; color:#555;">Estudiante Practicante</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            ${juegoLibreHtml}
                            ${fichaTrabajoHtml}
                            ${instrumentoHtml}
                        </td>
                    </tr>
                </tbody>
            </table>`;
    }

    return { render };
})();

window.Templates = Templates;

