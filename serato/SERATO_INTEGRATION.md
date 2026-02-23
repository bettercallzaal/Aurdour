# Serato DJ to Web Player Integration Guide

Complete guide for recording DJ sets in Serato DJ Pro/Lite and publishing them with the web audio player.

## 🎯 What This Guide Covers

- Recording your DJ sets in Serato
- Exporting session history (tracklist)
- Converting Serato history to web player markers
- Live streaming integration
- Best practices for DJ workflows

## 📋 Prerequisites

- Serato DJ Pro or Serato DJ Lite
- Compatible DJ controller or mixer
- This web player project
- Python 3.x (for conversion scripts)

## 🎚️ Part 1: Recording Your DJ Set in Serato

### Step 1: Set Up Recording

1. **Connect Your Hardware**
   - Connect your Serato-compatible mixer/controller via USB
   - Launch Serato DJ Pro or Lite
   - Ensure your hardware is recognized

2. **Open Recording Panel**
   - Click the **REC** button in the top toolbar
   - The Recording panel will open

3. **Configure Recording Settings**
   - **Record Input Source**: Set to `Mix` (for most controllers/mixers)
   - **File Format**: WAV (highest quality) or AIFF
   - **Bit Depth**: 24-bit (recommended) or 16-bit
   - **Sample Rate**: 48kHz or 44.1kHz
   - **File Location**: Choose where to save recordings

4. **Test Your Levels**
   - Play a loud section of a track
   - Watch the recording level meter
   - Adjust **Record Input Gain** so peaks hit around -6dB
   - Avoid clipping (red indicators)

### Step 2: Record Your Set

1. **Start Recording**
   - Press the **REC** button in the Recording panel
   - The button will turn red and show recording time
   - Start mixing!

2. **During Recording**
   - Monitor levels occasionally
   - Serato automatically tracks all played songs in History
   - Continue mixing as normal

3. **Stop Recording**
   - Press the **REC** button again to stop
   - Enter a filename (e.g., "Summer Rooftop Mix 2024")
   - Click **Save**

### Recording Tips

- **Always test record** a short clip first
- **Monitor levels** - aim for -6dB to -3dB peaks
- **Use WAV format** for archival, convert to MP3 later
- **Name files clearly** with date and venue/event
- **Keep backups** of original recordings

## 📝 Part 2: Exporting Session History (Tracklist)

Serato automatically tracks every song you play. Here's how to export it:

### Step 1: Access History Panel

1. Click the **HISTORY** button in the top toolbar
2. Your sessions are listed by date/time
3. Select the session you just recorded

### Step 2: Export Tracklist

1. Click **Export Playlist** button
2. Choose export format:
   - **TXT** - Simple text file (easiest)
   - **CSV** - Spreadsheet format (most detailed)
   - **M3U** - Playlist file
   - **Serato Playlists** - Upload to Serato.com

3. Click **Export**
4. Files are saved to: `Music/_Serato_/History/`

### What Gets Exported

**CSV Format includes:**
- Track name
- Artist
- Start time (when you mixed it in)
- End time
- Deck used
- BPM
- Key
- Duration

**TXT Format includes:**
- Track name
- Artist
- Start time

### History Management Tips

- **Manual markers**: Use "Insert Track" to add vinyl/CD tracks
- **Mark as Played**: Correct mistakes in your history
- **Show Unplayed**: See tracks you loaded but didn't play
- **Start/End Session**: Manually control session boundaries

## 🔄 Part 3: Converting Serato History to Web Player Format

I've created a script to convert Serato CSV exports to our JSON format.

### Step 1: Export from Serato as CSV

```bash
# Serato saves to:
# Mac: ~/Music/_Serato_/History/
# Windows: C:\Users\[Username]\Music\_Serato_\History\
```

### Step 2: Run Conversion Script

```bash
python3 serato/convert_serato_history.py \
  ~/Music/_Serato_/History/session_2024-01-15.csv \
  -o web/data/my-mix.json \
  --title "Summer Rooftop Mix 2024" \
  --artist "DJ Your Name"
```

### Step 3: Add Your Audio File

```bash
# Convert Serato WAV recording to web format
ffmpeg -i ~/Music/_Serato_/Recordings/my-mix.wav \
  -codec:a libmp3lame -b:a 320k \
  web/data/my-mix.mp3
```

### Step 4: Deploy

```bash
cd web
python3 -m http.server 8000
# Test at http://localhost:8000
```

## 🎛️ Part 4: Understanding the Web Player Controls

### Main Controls

**Play/Pause Button** (Space bar)
- Click or press Space to play/pause
- Large button on the left

**Skip Buttons** (← →)
- Skip backward 10 seconds
- Skip forward 10 seconds
- Keyboard: Arrow keys skip 5 seconds

**Time Display**
- Shows current time / total duration
- Click waveform to jump to any point

**Volume Control**
- Slider adjusts playback volume
- Click speaker icon to mute/unmute
- Keyboard: M to mute

**Loop Button**
- Toggle to repeat the entire mix
- Useful for background listening

### Waveform Features

**Waveform Visualization**
- Blue = played portion
- Gray = unplayed portion
- Colored regions = track sections

**Timeline**
- Shows time markers every 10-30 seconds
- Click anywhere to jump to that time

**Markers**
- Vertical lines show track changes
- Click marker to jump to that track
- Hover to see track info

### Marker List

**Track Markers**
- Shows all tracks in your mix
- Click any track to jump to it
- Color-coded by type:
  - 🟢 Green = Tracks
  - 🔵 Blue = Sections (intro/outro)
  - 🟣 Purple = Transitions
  - 🟡 Amber = Cue points

**Marker Information**
- Track name and artist
- Timestamp (when it starts)
- Click to jump and auto-play

### Sharing Features

**Share Button**
- Copy full mix URL
- Share at current timestamp
- Generate embed code for websites

**Share at Timestamp**
- Shares link that starts at specific time
- Example: `?t=2m30s` starts at 2:30
- Great for highlighting specific tracks

**Download Button**
- Download the full mix (if enabled)
- Downloads MP3 file

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Skip back 5s |
| `→` | Skip forward 5s |
| `M` | Mute/Unmute |
| `L` | Toggle loop |
| `0-9` | Jump to 0-90% |

## 🎥 Part 5: Live Streaming Integration

### Option A: Stream to Ardour for Post-Production

**Why?** Record in Serato, edit/master in Ardour, publish with web player.

1. **Record in Serato** (as above)
2. **Import to Ardour**
   - Create new session
   - Import recorded WAV file
   - Add markers for key moments
3. **Export from Ardour** (see main guide)
4. **Deploy web player**

### Option B: Live Stream While Recording

**Why?** Go live on Twitch/YouTube while recording for later.

#### Mac Setup

1. **Install Serato Virtual Audio Device**
   - In Serato: `Setup → Audio`
   - Check "Make Audio Output Available to Other Applications"
   - Click "Install" when prompted
   - Restart Serato

2. **Install OBS Studio**
   - Download from [obsproject.com](https://obsproject.com)
   - Install and launch

3. **Configure OBS**
   - Add Audio Input Capture source
   - Select "Serato Virtual Audio" as device
   - Test audio levels in OBS mixer
   - Add camera/screen capture if desired

4. **Go Live**
   - Connect OBS to Twitch/YouTube
   - Start streaming
   - **Also record in Serato** for high-quality archive

#### Windows Setup

1. **Install Virtual Audio Cable**
   - Download from [vac.muzychenko.net](https://vac.muzychenko.net/en/download.htm)
   - Extract and run Setup
   - Follow installation prompts

2. **Enable in Serato**
   - `Setup → Audio`
   - Check "Make Audio Output Available to Other Applications"

3. **Configure OBS**
   - Add Audio Input Capture
   - Select "Virtual Audio Cable" as device
   - Test levels

4. **Go Live**
   - Stream and record simultaneously

### Live Streaming Tips

- **Always record locally** in Serato (highest quality)
- **Test stream** before going live
- **Monitor levels** in both Serato and OBS
- **Use master volume** in Serato to control stream level
- **Add visuals** in OBS (camera, logo, waveform)
- **Engage chat** while mixing

## 🎯 Part 6: Complete DJ Workflow

### Pre-Mix Preparation

1. **Organize Library**
   - Create crates for your set
   - Analyze tracks (BPM, key)
   - Set cue points
   - Plan rough track order

2. **Test Equipment**
   - Check all connections
   - Test recording levels
   - Verify monitoring setup
   - Have backup plan

### During Mix

1. **Start Recording** in Serato
2. **Mix as normal** - Serato tracks everything
3. **Monitor levels** occasionally
4. **Stay in the zone** - don't overthink it

### Post-Mix

1. **Stop and Save Recording**
   - Name it clearly
   - Note date/venue/event

2. **Export History**
   - Export as CSV
   - Review tracklist for accuracy

3. **Convert for Web**
   ```bash
   # Convert audio
   ffmpeg -i recording.wav -b:a 320k mix.mp3
   
   # Convert history
   python3 serato/convert_serato_history.py history.csv -o mix.json
   ```

4. **Optional: Edit in Ardour**
   - Import recording
   - Trim silence
   - Normalize levels
   - Add fade in/out
   - Export

5. **Deploy Web Player**
   ```bash
   netlify deploy --prod
   ```

6. **Share**
   - Post on social media
   - Share specific track timestamps
   - Engage with listeners

## 🎨 Part 7: Customizing Your Web Player

### Add Mix Artwork

1. Create 1400x1400px image
2. Save as `web/artwork.jpg`
3. Update JSON:
   ```json
   {
     "metadata": {
       "artwork": "artwork.jpg"
     }
   }
   ```

### Add Track Details

Enhance markers with full track info:

```json
{
  "markers": [
    {
      "id": "track-1",
      "name": "Track 1 - Artist Name - Song Title",
      "time": 120,
      "timestamp": "02:00",
      "type": "track",
      "metadata": {
        "artist": "Artist Name",
        "title": "Song Title",
        "label": "Record Label",
        "year": 2024,
        "bpm": 128,
        "key": "Am"
      }
    }
  ]
}
```

### Add Mix Description

```json
{
  "metadata": {
    "description": "Live set from Brooklyn rooftop party. Deep house and techno journey through the sunset.",
    "genre": "House / Techno",
    "tags": ["house", "techno", "live", "rooftop", "brooklyn"]
  }
}
```

## 🔧 Troubleshooting

### Recording Issues

**No audio in recording:**
- Check "Record Input Source" is set to "Mix"
- Verify hardware is connected and recognized
- Check master volume isn't at zero
- Test with headphones first

**Recording is clipping:**
- Lower "Record Input Gain" in Serato
- Check mixer master output isn't too hot
- Aim for -6dB to -3dB peaks

**Recording is too quiet:**
- Increase "Record Input Gain"
- Check mixer master output level
- Verify all channel faders are up

### History Export Issues

**Tracks missing from history:**
- Ensure you crossfaded AND brought fader up
- Check "Show Unplayed" to see all loaded tracks
- Manually "Insert Track" if needed

**Wrong track times:**
- Serato logs when you mix in (crossfade + fader)
- Times may not match exact audio position
- Manually adjust in JSON if needed

### Conversion Issues

**CSV won't convert:**
- Verify CSV format (export from Serato, not edited)
- Check file encoding (UTF-8)
- Ensure Python script has correct path

**Markers don't align:**
- Serato times are relative to session start
- Recording may have started before/after first track
- Manually adjust offset in JSON

## 💡 Pro Tips

### For Better Recordings

1. **Record in 24-bit WAV** - you can always compress later
2. **Set levels conservatively** - easier to boost than fix clipping
3. **Record a test** before the actual set
4. **Keep backups** on multiple drives
5. **Name files systematically** - date, venue, event

### For Better History

1. **Load tracks properly** - crossfade + fader = logged
2. **Review after mixing** - correct any mistakes
3. **Add manual entries** for vinyl/CDs
4. **Export immediately** - don't lose session data
5. **Keep CSV backups** - easy to re-convert

### For Better Web Experience

1. **Add detailed track info** - artist, label, year
2. **Write engaging descriptions** - tell the story
3. **Create custom artwork** - visual identity matters
4. **Share timestamp links** - highlight best moments
5. **Engage with listeners** - respond to comments

## 📚 Additional Resources

### Official Serato Guides
- [Serato DJ Pro Manual](https://serato.com/dj/pro/downloads)
- [Recording Guide](https://support.serato.com/hc/en-us/articles/202304734)
- [History Panel Guide](https://support.serato.com/hc/en-us/articles/223455687)
- [Live Streaming Setup](https://support.serato.com/hc/en-us/articles/360001784415)

### Community Resources
- [r/Serato](https://reddit.com/r/Serato) - Reddit community
- [Serato Forums](https://serato.com/forum) - Official forums
- [DJ TechTools](https://djtechtools.com) - Tutorials and tips

### This Project
- [Main README](../README.md)
- [Ardour Export Guide](../ardour/EXPORT_GUIDE.md)
- [JSON Schema](../docs/SCHEMA.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)

## 🎉 You're Ready!

You now have a complete workflow:
1. ✅ Record DJ sets in Serato
2. ✅ Export session history
3. ✅ Convert to web player format
4. ✅ Deploy and share

Start mixing, recording, and sharing your sets with the world! 🎧
