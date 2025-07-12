/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: '../dist'
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['../test/**/*.test.ts'],
  }
});

