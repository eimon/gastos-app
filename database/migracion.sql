-- =====================================================
-- MIGRACIÓN COMPLETA SIMPLIFICADA - GASTOS APP
-- =====================================================
-- Esta migración incluye toda la funcionalidad simplificada
-- SIN tabla participantes redundante
-- =====================================================

-- 1. TIPOS ENUM
-- =====================================================

-- Crear tipos ENUM (DROP IF EXISTS para evitar errores)
DROP TYPE IF EXISTS tipo_gasto CASCADE;
DROP TYPE IF EXISTS medio_pago CASCADE;

CREATE TYPE tipo_gasto AS ENUM ('personal', 'compartido');
CREATE TYPE medio_pago AS ENUM ('efectivo', 'transferencia', 'descuento');

-- =====================================================
-- 2. TABLA USUARIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT auth.uid(),
    email TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL,
    saldo_total DECIMAL(10,2) DEFAULT 0, -- Saldo acumulado del usuario
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_nickname ON usuarios(nickname);

-- =====================================================
-- 3. TABLA GASTOS
-- =====================================================

-- Crear tipo ENUM para tipo de descuento
DROP TYPE IF EXISTS tipo_descuento CASCADE;
CREATE TYPE tipo_descuento AS ENUM ('uniforme', 'prorrateo');

CREATE TABLE IF NOT EXISTS gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    tipo tipo_gasto NOT NULL DEFAULT 'personal',
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    cuotas INTEGER DEFAULT 1 CHECK (cuotas > 0),
    descuento DECIMAL(10,2) DEFAULT 0 CHECK (descuento >= 0),
    tipo_descuento tipo_descuento DEFAULT 'uniforme',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para gastos
CREATE INDEX IF NOT EXISTS idx_gastos_usuario_id ON gastos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_tipo ON gastos(tipo);

-- =====================================================
-- 4. TABLA GASTOS_DETALLE (SIMPLIFICADA)
-- =====================================================

CREATE TABLE IF NOT EXISTS gastos_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gasto_id UUID NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE, -- Referencia directa a usuarios
    nombre_participante TEXT, -- Nombre directo para no registrados
    monto DECIMAL(10,2) NOT NULL CHECK (monto >= 0),
    pagado BOOLEAN DEFAULT false,
    saldo DECIMAL(10,2) DEFAULT 0 CHECK (saldo >= 0),
    vencimiento DATE,
    numero_cuota INTEGER DEFAULT 1 CHECK (numero_cuota > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: debe tener usuario_id O nombre_participante, pero no ambos
    CONSTRAINT check_participante_data CHECK (
        (usuario_id IS NOT NULL AND nombre_participante IS NULL) OR
        (usuario_id IS NULL AND nombre_participante IS NOT NULL)
    ),
    
    UNIQUE(gasto_id, usuario_id, numero_cuota),
    UNIQUE(gasto_id, nombre_participante, numero_cuota)
);

-- Índices para gastos_detalle
CREATE INDEX IF NOT EXISTS idx_gastos_detalle_gasto_id ON gastos_detalle(gasto_id);
CREATE INDEX IF NOT EXISTS idx_gastos_detalle_usuario_id ON gastos_detalle(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gastos_detalle_nombre_participante ON gastos_detalle(nombre_participante);
CREATE INDEX IF NOT EXISTS idx_gastos_detalle_vencimiento ON gastos_detalle(vencimiento);
CREATE INDEX IF NOT EXISTS idx_gastos_detalle_pagado ON gastos_detalle(pagado);

-- =====================================================
-- 5. TABLA PAGOS
-- =====================================================

CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gasto_detalle_id UUID NOT NULL REFERENCES gastos_detalle(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    medio_pago medio_pago NOT NULL DEFAULT 'efectivo',
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para pagos
CREATE INDEX IF NOT EXISTS idx_pagos_gasto_detalle_id ON pagos(gasto_detalle_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_medio_pago ON pagos(medio_pago);

-- =====================================================
-- 6. TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers a todas las tablas
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gastos_updated_at BEFORE UPDATE ON gastos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gastos_detalle_updated_at BEFORE UPDATE ON gastos_detalle
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pagos_updated_at BEFORE UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. FUNCIONES DE VALIDACIÓN
-- =====================================================

-- Función para validar y ajustar automáticamente el total de gastos_detalle
CREATE OR REPLACE FUNCTION validate_gasto_total()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    gasto_monto DECIMAL(10,2);
    gasto_descuento DECIMAL(10,2);
    monto_neto DECIMAL(10,2);
    total_detalle DECIMAL(10,2);
    diferencia DECIMAL(10,2);
    ultimo_detalle_id UUID;
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
    
    -- Calcular diferencia
    diferencia := monto_neto - total_detalle;
    
    -- Si hay diferencia significativa (mayor a 0.01), ajustar automáticamente
    IF ABS(diferencia) > 0.01 THEN
        -- Obtener el último detalle insertado/modificado para este gasto
        SELECT id INTO ultimo_detalle_id
        FROM public.gastos_detalle
        WHERE gasto_id = COALESCE(NEW.gasto_id, OLD.gasto_id)
        ORDER BY created_at DESC, id DESC
        LIMIT 1;
        
        -- Ajustar el monto del último detalle para que coincida exactamente
        IF ultimo_detalle_id IS NOT NULL THEN
            UPDATE public.gastos_detalle
            SET monto = monto + diferencia
            WHERE id = ultimo_detalle_id;
            
            -- Log del ajuste realizado
            RAISE NOTICE 'Ajuste automático de redondeo: % aplicado al detalle %', diferencia, ultimo_detalle_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_gasto_total_trigger
    AFTER INSERT OR UPDATE OR DELETE ON gastos_detalle
    FOR EACH ROW EXECUTE FUNCTION validate_gasto_total();

-- =====================================================
-- 8. FUNCIONES PARA ACTUALIZAR ESTADO DE PAGOS
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
-- 9. FUNCIONES DE BALANCE Y RESUMEN
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

-- Función para obtener resumen de gastos de un usuario
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
        COALESCE(SUM(CASE WHEN gd.pagado THEN gd.monto ELSE 0 END), 0) as total_pagado,
        COALESCE(SUM(CASE WHEN gd.pagado THEN 0 ELSE gd.monto END), 0) as saldo_pendiente,
        COUNT(DISTINCT gd.gasto_id)::INTEGER as gastos_count
    FROM public.gastos_detalle gd
    WHERE gd.usuario_id = usuario_id_param;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. POLÍTICAS RLS SIMPLIFICADAS
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "Usuarios pueden ver su propio perfil" ON usuarios
    FOR ALL USING (id = auth.uid());

-- Políticas para gastos
CREATE POLICY "Solo propietarios pueden ver gastos" ON gastos
    FOR ALL USING (usuario_id = auth.uid());

-- Políticas para gastos_detalle
CREATE POLICY "Solo propietarios pueden ver detalles" ON gastos_detalle
    FOR ALL USING (
        gasto_id IN (
            SELECT id FROM gastos WHERE usuario_id = auth.uid()
        )
    );

-- Políticas para pagos
CREATE POLICY "Solo propietarios pueden ver pagos" ON pagos
    FOR ALL USING (
        gasto_detalle_id IN (
            SELECT gd.id
            FROM gastos_detalle gd
            JOIN gastos g ON g.id = gd.gasto_id
            WHERE g.usuario_id = auth.uid()
        )
    );

-- =====================================================
-- 11. TRIGGER PARA SINCRONIZACIÓN CON AUTH.USERS
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

-- Mensaje de confirmación
SELECT 'Migración completa simplificada aplicada exitosamente. Tabla participantes eliminada.' as resultado;