#!/usr/bin/env python3
"""Scan web/data/*.json and generate manifest.json for the library browser."""

import json
import os
import sys


def build_manifest(data_dir):
    tracks = []

    for filename in sorted(os.listdir(data_dir)):
        if not filename.endswith('.json') or filename == 'manifest.json':
            continue

        filepath = os.path.join(data_dir, filename)
        try:
            with open(filepath) as f:
                data = json.load(f)

            meta = data.get('metadata', {})
            tracks.append({
                'id': os.path.splitext(filename)[0],
                'dataFile': f'data/{filename}',
                'title': meta.get('title', filename),
                'artist': meta.get('artist', ''),
                'bpm': meta.get('bpm'),
                'key': meta.get('key'),
                'duration': meta.get('duration', 0),
                'genre': meta.get('genre', ''),
            })
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Warning: skipping {filename}: {e}", file=sys.stderr)

    manifest = {'tracks': tracks}
    manifest_path = os.path.join(data_dir, 'manifest.json')

    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest updated: {manifest_path} ({len(tracks)} tracks)")


if __name__ == '__main__':
    data_dir = sys.argv[1] if len(sys.argv) > 1 else 'web/data'
    build_manifest(data_dir)
