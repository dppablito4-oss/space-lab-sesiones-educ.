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
    const SYSTEM_PROMPT = `Eres un asistente educativo experto en el diseño de sesiones de aprendizaje de educación básica (Inicial, Primaria, Secundaria) según el Currículo Nacional del Perú (MINEDU) y el CNEB. Tu tarea es generar la planificación de una sesión de aprendizaje detallada, extensa e interactiva.

REGLAS DE FORMATO Y CONTENIDO:
1. Responde ÚNICAMENTE en formato JSON válido. No envíes explicaciones, código markdown ni backticks \`\`\`.
2. Las actividades de los momentos (inicio, desarrollo, cierre) deben contener marcado HTML básico (como <strong>, <ul>, <li>, <p>, <br>) para estructurar el texto, listas y preguntas con excelente visualización. No uses etiquetas como <html>, <body>, ni clases CSS complejas.
3. El contenido del DESARROLLO debe ser extremadamente detallado, largo y completo, cubriendo todos los procesos didácticos del área curricular (por ejemplo, en Matemática: familiarización con el problema, búsqueda y ejecución de estrategias, socialización de representaciones, formalización, reflexión, transferencia; en Comunicación: antes de la lectura, durante la lectura, después de la lectura, etc.). Esto debe ocupar de 2 a 4 páginas de impresión, por lo tanto, sé minucioso.
4. Genera múltiples capacidades y criterios de evaluación adecuados a la competencia.
5. Adapta la complejidad y tono de las actividades al Grado, Nivel (Inicial, Primaria, Secundaria) y Área curricular indicados.

FORMATO DE RESPUESTA (JSON):
{
  "proposito": {
    "competencia": "Nombre oficial de la competencia (ej. Resuelve problemas de cantidad)",
    "estandar": "Texto completo del Estándar de Aprendizaje del ciclo correspondiente",
    "capacidades": [
      "Capacidad oficial 1",
      "Capacidad oficial 2",
      "Capacidad oficial 3"
    ],
    "criterios_evaluacion": [
      "Criterio de evaluación específico 1",
      "Criterio de evaluación específico 2",
      "Criterio de evaluación específico 3"
    ],
    "producto_evidencia": "Descripción detallada del producto o evidencia de aprendizaje",
    "instrumento": "Lista de Cotejo / Rúbrica",
    "conocimientos": "Conceptos clave, temas y subtemas que se abordarán"
  },
  "competencias_transversales": {
    "tic": [
      "Se desenvuelve en los entornos virtuales generados por las TIC al buscar información y recursos...",
      "Organiza y clasifica información digital..."
    ],
    "autonoma": [
      "Determina metas de aprendizaje viables asociadas a sus necesidades...",
      "Organiza su tiempo y recursos para lograr sus metas..."
    ]
  },
  "enfoques": [
    {
      "nombre": "Nombre del Enfoque Transversal 1 (ej. Enfoque de derechos)",
      "valor": "Valor del enfoque 1 (ej. Conciencia de derechos)",
      "actitudes": "Actitudes o acciones observables del docente y estudiantes"
    },
    {
      "nombre": "Nombre del Enfoque Transversal 2 (ej. Enfoque Ambiental)",
      "valor": "Valor del enfoque 2 (ej. Solidaridad planetaria)",
      "actitudes": "Actitudes o acciones observables del docente y estudiantes"
    }
  ],
  "recursos": {
    "paginas_consulta": "Referencias bibliográficas, libros de texto de MINEDU, enlaces web oficiales",
    "materiales": "Fichas de trabajo, papelotes, plumones, material concreto, proyector",
    "actividades_refuerzo": "Ficha N° XX y título de la actividad de refuerzo escolar (opcional)"
  },
  "momentos": {
    "inicio": {
      "motivacion": "Actividad motivadora y retadora con los estudiantes (juego, caso, noticia).",
      "saberes_previos": "Preguntas clave para rescatar lo que ya saben los estudiantes sobre el tema.",
      "problematizacion": "Situación de conflicto cognitivo o reto inicial que movilice el pensamiento.",
      "proposito_organizacion": "Comunicación del propósito de la sesión, los criterios de evaluación y cómo se organizarán para trabajar.",
      "tiempo_total": "15 min"
    },
    "desarrollo": {
      "actividades": "Contenido sumamente extenso y estructurado con etiquetas HTML. Debe guiar paso a paso por los Procesos Didácticos del área curricular (como familiarización con el problema, búsqueda de estrategias, socialización, formalización y transferencia). Incluye preguntas específicas de retroalimentación, explicaciones de conceptos clave, problemas con sus respectivas respuestas y métodos de resolución.",
      "tiempo_total": "65 min"
    },
    "cierre": {
      "actividades": "Preguntas de metacognición (¿Qué aprendimos hoy?, ¿Cómo lo aprendimos?, ¿Para qué nos servirá?), revisión corta de los criterios de evaluación logrados y tareas/actividades de extensión para el hogar.",
      "tiempo_total": "10 min"
    }
  },
  "evaluacion": {
    "criterio": "Criterio de evaluación consolidado",
    "evidencia": "Evidencia/producto esperado",
    "instrumento": "Lista de Cotejo / Rúbrica"
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
        
        if (m.nivel) parts.push(`- Nivel educativo: ${m.nivel}`);
        if (m.area) parts.push(`- Área curricular: ${m.area}`);
        if (m.grado) parts.push(`- Grado: ${m.grado}`);
        if (m.numero_sesion) parts.push(`- Número de sesión: ${m.numero_sesion}`);
        if (m.titulo) parts.push(`- Tema/Título: ${m.titulo}`);
        if (m.duracion) parts.push(`- Duración total: ${m.duracion}`);
        if (m.competencia) parts.push(`- Competencia sugerida: ${m.competencia}`);
        if (m.capacidad) parts.push(`- Capacidad sugerida: ${m.capacidad}`);
        if (m.desempeno) parts.push(`- Desempeño sugerido: ${m.desempeno}`);
        if (m.enfoque) parts.push(`- Enfoque transversal 1: ${m.enfoque}`);
        if (m.enfoque2) parts.push(`- Enfoque transversal 2: ${m.enfoque2}`);

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
