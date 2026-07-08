import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { cli: 'src/cli.ts', 'server-entry': 'src/server/entry.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: false,
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
})
