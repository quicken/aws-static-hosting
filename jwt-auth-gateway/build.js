const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.production
const env = dotenv.config({ path: '.env.production' }).parsed || {};

// Clean dist folder
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true });
}
fs.mkdirSync(distPath, { recursive: true });

// Create define object for environment variables
const define = {};
if (env.COGNITO_USER_POOL_ID) define['process.env.COGNITO_USER_POOL_ID'] = `"${env.COGNITO_USER_POOL_ID}"`;
if (env.COGNITO_CLIENT_ID) define['process.env.COGNITO_CLIENT_ID'] = `"${env.COGNITO_CLIENT_ID}"`;
if (env.AWS_REGION) define['process.env.AWS_REGION'] = `"${env.AWS_REGION}"`;
if (env.SPA_BASE_PATH) define['process.env.SPA_BASE_PATH'] = `"${env.SPA_BASE_PATH}"`;

console.log('Building with environment variables:', Object.keys(define));

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
  define,
}).catch(() => process.exit(1));
