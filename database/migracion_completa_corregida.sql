-- =====================================================
-- MIGRACIÓN COMPLETA PARA GASTOS APP - VERSIÓN CORREGIDA
-- =====================================================
-- Esta migración incluye:
-- 1. Tipos ENUM
-- 2. Tablas principales
-- 3. Triggers automáticos
-- 4. Funciones de validación y balance
-- 5. Políticas RLS corregidas (sin recursión)
-- 6. Función RPC para búsqueda de usuarios
-- 7. Sincronización con auth.users

-- =====================================================
-- 1. TIPOS ENUM
-- =====================================================

-- Tipo de gasto
CREATE TYPE tipo_gasto AS ENUM ('personal', 'compartido');

-- Tipo de descuento
CREATE TYPE tipo_descuento AS ENUM ('porcentaje', 'monto_fijo');

-- Medio de pago
CREATE TYPE medio_pago AS ENUM ('efectivo', 'transferencia');

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
    tipo_descuento tipo_descuento DEFAULT 'monto_fijo',
    tipo tipo_gasto DEFAULT 'personal',
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
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
    medio_pago medio_pago NOT NULL,
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

CREATE INDEX idx_gastos_usuario_id ON gastos(usuario_id);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_gastos_detalle_gasto_id ON gastos_detalle(gasto_id);
CREATE INDEX idx_gastos_detalle_usuario_id ON gastos_detalle(usuario_id);
CREATE INDEX idx_gastos_detalle_pagado ON gastos_detalle(pagado);
CREATE INDEX idx_pagos_gasto_detalle_id ON pagos(gasto_detalle_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago);

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

-- Función para obtener balance por nickname
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
        -- Calcular balance para nombre directo (gastos no pagados)
        SELECT COALESCE(SUM(monto), 0) INTO balance
        FROM public.gastos_detalle
        WHERE nombre_participante = nickname_param AND pagado = false;
    END IF;
    
    RETURN balance;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. FUNCIÓN RPC PARA BUSCAR USUARIOS POR EMAIL
-- =====================================================

-- Función RPC para buscar usuarios por email (bypassa RLS)
CREATE OR REPLACE FUNCTION buscar_usuario_por_email(email_busqueda TEXT)
RETURNS TABLE(
    id UUID,
    email TEXT,
    nickname TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.nickname,
        u.created_at
    FROM public.usuarios u
    WHERE LOWER(u.email) = LOWER(email_busqueda)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. POLÍTICAS RLS SIMPLIFICADAS (SIN RECURSIÓN)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "Usuarios pueden ver datos básicos" ON usuarios
    FOR SELECT USING (true);

CREATE POLICY "Usuarios pueden modificar solo su perfil" ON usuarios
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Usuarios pueden eliminar solo su perfil" ON usuarios
    FOR DELETE USING (id = auth.uid());

CREATE POLICY "Sistema puede crear usuarios" ON usuarios
    FOR INSERT WITH CHECK (true);

-- Políticas para gastos (simplificadas)
CREATE POLICY "Usuarios pueden ver sus gastos" ON gastos
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden modificar sus gastos" ON gastos
    FOR UPDATE USING (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden eliminar sus gastos" ON gastos
    FOR DELETE USING (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden crear gastos" ON gastos
    FOR INSERT WITH CHECK (usuario_id = auth.uid());

-- Políticas para gastos_detalle (simplificadas)
CREATE POLICY "Usuarios pueden ver sus detalles" ON gastos_detalle
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden modificar detalles de sus gastos" ON gastos_detalle
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM gastos g 
            WHERE g.id = gasto_id AND g.usuario_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios pueden eliminar detalles de sus gastos" ON gastos_detalle
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM gastos g 
            WHERE g.id = gasto_id AND g.usuario_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios pueden crear detalles para sus gastos" ON gastos_detalle
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM gastos g 
            WHERE g.id = gasto_id AND g.usuario_id = auth.uid()
        )
    );

-- Políticas para pagos (simplificadas)
CREATE POLICY "Usuarios pueden ver pagos de sus detalles" ON pagos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM gastos_detalle gd 
            JOIN gastos g ON g.id = gd.gasto_id
            WHERE gd.id = gasto_detalle_id AND g.usuario_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios pueden modificar pagos de sus gastos" ON pagos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM gastos_detalle gd 
            JOIN gastos g ON g.id = gd.gasto_id
            WHERE gd.id = gasto_detalle_id AND g.usuario_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios pueden eliminar pagos de sus gastos" ON pagos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM gastos_detalle gd 
            JOIN gastos g ON g.id = gd.gasto_id
            WHERE gd.id = gasto_detalle_id AND g.usuario_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios pueden crear pagos para sus gastos" ON pagos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM gastos_detalle gd 
            JOIN gastos g ON g.id = gd.gasto_id
            WHERE gd.id = gasto_detalle_id AND g.usuario_id = auth.uid()
        )
    );

-- =====================================================
-- 10. TRIGGER PARA SINCRONIZACIÓN CON AUTH.USERS
-- =====================================================

-- Función para crear usuario automáticamente cuando se registra en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nickname)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'nickname', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Trigger para ejecutar la función
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 11. MENSAJE FINAL
-- =====================================================

SELECT 'Migración completa aplicada exitosamente con políticas RLS corregidas (sin recursión infinita).' as resultado;