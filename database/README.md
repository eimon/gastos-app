# Migraciones de Base de Datos

## Estado Actual

✅ **Sistema de migraciones limpio y organizado**
- Migración completa consolidada: `000_migracion_completa.sql`
- Plantilla para nuevas migraciones: `001_ejemplo_nueva_migracion.sql`
- Documentación actualizada
- **Limpieza completada**: Se eliminaron 23 archivos obsoletos

### Archivos Actuales

La carpeta database ahora contiene únicamente los archivos esenciales:

#### Migraciones del Sistema
- `000_migracion_completa.sql` - Estado completo y actualizado de la base de datos
- `001_ejemplo_nueva_migracion.sql` - Plantilla y ejemplo para futuras migraciones

#### Documentación
- `README.md` - Este archivo de documentación

## Sistema de Migraciones Implementado

### Archivos del Nuevo Sistema

1. **Migración completa actual**:
   - `000_migracion_completa.sql` - ✅ **CREADO** - Estado completo actual de la BD

2. **Ejemplo de migración incremental**:
   - `001_ejemplo_nueva_migracion.sql` - ✅ **CREADO** - Plantilla para nuevas migraciones

3. **Próximas migraciones**:
   - `002_nueva_funcionalidad.sql` - Próxima migración real
   - `003_otra_mejora.sql` - Siguiente migración
   - etc.

### Estado del Sistema
- ✅ Reglas de base de datos documentadas (`DATABASE_RULES.md`)
- ✅ Migración completa consolidada creada
- ✅ Plantilla de ejemplo para nuevas migraciones
- ✅ Documentación actualizada

### Estado de la Base de Datos

**Tablas Principales:**
- `usuarios` - Gestión de usuarios
- `gastos` - Gastos principales
- `gastos_detalle` - Detalles de gastos por usuario/cuota
- `pagos` - Registro de pagos realizados
- `solicitudes_pago` - Sistema de solicitudes de pago

**Tipos ENUM:**
- `tipo_gasto` - 'personal', 'compartido'
- `tipo_descuento` - 'uniforme', 'primera_cuota'
- `medio_pago` - 'efectivo', 'transferencia', 'descuento'
- `estado_solicitud` - 'pendiente', 'aceptada', 'rechazada'

**Funciones RPC:**
- `crear_solicitud_pago()` - Crear solicitud de pago
- `obtener_solicitudes_recibidas()` - Obtener solicitudes recibidas
- `obtener_solicitudes_enviadas()` - Obtener solicitudes enviadas
- `aceptar_solicitud_pago()` - Aceptar solicitud de pago
- `rechazar_solicitud_pago()` - Rechazar solicitud de pago

## Instrucciones de Uso

### Para Aplicar Migraciones

1. **Revisar el script** antes de ejecutar
2. **Hacer backup** de la base de datos
3. **Ejecutar en desarrollo** primero
4. **Probar funcionalidad** afectada
5. **Aplicar en producción** cuando esté validado

### Para Crear Nuevas Migraciones

1. Seguir las reglas en `DATABASE_RULES.md`
2. Usar el siguiente número incremental
3. Actualizar la migración completa
4. Documentar los cambios

## Notas Importantes

⚠️ **Los archivos existentes son históricos** - No modificar
⚠️ **Nuevas migraciones deben seguir la numeración** - Ver DATABASE_RULES.md
⚠️ **Siempre probar en desarrollo** antes de producción
⚠️ **Mantener la migración completa actualizada**

---

*Última actualización: Enero 2024*
*Para más información, consultar DATABASE_RULES.md en la raíz del proyecto*