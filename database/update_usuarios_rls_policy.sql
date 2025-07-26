-- =====================================================
-- ACTUALIZACIÓN DE POLÍTICAS RLS PARA USUARIOS
-- =====================================================
-- Este script modifica las políticas RLS para permitir que
-- los usuarios compartidos puedan ver datos básicos de otros usuarios
-- =====================================================

-- Eliminar la política restrictiva actual
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON usuarios;

-- Crear nuevas políticas más granulares

-- 1. Política para SELECT: Permitir ver datos básicos de todos los usuarios
CREATE POLICY "Usuarios pueden ver datos básicos" ON usuarios
    FOR SELECT USING (true);

-- 2. Política para UPDATE: Solo pueden modificar su propio perfil
CREATE POLICY "Usuarios pueden modificar solo su perfil" ON usuarios
    FOR UPDATE USING (id = auth.uid());

-- 3. Política para DELETE: Solo pueden eliminar su propio perfil
CREATE POLICY "Usuarios pueden eliminar solo su perfil" ON usuarios
    FOR DELETE USING (id = auth.uid());

-- 4. Política para INSERT: Permitir crear nuevos usuarios (para el sistema)
CREATE POLICY "Sistema puede crear usuarios" ON usuarios
    FOR INSERT WITH CHECK (true);

-- Verificar que las políticas se crearon correctamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'usuarios'
ORDER BY cmd, policyname;

-- Mensaje de confirmación
SELECT 'Políticas RLS actualizadas exitosamente. Los usuarios ahora pueden ver datos básicos de otros usuarios.' as resultado;