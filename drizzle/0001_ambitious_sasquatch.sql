CREATE INDEX `cuota_participantes_gasto_cuota_id_idx` ON `cuota_participantes` (`gasto_cuota_id`);--> statement-breakpoint
CREATE INDEX `cuota_participantes_participante_id_idx` ON `cuota_participantes` (`participante_id`);--> statement-breakpoint
CREATE INDEX `deuda_cuotas_fecha_vencimiento_idx` ON `deuda_cuotas` (`fecha_vencimiento`);--> statement-breakpoint
CREATE INDEX `gasto_cuotas_fecha_vencimiento_idx` ON `gasto_cuotas` (`fecha_vencimiento`);--> statement-breakpoint
CREATE INDEX `gasto_participantes_gasto_id_idx` ON `gasto_participantes` (`gasto_id`);--> statement-breakpoint
CREATE INDEX `gastos_tarjeta_id_idx` ON `gastos` (`tarjeta_id`);--> statement-breakpoint
CREATE INDEX `pagos_cuota_participante_id_idx` ON `pagos` (`cuota_participante_id`);--> statement-breakpoint
CREATE INDEX `pagos_deuda_cuota_id_idx` ON `pagos` (`deuda_cuota_id`);