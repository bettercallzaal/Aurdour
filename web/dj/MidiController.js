// MidiController.js — Web MIDI API support for hardware DJ controllers
// Built-in Pioneer DDJ Serato mappings + MIDI learn fallback

const PIONEER_DDJ = {
    name: 'Pioneer DDJ',
    detect: (deviceName) => /pioneer|ddj|serato/i.test(deviceName),

    // Channel assignments
    CH_DECK1: 0,
    CH_DECK2: 1,
    CH_GLOBAL: 6,
    CH_PADS1: 7,
    CH_PADS2: 9,

    // Note numbers — Transport (channels 0/1)
    NOTE_PLAY: 0x0B,
    NOTE_CUE: 0x0C,
    NOTE_SYNC: 0x58,
    NOTE_PFL: 0x54,
    NOTE_SHIFT: 0x3F,

    // Note numbers — Global (channel 6)
    NOTE_LOAD_DECK1: 0x46,
    NOTE_LOAD_DECK2: 0x47,
    NOTE_BROWSE_PRESS: 0x41,
    NOTE_BACK: 0x42,

    // CC numbers — Per-deck (channels 0/1)
    CC_EQ_HIGH_MSB: 0x07,
    CC_EQ_MID_MSB: 0x0B,
    CC_EQ_LOW_MSB: 0x0F,
    CC_EQ_HIGH_LSB: 0x27,
    CC_EQ_MID_LSB: 0x2B,
    CC_EQ_LOW_LSB: 0x2F,
    CC_VOL_MSB: 0x13,
    CC_VOL_LSB: 0x33,
    CC_TEMPO_MSB: 0x00,
    CC_TEMPO_LSB: 0x20,
    CC_FILTER_MSB: 0x17,
    CC_FILTER_LSB: 0x37,
    CC_JOG_VINYL: 0x22,
    CC_JOG_RING: 0x21,

    // CC numbers — Global (channel 6)
    CC_CROSSFADER_MSB: 0x1F,
    CC_CROSSFADER_LSB: 0x3F,
    CC_MASTER_VOL_MSB: 0x0D,
    CC_MASTER_VOL_LSB: 0x2D,
    CC_BOOTH_VOL_MSB: 0x11,
    CC_BOOTH_VOL_LSB: 0x31,
    CC_HEADPHONE_MIX_MSB: 0x0E,
    CC_HEADPHONE_MIX_LSB: 0x2E,
    CC_HEADPHONE_VOL_MSB: 0x10,
    CC_HEADPHONE_VOL_LSB: 0x30,
    CC_BROWSE: 0x40,

    // Hot cue pad notes (channels 7/9)
    PAD_HOTCUE_BASE: 0x00, // 0x00–0x07
};

export class MidiController {
    constructor(djPlayer) {
        this.dj = djPlayer;
        this.midiAccess = null;
        this.connected = false;
        this.devices = [];
        this.learning = false;
        this.learnTarget = null;
        this.activeProfile = null;

        // Manual MIDI learn mappings: { 'channel_cc': 'action' }
        this.mappings = {};

        // 14-bit MSB/LSB state per channel
        this._msbState = {};

        // Jog wheel state
        this._jogTouch = { A: false, B: false };

        // Shift key state per deck
        this._shift = { 0: false, 1: false };

        // LED output (if available)
        this._outputs = [];

        this._initUI();
        this._requestMIDI();
    }

    async _requestMIDI() {
        if (!navigator.requestMIDIAccess) {
            console.log('Web MIDI not supported in this browser');
            this._updateStatus('Not supported');
            return;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            this._onMIDISuccess();
            this.midiAccess.onstatechange = () => this._onMIDISuccess();
        } catch (err) {
            console.warn('MIDI access denied:', err);
            this._updateStatus('Denied');
        }
    }

    _onMIDISuccess() {
        this.devices = [];
        this._outputs = [];

        this.midiAccess.inputs.forEach(input => {
            this.devices.push(input.name);
            input.onmidimessage = (msg) => this._onMIDIMessage(msg);
        });

        this.midiAccess.outputs.forEach(output => {
            this._outputs.push(output);
        });

        if (this.devices.length > 0) {
            this.connected = true;
            const name = this.devices[0];
            this._updateStatus(name);

            // Auto-detect Pioneer DDJ
            if (PIONEER_DDJ.detect(name)) {
                this.activeProfile = 'pioneer-ddj';
                this._updateStatus(`${name} ✓`);
                console.log('Pioneer DDJ detected — using built-in mappings');
            }
        } else {
            this.connected = false;
            this.activeProfile = null;
            this._updateStatus('No device');
        }

        this._renderDeviceList();
    }

    _onMIDIMessage(msg) {
        const [status, data1, data2] = msg.data;
        const channel = status & 0x0F;
        const type = status & 0xF0;

        // MIDI Learn mode — intercept
        if (this.learning && this.learnTarget) {
            const key = `${channel}_${data1}_${type === 0xB0 ? 'cc' : 'note'}`;
            this.mappings[key] = this.learnTarget;
            this.learning = false;
            this.learnTarget = null;
            this._updateStatus('Mapped!');
            setTimeout(() => this._updateStatus(this.devices[0] || 'Connected'), 1000);
            return;
        }

        // Pioneer DDJ built-in profile
        if (this.activeProfile === 'pioneer-ddj') {
            this._handlePioneerDDJ(type, channel, data1, data2);
            return;
        }

        // Fallback: custom mappings
        this._handleCustomMapping(type, channel, data1, data2);
    }

    // ── Pioneer DDJ Handler ─────────────────────────────────────

    _handlePioneerDDJ(type, channel, data1, data2) {
        const P = PIONEER_DDJ;
        const deckId = channel === P.CH_DECK1 ? 'A' : channel === P.CH_DECK2 ? 'B' : null;

        // Note On
        if (type === 0x90 && data2 > 0) {
            // Transport — Deck channels (0/1)
            if (deckId) {
                switch (data1) {
                    case P.NOTE_PLAY: this._deckAction(deckId, 'playPause'); return;
                    case P.NOTE_CUE: this._deckAction(deckId, 'cue'); return;
                    case P.NOTE_SYNC: this._deckAction(deckId, 'sync'); return;
                    case P.NOTE_PFL: this._togglePFL(deckId); return;
                    case P.NOTE_SHIFT: this._shift[channel] = true; return;
                }
            }

            // Hot cue pads — channels 7 (deck1) / 9 (deck2)
            if (channel === P.CH_PADS1 || channel === P.CH_PADS2) {
                const padDeck = channel === P.CH_PADS1 ? 'A' : 'B';
                if (data1 >= P.PAD_HOTCUE_BASE && data1 <= P.PAD_HOTCUE_BASE + 7) {
                    const padIdx = data1 - P.PAD_HOTCUE_BASE;
                    this._deckAction(padDeck, 'hotcue', padIdx);
                    return;
                }
            }

            // Global channel (6)
            if (channel === P.CH_GLOBAL) {
                switch (data1) {
                    case P.NOTE_LOAD_DECK1: this._loadToDeck('A'); return;
                    case P.NOTE_LOAD_DECK2: this._loadToDeck('B'); return;
                    case P.NOTE_BROWSE_PRESS: /* browse push — select track */ return;
                    case P.NOTE_BACK: /* back button */ return;
                }
            }
        }

        // Note Off / Note On velocity 0
        if (type === 0x80 || (type === 0x90 && data2 === 0)) {
            if (deckId && data1 === P.NOTE_SHIFT) {
                this._shift[channel] = false;
                return;
            }
        }

        // Control Change
        if (type === 0xB0) {
            // Per-deck CCs (channels 0/1)
            if (deckId) {
                this._handleDeckCC(deckId, channel, data1, data2);
                return;
            }

            // Global CCs (channel 6)
            if (channel === P.CH_GLOBAL) {
                this._handleGlobalCC(data1, data2);
                return;
            }
        }
    }

    _handleDeckCC(deckId, channel, cc, value) {
        const P = PIONEER_DDJ;
        const router = this.dj.audioRouter;
        if (!router) return;

        switch (cc) {
            // 14-bit EQ High
            case P.CC_EQ_HIGH_MSB: this._storeMSB(channel, cc, value); this._apply14bitEQ(deckId, channel, cc, 'high'); return;
            case P.CC_EQ_HIGH_LSB: this._apply14bitEQ(deckId, channel, P.CC_EQ_HIGH_MSB, 'high', value); return;

            // 14-bit EQ Mid
            case P.CC_EQ_MID_MSB: this._storeMSB(channel, cc, value); this._apply14bitEQ(deckId, channel, cc, 'mid'); return;
            case P.CC_EQ_MID_LSB: this._apply14bitEQ(deckId, channel, P.CC_EQ_MID_MSB, 'mid', value); return;

            // 14-bit EQ Low
            case P.CC_EQ_LOW_MSB: this._storeMSB(channel, cc, value); this._apply14bitEQ(deckId, channel, cc, 'low'); return;
            case P.CC_EQ_LOW_LSB: this._apply14bitEQ(deckId, channel, P.CC_EQ_LOW_MSB, 'low', value); return;

            // 14-bit Volume fader
            case P.CC_VOL_MSB: this._storeMSB(channel, cc, value); this._apply14bitVolume(deckId, channel, cc); return;
            case P.CC_VOL_LSB: this._apply14bitVolume(deckId, channel, P.CC_VOL_MSB, value); return;

            // 14-bit Tempo slider
            case P.CC_TEMPO_MSB: this._storeMSB(channel, cc, value); this._apply14bitTempo(deckId, channel, cc); return;
            case P.CC_TEMPO_LSB: this._apply14bitTempo(deckId, channel, P.CC_TEMPO_MSB, value); return;

            // Jog wheel — vinyl surface (scratch)
            case P.CC_JOG_VINYL: this._handleJogWheel(deckId, value, true); return;

            // Jog wheel — outer ring (pitch bend)
            case P.CC_JOG_RING: this._handleJogWheel(deckId, value, false); return;

            // Filter knob
            case P.CC_FILTER_MSB: this._storeMSB(channel, cc, value); return;
            case P.CC_FILTER_LSB: /* filter implementation */ return;
        }
    }

    _handleGlobalCC(cc, value) {
        const P = PIONEER_DDJ;
        const router = this.dj.audioRouter;
        if (!router) return;

        switch (cc) {
            // 14-bit Crossfader
            case P.CC_CROSSFADER_MSB:
                this._storeMSB(P.CH_GLOBAL, cc, value);
                this._apply14bitCrossfader(value);
                return;
            case P.CC_CROSSFADER_LSB:
                this._apply14bitCrossfader(null, value);
                return;

            // 14-bit Master volume
            case P.CC_MASTER_VOL_MSB:
                this._storeMSB(P.CH_GLOBAL, cc, value);
                this._apply14bitMaster(value);
                return;
            case P.CC_MASTER_VOL_LSB:
                this._apply14bitMaster(null, value);
                return;

            // 14-bit Headphone mix (cue/master)
            case P.CC_HEADPHONE_MIX_MSB:
                this._storeMSB(P.CH_GLOBAL, cc, value);
                this._apply14bitCueMix(value);
                return;
            case P.CC_HEADPHONE_MIX_LSB:
                this._apply14bitCueMix(null, value);
                return;

            // 14-bit Headphone volume
            case P.CC_HEADPHONE_VOL_MSB:
                this._storeMSB(P.CH_GLOBAL, cc, value);
                return;
            case P.CC_HEADPHONE_VOL_LSB:
                return;

            // Browse encoder (relative, centered at 64)
            case P.CC_BROWSE:
                this._handleBrowseEncoder(value);
                return;
        }
    }

    // ── 14-bit MSB/LSB Helpers ──────────────────────────────────

    _storeMSB(channel, cc, value) {
        this._msbState[`${channel}_${cc}`] = value;
    }

    _get14bit(channel, msbCC, lsb) {
        const msb = this._msbState[`${channel}_${msbCC}`] || 0;
        const lsbVal = (lsb != null) ? lsb : 0;
        return ((msb << 7) | lsbVal) / 16383; // normalized 0–1
    }

    _apply14bitEQ(deckId, channel, msbCC, band, lsb) {
        const normalized = this._get14bit(channel, msbCC, lsb);
        // Map 0–1 to -24dB to +6dB
        const db = normalized * 30 - 24;
        const router = this.dj.audioRouter;
        if (router) router.setEQ(deckId, band, db);

        // Update UI knob
        const knobId = `eq-${deckId.toLowerCase()}-${band}`;
        const knob = document.getElementById(knobId);
        if (knob) knob.value = normalized * 100;
    }

    _apply14bitVolume(deckId, channel, msbCC, lsb) {
        const normalized = this._get14bit(channel, msbCC, lsb);
        const router = this.dj.audioRouter;
        if (router) router.setChannelVolume(deckId, normalized);

        const slider = document.getElementById(`vol-${deckId.toLowerCase()}`);
        if (slider) slider.value = normalized * 100;
    }

    _apply14bitTempo(deckId, channel, msbCC, lsb) {
        const normalized = this._get14bit(channel, msbCC, lsb);
        // Map 0–1 to tempo range: ±8% (typical Serato range)
        // 0.5 = center (no change), 0 = -8%, 1 = +8%
        const tempoAdjust = (normalized - 0.5) * 0.16;
        const deck = this.dj.decks?.[deckId];
        if (deck && deck.baseBPM) {
            const newRate = 1 + tempoAdjust;
            deck.setPlaybackRate(newRate);
        }
    }

    _apply14bitCrossfader(msb, lsb) {
        const P = PIONEER_DDJ;
        if (msb != null) this._storeMSB(P.CH_GLOBAL, P.CC_CROSSFADER_MSB, msb);
        const normalized = this._get14bit(P.CH_GLOBAL, P.CC_CROSSFADER_MSB, lsb);
        const router = this.dj.audioRouter;
        if (router) router.setCrossfade(normalized);

        const slider = document.getElementById('crossfader');
        if (slider) slider.value = normalized * 100;
    }

    _apply14bitMaster(msb, lsb) {
        const P = PIONEER_DDJ;
        if (msb != null) this._storeMSB(P.CH_GLOBAL, P.CC_MASTER_VOL_MSB, msb);
        const normalized = this._get14bit(P.CH_GLOBAL, P.CC_MASTER_VOL_MSB, lsb);
        const router = this.dj.audioRouter;
        if (router) router.setMasterVolume(normalized);

        const slider = document.getElementById('master-vol');
        if (slider) slider.value = normalized * 100;
    }

    _apply14bitCueMix(msb, lsb) {
        const P = PIONEER_DDJ;
        if (msb != null) this._storeMSB(P.CH_GLOBAL, P.CC_HEADPHONE_MIX_MSB, msb);
        const normalized = this._get14bit(P.CH_GLOBAL, P.CC_HEADPHONE_MIX_MSB, lsb);
        const router = this.dj.audioRouter;
        if (router) router.setCueMix(normalized);

        const slider = document.getElementById('cue-mix');
        if (slider) slider.value = normalized * 100;
    }

    // ── Deck Actions ────────────────────────────────────────────

    _deckAction(deckId, action, param) {
        const deck = this.dj.decks?.[deckId];
        if (!deck) return;

        switch (action) {
            case 'playPause': deck.playPause(); break;
            case 'cue': deck.cue(); break;
            case 'sync': {
                const otherDeck = deckId === 'A' ? 'B' : 'A';
                const bpm = this.dj.decks[otherDeck]?.getBPM();
                if (bpm) deck.syncTo(bpm);
                break;
            }
            case 'hotcue': deck.triggerHotCue(param); break;
        }
    }

    _togglePFL(deckId) {
        const btn = document.getElementById(`pfl-${deckId.toLowerCase()}`);
        if (btn) btn.click();
    }

    _loadToDeck(deckId) {
        // Load the currently selected/highlighted track in the library
        const library = this.dj.library;
        if (library && library.selectedTrack) {
            library.loadToDeck(library.selectedTrack, deckId);
        }
    }

    // ── Jog Wheel ───────────────────────────────────────────────

    _handleJogWheel(deckId, value, isVinyl) {
        // Relative encoding: 64 = stationary, <64 = backward, >64 = forward
        // Values wrap: 1 = slow forward, 127 = slow backward
        let delta;
        if (value >= 64) {
            delta = value - 64;   // forward
        } else {
            delta = value - 64;   // backward (negative)
        }

        if (delta === 0) return;

        const jogWheel = this.dj.jogWheel;
        if (jogWheel) {
            // Scale delta for sensitivity
            const scaledDelta = delta / 64; // -1 to +1 range
            if (isVinyl) {
                jogWheel.scratch(deckId, scaledDelta);
            } else {
                jogWheel.nudge(deckId, scaledDelta * 0.02);
            }
        } else {
            // Fallback: direct pitch bend
            const deck = this.dj.decks?.[deckId];
            if (deck) {
                const nudgeAmount = delta * 0.001;
                const current = deck.ws?.getPlaybackRate() || 1;
                deck.ws?.setPlaybackRate(current + nudgeAmount);
                // Reset after brief moment
                clearTimeout(this._jogResetTimer);
                this._jogResetTimer = setTimeout(() => {
                    if (deck.ws) deck.ws.setPlaybackRate(deck.baseBPM ? (deck.ws.getPlaybackRate()) : 1);
                }, 100);
            }
        }
    }

    // ── Browse Encoder ──────────────────────────────────────────

    _handleBrowseEncoder(value) {
        // Relative encoding: 64 = no movement
        const delta = value < 64 ? value : value - 128; // signed
        const library = this.dj.library;
        if (library) {
            if (delta > 0) {
                library.selectNext();
            } else if (delta < 0) {
                library.selectPrev();
            }
        }
    }

    // ── Custom Mapping Fallback ─────────────────────────────────

    _handleCustomMapping(type, channel, data1, data2) {
        const noteKey = `${channel}_${data1}_note`;
        const ccKey = `${channel}_${data1}_cc`;

        if (type === 0x90 && data2 > 0) {
            const action = this.mappings[noteKey];
            if (action) this._executeAction(action, 'press');
        } else if (type === 0x80 || (type === 0x90 && data2 === 0)) {
            const action = this.mappings[noteKey];
            if (action) this._executeAction(action, 'release');
        } else if (type === 0xB0) {
            const action = this.mappings[ccKey];
            if (action) this._executeAction(action, 'cc', data2 / 127);
        }
    }

    _executeAction(action, type, value = 0) {
        const router = this.dj.audioRouter;

        switch (action) {
            case 'deckA.play': if (type === 'press') this.dj.decks?.A?.playPause(); break;
            case 'deckA.cue': if (type === 'press') this.dj.decks?.A?.cue(); break;
            case 'deckA.sync': if (type === 'press') { const bpm = this.dj.decks?.B?.getBPM(); if (bpm) this.dj.decks.A.syncTo(bpm); } break;
            case 'deckA.pad1': case 'deckA.pad2': case 'deckA.pad3': case 'deckA.pad4':
            case 'deckA.pad5': case 'deckA.pad6': case 'deckA.pad7': case 'deckA.pad8':
                if (type === 'press') { const idx = parseInt(action.slice(-1)) - 1; this.dj.decks?.A?.triggerHotCue(idx); }
                break;

            case 'deckB.play': if (type === 'press') this.dj.decks?.B?.playPause(); break;
            case 'deckB.cue': if (type === 'press') this.dj.decks?.B?.cue(); break;
            case 'deckB.sync': if (type === 'press') { const bpm = this.dj.decks?.A?.getBPM(); if (bpm) this.dj.decks.B.syncTo(bpm); } break;
            case 'deckB.pad1': case 'deckB.pad2': case 'deckB.pad3': case 'deckB.pad4':
            case 'deckB.pad5': case 'deckB.pad6': case 'deckB.pad7': case 'deckB.pad8':
                if (type === 'press') { const idx = parseInt(action.slice(-1)) - 1; this.dj.decks?.B?.triggerHotCue(idx); }
                break;

            case 'crossfader': if (type === 'cc' && router) { const cf = document.getElementById('crossfader'); if (cf) { cf.value = value * 100; router.setCrossfade(value); } } break;
            case 'volA': if (type === 'cc' && router) { const va = document.getElementById('vol-a'); if (va) { va.value = value * 100; router.setChannelVolume('A', value); } } break;
            case 'volB': if (type === 'cc' && router) { const vb = document.getElementById('vol-b'); if (vb) { vb.value = value * 100; router.setChannelVolume('B', value); } } break;
            case 'eqA.high': if (type === 'cc' && router) router.setEQ('A', 'high', value * 30 - 24); break;
            case 'eqA.mid': if (type === 'cc' && router) router.setEQ('A', 'mid', value * 30 - 24); break;
            case 'eqA.low': if (type === 'cc' && router) router.setEQ('A', 'low', value * 30 - 24); break;
            case 'eqB.high': if (type === 'cc' && router) router.setEQ('B', 'high', value * 30 - 24); break;
            case 'eqB.mid': if (type === 'cc' && router) router.setEQ('B', 'mid', value * 30 - 24); break;
            case 'eqB.low': if (type === 'cc' && router) router.setEQ('B', 'low', value * 30 - 24); break;
            case 'mic.mute': if (type === 'press' && router) { const m = router.mic?.muted; router.setMicMute(!m); } break;
        }
    }

    // ── MIDI Learn ──────────────────────────────────────────────

    startLearn(target) {
        this.learning = true;
        this.learnTarget = target;
        this._updateStatus('Move a control...');
    }

    // ── LED Feedback ────────────────────────────────────────────

    sendLED(channel, note, velocity) {
        if (this._outputs.length === 0) return;
        const output = this._outputs[0];
        output.send([0x90 | channel, note, velocity]);
    }

    // ── UI ──────────────────────────────────────────────────────

    _updateStatus(text) {
        const el = document.getElementById('midi-status');
        if (el) el.textContent = text;
    }

    _renderDeviceList() {
        const el = document.getElementById('midi-devices');
        if (!el) return;
        el.textContent = '';
        if (this.devices.length) {
            this.devices.forEach(d => {
                const span = document.createElement('span');
                span.className = 'midi-device';
                span.textContent = d;
                if (this.activeProfile === 'pioneer-ddj' && PIONEER_DDJ.detect(d)) {
                    span.textContent += ' (Auto-mapped)';
                    span.style.color = '#00ff88';
                }
                el.appendChild(span);
            });
        } else {
            const span = document.createElement('span');
            span.className = 'midi-none';
            span.textContent = 'No MIDI devices';
            el.appendChild(span);
        }
    }

    _initUI() {
        const learnBtn = document.getElementById('midi-learn');
        if (learnBtn) {
            learnBtn.addEventListener('click', () => {
                const targets = [
                    'crossfader', 'volA', 'volB',
                    'deckA.play', 'deckB.play',
                    'deckA.cue', 'deckB.cue',
                    'eqA.high', 'eqA.mid', 'eqA.low',
                    'eqB.high', 'eqB.mid', 'eqB.low',
                ];
                const current = learnBtn.dataset.targetIdx || 0;
                const target = targets[current % targets.length];
                learnBtn.dataset.targetIdx = (parseInt(current) + 1) % targets.length;
                this.startLearn(target);
                learnBtn.textContent = `LEARN: ${target}`;
            });
        }
    }

    // ── Export/Import Mappings ───────────────────────────────────

    exportMappings() {
        return JSON.stringify(this.mappings, null, 2);
    }

    importMappings(json) {
        try {
            this.mappings = JSON.parse(json);
        } catch (e) {
            console.warn('Invalid MIDI mapping JSON:', e);
        }
    }
}
