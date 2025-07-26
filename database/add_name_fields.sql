-- Migración para agregar campos de nombre y apellido a la tabla usuarios
  -- y modificar el trigger para guardar estos datos durante el registro

  -- 1. Agregar campos first_name, last_name y display_name a la tabla usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. Crear índices para los nuevos campos
CREATE INDEX IF NOT EXISTS idx_usuarios_first_name ON usuarios(first_name);
CREATE INDEX IF NOT EXISTS idx_usuarios_last_name ON usuarios(last_name);
CREATE INDEX IF NOT EXISTS idx_usuarios_display_name ON usuarios(display_name);

  -- 3. Actualizar la función handle_new_user para incluir los nuevos campos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  first_name_val TEXT;
  last_name_val TEXT;
  display_name_val TEXT;
BEGIN
  -- Extraer valores de metadata
  first_name_val := NEW.raw_user_meta_data ->> 'first_name';
  last_name_val := NEW.raw_user_meta_data ->> 'last_name';
  
  -- Crear display_name combinando nombre y apellido
  display_name_val := TRIM(CONCAT(first_name_val, ' ', last_name_val));
  
  -- Si no hay display_name, usar email como fallback
  IF display_name_val = '' OR display_name_val IS NULL THEN
    display_name_val := split_part(NEW.email, '@', 1);
  END IF;
  
  INSERT INTO public.usuarios (id, email, nickname, first_name, last_name, display_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    display_name_val, -- nickname será igual a display_name por compatibilidad
    first_name_val,
    last_name_val,
    display_name_val
  );
  RETURN NEW;
END;
$$;

  -- Mensaje de confirmación
SELECT 'Campos first_name, last_name y display_name agregados a la tabla usuarios y trigger actualizado.' as resultado;