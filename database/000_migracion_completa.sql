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
SET search_path = ''
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
    FROM public.solicitudes_pago sp
    INNER JOIN public.gastos_detalle gd ON sp.gasto_detalle_id = gd.id
    INNER JOIN public.gastos g ON gd.gasto_id = g.id
    INNER JOIN public.usuarios u ON sp.usuario_solicitante_id = u.id
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
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id as solicitud_id,
        sp.gasto_detalle_id,
        g.id as gasto_id,
        g.descripcion as gasto_descripcion,
        sp.usuario_creador_id,
        u.email as creador_email,
        u.nickname as creador_nickname,
        sp.monto,
        sp.estado,
        sp.fecha_solicitud,
        sp.fecha_respuesta,
        sp.notas,
        gd.numero_cuota,
        gd.vencimiento
    FROM public.solicitudes_pago sp
    INNER JOIN public.gastos_detalle gd ON sp.gasto_detalle_id = gd.id
    INNER JOIN public.gastos g ON gd.gasto_id = g.id
    INNER JOIN public.usuarios u ON sp.usuario_creador_id = u.id
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

-- Políticas para gastos
CREATE POLICY "Los usuarios pueden ver gastos donde participan" ON gastos
    FOR SELECT USING (
        auth.uid() = usuario_id OR
        EXISTS (
            SELECT 1 FROM gastos_detalle gd
            WHERE gd.gasto_id = gastos.id AND gd.usuario_id = auth.uid()
        )
    );

CREATE POLICY "Los usuarios pueden crear sus propios gastos" ON gastos
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios gastos" ON gastos
    FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios gastos" ON gastos
    FOR DELETE USING (auth.uid() = usuario_id);

-- Políticas para gastos_detalle
CREATE POLICY "Los usuarios pueden ver detalles de gastos donde participan" ON gastos_detalle
    FOR SELECT USING (
        auth.uid() = usuario_id OR
        EXISTS (
            SELECT 1 FROM gastos g
            WHERE g.id = gastos_detalle.gasto_id AND g.usuario_id = auth.uid()
        )
    );

CREATE POLICY "Los creadores de gastos pueden gestionar detalles" ON gastos_detalle
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM gastos g
            WHERE g.id = gastos_detalle.gasto_id AND g.usuario_id = auth.uid()
        )
    );

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
-- FIN DE LA MIGRACIÓN COMPLETA
-- =====================================================

-- Comentarios finales
COMMENT ON DATABASE CURRENT_DATABASE() IS 'Base de datos para aplicación de gestión de gastos compartidos';
COMMENT ON TABLE usuarios IS 'Tabla de usuarios del sistema';
COMMENT ON TABLE gastos IS 'Tabla principal de gastos';
COMMENT ON TABLE gastos_detalle IS 'Detalles de participación en gastos por usuario y cuota';
COMMENT ON TABLE pagos IS 'Registro de pagos realizados';
COMMENT ON TABLE solicitudes_pago IS 'Sistema de solicitudes de pago entre usuarios';

-- Verificación final
SELECT 'Migración completa aplicada exitosamente' as resultado;