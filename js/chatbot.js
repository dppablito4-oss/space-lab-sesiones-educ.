/* ═══════════════════════════════════════════════════
   CHATBOT — Asistente Pedagógico de Space Lab
   Space Lab — Sesiones Educativas
   ═══════════════════════════════════════════════════ */

const Chatbot = (() => {
    
    let container = null;
    let bubble = null;
    let windowChat = null;
    let messagesContainer = null;
    let inputField = null;
    let btnSend = null;
    let btnClose = null;

    let chatHistory = [];

    function init() {
        container = document.getElementById('chatbot-container');
        bubble = document.getElementById('chatbot-bubble');
        windowChat = document.getElementById('chatbot-window');
        messagesContainer = document.getElementById('chatbot-messages');
        inputField = document.getElementById('chatbot-input');
        btnSend = document.getElementById('btn-send-chat');
        btnClose = document.getElementById('btn-close-chatbot');

        if (!container) return;

        bindEvents();
    }

    function bindEvents() {
        // Toggle ventana
        bubble.addEventListener('click', toggleChat);
        btnClose.addEventListener('click', toggleChat);

        // Enviar mensaje
        btnSend.addEventListener('click', handleSendMessage);
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    function toggleChat() {
        windowChat.classList.toggle('hidden');
        if (!windowChat.classList.contains('hidden')) {
            inputField.focus();
            // Desplazar al último mensaje
            scrollBottom();
        }
    }

    async function handleSendMessage() {
        const text = inputField.value.trim();
        if (!text) return;

        // Limpiar input
        inputField.value = '';

        // Añadir mensaje de usuario a la UI e historial
        appendMessage('user', text);
        chatHistory.push({ sender: 'user', text: text });

        // Añadir burbuja de cargando (typing indicator)
        const typingId = appendTypingIndicator();
        scrollBottom();

        try {
            let responseText = '';

            // Formatear prompt con historial
            let promptText = `Actúa como un asistente educativo experto para docentes de colegio en Perú de acuerdo a los lineamientos del Currículo Nacional (MINEDU). Sé conciso, amable y pedagógico.`;
            
            // Adjuntar historial
            promptText += `\n\nHistorial de la conversación:`;
            chatHistory.slice(-6).forEach(msg => {
                promptText += `\n${msg.sender === 'user' ? 'Docente' : 'Asistente'}: ${msg.text}`;
            });
            promptText += `\nDocente: ${text}\nAsistente:`;

            // Llamar a Supabase Edge Function
            if (window.SupabaseClient && SupabaseClient.client) {
                console.log('[Chatbot] Enviando mensaje a deepseek-router...');
                const { data, error } = await SupabaseClient.client.functions.invoke('deepseek-router', {
                    body: { prompt: promptText }
                });

                if (error) throw error;
                
                if (typeof data === 'string') {
                    responseText = data;
                } else if (data && typeof data === 'object') {
                    responseText = data.choices?.[0]?.message?.content || data.response || JSON.stringify(data);
                } else {
                    responseText = 'No pude procesar la respuesta del servidor.';
                }
            } else {
                // Fallback local a OpenRouter
                if (window.AiCopilot && window.AiCopilot.isConfigured()) {
                    console.log('[Chatbot] Fallback local a OpenRouter...');
                    // Simulamos llamada a la API local de OpenRouter usando fetch
                    // Esto evita duplicar todo el código de fetch
                    const config = localStorage.getItem('spacelab_ai_config');
                    if (config) {
                        const c = JSON.parse(config);
                        const response = await fetch(c.endpoint || 'https://openrouter.ai/api/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${c.apiKey}`,
                                'HTTP-Referer': window.location.origin
                            },
                            body: JSON.stringify({
                                model: c.model || 'deepseek/deepseek-chat',
                                messages: [
                                    { role: 'system', content: 'Eres un asistente pedagógico de MINEDU Perú.' },
                                    { role: 'user', content: promptText }
                                ]
                            })
                        });
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const resJson = await response.json();
                        responseText = resJson.choices?.[0]?.message?.content || 'Error en formato de respuesta';
                    } else {
                        throw new Error('Configuración de IA no encontrada');
                    }
                } else {
                    responseText = '⚠️ Para chatear con DeepSeek, por favor inicia sesión o configura una API Key de OpenRouter.';
                }
            }

            // Quitar indicador de carga y mostrar respuesta
            removeTypingIndicator(typingId);
            appendMessage('bot', responseText);
            chatHistory.push({ sender: 'bot', text: responseText });
            scrollBottom();

        } catch (e) {
            console.error('[Chatbot] Error:', e);
            removeTypingIndicator(typingId);
            appendMessage('bot', '⚠️ Lo siento, ocurrió un error al procesar tu consulta con DeepSeek: ' + e.message);
            scrollBottom();
        }
    }

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender}`;
        
        // Convertir saltos de línea a <br>
        const cleanText = escHTML(text).replace(/\n/g, '<br>');

        msgDiv.innerHTML = `
            <div class="message-bubble">
                ${cleanText}
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    }

    function appendTypingIndicator() {
        const typingId = 'typing_' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message bot';
        msgDiv.id = typingId;

        msgDiv.innerHTML = `
            <div class="message-bubble" style="display: flex; align-items: center; gap: 4px; padding: 0.6rem 1rem;">
                <span class="dot-bounce"></span>
                <span class="dot-bounce" style="animation-delay: 0.2s;"></span>
                <span class="dot-bounce" style="animation-delay: 0.4s;"></span>
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
        return typingId;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) messagesContainer.removeChild(el);
    }

    function scrollBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function escHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        init,
        toggleChat
    };
})();

// Agregar la animación CSS para los puntitos del bot escribiendo
;(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .dot-bounce {
            width: 6px;
            height: 6px;
            background-color: var(--text-secondary);
            border-radius: 50%;
            display: inline-block;
            animation: bounce-dot 1.4s infinite ease-in-out both;
        }
        @keyframes bounce-dot {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }
    `;
    document.head.appendChild(style);
})();
