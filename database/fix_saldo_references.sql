-- Script para eliminar funciones y triggers que hacen referencia a la columna 'saldo'
-- que ya fue eliminada de la tabla gastos_detalle

-- Eliminar triggers que usan la columna saldo
DROP TRIGGER IF EXISTS trigger_auto_update_saldo_payment ON pagos;
DROP TRIGGER IF EXISTS trigger_auto_update_saldo_payment_delete ON pagos;

-- Eliminar funciones que intentan actualizar la columna saldo
DROP FUNCTION IF EXISTS auto_update_saldo_payment();
DROP FUNCTION IF EXISTS auto_update_saldo_payment_delete();
DROP FUNCTION IF EXISTS get_participante_balance(UUID);
DROP FUNCTION IF EXISTS get_balance_by_name(TEXT);
DROP FUNCTION IF EXISTS get_resumen_gastos_usuario(UUID);

-- Crear nueva función para obtener balance basado solo en la columna 'pagado'
CREATE OR REPLACE FUNCTION get_participante_balance(usuario_id_param UUID)
RETURNS DECIMAL(10,2)
SET search_path = ''
AS $$
DECLARE
    balance DECIMAL(10,2) := 0;
BEGIN
    -- Calcular balance basado en gastos_detalle usando solo la columna pagado
    SELECT COALESCE(SUM(CASE WHEN pagado = false THEN monto ELSE 0 END), 0) INTO balance
    FROM public.gastos_detalle
    WHERE usuario_id = usuario_id_param;
    
    RETURN balance;
END;
$$ LANGUAGE plpgsql;

-- Crear nueva función para obtener balance por nickname
CREATE OR REPLACE FUNCTION get_balance_by_name(nickname_param TEXT)
RETURNS DECIMAL(10,2)
SET search_path = ''
AS $$
DECLARE
    balance DECIMAL(10,2) := 0;
    user_id UUID;
BEGIN
    -- Obtener usuario_id por nickname
    SELECT id INTO user_id
    FROM public.usuarios
    WHERE nickname = nickname_param;
    
    IF user_id IS NOT NULL THEN
        -- Calcular balance para usuario registrado
        SELECT get_participante_balance(user_id) INTO balance;
    ELSE
        -- Calcular balance para nombre directo
        SELECT COALESCE(SUM(CASE WHEN pagado = false THEN monto ELSE 0 END), 0) INTO balance
        FROM public.gastos_detalle
        WHERE nombre_participante = nickname_param;
    END IF;
    
    RETURN balance;
END;
$$ LANGUAGE plpgsql;

-- Crear nueva función para resumen de gastos usando solo la columna pagado
CREATE OR REPLACE FUNCTION get_resumen_gastos_usuario(usuario_id_param UUID)
RETURNS TABLE(
    total_gastos DECIMAL(10,2),
    total_pagado DECIMAL(10,2),
    saldo_pendiente DECIMAL(10,2),
    gastos_count INTEGER
)
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(gd.monto), 0) as total_gastos,
        COALESCE(SUM(CASE WHEN gd.pagado = true THEN gd.monto ELSE 0 END), 0) as total_pagado,
        COALESCE(SUM(CASE WHEN gd.pagado = false THEN gd.monto ELSE 0 END), 0) as saldo_pendiente,
        COUNT(DISTINCT gd.gasto_id)::INTEGER as gastos_count
    FROM public.gastos_detalle gd
    WHERE gd.usuario_id = usuario_id_param;
END;
$$ LANGUAGE plpgsql;

-- Crear nuevos triggers simplificados que solo actualizan el estado 'pagado'
CREATE OR REPLACE FUNCTION auto_update_pagado_status()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    total_pagado DECIMAL(10,2);
    detalle_monto DECIMAL(10,2);
BEGIN
    -- Obtener el monto del detalle
    SELECT monto INTO detalle_monto
    FROM public.gastos_detalle
    WHERE id = NEW.gasto_detalle_id;
    
    -- Calcular total pagado
    SELECT COALESCE(SUM(monto), 0) INTO total_pagado
    FROM public.pagos
    WHERE gasto_detalle_id = NEW.gasto_detalle_id;
    
    -- Actualizar solo el estado pagado
    UPDATE public.gastos_detalle
    SET pagado = (total_pagado >= detalle_monto)
    WHERE id = NEW.gasto_detalle_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_update_pagado_status_delete()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    total_pagado DECIMAL(10,2);
    detalle_monto DECIMAL(10,2);
BEGIN
    -- Obtener el monto del detalle
    SELECT monto INTO detalle_monto
    FROM public.gastos_detalle
    WHERE id = OLD.gasto_detalle_id;
    
    -- Calcular total pagado después de la eliminación
    SELECT COALESCE(SUM(monto), 0) INTO total_pagado
    FROM public.pagos
    WHERE gasto_detalle_id = OLD.gasto_detalle_id;
    
    -- Actualizar solo el estado pagado
    UPDATE public.gastos_detalle
    SET pagado = (total_pagado >= detalle_monto)
    WHERE id = OLD.gasto_detalle_id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Aplicar nuevos triggers
CREATE TRIGGER trigger_auto_update_pagado_status
    AFTER INSERT OR UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION auto_update_pagado_status();

CREATE TRIGGER trigger_auto_update_pagado_status_delete
    AFTER DELETE ON pagos
    FOR EACH ROW EXECUTE FUNCTION auto_update_pagado_status_delete();

SELECT 'Referencias a la columna saldo eliminadas y funciones actualizadas para usar solo la columna pagado.' as resultado;