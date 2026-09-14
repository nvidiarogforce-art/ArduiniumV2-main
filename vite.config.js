import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => ({
  base: './',
  /** The standalone artifact must remain one self-contained HTML file. */
  publicDir: mode === 'single' ? false : 'public',
  /**
   * The Next.js marketing site added at the repo root brings a
   * `postcss.config.mjs` with it (Tailwind v4). Vite searches upwards for a
   * PostCSS config from its root, so it would otherwise pick that up and run
   * Tailwind over `src/styles.css` — a file that contains no Tailwind at all.
   * The sandbox has its own hand-written design system and wants no PostCSS
   * pipeline, so pin it to empty rather than inherit the site's.
   */
  css: { postcss: { plugins: [] } },
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
  },
}))
