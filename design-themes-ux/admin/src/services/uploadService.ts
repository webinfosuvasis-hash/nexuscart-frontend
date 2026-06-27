import api from '@/lib/api';

const BACKEND = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1')
  .replace('/api/v1', '');

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const res: any = await api.post('/upload/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  // TransformInterceptor wraps in { success, data, timestamp }
  const data = res?.data ?? res;
  const url: string = data?.url ?? '';

  // Prepend backend host for relative /uploads/xxx paths
  return url.startsWith('http') ? url : `${BACKEND}${url}`;
}
