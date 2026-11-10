-- Fix: MenuItem.parentId FK defaulted to ON DELETE SET NULL (Prisma's default
-- for an optional relation with no onDelete specified). Deleting a parent
-- menu item silently set its children's parentId to NULL instead of removing
-- them, and the storefront nav resolver treats any item with no resolvable
-- parent as a top-level item by design -- so orphaned children resurfaced as
-- bogus new entries in the live navigation bar. Cascade the delete instead so
-- removing a parent removes its whole subtree.
ALTER TABLE `menu_items` DROP FOREIGN KEY `menu_items_parentId_fkey`;
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
