import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface ReviewDto {
  id:         string;
  rating:     number;
  title:      string | null;
  body:       string | null;
  isVerified: boolean;
  createdAt:  Date;
  author:     string;
}

export interface ProductReviewsResponse {
  reviews:         ReviewDto[];
  pagination:      { page: number; limit: number; total: number; totalPages: number };
  average:         number;
  total:           number;
  ratingBreakdown: Record<'5' | '4' | '3' | '2' | '1', number>;
}

/** StorefrontReviewsService — public, read-only review listing for the PDP (Phase P2). */
@Injectable()
export class StorefrontReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReviews(
    storeId: string,
    productId: string,
    params: { page?: number; limit?: number; rating?: number } = {},
  ): Promise<ProductReviewsResponse> {
    const page  = Math.max(1, params.page ?? 1);
    const limit = Math.min(params.limit ?? 6, 30);

    const where = {
      productId,
      isVisible: true,
      product: { storeId },
      ...(params.rating ? { rating: params.rating } : {}),
    };

    const [rows, total, allForBreakdown] = await Promise.all([
      this.prisma.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { customer: { select: { name: true } } },
      }),
      this.prisma.productReview.count({ where }),
      this.prisma.productReview.findMany({
        where: { productId, isVisible: true, product: { storeId } },
        select: { rating: true },
      }),
    ]);

    const reviews: ReviewDto[] = rows.map((r) => ({
      id:         r.id,
      rating:     r.rating,
      title:      r.title,
      body:       r.body,
      isVerified: r.isVerified,
      createdAt:  r.createdAt,
      author:     this.formatAuthor(r.customer?.name),
    }));

    const breakdownCounts: Record<'5' | '4' | '3' | '2' | '1', number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    for (const r of allForBreakdown) {
      const key = String(Math.min(5, Math.max(1, r.rating))) as '5' | '4' | '3' | '2' | '1';
      breakdownCounts[key]++;
    }
    const overallTotal = allForBreakdown.length;
    const average = overallTotal
      ? allForBreakdown.reduce((sum, r) => sum + r.rating, 0) / overallTotal
      : 0;
    const ratingBreakdown: Record<'5' | '4' | '3' | '2' | '1', number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    (['5', '4', '3', '2', '1'] as const).forEach((k) => {
      ratingBreakdown[k] = overallTotal ? Math.round((breakdownCounts[k] / overallTotal) * 100) : 0;
    });

    return {
      reviews,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      average: Math.round(average * 10) / 10,
      total: overallTotal,
      ratingBreakdown,
    };
  }

  /** First name + last-initial only — reviews are public, full names are not exposed. */
  private formatAuthor(fullName?: string | null): string {
    if (!fullName?.trim()) return 'Verified Buyer';
    const [first, ...rest] = fullName.trim().split(/\s+/);
    const last = rest[rest.length - 1];
    return last ? `${first} ${last.charAt(0)}.` : first;
  }
}
