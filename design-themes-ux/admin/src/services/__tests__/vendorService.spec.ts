import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import { vendorService } from '../vendorService';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete', ReturnType<typeof vi.fn>>;

describe('vendorService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists vendors from /vendors with query params', async () => {
    mocked.get.mockResolvedValue({ data: { items: [], pagination: {} } });
    await vendorService.list({ limit: 200, status: 'ACTIVE' });
    expect(mocked.get).toHaveBeenCalledWith('/vendors', { params: { limit: 200, status: 'ACTIVE' } });
  });

  it('uses the backend verbs: POST create, PUT update, DELETE remove', async () => {
    await vendorService.create({ name: 'Suta', email: 'orders@suta.example' });
    await vendorService.update('v1', { status: 'INACTIVE' });
    await vendorService.delete('v1');

    expect(mocked.post).toHaveBeenCalledWith('/vendors', { name: 'Suta', email: 'orders@suta.example' });
    expect(mocked.put).toHaveBeenCalledWith('/vendors/v1', { status: 'INACTIVE' });
    expect(mocked.delete).toHaveBeenCalledWith('/vendors/v1');
  });
});
