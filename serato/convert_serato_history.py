#!/usr/bin/env python3
"""
Convert Serato DJ history CSV to web player JSON format.

Usage:
    python convert_serato_history.py session.csv -o output.json --title "My Mix"
"""

import csv
import json
import argparse
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict


def parse_serato_csv(csv_file: Path) -> List[Dict]:
    """Parse Serato history CSV file."""
    markers = []
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                name = row.get('name', '').strip()
                artist = row.get('artist', '').strip()
                start_time = row.get('start time', '').strip()
                
                if not name:
                    continue
                
                time_seconds = parse_time(start_time)
                
                marker_name = f"{artist} - {name}" if artist else name
                
                marker = {
                    'id': generate_id(marker_name),
                    'name': marker_name,
                    'time': time_seconds,
                    'timestamp': format_timestamp(time_seconds),
                    'type': 'track',
                    'color': '#10b981',
                    'metadata': {
                        'artist': artist,
                        'title': name,
                    }
                }
                
                if 'bpm' in row and row['bpm']:
                    try:
                        marker['metadata']['bpm'] = float(row['bpm'])
                    except ValueError:
                        pass
                
                if 'key' in row and row['key']:
                    marker['metadata']['key'] = row['key']
                
                if 'genre' in row and row['genre']:
                    marker['metadata']['genre'] = row['genre']
                
                markers.append(marker)
    
    except Exception as e:
        print(f"Error parsing CSV: {e}", file=sys.stderr)
        sys.exit(1)
    
    markers.sort(key=lambda x: x['time'])
    
    return markers


def parse_time(time_str: str) -> float:
    """Convert Serato time string to seconds."""
    if not time_str:
        return 0.0
    
    try:
        if ':' in time_str:
            parts = time_str.split(':')
            if len(parts) == 2:
                minutes, seconds = parts
                return float(minutes) * 60 + float(seconds)
            elif len(parts) == 3:
                hours, minutes, seconds = parts
                return float(hours) * 3600 + float(minutes) * 60 + float(seconds)
        else:
            return float(time_str)
    except ValueError:
        return 0.0


def format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS or HH:MM:SS format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def generate_id(name: str) -> str:
    """Generate slug-style ID from name."""
    import re
    slug = name.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug[:50]


def calculate_duration(markers: List[Dict]) -> float:
    """Calculate total duration from markers."""
    if not markers:
        return 0.0
    
    last_marker = markers[-1]
    return last_marker['time'] + 300


def generate_json_output(markers: List[Dict], title: str, artist: str, 
                        audio_file: str, args) -> Dict:
    """Generate complete JSON output."""
    
    duration = calculate_duration(markers)
    
    output = {
        'metadata': {
            'title': title,
            'artist': artist,
            'date': datetime.now().strftime('%Y-%m-%d'),
            'duration': duration,
            'source': 'Serato DJ',
            'exported': datetime.now().isoformat(),
        },
        'audio_files': {
            'mp3': audio_file,
        },
        'markers': markers,
    }
    
    if args.description:
        output['metadata']['description'] = args.description
    
    if args.genre:
        output['metadata']['genre'] = args.genre
    
    if args.bpm:
        output['metadata']['bpm'] = args.bpm
        output['tempo'] = [{'time': 0, 'bpm': args.bpm}]
    
    if args.tags:
        output['metadata']['tags'] = args.tags.split(',')
    
    if args.artwork:
        output['metadata']['artwork'] = args.artwork
    
    output['social'] = {
        'download_enabled': args.download_enabled,
    }
    
    return output


def add_intro_outro(markers: List[Dict]) -> List[Dict]:
    """Add intro and outro markers if not present."""
    if not markers:
        return markers
    
    has_intro = any(m['time'] == 0 for m in markers)
    if not has_intro:
        intro = {
            'id': 'intro',
            'name': 'Intro',
            'time': 0,
            'timestamp': '00:00',
            'type': 'section',
            'color': '#3b82f6'
        }
        markers.insert(0, intro)
    
    last_time = markers[-1]['time']
    outro_time = last_time + 300
    outro = {
        'id': 'outro',
        'name': 'Outro',
        'time': outro_time,
        'timestamp': format_timestamp(outro_time),
        'type': 'section',
        'color': '#3b82f6'
    }
    markers.append(outro)
    
    return markers


def main():
    parser = argparse.ArgumentParser(
        description='Convert Serato DJ history CSV to web player JSON'
    )
    parser.add_argument(
        'csv_file',
        type=Path,
        help='Path to Serato history CSV file'
    )
    parser.add_argument(
        '-o', '--output',
        type=Path,
        help='Output JSON file (default: output.json)',
        default=Path('output.json')
    )
    parser.add_argument(
        '--title',
        type=str,
        required=True,
        help='Mix title'
    )
    parser.add_argument(
        '--artist',
        type=str,
        required=True,
        help='Artist/DJ name'
    )
    parser.add_argument(
        '--audio-file',
        type=str,
        help='Audio file name (default: derived from title)',
        default=None
    )
    parser.add_argument(
        '--description',
        type=str,
        help='Mix description'
    )
    parser.add_argument(
        '--genre',
        type=str,
        help='Genre/style'
    )
    parser.add_argument(
        '--bpm',
        type=int,
        help='Average BPM'
    )
    parser.add_argument(
        '--tags',
        type=str,
        help='Comma-separated tags'
    )
    parser.add_argument(
        '--artwork',
        type=str,
        help='Artwork filename'
    )
    parser.add_argument(
        '--download-enabled',
        action='store_true',
        help='Enable downloads'
    )
    parser.add_argument(
        '--add-intro-outro',
        action='store_true',
        help='Add intro/outro markers'
    )
    parser.add_argument(
        '--time-offset',
        type=float,
        default=0.0,
        help='Time offset in seconds (if recording started before/after session)'
    )
    parser.add_argument(
        '--pretty',
        action='store_true',
        help='Pretty-print JSON output'
    )
    
    args = parser.parse_args()
    
    if not args.csv_file.exists():
        print(f"Error: CSV file not found: {args.csv_file}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Parsing Serato history: {args.csv_file}")
    
    markers = parse_serato_csv(args.csv_file)
    print(f"Found {len(markers)} tracks")
    
    if args.time_offset != 0:
        print(f"Applying time offset: {args.time_offset}s")
        for marker in markers:
            marker['time'] += args.time_offset
            marker['timestamp'] = format_timestamp(marker['time'])
    
    if args.add_intro_outro:
        markers = add_intro_outro(markers)
        print("Added intro/outro markers")
    
    audio_file = args.audio_file
    if not audio_file:
        audio_file = f"{generate_id(args.title)}.mp3"
    
    output_data = generate_json_output(
        markers, args.title, args.artist, audio_file, args
    )
    
    json_args = {'indent': 2} if args.pretty else {}
    args.output.write_text(json.dumps(output_data, **json_args))
    print(f"JSON written to: {args.output}")
    
    print("\nMarkers:")
    for marker in markers[:10]:
        print(f"  {marker['timestamp']} - {marker['name']}")
    if len(markers) > 10:
        print(f"  ... and {len(markers) - 10} more")
    
    print(f"\nNext steps:")
    print(f"1. Convert audio: ffmpeg -i recording.wav -b:a 320k web/data/{audio_file}")
    print(f"2. Move JSON: mv {args.output} web/data/")
    print(f"3. Test: cd web && python3 -m http.server 8000")
    print(f"4. Deploy: netlify deploy --prod")


if __name__ == '__main__':
    main()
