-- Migraciones para Gastos App
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tipos ENUM
CREATE TYPE tipo_gasto AS ENUM ('personal', 'compartido');
CREATE TYPE medio_pago AS ENUM ('efectivo', 'transferencia');

-- 2. Tabla usuarios
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  hashed_password VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  rol VARCHAR(20) DEFAULT 'user',
  provider VARCHAR(50),
  provider_id VARCHAR(255),
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla participantes
CREATE TABLE participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  nickname VARCHAR(100) NOT NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  es_registrado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla gastos
CREATE TABLE gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion TEXT NOT NULL,
  monto_total DECIMAL(10,2) NOT NULL CHECK (monto_total > 0),
  tipo tipo_gasto NOT NULL,
  fecha DATE NOT NULL,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla gastos_detalle
CREATE TABLE gastos_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id UUID NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gasto_id, participante_id)
);

-- 6. Tabla pagos
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id UUID NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
  medio_pago medio_pago NOT NULL,
  fecha_pago DATE NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Índices para mejorar rendimiento
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_participantes_email ON participantes(email);
CREATE INDEX idx_participantes_usuario_id ON participantes(usuario_id);
CREATE INDEX idx_gastos_usuario_id ON gastos(usuario_id);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_gastos_tipo ON gastos(tipo);
CREATE INDEX idx_gastos_detalle_gasto_id ON gastos_detalle(gasto_id);
CREATE INDEX idx_gastos_detalle_participante_id ON gastos_detalle(participante_id);
CREATE INDEX idx_pagos_gasto_id ON pagos(gasto_id);
CREATE INDEX idx_pagos_participante_id ON pagos(participante_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago);

-- 8. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Triggers para updated_at
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participantes_updated_at BEFORE UPDATE ON participantes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gastos_updated_at BEFORE UPDATE ON gastos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Habilitar Row Level Security (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- 11. Políticas de seguridad básicas

-- Usuarios: pueden ver y editar solo sus propios datos
CREATE POLICY "Users can view own profile" ON usuarios
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON usuarios
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON usuarios
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Participantes: pueden ver todos, pero solo crear/editar los propios
CREATE POLICY "Anyone can view participants" ON participantes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert participants" ON participantes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own participants" ON participantes
    FOR UPDATE USING (usuario_id = auth.uid() OR usuario_id IS NULL);

-- Gastos: pueden ver todos, pero solo crear/editar/eliminar los propios
CREATE POLICY "Anyone can view expenses" ON gastos
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own expenses" ON gastos
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update own expenses" ON gastos
    FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "Users can delete own expenses" ON gastos
    FOR DELETE USING (auth.uid() = usuario_id);

-- Gastos detalle: pueden ver todos, pero solo crear/editar/eliminar los de gastos propios
CREATE POLICY "Anyone can view expense details" ON gastos_detalle
    FOR SELECT USING (true);

CREATE POLICY "Users can manage own expense details" ON gastos_detalle
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM gastos 
            WHERE gastos.id = gastos_detalle.gasto_id 
            AND gastos.usuario_id = auth.uid()
        )
    );

-- Pagos: pueden ver todos, pero solo crear/editar/eliminar los de gastos propios
CREATE POLICY "Anyone can view payments" ON pagos
    FOR SELECT USING (true);

CREATE POLICY "Users can manage payments for own expenses" ON pagos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM gastos 
            WHERE gastos.id = pagos.gasto_id 
            AND gastos.usuario_id = auth.uid()
        )
    );

-- 12. Función para validar que el monto total del gasto coincida con la suma de detalles
CREATE OR REPLACE FUNCTION validate_gasto_total()
RETURNS TRIGGER AS $$
DECLARE
    total_detalle DECIMAL(10,2);
    gasto_total DECIMAL(10,2);
BEGIN
    -- Obtener el total del gasto
    SELECT monto_total INTO gasto_total
    FROM gastos
    WHERE id = COALESCE(NEW.gasto_id, OLD.gasto_id);
    
    -- Calcular la suma de los detalles
    SELECT COALESCE(SUM(monto), 0) INTO total_detalle
    FROM gastos_detalle
    WHERE gasto_id = COALESCE(NEW.gasto_id, OLD.gasto_id);
    
    -- Validar que coincidan (con tolerancia de 0.01 para decimales)
    IF ABS(gasto_total - total_detalle) > 0.01 THEN
        RAISE EXCEPTION 'El monto total del gasto (%) no coincide con la suma de detalles (%)', 
            gasto_total, total_detalle;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 13. Trigger para validar totales
CREATE TRIGGER validate_gasto_total_trigger
    AFTER INSERT OR UPDATE OR DELETE ON gastos_detalle
    FOR EACH ROW EXECUTE FUNCTION validate_gasto_total();

-- 14. Función para obtener el balance de un participante
CREATE OR REPLACE FUNCTION get_participante_balance(participante_uuid UUID)
RETURNS TABLE(
    participante_id UUID,
    total_debe DECIMAL(10,2),
    total_pago DECIMAL(10,2),
    balance DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        participante_uuid,
        COALESCE(SUM(gd.monto), 0) as total_debe,
        COALESCE(SUM(p.monto), 0) as total_pago,
        COALESCE(SUM(p.monto), 0) - COALESCE(SUM(gd.monto), 0) as balance
    FROM participantes part
    LEFT JOIN gastos_detalle gd ON part.id = gd.participante_id
    LEFT JOIN pagos p ON part.id = p.participante_id
    WHERE part.id = participante_uuid
    GROUP BY part.id;
END;
$$ LANGUAGE plpgsql;

-- 15. Vista para resumen de gastos por usuario
CREATE VIEW resumen_gastos_usuario AS
SELECT 
    u.id as usuario_id,
    u.username,
    COUNT(g.id) as total_gastos,
    COALESCE(SUM(g.monto_total), 0) as monto_total_gastos,
    COUNT(CASE WHEN g.tipo = 'personal' THEN 1 END) as gastos_personales,
    COUNT(CASE WHEN g.tipo = 'compartido' THEN 1 END) as gastos_compartidos,
    COALESCE(SUM(CASE WHEN g.tipo = 'personal' THEN g.monto_total ELSE 0 END), 0) as monto_personal,
    COALESCE(SUM(CASE WHEN g.tipo = 'compartido' THEN g.monto_total ELSE 0 END), 0) as monto_compartido
FROM usuarios u
LEFT JOIN gastos g ON u.id = g.usuario_id
GROUP BY u.id, u.username;

-- 16. Vista para resumen de pagos por método
CREATE VIEW resumen_pagos_metodo AS
SELECT 
    medio_pago,
    COUNT(*) as cantidad_pagos,
    SUM(monto) as total_monto,
    AVG(monto) as promedio_monto,
    MIN(monto) as monto_minimo,
    MAX(monto) as monto_maximo
FROM pagos
GROUP BY medio_pago;

-- 17. Datos de ejemplo (opcional - comentar en producción)
/*
-- Usuario de ejemplo
INSERT INTO usuarios (id, username, email, first_name, last_name, is_active, is_verified)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@gastosapp.com',
    'Admin',
    'User',
    true,
    true
);

-- Participante de ejemplo
INSERT INTO participantes (email, nickname, usuario_id, es_registrado)
VALUES (
    'admin@gastosapp.com',
    'admin',
    '00000000-0000-0000-0000-000000000001',
    true
);
*/

-- Comentarios finales
COMMENT ON TABLE usuarios IS 'Tabla de usuarios registrados en la aplicación';
COMMENT ON TABLE participantes IS 'Tabla de participantes en gastos (registrados y no registrados)';
COMMENT ON TABLE gastos IS 'Tabla principal de gastos';
COMMENT ON TABLE gastos_detalle IS 'Detalle de participantes y montos por gasto';
COMMENT ON TABLE pagos IS 'Registro de pagos realizados';

COMMENT ON COLUMN gastos.tipo IS 'Tipo de gasto: personal (solo para el usuario) o compartido (entre varios participantes)';
COMMENT ON COLUMN pagos.medio_pago IS 'Método de pago utilizado: efectivo o transferencia';
COMMENT ON COLUMN participantes.es_registrado IS 'Indica si el participante tiene cuenta en la app';

-- Fin de migraciones