# Serato DJ Integration

Tools and guides for integrating Serato DJ Pro/Lite with the web audio player.

## 📁 Files

- **`SERATO_INTEGRATION.md`** - Complete guide for Serato users
- **`convert_serato_history.py`** - Convert Serato CSV history to JSON

## 🚀 Quick Start

### 1. Record in Serato

```
1. Click REC button
2. Set input to "Mix"
3. Test levels
4. Record your set
5. Save recording
```

### 2. Export History

```
1. Click HISTORY button
2. Select your session
3. Export as CSV
4. File saved to Music/_Serato_/History/
```

### 3. Convert to Web Format

```bash
python3 serato/convert_serato_history.py \
  ~/Music/_Serato_/History/session.csv \
  -o web/data/my-mix.json \
  --title "My DJ Mix" \
  --artist "DJ Name" \
  --add-intro-outro \
  --pretty
```

### 4. Convert Audio

```bash
ffmpeg -i ~/Music/_Serato_/Recordings/my-mix.wav \
  -codec:a libmp3lame -b:a 320k \
  web/data/my-mix.mp3
```

### 5. Deploy

```bash
cd web
python3 -m http.server 8000
# Test at http://localhost:8000
```

## 📖 Full Documentation

See **`SERATO_INTEGRATION.md`** for:
- Detailed recording instructions
- History export guide
- Live streaming setup
- Troubleshooting
- Pro tips and workflows

## 🔧 Conversion Script Options

```bash
python3 serato/convert_serato_history.py session.csv \
  -o output.json \
  --title "Mix Title" \
  --artist "DJ Name" \
  --description "Mix description" \
  --genre "House / Techno" \
  --bpm 128 \
  --tags "house,techno,live" \
  --artwork "artwork.jpg" \
  --download-enabled \
  --add-intro-outro \
  --time-offset 30.0 \
  --pretty
```

### Options

- `--title` - Mix title (required)
- `--artist` - DJ/artist name (required)
- `--audio-file` - Audio filename (default: auto-generated)
- `--description` - Mix description
- `--genre` - Genre/style
- `--bpm` - Average BPM
- `--tags` - Comma-separated tags
- `--artwork` - Artwork filename
- `--download-enabled` - Allow downloads
- `--add-intro-outro` - Add intro/outro markers
- `--time-offset` - Adjust timing (seconds)
- `--pretty` - Pretty-print JSON

## 💡 Tips

### Recording
- Always record in WAV (highest quality)
- Test levels before starting
- Aim for -6dB to -3dB peaks
- Keep backups of recordings

### History
- Load tracks properly (crossfade + fader)
- Export immediately after mixing
- Review for accuracy
- Keep CSV backups

### Conversion
- Use `--add-intro-outro` for complete mix
- Adjust `--time-offset` if recording started early/late
- Add detailed metadata for better SEO
- Use `--pretty` for readable JSON

## 🔗 Resources

- [Serato DJ Manual](https://serato.com/dj/pro/downloads)
- [Recording Guide](https://support.serato.com/hc/en-us/articles/202304734)
- [History Guide](https://support.serato.com/hc/en-us/articles/223455687)
- [Live Streaming](https://support.serato.com/hc/en-us/articles/360001784415)

## 🎯 Workflow Summary

```
Serato DJ → Record + History → CSV Export
    ↓
Python Script → Convert to JSON
    ↓
FFmpeg → Convert Audio to MP3
    ↓
Web Player → Deploy and Share
```

## 🐛 Troubleshooting

**CSV won't parse:**
- Export from Serato (don't edit manually)
- Check file encoding (UTF-8)
- Verify CSV format

**Times don't match:**
- Use `--time-offset` to adjust
- Serato logs mix-in time, not track start
- Manually adjust in JSON if needed

**Missing tracks:**
- Ensure you crossfaded AND raised fader
- Check "Show Unplayed" in Serato
- Manually add with "Insert Track"

## 📚 See Also

- [Main README](../README.md)
- [Ardour Integration](../ardour/EXPORT_GUIDE.md)
- [JSON Schema](../docs/SCHEMA.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
