-- =====================================================
-- FUNCIÓN RPC PARA DATOS UNIFICADOS DE RESUMEN MENSUAL
-- =====================================================
-- Esta función devuelve todos los datos necesarios para el resumen mensual:
-- 1. Gastos totales por tipo (fijo/variable) sin importar si están pagados
-- 2. Gastos por pagar del usuario (gastos_detalle no pagados)
-- 3. Gastos que le adeudan (gastos_detalle de otros en gastos creados por el usuario)
-- =====================================================

CREATE OR REPLACE FUNCTION obtener_datos_resumen_mensual(
    p_usuario_id UUID,
    p_mes INTEGER DEFAULT NULL,
    p_año INTEGER DEFAULT NULL
)
RETURNS TABLE(
    -- Totales por tipo (para gráfico circular)
    gastos_fijos DECIMAL(10,2),
    gastos_variables DECIMAL(10,2),
    total_gastos DECIMAL(10,2),
    
    -- Resumen financiero
    por_pagar DECIMAL(10,2),
    me_adeudan DECIMAL(10,2),
    
    -- Contadores adicionales
    cantidad_gastos_fijos INTEGER,
    cantidad_gastos_variables INTEGER,
    cantidad_detalles_por_pagar INTEGER,
    cantidad_detalles_adeudados INTEGER
)
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_gastos_fijos DECIMAL(10,2) := 0;
    v_gastos_variables DECIMAL(10,2) := 0;
    v_por_pagar DECIMAL(10,2) := 0;
    v_me_adeudan DECIMAL(10,2) := 0;
    v_cant_fijos INTEGER := 0;
    v_cant_variables INTEGER := 0;
    v_cant_por_pagar INTEGER := 0;
    v_cant_adeudados INTEGER := 0;
BEGIN
    -- =====================================================
    -- 1. CALCULAR GASTOS TOTALES POR TIPO (PARA GRÁFICO)
    -- =====================================================
    -- Sumar todos los gastos_detalle del usuario, agrupados por tipo de gasto
    -- Sin importar si están pagados o no
    
    SELECT 
        COALESCE(SUM(CASE WHEN g.tipo = 'personal' AND g.es_recurrente = true THEN gd.monto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN g.tipo = 'personal' AND (g.es_recurrente = false OR g.es_recurrente IS NULL) THEN gd.monto 
                         WHEN g.tipo = 'compartido' THEN gd.monto ELSE 0 END), 0),
        COALESCE(COUNT(CASE WHEN g.tipo = 'personal' AND g.es_recurrente = true THEN 1 END), 0),
        COALESCE(COUNT(CASE WHEN g.tipo = 'personal' AND (g.es_recurrente = false OR g.es_recurrente IS NULL) THEN 1 
                           WHEN g.tipo = 'compartido' THEN 1 END), 0)
    INTO v_gastos_fijos, v_gastos_variables, v_cant_fijos, v_cant_variables
    FROM public.gastos_detalle gd
    INNER JOIN public.gastos g ON gd.gasto_id = g.id
    WHERE gd.usuario_id = p_usuario_id
        AND (p_mes IS NULL OR EXTRACT(MONTH FROM gd.vencimiento) = p_mes)
        AND (p_año IS NULL OR EXTRACT(YEAR FROM gd.vencimiento) = p_año);
    
    -- =====================================================
    -- 2. CALCULAR GASTOS POR PAGAR DEL USUARIO
    -- =====================================================
    -- Sumar gastos_detalle del usuario que no están completamente pagados
    
    SELECT 
        COALESCE(SUM(gd.monto - COALESCE(pagos_sum.total_pagado, 0)), 0),
        COALESCE(COUNT(*), 0)
    INTO v_por_pagar, v_cant_por_pagar
    FROM public.gastos_detalle gd
    LEFT JOIN (
        SELECT 
            p.gasto_detalle_id,
            SUM(p.monto) as total_pagado
        FROM public.pagos p
        GROUP BY p.gasto_detalle_id
    ) pagos_sum ON gd.id = pagos_sum.gasto_detalle_id
    WHERE gd.usuario_id = p_usuario_id
        AND (p_mes IS NULL OR EXTRACT(MONTH FROM gd.vencimiento) = p_mes)
        AND (p_año IS NULL OR EXTRACT(YEAR FROM gd.vencimiento) = p_año)
        AND (gd.monto > COALESCE(pagos_sum.total_pagado, 0)); -- Solo los que tienen saldo pendiente
    
    -- =====================================================
    -- 3. CALCULAR LO QUE LE ADEUDAN AL USUARIO
    -- =====================================================
    -- Sumar gastos_detalle de otros usuarios en gastos creados por el usuario actual
    -- que no están completamente pagados
    
    SELECT 
        COALESCE(SUM(gd.monto - COALESCE(pagos_sum.total_pagado, 0)), 0),
        COALESCE(COUNT(*), 0)
    INTO v_me_adeudan, v_cant_adeudados
    FROM public.gastos_detalle gd
    INNER JOIN public.gastos g ON gd.gasto_id = g.id
    LEFT JOIN (
        SELECT 
            p.gasto_detalle_id,
            SUM(p.monto) as total_pagado
        FROM public.pagos p
        GROUP BY p.gasto_detalle_id
    ) pagos_sum ON gd.id = pagos_sum.gasto_detalle_id
    WHERE g.usuario_id = p_usuario_id  -- Gastos creados por el usuario
        AND (gd.usuario_id != p_usuario_id OR gd.usuario_id IS NULL)  -- Detalle pertenece a otro usuario o participante externo
        AND (p_mes IS NULL OR EXTRACT(MONTH FROM gd.vencimiento) = p_mes)
        AND (p_año IS NULL OR EXTRACT(YEAR FROM gd.vencimiento) = p_año)
        AND (gd.monto > COALESCE(pagos_sum.total_pagado, 0)); -- Solo los que tienen saldo pendiente
    
    -- =====================================================
    -- 4. RETORNAR RESULTADOS
    -- =====================================================
    
    RETURN QUERY SELECT 
        v_gastos_fijos,
        v_gastos_variables,
        v_gastos_fijos + v_gastos_variables,
        v_por_pagar,
        v_me_adeudan,
        v_cant_fijos,
        v_cant_variables,
        v_cant_por_pagar,
        v_cant_adeudados;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================
-- 
-- PARÁMETROS:
-- - p_usuario_id: ID del usuario para el cual calcular el resumen
-- - p_mes: Mes a filtrar (1-12), NULL para todos los meses
-- - p_año: Año a filtrar, NULL para todos los años
--
-- RETORNA:
-- - gastos_fijos: Suma total de gastos recurrentes del usuario
-- - gastos_variables: Suma total de gastos no recurrentes + compartidos del usuario
-- - total_gastos: Suma de gastos_fijos + gastos_variables
-- - por_pagar: Suma de saldos pendientes de pago del usuario
-- - me_adeudan: Suma de saldos que otros usuarios le deben al usuario
-- - cantidad_*: Contadores de registros para cada categoría
--
-- EJEMPLO DE USO:
-- SELECT * FROM obtener_datos_resumen_mensual('user-uuid', 12, 2024);
-- SELECT * FROM obtener_datos_resumen_mensual('user-uuid', NULL, NULL); -- Todos los datos
--