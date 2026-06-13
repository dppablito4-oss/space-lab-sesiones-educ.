-- =======================================================
-- Space Lab: Esquema de Base de Datos & Políticas RLS
-- Motor: Supabase PostgreSQL
-- =======================================================

-- 1. Tabla de Perfiles de Usuario
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS en profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin')
        )
    );

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin')
        )
    );

-- Trigger para crear perfil automáticamente cuando se registra un usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (
        new.id,
        new.email,
        CASE 
            WHEN new.email = 'pabloclsa87@gmail.com' THEN 'superadmin'
            ELSE 'user'
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Tabla Principal de Sesiones
CREATE TABLE IF NOT EXISTS public.sesiones (
    id TEXT PRIMARY KEY, -- Usamos TEXT para mantener los IDs locales 'ses_...'
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    titulo TEXT,
    template TEXT,
    session_data JSONB DEFAULT '{}'::jsonB NOT NULL,
    last_saved TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS en sesiones
ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para sesiones
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sesiones;
CREATE POLICY "Users can view their own sessions" ON public.sesiones
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.sesiones;
CREATE POLICY "Users can insert their own sessions" ON public.sesiones
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sesiones;
CREATE POLICY "Users can update their own sessions" ON public.sesiones
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.sesiones;
CREATE POLICY "Users can delete their own sessions" ON public.sesiones
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all sessions" ON public.sesiones;
CREATE POLICY "Admins can view all sessions" ON public.sesiones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin')
        )
    );


-- 3. Tabla de Configuración de Correo Corporativo (SMTP)
CREATE TABLE IF NOT EXISTS public.corporate_email_settings (
    id INT PRIMARY KEY DEFAULT 1,
    smtp_email TEXT NOT NULL,
    smtp_app_password TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Habilitar RLS en corporate_email_settings
ALTER TABLE public.corporate_email_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para SMTP settings (solo para administradores)
DROP POLICY IF EXISTS "Admins can view SMTP settings" ON public.corporate_email_settings;
CREATE POLICY "Admins can view SMTP settings" ON public.corporate_email_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin')
        )
    );

DROP POLICY IF EXISTS "Admins can modify SMTP settings" ON public.corporate_email_settings;
CREATE POLICY "Admins can modify SMTP settings" ON public.corporate_email_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin')
        )
    );


-- 4. Tabla de Logs de Seguridad
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS en security_logs
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para security_logs
DROP POLICY IF EXISTS "Admins can view logs" ON public.security_logs;
CREATE POLICY "Admins can view logs" ON public.security_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin')
        )
    );

DROP POLICY IF EXISTS "Anyone can insert security logs" ON public.security_logs;
CREATE POLICY "Anyone can insert security logs" ON public.security_logs
    FOR INSERT WITH CHECK (true);
