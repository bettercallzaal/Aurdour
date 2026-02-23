// AudioRouter.js — Web Audio API graph for two-deck DJ mixing
// Routes: Deck Source → EQ (3-band) → Channel Gain → Crossfade Gain → Analyser → Master → Destination
// Cue bus: Pre-fader tap from each channel → cue gain → headphone output
// Booth: Master → booth gain → booth output
// Also: Mic → EQ → Gain → Analyser → Master
//       System Audio → Gain → Analyser → Master

export class AudioRouter {
    constructor() {
        this.ctx = new AudioContext();
        this.channels = {};
        this._sourceNodes = {};

        ['A', 'B'].forEach(id => {
            this.channels[id] = {
                eqLow: this._createEQ('lowshelf', 320),
                eqMid: this._createEQ('peaking', 1000),
                eqHigh: this._createEQ('highshelf', 3200),
                channelGain: this.ctx.createGain(),
                crossfadeGain: this.ctx.createGain(),
                analyser: this._createAnalyser(),
                pfl: false, // pre-fader listen
            };

            // Chain: eqLow → eqMid → eqHigh → channelGain → crossfadeGain → analyser
            const ch = this.channels[id];
            ch.eqLow.connect(ch.eqMid);
            ch.eqMid.connect(ch.eqHigh);
            ch.eqHigh.connect(ch.channelGain);
            ch.channelGain.connect(ch.crossfadeGain);
            ch.crossfadeGain.connect(ch.analyser);
        });

        // Master chain
        this.masterGain = this.ctx.createGain();
        this.masterAnalyser = this._createAnalyser();
        this.masterGain.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.ctx.destination);

        // Both channels → master
        this.channels.A.analyser.connect(this.masterGain);
        this.channels.B.analyser.connect(this.masterGain);

        // ===== BOOTH OUTPUT =====
        this.boothGain = this.ctx.createGain();
        this.boothGain.gain.value = 0.8;
        this.masterAnalyser.connect(this.boothGain);
        // boothGain connects to a separate destination if available (via setSinkId on an audio element)

        // ===== CUE / HEADPHONE BUS =====
        // Pre-fader listen: taps from before the crossfade gain
        this.cueGain = this.ctx.createGain();
        this.cueGain.gain.value = 0.8;
        this.cueMix = 0; // 0 = full cue, 1 = full master
        this.splitCue = false;

        // Cue mix: blend between cue bus and master
        this.cueMasterGain = this.ctx.createGain(); // master signal for headphones
        this.cueMasterGain.gain.value = 0;
        this.masterAnalyser.connect(this.cueMasterGain);

        // Cue output merger — combines cue + master for headphones
        this.cueOutput = this.ctx.createGain();
        this.cueGain.connect(this.cueOutput);
        this.cueMasterGain.connect(this.cueOutput);

        // Split cue: uses ChannelMerger to put cue=left, master=right
        this.splitMerger = this.ctx.createChannelMerger(2);
        // Will be connected when split cue is enabled

        // Headphone output element (for setSinkId routing)
        this._headphoneAudioEl = null;
        this._headphoneStream = null;
        this._headphoneDest = this.ctx.createMediaStreamDestination();
        this.cueOutput.connect(this._headphoneDest);

        // Default: crossfader center
        this.setCrossfade(0.5);
        this.masterGain.gain.value = 0.8;

        // ===== MIC CHANNEL =====
        this.mic = {
            stream: null,
            source: null,
            eqLow: this._createEQ('lowshelf', 320),
            eqMid: this._createEQ('peaking', 1000),
            eqHigh: this._createEQ('highshelf', 3200),
            gain: this.ctx.createGain(),
            analyser: this._createAnalyser(),
            muted: true,
        };
        this.mic.eqLow.connect(this.mic.eqMid);
        this.mic.eqMid.connect(this.mic.eqHigh);
        this.mic.eqHigh.connect(this.mic.gain);
        this.mic.gain.connect(this.mic.analyser);
        this.mic.analyser.connect(this.masterGain);
        this.mic.gain.gain.value = 0;

        // ===== SYSTEM AUDIO CHANNEL =====
        this.system = {
            stream: null,
            source: null,
            gain: this.ctx.createGain(),
            analyser: this._createAnalyser(),
            active: false,
        };
        this.system.gain.connect(this.system.analyser);
        this.system.analyser.connect(this.masterGain);
        this.system.gain.gain.value = 0.8;

        // ===== CROSSFADER CURVE =====
        this.crossfaderCurve = 'equal-power'; // equal-power, linear, cut
    }

    getAudioContext() {
        return this.ctx;
    }

    async resume() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    // ===== DECK ROUTING =====

    connectDeckSource(deckId, audioElement) {
        if (this._sourceNodes[deckId]) {
            try {
                this._sourceNodes[deckId].disconnect();
            } catch (e) { /* already disconnected */ }
        }
        const source = this.ctx.createMediaElementSource(audioElement);
        this._sourceNodes[deckId] = source;
        source.connect(this.channels[deckId].eqLow);
    }

    // ===== PFL / CUE =====

    setPFL(deckId, enabled) {
        const ch = this.channels[deckId];
        ch.pfl = enabled;

        if (enabled) {
            // Tap from after EQ but before crossfade (pre-fader listen)
            ch.channelGain.connect(this.cueGain);
        } else {
            try {
                ch.channelGain.disconnect(this.cueGain);
            } catch (e) {}
        }
    }

    setCueMix(value) {
        // 0 = full cue, 1 = full master
        this.cueMix = value;
        this.cueGain.gain.value = 0.8 * (1 - value);
        this.cueMasterGain.gain.value = 0.8 * value;
    }

    setCueVolume(level) {
        this.cueOutput.gain.value = level;
    }

    setSplitCue(enabled) {
        this.splitCue = enabled;

        // Disconnect current cue output
        this.cueOutput.disconnect();
        this.cueGain.disconnect();
        this.cueMasterGain.disconnect();

        if (enabled) {
            // Split: cue → left channel, master → right channel
            this.cueGain.connect(this.splitMerger, 0, 0);     // cue → left
            this.cueMasterGain.connect(this.splitMerger, 0, 1); // master → right
            this.splitMerger.connect(this._headphoneDest);
        } else {
            // Normal: cue + master mixed together
            this.cueGain.connect(this.cueOutput);
            this.cueMasterGain.connect(this.cueOutput);
            this.cueOutput.connect(this._headphoneDest);
        }
    }

    // Route headphone output to a specific audio device
    async setHeadphoneDevice(deviceId) {
        if (!this._headphoneAudioEl) {
            this._headphoneAudioEl = new Audio();
            this._headphoneAudioEl.srcObject = this._headphoneDest.stream;
        }

        try {
            if (this._headphoneAudioEl.setSinkId) {
                await this._headphoneAudioEl.setSinkId(deviceId);
                await this._headphoneAudioEl.play();
                return true;
            }
        } catch (e) {
            console.warn('Failed to set headphone device:', e);
        }
        return false;
    }

    // Get available audio output devices
    async getOutputDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(d => d.kind === 'audiooutput');
        } catch (e) {
            return [];
        }
    }

    // ===== BOOTH =====

    setBoothVolume(level) {
        this.boothGain.gain.value = level;
    }

    // ===== MIC =====

    async connectMic() {
        try {
            await this.resume();
            this.mic.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false,
                }
            });
            this.mic.source = this.ctx.createMediaStreamSource(this.mic.stream);
            this.mic.source.connect(this.mic.eqLow);
            return true;
        } catch (err) {
            console.error('Mic access denied:', err);
            return false;
        }
    }

    disconnectMic() {
        if (this.mic.source) {
            try { this.mic.source.disconnect(); } catch (e) {}
            this.mic.source = null;
        }
        if (this.mic.stream) {
            this.mic.stream.getTracks().forEach(t => t.stop());
            this.mic.stream = null;
        }
        this.mic.gain.gain.value = 0;
        this.mic.muted = true;
    }

    setMicVolume(level) {
        if (!this.mic.muted) {
            this.mic.gain.gain.value = level;
        }
    }

    setMicMute(muted) {
        this.mic.muted = muted;
        this.mic.gain.gain.value = muted ? 0 : (parseFloat(document.getElementById('mic-volume')?.value || 80) / 100);
    }

    setMicEQ(band, gainDB) {
        const key = `eq${band.charAt(0).toUpperCase() + band.slice(1)}`;
        this.mic[key].gain.value = gainDB;
    }

    getMicAnalyserData() {
        const data = new Uint8Array(this.mic.analyser.frequencyBinCount);
        this.mic.analyser.getByteFrequencyData(data);
        return data;
    }

    // ===== SYSTEM AUDIO =====

    async connectSystemAudio() {
        try {
            await this.resume();
            this.system.stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });

            this.system.stream.getVideoTracks().forEach(t => t.stop());

            const audioTracks = this.system.stream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('No audio track in screen share');
                return false;
            }

            const audioStream = new MediaStream(audioTracks);
            this.system.source = this.ctx.createMediaStreamSource(audioStream);
            this.system.source.connect(this.system.gain);
            this.system.active = true;

            audioTracks[0].onended = () => {
                this.disconnectSystemAudio();
            };

            return true;
        } catch (err) {
            console.error('System audio capture failed:', err);
            return false;
        }
    }

    disconnectSystemAudio() {
        if (this.system.source) {
            try { this.system.source.disconnect(); } catch (e) {}
            this.system.source = null;
        }
        if (this.system.stream) {
            this.system.stream.getTracks().forEach(t => t.stop());
            this.system.stream = null;
        }
        this.system.active = false;
    }

    setSystemVolume(level) {
        this.system.gain.gain.value = level;
    }

    getSystemAnalyserData() {
        const data = new Uint8Array(this.system.analyser.frequencyBinCount);
        this.system.analyser.getByteFrequencyData(data);
        return data;
    }

    // ===== CROSSFADER =====

    setCrossfade(position) {
        let gainA, gainB;

        switch (this.crossfaderCurve) {
            case 'linear':
                gainA = 1 - position;
                gainB = position;
                break;
            case 'cut':
                // Hard cut: full volume until very end
                gainA = position < 0.95 ? 1 : (1 - position) * 20;
                gainB = position > 0.05 ? 1 : position * 20;
                break;
            case 'equal-power':
            default:
                gainA = Math.cos(position * Math.PI / 2);
                gainB = Math.sin(position * Math.PI / 2);
                break;
        }

        this.channels.A.crossfadeGain.gain.value = gainA;
        this.channels.B.crossfadeGain.gain.value = gainB;
    }

    setCrossfaderCurve(curve) {
        this.crossfaderCurve = curve;
        // Re-apply current crossfader position
        const cf = document.getElementById('crossfader');
        if (cf) this.setCrossfade(cf.value / 100);
    }

    // ===== COMMON =====

    _createEQ(type, frequency) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.gain.value = 0;
        if (type === 'peaking') {
            filter.Q.value = 1.0;
        }
        return filter;
    }

    _createAnalyser() {
        const analyser = this.ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        return analyser;
    }

    setEQ(deckId, band, gainDB) {
        const key = `eq${band.charAt(0).toUpperCase() + band.slice(1)}`;
        this.channels[deckId][key].gain.value = gainDB;
    }

    setChannelVolume(deckId, level) {
        this.channels[deckId].channelGain.gain.value = level;
    }

    setMasterVolume(level) {
        this.masterGain.gain.value = level;
    }

    getAnalyserData(deckId) {
        const analyser = this.channels[deckId].analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        return data;
    }

    getMasterAnalyserData() {
        const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
        this.masterAnalyser.getByteFrequencyData(data);
        return data;
    }
}
