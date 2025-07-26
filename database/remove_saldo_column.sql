-- Migración para eliminar la columna 'saldo' de la tabla gastos_detalle
-- Esta columna ya no es necesaria ya que los saldos se calculan dinámicamente
-- a partir de los pagos registrados en la tabla 'pagos'

-- 1. Eliminar la columna saldo de la tabla gastos_detalle
ALTER TABLE gastos_detalle 
DROP COLUMN IF EXISTS saldo;

-- 2. Eliminar cualquier índice relacionado con la columna saldo (si existe)
DROP INDEX IF EXISTS idx_gastos_detalle_saldo;

-- 3. Verificar que la columna fue eliminada correctamente
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'gastos_detalle' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Mensaje de confirmación
SELECT 'Columna saldo eliminada exitosamente de la tabla gastos_detalle.' as resultado;