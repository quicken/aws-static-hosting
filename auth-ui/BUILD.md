# Build and Deployment Guide

## Prerequisites
1. Configure your environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Cognito values
   ```

## Build Commands

### Development
```bash
npm install
npm start
```

### Production Build
```bash
npm run build
```
This creates a `dist/` folder with optimized static files.

### Test Build Locally
```bash
npm run preview
```

## Deployment Options

### 1. AWS S3 + CloudFront (Recommended)
```bash
# Build the app
npm run build

# Upload to S3 bucket
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### 2. Netlify
```bash
# Build and deploy
npm run build
npx netlify deploy --prod --dir=dist
```

### 3. Vercel
```bash
# Build and deploy
npm run build
npx vercel --prod
```

### 4. GitHub Pages
```bash
# Build
npm run build

# Deploy (requires gh-pages package)
npm install --save-dev gh-pages
npx gh-pages -d dist
```

## Environment Variables for Production

### For AWS S3/CloudFront:
Set environment variables in your CI/CD pipeline or build environment.

### For Netlify:
Add environment variables in Netlify dashboard under Site Settings > Environment Variables.

### For Vercel:
Add environment variables in Vercel dashboard under Project Settings > Environment Variables.

## Build Output
The `dist/` folder contains:
- `index.html` - Main HTML file
- `assets/` - JavaScript, CSS, and other assets
- All files are optimized and minified for production
