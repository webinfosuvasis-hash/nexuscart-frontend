import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { VendorNotificationsController } from './vendor-notifications.controller';
import { VendorOrderNotificationService } from './vendor-order-notification.service';

// PrismaService, ConfigService, EmailService and EventEmitter2 are @Global.
@Module({
  controllers: [VendorsController, VendorNotificationsController],
  providers: [VendorsService, VendorOrderNotificationService],
  exports: [VendorsService, VendorOrderNotificationService],
})
export class VendorsModule {}
