import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works on GitHub Pages, itch.io or any sub-path.
  base: './',
  build: {
    target: 'es2023',
    cssMinify: true,
    reportCompressedSize: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
