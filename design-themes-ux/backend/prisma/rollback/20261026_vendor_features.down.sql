-- Rollback for 20261026120000_vendor_order_notifications + 20261026000000_vendor_assignment.
-- NOT a Prisma migration (kept outside prisma/migrations on purpose). Run manually,
-- after taking a backup, only together with redeploying the previous backend build.
-- DATA LOSS: vendors, product→vendor assignments, order-line vendor snapshots and
-- vendor email delivery records are deleted. Order/product rows themselves are kept.
-- Afterwards remove the two rows from _prisma_migrations:
--   DELETE FROM _prisma_migrations WHERE migration_name IN
--     ('20261026120000_vendor_order_notifications', '20261026000000_vendor_assignment');
-- Pending VENDOR_ORDER_EMAIL outbox events are harmless (no listener) but can be cleared:
--   UPDATE outbox_events SET status = 'DEAD' WHERE eventType = 'VENDOR_ORDER_EMAIL' AND status IN ('PENDING', 'PROCESSING');

DROP TABLE `vendor_order_notifications`;

ALTER TABLE `products` DROP FOREIGN KEY `products_vendorId_fkey`;
DROP INDEX `products_vendorId_fkey` ON `products`;
ALTER TABLE `products` DROP COLUMN `vendorId`;

DROP INDEX `order_items_vendorId_idx` ON `order_items`;
ALTER TABLE `order_items` DROP COLUMN `vendorId`;

DROP TABLE `vendors`;
