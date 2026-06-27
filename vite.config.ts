import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'KeyboardControl',
            formats: ['iife'],
            fileName: () => 'keyboard-control.js',
        },
        outDir: 'dist',
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
            external: [],
        },
    },
    test: {
        environment: 'jsdom',
        include: ['src/**/*.test.ts'],
    },
});
