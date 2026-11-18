import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    base: '/arbor-vue/',
    plugins: [vue()],
    build: { outDir: 'demo-dist' }
});
