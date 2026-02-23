# Quick Start Guide

Get up and running in 5 minutes.

## 🎯 What You'll Build

An interactive web audio player with:
- Waveform visualization
- Clickable markers/timestamps
- Social sharing with timestamp links
- Mobile-responsive design

## 📋 Prerequisites

- Ardour (or any DAW that exports markers)
- Python 3.x (for local testing)
- Audio files (WAV/MP3)
- Basic terminal knowledge

## 🚀 5-Minute Setup

### Step 1: Export from Ardour (2 min)

1. Open your Ardour session
2. Add markers at key points (press `Tab`)
3. Export audio:
   - `Session → Export → Export to Audio File(s)`
   - Format: WAV, 44.1kHz, 16-bit
   - Save as `my-mix.wav`

### Step 2: Convert Audio (1 min)

```bash
# Convert to MP3 for web
ffmpeg -i my-mix.wav -codec:a libmp3lame -b:a 320k web/data/my-mix.mp3
```

### Step 3: Extract Markers (1 min)

```bash
# Extract markers from Ardour session
python3 ardour/extract_markers.py ~/path/to/session.ardour -o web/data/my-mix.json
```

### Step 4: Update Configuration (30 sec)

Edit `web/data/my-mix.json`:
```json
{
  "metadata": {
    "title": "My Awesome Mix",
    "artist": "Your Name"
  },
  "audio_files": {
    "mp3": "my-mix.mp3"
  }
}
```

### Step 5: Test Locally (30 sec)

```bash
cd web
python3 -m http.server 8000
```

Open: http://localhost:8000

## 🎉 You're Done!

Your player is running locally. Now you can:

### Deploy to Production

**Netlify (Easiest):**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**GitHub Pages:**
```bash
git add .
git commit -m "Initial commit"
git push origin main
# Enable GitHub Pages in repo settings
```

## 🎨 Customize

### Change Colors

Edit `web/styles.css`:
```css
:root {
    --accent-primary: #3b82f6;  /* Change to your color */
}
```

### Add Your Logo

Replace `web/logo.png` with your logo.

### Update Metadata

Edit `web/data/my-mix.json` to add:
- Description
- BPM
- Genre
- Tags

## 📱 Share Your Mix

After deployment, share:
- Full mix: `https://yourdomain.com`
- Specific timestamp: `https://yourdomain.com?t=2m30s`
- Specific marker: `https://yourdomain.com?marker=track-1`

## 🐛 Troubleshooting

**Audio not loading?**
- Check file path in JSON matches actual file
- Verify MP3 is in `web/data/` folder
- Check browser console for errors

**Markers not showing?**
- Verify JSON is valid (use jsonlint.com)
- Check marker times are within audio duration
- Ensure marker IDs are unique

**Player looks broken?**
- Clear browser cache
- Check all CSS/JS files loaded
- Verify internet connection (for CDN resources)

## 📚 Next Steps

- Read [EXPORT_GUIDE.md](ardour/EXPORT_GUIDE.md) for detailed Ardour instructions
- Check [SCHEMA.md](docs/SCHEMA.md) for advanced metadata options
- Explore [EXTENSIONS.md](docs/EXTENSIONS.md) for feature ideas
- Review [DEPLOYMENT.md](docs/DEPLOYMENT.md) for production tips

## 💬 Get Help

- Check documentation in `/docs`
- Review example files in `/web/data`
- Open an issue on GitHub
- Join the community Discord

## 🎯 Pro Tips

1. **Marker Discipline**: Add markers while mixing, not after
2. **Audio Quality**: Use 320kbps MP3 for web (don't over-compress)
3. **Backup**: Keep WAV masters and Ardour sessions
4. **Version Control**: Use git for your project
5. **Test Mobile**: Always test on phone before sharing

## ⚡ Common Workflows

### DJ Mix Workflow
```bash
# 1. Record in Ardour, add markers for each track
# 2. Export and convert
ffmpeg -i mix.wav -b:a 320k mix.mp3

# 3. Extract markers
python3 ardour/extract_markers.py session.ardour -o web/data/mix.json

# 4. Deploy
netlify deploy --prod
```

### Podcast Workflow
```bash
# 1. Record in Ardour, add chapter markers
# 2. Export and convert
ffmpeg -i podcast.wav -b:a 192k podcast.mp3

# 3. Extract markers
python3 ardour/extract_markers.py session.ardour -o web/data/podcast.json

# 4. Add descriptions to markers in JSON
# 5. Deploy
```

### Live Set Archive
```bash
# 1. Import recording to Ardour
# 2. Add markers for key moments
# 3. Export and process
# 4. Deploy with timestamp sharing enabled
```

## 🌟 You're Ready!

You now have a fully functional, social-first audio player. Start sharing your mixes and building your audience.

Questions? Check the docs or reach out to the community.

Happy mixing! 🎧
