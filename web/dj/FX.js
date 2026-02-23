// FX.js — Audio effects engine per deck
// Effects: Echo, Reverb, Flanger, Filter, Delay
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

        // Default: echo is connected
        const effects = { echo, reverb, flanger, filter, delay };
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
        }
    }

    _initUI() {
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
        };

        return mappings[deck.activeEffect]?.[paramIndex] || null;
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
