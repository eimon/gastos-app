# Reglas de Base de Datos del Proyecto

## Principios Generales

### Ejecución Manual
- **TODAS** las operaciones de base de datos se ejecutan manualmente
- El asistente AI **NUNCA** ejecutará comandos SQL directamente
- Todos los cambios de base de datos deben ser revisados antes de su ejecución

### Estructura de Archivos
- Todos los scripts SQL se almacenan en la carpeta `database/`
- Cada migración debe tener un número incremental para mantener el orden
- Formato de nombres: `001_descripcion_migración.sql`, `002_otra_migración.sql`, etc.

## Sistema de Migraciones

### Numeración
- Las migraciones se numeran secuencialmente: 001, 002, 003, etc.
- **NUNCA** reutilizar números de migración
- Mantener el orden cronológico estricto

### Migración Completa
- Cada nueva migración debe incluir **TODOS** los cambios necesarios para crear la base de datos desde cero
- El archivo `000_migracion_completa.sql` debe contener siempre el estado actual completo de la base de datos
- Cuando se crea una nueva migración incremental, se debe actualizar también la migración completa

### Estructura de Archivos de Migración

```
database/
├── 000_migracion_completa.sql          # Estado completo actual de la BD
├── 001_inicial.sql                     # Primera migración
├── 002_agregar_tabla_usuarios.sql      # Segunda migración
├── 003_agregar_solicitudes_pago.sql    # Tercera migración
├── 004_nueva_funcionalidad.sql         # Próxima migración
└── README.md                           # Documentación de migraciones
```

## Contenido de las Migraciones

### Migración Completa (000_migracion_completa.sql)
- Debe contener:
  - Creación de todos los tipos ENUM
  - Creación de todas las tablas con sus constraints
  - Creación de todos los índices
  - Creación de todas las funciones y procedimientos
  - Políticas RLS (Row Level Security)
  - Datos iniciales si los hay

### Migraciones Incrementales
- Cada migración incremental debe:
  - Tener un comentario explicativo al inicio
  - Incluir verificaciones de existencia (IF NOT EXISTS, etc.)
  - Ser idempotente (se puede ejecutar múltiples veces sin error)
  - Incluir rollback si es necesario

### Ejemplo de Migración Incremental

```sql
-- Migración 004: Agregar campo 'activo' a tabla usuarios
-- Fecha: 2024-01-XX
-- Descripción: Agregar campo para marcar usuarios activos/inactivos

-- Verificar si la columna ya existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='usuarios' AND column_name='activo') THEN
        ALTER TABLE usuarios ADD COLUMN activo BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Crear índice si no existe
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);
```

## Proceso de Trabajo

### Para el Asistente AI
1. **NUNCA** ejecutar comandos SQL
2. Generar scripts en la carpeta `database/`
3. Asignar el siguiente número incremental disponible
4. Actualizar la migración completa con los cambios
5. Documentar claramente los cambios

### Para el Desarrollador
1. Revisar el script generado
2. Ejecutar manualmente en el entorno de desarrollo
3. Probar la funcionalidad
4. Ejecutar en producción cuando esté validado
5. Marcar la migración como aplicada

## Convenciones de Nomenclatura

### Archivos
- `000_migracion_completa.sql` - Migración completa actual
- `XXX_descripcion_corta.sql` - Migraciones incrementales
- `test_XXXX.sql` - Scripts de prueba (opcional)
- `rollback_XXX.sql` - Scripts de rollback (opcional)

### Objetos de Base de Datos
- Tablas: `snake_case` (ej: `gastos_detalle`)
- Columnas: `snake_case` (ej: `usuario_id`)
- Funciones: `snake_case` (ej: `crear_solicitud_pago`)
- Tipos ENUM: `snake_case` (ej: `estado_solicitud`)
- Índices: `idx_tabla_columna` (ej: `idx_gastos_usuario_id`)

## Validaciones

### Antes de Crear una Migración
- Verificar que el número incremental sea correcto
- Asegurar que la migración completa esté actualizada
- Documentar el propósito del cambio
- Incluir verificaciones de existencia

### Después de Aplicar una Migración
- Verificar que la estructura sea correcta
- Probar las funciones nuevas/modificadas
- Validar que los datos existentes no se corrompan
- Actualizar la documentación si es necesario

## Herramientas Recomendadas

- **pgAdmin** o **DBeaver** para ejecución manual de scripts
- **Git** para control de versiones de los scripts
- **Backup** antes de aplicar migraciones importantes

## Notas Importantes

⚠️ **NUNCA** modificar migraciones ya aplicadas en producción
⚠️ **SIEMPRE** hacer backup antes de aplicar migraciones
⚠️ **PROBAR** primero en entorno de desarrollo
⚠️ **DOCUMENTAR** todos los cambios realizados

---

*Este documento debe ser actualizado cuando se modifiquen las reglas o procesos de base de datos.*