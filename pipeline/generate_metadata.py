#!/usr/bin/env python3
"""Generate JSON metadata for the Aurdour web player from CLI arguments."""

import argparse
import json
import os
import re
import sys
from datetime import datetime


def parse_tracklist(tracklist_str):
    """Parse tracklist string like '0:00 Intro, 1:30 Drop, 3:15 Bridge' into markers."""
    if not tracklist_str:
        return []

    markers = []
    entries = [e.strip() for e in tracklist_str.split(",")]

    type_colors = {
        "intro": ("#3b82f6", "section"),
        "outro": ("#3b82f6", "section"),
        "drop": ("#ef4444", "drop"),
        "breakdown": ("#f59e0b", "section"),
        "bridge": ("#f59e0b", "section"),
        "buildup": ("#f59e0b", "section"),
        "build": ("#f59e0b", "section"),
        "transition": ("#8b5cf6", "transition"),
        "verse": ("#10b981", "section"),
        "chorus": ("#10b981", "section"),
        "hook": ("#10b981", "section"),
    }

    for i, entry in enumerate(entries):
        match = re.match(r"(\d+:\d{2}(?::\d{2})?)\s+(.+)", entry)
        if not match:
            print(f"Warning: skipping invalid tracklist entry: '{entry}'", file=sys.stderr)
            continue

        time_str = match.group(1)
        name = match.group(2).strip()

        # Parse time to seconds
        parts = time_str.split(":")
        if len(parts) == 3:
            seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        else:
            seconds = int(parts[0]) * 60 + int(parts[1])

        # Detect type from name
        name_lower = name.lower()
        color = "#10b981"
        marker_type = "track"
        for keyword, (c, t) in type_colors.items():
            if keyword in name_lower:
                color = c
                marker_type = t
                break

        marker_id = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

        markers.append({
            "id": marker_id,
            "name": name,
            "time": seconds,
            "timestamp": time_str,
            "type": marker_type,
            "color": color,
        })

    return markers


def generate_metadata(args):
    """Generate the full metadata JSON structure."""
    markers = parse_tracklist(args.tracklist)

    # Determine audio filename
    audio_basename = os.path.basename(args.audio) if args.audio else "audio.mp3"
    if not audio_basename.endswith(".mp3"):
        audio_basename = os.path.splitext(audio_basename)[0] + ".mp3"

    # Build slug for filenames
    slug = re.sub(r"[^a-z0-9]+", "-", args.title.lower()).strip("-")

    metadata = {
        "metadata": {
            "title": args.title,
            "artist": args.artist or "Unknown Artist",
            "date": args.date or datetime.now().strftime("%Y-%m-%d"),
            "duration": args.duration or 0,
            "bpm": args.bpm or None,
            "genre": args.genre or None,
            "description": args.description or f"{args.title} by {args.artist or 'Unknown Artist'}",
            "tags": [t.strip() for t in args.tags.split(",")] if args.tags else [],
            "source": "pipeline",
            "exported": datetime.now().isoformat(),
        },
        "audio_files": {
            "mp3": f"data/{audio_basename}",
        },
        "markers": markers,
        "social": {
            "share_url": "",
            "download_enabled": True,
            "comments_enabled": False,
        },
    }

    if args.artwork:
        artwork_ext = os.path.splitext(args.artwork)[1]
        metadata["metadata"]["artwork"] = f"data/{slug}{artwork_ext}"

    # Remove None values from metadata
    metadata["metadata"] = {k: v for k, v in metadata["metadata"].items() if v is not None}

    return metadata, slug


def main():
    parser = argparse.ArgumentParser(description="Generate metadata JSON for Aurdour web player")
    parser.add_argument("--title", required=True, help="Track/mix title")
    parser.add_argument("--artist", default="", help="Artist name")
    parser.add_argument("--genre", default=None, help="Genre")
    parser.add_argument("--bpm", type=int, default=None, help="BPM")
    parser.add_argument("--date", default=None, help="Date (YYYY-MM-DD)")
    parser.add_argument("--duration", type=int, default=0, help="Duration in seconds")
    parser.add_argument("--description", default=None, help="Description")
    parser.add_argument("--tags", default=None, help="Comma-separated tags")
    parser.add_argument("--artwork", default=None, help="Path to artwork image")
    parser.add_argument("--audio", default=None, help="Audio file path (for filename reference)")
    parser.add_argument("--tracklist", default=None, help='Tracklist: "0:00 Intro, 1:30 Drop, 3:15 Bridge"')
    parser.add_argument("-o", "--output", default=None, help="Output JSON file path")

    args = parser.parse_args()
    metadata, slug = generate_metadata(args)

    output_path = args.output or f"web/data/{slug}.json"

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Generated: {output_path}")
    return output_path


if __name__ == "__main__":
    main()
