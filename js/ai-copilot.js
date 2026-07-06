/* ═══════════════════════════════════════════════════
   AI COPILOT — Integración con IA
   Adaptado de pablitoexpo GlobalAiCopilot + mibitacora SpaceCopilot
   ═══════════════════════════════════════════════════ */

const AiCopilot = (() => {
    
    // ─── CONFIGURACIÓN ───
    // El usuario debe configurar su propia API key y endpoint
    const CONFIG = {
        // Por defecto conectamos a la API de OpenAI
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '', // Se configura desde la UI
        model: 'gpt-5.4-mini', // OpenAI GPT-5.4 Mini por defecto
        maxTokens: 4000, // Ajuste clave para evitar JSONs rotos
        temperature: 0.5 // Bajarlo ayuda a que sea más estricto con el formato JSON
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
        } catch { /* ignore */ }
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

    // ─── METODOLOGÍAS DIDÁCTICAS PROMPTS ───
    const METHODOLOGY_PROMPTS = {
        polya: `La secuencia didáctica del momento de DESARROLLO debe estructurarse rigurosamente bajo los procesos didácticos oficiales de Matemática de MINEDU:
1. **Familiarización con el problema:** Los estudiantes leen de forma colectiva el reto, identifican datos y comprenden la situación.
2. **Búsqueda y ejecución de estrategias:** Los alumnos proponen planes, eligen herramientas, organizan equipos y ejecutan soluciones.
3. **Socialización de representaciones:** Los estudiantes comparten e intercambian en la pizarra sus representaciones (gráficas, simbólicas, concretas).
4. **Reflexión y Formalización:** Momento donde el docente consolida conceptualmente el aprendizaje y los estudiantes reflexionan sobre sus dificultades y aciertos.
Asegúrate de estructurar el JSON del desarrollo usando exactamente estas llaves: "proceso_1_familiarizacion", "proceso_2_busqueda_estrategias", "proceso_3_socializacion" y "proceso_4_formalizacion_reflexion".`,
        
        erca: `La secuencia didáctica del momento de DESARROLLO debe estructurarse estrictamente bajo el ciclo ERCA:
1. **Experiencia:** Actividad vivencial, exploración física, o recuperación de una situación real relacionada al tema.
2. **Reflexión:** Los estudiantes analizan lo experimentado, exponen sus puntos de vista, y discuten las primeras interrogantes.
3. **Conceptualización:** Sistematización teórica de los conceptos claves científicos, reglas o ideas principales guiados por el docente.
4. **Aplicación:** Resolución de retos prácticos, ejercicios o situaciones cotidianas donde apliquen lo aprendido.
Asegúrate de estructurar el JSON del desarrollo usando exactamente estas llaves: "proceso_1_experiencia", "proceso_2_reflexion", "proceso_3_conceptualizacion" y "proceso_4_aplicacion".`,
        
        abp: `La secuencia didáctica del momento de DESARROLLO debe estructurarse bajo los principios del Aprendizaje Basado en Proyectos (ABP):
1. **Lanzamiento / Desafío:** Planteamiento del reto, pregunta orientadora o necesidad real del proyecto.
2. **Indagación / Investigación:** Búsqueda activa de información, lectura o recolección de datos sobre la problemática.
3. **Desarrollo del Producto:** Trabajo colaborativo donde los estudiantes diseñan, crean o esbozan el entregable/producto del proyecto.
4. **Difusión y Evaluación:** Espacio donde socializan sus productos y reciben retroalimentación crítica constructiva de sus pares.
Asegúrate de estructurar el JSON del desarrollo usando exactamente estas llaves: "proceso_1_lanzamiento", "proceso_2_indagacion", "proceso_3_desarrollo_producto" y "proceso_4_difusion_evaluacion".`,
        
        flipped: `La secuencia didáctica del momento de DESARROLLO debe estructurarse bajo el enfoque de Aula Invertida (Flipped Classroom):
1. **Conexión de saberes externos:** Puesta en común del contenido estudiado autónomamente antes de la clase (videos, lecturas previas).
2. **Aplicación guiada / Taller activo:** Dinámica de alta exigencia cognitiva donde se resuelven dudas complejas y se trabaja en proyectos o retos colaborativos.
3. **Consolidación y retroalimentación interactiva:** Sistematización del saber aplicado en el taller y evaluación formativa en vivo.
Asegúrate de estructurar el JSON del desarrollo usando exactamente estas llaves: "proceso_1_conexion_externa", "proceso_2_aplicacion_guiada" y "proceso_3_consolidacion_retroalimentacion".`,
        
        indagacion: `La secuencia didáctica del momento de DESARROLLO debe estructurarse siguiendo el Método de Indagación Científica (STEAM/Ciencia):
1. **Problematización de situaciones:** Formulación de preguntas investigables e hipótesis explicativas.
2. **Diseño de estrategias para hacer indagación:** Elaboración del plan de acción experimental o metodológico.
3. **Generación, registro y análisis de datos:** Actividad práctica de experimentación, observación directa o recolección de evidencia empírica.
4. **Estructuración del saber construido y comunicación:** Contraste de hipótesis, síntesis de conclusiones y comunicación de aprendizajes.
Asegúrate de estructurar el JSON del desarrollo usando exactamente estas llaves: "proceso_1_problematizacion", "proceso_2_diseno_estrategias", "proceso_3_generacion_analisis_datos" y "proceso_4_estructuracion_comunicacion".`,
        
        cooperativo: `La secuencia didáctica del momento de DESARROLLO debe centrarse en el Aprendizaje Cooperativo:
1. **Organización de equipos y roles:** Formación de grupos heterogéneos y asignación de roles (coordinador, secretario, portavoz, gestor del tiempo).
2. **Interdependencia positiva:** Actividades diseñadas para que los estudiantes se necesiten mutuamente para lograr el éxito grupal (ej: rompecabezas, lectura compartida).
3. **Interacción promotora:** Fomentar el diálogo cercano y la explicación mutua de conceptos entre compañeros.
4. **Autoevaluación grupal:** Reflexión final sobre el desempeño cooperativo del equipo.
Asegúrate de estructurar el JSON del desarrollo usando exactamente estas llaves: "proceso_1_organizacion_roles", "proceso_2_interdependencia_positiva", "proceso_3_interaccion_promotora" y "proceso_4_autoevaluacion_grupal".`
    };

    // ─── SYSTEM PROMPT ───
    const SYSTEM_PROMPT = `Eres un asistente educativo experto en el diseño de sesiones de aprendizaje de educación básica (Inicial, Primaria, Secundaria) según el Currículo Nacional del Perú (MINEDU) y el CNEB. Tu tarea es generar la planificación de una sesión de aprendizaje detallada, extensa e interactiva.

REGLAS DE FORMATO Y CONTENIDO:
1. Responde ÚNICAMENTE en formato JSON válido. No envíes explicaciones, código markdown ni backticks \`\`\`.
2. Las actividades de los momentos (inicio, desarrollo, cierre) deben contener marcado HTML básico (como <strong>, <ul>, <li>, <p>, <br>) para estructurar el texto, listas y preguntas con excelente visualización. No uses etiquetas como <html>, <body>, ni clases CSS complejas.
3. El desarrollo de la sesión debe dividirse rigurosamente en sub-procesos didácticos separados en claves independientes de JSON (proceso_1, proceso_2, etc.), describiendo detalladamente la interacción en el aula.
4. Genera múltiples capacidades y criterios de evaluación adecuados a la competencia.
5. Adapta la complejidad y tono de las actividades al Grado, Nivel (Inicial, Primaria, Secundaria) y Área curricular indicados.

FORMATO DE RESPUESTA (JSON):
{
  "titulo_sesion_retador": "Frase de acción de la sesión (ej: Representamos con números enteros los goles a favor y en contra...)",
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
      "proceso_1_familiarizacion": "Texto detallado en HTML para la lectura y comprensión del reto.",
      "proceso_2_busqueda_estrategias": "Texto detallado en HTML sobre cómo plantearán y ejecutarán la solución.",
      "proceso_3_socializacion": "Texto detallado en HTML sobre la exposición y debate de representaciones.",
      "proceso_4_formalizacion_reflexion": "Texto detallado en HTML con la explicación científica/matemática consolidada y reflexión sobre lo aprendido.",
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
}

FORMATO MATEMÁTICO (LaTeX con KaTeX):
Cuando el área es Matemática o la sesión incluya operaciones, ecuaciones, fracciones, exponentes o cualquier expresión matemática, escríbelas siempre en notación LaTeX rodeada de delimitadores. La app las renderizará automáticamente como tipografía matemática profesional.

REGLAS DE NOTACIÓN:
- Expresión en línea (dentro de un párrafo): $expresión$ → Ej: "El valor de $x = 8$"
- Expresión centrada/destacada (en su propia línea): $$expresión$$ → Ej: $$2x + 5 = 21$$
- Fracciones: \frac{numerador}{denominador} → Ej: $$\frac{25 - a}{21 - a} = \frac{5}{4}$$
- Flecha de implicación / "entonces": \Rightarrow → Ej: $$2x = 16 \Rightarrow x = 8$$
- Raíz cuadrada: \sqrt{expresión} → Ej: $\sqrt{b^2 - 4ac}$
- Potencia: x^{n} → Ej: $x^2 + 5x + 6 = 0$
- Subíndice: x_{n} → Ej: $x_1, x_2$
- Fórmula general: $$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
- Suma/resta con alineación de pasos: usar $$...$$ en líneas separadas para cada paso del proceso

CUÁNDO USAR LATEX:
✅ En los pasos de resolución de problemas (proceso 2, proceso 3, proceso 4 del desarrollo)
✅ En situaciones de problematización cuando se plantee una ecuación
✅ En la formalización/reflexión al mostrar el procedimiento consolidado
✅ En preguntas de inicio si involucran cifras matemáticas operadas
❌ NO uses LaTeX en textos de gestión del aula, instrucciones organizativas ni preguntas de metacognición
`;

    async function generateSession(metadata) {
        const userPrompt = buildPrompt(metadata);

        // Construir prompt de sistema dinámico basado en la metodología didáctica elegida
        let dynamicSystemPrompt = SYSTEM_PROMPT;
        if (metadata.methodology && METHODOLOGY_PROMPTS[metadata.methodology]) {
            dynamicSystemPrompt += `\n\n⚠️ INSTRUCCIÓN CRÍTICA DE METODOLOGÍA DIDÁCTICA REQUERIDA:\n${METHODOLOGY_PROMPTS[metadata.methodology]}`;
        }

        if (metadata.template === 'inicial') {
            dynamicSystemPrompt += `\n\n⚠️ INSTRUCCIÓN DE FORMATO ESPECIAL PARA EDUCACIÓN INICIAL:
La sesión que vas a generar es de nivel EDUCACIÓN INICIAL (para niños de 3 a 5 años). Por lo tanto:
1. Adapta el lenguaje y las dinámicas para que sean sumamente lúdicas, vivenciales y concretas (uso de títeres, juegos de rol, asambleas cortas, manipulación de material concreto, dibujo y expresión plástica).
2. Debes incluir OBLIGATORIAMENTE dos campos adicionales en la raíz del JSON de respuesta:
   - "juego_libre_sectores": Objeto con los 6 pasos didácticos del juego libre en los sectores, detallados para este tema específico:
     {
       "planificacion": "Detalle de la asamblea y la elección libre del sector.",
       "organizacion": "Cómo se agrupan los niños y distribuyen los roles en los sectores.",
       "ejecucion": "Juego libre y cómo el docente acompaña y media en el aprendizaje.",
       "orden": "Estrategias lúdicas o canciones para guardar los materiales.",
       "socializacion": "Preguntas que el docente hará para conversar sobre la experiencia del juego.",
       "representacion": "Detalle de la producción gráfica, modelado o dramatización posterior al juego."
     }
   - "ficha_trabajo": Objeto con una propuesta de hoja de aplicación/ficha práctica autónoma para el estudiante:
     {
       "titulo": "Título corto y llamativo para el niño (ej. ¡A contar maestras!)",
       "indicaciones": "Instrucciones de la actividad descritas de forma sumamente sencilla (para la docente/padre).",
       "actividades": "Código HTML detallado con la estructura visual de la ficha. Usa contenedores con estilos en línea (bordes punteados, recuadros grandes para dibujar, números grandes para delinear con puntitos, dibujos simples representados con símbolos o formas como círculos/estrellas). Debe ser súper interactiva, atractiva y lista para imprimir y colorear/trazar."
     }
Asegúrate de que la estructura JSON contenga estos dos nuevos campos en su raíz.`;
        }

        if (metadata.nivel === 'PRIMARIA' || (metadata.nivel && metadata.nivel.toUpperCase() === 'PRIMARIA')) {
            dynamicSystemPrompt += `\n\n⚠️ INSTRUCCIÓN DE FORMATO ESPECIAL PARA EDUCACIÓN PRIMARIA (1° A 6° GRADO):
La sesión que vas a generar es de nivel EDUCACIÓN PRIMARIA. Por lo tanto, debes incluir OBLIGATORIAMENTE un campo adicional en la raíz del JSON de respuesta llamado "ficha_trabajo" para proponer una ficha de aplicación/trabajo autónoma adaptada de forma rigurosa al grado indicado (${metadata.grado || 'del grado correspondiente'}):
{
  "ficha_trabajo": {
    "titulo": "Título de la actividad para el estudiante (ej. ¡Jugamos y resolvemos sumando!)",
    "indicaciones": "Instrucciones cortas directas al estudiante (máximo 40 palabras).",
    "actividades": "Código HTML detallado con la estructura de la ficha. Usa tablas, recuadros punteados o listas con estilos CSS en línea para simular una hoja de trabajo física y atractiva. Adapta el contenido al grado indicado de forma estricta:
      - 1° y 2° grado (Ciclo III): Actividades muy visuales, trazado de palabras, problemas sencillos usando dibujos sencillos representados con caracteres o tablas, y sumas/restas ilustradas con contenedores grandes para dibujar.
      - 3° y 4° grado (Ciclo IV): Textos breves para comprensión con preguntas de opción múltiple, problemas matemáticos de dos operaciones con esquemas de solución y crucigramas/sopas de letras básicos.
      - 5° y 6° grado (Ciclo V): Preguntas reflexivas y críticas, problemas lógicos complejos (fracciones, porcentajes, etc.), organizadores visuales vacíos (ej. mapas conceptuales creados con tablas HTML vacías con bordes) para completar, y tareas de redacción corta."
  }
}
Asegúrate de que la estructura JSON contenga este nuevo campo "ficha_trabajo" en su raíz.`;
        }

        // 1. Intentar llamar a la Edge Function de Supabase si está disponible
        if (window.SupabaseClient && SupabaseClient.client) {
            try {
                let functionName = 'openai-router';
                if (metadata.ai_provider === 'gemini') {
                    functionName = 'gemini-router';
                } else if (metadata.ai_provider === 'deepseek') {
                    functionName = 'deepseek-router';
                }
                
                console.log(`[AI] Llamando a Edge Function ${functionName}...`);
                const { data, error } = await SupabaseClient.client.functions.invoke(functionName, {
                    body: { 
                        prompt: userPrompt, 
                        systemPrompt: dynamicSystemPrompt,
                        sourceFile: metadata.sourceFile || null
                    }
                });

                if (error) throw error;

                // Si la función retorna un string de JSON
                let resultObj = data;
                if (typeof data === 'string') {
                    resultObj = parseAIResponse(data);
                } else if (data && typeof data === 'object') {
                    // Si ya viene como objeto parsed
                    resultObj = normalizeSessionData(deepCleanStrings(data));
                }

                if (resultObj) {
                    return resultObj;
                }
            } catch (err) {
                console.error('[AI] Error en Edge Function:', err);
                
                // Differentiate error types
                const isNetworkOrNotFound = !err.status || err.status === 404 || err.name === 'FunctionsFetchError';
                
                if (isNetworkOrNotFound) {
                    console.warn('[AI] Edge Function no disponible o fuera de línea, intentando fallback local...');
                    if (!CONFIG.apiKey || CONFIG.apiKey.length <= 10) {
                        Toast.warning('El servidor de IA en la nube no responde. Por favor ingresa tu API Key local de OpenAI/OpenRouter.');
                        const configured = showConfigPrompt();
                        if (!configured) {
                            throw new Error('Debes configurar una API Key de OpenAI/OpenRouter para poder generar sesiones con IA.');
                        }
                    }
                } else {
                    let serverMsg = err.message || `Error del servidor de IA (${err.status})`;
                    try {
                        const parsedBody = JSON.parse(err.message);
                        if (parsedBody && parsedBody.error) {
                            serverMsg = `${parsedBody.error}${parsedBody.details ? ': ' + parsedBody.details : ''}`;
                        }
                    } catch {
                        // ignore
                    }
                    throw new Error(serverMsg);
                }
            }
        }

        // 2. Fallback local (OpenRouter/API Key directa en cliente)
        if (!CONFIG.apiKey || CONFIG.apiKey.length <= 10) {
            throw new Error('API_NOT_CONFIGURED');
        }

        try {
            let requestEndpoint = CONFIG.endpoint;
            let requestModel = CONFIG.model;
            const provider = metadata.ai_provider || 'openai';

            if (provider === 'openai') {
                if (CONFIG.apiKey.startsWith('sk-')) {
                    requestEndpoint = 'https://api.openai.com/v1/chat/completions';
                    requestModel = 'gpt-5.4-mini';
                } else {
                    requestEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
                    requestModel = 'openai/gpt-5.4-mini';
                }
            } else if (provider === 'deepseek') {
                if (CONFIG.apiKey.startsWith('sk-')) {
                    requestEndpoint = 'https://api.deepseek.com/chat/completions';
                    requestModel = 'deepseek-chat';
                } else {
                    requestEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
                    requestModel = 'deepseek/deepseek-chat';
                }
            } else if (provider === 'gemini') {
                // Solo usar la API de Google directa si la clave es de Google (empieza por AIza)
                if (CONFIG.apiKey.startsWith('AIza')) {
                    requestEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.apiKey}`;
                } else {
                    // Si empieza por sk- (OpenAI/OpenRouter) pero seleccionó Gemini, enrutar a OpenRouter usando el modelo Gemini
                    requestEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
                    requestModel = 'google/gemini-2.5-flash';
                }
            }

            console.log(`[AI] Conectando a local (${requestEndpoint}) con modelo ${requestModel}...`);
            
            let response;
            if (provider === 'gemini' && requestEndpoint.includes('generativelanguage.googleapis.com')) {
                // Inyectar el texto del prompt
                const parts = [{ text: userPrompt }];
                
                // Si el modelo es Gemini directo y tenemos las imágenes renderizadas, las agregamos como inlineData
                if (metadata.sourceFile && metadata.sourceFile.images && metadata.sourceFile.images.length > 0) {
                    metadata.sourceFile.images.forEach(img => {
                        parts.push({
                            inlineData: {
                                mimeType: img.type,
                                data: img.base64
                            }
                        });
                    });
                } else if (metadata.sourceFile && metadata.sourceFile.base64 && metadata.sourceFile.type) {
                    // Fallback: Si no hay imágenes pero hay un archivo cargado completo en base64
                    parts.push({
                        inlineData: {
                            mimeType: metadata.sourceFile.type,
                            data: metadata.sourceFile.base64
                        }
                    });
                }
                
                response = await fetch(requestEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: parts }],
                        generationConfig: { responseMimeType: "application/json" },
                        systemInstruction: { parts: [{ text: dynamicSystemPrompt }] }
                    })
                });
            } else {
                // Para OpenAI / OpenRouter / DeepSeek
                let userContent;
                if (metadata.sourceFile && metadata.sourceFile.images && metadata.sourceFile.images.length > 0) {
                    userContent = [
                        { type: 'text', text: userPrompt }
                    ];
                    metadata.sourceFile.images.forEach(img => {
                        userContent.push({
                            type: 'image_url',
                            image_url: {
                                url: `data:${img.type};base64,${img.base64}`
                            }
                        });
                    });
                } else {
                    userContent = userPrompt;
                }

                response = await fetch(requestEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${CONFIG.apiKey}`,
                        'HTTP-Referer': window.location.origin,
                        'X-Title': 'Space Lab - Sesiones Educativas'
                    },
                    body: JSON.stringify({
                        model: requestModel,
                        messages: [
                            { role: 'system', content: dynamicSystemPrompt },
                            { role: 'user', content: userContent }
                        ],
                        max_tokens: CONFIG.maxTokens,
                        temperature: CONFIG.temperature
                    })
                });
            }

            if (!response.ok) {
                const errBody = await response.text();
                console.error('[AI] API Error:', response.status, errBody);
                throw new Error(`Error del servidor: ${response.status}`);
            }

            const data = await response.json();
            let content;
            if (provider === 'gemini' && requestEndpoint.includes('generativelanguage.googleapis.com')) {
                content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            } else {
                content = data.choices?.[0]?.message?.content;
            }

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

        if (m.sourceFile) {
            if (m.sourceFile.textContent) {
                parts.push(`\n--- CONTENIDO DEL ARCHIVO DE REFERENCIA (${m.sourceFile.name}) ---\n${m.sourceFile.textContent}\n--- FIN DEL ARCHIVO DE REFERENCIA ---`);
                parts.push(`\n⚠️ INSTRUCCIÓN OBLIGATORIA SOBRE EL ARCHIVO DE REFERENCIA:`);
                parts.push(`- Utiliza el contenido del archivo de referencia adjunto arriba como la base teórica, pedagógica y práctica principal de la sesión.`);
                parts.push(`- Extrae del archivo los conceptos clave, problemas, lecturas, actividades o secuencias y utilízalos para dar forma a los momentos didácticos (Inicio, Desarrollo, Cierre) y a la Ficha de Trabajo.`);
                parts.push(`- Si el tema o título proporcionado se relaciona con este archivo, alinea toda la sesión para que desarrolle el contenido de este archivo enfocado en dicho tema.`);
            } else if (m.sourceFile.base64) {
                parts.push(`\n[Archivo adjunto de referencia: ${m.sourceFile.name} (tipo: ${m.sourceFile.type}). Utiliza esta fuente de referencia para basar las actividades, conceptos y el diseño pedagógico de la sesión de aprendizaje.]`);
            }
        }

        parts.push(`\n⚠️ INSTRUCCIÓN DE RESPETO DE ENTRADAS DEL DOCENTE:`);
        parts.push(`- Si el docente ha proporcionado un 'Tema/Título' (${m.titulo ? `"${m.titulo}"` : 'NO PROVISTO'}), úsalo de forma obligatoria y estricta en la sesión. Si está vacío o NO PROVISTO, dedúcelo de manera creativa a partir del contexto del archivo de referencia adjunto y devuélvelo en la clave "titulo_sesion_retador".`);
        parts.push(`- Si el docente ha proporcionado una 'Competencia sugerida' (${m.competencia ? `"${m.competencia}"` : 'NO PROVISTO'}), úsala exactamente tal cual. Si está vacía o NO PROVISTO, dedúcela del contexto del archivo o área curricular.`);
        parts.push(`- Si el docente ha proporcionado una 'Capacidad sugerida' (${m.capacidad ? `"${m.capacidad}"` : 'NO PROVISTO'}), úsala. Si está vacía o NO PROVISTO, dedúcela del contexto del archivo.`);
        parts.push(`- Si el docente ha proporcionado un 'Desempeño sugerido' (${m.desempeno ? `"${m.desempeno}"` : 'NO PROVISTO'}), úsalo. Si está vacío o NO PROVISTO, dedúcelo del contexto del archivo.`);

        // ─── Enfoque pedagógico específico del docente (del mini-chat) ───
        // Solo se añade si el docente usó el panel de briefing. Es compacto (~80 palabras)
        // y NO repite área/grado/título (ya están arriba). Instrucción de alta prioridad.
        if (m.pedagogyBrief && m.pedagogyBrief.trim()) {
            parts.push(`\n⚠️ ENFOQUE PEDAGÓGICO ESPECÍFICO DEL DOCENTE (INSTRUCCIÓN DE ALTA PRIORIDAD):\n${m.pedagogyBrief.trim()}\nAsegúrate de que los momentos, actividades y ejemplos de la sesión reflejen exactamente este enfoque.`);
        }

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
            return normalizeSessionData(deepCleanStrings(parsed));
        } catch {
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
     * Normalize dynamic session keys (e.g. momentos.desarrollo proceso_X_ keys)
     */
    function normalizeSessionData(obj) {
        if (!obj || typeof obj !== 'object') return obj;

        if (obj.momentos && obj.momentos.desarrollo && typeof obj.momentos.desarrollo === 'object') {
            const desarrollo = obj.momentos.desarrollo;
            const newDesarrollo = {};
            let index = 1;

            // 1. Copy standard non-process keys
            if (desarrollo.tiempo_total) newDesarrollo.tiempo_total = desarrollo.tiempo_total;
            if (desarrollo.actividades) newDesarrollo.actividades = desarrollo.actividades;

            // 2. Identify and sort process/step keys
            const otherKeys = Object.keys(desarrollo).filter(k => k !== 'tiempo_total' && k !== 'actividades');

            otherKeys.sort((a, b) => {
                const numA = parseInt(a.replace(/^\D+/g, ''), 10);
                const numB = parseInt(b.replace(/^\D+/g, ''), 10);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                // Fallback to alphabetical if no numbers
                return a.localeCompare(b);
            });

            // 3. Normalize keys to 'proceso_X_[name]' format
            otherKeys.forEach(key => {
                const val = desarrollo[key];
                // Strip existing prefix 'proceso_1_', 'proceso_', 'paso_1_', 'paso_'
                const cleanKey = key
                    .replace(/^(proceso|paso)_\d+_/, '')
                    .replace(/^(proceso|paso)_/, '');

                const standardKey = `proceso_${index}_${cleanKey}`;
                newDesarrollo[standardKey] = val;
                index++;
            });

            obj.momentos.desarrollo = newDesarrollo;
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

    /**
     * Run a generic prompt leveraging Supabase edge functions or local OpenRouter fallback.
     */
    async function runPrompt(systemPrompt, userPrompt) {
        // 1. Try to invoke Supabase Edge Function if available
        if (window.SupabaseClient && SupabaseClient.client) {
            try {
                let functionName = 'openai-router';
                if (CONFIG.model.includes('gemini')) {
                    functionName = 'gemini-router';
                } else if (CONFIG.model.includes('deepseek')) {
                    functionName = 'deepseek-router';
                }
                
                console.log(`[AI Helper] Invoking edge function ${functionName} for generic prompt...`);
                const { data, error } = await SupabaseClient.client.functions.invoke(functionName, {
                    body: { 
                        prompt: userPrompt, 
                        systemPrompt: systemPrompt
                    }
                });

                if (!error) {
                    let text = data;
                    if (data && typeof data === 'object') {
                        text = data.choices?.[0]?.message?.content || data.content || JSON.stringify(data);
                    }
                    if (text) return text;
                }
            } catch (err) {
                console.warn('[AI Helper] Edge function failed or returned error, using local fallback...', err);
            }
        }

        // 2. Local fallback (using user's API key)
        if (!CONFIG.apiKey || CONFIG.apiKey.length <= 10) {
            throw new Error('API_NOT_CONFIGURED');
        }

        let requestEndpoint = CONFIG.endpoint;
        let requestModel = CONFIG.model;

        if (CONFIG.apiKey.startsWith('sk-')) {
            if (CONFIG.model.includes('deepseek')) {
                requestEndpoint = 'https://api.deepseek.com/v1/chat/completions';
                requestModel = 'deepseek-chat';
            } else {
                requestEndpoint = 'https://api.openai.com/v1/chat/completions';
                requestModel = 'gpt-5.4-mini';
            }
        }

        const response = await fetch(requestEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Space Lab - Sesiones Educativas'
            },
            body: JSON.stringify({
                model: requestModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 1500,
                temperature: 0.5
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Error del servidor de IA: ${response.status}`);
        }

        const resData = await response.json();
        return resData.choices?.[0]?.message?.content || '';
    }

    /**
     * Generate evaluation criteria / rubric indicators based on session content.
     */
    async function generateCriterios(competencia, tema, grado, area) {
        const systemPrompt = `Eres un asesor pedagógico experto en el Currículo Nacional de Educación Básica (CNEB) del Perú. 
Tu tarea es generar exactamente entre 3 y 5 criterios de evaluación en formato de elementos de lista HTML básico (usando viñetas <li>...</li>).
Cada criterio debe ser claro, preciso, medible y redactado en tercera persona (por ejemplo: "Identifica información explícita...", "Explica el propósito...", etc.), vinculando el área curricular, competencia y grado provistos.
Devuelve ÚNICAMENTE los elementos <li> sin etiquetas de lista <ul> ni explicaciones adicionales, ni introducciones, ni marcas de código markdown de bloque como \`\`\`html. Devuelve código HTML plano listo para insertar en una lista.`;

        const userPrompt = `Área Curricular: ${area || 'General'}
Competencia: ${competencia || 'Competencia general'}
Tema/Propósito: ${tema || 'Actividad de aprendizaje'}
Grado: ${grado || 'General'}`;

        const result = await runPrompt(systemPrompt, userPrompt);
        return result.trim().replace(/^```html|```$/g, '');
    }

    async function improveText(text, instruction) {
        const systemPrompt = `Eres un asesor pedagógico y experto redactor del Currículo Nacional del Perú. Tu tarea es reescribir y refinar el fragmento de texto de la sesión de aprendizaje proporcionado por el docente, basándote ESTRICTAMENTE en la instrucción de estilo indicada.
        
REGLAS CRÍTICAS:
1. Aplica la instrucción de refinamiento al texto de forma precisa.
2. Devuelve ÚNICAMENTE el texto procesado resultante.
3. NO agregues introducciones, preámbulos, explicaciones, notas, comentarios de autor ni comillas de apertura/cierre.
4. Respeta y conserva el marcado HTML básico si el texto original lo contiene (como <strong>, <br>, <li>, <ul>).`;

        const userPrompt = `Texto original:
"${text}"

Instrucción de refinamiento:
${instruction}`;

        const result = await runPrompt(systemPrompt, userPrompt);
        return result.trim();
    }

    // Initialize
    loadConfig();

    return {
        generateSession,
        isConfigured,
        configure,
        showConfigPrompt,
        loadConfig,
        generateCriterios,
        improveText
    };
})();

window.AiCopilot = AiCopilot;

