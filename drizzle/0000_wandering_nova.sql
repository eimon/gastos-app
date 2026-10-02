CREATE TABLE `cuota_participantes` (
	`id` text PRIMARY KEY NOT NULL,
	`gasto_cuota_id` text NOT NULL,
	`participante_id` text NOT NULL,
	`monto_cents` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`gasto_cuota_id`) REFERENCES `gasto_cuotas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participante_id`) REFERENCES `gasto_participantes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cuota_participantes_monto_check" CHECK("cuota_participantes"."monto_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE `deuda_cuotas` (
	`id` text PRIMARY KEY NOT NULL,
	`deuda_id` text NOT NULL,
	`numero` integer NOT NULL,
	`monto_cents` integer NOT NULL,
	`fecha_vencimiento` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`deuda_id`) REFERENCES `deudas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deuda_cuotas_deuda_numero_unique` ON `deuda_cuotas` (`deuda_id`,`numero`);--> statement-breakpoint
CREATE TABLE `deudas` (
	`id` text PRIMARY KEY NOT NULL,
	`acreedor` text NOT NULL,
	`descripcion` text NOT NULL,
	`monto_total_cents` integer NOT NULL,
	`cantidad_cuotas` integer NOT NULL,
	`fecha_primer_pago` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	CONSTRAINT "deudas_monto_check" CHECK("deudas"."monto_total_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE `gasto_cuotas` (
	`id` text PRIMARY KEY NOT NULL,
	`gasto_id` text NOT NULL,
	`numero` integer NOT NULL,
	`monto_cents` integer NOT NULL,
	`fecha_cierre` text,
	`fecha_vencimiento` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`gasto_id`) REFERENCES `gastos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gasto_cuotas_gasto_numero_unique` ON `gasto_cuotas` (`gasto_id`,`numero`);--> statement-breakpoint
CREATE TABLE `gasto_participantes` (
	`id` text PRIMARY KEY NOT NULL,
	`gasto_id` text NOT NULL,
	`nombre` text NOT NULL,
	`es_usuario` integer DEFAULT false NOT NULL,
	`orden` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`gasto_id`) REFERENCES `gastos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gastos` (
	`id` text PRIMARY KEY NOT NULL,
	`descripcion` text NOT NULL,
	`fecha_compra` text NOT NULL,
	`tipo` text NOT NULL,
	`monto_total_cents` integer NOT NULL,
	`descuento_cents` integer DEFAULT 0 NOT NULL,
	`tipo_descuento` text,
	`cantidad_cuotas` integer NOT NULL,
	`tarjeta_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`tarjeta_id`) REFERENCES `tarjetas`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "gastos_tarjeta_requerida_check" CHECK("gastos"."cantidad_cuotas" = 1 OR "gastos"."tarjeta_id" IS NOT NULL),
	CONSTRAINT "gastos_descuento_check" CHECK("gastos"."descuento_cents" >= 0 AND "gastos"."descuento_cents" < "gastos"."monto_total_cents")
);
--> statement-breakpoint
CREATE TABLE `pagos` (
	`id` text PRIMARY KEY NOT NULL,
	`cuota_participante_id` text,
	`deuda_cuota_id` text,
	`monto_cents` integer NOT NULL,
	`medio_pago` text NOT NULL,
	`fecha` text NOT NULL,
	`notas` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`cuota_participante_id`) REFERENCES `cuota_participantes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deuda_cuota_id`) REFERENCES `deuda_cuotas`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pagos_monto_check" CHECK("pagos"."monto_cents" > 0),
	CONSTRAINT "pagos_exactly_one_target_check" CHECK(("pagos"."cuota_participante_id" IS NOT NULL AND "pagos"."deuda_cuota_id" IS NULL) OR ("pagos"."cuota_participante_id" IS NULL AND "pagos"."deuda_cuota_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `tarjetas` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`dia_cierre` integer NOT NULL,
	`dia_vencimiento` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	`deleted_at` text,
	CONSTRAINT "tarjetas_dia_cierre_check" CHECK("tarjetas"."dia_cierre" >= 1 AND "tarjetas"."dia_cierre" <= 31),
	CONSTRAINT "tarjetas_dia_vencimiento_check" CHECK("tarjetas"."dia_vencimiento" >= 1 AND "tarjetas"."dia_vencimiento" <= 31)
);
