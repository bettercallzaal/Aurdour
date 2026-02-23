# Ardour Export Guide

Complete guide for exporting audio and markers from Ardour for web playback.

## 🎚️ Recommended Export Settings

### Audio Export

1. **File Format**: WAV (for archival) + MP3/OGG (for web)
   - WAV: 44.1kHz or 48kHz, 16-bit or 24-bit
   - MP3: 320kbps CBR or V0 VBR
   - OGG: Quality 8-10 (roughly 256-320kbps equivalent)

2. **Export Process**:
   ```
   Session → Export → Export to Audio File(s)
   ```

3. **Settings**:
   - **Format**: WAV (PCM 16-bit) for master
   - **Sample Rate**: Match your session (44.1kHz or 48kHz)
   - **Channels**: Stereo
   - **Normalization**: Optional (recommend -1dB peak)
   - **Trim silence**: Optional

4. **For Web Distribution**:
   After exporting WAV, convert to web formats:
   ```bash
   # MP3 (best compatibility)
   ffmpeg -i your-mix.wav -codec:a libmp3lame -b:a 320k your-mix.mp3
   
   # OGG (better quality at same bitrate)
   ffmpeg -i your-mix.wav -codec:a libvorbis -qscale:a 8 your-mix.ogg
   
   # Both formats for maximum compatibility
   ffmpeg -i your-mix.wav \
     -codec:a libmp3lame -b:a 320k your-mix.mp3 \
     -codec:a libvorbis -qscale:a 8 your-mix.ogg
   ```

## 🏷️ Working with Markers in Ardour

### Creating Markers

1. **During Recording/Editing**:
   - Press `Tab` to add a marker at playhead position
   - Or: Right-click timeline → Add Location Marker

2. **Naming Markers**:
   - Use descriptive names: "Intro", "Drop", "Breakdown", "Outro"
   - For DJ sets: "Track 1 - Artist Name", "Transition", etc.
   - Avoid special characters (stick to alphanumeric + spaces/dashes)

3. **Marker Types**:
   - **Location Markers**: Single point in time (what we'll use)
   - **Range Markers**: Start and end points (useful for sections)
   - **CD Markers**: For CD track indexing

### Organizing Markers

Best practices for DJ sets:
```
00:00 - Intro
02:30 - Track 1 - Artist - Song Name
06:45 - Transition
07:00 - Track 2 - Artist - Song Name
11:20 - Breakdown
12:00 - Track 3 - Artist - Song Name
...
58:30 - Outro
```

## 📤 Exporting Markers

### Method 1: Export Session File (Recommended)

Ardour stores markers in the session file (`.ardour` XML format).

1. **Locate your session file**:
   ```
   ~/Documents/Ardour/your-session-name/your-session-name.ardour
   ```

2. **Extract markers using the provided script**:
   ```bash
   python ardour/extract_markers.py path/to/your-session.ardour
   ```

   This generates `markers.json` with all marker data.

### Method 2: Manual Export via Locations Window

1. Open: `Window → Locations`
2. Copy marker names and timecodes manually
3. Format into JSON (see `docs/SCHEMA.md`)

### Method 3: Export to CUE Sheet

1. `Session → Export → Export to Audio File(s)`
2. Check "Create CUE file"
3. Parse CUE file into JSON (script provided)

## 🔧 Marker Extraction Script

The `extract_markers.py` script does the following:

1. Parses Ardour session XML
2. Extracts location markers with timestamps
3. Converts to web-friendly JSON format
4. Outputs to `markers.json`

**Usage**:
```bash
python ardour/extract_markers.py your-session.ardour -o web/data/your-mix.json
```

**Options**:
- `-o, --output`: Output JSON file path
- `-f, --format`: Output format (json, cue, or both)
- `--sample-rate`: Session sample rate (default: 48000)

## 🎛️ Advanced: Exporting Stems

For remixable experiences, export individual tracks:

1. **Select tracks to export**:
   - Solo the tracks you want
   - Or use "Export Selected Tracks Only"

2. **Export settings**:
   - Same format as master (WAV → MP3/OGG)
   - Name files clearly: `drums.mp3`, `bass.mp3`, `synth.mp3`

3. **Sync stems**:
   - Ensure all stems start at the same point
   - Use "Export from session start" option

## 📊 Metadata to Include

Beyond markers, consider exporting:

- **Session info**: BPM, key, duration
- **Track listing**: Artist, title, label
- **Mix info**: Date recorded, DJ name, venue
- **Waveform data**: Pre-generate for faster web loading

Example metadata structure:
```json
{
  "title": "Summer Mix 2024",
  "artist": "DJ Name",
  "date": "2024-06-15",
  "duration": 3600,
  "bpm": 128,
  "key": "Am",
  "markers": [...]
}
```

## 🔄 Workflow Summary

1. **Record/Edit in Ardour** → Add markers as you go
2. **Export Audio** → WAV master + MP3/OGG for web
3. **Extract Markers** → Run Python script
4. **Generate Waveform** → Optional pre-rendering
5. **Deploy** → Upload to static host

## 💡 Tips

- **Marker Discipline**: Add markers in real-time while mixing
- **Backup**: Keep WAV masters and Ardour sessions
- **Versioning**: Use git for session files and metadata
- **Automation**: Script the entire export process
- **Quality**: Don't over-compress for web (320kbps MP3 is fine)

## 🐛 Troubleshooting

**Markers not exporting?**
- Check they're "Location Markers" not "Range Markers"
- Ensure session file is saved
- Try exporting to CUE as fallback

**Audio quality issues?**
- Verify sample rate matches throughout pipeline
- Check normalization isn't clipping
- Use dithering when converting bit depth

**Timestamps off?**
- Confirm sample rate in extraction script
- Check for pre-roll or count-in at session start
- Verify "Export from session start" is enabled
