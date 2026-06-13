/* ═══════════════════════════════════════════════════
   TEMPLATES — Plantillas de Sesión MINEDU
   3 formatos: estándar, laboratorio, refuerzo
   ═══════════════════════════════════════════════════ */

const Templates = (() => {

    /**
     * Render a session template
     * @param {string} type - 'estandar' | 'laboratorio' | 'refuerzo'
     * @param {Object} data - Session data
     * @param {boolean} editable - Enable contenteditable
     * @returns {string} HTML string
     */
    function render(type, data, editable = true) {
        const ce = editable ? 'contenteditable="true"' : '';
        const m = data.metadata || {};
        const p = data.proposito || {};
        const momentos = data.momentos || {};
        const evalData = data.evaluacion || {};

        switch (type) {
            case 'laboratorio':
                return renderLaboratorio(m, p, momentos, evalData, ce);
            case 'refuerzo':
                return renderRefuerzo(m, p, momentos, evalData, ce);
            default:
                return renderEstandar(m, p, momentos, evalData, ce);
        }
    }

    // ═══════════════════════════════════════
    // SESIÓN ESTÁNDAR MINEDU
    // ═══════════════════════════════════════

    function renderEstandar(m, p, momentos, evalData, ce) {
        return `
            <!-- HEADER INSTITUCIONAL -->
            <table class="session-header-table">
                <tr>
                    <td class="logo-cell" rowspan="4">
                        <div ${ce} style="font-size:24px; text-align:center;">🏫</div>
                    </td>
                    <td class="label-cell">Institución Educativa</td>
                    <td class="value-cell" ${ce}>${esc(m.institucion || 'I.E. N° — Nombre')}</td>
                    <td class="label-cell">Fecha</td>
                    <td class="value-cell" ${ce}>${esc(m.fecha || '')}</td>
                </tr>
                <tr>
                    <td class="label-cell">Docente</td>
                    <td class="value-cell" ${ce}>${esc(m.docente || '')}</td>
                    <td class="label-cell">Duración</td>
                    <td class="value-cell" ${ce}>${esc(m.duracion || '90 min')}</td>
                </tr>
                <tr>
                    <td class="label-cell">Grado y Sección</td>
                    <td class="value-cell" ${ce}>${esc(m.grado || '')} "${esc(m.seccion || '')}"</td>
                    <td class="label-cell">Área</td>
                    <td class="value-cell" ${ce}>${esc(m.area || '')}</td>
                </tr>
                <tr>
                    <td class="label-cell">Unidad Didáctica</td>
                    <td class="value-cell" colspan="3" ${ce}>${esc(m.unidad || '')}</td>
                </tr>
            </table>

            <!-- TÍTULO -->
            <div class="session-title-bar">
                <span ${ce}>${esc(m.titulo || 'SESIÓN DE APRENDIZAJE')}</span>
            </div>

            <!-- PROPÓSITO DE APRENDIZAJE -->
            <div class="section-title">I. Propósito de Aprendizaje</div>
            <table class="content-table">
                <thead>
                    <tr>
                        <th style="width:25%">Competencia</th>
                        <th style="width:25%">Capacidad</th>
                        <th style="width:30%">Desempeño</th>
                        <th style="width:20%">Enfoque Transversal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td ${ce}>${esc(p.competencia || 'Escribe aquí la competencia...')}</td>
                        <td ${ce}>${esc(p.capacidad || 'Escribe aquí la capacidad...')}</td>
                        <td ${ce}>${esc(p.desempeno || 'Escribe aquí el desempeño...')}</td>
                        <td ${ce}>${esc(p.enfoque || 'Escribe aquí el enfoque...')}</td>
                    </tr>
                </tbody>
            </table>

            <!-- PREPARACIÓN -->
            <div class="section-title">II. Preparación de la Sesión</div>
            <table class="content-table">
                <thead>
                    <tr>
                        <th style="width:50%">¿Qué necesitamos hacer antes de la sesión?</th>
                        <th style="width:50%">¿Qué recursos o materiales se utilizarán?</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td ${ce}>${esc(momentos.preparacion?.antes || 'Preparar materiales, revisar fichas...')}</td>
                        <td ${ce}>${esc(momentos.preparacion?.recursos || 'Cuaderno, pizarra, fichas de trabajo...')}</td>
                    </tr>
                </tbody>
            </table>

            <!-- MOMENTOS DE LA SESIÓN -->
            <div class="section-title">III. Momentos de la Sesión</div>
            <table class="content-table">
                <thead>
                    <tr>
                        <th style="width:80px">Momento</th>
                        <th>Estrategias / Actividades</th>
                        <th style="width:60px">Tiempo</th>
                        <th style="width:120px">Recursos</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="moment-label">INICIO</td>
                        <td ${ce}>${esc(momentos.inicio?.actividades || '• Motivación y recojo de saberes previos.\n• Comunicar el propósito de la sesión.\n• Establecer acuerdos de convivencia.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.inicio?.tiempo || '15 min')}</td>
                        <td class="resources-cell" ${ce}>${esc(momentos.inicio?.recursos || 'Pizarra, imágenes')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label">DESARROLLO</td>
                        <td ${ce}>${esc(momentos.desarrollo?.actividades || '• Presentación de la situación significativa.\n• Trabajo individual o en equipo.\n• Acompañamiento y retroalimentación.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.desarrollo?.tiempo || '60 min')}</td>
                        <td class="resources-cell" ${ce}>${esc(momentos.desarrollo?.recursos || 'Fichas, cuaderno')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label">CIERRE</td>
                        <td ${ce}>${esc(momentos.cierre?.actividades || '• Metacognición: ¿Qué aprendimos hoy?\n• Evaluación formativa.\n• Extensión para casa.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.cierre?.tiempo || '15 min')}</td>
                        <td class="resources-cell" ${ce}>${esc(momentos.cierre?.recursos || 'Cuaderno')}</td>
                    </tr>
                </tbody>
            </table>

            <!-- EVALUACIÓN -->
            <div class="section-title">IV. Evaluación</div>
            <table class="eval-table">
                <thead>
                    <tr>
                        <th style="width:30%">Criterio de Evaluación</th>
                        <th style="width:40%">Evidencia de Aprendizaje</th>
                        <th style="width:30%">Instrumento</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td ${ce}>${esc(evalData.criterio || 'Criterio basado en el desempeño...')}</td>
                        <td ${ce}>${esc(evalData.evidencia || 'Producción escrita, participación oral...')}</td>
                        <td ${ce}>${esc(evalData.instrumento || 'Lista de cotejo, rúbrica...')}</td>
                    </tr>
                </tbody>
            </table>

            <!-- REFLEXIÓN DOCENTE -->
            <div class="section-title">V. Reflexión Docente</div>
            <table class="content-table">
                <thead>
                    <tr>
                        <th>¿Qué lograron los estudiantes?</th>
                        <th>¿Qué dificultades se presentaron?</th>
                        <th>¿Qué puedo mejorar?</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td ${ce}>${esc(evalData.logros || '')}</td>
                        <td ${ce}>${esc(evalData.dificultades || '')}</td>
                        <td ${ce}>${esc(evalData.mejoras || '')}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 24px; display: flex; justify-content: space-between; padding: 0 40px;">
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 160px; margin: 0 auto;"></div>
                    <div style="font-size: 9px; margin-top: 4px; font-weight: 600;">Firma del Docente</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 160px; margin: 0 auto;"></div>
                    <div style="font-size: 9px; margin-top: 4px; font-weight: 600;">V°B° Director(a)</div>
                </div>
            </div>
        `;
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
                        <td class="time-cell" ${ce}>${esc(momentos.inicio?.tiempo || '15 min')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label" style="background:#ecfdf5;">EXPERIMENTACIÓN</td>
                        <td ${ce}>${esc(momentos.desarrollo?.actividades || '• Ejecución del experimento.\n• Registro de datos y observaciones.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.desarrollo?.tiempo || '50 min')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label" style="background:#ecfdf5;">RESULTADOS</td>
                        <td ${ce}>${esc(momentos.cierre?.actividades || '• Análisis de resultados.\n• Conclusiones y validación de hipótesis.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.cierre?.tiempo || '25 min')}</td>
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

            <div style="margin-top: 24px; display: flex; justify-content: space-between; padding: 0 40px;">
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 160px; margin: 0 auto;"></div>
                    <div style="font-size: 9px; margin-top: 4px; font-weight: 600;">Firma del Docente</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 160px; margin: 0 auto;"></div>
                    <div style="font-size: 9px; margin-top: 4px; font-weight: 600;">V°B° Director(a)</div>
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
                        <td class="time-cell" ${ce}>${esc(momentos.inicio?.tiempo || '10 min')}</td>
                        <td class="resources-cell" ${ce}>${esc(momentos.inicio?.recursos || '')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label" style="background:#fef3c7;">PRÁCTICA</td>
                        <td ${ce}>${esc(momentos.desarrollo?.actividades || '• Ejercicios diferenciados por nivel.\n• Trabajo guiado con acompañamiento.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.desarrollo?.tiempo || '25 min')}</td>
                        <td class="resources-cell" ${ce}>${esc(momentos.desarrollo?.recursos || '')}</td>
                    </tr>
                    <tr>
                        <td class="moment-label" style="background:#fef3c7;">AVANCE</td>
                        <td ${ce}>${esc(momentos.cierre?.actividades || '• Verificar avance respecto al diagnóstico.\n• Compromiso para la siguiente sesión.')}</td>
                        <td class="time-cell" ${ce}>${esc(momentos.cierre?.tiempo || '10 min')}</td>
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

            <div style="margin-top: 24px; display: flex; justify-content: space-between; padding: 0 40px;">
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 160px; margin: 0 auto;"></div>
                    <div style="font-size: 9px; margin-top: 4px; font-weight: 600;">Firma del Docente</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #333; width: 160px; margin: 0 auto;"></div>
                    <div style="font-size: 9px; margin-top: 4px; font-weight: 600;">V°B° Director(a)</div>
                </div>
            </div>
        `;
    }

    // ─── HELPER: Escape HTML + preserve newlines ───
    function esc(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/\n/g, '<br>');
    }

    return { render };
})();
