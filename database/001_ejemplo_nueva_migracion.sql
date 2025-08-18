-- =====================================================
-- MIGRACIÓN 001: EJEMPLO DE NUEVA MIGRACIÓN
-- =====================================================
-- Fecha: 2024-01-XX
-- Descripción: Este es un archivo de ejemplo que muestra cómo crear
--              una nueva migración siguiendo las reglas del proyecto
-- Cambios:
--   - Agregar campo 'activo' a tabla usuarios
--   - Crear índice para el nuevo campo
--   - Actualizar función de búsqueda de usuarios
-- =====================================================

-- IMPORTANTE: Este es un archivo de EJEMPLO
-- NO ejecutar en producción sin modificar según necesidades reales

-- =====================================================
-- 1. VERIFICACIONES PREVIAS
-- =====================================================

-- Verificar que la migración base esté aplicada
DO $$
BEGIN
    -- Verificar que existan las tablas principales
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
        RAISE EXCEPTION 'La migración base no está aplicada. Ejecutar primero 000_migracion_completa.sql';
    END IF;
    
    RAISE NOTICE 'Verificaciones previas completadas exitosamente';
END $$;

-- =====================================================
-- 2. CAMBIOS EN ESTRUCTURA DE TABLAS
-- =====================================================

-- Agregar campo 'activo' a tabla usuarios si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='usuarios' AND column_name='activo') THEN
        ALTER TABLE usuarios ADD COLUMN activo BOOLEAN DEFAULT true;
        RAISE NOTICE 'Campo activo agregado a tabla usuarios';
    ELSE
        RAISE NOTICE 'Campo activo ya existe en tabla usuarios';
    END IF;
END $$;

-- =====================================================
-- 3. ÍNDICES
-- =====================================================

-- Crear índice para el campo activo si no existe
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- =====================================================
-- 4. FUNCIONES ACTUALIZADAS
-- =====================================================

-- Actualizar función de búsqueda para considerar solo usuarios activos
CREATE OR REPLACE FUNCTION buscar_usuarios(termino_busqueda TEXT)
RETURNS TABLE(
    id UUID,
    email TEXT,
    nickname TEXT
)
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.nickname
    FROM public.usuarios u
    WHERE 
        u.activo = true  -- Solo usuarios activos
        AND (
            LOWER(u.email) LIKE LOWER('%' || termino_busqueda || '%')
            OR LOWER(u.nickname) LIKE LOWER('%' || termino_busqueda || '%')
        )
    ORDER BY u.nickname
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. DATOS INICIALES (SI ES NECESARIO)
-- =====================================================

-- Marcar todos los usuarios existentes como activos
UPDATE usuarios SET activo = true WHERE activo IS NULL;

-- =====================================================
-- 6. VERIFICACIONES FINALES
-- =====================================================

DO $$
DECLARE
    usuarios_count INTEGER;
    usuarios_activos_count INTEGER;
BEGIN
    -- Verificar que el campo se agregó correctamente
    SELECT COUNT(*) INTO usuarios_count FROM usuarios;
    SELECT COUNT(*) INTO usuarios_activos_count FROM usuarios WHERE activo = true;
    
    RAISE NOTICE 'Total de usuarios: %', usuarios_count;
    RAISE NOTICE 'Usuarios activos: %', usuarios_activos_count;
    
    -- Verificar que el índice existe
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_usuarios_activo') THEN
        RAISE NOTICE 'Índice idx_usuarios_activo creado exitosamente';
    ELSE
        RAISE WARNING 'El índice idx_usuarios_activo no se creó correctamente';
    END IF;
END $$;

-- =====================================================
-- 7. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON COLUMN usuarios.activo IS 'Indica si el usuario está activo en el sistema';

-- =====================================================
-- 8. ROLLBACK (OPCIONAL)
-- =====================================================

-- Para hacer rollback de esta migración, ejecutar:
-- ALTER TABLE usuarios DROP COLUMN IF EXISTS activo;
-- DROP INDEX IF EXISTS idx_usuarios_activo;
-- -- Restaurar función original de buscar_usuarios

-- =====================================================
-- FIN DE LA MIGRACIÓN 001
-- =====================================================

SELECT 'Migración 001 aplicada exitosamente' as resultado;

-- RECORDATORIO: Después de aplicar esta migración,
-- actualizar el archivo 000_migracion_completa.sql
-- para incluir estos cambios en el estado completo