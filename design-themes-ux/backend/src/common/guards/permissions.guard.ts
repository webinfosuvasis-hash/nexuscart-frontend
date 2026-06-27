import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '@/common/decorators/permissions.decorator';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  STORE_OWNER: [
    'products:*', 'categories:*', 'brands:*', 'collections:*',
    'attributes:*', 'inventory:*', 'orders:*',
    'customers:*', 'marketing:*', 'cms:*',
    'themes:*',   // ThemesModule (marketplace, install, activate)
    'theme:*',    // ThemeEngineModule (config, header, footer, sections, presets, preview)
    'settings:*', 'analytics:read', 'staff:*', 'upload:*',
    'homepage:*', // Page Builder — full access (read, edit, publish, reorder)
  ],
  STORE_MANAGER: [
    'products:*', 'categories:*', 'brands:*', 'collections:*',
    'attributes:*', 'inventory:*', 'orders:*',
    'customers:read', 'marketing:read', 'cms:*',
    'theme:read', 'theme:update',   // can customize but not publish
    'analytics:read',
    'homepage:read', 'homepage:edit', // Page Builder — can edit but not publish
  ],
  STORE_STAFF: [
    'products:read', 'orders:read', 'orders:update', 'customers:read',
    'homepage:read', // Page Builder — read-only view
  ],
  CUSTOMER: ['profile:*', 'orders:read'],
};

function hasPermission(userPermissions: string[], required: string): boolean {
  return userPermissions.some((p) => {
    if (p === '*') return true;
    if (p === required) return true;
    const [resource, action] = p.split(':');
    const [reqResource, reqAction] = required.split(':');
    if (resource === reqResource && action === '*') return true;
    return false;
  });
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions && !requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');

    const userPerms: string[] = ROLE_PERMISSIONS[user.role] ?? [];

    if (requiredRoles?.length) {
      if (!requiredRoles.includes(user.role)) {
        throw new ForbiddenException('Insufficient role');
      }
    }

    if (requiredPermissions?.length) {
      const allGranted = requiredPermissions.every((p) =>
        hasPermission(userPerms, p),
      );
      if (!allGranted) throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
