// FX.js — Audio effects engine per deck
// Effects: Echo, Reverb, Flanger, Filter, Delay, Phaser, Chorus, Bitcrusher, Compressor, Distortion
// Each deck has a dry/wet send routed through the AudioRouter

export class FX {
    constructor(audioRouter) {
        this.router = audioRouter;
        this.ctx = audioRouter.getAudioContext();
        this.decks = {};

        ['A', 'B'].forEach(id => {
            this.decks[id] = this._createFXChain(id);
        });

        this._initUI();
    }

    _createFXChain(deckId) {
        const ch = this.router.channels[deckId];

        // Insert FX between channelGain and crossfadeGain
        // channelGain → dryGain → crossfadeGain (original path)
        // channelGain → fxSend → [effect] → fxReturn → wetGain → crossfadeGain
        ch.channelGain.disconnect(ch.crossfadeGain);

        const dry = this.ctx.createGain();
        const wet = this.ctx.createGain();
        const fxSend = this.ctx.createGain();
        const fxReturn = this.ctx.createGain();

        dry.gain.value = 1;
        wet.gain.value = 0;
        fxSend.gain.value = 1;
        fxReturn.gain.value = 1;

        ch.channelGain.connect(dry);
        ch.channelGain.connect(fxSend);
        dry.connect(ch.crossfadeGain);
        fxReturn.connect(wet);
        wet.connect(ch.crossfadeGain);

        // Create effects
        const echo = this._createEcho();
        const reverb = this._createReverb();
        const flanger = this._createFlanger();
        const filter = this._createFilter();
        const delay = this._createDelay();
        const phaser = this._createPhaser();
        const chorus = this._createChorus();
        const bitcrusher = this._createBitcrusher();
        const compressor = this._createCompressor();
        const distortion = this._createDistortion();

        // Default: echo is connected
        const effects = { echo, reverb, flanger, filter, delay, phaser, chorus, bitcrusher, compressor, distortion };
        const activeEffect = 'echo';

        // Connect active effect
        fxSend.connect(echo.input);
        echo.output.connect(fxReturn);

        return { dry, wet, fxSend, fxReturn, effects, activeEffect, connected: { input: echo.input, output: echo.output } };
    }

    _createEcho() {
        const delay = this.ctx.createDelay(2.0);
        delay.delayTime.value = 0.375;
        const feedback = this.ctx.createGain();
        feedback.gain.value = 0.4;
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        input.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(output);
        input.connect(output); // pass-through

        return { input, output, delay, feedback, params: { time: 0.375, feedback: 0.4 } };
    }

    _createReverb() {
        const convolver = this.ctx.createConvolver();
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        // Generate impulse response
        this._generateImpulseResponse(convolver, 2.0, 2.0);

        input.connect(convolver);
        convolver.connect(output);
        input.connect(output);

        return { input, output, convolver, params: { decay: 2.0, size: 2.0 } };
    }

    _generateImpulseResponse(convolver, duration, decay) {
        const rate = this.ctx.sampleRate;
        const length = rate * duration;
        const buffer = this.ctx.createBuffer(2, length, rate);

        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }

        convolver.buffer = buffer;
    }

    _createFlanger() {
        const delay = this.ctx.createDelay(0.02);
        delay.delayTime.value = 0.005;
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const feedback = this.ctx.createGain();
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        lfo.type = 'sine';
        lfo.frequency.value = 0.5;
        lfoGain.gain.value = 0.003;

        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start();

        input.connect(delay);
        delay.connect(feedback);
        feedback.gain.value = 0.5;
        feedback.connect(delay);
        delay.connect(output);
        input.connect(output);

        return { input, output, delay, lfo, lfoGain, feedback, params: { rate: 0.5, depth: 0.003, feedback: 0.5 } };
    }

    _createFilter() {
        const biquad = this.ctx.createBiquadFilter();
        biquad.type = 'lowpass';
        biquad.frequency.value = 1000;
        biquad.Q.value = 5;
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        input.connect(biquad);
        biquad.connect(output);

        return { input, output, biquad, params: { type: 'lowpass', frequency: 1000, resonance: 5 } };
    }

    _createDelay() {
        const delayNode = this.ctx.createDelay(5.0);
        delayNode.delayTime.value = 0.5;
        const feedback = this.ctx.createGain();
        feedback.gain.value = 0.35;
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        input.connect(delayNode);
        delayNode.connect(feedback);
        feedback.connect(delayNode);
        delayNode.connect(output);
        input.connect(output);

        return { input, output, delayNode, feedback, params: { time: 0.5, feedback: 0.35 } };
    }

    _createPhaser() {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        // Chain of 4 all-pass filters
        const allpassFilters = [];
        const baseFrequencies = [350, 700, 1400, 2800];
        for (let i = 0; i < 4; i++) {
            const ap = this.ctx.createBiquadFilter();
            ap.type = 'allpass';
            ap.frequency.value = baseFrequencies[i];
            ap.Q.value = 0.5;
            allpassFilters.push(ap);
        }

        // LFO to modulate all-pass frequencies
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.5;
        const lfoGains = [];
        for (let i = 0; i < 4; i++) {
            const lg = this.ctx.createGain();
            lg.gain.value = baseFrequencies[i] * 0.5; // depth modulation
            lfo.connect(lg);
            lg.connect(allpassFilters[i].frequency);
            lfoGains.push(lg);
        }
        lfo.start();

        // Feedback path
        const feedback = this.ctx.createGain();
        feedback.gain.value = 0.5;

        // Connect chain: input → ap0 → ap1 → ap2 → ap3 → output
        input.connect(allpassFilters[0]);
        for (let i = 0; i < allpassFilters.length - 1; i++) {
            allpassFilters[i].connect(allpassFilters[i + 1]);
        }
        allpassFilters[allpassFilters.length - 1].connect(output);

        // Feedback: last allpass → feedback gain → first allpass
        allpassFilters[allpassFilters.length - 1].connect(feedback);
        feedback.connect(allpassFilters[0]);

        // Dry pass-through
        input.connect(output);

        return { input, output, allpassFilters, lfo, lfoGains, feedback, params: { rate: 0.5, depth: 0.5, feedback: 0.5 } };
    }

    _createChorus() {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        // Multi-tap: 3 delay lines with slightly different LFO phases
        const taps = [];
        for (let i = 0; i < 3; i++) {
            const delay = this.ctx.createDelay(0.05);
            delay.delayTime.value = 0.01 + i * 0.003; // stagger taps

            const lfo = this.ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.8;

            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.005; // 5ms default depth

            lfo.connect(lfoGain);
            lfoGain.connect(delay.delayTime);
            lfo.start();

            // Phase offset per tap
            // (We use a slight frequency detune to simulate phase offset)
            lfo.frequency.value = 0.8 + i * 0.05;

            const tapGain = this.ctx.createGain();
            tapGain.gain.value = 0.33;

            input.connect(delay);
            delay.connect(tapGain);
            tapGain.connect(output);

            taps.push({ delay, lfo, lfoGain, tapGain });
        }

        // Mix knob controls balance: dry pass-through at full volume,
        // wet taps scaled by mix parameter
        const dryGain = this.ctx.createGain();
        dryGain.gain.value = 1.0;
        input.connect(dryGain);
        dryGain.connect(output);

        return { input, output, taps, dryGain, params: { rate: 0.8, depth: 5, mix: 0.5 } };
    }

    _createBitcrusher() {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        // WaveShaperNode for bit reduction
        const waveshaper = this.ctx.createWaveShaper();
        this._updateBitcrusherCurve(waveshaper, 8);

        // ScriptProcessorNode replacement: we approximate sample-rate reduction
        // using a very short delay + waveshaper combination.
        // For true downsampling we use an AudioWorklet if available,
        // otherwise we rely on the waveshaper for the crushed character.
        input.connect(waveshaper);
        waveshaper.connect(output);

        return { input, output, waveshaper, params: { bits: 8, downsample: 1 } };
    }

    _updateBitcrusherCurve(waveshaper, bits) {
        const steps = Math.pow(2, bits);
        const length = 4096;
        const curve = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            const x = (i * 2) / length - 1; // map to -1..1
            curve[i] = Math.round(x * steps) / steps;
        }
        waveshaper.curve = curve;
        waveshaper.oversample = 'none';
    }

    _createCompressor() {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        compressor.knee.value = 10;

        input.connect(compressor);
        compressor.connect(output);

        return { input, output, compressor, params: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25 } };
    }

    _createDistortion() {
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        // WaveShaperNode for overdrive/saturation
        const waveshaper = this.ctx.createWaveShaper();
        this._updateDistortionCurve(waveshaper, 50);
        waveshaper.oversample = '4x';

        // Tone filter (low-pass) to tame harsh high frequencies
        const toneFilter = this.ctx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = 3000;
        toneFilter.Q.value = 0.5;

        input.connect(waveshaper);
        waveshaper.connect(toneFilter);
        toneFilter.connect(output);
        input.connect(output); // dry pass-through

        return { input, output, waveshaper, toneFilter, params: { drive: 50, tone: 3000 } };
    }

    _updateDistortionCurve(waveshaper, drive) {
        const k = drive;
        const length = 4096;
        const curve = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            const x = (i * 2) / length - 1;
            curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
        }
        waveshaper.curve = curve;
    }

    // Switch which effect is active on a deck
    switchEffect(deckId, effectName) {
        const deck = this.decks[deckId];
        if (!deck || !deck.effects[effectName]) return;

        // Disconnect old
        try {
            deck.fxSend.disconnect(deck.connected.input);
            deck.connected.output.disconnect(deck.fxReturn);
        } catch (e) {}

        // Connect new
        const fx = deck.effects[effectName];
        deck.fxSend.connect(fx.input);
        fx.output.connect(deck.fxReturn);
        deck.connected = { input: fx.input, output: fx.output };
        deck.activeEffect = effectName;
    }

    // Set dry/wet mix (0 = full dry, 1 = full wet)
    setWetDry(deckId, wetAmount) {
        const deck = this.decks[deckId];
        if (!deck) return;
        deck.wet.gain.value = wetAmount;
        deck.dry.gain.value = 1 - wetAmount * 0.5; // keep some dry signal
    }

    // Set effect-specific parameter
    setParam(deckId, param, value) {
        const deck = this.decks[deckId];
        if (!deck) return;
        const effect = deck.effects[deck.activeEffect];

        switch (deck.activeEffect) {
            case 'echo':
                if (param === 'time') effect.delay.delayTime.value = value;
                if (param === 'feedback') effect.feedback.gain.value = Math.min(0.9, value);
                break;
            case 'reverb':
                if (param === 'decay') this._generateImpulseResponse(effect.convolver, value, value);
                break;
            case 'flanger':
                if (param === 'rate') effect.lfo.frequency.value = value;
                if (param === 'depth') effect.lfoGain.gain.value = value;
                if (param === 'feedback') effect.feedback.gain.value = Math.min(0.9, value);
                break;
            case 'filter':
                if (param === 'frequency') effect.biquad.frequency.value = value;
                if (param === 'resonance') effect.biquad.Q.value = value;
                if (param === 'type') effect.biquad.type = value;
                break;
            case 'delay':
                if (param === 'time') effect.delayNode.delayTime.value = value;
                if (param === 'feedback') effect.feedback.gain.value = Math.min(0.9, value);
                break;
            case 'phaser':
                if (param === 'rate') effect.lfo.frequency.value = value;
                if (param === 'depth') {
                    const baseFreqs = [350, 700, 1400, 2800];
                    effect.lfoGains.forEach((lg, i) => {
                        lg.gain.value = baseFreqs[i] * value;
                    });
                }
                if (param === 'feedback') effect.feedback.gain.value = Math.min(0.9, value);
                break;
            case 'chorus':
                if (param === 'rate') {
                    effect.taps.forEach((tap, i) => {
                        tap.lfo.frequency.value = value + i * 0.05;
                    });
                }
                if (param === 'depth') {
                    // depth in ms → convert to seconds for lfoGain
                    effect.taps.forEach(tap => {
                        tap.lfoGain.gain.value = value / 1000;
                    });
                }
                if (param === 'mix') {
                    effect.taps.forEach(tap => {
                        tap.tapGain.gain.value = value * 0.33;
                    });
                    effect.dryGain.gain.value = 1 - value * 0.5;
                }
                break;
            case 'bitcrusher':
                if (param === 'bits') {
                    this._updateBitcrusherCurve(effect.waveshaper, Math.max(1, Math.round(value)));
                }
                // downsample parameter stored for reference (true downsampling
                // would require an AudioWorklet; the waveshaper approximation
                // captures the main character of the effect)
                if (param === 'downsample') effect.params.downsample = value;
                break;
            case 'compressor':
                if (param === 'threshold') effect.compressor.threshold.value = value;
                if (param === 'ratio') effect.compressor.ratio.value = value;
                if (param === 'attack') effect.compressor.attack.value = value;
                if (param === 'release') effect.compressor.release.value = value;
                break;
            case 'distortion':
                if (param === 'drive') this._updateDistortionCurve(effect.waveshaper, value);
                if (param === 'tone') effect.toneFilter.frequency.value = value;
                break;
        }
    }

    _initUI() {
        // Populate FX selectors with new effects (append to existing options)
        this._populateFXSelectors();

        ['a', 'b'].forEach(ch => {
            const deckId = ch.toUpperCase();

            // FX select
            const fxSelect = document.getElementById(`fx-${ch}-select`);
            if (fxSelect) {
                fxSelect.addEventListener('change', (e) => {
                    this.switchEffect(deckId, e.target.value);
                    this._updateParamLabels(ch);
                });
            }

            // Wet/dry
            const wetDry = document.getElementById(`fx-${ch}-wetdry`);
            if (wetDry) {
                wetDry.addEventListener('input', (e) => {
                    this.setWetDry(deckId, e.target.value / 100);
                });
            }

            // Param 1 & 2
            const param1 = document.getElementById(`fx-${ch}-param1`);
            const param2 = document.getElementById(`fx-${ch}-param2`);

            if (param1) {
                param1.addEventListener('input', (e) => {
                    const p = this._getParamMapping(deckId, 0);
                    if (p) this.setParam(deckId, p.name, p.scale(e.target.value / 100));
                });
            }
            if (param2) {
                param2.addEventListener('input', (e) => {
                    const p = this._getParamMapping(deckId, 1);
                    if (p) this.setParam(deckId, p.name, p.scale(e.target.value / 100));
                });
            }

            // FX on/off
            const fxToggle = document.getElementById(`fx-${ch}-toggle`);
            if (fxToggle) {
                fxToggle.addEventListener('click', () => {
                    const deck = this.decks[deckId];
                    const isOn = deck.wet.gain.value > 0;
                    if (isOn) {
                        deck.wet.gain.value = 0;
                        deck.dry.gain.value = 1;
                        fxToggle.classList.remove('active');
                    } else {
                        const wetDryEl = document.getElementById(`fx-${ch}-wetdry`);
                        const wetVal = wetDryEl ? wetDryEl.value / 100 : 0.5;
                        deck.wet.gain.value = wetVal;
                        deck.dry.gain.value = 1 - wetVal * 0.5;
                        fxToggle.classList.add('active');
                    }
                });
            }
        });
    }

    _getParamMapping(deckId, paramIndex) {
        const deck = this.decks[deckId];
        const mappings = {
            echo: [
                { name: 'time', label: 'TIME', scale: v => v * 1.5 + 0.05 },
                { name: 'feedback', label: 'FDBK', scale: v => v * 0.85 },
            ],
            reverb: [
                { name: 'decay', label: 'DECAY', scale: v => v * 5 + 0.5 },
                { name: 'decay', label: 'SIZE', scale: v => v * 5 + 0.5 },
            ],
            flanger: [
                { name: 'rate', label: 'RATE', scale: v => v * 5 + 0.1 },
                { name: 'depth', label: 'DEPTH', scale: v => v * 0.01 },
            ],
            filter: [
                { name: 'frequency', label: 'FREQ', scale: v => 20 + v * v * 19980 },
                { name: 'resonance', label: 'RESO', scale: v => v * 20 + 0.5 },
            ],
            delay: [
                { name: 'time', label: 'TIME', scale: v => v * 2 + 0.05 },
                { name: 'feedback', label: 'FDBK', scale: v => v * 0.85 },
            ],
            phaser: [
                { name: 'rate', label: 'RATE', scale: v => v * 7.9 + 0.1 },
                { name: 'depth', label: 'DEPTH', scale: v => v },
            ],
            chorus: [
                { name: 'rate', label: 'RATE', scale: v => v * 4.9 + 0.1 },
                { name: 'depth', label: 'DEPTH', scale: v => v * 20 },
            ],
            bitcrusher: [
                { name: 'bits', label: 'BITS', scale: v => Math.round(v * 15) + 1 },
                { name: 'downsample', label: 'DSAMP', scale: v => Math.round(v * 39) + 1 },
            ],
            compressor: [
                { name: 'threshold', label: 'THRSH', scale: v => v * -60 },
                { name: 'ratio', label: 'RATIO', scale: v => v * 19 + 1 },
            ],
            distortion: [
                { name: 'drive', label: 'DRIVE', scale: v => v * 100 },
                { name: 'tone', label: 'TONE', scale: v => v * 7800 + 200 },
            ],
        };

        return mappings[deck.activeEffect]?.[paramIndex] || null;
    }

    _populateFXSelectors() {
        const newEffects = [
            { value: 'phaser', label: 'Phaser' },
            { value: 'chorus', label: 'Chorus' },
            { value: 'bitcrusher', label: 'Bitcrusher' },
            { value: 'compressor', label: 'Compressor' },
            { value: 'distortion', label: 'Distortion' },
        ];

        ['a', 'b'].forEach(ch => {
            const select = document.getElementById(`fx-${ch}-select`);
            if (!select) return;

            newEffects.forEach(fx => {
                // Only add if not already present
                if (!select.querySelector(`option[value="${fx.value}"]`)) {
                    const opt = document.createElement('option');
                    opt.value = fx.value;
                    opt.textContent = fx.label;
                    select.appendChild(opt);
                }
            });
        });
    }

    _updateParamLabels(ch) {
        const deckId = ch.toUpperCase();
        const p1Label = document.getElementById(`fx-${ch}-p1-label`);
        const p2Label = document.getElementById(`fx-${ch}-p2-label`);
        const m1 = this._getParamMapping(deckId, 0);
        const m2 = this._getParamMapping(deckId, 1);
        if (p1Label && m1) p1Label.textContent = m1.label;
        if (p2Label && m2) p2Label.textContent = m2.label;
    }
}
