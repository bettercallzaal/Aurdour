#!/usr/bin/env python3
"""
Extract markers from Ardour session files and convert to JSON.

Usage:
    python extract_markers.py session.ardour -o output.json
"""

import xml.etree.ElementTree as ET
import json
import argparse
import sys
from pathlib import Path
from typing import List, Dict, Optional


def parse_ardour_session(session_file: Path) -> Dict:
    """Parse Ardour session XML and extract metadata."""
    try:
        tree = ET.parse(session_file)
        root = tree.getroot()
        
        session_data = {
            'name': root.get('name', 'Untitled'),
            'sample_rate': int(root.get('sample-rate', 48000)),
            'version': root.get('version', 'unknown'),
        }
        
        return session_data
    except ET.ParseError as e:
        print(f"Error parsing XML: {e}", file=sys.stderr)
        sys.exit(1)


def extract_markers(session_file: Path, sample_rate: Optional[int] = None) -> List[Dict]:
    """Extract location markers from Ardour session."""
    tree = ET.parse(session_file)
    root = tree.getroot()
    
    if sample_rate is None:
        sample_rate = int(root.get('sample-rate', 48000))
    
    markers = []
    
    locations = root.find('Locations')
    if locations is None:
        print("Warning: No Locations section found in session", file=sys.stderr)
        return markers
    
    for location in locations.findall('Location'):
        if location.get('flags', '').find('IsMark') == -1:
            continue
        
        name = location.get('name', 'Unnamed')
        start_frames = int(location.get('start', 0))
        
        time_seconds = start_frames / sample_rate
        
        marker = {
            'name': name,
            'time': time_seconds,
            'frames': start_frames,
            'timestamp': format_timestamp(time_seconds)
        }
        
        markers.append(marker)
    
    markers.sort(key=lambda x: x['time'])
    
    return markers


def format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS or HH:MM:SS format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def extract_tempo_map(session_file: Path) -> List[Dict]:
    """Extract tempo/BPM changes from session."""
    tree = ET.parse(session_file)
    root = tree.getroot()
    
    tempo_map = []
    
    tempo_section = root.find('.//TempoMap')
    if tempo_section is None:
        return tempo_map
    
    for tempo in tempo_section.findall('Tempo'):
        bpm = float(tempo.get('beats-per-minute', 120))
        start = float(tempo.get('start', 0))
        
        tempo_map.append({
            'time': start,
            'bpm': bpm
        })
    
    return tempo_map


def generate_json_output(session_file: Path, markers: List[Dict], 
                        session_data: Dict, tempo_map: List[Dict]) -> Dict:
    """Generate complete JSON output."""
    
    duration = 0
    if markers:
        duration = markers[-1]['time']
    
    output = {
        'metadata': {
            'title': session_data['name'],
            'source': 'Ardour',
            'sample_rate': session_data['sample_rate'],
            'duration': duration,
            'exported': None,
        },
        'markers': markers,
        'tempo': tempo_map if tempo_map else [{'time': 0, 'bpm': 120}],
        'audio_files': {
            'mp3': f"{session_data['name']}.mp3",
            'ogg': f"{session_data['name']}.ogg",
        }
    }
    
    return output


def export_to_cue(markers: List[Dict], session_name: str, output_file: Path):
    """Export markers to CUE sheet format."""
    cue_content = [
        f'TITLE "{session_name}"',
        f'PERFORMER "Unknown"',
        f'FILE "{session_name}.mp3" MP3',
    ]
    
    for idx, marker in enumerate(markers, 1):
        minutes = int(marker['time'] // 60)
        seconds = int(marker['time'] % 60)
        frames = int((marker['time'] % 1) * 75)
        
        cue_content.extend([
            f'  TRACK {idx:02d} AUDIO',
            f'    TITLE "{marker["name"]}"',
            f'    INDEX 01 {minutes:02d}:{seconds:02d}:{frames:02d}'
        ])
    
    output_file.write_text('\n'.join(cue_content))
    print(f"CUE sheet written to: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description='Extract markers from Ardour session files'
    )
    parser.add_argument(
        'session_file',
        type=Path,
        help='Path to Ardour session file (.ardour)'
    )
    parser.add_argument(
        '-o', '--output',
        type=Path,
        help='Output JSON file (default: markers.json)',
        default=Path('markers.json')
    )
    parser.add_argument(
        '-f', '--format',
        choices=['json', 'cue', 'both'],
        default='json',
        help='Output format (default: json)'
    )
    parser.add_argument(
        '--sample-rate',
        type=int,
        help='Override sample rate (default: read from session)'
    )
    parser.add_argument(
        '--pretty',
        action='store_true',
        help='Pretty-print JSON output'
    )
    
    args = parser.parse_args()
    
    if not args.session_file.exists():
        print(f"Error: Session file not found: {args.session_file}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Parsing Ardour session: {args.session_file}")
    
    session_data = parse_ardour_session(args.session_file)
    print(f"Session: {session_data['name']} ({session_data['sample_rate']} Hz)")
    
    markers = extract_markers(args.session_file, args.sample_rate)
    print(f"Found {len(markers)} markers")
    
    tempo_map = extract_tempo_map(args.session_file)
    
    if args.format in ['json', 'both']:
        output_data = generate_json_output(
            args.session_file, markers, session_data, tempo_map
        )
        
        json_args = {'indent': 2} if args.pretty else {}
        args.output.write_text(json.dumps(output_data, **json_args))
        print(f"JSON written to: {args.output}")
    
    if args.format in ['cue', 'both']:
        cue_file = args.output.with_suffix('.cue')
        export_to_cue(markers, session_data['name'], cue_file)
    
    if markers:
        print("\nMarkers:")
        for marker in markers:
            print(f"  {marker['timestamp']} - {marker['name']}")


if __name__ == '__main__':
    main()
