-- =====================================================
-- FUNCIONES MEJORADAS PARA MANEJO DE REDONDEO
-- =====================================================
-- Funciones adicionales para manejar casos especiales
-- de redondeo y validación manual
-- =====================================================

-- Función para ajustar manualmente un gasto específico
CREATE OR REPLACE FUNCTION ajustar_redondeo_gasto(gasto_id_param UUID)
RETURNS TABLE(
    mensaje TEXT,
    monto_original DECIMAL(10,2),
    descuento DECIMAL(10,2),
    monto_neto DECIMAL(10,2),
    total_detalle_antes DECIMAL(10,2),
    total_detalle_despues DECIMAL(10,2),
    diferencia_corregida DECIMAL(10,2)
)
AS $$
DECLARE
    gasto_monto DECIMAL(10,2);
    gasto_descuento DECIMAL(10,2);
    monto_neto_calc DECIMAL(10,2);
    total_detalle_antes_calc DECIMAL(10,2);
    total_detalle_despues_calc DECIMAL(10,2);
    diferencia DECIMAL(10,2);
    ultimo_detalle_id UUID;
BEGIN
    -- Verificar que el gasto existe
    SELECT g.monto, COALESCE(g.descuento, 0) INTO gasto_monto, gasto_descuento
    FROM gastos g
    WHERE g.id = gasto_id_param;
    
    IF gasto_monto IS NULL THEN
        RETURN QUERY SELECT 
            'Error: Gasto no encontrado'::TEXT,
            0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2),
            0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2);
        RETURN;
    END IF;
    
    -- Calcular valores
    monto_neto_calc := gasto_monto - gasto_descuento;
    
    SELECT COALESCE(SUM(gd.monto), 0) INTO total_detalle_antes_calc
    FROM gastos_detalle gd
    WHERE gd.gasto_id = gasto_id_param;
    
    diferencia := monto_neto_calc - total_detalle_antes_calc;
    
    -- Si no hay diferencia significativa, no hacer nada
    IF ABS(diferencia) <= 0.01 THEN
        RETURN QUERY SELECT 
            'No se requiere ajuste - diferencia menor a 0.01'::TEXT,
            gasto_monto, gasto_descuento, monto_neto_calc,
            total_detalle_antes_calc, total_detalle_antes_calc, 0::DECIMAL(10,2);
        RETURN;
    END IF;
    
    -- Obtener el último detalle
    SELECT gd.id INTO ultimo_detalle_id
    FROM gastos_detalle gd
    WHERE gd.gasto_id = gasto_id_param
    ORDER BY gd.created_at DESC, gd.id DESC
    LIMIT 1;
    
    IF ultimo_detalle_id IS NULL THEN
        RETURN QUERY SELECT 
            'Error: No se encontraron detalles para este gasto'::TEXT,
            gasto_monto, gasto_descuento, monto_neto_calc,
            total_detalle_antes_calc, total_detalle_antes_calc, 0::DECIMAL(10,2);
        RETURN;
    END IF;
    
    -- Aplicar ajuste
    UPDATE gastos_detalle
    SET monto = monto + diferencia
    WHERE id = ultimo_detalle_id;
    
    -- Calcular nuevo total
    SELECT COALESCE(SUM(gd.monto), 0) INTO total_detalle_despues_calc
    FROM gastos_detalle gd
    WHERE gd.gasto_id = gasto_id_param;
    
    RETURN QUERY SELECT 
        'Ajuste aplicado exitosamente'::TEXT,
        gasto_monto, gasto_descuento, monto_neto_calc,
        total_detalle_antes_calc, total_detalle_despues_calc, diferencia;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar la integridad de todos los gastos
CREATE OR REPLACE FUNCTION verificar_integridad_gastos()
RETURNS TABLE(
    gasto_id UUID,
    descripcion TEXT,
    monto_gasto DECIMAL(10,2),
    descuento DECIMAL(10,2),
    monto_neto DECIMAL(10,2),
    total_detalle DECIMAL(10,2),
    diferencia DECIMAL(10,2),
    estado TEXT
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.descripcion,
        g.monto,
        COALESCE(g.descuento, 0),
        g.monto - COALESCE(g.descuento, 0) as monto_neto_calc,
        COALESCE(SUM(gd.monto), 0) as total_detalle_calc,
        (g.monto - COALESCE(g.descuento, 0)) - COALESCE(SUM(gd.monto), 0) as diferencia_calc,
        CASE 
            WHEN ABS((g.monto - COALESCE(g.descuento, 0)) - COALESCE(SUM(gd.monto), 0)) <= 0.01 THEN 'OK'
            ELSE 'REQUIERE AJUSTE'
        END as estado_calc
    FROM gastos g
    LEFT JOIN gastos_detalle gd ON g.id = gd.gasto_id
    GROUP BY g.id, g.descripcion, g.monto, g.descuento
    ORDER BY ABS((g.monto - COALESCE(g.descuento, 0)) - COALESCE(SUM(gd.monto), 0)) DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para distribuir un monto entre participantes con manejo de redondeo
CREATE OR REPLACE FUNCTION distribuir_monto_con_redondeo(
    monto_total DECIMAL(10,2),
    num_participantes INTEGER
)
RETURNS DECIMAL(10,2)[] 
AS $$
DECLARE
    monto_por_participante DECIMAL(10,2);
    montos DECIMAL(10,2)[];
    total_distribuido DECIMAL(10,2);
    diferencia DECIMAL(10,2);
    i INTEGER;
BEGIN
    -- Calcular monto base por participante
    monto_por_participante := ROUND(monto_total / num_participantes, 2);
    
    -- Inicializar array con montos iguales
    FOR i IN 1..num_participantes LOOP
        montos[i] := monto_por_participante;
    END LOOP;
    
    -- Calcular total distribuido
    total_distribuido := monto_por_participante * num_participantes;
    
    -- Calcular diferencia por redondeo
    diferencia := monto_total - total_distribuido;
    
    -- Distribuir la diferencia en el último participante
    IF ABS(diferencia) > 0 THEN
        montos[num_participantes] := montos[num_participantes] + diferencia;
    END IF;
    
    RETURN montos;
END;
$$ LANGUAGE plpgsql;

-- Mensaje de confirmación
SELECT 'Funciones mejoradas de validación y redondeo creadas exitosamente.' as resultado;