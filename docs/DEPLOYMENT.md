# Deployment Guide

Complete guide for deploying your audio player to various static hosting platforms.

## 🚀 Quick Deploy

### Netlify (Recommended)

**One-Click Deploy:**
```bash
netlify deploy --prod
```

**Steps:**
1. Install Netlify CLI: `npm install -g netlify-cli`
2. Login: `netlify login`
3. Initialize: `netlify init`
4. Deploy: `netlify deploy --prod`

**Configuration:**
- Build command: `echo 'No build required'`
- Publish directory: `web`
- Configuration file: `netlify.toml` (already included)

### Vercel

**One-Click Deploy:**
```bash
vercel --prod
```

**Steps:**
1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`

**Configuration:**
- Framework Preset: Other
- Root Directory: `./`
- Output Directory: `web`
- Configuration file: `vercel.json` (already included)

### GitHub Pages

**Steps:**
1. Create a new branch: `git checkout -b gh-pages`
2. Copy web files to root:
   ```bash
   cp -r web/* .
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin gh-pages
   ```
3. Enable GitHub Pages in repository settings
4. Set source to `gh-pages` branch

**Alternative - GitHub Actions:**

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./web
```

## 🔧 Platform-Specific Configuration

### Netlify Features

**Custom Domain:**
```toml
# netlify.toml
[[redirects]]
  from = "https://old-domain.com/*"
  to = "https://new-domain.com/:splat"
  status = 301
  force = true
```

**Environment Variables:**
```bash
netlify env:set API_KEY "your-key"
```

**Deploy Previews:**
- Automatic for pull requests
- Preview URL: `https://deploy-preview-[PR#]--[site-name].netlify.app`

### Vercel Features

**Custom Domain:**
```bash
vercel domains add yourdomain.com
```

**Environment Variables:**
```bash
vercel env add API_KEY
```

**Preview Deployments:**
- Automatic for branches
- Preview URL: `https://[project]-[branch]-[username].vercel.app`

### Cloudflare Pages

**Steps:**
1. Connect GitHub repository
2. Build settings:
   - Build command: `echo 'No build required'`
   - Build output directory: `web`
3. Deploy

**Configuration:**
Create `_headers` in `web/`:
```
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/*.mp3
  Cache-Control: public, max-age=31536000, immutable
  Content-Type: audio/mpeg

/*.ogg
  Cache-Control: public, max-age=31536000, immutable
  Content-Type: audio/ogg
```

## 📦 Pre-Deployment Checklist

### 1. Audio Files
- [ ] Export audio from Ardour (WAV master)
- [ ] Convert to MP3 (320kbps) and OGG
- [ ] Place files in `web/data/`
- [ ] Update `audio_files` paths in JSON

### 2. Metadata
- [ ] Run marker extraction script
- [ ] Verify JSON schema
- [ ] Test locally with `python3 -m http.server 8000`
- [ ] Check all markers display correctly

### 3. Optimization
- [ ] Compress audio files if needed
- [ ] Pre-generate waveform data (optional)
- [ ] Optimize artwork images
- [ ] Test on mobile devices

### 4. Configuration
- [ ] Update metadata (title, artist, description)
- [ ] Set social sharing preferences
- [ ] Configure download permissions
- [ ] Add custom domain (if applicable)

## 🎨 Custom Domain Setup

### Netlify
```bash
netlify domains:add yourdomain.com
```

Add DNS records:
```
Type: A
Name: @
Value: 75.2.60.5

Type: CNAME
Name: www
Value: [your-site].netlify.app
```

### Vercel
```bash
vercel domains add yourdomain.com
```

Add DNS records:
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## 🔒 Security Headers

Already configured in `netlify.toml` and `vercel.json`:

- **X-Frame-Options**: Prevent clickjacking
- **X-Content-Type-Options**: Prevent MIME sniffing
- **Referrer-Policy**: Control referrer information
- **Permissions-Policy**: Control browser features

## 📊 Analytics Integration

### Google Analytics

Add to `web/index.html` before `</head>`:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Plausible Analytics (Privacy-Friendly)

```html
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

### Custom Events

Add to `player.js`:
```javascript
// Track plays
this.wavesurfer.on('play', () => {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'play', {
            'event_category': 'audio',
            'event_label': this.metadata.metadata.title
        });
    }
});

// Track marker clicks
seekToMarker(marker) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'marker_click', {
            'event_category': 'navigation',
            'event_label': marker.name
        });
    }
    // ... rest of function
}
```

## 🚀 CI/CD Automation

### Automated Deployment Workflow

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy Audio Player

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Extract markers
        run: |
          python ardour/extract_markers.py session.ardour -o web/data/metadata.json
      
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: './web'
          production-deploy: true
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 📱 Progressive Web App (PWA)

Make your player installable:

Create `web/manifest.json`:
```json
{
  "name": "Your Audio Player",
  "short_name": "Audio Player",
  "description": "Interactive audio player with markers",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Add to `index.html`:
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#3b82f6">
```

## 🔍 SEO Optimization

### Meta Tags

Add to `index.html`:
```html
<meta property="og:title" content="Your Mix Title">
<meta property="og:description" content="Your mix description">
<meta property="og:image" content="https://yourdomain.com/artwork.jpg">
<meta property="og:url" content="https://yourdomain.com">
<meta property="og:type" content="music.song">

<meta name="twitter:card" content="player">
<meta name="twitter:title" content="Your Mix Title">
<meta name="twitter:description" content="Your mix description">
<meta name="twitter:image" content="https://yourdomain.com/artwork.jpg">
<meta name="twitter:player" content="https://yourdomain.com">
<meta name="twitter:player:width" content="480">
<meta name="twitter:player:height" content="320">
```

### Structured Data

Add JSON-LD:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MusicRecording",
  "name": "Your Mix Title",
  "byArtist": {
    "@type": "MusicGroup",
    "name": "Your Artist Name"
  },
  "duration": "PT1H",
  "genre": "Electronic"
}
</script>
```

## 🐛 Troubleshooting

### Audio Not Loading
- Check file paths in JSON
- Verify CORS headers
- Test audio files directly in browser
- Check browser console for errors

### Markers Not Displaying
- Validate JSON schema
- Check marker time values
- Verify WaveSurfer.js loaded correctly

### Deployment Fails
- Check build logs
- Verify configuration files
- Test locally first
- Check file size limits (Netlify: 100MB, Vercel: 100MB)

### Performance Issues
- Pre-generate waveform data
- Compress audio files
- Use CDN for assets
- Enable caching headers

## 📈 Monitoring

### Uptime Monitoring
- [UptimeRobot](https://uptimerobot.com/) (free)
- [Pingdom](https://www.pingdom.com/)
- Netlify/Vercel built-in monitoring

### Error Tracking
- [Sentry](https://sentry.io/)
- [LogRocket](https://logrocket.com/)

Add to `player.js`:
```javascript
if (typeof Sentry !== 'undefined') {
    Sentry.init({
        dsn: 'YOUR_SENTRY_DSN',
        environment: 'production'
    });
}
```

## 💰 Cost Comparison

| Platform | Free Tier | Bandwidth | Custom Domain | SSL |
|----------|-----------|-----------|---------------|-----|
| Netlify | 100GB/mo | Yes | Yes | Yes |
| Vercel | 100GB/mo | Yes | Yes | Yes |
| GitHub Pages | 100GB/mo | Yes | Yes | Yes |
| Cloudflare Pages | Unlimited | Yes | Yes | Yes |

**Recommendation**: Start with Netlify or Vercel for best DX and features.

## 🎯 Production Checklist

- [ ] Audio files uploaded and accessible
- [ ] Metadata JSON validated
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Analytics tracking setup
- [ ] Social meta tags configured
- [ ] Error tracking enabled
- [ ] Performance tested
- [ ] Mobile responsive verified
- [ ] Share functionality tested
- [ ] Download links working
- [ ] Backup of source files created
