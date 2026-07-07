-- ==============================================================================
-- 👥 TABLA DE ALUMNOS (ROSTER DE ESTUDIANTES)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.alumnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_completo TEXT NOT NULL,
    nivel TEXT NOT NULL,      -- Inicial, Primaria, Secundaria
    grado TEXT NOT NULL,      -- 1, 2, 3, etc.
    seccion TEXT NOT NULL,    -- A, B, C, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;

-- Política de RLS para que los usuarios solo manejen sus propios alumnos
CREATE POLICY "Users can manage their own student rosters" 
    ON public.alumnos
    FOR ALL 
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Índices para optimizar búsquedas frecuentes por usuario y grado/sección
CREATE INDEX IF NOT EXISTS idx_alumnos_user_grade_section 
    ON public.alumnos (user_id, nivel, grado, seccion);
