import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { trainingRevenueApiPlugin } from './vite-plugin-training-revenue-api';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // Tránh EPERM khi Windows/antivirus khóa node_modules/.vite
    cacheDir: path.resolve(__dirname, '.vite-cache'),
    server: {
      port: 3003,
      host: '0.0.0.0',
    },
    plugins: [react(), trainingRevenueApiPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks - split heavy dependencies
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-charts': ['recharts'],
            'vendor-ui': ['lucide-react'],
            'vendor-xlsx': ['xlsx'],
          },
        },
      },
      chunkSizeWarningLimit: 600, // KB
    },
  };
});
