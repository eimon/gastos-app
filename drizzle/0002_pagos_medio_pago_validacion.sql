-- Custom migration: reject an invalid pagos.medio_pago at runtime.
-- Valid values are 'efectivo' and 'transferencia'. SQLite cannot add a CHECK to an
-- existing table without rebuilding it, so BEFORE INSERT/UPDATE triggers are used instead.
CREATE TRIGGER `pagos_medio_pago_insert_check`
BEFORE INSERT ON `pagos`
FOR EACH ROW
WHEN NEW.`medio_pago` NOT IN ('efectivo', 'transferencia')
BEGIN
	SELECT RAISE(ABORT, 'pagos.medio_pago must be efectivo or transferencia');
END;
--> statement-breakpoint
CREATE TRIGGER `pagos_medio_pago_update_check`
BEFORE UPDATE OF `medio_pago` ON `pagos`
FOR EACH ROW
WHEN NEW.`medio_pago` NOT IN ('efectivo', 'transferencia')
BEGIN
	SELECT RAISE(ABORT, 'pagos.medio_pago must be efectivo or transferencia');
END;
