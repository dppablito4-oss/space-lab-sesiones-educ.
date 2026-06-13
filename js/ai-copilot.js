/* ═══════════════════════════════════════════════════
   AI COPILOT — Integración con IA
   Adaptado de pablitoexpo GlobalAiCopilot + mibitacora SpaceCopilot
   ═══════════════════════════════════════════════════ */

const AiCopilot = (() => {
    
    // ─── CONFIGURACIÓN ───
    // El usuario debe configurar su propia API key y endpoint
    const CONFIG = {
        // Para usar con OpenRouter (acceso a múltiples modelos)
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: '', // Se configura desde la UI
        model: 'deepseek/deepseek-chat', // DeepSeek V3 vía OpenRouter (barato y bueno)
        maxTokens: 2000,
        temperature: 0.7
    };

    /**
     * Set API configuration
     */
    function configure({ endpoint, apiKey, model } = {}) {
        if (endpoint) CONFIG.endpoint = endpoint;
        if (apiKey) CONFIG.apiKey = apiKey;
        if (model) CONFIG.model = model;

        // Persist config (without sensitive keys shown)
        localStorage.setItem('spacelab_ai_config', JSON.stringify({
            endpoint: CONFIG.endpoint,
            apiKey: CONFIG.apiKey,
            model: CONFIG.model
        }));
    }

    /**
     * Load saved config
     */
    function loadConfig() {
        try {
            const saved = localStorage.getItem('spacelab_ai_config');
            if (saved) {
                const c = JSON.parse(saved);
                CONFIG.endpoint = c.endpoint || CONFIG.endpoint;
                CONFIG.apiKey = c.apiKey || CONFIG.apiKey;
                CONFIG.model = c.model || CONFIG.model;
            }
        } catch (e) { /* ignore */ }
    }

    /**
     * Check if API is configured
     */
    function isConfigured() {
        const hasLocalKey = CONFIG.apiKey && CONFIG.apiKey.length > 10;
        let hasSavedSession = false;
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i).includes('-auth-token')) {
                hasSavedSession = true;
                break;
            }
        }
        return hasLocalKey || hasSavedSession;
    }

    // ─── SYSTEM PROMPT ───
    const SYSTEM_PROMPT = `Eres un asistente educativo experto en el diseño de sesiones de aprendizaje según el Currículo Nacional del Perú (MINEDU). Tu tarea es generar el contenido pedagógico de una sesión de aprendizaje.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE en formato JSON válido, sin markdown, sin backticks, sin explicaciones adicionales.
2. Adapta el contenido al grado y área curricular indicados.
3. Las actividades deben ser específicas, prácticas y alineadas al desempeño.
4. Usa un lenguaje claro y pedagógico.
5. Los tiempos deben sumar la duración total indicada.

FORMATO DE RESPUESTA (JSON):
{
  "proposito": {
    "competencia": "texto de la competencia",
    "capacidad": "texto de la capacidad",
    "desempeno": "texto del desempeño específico",
    "enfoque": "enfoque transversal aplicable"
  },
  "momentos": {
    "preparacion": {
      "antes": "qué preparar antes de la sesión",
      "recursos": "lista de recursos y materiales"
    },
    "inicio": {
      "actividades": "actividades detalladas del inicio (motivación, saberes previos, propósito)",
      "tiempo": "X min",
      "recursos": "recursos para el inicio"
    },
    "desarrollo": {
      "actividades": "actividades detalladas del desarrollo (situación significativa, trabajo, retroalimentación)",
      "tiempo": "X min",
      "recursos": "recursos para el desarrollo"
    },
    "cierre": {
      "actividades": "actividades de cierre (metacognición, evaluación, extensión)",
      "tiempo": "X min",
      "recursos": "recursos para el cierre"
    }
  },
  "evaluacion": {
    "criterio": "criterio basado en el desempeño",
    "evidencia": "evidencia de aprendizaje esperada",
    "instrumento": "instrumento de evaluación"
  }
}`;

    async function generateSession(metadata) {
        const userPrompt = buildPrompt(metadata);

        // 1. Intentar llamar a la Edge Function de Supabase si está disponible
        if (window.SupabaseClient && SupabaseClient.client) {
            try {
                console.log('[AI] Llamando a Edge Function deepseek-router...');
                const { data, error } = await SupabaseClient.client.functions.invoke('deepseek-router', {
                    body: { prompt: userPrompt, systemPrompt: SYSTEM_PROMPT }
                });

                if (error) throw error;

                // Si la función retorna un string de JSON
                let resultObj = data;
                if (typeof data === 'string') {
                    resultObj = parseAIResponse(data);
                } else if (data && typeof data === 'object') {
                    // Si ya viene como objeto parsed
                    resultObj = deepCleanStrings(data);
                }

                if (resultObj) {
                    return resultObj;
                }
            } catch (err) {
                console.warn('[AI] Falló Edge Function, intentando fallback local:', err);
                
                // Si falla la llamada a la nube y no tenemos API key local configurada
                if (!CONFIG.apiKey || CONFIG.apiKey.length <= 10) {
                    // Mostrar alerta amigable indicando que no está la Edge Function y abriendo prompt
                    Toast.warning('El servidor de IA en la nube no responde. Por favor ingresa tu API Key local de OpenRouter.');
                    const configured = showConfigPrompt();
                    if (!configured) {
                        throw new Error('Debes configurar una API Key de OpenRouter/OpenAI para poder generar sesiones con IA.');
                    }
                }
            }
        }

        // 2. Fallback local (OpenRouter/API Key directa en cliente)
        if (!CONFIG.apiKey || CONFIG.apiKey.length <= 10) {
            throw new Error('API_NOT_CONFIGURED');
        }

        try {
            console.log('[AI] Conectando a OpenRouter local...');
            const response = await fetch(CONFIG.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.apiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Space Lab - Sesiones Educativas'
                },
                body: JSON.stringify({
                    model: CONFIG.model,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ],
                    max_tokens: CONFIG.maxTokens,
                    temperature: CONFIG.temperature
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                console.error('[AI] API Error:', response.status, errBody);
                throw new Error(`Error del servidor: ${response.status}`);
            }


            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('La IA no devolvió contenido');
            }

            const parsed = parseAIResponse(content);
            return parsed;

        } catch (error) {
            console.error('[AI] Generation error:', error);
            throw error;
        }
    }

    /**
     * Build the user prompt from metadata
     */
    function buildPrompt(m) {
        const parts = [];
        
        parts.push(`Genera una sesión de aprendizaje con estos datos:`);
        
        if (m.area) parts.push(`- Área curricular: ${m.area}`);
        if (m.grado) parts.push(`- Grado: ${m.grado}`);
        if (m.titulo) parts.push(`- Tema/Título: ${m.titulo}`);
        if (m.duracion) parts.push(`- Duración total: ${m.duracion}`);
        if (m.competencia) parts.push(`- Competencia sugerida: ${m.competencia}`);
        if (m.capacidad) parts.push(`- Capacidad sugerida: ${m.capacidad}`);
        if (m.desempeno) parts.push(`- Desempeño sugerido: ${m.desempeno}`);
        if (m.enfoque) parts.push(`- Enfoque transversal: ${m.enfoque}`);

        parts.push(`\nIMPORTANTE: Responde SOLO con el JSON, sin explicaciones.`);

        return parts.join('\n');
    }

    /**
     * Parse and clean AI response
     */
    function parseAIResponse(rawContent) {
        // Clean common AI response artifacts
        let cleaned = rawContent
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .replace(/^\s*[\r\n]+/, '')
            .replace(/[\r\n]+\s*$/, '')
            .trim();

        // Try to extract JSON if wrapped in text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }

        try {
            const parsed = JSON.parse(cleaned);
            
            // Clean excessive newlines from all string values
            return deepCleanStrings(parsed);
        } catch (e) {
            console.error('[AI] Failed to parse JSON:', cleaned);
            throw new Error('La IA devolvió una respuesta con formato incorrecto. Intenta de nuevo.');
        }
    }

    /**
     * Recursively clean strings in an object
     */
    function deepCleanStrings(obj) {
        if (typeof obj === 'string') {
            return obj
                .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
                .replace(/^\s+|\s+$/g, '')   // Trim
                .replace(/•\s*/g, '• ');     // Normalize bullet points
        }
        if (Array.isArray(obj)) {
            return obj.map(deepCleanStrings);
        }
        if (obj && typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = deepCleanStrings(value);
            }
            return result;
        }
        return obj;
    }

    /**
     * Show API configuration prompt
     */
    function showConfigPrompt() {
        loadConfig();

        const currentKey = CONFIG.apiKey ? CONFIG.apiKey.slice(0, 8) + '...' : '(no configurada)';

        const key = prompt(
            `🤖 Configuración de IA\n\n` +
            `Para usar la generación con IA, necesitas una API Key.\n\n` +
            `Opciones:\n` +
            `1. OpenRouter (openrouter.ai) — Acceso a DeepSeek, GPT, etc.\n` +
            `2. OpenAI directo (api.openai.com)\n\n` +
            `API Key actual: ${currentKey}\n\n` +
            `Ingresa tu API Key (o cancela):`,
            CONFIG.apiKey || ''
        );

        if (key !== null && key.trim()) {
            configure({ apiKey: key.trim() });
            Toast.success('API Key guardada correctamente');
            return true;
        }
        return false;
    }

    // Initialize
    loadConfig();

    return {
        generateSession,
        isConfigured,
        configure,
        showConfigPrompt,
        loadConfig
    };
})();
