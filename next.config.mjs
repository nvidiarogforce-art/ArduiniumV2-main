/**
 * Next.js lives at the repo root ALONGSIDE the original Vite sandbox app.
 *
 * Why they coexist instead of one replacing the other:
 *
 *   - `src/` is the 3D sandbox (React 19 + R3F + Rapier). It is the product's
 *     core differentiator and it already has nine passing test harnesses in
 *     `tools/`, every one of which loads `dist-single/index.html` from disk.
 *     Converting it to Next would have thrown all of that away.
 *   - The sandbox uses no `import.meta`, no `?url` imports and no other
 *     Vite-only API, so its source drops into Next unmodified. We import it
 *     directly at `/learn/simulator` rather than iframing a built bundle —
 *     one React tree, shared nav, shared i18n, no seams.
 *
 * So: `vite.config.js`, `index.html` and `src/main.jsx` are untouched and
 * `npx vite build --mode single` still works exactly as before. Next reads
 * the root `app/` directory (it only prefers `src/app` when that exists,
 * and it deliberately does not).
 */
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The sandbox is authored in plain .jsx. Next compiles it via the same
  // pipeline as the .tsx site code; nothing here needs a separate loader.
  pageExtensions: ['ts', 'tsx'],

  turbopack: {
    /**
     * Pin the workspace root to this repo.
     *
     * There is an unrelated `package-lock.json` one level up in
     * `C:\Users\abobu\Documents`, and Turbopack's root inference walks upward
     * looking for lockfiles — it was picking that directory and warning that
     * it lies outside the git repo. Being explicit also keeps the build
     * reproducible on a machine that does not have that stray file.
     */
    root: dirname(fileURLToPath(import.meta.url)),
  },
}

export default nextConfig
