import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { PrismaService } from '@/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Default seed data per business type ──────────────────────────────────
  private readonly DEFAULT_CATEGORIES: Record<string, string[]> = {
    FASHION:     ['Women', 'Men', 'Kids', 'Accessories', 'Footwear'],
    ELECTRONICS: ['Mobiles', 'Laptops', 'Audio', 'Cameras', 'Accessories'],
    FURNITURE:   ['Living Room', 'Bedroom', 'Office', 'Kitchen', 'Outdoor'],
    GROCERY:     ['Fruits & Vegetables', 'Dairy', 'Beverages', 'Snacks', 'Bakery'],
    COSMETICS:   ['Skincare', 'Haircare', 'Makeup', 'Fragrances', 'Bath & Body'],
    GIFTS:       ['Birthday', 'Anniversary', 'Festive', 'Corporate', 'Kids'],
    LIFESTYLE:   ['Fitness', 'Travel', 'Books', 'Toys', 'Stationery'],
  };

  async seedStoreDefaults(storeId: string, businessType = 'FASHION') {
    const categories = this.DEFAULT_CATEGORIES[businessType] ?? this.DEFAULT_CATEGORIES['FASHION'];
    await this.prisma.category.createMany({
      data: categories.map((name, i) => ({
        storeId,
        name,
        slug: slugify(name, { lower: true, strict: true }) + '-' + i,
        sortOrder: i,
        isActive: true,
        isFeatured: false,
        showOnHomepage: false,
        menuVisibility: 'BOTH',
      })),
      skipDuplicates: true,
    });
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const { user, storeId } = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          role: 'STORE_OWNER',
        },
      });

      let createdStoreId: string | null = null;
      if (dto.storeName) {
        const slug = slugify(dto.storeName, { lower: true, strict: true });
        const store = await tx.store.create({
          data: {
            name: dto.storeName,
            slug: `${slug}-${Date.now()}`,
            domain: `${slug}.nexuscart.com`,
            businessType: (dto.businessType ?? 'FASHION') as any,
            status: 'TRIAL',
            ownerId: newUser.id,
            staff: { create: { userId: newUser.id, role: 'OWNER' } },
          },
        });
        createdStoreId = store.id;
        await tx.user.update({ where: { id: newUser.id }, data: { storeId: store.id } });
      }

      return { user: newUser, storeId: createdStoreId };
    });

    // Seed default categories after transaction (outside tx so it doesn't block registration)
    if (storeId) {
      await this.seedStoreDefaults(storeId, dto.businessType ?? 'FASHION').catch(() => {});
    }

    return this.signTokens(user.id, user.email, user.role, storeId);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { ownedStore: { select: { id: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const storeId = user.ownedStore?.id ?? null;
    const tokens = await this.signTokens(user.id, user.email, user.role, storeId);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { ...tokens, user: { id: user.id, name: user.name, email: user.email, role: user.role, storeId } };
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = await this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Possible token reuse — revoke all tokens for this user
      if (stored?.userId) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Refresh token is invalid or has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, storeId: true, isActive: true },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    // Rotate: revoke old token, issue new one
    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    return this.signTokens(user.id, user.email, user.role, user.storeId);
  }

  async logout(refreshToken: string) {
    const tokenHash = await this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async hashToken(token: string): Promise<string> {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(token).digest('hex');
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { message: 'Password changed successfully' };
  }

  private async signTokens(userId: string, email: string, role: string, storeId: string | null) {
    const payload = { sub: userId, email, role, storeId };
    const refreshTtlDays = parseInt(this.config.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? '7', 10);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ?? '15m') as any,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (`${refreshTtlDays}d`) as any,
      }),
    ]);

    // Store hashed refresh token for revocation/rotation tracking
    const tokenHash = await this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });

    return { accessToken, refreshToken };
  }
}
