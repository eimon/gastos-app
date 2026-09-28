/**
 * SQLite schema (Drizzle ORM). Money is stored as INTEGER cents, calendar
 * dates as TEXT `YYYY-MM-DD`, ids as TEXT UUIDs (`expo-crypto.randomUUID()`,
 * assigned in `data/`). Every table carries `created_at`/`updated_at`
 * (ISO-UTC TEXT audit timestamps) and `deleted_at` (soft delete — never a
 * hard DELETE). See `sdd/offline-redesign/design` for the full rationale.
 */
import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

const auditColumns = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(current_timestamp)`),
  deletedAt: text('deleted_at'),
};

export const tarjetas = sqliteTable(
  'tarjetas',
  {
    id: text('id').primaryKey(),
    nombre: text('nombre').notNull(),
    diaCierre: integer('dia_cierre').notNull(),
    diaVencimiento: integer('dia_vencimiento').notNull(),
    ...auditColumns,
  },
  (t) => [
    check('tarjetas_dia_cierre_check', sql`${t.diaCierre} >= 1 AND ${t.diaCierre} <= 31`),
    check(
      'tarjetas_dia_vencimiento_check',
      sql`${t.diaVencimiento} >= 1 AND ${t.diaVencimiento} <= 31`,
    ),
  ],
);

export const gastos = sqliteTable(
  'gastos',
  {
    id: text('id').primaryKey(),
    descripcion: text('descripcion').notNull(),
    fechaCompra: text('fecha_compra').notNull(),
    tipo: text('tipo', { enum: ['personal', 'compartido'] }).notNull(),
    montoTotalCents: integer('monto_total_cents').notNull(),
    descuentoCents: integer('descuento_cents').notNull().default(0),
    tipoDescuento: text('tipo_descuento', { enum: ['uniforme', 'prorrateo'] }),
    cantidadCuotas: integer('cantidad_cuotas').notNull(),
    tarjetaId: text('tarjeta_id').references(() => tarjetas.id),
    ...auditColumns,
  },
  (t) => [
    check(
      'gastos_tarjeta_requerida_check',
      sql`${t.cantidadCuotas} = 1 OR ${t.tarjetaId} IS NOT NULL`,
    ),
    check(
      'gastos_descuento_check',
      sql`${t.descuentoCents} >= 0 AND ${t.descuentoCents} < ${t.montoTotalCents}`,
    ),
  ],
);

export const gastoCuotas = sqliteTable(
  'gasto_cuotas',
  {
    id: text('id').primaryKey(),
    gastoId: text('gasto_id')
      .notNull()
      .references(() => gastos.id),
    numero: integer('numero').notNull(),
    montoCents: integer('monto_cents').notNull(),
    fechaCierre: text('fecha_cierre'),
    fechaVencimiento: text('fecha_vencimiento').notNull(),
    ...auditColumns,
  },
  (t) => [unique('gasto_cuotas_gasto_numero_unique').on(t.gastoId, t.numero)],
);

export const gastoParticipantes = sqliteTable('gasto_participantes', {
  id: text('id').primaryKey(),
  gastoId: text('gasto_id')
    .notNull()
    .references(() => gastos.id),
  nombre: text('nombre').notNull(),
  esUsuario: integer('es_usuario', { mode: 'boolean' }).notNull().default(false),
  orden: integer('orden').notNull(),
  ...auditColumns,
});

export const cuotaParticipantes = sqliteTable(
  'cuota_participantes',
  {
    id: text('id').primaryKey(),
    gastoCuotaId: text('gasto_cuota_id')
      .notNull()
      .references(() => gastoCuotas.id),
    participanteId: text('participante_id')
      .notNull()
      .references(() => gastoParticipantes.id),
    montoCents: integer('monto_cents').notNull(),
    ...auditColumns,
  },
  (t) => [check('cuota_participantes_monto_check', sql`${t.montoCents} >= 0`)],
);

export const deudas = sqliteTable(
  'deudas',
  {
    id: text('id').primaryKey(),
    acreedor: text('acreedor').notNull(),
    descripcion: text('descripcion').notNull(),
    montoTotalCents: integer('monto_total_cents').notNull(),
    cantidadCuotas: integer('cantidad_cuotas').notNull(),
    fechaPrimerPago: text('fecha_primer_pago').notNull(),
    ...auditColumns,
  },
  (t) => [check('deudas_monto_check', sql`${t.montoTotalCents} > 0`)],
);

export const deudaCuotas = sqliteTable(
  'deuda_cuotas',
  {
    id: text('id').primaryKey(),
    deudaId: text('deuda_id')
      .notNull()
      .references(() => deudas.id),
    numero: integer('numero').notNull(),
    montoCents: integer('monto_cents').notNull(),
    fechaVencimiento: text('fecha_vencimiento').notNull(),
    ...auditColumns,
  },
  (t) => [unique('deuda_cuotas_deuda_numero_unique').on(t.deudaId, t.numero)],
);

export const pagos = sqliteTable(
  'pagos',
  {
    id: text('id').primaryKey(),
    cuotaParticipanteId: text('cuota_participante_id').references(() => cuotaParticipantes.id),
    deudaCuotaId: text('deuda_cuota_id').references(() => deudaCuotas.id),
    montoCents: integer('monto_cents').notNull(),
    medioPago: text('medio_pago', { enum: ['efectivo', 'transferencia'] }).notNull(),
    fecha: text('fecha').notNull(),
    notas: text('notas'),
    ...auditColumns,
  },
  (t) => [
    check('pagos_monto_check', sql`${t.montoCents} > 0`),
    check(
      'pagos_exactly_one_target_check',
      sql`(${t.cuotaParticipanteId} IS NOT NULL AND ${t.deudaCuotaId} IS NULL) OR (${t.cuotaParticipanteId} IS NULL AND ${t.deudaCuotaId} IS NOT NULL)`,
    ),
  ],
);
