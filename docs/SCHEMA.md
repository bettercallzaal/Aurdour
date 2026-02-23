# JSON Metadata Schema

Complete schema for audio metadata, markers, and player configuration.

## 📋 Core Schema

### Complete Example

```json
{
  "metadata": {
    "title": "Summer Rooftop Mix 2024",
    "artist": "DJ Name",
    "date": "2024-06-15",
    "duration": 3600.5,
    "sample_rate": 48000,
    "bpm": 128,
    "key": "Am",
    "genre": "House",
    "description": "Live set from Brooklyn rooftop party",
    "artwork": "artwork.jpg",
    "tags": ["house", "techno", "live", "2024"],
    "source": "Ardour",
    "exported": "2024-06-16T10:30:00Z"
  },
  "audio_files": {
    "mp3": "summer-mix-2024.mp3",
    "ogg": "summer-mix-2024.ogg",
    "waveform": "summer-mix-2024.json"
  },
  "markers": [
    {
      "id": "intro",
      "name": "Intro",
      "time": 0,
      "timestamp": "00:00",
      "type": "section",
      "color": "#3b82f6"
    },
    {
      "id": "track-1",
      "name": "Track 1 - Artist Name - Song Title",
      "time": 150.5,
      "timestamp": "02:30",
      "type": "track",
      "color": "#10b981",
      "metadata": {
        "artist": "Artist Name",
        "title": "Song Title",
        "label": "Record Label",
        "year": 2024
      }
    },
    {
      "id": "breakdown",
      "name": "Breakdown",
      "time": 1800,
      "timestamp": "30:00",
      "type": "section",
      "color": "#f59e0b"
    }
  ],
  "tempo": [
    {
      "time": 0,
      "bpm": 128
    },
    {
      "time": 1800,
      "bpm": 132
    }
  ],
  "regions": [
    {
      "id": "intro-section",
      "start": 0,
      "end": 150,
      "label": "Intro",
      "color": "rgba(59, 130, 246, 0.2)"
    },
    {
      "id": "main-section",
      "start": 150,
      "end": 3000,
      "label": "Main Set",
      "color": "rgba(16, 185, 129, 0.2)"
    }
  ],
  "stems": [
    {
      "id": "drums",
      "name": "Drums",
      "file": "stems/drums.mp3",
      "color": "#ef4444",
      "muted": false,
      "volume": 1.0
    },
    {
      "id": "bass",
      "name": "Bass",
      "file": "stems/bass.mp3",
      "color": "#8b5cf6",
      "muted": false,
      "volume": 1.0
    }
  ],
  "social": {
    "share_url": "https://yourdomain.com/mix/summer-2024",
    "embed_code": "<iframe src='...' />",
    "download_enabled": true,
    "comments_enabled": true
  }
}
```

## 🔑 Field Definitions

### Metadata Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Mix/track title |
| `artist` | string | ✅ | Artist/DJ name |
| `date` | string | ❌ | ISO date (YYYY-MM-DD) |
| `duration` | number | ✅ | Total duration in seconds |
| `sample_rate` | number | ❌ | Audio sample rate (Hz) |
| `bpm` | number | ❌ | Beats per minute |
| `key` | string | ❌ | Musical key (e.g., "Am", "C#") |
| `genre` | string | ❌ | Genre/style |
| `description` | string | ❌ | Long-form description |
| `artwork` | string | ❌ | Path to artwork image |
| `tags` | array | ❌ | Searchable tags |
| `source` | string | ❌ | Creation source (e.g., "Ardour") |
| `exported` | string | ❌ | ISO timestamp of export |

### Audio Files Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mp3` | string | ✅ | Path to MP3 file |
| `ogg` | string | ❌ | Path to OGG file (fallback) |
| `waveform` | string | ❌ | Pre-generated waveform JSON |

### Marker Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier (slug-format) |
| `name` | string | ✅ | Display name |
| `time` | number | ✅ | Time in seconds (float) |
| `timestamp` | string | ✅ | Human-readable (MM:SS or HH:MM:SS) |
| `type` | string | ❌ | Type: "track", "section", "cue" |
| `color` | string | ❌ | Hex color for visualization |
| `metadata` | object | ❌ | Additional track info |

### Tempo Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `time` | number | ✅ | Time in seconds |
| `bpm` | number | ✅ | Beats per minute at this point |

### Region Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier |
| `start` | number | ✅ | Start time (seconds) |
| `end` | number | ✅ | End time (seconds) |
| `label` | string | ✅ | Region label |
| `color` | string | ❌ | RGBA color for visualization |

### Stem Object (for remixable audio)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier |
| `name` | string | ✅ | Display name |
| `file` | string | ✅ | Path to stem audio file |
| `color` | string | ❌ | Hex color for UI |
| `muted` | boolean | ❌ | Default mute state |
| `volume` | number | ❌ | Default volume (0.0-1.0) |

### Social Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `share_url` | string | ❌ | Canonical share URL |
| `embed_code` | string | ❌ | HTML embed code |
| `download_enabled` | boolean | ❌ | Allow downloads |
| `comments_enabled` | boolean | ❌ | Enable comments |

## 🎯 Minimal Schema

For simple use cases, only these fields are required:

```json
{
  "metadata": {
    "title": "My Mix",
    "artist": "DJ Name",
    "duration": 3600
  },
  "audio_files": {
    "mp3": "audio.mp3"
  },
  "markers": [
    {
      "id": "marker-1",
      "name": "Intro",
      "time": 0,
      "timestamp": "00:00"
    }
  ]
}
```

## 🔗 URL Parameters for Sharing

The player supports these URL parameters:

- `?t=150` - Start at 150 seconds
- `?t=2m30s` - Start at 2 minutes 30 seconds
- `?marker=track-1` - Jump to marker ID
- `?autoplay=true` - Auto-play on load
- `?loop=true` - Loop playback
- `?start=60&end=180` - Play specific range

Example: `https://yourdomain.com/mix?t=2m30s&autoplay=true`

## 📊 Pre-generated Waveform Format

For faster loading, pre-generate waveform data:

```json
{
  "version": 2,
  "channels": 2,
  "sample_rate": 48000,
  "samples_per_pixel": 512,
  "bits": 8,
  "length": 7031,
  "data": [
    -128, 127, -100, 95, ...
  ]
}
```

Generate using:
```bash
audiowaveform -i input.mp3 -o waveform.json --pixels-per-second 20
```

## 🎨 Marker Type Conventions

| Type | Use Case | Suggested Color |
|------|----------|-----------------|
| `track` | New track/song | `#10b981` (green) |
| `section` | Mix section (intro, breakdown, outro) | `#3b82f6` (blue) |
| `cue` | DJ cue point | `#f59e0b` (amber) |
| `transition` | Mix transition point | `#8b5cf6` (purple) |
| `drop` | Energy drop/build | `#ef4444` (red) |
| `custom` | User-defined | Any |

## 🔄 Schema Versioning

Add a version field for future compatibility:

```json
{
  "schema_version": "1.0.0",
  "metadata": { ... }
}
```

## 💡 Extension Ideas

### Lyrics/Annotations
```json
{
  "annotations": [
    {
      "time": 120,
      "text": "Vocal sample from...",
      "type": "note"
    }
  ]
}
```

### Collaboration
```json
{
  "collaborators": [
    {
      "name": "DJ Name",
      "role": "mixing",
      "url": "https://..."
    }
  ]
}
```

### Analytics
```json
{
  "analytics": {
    "play_count": 1234,
    "favorite_sections": [
      {"marker_id": "track-3", "plays": 456}
    ]
  }
}
```

## ✅ Validation

Use JSON Schema for validation:

```bash
npm install ajv ajv-cli
ajv validate -s schema.json -d your-data.json
```

See `web/schema.json` for the complete JSON Schema definition.
