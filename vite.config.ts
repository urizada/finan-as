/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode teste` gera um único HTML (sem PWA) para a página de testes.
export default defineConfig(({ mode }) => ({
  build: mode === 'teste' ? { outDir: 'dist-teste' } : undefined,
  plugins: [
    react(),
    tailwindcss(),
    mode === 'teste' ? viteSingleFile() : VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'Finanças',
        short_name: 'Finanças',
        description: 'Organização financeira pessoal',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f6f4',
        theme_color: '#f3f6f4',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/testes/setup.ts'],
  },
}));
