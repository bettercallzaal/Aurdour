# Ardour to Web Audio Player

Open-source workflow for exporting DJ sets from Ardour with markers and deploying them as interactive web audio experiences.

## 🎯 What This Does

- Export audio + markers from Ardour (DAW)
- Convert markers to JSON for web consumption
- Interactive web player with waveform visualization
- Timestamp-based sharing (e.g., `?t=2m30s`)
- Social-first, remixable audio experiences

## 📁 Project Structure

```
.
├── ardour/                 # Ardour export guides and scripts
│   ├── EXPORT_GUIDE.md    # Step-by-step Ardour export instructions
│   └── extract_markers.py # Python script to extract markers
├── serato/                 # Serato DJ integration
│   ├── SERATO_INTEGRATION.md  # Complete Serato guide
│   └── convert_serato_history.py  # Convert Serato CSV to JSON
├── web/                    # Web audio player
│   ├── index.html         # Main player interface
│   ├── player.js          # WaveSurfer.js implementation
│   ├── styles.css         # Player styling
│   └── data/              # Audio files and metadata
│       └── example.json   # Example metadata schema
├── docs/                   # Documentation
│   ├── SCHEMA.md          # JSON schema documentation
│   ├── DEPLOYMENT.md      # Deployment guide
│   └── EXTENSIONS.md      # Ideas for extending functionality
└── netlify.toml           # Deployment configuration
```

## 🚀 Quick Start

### Option A: From Ardour

1. **Export from Ardour** - See `ardour/EXPORT_GUIDE.md`
2. **Extract Markers**
   ```bash
   python ardour/extract_markers.py your-session.ardour
   ```
3. **Deploy**
   ```bash
   cd web && python3 -m http.server 8000
   ```

### Option B: From Serato DJ

1. **Record in Serato** - Click REC, set to "Mix", record your set
2. **Export History** - Click HISTORY, export as CSV
3. **Convert to Web Format**
   ```bash
   python3 serato/convert_serato_history.py session.csv \
     -o web/data/my-mix.json \
     --title "My Mix" --artist "DJ Name" --add-intro-outro
   ```
4. **Convert Audio**
   ```bash
   ffmpeg -i recording.wav -b:a 320k web/data/my-mix.mp3
   ```
5. **Deploy**
   ```bash
   cd web && python3 -m http.server 8000
   ```

See `serato/SERATO_INTEGRATION.md` for complete guide.

## 🌐 Deploy to Production

- **Netlify**: `netlify deploy --prod`
- **Vercel**: `vercel --prod`
- **GitHub Pages**: Push to `gh-pages` branch

See `docs/DEPLOYMENT.md` for details.

## 🎨 Philosophy

This is not just a music player. It's infrastructure for:
- **Ownable media**: You control the files and metadata
- **Composable embeds**: Share specific moments, sections, loops
- **Social-native audio**: Built for sharing, not just listening
- **Hackable by design**: Open formats, no vendor lock-in

## 📖 Documentation

### For Ardour Users
- [Ardour Export Guide](ardour/EXPORT_GUIDE.md)
- [Quick Start Guide](QUICKSTART.md)

### For Serato DJ Users
- [Serato Integration Guide](serato/SERATO_INTEGRATION.md)
- [Recording & History Tutorial](serato/SERATO_INTEGRATION.md#part-1-recording-your-dj-set-in-serato)
- [Web Player Controls Guide](serato/SERATO_INTEGRATION.md#part-4-understanding-the-web-player-controls)

### General
- [JSON Schema](docs/SCHEMA.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Extension Ideas](docs/EXTENSIONS.md)

## Flow Mode — Auto-DJ for Non-DJs

Flow Mode is a simplified overlay that auto-mixes tracks with smart suggestions, so anyone can build a great-sounding set with minimal effort — no DJ skills required.

### How It Works

1. Click the **FLOW** button in the top bar to enter Flow Mode
2. Pick a starting track from the suggestions list
3. The system auto-suggests the next best track based on BPM, key, and genre compatibility
4. Tracks auto-load to the idle deck and crossfade when the current track nears its end (~30s remaining)
5. The queue advances automatically — new suggestions appear after each transition
6. Click **SKIP** to immediately transition to the next track
7. Click **EXIT** to return to the full DJ interface

### What You See

- **Now Playing** — current track with title, artist, BPM, key, genre, and an animated progress bar
- **Up Next** — the next queued track with compatibility badges (KEY match in green, BPM match in amber, genre in blue)
- **Queue** — an ordered list of upcoming tracks with remove buttons
- **Suggestions** — scored recommendations from the library with ADD buttons
- **Settings** — transition duration (2–32s) and trigger point (10–60s before end) sliders

### Smart Suggestions

Flow Mode uses the existing `Playlists.getRelatedTracks()` scoring engine and `HarmonicMixer` Camelot wheel logic to rank tracks:

| Factor | Score | Criteria |
|--------|-------|----------|
| Key compatibility | +4 | Camelot wheel match (same key, ±1, parallel major/minor) |
| BPM close match | +3 | Within ±5% of current BPM |
| BPM near match | +1 | Within ±10% of current BPM |
| Genre match | +1 | Same genre tag |

Tracks already played or queued in the session are filtered out.

### Files Involved

| File | Role |
|------|------|
| `web/dj/FlowMode.js` | Core auto-DJ engine + UI rendering (~300 lines) |
| `web/dj/Deck.js` | `onTrackNearEnd` / `onFinish` callbacks for auto-advance |
| `web/dj/AutoTransition.js` | `onComplete` callback + `startProgrammatic()` for crossfade automation |
| `web/player.js` | Imports FlowMode, wires deck and transition callbacks, FLOW toggle |
| `web/index.html` | FLOW button in top bar + `#flow-panel` overlay container |
| `web/styles.css` | Full-screen overlay, cards, badges, progress bar, responsive layout |
| `web/sw.js` | FlowMode.js added to service worker cache (v4) |

### Architecture

```
User clicks FLOW → FlowMode.enable() → overlay appears
User picks track → FlowMode.start(track) → Deck A loads + plays
                                          → _suggestNext() fills suggestions
                                          → _autoFillQueue() queues top pick

Deck A nears end → Deck.onTrackNearEnd fires
                 → FlowMode._triggerTransition()
                 → loads next track on Deck B
                 → AutoTransition.startProgrammatic('AtoB', 8)
                 → crossfader animates A→B over 8 seconds

Transition ends → AutoTransition.onComplete fires
               → FlowMode.onTransitionComplete()
               → swaps currentDeck to B
               → advances queue, refreshes suggestions
               → cycle repeats (next transition will be B→A)
```

## 🛠 Tech Stack

- **DAW**: Ardour (open-source) or Serato DJ Pro/Lite
- **Audio Format**: WAV/FLAC → MP3/OGG for web
- **Metadata**: JSON (from Ardour XML or Serato CSV)
- **Player**: WaveSurfer.js + Web Audio API
- **Hosting**: Static site (Netlify/Vercel/GitHub Pages)
- **Live Streaming**: OBS + Virtual Audio Device (optional)

## License

MIT - Build whatever you want with this.
