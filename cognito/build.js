const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Clean dist folder
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true });
}
fs.mkdirSync(distPath, { recursive: true });

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/index.js',
  external: ['aws-sdk'],
  minify: true,
  sourcemap: false,
}).catch(() => process.exit(1));
