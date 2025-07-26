# Solución para Problemas de Redondeo en Gastos

## Problema
Cuando se crean gastos con descuentos y se dividen entre múltiples participantes, pueden ocurrir diferencias de redondeo que causan errores como:
```
ERROR: El total de gastos_detalle (2557.95) no coincide con el monto neto del gasto (2310.00 - 248.00 = 2062.00)
```

## Solución Implementada

### 1. Función de Validación Mejorada
La función `validate_gasto_total()` ahora:
- **Detecta automáticamente** diferencias de redondeo mayores a 0.01
- **Ajusta automáticamente** el último detalle del gasto para que coincida exactamente
- **Registra** los ajustes realizados en los logs

### 2. Scripts de Corrección

#### Para corregir datos existentes:
```sql
-- Ejecutar en la base de datos
\i database/fix_rounding_issues.sql
```

#### Para funciones adicionales:
```sql
-- Ejecutar en la base de datos
\i database/enhanced_validation.sql
```

### 3. Funciones Útiles Disponibles

#### Verificar integridad de todos los gastos:
```sql
SELECT * FROM verificar_integridad_gastos();
```

#### Ajustar un gasto específico manualmente:
```sql
SELECT * FROM ajustar_redondeo_gasto('uuid-del-gasto');
```

#### Distribuir monto con manejo de redondeo:
```sql
SELECT distribuir_monto_con_redondeo(2062.00, 3); -- monto, num_participantes
```

## Cómo Aplicar la Solución

### Opción 1: Reset completo de la base de datos (Recomendado)
1. Ejecutar la migración actualizada:
   ```sql
   \i database/migracion.sql
   ```

### Opción 2: Aplicar solo las correcciones
1. Actualizar la función de validación:
   ```sql
   -- Copiar y ejecutar solo la función validate_gasto_total() actualizada
   ```

2. Corregir datos existentes:
   ```sql
   \i database/fix_rounding_issues.sql
   ```

3. Agregar funciones adicionales (opcional):
   ```sql
   \i database/enhanced_validation.sql
   ```

## Prevención de Problemas Futuros

### En el Frontend
Cuando se divida un gasto entre participantes:

```javascript
// Ejemplo de distribución con manejo de redondeo
function distribuirGastoConRedondeo(montoTotal, participantes) {
  const montoPorParticipante = Math.round((montoTotal / participantes.length) * 100) / 100;
  const montos = new Array(participantes.length).fill(montoPorParticipante);
  
  // Calcular diferencia por redondeo
  const totalDistribuido = montoPorParticipante * participantes.length;
  const diferencia = Math.round((montoTotal - totalDistribuido) * 100) / 100;
  
  // Ajustar el último participante
  if (Math.abs(diferencia) > 0) {
    montos[montos.length - 1] += diferencia;
  }
  
  return montos;
}
```

### En la Base de Datos
La función `validate_gasto_total()` ahora maneja automáticamente:
- ✅ Detección de diferencias de redondeo
- ✅ Ajuste automático del último detalle
- ✅ Logging de ajustes realizados
- ✅ Validación continua en INSERT/UPDATE/DELETE

## Notas Importantes

1. **Los ajustes son automáticos**: No necesitas intervención manual para nuevos gastos
2. **Se preserva la integridad**: El total siempre coincidirá exactamente
3. **Transparencia**: Todos los ajustes se registran en los logs
4. **Retrocompatibilidad**: Los gastos existentes se pueden corregir con los scripts proporcionados

## Verificación

Para verificar que todo funciona correctamente:

```sql
-- Verificar que no hay problemas de redondeo
SELECT * FROM verificar_integridad_gastos() WHERE estado = 'REQUIERE AJUSTE';

-- Si el resultado está vacío, todo está correcto
```