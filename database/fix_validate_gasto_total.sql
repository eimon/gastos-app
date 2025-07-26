-- Script para corregir la función validate_gasto_total()
-- para que considere el descuento en el cálculo

-- Eliminar la función existente
DROP FUNCTION IF EXISTS validate_gasto_total();

-- Crear la función corregida
CREATE OR REPLACE FUNCTION validate_gasto_total()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    gasto_monto DECIMAL(10,2);
    gasto_descuento DECIMAL(10,2);
    monto_neto DECIMAL(10,2);
    total_detalle DECIMAL(10,2);
BEGIN
    -- Obtener el monto y descuento del gasto
    SELECT monto, COALESCE(descuento, 0) INTO gasto_monto, gasto_descuento
    FROM public.gastos
    WHERE id = COALESCE(NEW.gasto_id, OLD.gasto_id);
    
    -- Calcular monto neto (monto - descuento)
    monto_neto := gasto_monto - gasto_descuento;
    
    -- Calcular total del detalle
    SELECT COALESCE(SUM(monto), 0) INTO total_detalle
    FROM public.gastos_detalle
    WHERE gasto_id = COALESCE(NEW.gasto_id, OLD.gasto_id);
    
    -- Validar que coincidan (con tolerancia de 0.01 para errores de redondeo)
    IF ABS(total_detalle - monto_neto) > 0.01 THEN
        RAISE EXCEPTION 'El total de gastos_detalle (%) no coincide con el monto neto del gasto (% - % = %)', total_detalle, gasto_monto, gasto_descuento, monto_neto;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
DROP TRIGGER IF EXISTS validate_gasto_total_trigger ON gastos_detalle;
CREATE TRIGGER validate_gasto_total_trigger
    AFTER INSERT OR UPDATE OR DELETE ON gastos_detalle
    FOR EACH ROW EXECUTE FUNCTION validate_gasto_total();

SELECT 'Función validate_gasto_total() corregida para considerar descuentos.' as resultado;