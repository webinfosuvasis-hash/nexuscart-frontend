import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

/**
 * Dev server for the E2E crawl: same app, but /api is proxied to a real
 * backend (default: the Surflex deploy) so the browser never hits CORS.
 *   E2E_API_ORIGIN=https://… npx playwright test -c e2e
 */
const API_ORIGIN = process.env.E2E_API_ORIGIN ?? 'https://nexuscart.surflextechnology.in';

// Real VITE_* env vars outrank .env files; mode 'e2e' means no .env.development is loaded at all.
process.env.VITE_API_BASE_URL = '/api/v1';
process.env.VITE_STORE_ID ??= process.env.E2E_STORE_ID ?? 'cmqpfhdsf0003bhb9df1jq8j2';
process.env.VITE_DATA_DRIVEN_HOME = 'true';

export default defineConfig({
  mode: 'e2e',
  root: path.resolve(__dirname, '..'),
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  server: {
    port: 5179,
    strictPort: true,
    proxy: { '/api': { target: API_ORIGIN, changeOrigin: true, secure: true } },
  },
});
