/* ═══════════════════════════════════════════════════
   PEDAGOGY BRIEF — Mini-chat pedagógico autónomo
   Space Lab — Sesiones Educativas
   ═══════════════════════════════════════════════════ */

const PedagogyBrief = (() => {
    'use strict';

    // ─── STATE ───
    let _formData = null;       // datos del formulario al abrir
    let _messages = [];         // historial: [{role, content}]
    let _summary = null;        // resumen compacto final (lo que se inyecta al prompt)
    let _isFinished = false;    // true cuando la IA ya pidió confirmación final
    let _isGenerating = false;  // evita doble submit

    // ─── SYSTEM PROMPTS ───
    const BRIEF_SYSTEM = `Eres un asesor pedagógico experto en el Currículo Nacional de Educación Básica del Perú (CNEB / MINEDU). Tu rol es conversar brevemente con un docente para entender con exactitud el enfoque pedagógico que desea para su sesión de aprendizaje.

REGLAS DE COMPORTAMIENTO:
1. Haz preguntas ESPECÍFICAS al área y tema indicados. Nunca hagas preguntas genéricas de matemática si el área es Comunicación, y viceversa.
2. Después de cada respuesta del docente, evalúa si ya tienes suficiente contexto. Si la respuesta fue ambigua o poco clara, pide una aclaración puntual.
3. Cuando sientas que tienes suficiente información, formula la siguiente pregunta de esta forma EXACTA: "¿Hay algo más que quieras indicarme, o podemos generar la sesión con este enfoque?"
4. Si el docente responde positivamente (dice "sí", "listo", "genera", "está bien", "no", "ya", etc.), responde con el marcador especial: [LISTO_PARA_GENERAR]
5. Si el docente agrega más información nueva, continúa la conversación y evalúa nuevamente.
6. Aproximadamente 3-4 turnos es suficiente. Si ya tienes contexto claro, no hagas más preguntas innecesarias.
7. Respuestas breves y directas. No uses saludos ni despedidas.`;

    const SUMMARY_SYSTEM = `Eres un asesor pedagógico experto. Dado el historial de una conversación, extrae y redacta un resumen compacto del ENFOQUE PEDAGÓGICO específico que desea el docente para su sesión.

REGLAS:
1. Máximo 90 palabras.
2. Redacta como instrucción directa para una IA generadora de sesiones.
3. NO repitas el área curricular, grado ni título de la sesión (ya están en otra parte del prompt). Solo el enfoque, énfasis y restricciones.
4. Usa frases como: "El docente quiere...", "Enfatizar...", "Evitar...", "Priorizar...".
5. Devuelve SOLO el párrafo, sin comillas ni explicaciones adicionales.`;

    // ─── PUBLIC: OPEN MODAL ───
    function open(formData) {
        _formData = formData;
        _messages = [];
        _summary = null;
        _isFinished = false;
        _isGenerating = false;

        _buildModal();
        _showModal();
        _startConversation();
    }

    // ─── PUBLIC: GET SUMMARY ───
    function getSummary() {
        return _summary || null;
    }

    // ─── PUBLIC: CLEAR ───
    function clear() {
        _summary = null;
        _messages = [];
        _isFinished = false;
    }

    // ─────────────────────────────────────────────────────────────
    // UI BUILDING
    // ─────────────────────────────────────────────────────────────

    function _buildModal() {
        const existing = document.getElementById('pedagogy-brief-modal');
        if (existing) existing.remove();

        const areaLabel = _formData.area || 'Área';
        const temaLabel = _formData.titulo || 'Tema de la sesión';

        const modal = document.createElement('div');
        modal.id = 'pedagogy-brief-modal';
        modal.className = 'pb-overlay';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
            <div class="pb-panel">
                <div class="pb-header">
                    <div class="pb-header-left">
                        <span class="pb-header-icon">✨</span>
                        <div>
                            <div class="pb-title">Afinar Enfoque Pedagógico</div>
                            <div class="pb-subtitle">${_escHtml(areaLabel)} &middot; ${_escHtml(temaLabel)}</div>
                        </div>
                    </div>
                    <button id="pb-close-btn" class="pb-close-btn" title="Cerrar" aria-label="Cerrar panel">✕</button>
                </div>

                <div class="pb-messages" id="pb-messages">
                    <div class="pb-thinking" id="pb-thinking">
                        <span></span><span></span><span></span>
                    </div>
                </div>

                <div class="pb-footer">
                    <textarea
                        id="pb-input"
                        class="pb-textarea"
                        placeholder="Escribe tu respuesta... (Enter para enviar)"
                        rows="2"
                        disabled
                        aria-label="Tu respuesta al asesor pedagógico"
                    ></textarea>
                    <div class="pb-btn-row">
                        <button id="pb-send-btn" class="pb-btn pb-btn-send" disabled aria-label="Enviar respuesta">
                            Enviar ↵
                        </button>
                        <button id="pb-generate-btn" class="pb-btn pb-btn-generate pb-hidden" aria-label="Generar sesión con este enfoque">
                            🚀 Generar Sesión
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // ── Events ──
        document.getElementById('pb-close-btn').addEventListener('click', _closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) _closeModal(); });
        document.getElementById('pb-send-btn').addEventListener('click', _handleSend);
        document.getElementById('pb-generate-btn').addEventListener('click', _handleFinish);

        document.getElementById('pb-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                _handleSend();
            }
        });
    }

    function _showModal() {
        const modal = document.getElementById('pedagogy-brief-modal');
        if (modal) {
            // Force reflow before adding visible class for CSS transition
            modal.getBoundingClientRect();
            modal.classList.add('pb-visible');
        }
    }

    function _closeModal() {
        const modal = document.getElementById('pedagogy-brief-modal');
        if (modal) {
            modal.classList.remove('pb-visible');
            setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
        }
    }

    function _appendMessage(role, htmlText) {
        const container = document.getElementById('pb-messages');
        if (!container) return;

        const bubble = document.createElement('div');
        bubble.className = `pb-bubble pb-bubble-${role}`;
        bubble.innerHTML = htmlText.replace(/\n/g, '<br>');
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    }

    function _showThinking(show) {
        const el = document.getElementById('pb-thinking');
        if (el) el.style.display = show ? 'flex' : 'none';
        const container = document.getElementById('pb-messages');
        if (container && show) container.scrollTop = container.scrollHeight;
    }

    function _setInputEnabled(enabled) {
        const input = document.getElementById('pb-input');
        const sendBtn = document.getElementById('pb-send-btn');
        if (input) {
            input.disabled = !enabled;
            if (enabled) setTimeout(() => input.focus(), 50);
        }
        if (sendBtn) sendBtn.disabled = !enabled;
    }

    function _showGenerateButton() {
        const btn = document.getElementById('pb-generate-btn');
        if (btn) btn.classList.remove('pb-hidden');
    }

    function _escHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ─────────────────────────────────────────────────────────────
    // CONVERSATION FLOW
    // ─────────────────────────────────────────────────────────────

    async function _startConversation() {
        _showThinking(true);
        _setInputEnabled(false);

        const contextBlock = [
            `Área: ${_formData.area || '—'}`,
            `Grado: ${_formData.grado || '—'}`,
            _formData.titulo  ? `Tema: "${_formData.titulo}"`     : '',
            _formData.methodology ? `Metodología: ${_formData.methodology}` : '',
            _formData.sourceFile  ? '(El docente tiene un archivo de referencia adjunto)' : ''
        ].filter(Boolean).join('\n');

        const userPrompt = `${contextBlock}\n\nInicia la conversación con las preguntas pedagógicas más relevantes para entender el enfoque que desea el docente.`;

        try {
            const aiResponse = await _callAI(userPrompt, true);
            _showThinking(false);
            if (_checkIfReady(aiResponse)) return;
            _appendMessage('ai', aiResponse);
            _messages.push({ role: 'assistant', content: aiResponse });
            _setInputEnabled(true);
        } catch (err) {
            _showThinking(false);
            _appendMessage('ai', '⚠️ No se pudo conectar con la IA en este momento. Puedes escribir tu enfoque aquí abajo y hacer clic en <strong>Generar Sesión</strong> directamente.');
            _setInputEnabled(true);
            _isFinished = true;
            _showGenerateButton();
            console.error('[PedagogyBrief] start error:', err);
        }
    }

    async function _handleSend() {
        if (_isGenerating) return;
        const input = document.getElementById('pb-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        _appendMessage('user', _escHtml(text));
        _messages.push({ role: 'user', content: text });

        // If the "Listo?" question was already asked and teacher adds more info → generate
        if (_isFinished) {
            _summary = null; // will be re-built from updated history
            _handleFinish();
            return;
        }

        _setInputEnabled(false);
        _showThinking(true);

        try {
            const userPrompt = _buildHistoryPrompt();
            const aiResponse = await _callAI(userPrompt, false);
            _showThinking(false);
            if (_checkIfReady(aiResponse)) return;
            _appendMessage('ai', aiResponse);
            _messages.push({ role: 'assistant', content: aiResponse });
            _setInputEnabled(true);
        } catch (err) {
            _showThinking(false);
            _appendMessage('ai', '⚠️ Error de conexión. Intenta de nuevo o haz clic en <strong>Generar Sesión</strong>.');
            _setInputEnabled(true);
            _isFinished = true;
            _showGenerateButton();
            console.error('[PedagogyBrief] send error:', err);
        }
    }

    function _checkIfReady(aiText) {
        if (aiText.includes('[LISTO_PARA_GENERAR]')) {
            _isFinished = true;
            const cleanText = aiText.replace('[LISTO_PARA_GENERAR]', '').trim();
            if (cleanText) _appendMessage('ai', cleanText);
            _appendMessage('ai', '✅ ¡Perfecto! Haz clic en <strong>Generar Sesión</strong> cuando estés listo, o escribe algo más si quieres agregar algún detalle.');
            _messages.push({ role: 'assistant', content: cleanText || 'Listo para generar.' });
            _showGenerateButton();
            _setInputEnabled(true);
            return true;
        }
        return false;
    }

    async function _handleFinish() {
        if (_isGenerating) return;
        _isGenerating = true;
        _setInputEnabled(false);

        const genBtn = document.getElementById('pb-generate-btn');
        if (genBtn) genBtn.disabled = true;

        _appendMessage('ai', '⏳ Resumiendo tu enfoque pedagógico...');
        _showThinking(true);

        try {
            _summary = _messages.length > 0 ? await _generateSummary() : null;
        } catch (err) {
            console.error('[PedagogyBrief] summary error:', err);
            _summary = _buildFallbackSummary();
        }

        _showThinking(false);
        _closeModal();

        // Dispatch event so app.js can proceed
        document.dispatchEvent(new CustomEvent('pedagogy-brief-ready', {
            detail: { summary: _summary }
        }));
    }

    // ─────────────────────────────────────────────────────────────
    // AI CALLS
    // ─────────────────────────────────────────────────────────────

    function _buildHistoryPrompt() {
        return _messages
            .map(m => `${m.role === 'user' ? 'Docente' : 'Asesor'}: ${m.content}`)
            .join('\n\n');
    }

    async function _callAI(userPrompt, isFirstTurn) {
        const contextExtra = isFirstTurn
            ? `\n\nDatos de la sesión:\nÁrea: ${_formData.area || '—'}\nGrado: ${_formData.grado || '—'}\nTema: ${_formData.titulo || '—'}\nMetodología: ${_formData.methodology || 'Por defecto del área'}`
            : '';

        return await _runLightPrompt(BRIEF_SYSTEM + contextExtra, userPrompt, 380);
    }

    async function _generateSummary() {
        const conversationText = _messages
            .map(m => `${m.role === 'user' ? 'Docente' : 'Asesor'}: ${m.content}`)
            .join('\n\n');

        return await _runLightPrompt(SUMMARY_SYSTEM, `Historial:\n\n${conversationText}`, 220);
    }

    function _buildFallbackSummary() {
        const userParts = _messages
            .filter(m => m.role === 'user')
            .map(m => m.content)
            .join('. ');
        return userParts.trim() || null;
    }

    async function _runLightPrompt(systemPrompt, userPrompt, maxTokens) {
        // 1. Supabase Edge Function (server-side, cheapest)
        if (window.SupabaseClient && SupabaseClient.client) {
            try {
                const { data, error } = await SupabaseClient.client.functions.invoke('gemini-router', {
                    body: { prompt: userPrompt, systemPrompt, maxTokens: maxTokens || 380 }
                });
                if (!error && data) {
                    const text = typeof data === 'object'
                        ? (data.choices?.[0]?.message?.content || data.content || '')
                        : data;
                    if (text && text.trim()) return text.trim();
                }
            } catch {
                // fallthrough to local
            }
        }

        // 2. Local OpenRouter fallback
        const saved = JSON.parse(localStorage.getItem('spacelab_ai_config') || '{}');
        const apiKey = saved.apiKey || '';
        if (!apiKey || apiKey.length <= 10) throw new Error('API_NOT_CONFIGURED');

        const resp = await fetch(saved.endpoint || 'https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Space Lab - Pedagogy Brief'
            },
            body: JSON.stringify({
                model: saved.model || 'deepseek/deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user',   content: userPrompt }
                ],
                max_tokens: maxTokens || 380,
                temperature: 0.6
            })
        });

        if (!resp.ok) throw new Error(`API error ${resp.status}`);
        const json = await resp.json();
        return (json.choices?.[0]?.message?.content || '').trim();
    }

    // ─── EXPORTS ───
    return { open, getSummary, clear };
})();

window.PedagogyBrief = PedagogyBrief;
