import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, systemPrompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Falta el parámetro 'prompt'." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Leer la API Key de los secretos configurados en Supabase
    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("API_KEY_OPENAI");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "La variable OPENAI_API_KEY no está configurada en los Secretos de Supabase." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Llamada directa a la API oficial de OpenAI usando gpt-5.4-mini
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages: [
          { role: "system", content: systemPrompt || "Eres un asistente de Inteligencia Artificial para docentes de Space Lab." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API Error:", errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI API returned error: ${response.status}`, details: errorText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    return new Response(
      JSON.stringify(reply),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error en Edge Function openai-router:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
