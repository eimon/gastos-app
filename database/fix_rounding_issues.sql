-- =====================================================
-- SCRIPT PARA CORREGIR PROBLEMAS DE REDONDEO EXISTENTES
-- =====================================================
-- Este script identifica y corrige gastos que tienen
-- diferencias de redondeo entre el monto neto y el total
-- de gastos_detalle
-- =====================================================

-- Función temporal para identificar y corregir problemas de redondeo
CREATE OR REPLACE FUNCTION fix_existing_rounding_issues()
RETURNS TABLE(
    gasto_id UUID,
    monto_original DECIMAL(10,2),
    descuento DECIMAL(10,2),
    monto_neto DECIMAL(10,2),
    total_detalle_antes DECIMAL(10,2),
    diferencia DECIMAL(10,2),
    detalle_ajustado UUID,
    monto_ajustado DECIMAL(10,2)
)
AS $$
DECLARE
    gasto_record RECORD;
    ultimo_detalle_id UUID;
    diferencia_calc DECIMAL(10,2);
    monto_neto_calc DECIMAL(10,2);
    total_detalle_calc DECIMAL(10,2);
BEGIN
    -- Iterar sobre todos los gastos
    FOR gasto_record IN 
        SELECT g.id, g.monto, COALESCE(g.descuento, 0) as desc
        FROM gastos g
    LOOP
        -- Calcular monto neto
        monto_neto_calc := gasto_record.monto - gasto_record.desc;
        
        -- Calcular total actual de detalles
        SELECT COALESCE(SUM(gd.monto), 0) INTO total_detalle_calc
        FROM gastos_detalle gd
        WHERE gd.gasto_id = gasto_record.id;
        
        -- Calcular diferencia
        diferencia_calc := monto_neto_calc - total_detalle_calc;
        
        -- Si hay diferencia significativa, corregir
        IF ABS(diferencia_calc) > 0.01 THEN
            -- Obtener el último detalle para este gasto
            SELECT gd.id INTO ultimo_detalle_id
            FROM gastos_detalle gd
            WHERE gd.gasto_id = gasto_record.id
            ORDER BY gd.created_at DESC, gd.id DESC
            LIMIT 1;
            
            -- Si existe un detalle, ajustarlo
            IF ultimo_detalle_id IS NOT NULL THEN
                -- Actualizar el monto del último detalle
                UPDATE gastos_detalle
                SET monto = monto + diferencia_calc
                WHERE id = ultimo_detalle_id;
                
                -- Retornar información del ajuste
                RETURN QUERY SELECT 
                    gasto_record.id,
                    gasto_record.monto,
                    gasto_record.desc,
                    monto_neto_calc,
                    total_detalle_calc,
                    diferencia_calc,
                    ultimo_detalle_id,
                    (SELECT monto FROM gastos_detalle WHERE id = ultimo_detalle_id);
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la corrección y mostrar resultados
SELECT 
    'Gasto ID: ' || gasto_id::text || 
    ' | Diferencia corregida: ' || diferencia::text || 
    ' | Detalle ajustado: ' || detalle_ajustado::text ||
    ' | Nuevo monto: ' || monto_ajustado::text as resultado
FROM fix_existing_rounding_issues();

-- Limpiar función temporal
DROP FUNCTION IF EXISTS fix_existing_rounding_issues();

-- Mensaje de confirmación
SELECT 'Corrección de problemas de redondeo completada.' as status;