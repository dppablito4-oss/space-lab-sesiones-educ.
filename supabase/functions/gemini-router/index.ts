import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Manejo de preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, systemPrompt, sourceFile } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Falta el parámetro 'prompt'." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Leer la API Key de los secretos configurados en Supabase
    const apiKey = Deno.env.get("API-KEY-GEMINI") || Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "La variable API-KEY-GEMINI no está configurada en los Secretos de Supabase." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Construir partes del contenido
    const parts: any[] = [{ text: prompt }];

    // Si hay archivo multimodal adjunto (PDF, imagen, audio)
    if (sourceFile && sourceFile.base64 && sourceFile.type) {
      parts.push({
        inlineData: {
          mimeType: sourceFile.type,
          data: sourceFile.base64
        }
      });
    }

    const requestBody: any = {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    // Añadir instrucción del sistema si se provee
    if (systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    const modelName = "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    console.log(`[Gemini Router] Enviando petición a modelo ${modelName}...`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return new Response(
        JSON.stringify({ error: `Gemini API returned error: ${response.status}`, details: errorText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status }
      );
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      return new Response(
        JSON.stringify({ error: "Gemini API no devolvió contenido.", rawData: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Retornamos la respuesta de la IA en formato JSON
    return new Response(
      JSON.stringify(replyText),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error en Edge Function gemini-router:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
