#!/usr/bin/env bash
# Aurdour Pipeline — one-command audio-to-player workflow
# Usage: ./pipeline.sh --audio ~/Music/track.mp3 --title "Title" --artist "Artist" [options]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DATA="$SCRIPT_DIR/web/data"

# Defaults
AUDIO=""
TITLE=""
ARTIST=""
GENRE=""
BPM=""
TRACKLIST=""
ARTWORK=""
DATE=""
DESCRIPTION=""
TAGS=""
SERVE=false

usage() {
    cat <<'USAGE'
Usage: ./pipeline.sh --audio <file> --title <title> [options]

Required:
  --audio <file>       Audio file (MP3, WAV, M4A, FLAC)
  --title <title>      Track/mix title

Optional:
  --artist <name>      Artist name
  --genre <genre>      Genre
  --bpm <number>       BPM
  --tracklist <list>   "0:00 Intro, 1:30 Drop, 3:15 Bridge"
  --artwork <file>     Cover art image (JPG/PNG)
  --date <YYYY-MM-DD>  Date
  --description <text> Description
  --tags <csv>         Comma-separated tags
  --serve              Start local dev server after processing

Example:
  ./pipeline.sh \
    --audio ~/Music/"WaveWarZ... the battle begins..mp3" \
    --title "WaveWarZ" --artist "BetterCallZaal" \
    --tracklist "0:00 Intro, 0:45 Battle Begins" \
    --serve
USAGE
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --audio) AUDIO="$2"; shift 2;;
        --title) TITLE="$2"; shift 2;;
        --artist) ARTIST="$2"; shift 2;;
        --genre) GENRE="$2"; shift 2;;
        --bpm) BPM="$2"; shift 2;;
        --tracklist) TRACKLIST="$2"; shift 2;;
        --artwork) ARTWORK="$2"; shift 2;;
        --date) DATE="$2"; shift 2;;
        --description) DESCRIPTION="$2"; shift 2;;
        --tags) TAGS="$2"; shift 2;;
        --serve) SERVE=true; shift;;
        -h|--help) usage;;
        *) echo "Unknown option: $1"; usage;;
    esac
done

# Validate required args
if [[ -z "$AUDIO" ]]; then echo "Error: --audio is required"; usage; fi
if [[ -z "$TITLE" ]]; then echo "Error: --title is required"; usage; fi
if [[ ! -f "$AUDIO" ]]; then echo "Error: Audio file not found: $AUDIO"; exit 1; fi

# Ensure output directory exists
mkdir -p "$WEB_DATA"

# Determine output MP3 filename
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
MP3_OUT="$WEB_DATA/${SLUG}.mp3"

# Get file extension
EXT="${AUDIO##*.}"
EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

echo "=== Aurdour Pipeline ==="
echo "Audio: $AUDIO"
echo "Title: $TITLE"
echo ""

# Convert or copy audio to MP3
case "$EXT_LOWER" in
    mp3)
        echo "[1/3] Copying MP3..."
        cp "$AUDIO" "$MP3_OUT"
        ;;
    wav|m4a|flac|aac|ogg)
        echo "[1/3] Converting $EXT_LOWER to MP3 via ffmpeg..."
        if ! command -v ffmpeg &>/dev/null; then
            echo "Error: ffmpeg not found. Install with: brew install ffmpeg"
            exit 1
        fi
        ffmpeg -y -i "$AUDIO" -codec:a libmp3lame -qscale:a 2 "$MP3_OUT" 2>/dev/null
        ;;
    *)
        echo "Error: Unsupported audio format: $EXT_LOWER"
        exit 1
        ;;
esac
echo "  -> $MP3_OUT"

# Get duration from the MP3 file
DURATION=0
if command -v ffprobe &>/dev/null; then
    DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$MP3_OUT" | cut -d. -f1)
fi

# Copy artwork if provided
ARTWORK_ARGS=""
if [[ -n "$ARTWORK" ]]; then
    if [[ ! -f "$ARTWORK" ]]; then
        echo "Warning: Artwork file not found: $ARTWORK"
    else
        ART_EXT="${ARTWORK##*.}"
        ART_OUT="$WEB_DATA/${SLUG}.${ART_EXT}"
        echo "[1.5/3] Copying artwork..."
        cp "$ARTWORK" "$ART_OUT"
        ARTWORK_ARGS="--artwork $ARTWORK"
        echo "  -> $ART_OUT"
    fi
fi

# Build Python command
echo "[2/3] Generating metadata JSON..."
PY_CMD="python3 $SCRIPT_DIR/pipeline/generate_metadata.py"
PY_CMD="$PY_CMD --title \"$TITLE\""
PY_CMD="$PY_CMD --audio \"$MP3_OUT\""
PY_CMD="$PY_CMD --duration $DURATION"
[[ -n "$ARTIST" ]] && PY_CMD="$PY_CMD --artist \"$ARTIST\""
[[ -n "$GENRE" ]] && PY_CMD="$PY_CMD --genre \"$GENRE\""
[[ -n "$BPM" ]] && PY_CMD="$PY_CMD --bpm $BPM"
[[ -n "$DATE" ]] && PY_CMD="$PY_CMD --date \"$DATE\""
[[ -n "$DESCRIPTION" ]] && PY_CMD="$PY_CMD --description \"$DESCRIPTION\""
[[ -n "$TAGS" ]] && PY_CMD="$PY_CMD --tags \"$TAGS\""
[[ -n "$TRACKLIST" ]] && PY_CMD="$PY_CMD --tracklist \"$TRACKLIST\""
[[ -n "$ARTWORK_ARGS" ]] && PY_CMD="$PY_CMD $ARTWORK_ARGS"

JSON_OUT="$WEB_DATA/${SLUG}.json"
PY_CMD="$PY_CMD -o \"$JSON_OUT\""

eval "$PY_CMD"

# Update library manifest
echo "[3/4] Updating track manifest..."
python3 "$SCRIPT_DIR/pipeline/update_manifest.py" "$WEB_DATA"

echo ""
echo "[4/4] Summary"
echo "=============================="
echo "  MP3:      $MP3_OUT"
echo "  JSON:     $JSON_OUT"
[[ -n "$ARTWORK_ARGS" ]] && echo "  Artwork:  $ART_OUT"
echo "  Duration: ${DURATION}s"
echo ""
echo "  Open: http://localhost:8000?data=data/${SLUG}.json"
echo "=============================="

if $SERVE; then
    echo ""
    echo "Starting local server on http://localhost:8000 ..."
    cd "$SCRIPT_DIR/web"
    python3 -m http.server 8000
fi
