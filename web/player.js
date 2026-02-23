// player.js — DJPlayer orchestrator
// Wires together all DJ modules for a full streaming DJ platform

import { Deck } from './dj/Deck.js';
import { AudioRouter } from './dj/AudioRouter.js';
import { Mixer } from './dj/Mixer.js';
import { Meters } from './dj/Meters.js';
import { Library } from './dj/Library.js';
import { Sampler } from './dj/Sampler.js';
import { Recorder } from './dj/Recorder.js';
import { Visualizer } from './dj/Visualizer.js';
import { MidiController } from './dj/MidiController.js';
import { BpmTap } from './dj/BpmTap.js';
import { StreamBroadcast } from './dj/StreamBroadcast.js';
import { FX } from './dj/FX.js';
import { AutoTransition } from './dj/AutoTransition.js';
import { Setlist } from './dj/Setlist.js';
import { HarmonicMixer } from './dj/HarmonicMixer.js';
import { StemSeparator } from './dj/StemSeparator.js';
import { Storage } from './dj/Storage.js';
import { BpmDetector } from './dj/BpmDetector.js';
import { JogWheel } from './dj/JogWheel.js';
import { DragDrop } from './dj/DragDrop.js';
import { CrashRecovery } from './dj/CrashRecovery.js';
import { WaveformCache } from './dj/WaveformCache.js';
import { Playlists } from './dj/Playlists.js';
import { PerfMonitor } from './dj/PerfMonitor.js';
import { Settings } from './dj/Settings.js';
import { FlowMode } from './dj/FlowMode.js';

class DJPlayer {
    constructor() {
        this.audioRouter = new AudioRouter();
        this.decks = {};
        this._audioConnected = { A: false, B: false };
        this.storage = new Storage();

        // Core
        this._initDecks();
        this.mixer = new Mixer(this.audioRouter);
        this.meters = new Meters(this.audioRouter);
        this.sampler = new Sampler(this.audioRouter);
        this.library = new Library((deckId, dataFile) => this._onLoadTrack(deckId, dataFile));

        // Safe init helper — one module failure shouldn't block the rest
        const safeInit = (name, fn) => {
            try { return fn(); } catch (e) { console.warn(`${name} init failed:`, e); return null; }
        };

        // Effects
        this.fx = safeInit('FX', () => new FX(this.audioRouter));
        this.stems = safeInit('StemSeparator', () => new StemSeparator(this.audioRouter));

        // Streaming & recording
        this.recorder = safeInit('Recorder', () => new Recorder(this.audioRouter));
        this.visualizer = safeInit('Visualizer', () => new Visualizer(this.audioRouter));
        this.broadcast = safeInit('StreamBroadcast', () => new StreamBroadcast(this.audioRouter, this.recorder));

        // Pro tools
        this.bpmTap = safeInit('BpmTap', () => new BpmTap());
        this.midi = safeInit('MidiController', () => new MidiController(this));
        this.harmonic = safeInit('HarmonicMixer', () => new HarmonicMixer());
        this.autoTransition = safeInit('AutoTransition', () => new AutoTransition(this.audioRouter, this.mixer, this.decks));
        this.setlist = safeInit('Setlist', () => new Setlist(this.library, (deckId, dataFile) => this._onLoadTrack(deckId, dataFile)));

        // New production modules
        this.bpmDetector = safeInit('BpmDetector', () => new BpmDetector(this.audioRouter));
        this.jogWheel = safeInit('JogWheel', () => new JogWheel(this.decks));
        this.dragDrop = safeInit('DragDrop', () => new DragDrop(this.decks, this.audioRouter));
        this.waveformCache = safeInit('WaveformCache', () => new WaveformCache());
        this.playlists = safeInit('Playlists', () => new Playlists(this.storage));
        this.perfMonitor = safeInit('PerfMonitor', () => new PerfMonitor(this.audioRouter));
        this.settings = safeInit('Settings', () => new Settings(this));
        this.crashRecovery = safeInit('CrashRecovery', () => new CrashRecovery());

        // Flow Mode — auto-DJ for non-DJs
        this.flowMode = safeInit('FlowMode', () => new FlowMode(this));

        // Wire library queue button to setlist
        if (this.setlist) {
            this.library.onAddToQueue = (track) => this.setlist.addToQueue(track);
        }

        // Wire playlists to library filter
        if (this.playlists) {
            this.playlists.onFilterChange = () => this._applyPlaylistFilter();
        }

        // UI bindings
        this._initTransportButtons();
        this._initHotCuePads();
        this._initLoopControls();
        this._initPitchControls();
        this._initPFLControls();
        this._initHeadphoneControls();
        this._initMicControls();
        this._initSystemAudioControls();
        this._initGlobalToggles();
        this._initKeyboardShortcuts();
        this._initAudioContextResume();
        this._loadSettings();

        // Load library first — this is the most important thing to show
        this.library.loadManifest();
        this.meters.start();
        if (this.perfMonitor) this.perfMonitor.start();

        // Crash recovery
        this._initCrashRecovery();
    }

    _initDecks() {
        const onReady = (deck) => {
            this._connectDeckAudio(deck);
            this.broadcast?.updateTrackInfo(deck.id, deck.metadata);
            this._updateHarmonicDisplay();

            // Restore saved cue points
            const trackId = deck.getTrackId();
            if (trackId) {
                const cues = this.storage.loadCuePoints(trackId);
                if (cues) {
                    deck.hotCues = cues.map(c => c ? { time: c.time, color: c.color } : null);
                    for (let i = 0; i < 8; i++) deck._updatePadUI(i);
                }
            }

            // Auto BPM/key detection if metadata is missing
            this._autoDetectBpmKey(deck);

            // Track play count
            if (trackId) this.playlists.incrementPlayCount(trackId);
        };

        const onTimeUpdate = (deck, time) => {
            this._updateTimeDisplay(deck, time);
        };

        const onTrackNearEnd = (deck) => {
            if (this.flowMode?.enabled) {
                this.flowMode.onTrackNearEnd(deck);
            }
        };

        const onFinish = (deck) => {
            if (this.flowMode?.enabled) {
                this.flowMode.onTrackNearEnd(deck);
            }
        };

        this.decks.A = new Deck('A', 'deck-a-waveform', 'deck-a-overview', { onReady, onTimeUpdate, onTrackNearEnd, onFinish });
        this.decks.B = new Deck('B', 'deck-b-waveform', 'deck-b-overview', { onReady, onTimeUpdate, onTrackNearEnd, onFinish });
    }

    async _autoDetectBpmKey(deck) {
        if (!deck.metadata) return;
        const meta = deck.metadata.metadata || {};
        const audioUrl = deck.metadata.audio_files?.mp3;
        const trackId = deck.getTrackId();
        if (!audioUrl || !trackId) return;

        // Only detect if BPM or key is missing
        if (meta.bpm && meta.key) return;

        try {
            const result = await this.bpmDetector.analyze(audioUrl, trackId);
            if (result.bpm && !meta.bpm) {
                meta.bpm = result.bpm;
                const prefix = `deck-${deck.id.toLowerCase()}`;
                const bpmEl = document.getElementById(`${prefix}-bpm`);
                if (bpmEl) bpmEl.textContent = `${result.bpm} BPM`;
                deck._buildBeatGrid();
            }
            if (result.key && !meta.key) {
                meta.key = result.key;
                const prefix = `deck-${deck.id.toLowerCase()}`;
                const keyEl = document.getElementById(`${prefix}-key`);
                if (keyEl) keyEl.textContent = result.key;
                this._updateHarmonicDisplay();
            }
        } catch (e) {
            console.warn('Auto BPM/key detection failed:', e);
        }
    }

    _connectDeckAudio(deck) {
        const mediaEl = deck.getMediaElement();
        if (!mediaEl) return;

        try {
            this.audioRouter.connectDeckSource(deck.id, mediaEl);
            this._audioConnected[deck.id] = true;
        } catch (e) {
            console.warn(`Deck ${deck.id}: Audio routing note:`, e.message);
        }
    }

    _updateTimeDisplay(deck, currentTime) {
        const prefix = `deck-${deck.id.toLowerCase()}`;
        const duration = deck.getDuration();
        const remaining = duration - currentTime;

        const elapsedEl = document.getElementById(`${prefix}-elapsed`);
        const remainingEl = document.getElementById(`${prefix}-remaining`);

        if (elapsedEl) elapsedEl.textContent = deck.formatTime(currentTime);
        if (remainingEl) remainingEl.textContent = `-${deck.formatTime(remaining)}`;

        const playBtn = document.getElementById(`${prefix}-play`);
        if (playBtn) {
            playBtn.classList.toggle('playing', deck.isPlaying);
            const playIcon = playBtn.querySelector('.icon-play');
            const pauseIcon = playBtn.querySelector('.icon-pause');
            if (playIcon && pauseIcon) {
                playIcon.classList.toggle('hidden', deck.isPlaying);
                pauseIcon.classList.toggle('hidden', !deck.isPlaying);
            }
        }

        this.broadcast?.updatePlayState(deck.id, deck.isPlaying, currentTime);
    }

    _updateHarmonicDisplay() {
        const keyA = this.decks.A.getKey();
        const keyB = this.decks.B.getKey();
        this.harmonic.updateDeckDisplay('A', keyA, keyB);
        this.harmonic.updateDeckDisplay('B', keyB, keyA);
    }

    _initTransportButtons() {
        ['a', 'b'].forEach(ch => {
            const deckId = ch.toUpperCase();
            const deck = this.decks[deckId];

            document.getElementById(`deck-${ch}-play`)?.addEventListener('click', () => {
                this.audioRouter.resume();
                deck.playPause();
            });

            document.getElementById(`deck-${ch}-cue`)?.addEventListener('click', () => {
                deck.cue();
            });

            document.getElementById(`deck-${ch}-sync`)?.addEventListener('click', () => {
                const otherDeck = deckId === 'A' ? this.decks.B : this.decks.A;
                let targetBPM = otherDeck.getBPM();
                if (!targetBPM && this.bpmTap.getBPM()) {
                    targetBPM = this.bpmTap.getBPM();
                }
                if (targetBPM) {
                    deck.syncTo(targetBPM);
                    const btn = document.getElementById(`deck-${ch}-sync`);
                    btn?.classList.add('active');
                    setTimeout(() => btn?.classList.remove('active'), 1000);
                }
            });
        });
    }

    _initHotCuePads() {
        ['a', 'b'].forEach(ch => {
            const deckId = ch.toUpperCase();
            const deck = this.decks[deckId];
            const padsContainer = document.getElementById(`deck-${ch}-pads`);
            if (!padsContainer) return;

            padsContainer.querySelectorAll('.cue-pad').forEach(pad => {
                const index = parseInt(pad.dataset.pad);
                pad.addEventListener('click', (e) => {
                    this.audioRouter.resume();
                    if (e.shiftKey) {
                        deck.clearHotCue(index);
                    } else {
                        deck.triggerHotCue(index);
                    }
                    // Save cue points
                    const trackId = deck.getTrackId();
                    if (trackId) this.storage.saveCuePoints(trackId, deck.hotCues);
                });
            });
        });
    }

    _initLoopControls() {
        ['a', 'b'].forEach(ch => {
            const deckId = ch.toUpperCase();
            const deck = this.decks[deckId];

            document.getElementById(`loop-${ch}-in`)?.addEventListener('click', () => deck.setLoopIn());
            document.getElementById(`loop-${ch}-out`)?.addEventListener('click', () => deck.setLoopOut());
            document.getElementById(`loop-${ch}-toggle`)?.addEventListener('click', () => deck.toggleLoop());
            document.getElementById(`loop-${ch}-halve`)?.addEventListener('click', () => deck.loopHalve());
            document.getElementById(`loop-${ch}-double`)?.addEventListener('click', () => deck.loopDouble());

            // Auto-loop buttons
            const deckSection = document.getElementById(`deck-${ch}`);
            if (deckSection) {
                deckSection.querySelectorAll('.auto-loop').forEach(btn => {
                    btn.addEventListener('click', () => {
                        deck.autoLoop(parseInt(btn.dataset.beats));
                    });
                });
            }
        });
    }

    _initPitchControls() {
        ['a', 'b'].forEach(ch => {
            const deckId = ch.toUpperCase();
            const deck = this.decks[deckId];

            const pitchFader = document.getElementById(`pitch-${ch}`);
            const pitchDisplay = document.getElementById(`pitch-${ch}-display`);

            if (pitchFader) {
                pitchFader.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    deck.setTempo(val);
                    if (pitchDisplay) pitchDisplay.textContent = `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
                });

                pitchFader.addEventListener('dblclick', () => {
                    pitchFader.value = 0;
                    deck.setTempo(0);
                    if (pitchDisplay) pitchDisplay.textContent = '0.0%';
                });
            }

            // Key lock
            document.getElementById(`keylock-${ch}`)?.addEventListener('click', () => {
                deck.setKeyLock(!deck.keyLock);
            });

            // Slip mode
            document.getElementById(`slip-${ch}`)?.addEventListener('click', () => {
                deck.setSlipMode(!deck.slipMode);
            });

            // Pitch range
            const pitchRange = document.getElementById(`pitch-range-${ch}`);
            if (pitchRange) {
                pitchRange.addEventListener('change', (e) => {
                    deck.setPitchRange(parseInt(e.target.value));
                });
            }
        });
    }

    _initPFLControls() {
        ['a', 'b'].forEach(ch => {
            const deckId = ch.toUpperCase();
            const pflBtn = document.getElementById(`pfl-${ch}`);
            if (!pflBtn) return;

            pflBtn.addEventListener('click', () => {
                const enabled = !this.audioRouter.channels[deckId].pfl;
                this.audioRouter.setPFL(deckId, enabled);
                pflBtn.classList.toggle('active', enabled);
            });
        });
    }

    _initHeadphoneControls() {
        const cueMix = document.getElementById('cue-mix');
        if (cueMix) {
            cueMix.addEventListener('input', (e) => {
                this.audioRouter.setCueMix(e.target.value / 100);
            });
        }

        const cueVol = document.getElementById('cue-volume');
        if (cueVol) {
            cueVol.addEventListener('input', (e) => {
                this.audioRouter.setCueVolume(e.target.value / 100);
            });
        }

        const splitCue = document.getElementById('split-cue');
        if (splitCue) {
            splitCue.addEventListener('click', () => {
                const enabled = !this.audioRouter.splitCue;
                this.audioRouter.setSplitCue(enabled);
                splitCue.classList.toggle('active', enabled);
            });
        }

        const boothVol = document.getElementById('booth-volume');
        if (boothVol) {
            boothVol.addEventListener('input', (e) => {
                this.audioRouter.setBoothVolume(e.target.value / 100);
            });
        }
    }

    _initMicControls() {
        const micToggle = document.getElementById('mic-toggle');
        const micMute = document.getElementById('mic-mute');
        const micVolume = document.getElementById('mic-volume');
        const micStatus = document.getElementById('mic-status');

        if (micToggle) {
            micToggle.addEventListener('click', async () => {
                if (this.audioRouter.mic.stream) {
                    this.audioRouter.disconnectMic();
                    micToggle.classList.remove('active');
                    micToggle.textContent = 'CONNECT';
                    if (micStatus) micStatus.textContent = 'Off';
                    if (micMute) micMute.classList.remove('active');
                } else {
                    const ok = await this.audioRouter.connectMic();
                    if (ok) {
                        micToggle.classList.add('active');
                        micToggle.textContent = 'DISCONNECT';
                        if (micStatus) micStatus.textContent = 'Connected';
                    } else {
                        if (micStatus) micStatus.textContent = 'Denied';
                    }
                }
            });
        }

        if (micMute) {
            micMute.addEventListener('click', () => {
                if (!this.audioRouter.mic.stream) return;
                const isMuted = this.audioRouter.mic.muted;
                this.audioRouter.setMicMute(!isMuted);
                micMute.classList.toggle('active', !isMuted);
                micMute.textContent = isMuted ? 'UNMUTE' : 'MUTE';
            });
        }

        if (micVolume) {
            micVolume.addEventListener('input', (e) => {
                this.audioRouter.setMicVolume(e.target.value / 100);
            });
        }

        ['high', 'mid', 'low'].forEach(band => {
            const knob = document.getElementById(`eq-mic-${band}`);
            if (knob) {
                knob.addEventListener('input', (e) => {
                    this.audioRouter.setMicEQ(band, parseFloat(e.target.value));
                });
                knob.addEventListener('dblclick', () => {
                    knob.value = 0;
                    this.audioRouter.setMicEQ(band, 0);
                });
            }
        });
    }

    _initSystemAudioControls() {
        const sysToggle = document.getElementById('system-toggle');
        const sysVolume = document.getElementById('system-volume');
        const sysStatus = document.getElementById('system-status');

        if (sysToggle) {
            sysToggle.addEventListener('click', async () => {
                if (this.audioRouter.system.active) {
                    this.audioRouter.disconnectSystemAudio();
                    sysToggle.classList.remove('active');
                    sysToggle.textContent = 'CAPTURE';
                    if (sysStatus) sysStatus.textContent = 'Off';
                } else {
                    const ok = await this.audioRouter.connectSystemAudio();
                    if (ok) {
                        sysToggle.classList.add('active');
                        sysToggle.textContent = 'STOP';
                        if (sysStatus) sysStatus.textContent = 'Active';
                    } else {
                        if (sysStatus) sysStatus.textContent = 'Failed';
                    }
                }
            });
        }

        if (sysVolume) {
            sysVolume.addEventListener('input', (e) => {
                this.audioRouter.setSystemVolume(e.target.value / 100);
            });
        }
    }

    _initGlobalToggles() {
        // RGB waveform toggle
        const rgbBtn = document.getElementById('rgb-toggle');
        if (rgbBtn) {
            rgbBtn.addEventListener('click', () => {
                const enabled = !this.decks.A.rgbMode;
                this.decks.A.setRGBMode(enabled);
                this.decks.B.setRGBMode(enabled);
                rgbBtn.classList.toggle('active', enabled);
            });
        }

        // Quantize toggle
        const qtzBtn = document.getElementById('quantize-toggle');
        if (qtzBtn) {
            qtzBtn.addEventListener('click', () => {
                const enabled = !this.decks.A.quantize;
                this.decks.A.quantize = enabled;
                this.decks.B.quantize = enabled;
                qtzBtn.classList.toggle('active', enabled);
            });
        }

        // Chat close
        document.getElementById('chat-close')?.addEventListener('click', () => {
            document.getElementById('chat-panel')?.classList.add('hidden');
        });

        // Flow Mode toggle
        document.getElementById('flow-toggle-btn')?.addEventListener('click', () => {
            if (this.flowMode) this.flowMode.toggle();
        });

        // Wire AutoTransition completion to FlowMode
        if (this.autoTransition) {
            this.autoTransition.onComplete = (direction) => {
                if (this.flowMode?.enabled) {
                    this.flowMode.onTransitionComplete(direction);
                }
            };
        }
    }

    _initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            this.audioRouter.resume();

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    (e.shiftKey ? this.decks.B : this.decks.A).playPause();
                    break;
                case 'KeyQ': this.decks.A.cue(); break;
                case 'KeyW': this.decks.B.cue(); break;
                case 'KeyS':
                    if (e.shiftKey) { const bpm = this.decks.A.getBPM(); if (bpm) this.decks.B.syncTo(bpm); }
                    else { const bpm = this.decks.B.getBPM(); if (bpm) this.decks.A.syncTo(bpm); }
                    break;
                case 'KeyM':
                    if (this.audioRouter.mic.stream) {
                        const muted = this.audioRouter.mic.muted;
                        this.audioRouter.setMicMute(!muted);
                        const micMute = document.getElementById('mic-mute');
                        if (micMute) { micMute.classList.toggle('active', !muted); micMute.textContent = muted ? 'UNMUTE' : 'MUTE'; }
                    }
                    break;
                case 'KeyR':
                    if (e.ctrlKey || e.metaKey) return;
                    if (this.recorder.isRecording) this.recorder.stop();
                    else this.recorder.start();
                    break;
                case 'KeyV':
                    if (this.visualizer.running) this.visualizer.stop();
                    else this.visualizer.start();
                    break;
                case 'KeyL':
                    if (e.shiftKey) this.decks.B.toggleLoop();
                    else this.decks.A.toggleLoop();
                    break;
                case 'BracketLeft':
                    (e.shiftKey ? this.decks.B : this.decks.A).setLoopIn();
                    break;
                case 'BracketRight':
                    (e.shiftKey ? this.decks.B : this.decks.A).setLoopOut();
                    break;
                case 'KeyZ':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (e.shiftKey) this.settings.redo();
                        else this.settings.undo();
                    }
                    break;
                case 'ArrowLeft': e.preventDefault(); this.mixer.nudgeCrossfader(-5); break;
                case 'ArrowRight': e.preventDefault(); this.mixer.nudgeCrossfader(5); break;
                case 'ArrowUp': e.preventDefault(); this.mixer.nudgeVolume(e.shiftKey ? 'B' : 'A', 5); break;
                case 'ArrowDown': e.preventDefault(); this.mixer.nudgeVolume(e.shiftKey ? 'B' : 'A', -5); break;
                case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
                case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8':
                    { const i = parseInt(e.code.replace('Digit', '')) - 1; (e.shiftKey ? this.decks.B : this.decks.A).triggerHotCue(i); }
                    break;
            }
        });
    }

    _initAudioContextResume() {
        const resumeOnce = () => {
            this.audioRouter.resume();
            document.removeEventListener('click', resumeOnce);
            document.removeEventListener('keydown', resumeOnce);
        };
        document.addEventListener('click', resumeOnce);
        document.addEventListener('keydown', resumeOnce);
    }

    _onLoadTrack(deckId, dataFile) {
        if (!deckId) {
            deckId = !this.decks.A.isLoaded ? 'A' : (!this.decks.B.isLoaded ? 'B' : 'A');
        }
        const deck = this.decks[deckId];
        if (!deck) return;

        this.audioRouter.resume();
        deck.loadTrack(dataFile);

        // Log to setlist
        this.setlist.logPlay(
            dataFile.split('/').pop().replace('.json', ''),
            ''
        );
    }

    _applyPlaylistFilter() {
        // Re-render library with playlist filter applied
        // The library will check playlists.activePlaylist to filter tracks
    }

    _initCrashRecovery() {
        if (this.crashRecovery.hasRecoveryData()) {
            const data = this.crashRecovery.getRecoveryData();
            if (data) {
                console.log('Recovery data available from', new Date(data.timestamp).toLocaleString());
                // Restore crossfader position
                if (data.crossfader != null) {
                    const cf = document.getElementById('crossfader');
                    if (cf) {
                        cf.value = data.crossfader;
                        this.audioRouter.setCrossfade(data.crossfader / 100);
                    }
                }
            }
        }

        // Start auto-saving
        this.crashRecovery.startAutoSave(() => {
            return {
                crossfader: parseFloat(document.getElementById('crossfader')?.value || 50),
                volumeA: parseFloat(document.getElementById('vol-a')?.value || 80),
                volumeB: parseFloat(document.getElementById('vol-b')?.value || 80),
                masterVolume: parseFloat(document.getElementById('master-volume')?.value || 80),
            };
        });
    }

    _loadSettings() {
        // Restore MIDI mappings
        const midiMappings = this.storage.loadMidiMappings();
        if (midiMappings && Object.keys(midiMappings).length > 0) {
            this.midi.mappings = midiMappings;
        }

        // Restore preferences
        const prefs = this.storage.loadPreferences();
        if (prefs.quantize) {
            this.decks.A.quantize = true;
            this.decks.B.quantize = true;
            document.getElementById('quantize-toggle')?.classList.add('active');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DJPlayer();
});
