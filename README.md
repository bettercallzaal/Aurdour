# AURDOUR DJ

A browser-based DJ platform with two decks, real-time mixing, effects, and streaming. Designed to be approachable for newcomers while offering full pro-level controls for experienced DJs.

## Features

### Newcomer-Friendly Design
- **Simple Mode** (default) — Clean layout showing only the essentials: two decks, play/cue/sync, crossfader, volume, jog wheels, and library
- **Pro Mode** — Toggle to reveal advanced controls: EQ, FX, stems, loops, hot cues, pitch faders, sampler, mic input, MIDI mapping, and more
- **Interactive Tutorial** — Step-by-step guided walkthrough on first visit, highlighting each key area with spotlight effects. Skippable and re-triggerable
- **Empty State Hints** — Decks show guidance text when no track is loaded, directing users to the library or drag-and-drop

### Core DJ Controls
- Two full decks with WaveSurfer.js waveform visualization (overview + scrolling)
- Transport: Play/Pause (large circular button), Cue, Sync
- Crossfader with color-coded A/B endpoints and "slide to blend" hint
- Per-channel volume faders and level meters
- Jog wheels with drag-to-scratch and nudge buttons
- Master and booth volume with metering

### Pro Mode Controls
- 3-band EQ (HI/MID/LOW) per channel
- FX rack per deck (Echo, Reverb, Flanger, Filter, Delay) with wet/dry and parameter knobs
- Stem separation (Bass, Drums, Vocals, Other) per deck
- Loop controls (IN/OUT, halve, double, auto-loop 1/2/4/8/16 beats)
- 8 hot cue pads per deck
- Pitch fader with key lock and slip mode
- Beat jump buttons
- PFL/headphone cueing with split cue
- Phase meter
- Sampler with 8 pads
- Mic and system audio capture
- BPM tap tempo
- MIDI controller support with learn mode and profiles
- Recording (WebM/OGG/M4A)
- Performance monitor (latency, CPU, buffer)

### Music Sources
- **Local** — Load tracks from a JSON manifest (`data/manifest.json`)
- **Audius** — Search and stream from Audius' catalog of free music, with trending tracks on the default view
- **Liked** — Heart any track to save it to your Liked playlist (persisted in localStorage)
- **Drag & Drop** — Drop audio files directly onto a deck

### Flow Mode (Auto-DJ)
Click **AUTO MIX** to enter Flow Mode — the system picks tracks and crossfades between them automatically based on BPM, key, and genre compatibility. Great for parties or background listening.

### Additional Features
- Harmonic mixing with Camelot wheel key compatibility display
- Playlists/crates with create, rename, and delete
- Setlist queue with drag-to-reorder and play history
- Auto-transition with configurable duration and curve
- RGB waveform and beat grid quantize toggles
- Visualizer overlay (bars mode)
- Go Live with chat and song request support
- PWA support with service worker caching

## Quick Start

```bash
cd web && python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

### Loading Local Tracks

Place audio files in `web/data/` and create a `web/data/manifest.json`:

```json
{
  "tracks": [
    {
      "id": "track-1",
      "title": "Track Name",
      "artist": "Artist",
      "bpm": 128,
      "key": "Am",
      "duration": 240,
      "genre": "House",
      "dataFile": "data/track-1.json"
    }
  ]
}
```

Each track's `dataFile` JSON should contain:
```json
{
  "metadata": { "title": "...", "artist": "...", "bpm": 128, "key": "Am" },
  "audio_files": { "mp3": "data/track-1.mp3" }
}
```

### Streaming from Audius

Click the **AUDIUS** tab in the library to search or browse trending tracks. No setup required — streams directly from the Audius public API.

## Project Structure

```
web/
  index.html          # Main interface (all element IDs for JS bindings)
  styles.css          # Full stylesheet with Pro Mode toggle system
  player.js           # Main controller — wires all modules together
  dj/
    Audius.js          # Audius API integration (search, trending, streaming)
    AudioRouter.js     # Web Audio API routing (master, booth, headphone)
    AutoTransition.js  # Automated crossfade transitions
    Deck.js            # Deck controller (WaveSurfer, transport, load)
    DragDrop.js        # Drag-and-drop file loading
    FlowMode.js        # Auto-DJ engine with smart suggestions
    HarmonicMixer.js   # Camelot wheel key compatibility
    JogWheel.js        # Canvas jog wheel with scratch/nudge
    Library.js         # Track browser with LOCAL/LIKED/AUDIUS tabs
    LiveStream.js      # Go Live with WebRTC/chat
    MidiController.js  # MIDI device mapping and learn mode
    Playlists.js       # Crates, liked tracks, ratings, play counts
    Recorder.js        # Mix recording
    Sampler.js         # 8-pad sample triggering
    Setlist.js         # Queue and play history
    Storage.js         # localStorage wrapper
    Visualizer.js      # Audio visualizer (bars/spectrum)
```

## Tech Stack

- **Audio**: WaveSurfer.js 7 + Web Audio API
- **UI**: Vanilla HTML/CSS/JS (ES modules), no framework
- **Fonts**: Bricolage Grotesque (display), DM Sans (body), JetBrains Mono (data)
- **Streaming**: Audius public API
- **Hosting**: Any static file server (Netlify, Vercel, GitHub Pages)

## MIDI Controller Support

AURDOUR has built-in support for Pioneer DDJ series controllers (DDJ-SB, DDJ-400, DDJ-1000, and other Serato-compatible models). Any controller with "Pioneer", "DDJ", or "Serato" in its name is auto-detected via the Web MIDI API.

### Supported Controls

| Control | MIDI Message | Action |
|---------|-------------|--------|
| Play/Pause | Note 0x0B (ch 0/1) | Toggle playback |
| Cue | Note 0x0C | Set/return to cue point |
| Sync | Note 0x58 | Sync BPM to other deck |
| PFL/Headphone Cue | Note 0x54 | Toggle pre-fader listen |
| Load Deck A/B | Note 0x46/0x47 (ch 6) | Load selected track |
| Volume Fader | CC 0x13/0x33 (14-bit) | Per-channel volume |
| EQ High/Mid/Low | CC 0x07/0x0B/0x0F (14-bit) | 3-band EQ (-24dB to +6dB) |
| Filter Knob | CC 0x17/0x37 (14-bit) | DJ-style LP/HP sweep with center bypass |
| Tempo Slider | CC 0x00/0x20 (14-bit) | Pitch/tempo adjust (±8%) |
| Crossfader | CC 0x1F/0x3F (ch 6, 14-bit) | A/B mix blend |
| Master Volume | CC 0x0D/0x2D (ch 6, 14-bit) | Master output level |
| Booth Volume | CC 0x11/0x31 (ch 6, 14-bit) | Booth output level |
| Headphone Volume | CC 0x10/0x30 (ch 6, 14-bit) | Cue/headphone level |
| Headphone Mix | CC 0x0E/0x2E (ch 6, 14-bit) | Cue/master balance |
| Jog Wheel (vinyl) | CC 0x22 | Scratch |
| Jog Wheel (ring) | CC 0x21 | Pitch bend/nudge |
| Browse Encoder | CC 0x40 (ch 6) | Scroll library track list |
| Browse Press | Note 0x41 (ch 6) | Load selected track to idle deck |
| Back Button | Note 0x42 (ch 6) | Cycle library tabs |
| Loop In/Out | Note 0x10/0x11 | Set loop points |
| Reloop | Note 0x4D | Toggle loop on/off |
| Loop Halve/Double | Note 0x12/0x13 | Resize active loop |
| Auto Loop | Note 0x14 | Beat loop (4 beats default) |
| Key Lock | Note 0x1A | Toggle key lock |
| Slip Mode | Note 0x40 | Toggle slip mode |
| FX Toggle | Note 0x47 | Toggle FX on/off |
| Hot Cue Pads 1–8 | Note 0x00–0x07 (ch 7/9) | Trigger/set hot cues |
| Roll Pads 1–8 | Note 0x10–0x17 (ch 7/9) | Beat loop rolls (1/16 to 8 beats) |
| Sampler Pads 1–8 | Note 0x30–0x37 (ch 7/9) | Trigger sampler slots |

### Audio Signal Chain

```
Source → EQ (Low/Mid/High) → DJ Filter (LP/HP sweep) → Channel Gain → Crossfade → Analyser → Master → Output
```

The DJ-style filter knob sweeps from low-pass (left) through a center bypass dead zone to high-pass (right), with resonance peaks near the cutoff frequency — matching the feel of hardware DJ mixers.

### MIDI Learn

For non-Pioneer controllers, use the **LEARN** button in the MIDI section (Pro Mode) to manually map any MIDI CC or note to DJ actions. Mappings can be exported/imported as JSON.

### Channel Layout

- **Channel 0** — Deck A transport + EQ + filter + volume
- **Channel 1** — Deck B transport + EQ + filter + volume
- **Channel 6** — Global controls (crossfader, master, booth, headphone, browse)
- **Channel 7** — Deck A pads (hot cues, rolls, sampler)
- **Channel 9** — Deck B pads (hot cues, rolls, sampler)

All faders and knobs use 14-bit MSB/LSB pairs for high-resolution control (16,384 steps).

## Importing from DAWs

### From Ardour
See `ardour/EXPORT_GUIDE.md` for exporting audio + markers, then use `ardour/extract_markers.py` to convert to JSON.

### From Serato DJ
See `serato/SERATO_INTEGRATION.md` for converting Serato history CSV to the web player format.

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

## License

MIT - Build whatever you want with this.
