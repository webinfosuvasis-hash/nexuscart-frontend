import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals:     true,
    environment: 'jsdom',
    setupFiles:  ['./src/test/setup.ts'],
    include:     ['src/**/*.test.{ts,tsx}'],
    env: {
      VITE_API_BASE_URL: 'http://api.test/api/v1',
      VITE_STORE_ID:     'store_test',
    },
  },
});
