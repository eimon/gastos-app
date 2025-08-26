-- =====================================================
-- MIGRACIÓN COMPLETA PARA GASTOS APP - ESTADO ACTUAL
-- =====================================================
-- Esta migración contiene el estado completo actual de la base de datos
-- Incluye:
-- 1. Tipos ENUM
-- 2. Tablas principales
-- 3. Tabla de solicitudes de pago
-- 4. Índices de optimización
-- 5. Triggers automáticos
-- 6. Funciones de validación y balance
-- 7. Funciones RPC para solicitudes de pago
-- 8. Políticas RLS
-- 9. Función RPC para búsqueda de usuarios
-- =====================================================

-- =====================================================
-- 1. TIPOS ENUM
-- =====================================================

-- Tipo de gasto
CREATE TYPE tipo_gasto AS ENUM ('personal', 'compartido');

-- Tipo de descuento
CREATE TYPE tipo_descuento AS ENUM ('uniforme', 'prorrateo');

-- Medio de pago (valores en minúsculas según reglas del proyecto)
CREATE TYPE medio_pago AS ENUM ('efectivo', 'transferencia', 'descuento');

-- Estado de solicitudes de pago
CREATE TYPE estado_solicitud AS ENUM ('pendiente', 'aceptada', 'rechazada');

-- =====================================================
-- 2. TABLAS PRINCIPALES
-- =====================================================

-- Tabla usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla gastos
CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descripcion TEXT NOT NULL,
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    cuotas INTEGER DEFAULT 1 CHECK (cuotas > 0),
    descuento DECIMAL(10,2) DEFAULT 0 CHECK (descuento >= 0),
    tipo_descuento tipo_descuento DEFAULT 'uniforme',
    tipo tipo_gasto DEFAULT 'personal',
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    es_recurrente BOOLEAN DEFAULT FALSE,
    gasto_padre_id UUID REFERENCES gastos(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla gastos_detalle
CREATE TABLE gastos_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gasto_id UUID NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre_participante TEXT,
    monto DECIMAL(10,2) NOT NULL CHECK (monto >= 0),
    vencimiento DATE,
    numero_cuota INTEGER DEFAULT 1 CHECK (numero_cuota > 0),
    pagado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_participante CHECK (
        (usuario_id IS NOT NULL AND nombre_participante IS NULL) OR
        (usuario_id IS NULL AND nombre_participante IS NOT NULL)
    )
);

-- Tabla pagos
CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gasto_detalle_id UUID NOT NULL REFERENCES gastos_detalle(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    medio_pago medio_pago NOT NULL DEFAULT 'efectivo',
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla solicitudes_pago
CREATE TABLE solicitudes_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gasto_detalle_id UUID NOT NULL REFERENCES gastos_detalle(id) ON DELETE CASCADE,
    usuario_solicitante_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    usuario_creador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    estado estado_solicitud NOT NULL DEFAULT 'pendiente',
    fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_respuesta TIMESTAMP WITH TIME ZONE,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: no puede haber múltiples solicitudes pendientes para el mismo gasto_detalle
    UNIQUE(gasto_detalle_id, estado) DEFERRABLE INITIALLY DEFERRED
);

-- =====================================================
-- 3. ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- Índices para gastos
CREATE INDEX idx_gastos_usuario_id ON gastos(usuario_id);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_gastos_tipo ON gastos(tipo);
CREATE INDEX idx_gastos_es_recurrente ON gastos(es_recurrente);
CREATE INDEX idx_gastos_gasto_padre_id ON gastos(gasto_padre_id);

-- Índices para gastos_detalle
CREATE INDEX idx_gastos_detalle_gasto_id ON gastos_detalle(gasto_id);
CREATE INDEX idx_gastos_detalle_usuario_id ON gastos_detalle(usuario_id);
CREATE INDEX idx_gastos_detalle_pagado ON gastos_detalle(pagado);
CREATE INDEX idx_gastos_detalle_numero_cuota ON gastos_detalle(numero_cuota);
CREATE INDEX idx_gastos_detalle_vencimiento ON gastos_detalle(vencimiento);

-- Índices para pagos
CREATE INDEX idx_pagos_gasto_detalle_id ON pagos(gasto_detalle_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago);
CREATE INDEX idx_pagos_medio_pago ON pagos(medio_pago);

-- Índices para solicitudes_pago
CREATE INDEX idx_solicitudes_pago_gasto_detalle_id ON solicitudes_pago(gasto_detalle_id);
CREATE INDEX idx_solicitudes_pago_usuario_solicitante_id ON solicitudes_pago(usuario_solicitante_id);
CREATE INDEX idx_solicitudes_pago_usuario_creador_id ON solicitudes_pago(usuario_creador_id);
CREATE INDEX idx_solicitudes_pago_estado ON solicitudes_pago(estado);
CREATE INDEX idx_solicitudes_pago_fecha_solicitud ON solicitudes_pago(fecha_solicitud);

-- =====================================================
-- 4. TRIGGERS PARA UPDATED_AT
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers a todas las tablas
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gastos_updated_at
    BEFORE UPDATE ON gastos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gastos_detalle_updated_at
    BEFORE UPDATE ON gastos_detalle
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pagos_updated_at
    BEFORE UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_solicitudes_pago_updated_at
    BEFORE UPDATE ON solicitudes_pago
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. FUNCIONES DE VALIDACIÓN
-- =====================================================

-- Función para validar que el total de detalles coincida con el gasto
CREATE OR REPLACE FUNCTION validate_gasto_total()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    gasto_monto DECIMAL(10,2);
    total_detalles DECIMAL(10,2);
BEGIN
    -- Obtener el monto del gasto
    SELECT monto INTO gasto_monto
    FROM public.gastos
    WHERE id = COALESCE(NEW.gasto_id, OLD.gasto_id);
    
    -- Calcular total de detalles
    SELECT COALESCE(SUM(monto), 0) INTO total_detalles
    FROM public.gastos_detalle
    WHERE gasto_id = COALESCE(NEW.gasto_id, OLD.gasto_id);
    
    -- Validar que no exceda el monto del gasto
    IF total_detalles > gasto_monto THEN
        RAISE EXCEPTION 'El total de los detalles (%) excede el monto del gasto (%)', total_detalles, gasto_monto;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de validación
CREATE TRIGGER trigger_validate_gasto_total
    AFTER INSERT OR UPDATE OR DELETE ON gastos_detalle
    FOR EACH ROW EXECUTE FUNCTION validate_gasto_total();

-- =====================================================
-- 6. FUNCIONES PARA ACTUALIZAR ESTADO DE PAGOS
-- =====================================================

-- Función para actualizar estado pagado cuando se registra un pago
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

-- Función para cuando se elimina un pago
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

-- Aplicar triggers de pagos
CREATE TRIGGER trigger_auto_update_pagado_status
    AFTER INSERT OR UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION auto_update_pagado_status();

CREATE TRIGGER trigger_auto_update_pagado_status_delete
    AFTER DELETE ON pagos
    FOR EACH ROW EXECUTE FUNCTION auto_update_pagado_status_delete();

-- =====================================================
-- 7. FUNCIONES DE BALANCE Y RESUMEN
-- =====================================================

-- Función para obtener balance de un usuario
CREATE OR REPLACE FUNCTION get_participante_balance(usuario_id_param UUID)
RETURNS DECIMAL(10,2)
SET search_path = ''
AS $$
DECLARE
    balance DECIMAL(10,2) := 0;
BEGIN
    -- Calcular balance basado en gastos_detalle no pagados
    SELECT COALESCE(SUM(gd.monto), 0) INTO balance
    FROM public.gastos_detalle gd
    WHERE gd.usuario_id = usuario_id_param AND gd.pagado = false;
    
    RETURN balance;
END;
$$ LANGUAGE plpgsql;

-- Función auxiliar para verificar si un usuario puede ver un gasto
CREATE OR REPLACE FUNCTION user_can_view_gasto(gasto_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- El usuario puede ver el gasto si:
    -- 1. Es el creador del gasto
    -- 2. Participa en el gasto (tiene un detalle asociado)
    RETURN EXISTS (
        SELECT 1 FROM public.gastos g
        WHERE g.id = gasto_id_param AND g.usuario_id = user_id_param
    ) OR EXISTS (
        SELECT 1 FROM public.gastos_detalle gd
        WHERE gd.gasto_id = gasto_id_param AND gd.usuario_id = user_id_param
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. FUNCIONES RPC PARA SOLICITUDES DE PAGO
-- =====================================================

-- Función para crear una solicitud de pago
CREATE OR REPLACE FUNCTION crear_solicitud_pago(
    gasto_detalle_id_param UUID,
    usuario_creador_id_param UUID,
    monto_param DECIMAL(10,2),
    notas_param TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    solicitud_id UUID;
    usuario_solicitante_id_var UUID;
    gasto_detalle_monto DECIMAL(10,2);
    gasto_detalle_pagado BOOLEAN;
BEGIN
    -- Obtener el ID del usuario actual
    usuario_solicitante_id_var := auth.uid();
    
    -- Verificar que el usuario actual no sea el creador del gasto
    IF usuario_solicitante_id_var = usuario_creador_id_param THEN
        RAISE EXCEPTION 'No puedes crear una solicitud de pago para tu propio gasto';
    END IF;
    
    -- Verificar que el gasto_detalle existe y obtener información
    SELECT monto, pagado INTO gasto_detalle_monto, gasto_detalle_pagado
    FROM public.gastos_detalle
    WHERE id = gasto_detalle_id_param AND usuario_id = usuario_solicitante_id_var;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gasto detalle no encontrado o no pertenece al usuario actual';
    END IF;
    
    -- Verificar que el gasto no esté ya pagado
    IF gasto_detalle_pagado THEN
        RAISE EXCEPTION 'Este gasto ya está marcado como pagado';
    END IF;
    
    -- Verificar que el monto solicitado no exceda el monto del gasto_detalle
    IF monto_param > gasto_detalle_monto THEN
        RAISE EXCEPTION 'El monto solicitado no puede ser mayor al monto del gasto';
    END IF;
    
    -- Verificar que no exista una solicitud pendiente para este gasto_detalle
    IF EXISTS (
        SELECT 1 FROM public.solicitudes_pago 
        WHERE gasto_detalle_id = gasto_detalle_id_param 
        AND estado = 'pendiente'
    ) THEN
        RAISE EXCEPTION 'Ya existe una solicitud pendiente para este gasto';
    END IF;
    
    -- Crear la solicitud
    INSERT INTO public.solicitudes_pago (
        gasto_detalle_id,
        usuario_solicitante_id,
        usuario_creador_id,
        monto,
        notas
    ) VALUES (
        gasto_detalle_id_param,
        usuario_solicitante_id_var,
        usuario_creador_id_param,
        monto_param,
        notas_param
    ) RETURNING id INTO solicitud_id;
    
    RETURN solicitud_id;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener solicitudes recibidas (para el creador del gasto)
CREATE OR REPLACE FUNCTION obtener_solicitudes_recibidas(usuario_creador_id_param UUID)
RETURNS TABLE(
    solicitud_id UUID,
    gasto_detalle_id UUID,
    gasto_id UUID,
    gasto_descripcion TEXT,
    usuario_solicitante_id UUID,
    usuario_creador_id UUID,
    solicitante_email TEXT,
    solicitante_nickname TEXT,
    monto DECIMAL(10,2),
    estado estado_solicitud,
    fecha_solicitud TIMESTAMP WITH TIME ZONE,
    fecha_respuesta TIMESTAMP WITH TIME ZONE,
    notas TEXT,
    numero_cuota INTEGER,
    vencimiento DATE
)
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id::UUID as solicitud_id,
        sp.gasto_detalle_id::UUID,
        g.id::UUID as gasto_id,
        g.descripcion::TEXT as gasto_descripcion,
        sp.usuario_solicitante_id::UUID,
        sp.usuario_creador_id::UUID,
        u.email::TEXT as solicitante_email,
        u.nickname::TEXT as solicitante_nickname,
        sp.monto::DECIMAL(10,2),
        sp.estado::estado_solicitud,
        sp.fecha_solicitud::TIMESTAMP WITH TIME ZONE,
        sp.fecha_respuesta::TIMESTAMP WITH TIME ZONE,
        sp.notas::TEXT,
        gd.numero_cuota::INTEGER,
        gd.vencimiento::DATE
    FROM solicitudes_pago sp
    INNER JOIN gastos_detalle gd ON sp.gasto_detalle_id = gd.id
    INNER JOIN gastos g ON gd.gasto_id = g.id
    INNER JOIN usuarios u ON sp.usuario_solicitante_id = u.id
    WHERE sp.usuario_creador_id = usuario_creador_id_param
    ORDER BY sp.fecha_solicitud DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener solicitudes enviadas (para el participante)
CREATE OR REPLACE FUNCTION obtener_solicitudes_enviadas(usuario_solicitante_id_param UUID)
RETURNS TABLE(
    solicitud_id UUID,
    gasto_detalle_id UUID,
    gasto_id UUID,
    gasto_descripcion TEXT,
    usuario_solicitante_id UUID,
    usuario_creador_id UUID,
    creador_email TEXT,
    creador_nickname TEXT,
    monto DECIMAL(10,2),
    estado estado_solicitud,
    fecha_solicitud TIMESTAMP WITH TIME ZONE,
    fecha_respuesta TIMESTAMP WITH TIME ZONE,
    notas TEXT,
    numero_cuota INTEGER,
    vencimiento DATE
)
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id::UUID as solicitud_id,
        sp.gasto_detalle_id::UUID,
        g.id::UUID as gasto_id,
        g.descripcion::TEXT as gasto_descripcion,
        sp.usuario_solicitante_id::UUID,
        sp.usuario_creador_id::UUID,
        u.email::TEXT as creador_email,
        u.nickname::TEXT as creador_nickname,
        sp.monto::DECIMAL(10,2),
        sp.estado::estado_solicitud,
        sp.fecha_solicitud::TIMESTAMP WITH TIME ZONE,
        sp.fecha_respuesta::TIMESTAMP WITH TIME ZONE,
        sp.notas::TEXT,
        gd.numero_cuota::INTEGER,
        gd.vencimiento::DATE
    FROM solicitudes_pago sp
    INNER JOIN gastos_detalle gd ON sp.gasto_detalle_id = gd.id
    INNER JOIN gastos g ON gd.gasto_id = g.id
    INNER JOIN usuarios u ON sp.usuario_creador_id = u.id
    WHERE sp.usuario_solicitante_id = usuario_solicitante_id_param
    ORDER BY sp.fecha_solicitud DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para aceptar una solicitud de pago
CREATE OR REPLACE FUNCTION aceptar_solicitud_pago(
    solicitud_id_param UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    solicitud_record RECORD;
    usuario_actual UUID;
BEGIN
    -- Obtener el ID del usuario actual
    usuario_actual := auth.uid();
    
    -- Obtener información de la solicitud
    SELECT * INTO solicitud_record
    FROM public.solicitudes_pago
    WHERE id = solicitud_id_param
    AND usuario_creador_id = usuario_actual
    AND estado = 'pendiente';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada, no autorizada o ya procesada';
    END IF;
    
    -- Actualizar el estado de la solicitud
    UPDATE public.solicitudes_pago
    SET estado = 'aceptada',
        fecha_respuesta = NOW()
    WHERE id = solicitud_id_param;
    
    -- Crear el pago automáticamente
    INSERT INTO public.pagos (
        gasto_detalle_id,
        monto,
        medio_pago,
        fecha_pago,
        notas
    ) VALUES (
        solicitud_record.gasto_detalle_id,
        solicitud_record.monto,
        'transferencia',
        CURRENT_DATE,
        'Pago generado automáticamente por solicitud aceptada'
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Función para rechazar una solicitud de pago
CREATE OR REPLACE FUNCTION rechazar_solicitud_pago(
    solicitud_id_param UUID,
    notas_rechazo TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    usuario_actual UUID;
BEGIN
    -- Obtener el ID del usuario actual
    usuario_actual := auth.uid();
    
    -- Verificar que la solicitud existe y pertenece al usuario
    IF NOT EXISTS (
        SELECT 1 FROM public.solicitudes_pago
        WHERE id = solicitud_id_param
        AND usuario_creador_id = usuario_actual
        AND estado = 'pendiente'
    ) THEN
        RAISE EXCEPTION 'Solicitud no encontrada, no autorizada o ya procesada';
    END IF;
    
    -- Actualizar el estado de la solicitud
    UPDATE public.solicitudes_pago
    SET estado = 'rechazada',
        fecha_respuesta = NOW(),
        notas = COALESCE(notas_rechazo, notas)
    WHERE id = solicitud_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. FUNCIÓN RPC PARA BÚSQUEDA DE USUARIOS
-- =====================================================

-- Función para buscar usuarios por email o nickname
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
        LOWER(u.email) LIKE LOWER('%' || termino_busqueda || '%')
        OR LOWER(u.nickname) LIKE LOWER('%' || termino_busqueda || '%')
    ORDER BY u.nickname
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Otorgar permisos de ejecución para buscar_usuarios
GRANT EXECUTE ON FUNCTION buscar_usuarios(TEXT) TO authenticated;

-- Función para obtener gastos compartidos donde el usuario participa pero no es creador
CREATE OR REPLACE FUNCTION obtener_gastos_compartidos(usuario_actual_id UUID)
RETURNS TABLE(
    gasto_id UUID,
    descripcion TEXT,
    monto_total DECIMAL(10,2),
    fecha DATE,
    cuotas INTEGER,
    descuento DECIMAL(10,2),
    tipo_descuento tipo_descuento,
    es_recurrente BOOLEAN,
    gasto_padre_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    creador_id UUID,
    creador_email TEXT,
    creador_nickname TEXT,
    mi_detalle_id UUID,
    mi_monto DECIMAL(10,2),
    mi_vencimiento DATE,
    mi_numero_cuota INTEGER,
    mi_pagado BOOLEAN,
    mi_monto_pagado DECIMAL(10,2)
)
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        g.id as gasto_id,
        g.descripcion,
        g.monto as monto_total,
        g.fecha,
        g.cuotas,
        g.descuento,
        g.tipo_descuento,
        g.es_recurrente,
        g.gasto_padre_id,
        g.created_at,
        g.updated_at,
        g.usuario_id as creador_id,
        u_creador.email as creador_email,
        u_creador.nickname as creador_nickname,
        gd.id as mi_detalle_id,
        gd.monto as mi_monto,
        gd.vencimiento as mi_vencimiento,
        gd.numero_cuota as mi_numero_cuota,
        gd.pagado as mi_pagado,
        COALESCE(SUM(p.monto), 0) as mi_monto_pagado
    FROM public.gastos g
    INNER JOIN public.gastos_detalle gd ON g.id = gd.gasto_id
    INNER JOIN public.usuarios u_creador ON g.usuario_id = u_creador.id
    LEFT JOIN public.pagos p ON gd.id = p.gasto_detalle_id
    WHERE gd.usuario_id = usuario_actual_id
    AND g.usuario_id != usuario_actual_id  -- Solo gastos donde NO soy el creador
    AND g.tipo = 'compartido'  -- Solo gastos compartidos
    GROUP BY g.id, g.descripcion, g.monto, g.fecha, g.cuotas, g.descuento, 
             g.tipo_descuento, g.es_recurrente, g.gasto_padre_id, g.created_at, 
             g.updated_at, g.usuario_id, u_creador.email, u_creador.nickname,
             gd.id, gd.monto, gd.vencimiento, gd.numero_cuota, gd.pagado
    ORDER BY g.fecha DESC, gd.vencimiento DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_pago ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "Los usuarios pueden ver todos los usuarios" ON usuarios
    FOR SELECT USING (true);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil" ON usuarios
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden insertar su propio perfil" ON usuarios
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para gastos (simplificadas para evitar recursión)
CREATE POLICY "Los usuarios pueden gestionar sus gastos" ON gastos
    FOR ALL USING (auth.uid() = usuario_id);

-- Permitir ver todos los gastos para evitar recursión
CREATE POLICY "Los usuarios autenticados pueden ver gastos" ON gastos
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Políticas para gastos_detalle (simplificadas para evitar recursión)
CREATE POLICY "Los usuarios pueden ver sus propios detalles" ON gastos_detalle
    FOR SELECT USING (auth.uid() = usuario_id);

-- Permitir gestión básica de detalles
CREATE POLICY "Los usuarios autenticados pueden gestionar detalles" ON gastos_detalle
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Políticas para pagos
CREATE POLICY "Los usuarios pueden ver pagos relacionados con sus gastos" ON pagos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM gastos_detalle gd
            JOIN gastos g ON g.id = gd.gasto_id
            WHERE gd.id = pagos.gasto_detalle_id
            AND (gd.usuario_id = auth.uid() OR g.usuario_id = auth.uid())
        )
    );

CREATE POLICY "Los creadores de gastos pueden gestionar pagos" ON pagos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM gastos_detalle gd
            JOIN gastos g ON g.id = gd.gasto_id
            WHERE gd.id = pagos.gasto_detalle_id AND g.usuario_id = auth.uid()
        )
    );

-- Políticas para solicitudes_pago
CREATE POLICY "Los usuarios pueden ver sus solicitudes" ON solicitudes_pago
    FOR SELECT USING (
        auth.uid() = usuario_solicitante_id OR auth.uid() = usuario_creador_id
    );

CREATE POLICY "Los usuarios pueden crear solicitudes" ON solicitudes_pago
    FOR INSERT WITH CHECK (auth.uid() = usuario_solicitante_id);

CREATE POLICY "Los creadores pueden actualizar solicitudes" ON solicitudes_pago
    FOR UPDATE USING (auth.uid() = usuario_creador_id);

-- =====================================================
-- 11. SINCRONIZACIÓN CON AUTH.USERS
-- =====================================================

-- Función para sincronizar usuarios con auth.users
CREATE OR REPLACE FUNCTION sync_user_with_auth()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Insertar o actualizar en la tabla usuarios cuando se crea/actualiza en auth.users
    INSERT INTO public.usuarios (id, email, nickname)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nickname = COALESCE(NEW.raw_user_meta_data->>'nickname', usuarios.nickname),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronización automática
CREATE TRIGGER sync_user_trigger
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION sync_user_with_auth();

-- =====================================================
-- 12. FUNCIONES ADICIONALES PARA GESTIÓN DE GASTOS
-- =====================================================

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

-- Función RPC para cambiar participante en gastos
-- Esta función permite cambiar un participante por otro en todas las cuotas de un gasto
-- Maneja tanto usuarios registrados como participantes sin cuenta

CREATE OR REPLACE FUNCTION cambiar_participante_gasto(
  p_gasto_id UUID,
  p_usuario_id UUID,
  p_detalle_id_original UUID,
  p_nuevo_usuario_id UUID DEFAULT NULL,
  p_nuevo_nombre_participante TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gasto RECORD;
  v_detalle_original RECORD;
  v_tiene_pagos BOOLEAN := FALSE;
  v_resultado JSON;
  v_detalles_actualizados INTEGER := 0;
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
  
  -- Obtener información del detalle original
  SELECT * INTO v_detalle_original
  FROM gastos_detalle
  WHERE id = p_detalle_id_original AND gasto_id = p_gasto_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Detalle de gasto no encontrado'
    );
  END IF;
  
  -- Validar que se proporcione al menos un nuevo identificador
  IF p_nuevo_usuario_id IS NULL AND (p_nuevo_nombre_participante IS NULL OR p_nuevo_nombre_participante = '') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Debe proporcionar un nuevo usuario o nombre de participante'
    );
  END IF;
  
  -- Verificar que el nuevo participante no esté ya en el gasto
  IF EXISTS(
    SELECT 1
    FROM gastos_detalle
    WHERE gasto_id = p_gasto_id
    AND (
      (p_nuevo_usuario_id IS NOT NULL AND usuario_id = p_nuevo_usuario_id)
      OR
      (p_nuevo_nombre_participante IS NOT NULL AND nombre_participante = p_nuevo_nombre_participante)
    )
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'El participante ya existe en este gasto'
    );
  END IF;
  
  -- Verificar si alguno de los detalles del participante tiene pagos asociados
  SELECT EXISTS(
    SELECT 1
    FROM gastos_detalle gd
    JOIN pagos p ON p.gasto_detalle_id = gd.id
    WHERE gd.gasto_id = p_gasto_id
    AND (
      (v_detalle_original.usuario_id IS NOT NULL AND gd.usuario_id = v_detalle_original.usuario_id)
      OR
      (v_detalle_original.nombre_participante IS NOT NULL AND gd.nombre_participante = v_detalle_original.nombre_participante)
    )
  ) INTO v_tiene_pagos;
  
  -- Si tiene pagos asociados, no permitir el cambio
  IF v_tiene_pagos THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No se puede cambiar el participante porque tiene pagos asociados'
    );
  END IF;
  
  -- Actualizar todos los detalles del participante en todas las cuotas
  UPDATE gastos_detalle
  SET 
    usuario_id = p_nuevo_usuario_id,
    nombre_participante = p_nuevo_nombre_participante,
    updated_at = NOW()
  WHERE gasto_id = p_gasto_id
  AND (
    (v_detalle_original.usuario_id IS NOT NULL AND usuario_id = v_detalle_original.usuario_id)
    OR
    (v_detalle_original.nombre_participante IS NOT NULL AND nombre_participante = v_detalle_original.nombre_participante)
  );
  
  -- Obtener el número de registros actualizados
  GET DIAGNOSTICS v_detalles_actualizados = ROW_COUNT;
  
  -- Retornar resultado exitoso
  v_resultado := json_build_object(
    'success', true,
    'message', 'Participante actualizado correctamente en ' || v_detalles_actualizados || ' cuota(s)',
    'detalles_actualizados', v_detalles_actualizados,
    'participante_anterior', CASE
      WHEN v_detalle_original.usuario_id IS NOT NULL THEN 'Usuario ID: ' || v_detalle_original.usuario_id
      ELSE v_detalle_original.nombre_participante
    END,
    'participante_nuevo', CASE
      WHEN p_nuevo_usuario_id IS NOT NULL THEN 'Usuario ID: ' || p_nuevo_usuario_id
      ELSE p_nuevo_nombre_participante
    END
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
GRANT EXECUTE ON FUNCTION cambiar_participante_gasto(UUID, UUID, UUID, UUID, TEXT) TO authenticated;

-- Comentario de la función
COMMENT ON FUNCTION cambiar_participante_gasto(UUID, UUID, UUID, UUID, TEXT) IS 
'Función para cambiar participante en gastos. Actualiza el participante en todas las cuotas del gasto si no tiene pagos asociados.';

-- =====================================================
-- 13. SISTEMA DE USUARIOS FAVORITOS
-- =====================================================

-- Crear tabla favoritos
CREATE TABLE IF NOT EXISTS public.favoritos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usuario_favorito_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_favorito TEXT,
    email_favorito TEXT,
    frecuencia_uso INTEGER DEFAULT 1,
    ultimo_uso TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT favoritos_usuario_check CHECK (usuario_id != usuario_favorito_id),
    CONSTRAINT favoritos_identificador_check CHECK (
        (usuario_favorito_id IS NOT NULL) OR 
        (nombre_favorito IS NOT NULL AND email_favorito IS NOT NULL)
    ),
    CONSTRAINT favoritos_unique_usuario_registrado UNIQUE (usuario_id, usuario_favorito_id),
    CONSTRAINT favoritos_unique_usuario_no_registrado UNIQUE (usuario_id, nombre_favorito, email_favorito)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_favoritos_usuario_id ON public.favoritos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_usuario_favorito_id ON public.favoritos(usuario_favorito_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_frecuencia_uso ON public.favoritos(usuario_id, frecuencia_uso DESC);
CREATE INDEX IF NOT EXISTS idx_favoritos_ultimo_uso ON public.favoritos(usuario_id, ultimo_uso DESC);

-- Trigger para updated_at
-- Eliminar trigger si existe para evitar conflictos
DROP TRIGGER IF EXISTS favoritos_updated_at ON public.favoritos;

CREATE TRIGGER favoritos_updated_at
    BEFORE UPDATE ON public.favoritos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función RPC para agregar favoritos manualmente
CREATE OR REPLACE FUNCTION agregar_favoritos_gasto(gasto_id_param UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    usuario_info RECORD;
    participante_record RECORD;
    creador_gasto_id UUID;
BEGIN
    -- Obtener información del gasto para saber quién es el creador
    SELECT usuario_id INTO creador_gasto_id
    FROM public.gastos
    WHERE id = gasto_id_param;
    
    -- Verificar que el usuario actual sea el creador del gasto
    IF creador_gasto_id != auth.uid() THEN
        RETURN FALSE;
    END IF;
    
    -- Procesar todos los participantes del gasto
    FOR participante_record IN 
        SELECT usuario_id, nombre_participante
        FROM public.gastos_detalle
        WHERE gasto_id = gasto_id_param
    LOOP
        -- Solo procesar si el participante no es el creador del gasto
        IF participante_record.usuario_id IS NOT NULL AND participante_record.usuario_id != creador_gasto_id THEN
            -- Obtener información del usuario participante
            SELECT email, nickname INTO usuario_info
            FROM public.usuarios
            WHERE id = participante_record.usuario_id;
            
            -- Verificar si ya existe en favoritos
            IF EXISTS (
                SELECT 1 FROM public.favoritos
                WHERE usuario_id = creador_gasto_id
                AND usuario_favorito_id = participante_record.usuario_id
            ) THEN
                -- Actualizar frecuencia y último uso
                UPDATE public.favoritos
                SET frecuencia_uso = frecuencia_uso + 1,
                    ultimo_uso = NOW(),
                    updated_at = NOW()
                WHERE usuario_id = creador_gasto_id
                AND usuario_favorito_id = participante_record.usuario_id;
            ELSE
                -- Insertar nuevo favorito
                INSERT INTO public.favoritos (
                    usuario_id,
                    usuario_favorito_id,
                    email_favorito,
                    frecuencia_uso,
                    ultimo_uso
                ) VALUES (
                    creador_gasto_id,
                    participante_record.usuario_id,
                    usuario_info.email,
                    1,
                    NOW()
                );
            END IF;
        
        -- Si es un participante sin cuenta (solo nombre)
        ELSIF participante_record.nombre_participante IS NOT NULL THEN
            -- Verificar si ya existe en favoritos
            IF EXISTS (
                SELECT 1 FROM public.favoritos
                WHERE usuario_id = creador_gasto_id
                AND nombre_favorito = participante_record.nombre_participante
                AND usuario_favorito_id IS NULL
            ) THEN
                -- Actualizar frecuencia y último uso
                UPDATE public.favoritos
                SET frecuencia_uso = frecuencia_uso + 1,
                    ultimo_uso = NOW(),
                    updated_at = NOW()
                WHERE usuario_id = creador_gasto_id
                AND nombre_favorito = participante_record.nombre_participante
                AND usuario_favorito_id IS NULL;
            ELSE
                -- Insertar nuevo favorito
                INSERT INTO public.favoritos (
                    usuario_id,
                    nombre_favorito,
                    frecuencia_uso,
                    ultimo_uso
                ) VALUES (
                    creador_gasto_id,
                    participante_record.nombre_participante,
                    1,
                    NOW()
                );
            END IF;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION agregar_favoritos_gasto(UUID) TO authenticated;

-- Trigger para ejecutar la función automáticamente
-- Eliminar trigger si existe para evitar conflictos
DROP TRIGGER IF EXISTS trigger_agregar_favoritos ON public.gastos_detalle;

-- TRIGGER TEMPORALMENTE DESHABILITADO PARA DEBUG
-- CREATE TRIGGER trigger_agregar_favoritos
--     AFTER INSERT ON public.gastos_detalle
--     FOR EACH ROW
--     EXECUTE FUNCTION agregar_favoritos_automaticamente();

-- Función RPC para obtener favoritos del usuario
CREATE OR REPLACE FUNCTION obtener_favoritos_usuario()
RETURNS TABLE(
    id UUID,
    usuario_favorito_id UUID,
    nombre_favorito TEXT,
    email_favorito TEXT,
    nickname TEXT,
    frecuencia_uso INTEGER,
    ultimo_uso TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.usuario_favorito_id,
        f.nombre_favorito,
        f.email_favorito,
        u.nickname,
        f.frecuencia_uso,
        f.ultimo_uso
    FROM public.favoritos f
    LEFT JOIN public.usuarios u ON u.id = f.usuario_favorito_id
    WHERE f.usuario_id = auth.uid()
    ORDER BY f.frecuencia_uso DESC, f.ultimo_uso DESC;
END;
$$ LANGUAGE plpgsql;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION obtener_favoritos_usuario() TO authenticated;

-- Función RPC para eliminar favorito
CREATE OR REPLACE FUNCTION eliminar_favorito(favorito_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.favoritos
    WHERE id = favorito_id
    AND usuario_id = auth.uid();
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION eliminar_favorito(UUID) TO authenticated;

-- Habilitar RLS en la tabla favoritos
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si existen para evitar conflictos
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propios favoritos" ON public.favoritos;
DROP POLICY IF EXISTS "Los usuarios pueden crear sus propios favoritos" ON public.favoritos;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propios favoritos" ON public.favoritos;
DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propios favoritos" ON public.favoritos;

-- Políticas RLS para favoritos
CREATE POLICY "Los usuarios pueden ver sus propios favoritos" ON public.favoritos
    FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden crear sus propios favoritos" ON public.favoritos
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios favoritos" ON public.favoritos
    FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios favoritos" ON public.favoritos
    FOR DELETE USING (auth.uid() = usuario_id);

-- =====================================================
-- FUNCIÓN RPC PARA CREAR GASTOS
-- =====================================================

-- Función RPC completa para crear gastos con detalles, pagos automáticos y favoritos
-- INCLUYE DISTRIBUCIÓN EQUITATIVA DE CENTAVOS:
-- - Distribuye centavos restantes entre los primeros participantes
-- - Garantiza que la suma de detalles sea exactamente igual al monto total
-- - Ejemplo: $100 entre 3 participantes = $33.34, $33.33, $33.33
CREATE OR REPLACE FUNCTION crear_gasto_completo(
    p_descripcion TEXT,
    p_monto_total DECIMAL(10,2),
    p_tipo tipo_gasto,
    p_fecha DATE,
    p_cuotas INTEGER,
    p_participantes JSONB,
    p_primer_vencimiento DATE,
    p_descuento DECIMAL(10,2) DEFAULT 0,
    p_tipo_descuento tipo_descuento DEFAULT 'uniforme',
    p_pagado BOOLEAN DEFAULT FALSE,
    p_es_recurrente BOOLEAN DEFAULT FALSE,
    p_gasto_padre_id UUID DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_gasto_id UUID;
    v_participante JSONB;
    v_detalle_id UUID;
    v_monto_por_cuota DECIMAL(10,2);
    v_monto_por_participante DECIMAL(10,2);
    v_participantes_count INTEGER;
    v_fecha_vencimiento DATE;
    v_resultado JSON;
    v_montos_calculados DECIMAL(10,2)[];
    v_cuota INTEGER;
BEGIN
    -- Validar parámetros básicos
    IF p_monto_total <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El monto total debe ser mayor a 0'
        );
    END IF;
    
    IF p_cuotas <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Las cuotas deben ser mayor a 0'
        );
    END IF;
    
    IF jsonb_array_length(p_participantes) = 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Debe haber al menos un participante'
        );
    END IF;
    
    -- Contar participantes
    v_participantes_count := jsonb_array_length(p_participantes);
    
    -- Calcular montos con descuento aplicado
    FOR v_cuota IN 1..p_cuotas LOOP
        v_monto_por_cuota := p_monto_total / p_cuotas;
        
        -- Aplicar descuento según tipo
        IF p_descuento > 0 THEN
            IF p_tipo_descuento = 'uniforme' THEN
                -- Descuento uniforme: se aplica a todas las cuotas por igual
                v_monto_por_cuota := v_monto_por_cuota - (p_descuento / p_cuotas);
            ELSIF p_tipo_descuento = 'prorrateo' AND v_cuota = 1 THEN
                -- Descuento por prorrateo: se aplica solo a la primera cuota
                v_monto_por_cuota := v_monto_por_cuota - p_descuento;
            END IF;
        END IF;
        
        v_montos_calculados[v_cuota] := v_monto_por_cuota;
    END LOOP;
    
    -- Crear el gasto principal
    INSERT INTO public.gastos (
        usuario_id,
        descripcion,
        monto,
        tipo,
        fecha,
        cuotas,
        descuento,
        tipo_descuento,
        es_recurrente,
        gasto_padre_id
    ) VALUES (
        auth.uid(),
        p_descripcion,
        p_monto_total,
        p_tipo,
        p_fecha,
        p_cuotas,
        p_descuento,
        p_tipo_descuento,
        p_es_recurrente,
        p_gasto_padre_id
    ) RETURNING id INTO v_gasto_id;
    
    -- Crear detalles para cada participante y cuota
    FOR v_cuota IN 1..p_cuotas LOOP
        -- Calcular fecha de vencimiento para esta cuota
        v_fecha_vencimiento := p_primer_vencimiento + INTERVAL '1 month' * (v_cuota - 1);
        
        -- Variables para manejar la precisión y distribución equitativa de centavos
        -- Esta lógica asegura que la suma de los detalles sea exactamente igual al monto de la cuota
        DECLARE
            v_participante_index INTEGER := 0;
            v_monto_base DECIMAL(10,2);
            v_centavos_restantes INTEGER;
            v_monto_ajustado DECIMAL(10,2);
        BEGIN
            -- Calcular monto base (sin centavos) y centavos restantes
            v_monto_base := FLOOR(v_montos_calculados[v_cuota] / v_participantes_count * 100) / 100;
            v_centavos_restantes := (v_montos_calculados[v_cuota] * 100)::INTEGER - (v_monto_base * v_participantes_count * 100)::INTEGER;
            
            -- Crear detalle para cada participante
            FOR v_participante IN SELECT * FROM jsonb_array_elements(p_participantes) LOOP
                v_participante_index := v_participante_index + 1;
                
                -- Distribuir centavos restantes entre los primeros participantes
                IF v_participante_index <= v_centavos_restantes THEN
                    v_monto_ajustado := v_monto_base + 0.01;
                ELSE
                    v_monto_ajustado := v_monto_base;
                END IF;
                
                INSERT INTO public.gastos_detalle (
                    gasto_id,
                    usuario_id,
                    nombre_participante,
                    monto,
                    pagado,
                    vencimiento,
                    numero_cuota
                ) VALUES (
                    v_gasto_id,
                    CASE WHEN v_participante->>'usuario_id' != 'null' THEN (v_participante->>'usuario_id')::UUID ELSE NULL END,
                    CASE WHEN v_participante->>'usuario_id' = 'null' OR v_participante->>'usuario_id' IS NULL THEN v_participante->>'nickname' ELSE NULL END,
                    v_monto_ajustado,
                    p_pagado OR v_monto_ajustado = 0,
                    v_fecha_vencimiento,
                    v_cuota
                ) RETURNING id INTO v_detalle_id;
            
                -- Si el gasto está marcado como pagado y el monto es mayor a 0, crear pago automático
                IF p_pagado AND v_monto_ajustado > 0 THEN
                    INSERT INTO public.pagos (
                        gasto_detalle_id,
                        monto,
                        medio_pago,
                        fecha_pago
                    ) VALUES (
                        v_detalle_id,
                        v_monto_ajustado,
                        'efectivo',
                        CURRENT_DATE
                    );
                END IF;
            END LOOP;
        END; -- Fin del bloque DECLARE-BEGIN
    END LOOP;
    
    -- Agregar favoritos automáticamente
    PERFORM agregar_favoritos_gasto(v_gasto_id);
    
    -- Retornar resultado exitoso
    v_resultado := json_build_object(
        'success', true,
        'gasto_id', v_gasto_id,
        'message', 'Gasto creado exitosamente con favoritos automáticos'
    );
    
    RETURN v_resultado;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error interno: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- Función wrapper para compatibilidad con el código existente
CREATE OR REPLACE FUNCTION crear_gasto(
    p_descripcion TEXT,
    p_monto_total DECIMAL(10,2),
    p_tipo tipo_gasto,
    p_fecha DATE,
    p_cuotas INTEGER,
    p_participantes JSONB,
    p_primer_vencimiento DATE,
    p_descuento DECIMAL(10,2) DEFAULT 0,
    p_tipo_descuento tipo_descuento DEFAULT 'uniforme',
    p_pagado BOOLEAN DEFAULT FALSE,
    p_es_recurrente BOOLEAN DEFAULT FALSE,
    p_gasto_padre_id UUID DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Llamar a la función completa
    RETURN crear_gasto_completo(
        p_descripcion,
        p_monto_total,
        p_tipo,
        p_fecha,
        p_cuotas,
        p_participantes,
        p_primer_vencimiento,
        p_descuento,
        p_tipo_descuento,
        p_pagado,
        p_es_recurrente,
        p_gasto_padre_id
    );
END;
$$ LANGUAGE plpgsql;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION crear_gasto_completo(
    TEXT, DECIMAL(10,2), tipo_gasto, DATE, INTEGER, JSONB, DATE, DECIMAL(10,2), tipo_descuento, BOOLEAN, BOOLEAN, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION crear_gasto(
    TEXT, DECIMAL(10,2), tipo_gasto, DATE, INTEGER, JSONB, DATE, DECIMAL(10,2), tipo_descuento, BOOLEAN, BOOLEAN, UUID
) TO authenticated;

-- Otorgar permisos de ejecución para obtener_gastos_compartidos
GRANT EXECUTE ON FUNCTION obtener_gastos_compartidos(UUID) TO authenticated;

-- =====================================================
-- FUNCIÓN OBTENER PAGOS USUARIO (MIGRACIÓN 002)
-- =====================================================

-- Función para obtener pagos filtrados por usuario y mes/año
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
SECURITY DEFINER
SET search_path = ''
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
    FROM public.pagos p
    INNER JOIN public.gastos_detalle gd ON p.gasto_detalle_id = gd.id
    INNER JOIN public.gastos g ON gd.gasto_id = g.id
    LEFT JOIN public.usuarios u ON gd.usuario_id = u.id
    WHERE 
        gd.usuario_id = p_usuario_id
        AND gd.vencimiento IS NOT NULL
        AND (
            (p_mes IS NULL OR p_año IS NULL) OR
            (EXTRACT(MONTH FROM gd.vencimiento) = p_mes AND EXTRACT(YEAR FROM gd.vencimiento) = p_año)
        )
    ORDER BY p.fecha_pago DESC;
END;
$$ LANGUAGE plpgsql;

-- Otorgar permisos de ejecución para obtener_pagos_usuario
GRANT EXECUTE ON FUNCTION obtener_pagos_usuario(UUID, INTEGER, INTEGER) TO authenticated;

-- =====================================================
-- FUNCIÓN OBTENER DATOS RESUMEN MENSUAL (MIGRACIÓN 003)
-- =====================================================

-- Función para obtener datos de resumen mensual
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
SET search_path = 'public'
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

    -- 1. CALCULAR GASTOS TOTALES POR TIPO (PARA GRÁFICO)
    -- =====================================================
    -- Sumar todos los gastos_detalle del usuario, agrupados por tipo de gasto
    -- Sin importar si están pagados o no
    
    SELECT 
        COALESCE(SUM(CASE WHEN g.es_recurrente = true THEN gd.monto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN g.es_recurrente = false OR g.es_recurrente IS NULL THEN gd.monto ELSE 0 END), 0),
        COALESCE(COUNT(CASE WHEN g.es_recurrente = true THEN 1 END), 0),
        COALESCE(COUNT(CASE WHEN g.es_recurrente = false OR g.es_recurrente IS NULL THEN 1 END), 0)
    INTO v_gastos_fijos, v_gastos_variables, v_cant_fijos, v_cant_variables
    FROM gastos_detalle gd
    INNER JOIN gastos g ON gd.gasto_id = g.id
    WHERE gd.usuario_id = p_usuario_id
        AND (p_mes IS NULL OR EXTRACT(MONTH FROM gd.vencimiento) = p_mes)
        AND (p_año IS NULL OR EXTRACT(YEAR FROM gd.vencimiento) = p_año);
    
    -- =====================================================
    -- 2. CALCULAR GASTOS POR PAGAR DEL USUARIO
    -- =====================================================
    
    SELECT 
        COALESCE(SUM(gd.monto - COALESCE(pagos_sum.total_pagado, 0)), 0),
        COALESCE(COUNT(*), 0)
    INTO v_por_pagar, v_cant_por_pagar
    FROM gastos_detalle gd
    LEFT JOIN (
        SELECT 
            p.gasto_detalle_id,
            SUM(p.monto) as total_pagado
        FROM pagos p
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
    FROM gastos_detalle gd
    INNER JOIN gastos g ON gd.gasto_id = g.id
    LEFT JOIN (
        SELECT 
            p.gasto_detalle_id,
            SUM(p.monto) as total_pagado
        FROM pagos p
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

-- Otorgar permisos de ejecución para obtener_datos_resumen_mensual
GRANT EXECUTE ON FUNCTION obtener_datos_resumen_mensual(UUID, INTEGER, INTEGER) TO authenticated;

-- Otorgar permisos de ejecución para funciones de solicitudes de pago
GRANT EXECUTE ON FUNCTION crear_solicitud_pago(UUID, UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION obtener_solicitudes_recibidas(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION obtener_solicitudes_enviadas(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION aceptar_solicitud_pago(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rechazar_solicitud_pago(UUID, TEXT) TO authenticated;

-- =====================================================
-- FIN DE LA MIGRACIÓN COMPLETA
-- =====================================================

-- Comentarios finales
COMMENT ON DATABASE CURRENT_DATABASE IS 'Base de datos para aplicación de gestión de gastos compartidos';
COMMENT ON TABLE usuarios IS 'Tabla de usuarios del sistema';
COMMENT ON TABLE gastos IS 'Tabla principal de gastos';
COMMENT ON TABLE gastos_detalle IS 'Detalles de participación en gastos por usuario y cuota';
COMMENT ON TABLE pagos IS 'Registro de pagos realizados';
COMMENT ON TABLE solicitudes_pago IS 'Sistema de solicitudes de pago entre usuarios';

-- =====================================================
-- FUNCIONES PARA OBTENER LISTAS DETALLADAS DE RESUMEN
-- =====================================================
-- Estas funciones devuelven listas detalladas de gastos para mostrar
-- en la pantalla de resumen como secciones separadas
-- =====================================================

-- =====================================================
-- FUNCIÓN PARA OBTENER GASTOS POR PAGAR DEL USUARIO
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_gastos_por_pagar(
    p_usuario_id UUID,
    p_mes INTEGER DEFAULT NULL,
    p_año INTEGER DEFAULT NULL
)
RETURNS TABLE(
    gasto_detalle_id UUID,
    gasto_id UUID,
    descripcion TEXT,
    monto DECIMAL(10,2),
    monto_pagado DECIMAL(10,2),
    monto_pendiente DECIMAL(10,2),
    vencimiento DATE,
    numero_cuota INTEGER,
    tipo_gasto tipo_gasto,
    es_recurrente BOOLEAN,
    usuario_creador_nickname TEXT,
    usuario_creador_email TEXT
)
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gd.id as gasto_detalle_id,
        g.id as gasto_id,
        g.descripcion,
        gd.monto,
        COALESCE(pagos_sum.total_pagado, 0) as monto_pagado,
        (gd.monto - COALESCE(pagos_sum.total_pagado, 0)) as monto_pendiente,
        gd.vencimiento,
        gd.numero_cuota,
        g.tipo as tipo_gasto,
        g.es_recurrente,
        u.nickname as usuario_creador_nickname,
        u.email as usuario_creador_email
    FROM gastos_detalle gd
    INNER JOIN gastos g ON gd.gasto_id = g.id
    INNER JOIN usuarios u ON g.usuario_id = u.id
    LEFT JOIN (
        SELECT 
            p.gasto_detalle_id,
            SUM(p.monto) as total_pagado
        FROM pagos p
        GROUP BY p.gasto_detalle_id
    ) pagos_sum ON gd.id = pagos_sum.gasto_detalle_id
    WHERE gd.usuario_id = p_usuario_id
        AND (p_mes IS NULL OR EXTRACT(MONTH FROM gd.vencimiento) = p_mes)
        AND (p_año IS NULL OR EXTRACT(YEAR FROM gd.vencimiento) = p_año)
        AND (gd.monto > COALESCE(pagos_sum.total_pagado, 0)) -- Solo los que tienen saldo pendiente
    ORDER BY gd.vencimiento ASC, g.descripcion ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN PARA OBTENER GASTOS QUE LE ADEUDAN AL USUARIO
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_gastos_adeudados(
    p_usuario_id UUID,
    p_mes INTEGER DEFAULT NULL,
    p_año INTEGER DEFAULT NULL
)
RETURNS TABLE(
    gasto_detalle_id UUID,
    gasto_id UUID,
    descripcion TEXT,
    monto DECIMAL(10,2),
    monto_pagado DECIMAL(10,2),
    monto_pendiente DECIMAL(10,2),
    vencimiento DATE,
    numero_cuota INTEGER,
    tipo_gasto tipo_gasto,
    es_recurrente BOOLEAN,
    usuario_deudor_id UUID,
    usuario_deudor_nickname TEXT,
    usuario_deudor_email TEXT
)
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gd.id as gasto_detalle_id,
        g.id as gasto_id,
        g.descripcion,
        gd.monto,
        COALESCE(pagos_sum.total_pagado, 0) as monto_pagado,
        (gd.monto - COALESCE(pagos_sum.total_pagado, 0)) as monto_pendiente,
        gd.vencimiento,
        gd.numero_cuota,
        g.tipo as tipo_gasto,
        g.es_recurrente,
        gd.usuario_id as usuario_deudor_id,
        COALESCE(u.nickname, 'Usuario externo') as usuario_deudor_nickname,
        COALESCE(u.email, 'Sin email') as usuario_deudor_email
    FROM gastos_detalle gd
    INNER JOIN gastos g ON gd.gasto_id = g.id
    LEFT JOIN usuarios u ON gd.usuario_id = u.id
    LEFT JOIN (
        SELECT 
            p.gasto_detalle_id,
            SUM(p.monto) as total_pagado
        FROM pagos p
        GROUP BY p.gasto_detalle_id
    ) pagos_sum ON gd.id = pagos_sum.gasto_detalle_id
    WHERE g.usuario_id = p_usuario_id  -- Gastos creados por el usuario
        AND (gd.usuario_id != p_usuario_id OR gd.usuario_id IS NULL)  -- Detalle pertenece a otro usuario o participante externo
        AND (p_mes IS NULL OR EXTRACT(MONTH FROM gd.vencimiento) = p_mes)
        AND (p_año IS NULL OR EXTRACT(YEAR FROM gd.vencimiento) = p_año)
        AND (gd.monto > COALESCE(pagos_sum.total_pagado, 0)) -- Solo los que tienen saldo pendiente
    ORDER BY gd.vencimiento ASC, g.descripcion ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERMISOS DE EJECUCIÓN
-- =====================================================
GRANT EXECUTE ON FUNCTION obtener_gastos_por_pagar(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION obtener_gastos_adeudados(UUID, INTEGER, INTEGER) TO authenticated;

-- Verificación final
SELECT 'Migración completa aplicada exitosamente' as resultado;