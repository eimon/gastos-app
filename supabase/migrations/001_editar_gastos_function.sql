-- Función RPC para editar gastos con validación de pagos
-- Esta función permite editar el nombre y/o monto de un gasto
-- Si el gasto tiene pagos asociados, solo permite editar el nombre
-- Si no tiene pagos, permite editar tanto nombre como monto

CREATE OR REPLACE FUNCTION editar_gasto(
  p_gasto_id UUID,
  p_usuario_id UUID,
  p_nueva_descripcion TEXT DEFAULT NULL,
  p_nuevo_monto DECIMAL DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gasto RECORD;
  v_tiene_pagos BOOLEAN := FALSE;
  v_resultado JSON;
  v_detalles RECORD;
  v_monto_por_cuota DECIMAL;
  v_monto_por_participante DECIMAL;
  v_participantes_count INTEGER;
BEGIN
  -- Verificar que el gasto existe y pertenece al usuario
  SELECT * INTO v_gasto
  FROM gastos
  WHERE id = p_gasto_id AND usuario_id = p_usuario_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Gasto no encontrado o sin permisos'
    );
  END IF;
  
  -- Verificar si el gasto tiene pagos asociados
  SELECT EXISTS(
    SELECT 1
    FROM gastos_detalle gd
    JOIN pagos p ON p.gasto_detalle_id = gd.id
    WHERE gd.gasto_id = p_gasto_id
  ) INTO v_tiene_pagos;
  
  -- Si tiene pagos y se intenta cambiar el monto, rechazar
  IF v_tiene_pagos AND p_nuevo_monto IS NOT NULL AND p_nuevo_monto != v_gasto.monto THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No se puede modificar el monto porque el gasto tiene pagos asociados. Solo se puede editar la descripción.'
    );
  END IF;
  
  -- Actualizar la descripción si se proporciona
  IF p_nueva_descripcion IS NOT NULL THEN
    UPDATE gastos
    SET descripcion = p_nueva_descripcion,
        updated_at = NOW()
    WHERE id = p_gasto_id;
  END IF;
  
  -- Si no tiene pagos y se proporciona nuevo monto, actualizar y recalcular detalles
  IF NOT v_tiene_pagos AND p_nuevo_monto IS NOT NULL AND p_nuevo_monto != v_gasto.monto THEN
    -- Actualizar el monto del gasto
    UPDATE gastos
    SET monto = p_nuevo_monto,
        updated_at = NOW()
    WHERE id = p_gasto_id;
    
    -- Contar participantes únicos
    SELECT COUNT(DISTINCT COALESCE(usuario_id::text, nombre_participante))
    INTO v_participantes_count
    FROM gastos_detalle
    WHERE gasto_id = p_gasto_id;
    
    -- Calcular nuevo monto por cuota
    v_monto_por_cuota := p_nuevo_monto / v_gasto.cuotas;
    
    -- Calcular nuevo monto por participante por cuota
    v_monto_por_participante := v_monto_por_cuota / v_participantes_count;
    
    -- Aplicar descuento si existe
    IF v_gasto.descuento IS NOT NULL AND v_gasto.descuento > 0 THEN
      IF v_gasto.tipo_descuento = 'uniforme' THEN
        -- Descuento uniforme: se aplica a todas las cuotas por igual
        v_monto_por_participante := v_monto_por_participante - (v_gasto.descuento / v_gasto.cuotas / v_participantes_count);
      ELSIF v_gasto.tipo_descuento = 'prorrateo' THEN
        -- Descuento por prorrateo: se aplica solo a la primera cuota
        -- Para simplificar, aplicamos el descuento proporcionalmente
        v_monto_por_participante := v_monto_por_participante * (1 - (v_gasto.descuento / p_nuevo_monto));
      END IF;
    END IF;
    
    -- Actualizar todos los detalles del gasto
    UPDATE gastos_detalle
    SET monto = ROUND(v_monto_por_participante, 2),
        updated_at = NOW()
    WHERE gasto_id = p_gasto_id;
    
    -- Ajustar diferencias de redondeo en el primer detalle de cada cuota
    FOR v_detalles IN
      SELECT numero_cuota,
             SUM(monto) as total_cuota,
             (SELECT id FROM gastos_detalle gd2 
              WHERE gd2.gasto_id = p_gasto_id 
              AND gd2.numero_cuota = gastos_detalle.numero_cuota 
              ORDER BY gd2.created_at ASC 
              LIMIT 1) as primer_detalle_id
      FROM gastos_detalle
      WHERE gasto_id = p_gasto_id
      GROUP BY numero_cuota
    LOOP
      DECLARE
        v_diferencia DECIMAL;
      BEGIN
        v_diferencia := v_monto_por_cuota - v_detalles.total_cuota;
        
        IF ABS(v_diferencia) > 0.01 THEN
          UPDATE gastos_detalle
          SET monto = monto + v_diferencia,
              updated_at = NOW()
          WHERE id = v_detalles.primer_detalle_id;
        END IF;
      END;
    END LOOP;
  END IF;
  
  -- Retornar resultado exitoso
  v_resultado := json_build_object(
    'success', true,
    'message', CASE
      WHEN p_nueva_descripcion IS NOT NULL AND p_nuevo_monto IS NOT NULL THEN 'Descripción y monto actualizados correctamente'
      WHEN p_nueva_descripcion IS NOT NULL THEN 'Descripción actualizada correctamente'
      WHEN p_nuevo_monto IS NOT NULL THEN 'Monto actualizado correctamente'
      ELSE 'No se realizaron cambios'
    END,
    'tiene_pagos', v_tiene_pagos,
    'monto_anterior', v_gasto.monto,
    'monto_nuevo', COALESCE(p_nuevo_monto, v_gasto.monto)
  );
  
  RETURN v_resultado;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Error interno: ' || SQLERRM
    );
END;
$$;

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION editar_gasto(UUID, UUID, TEXT, DECIMAL) TO authenticated;

-- Comentario de la función
COMMENT ON FUNCTION editar_gasto(UUID, UUID, TEXT, DECIMAL) IS 
'Función para editar gastos con validación de pagos. Permite editar descripción siempre, y monto solo si no tiene pagos asociados.';