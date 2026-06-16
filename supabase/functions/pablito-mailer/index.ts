import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import nodemailer from "npm:nodemailer";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();

    if (action !== "MANUAL_BLAST" || !payload) {
      return new Response(
        JSON.stringify({ error: "Acción no soportada o payload vacío." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { target, subject, customHtml } = payload;
    if (!subject || !customHtml) {
      return new Response(
        JSON.stringify({ error: "Faltan campos obligatorios: subject o customHtml." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Validar autenticación y permisos de Administrador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Cabecera de autorización faltante." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Inicializar cliente Supabase con Service Role para evadir RLS de lectura completa
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener información del usuario actual mediante su JWT token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido o usuario no autenticado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Verificar rol en profiles
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
      return new Response(
        JSON.stringify({ error: "Acceso denegado: Se requiere rol de administrador." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // 2. Cargar configuración SMTP corporativa de la BD
    const { data: smtpConfig, error: smtpError } = await supabaseClient
      .from("corporate_email_settings")
      .select("smtp_email, smtp_app_password, smtp_host, smtp_port, smtp_secure")
      .eq("id", 1)
      .single();

    if (smtpError || !smtpConfig) {
      return new Response(
        JSON.stringify({ error: "Configuración SMTP corporativa no configurada en la base de datos." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const { 
      smtp_email: smtpEmail, 
      smtp_app_password: smtpAppPassword,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: smtpSecure
    } = smtpConfig;

    // 3. Cargar destinatarios
    let emails: string[] = [];
    if (target === "ALL") {
      const { data: profiles, error: listError } = await supabaseClient
        .from("profiles")
        .select("email");

      if (listError || !profiles) {
        throw new Error("No se pudo obtener la lista de usuarios.");
      }
      emails = profiles.map((p) => p.email).filter(Boolean);
    } else {
      emails = [target]; // Enviar a destinatario específico
    }

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No hay destinatarios registrados." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 4. Configurar Nodemailer y enviar correos
    const isGmail = (smtpHost || "").toLowerCase().includes("gmail.com");
    const transporterConfig: any = isGmail
      ? {
          service: "gmail",
          auth: {
            user: smtpEmail,
            pass: smtpAppPassword,
          },
        }
      : {
          host: smtpHost || "smtp.gmail.com",
          port: Number(smtpPort) || 465,
          secure: smtpSecure !== undefined ? smtpSecure : true,
          auth: {
            user: smtpEmail,
            pass: smtpAppPassword,
          },
        };

    const transporter = nodemailer.createTransport(transporterConfig);

    console.log(`[Mailer] Enviando ${emails.length} correos...`);
    let sentCount = 0;
    for (const toEmail of emails) {
      try {
        await transporter.sendMail({
          from: `"Space Lab" <${smtpEmail}>`,
          to: toEmail,
          subject: subject,
          text: stripHtml(customHtml),
          html: customHtml,
        });
        sentCount++;
      } catch (sendErr) {
        console.error(`Error enviando correo a ${toEmail}:`, sendErr);
      }
    }

    return new Response(
      JSON.stringify({ message: `¡Despacho completado! Se enviaron ${sentCount} de ${emails.length} correos con éxito.` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error en pablito-mailer:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
