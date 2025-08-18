-- =====================================================
-- MIGRACIÓN 002: FUNCIÓN OBTENER PAGOS
-- =====================================================
-- Fecha: 2025-01-XX
-- Descripción: Crear función de base de datos para obtener pagos
--              filtrados por usuario y mes/año de vencimiento
-- =====================================================

-- Eliminar función si existe
DROP FUNCTION IF EXISTS obtener_pagos_usuario(UUID, INTEGER, INTEGER);

-- Crear función para obtener pagos filtrados
CREATE OR REPLACE FUNCTION obtener_pagos_usuario(
    p_usuario_id UUID,
    p_mes INTEGER DEFAULT NULL,
    p_año INTEGER DEFAULT NULL
)
RETURNS TABLE (
    pago_id UUID,
    pago_monto NUMERIC,
    pago_fecha_pago DATE,
    pago_medio_pago medio_pago,
    pago_notas TEXT,
    pago_created_at TIMESTAMP WITH TIME ZONE,
    pago_updated_at TIMESTAMP WITH TIME ZONE,
    gasto_detalle_id UUID,
    gasto_detalle_monto NUMERIC,
    gasto_detalle_vencimiento DATE,
    gasto_detalle_numero_cuota INTEGER,
    gasto_id UUID,
    gasto_descripcion TEXT,
    gasto_usuario_id UUID,
    usuario_id UUID,
    usuario_nickname TEXT,
    usuario_email TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as pago_id,
        p.monto as pago_monto,
        p.fecha_pago as pago_fecha_pago,
        p.medio_pago as pago_medio_pago,
        p.notas as pago_notas,
        p.created_at as pago_created_at,
        p.updated_at as pago_updated_at,
        gd.id as gasto_detalle_id,
        gd.monto as gasto_detalle_monto,
        gd.vencimiento as gasto_detalle_vencimiento,
        gd.numero_cuota as gasto_detalle_numero_cuota,
        g.id as gasto_id,
        g.descripcion as gasto_descripcion,
        g.usuario_id as gasto_usuario_id,
        u.id as usuario_id,
        u.nickname as usuario_nickname,
        u.email as usuario_email
    FROM pagos p
    INNER JOIN gastos_detalle gd ON p.gasto_detalle_id = gd.id
    INNER JOIN gastos g ON gd.gasto_id = g.id
    LEFT JOIN usuarios u ON gd.usuario_id = u.id
    WHERE 
        gd.usuario_id = p_usuario_id
        AND gd.vencimiento IS NOT NULL
        AND (
            p_mes IS NULL OR p_año IS NULL OR
            (EXTRACT(MONTH FROM gd.vencimiento) = p_mes AND EXTRACT(YEAR FROM gd.vencimiento) = p_año)
        )
    ORDER BY p.fecha_pago DESC;
END;
$$;

-- Agregar comentarios a la función
COMMENT ON FUNCTION obtener_pagos_usuario(UUID, INTEGER, INTEGER) IS 
'Obtiene los pagos de un usuario filtrados opcionalmente por mes y año de vencimiento del gasto_detalle';

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION obtener_pagos_usuario(UUID, INTEGER, INTEGER) TO authenticated;