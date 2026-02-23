// DragDrop.js — Drag & drop audio files from desktop onto decks

export class DragDrop {
    constructor(decks, audioRouter) {
        this.decks = decks;
        this.router = audioRouter;

        this._initDropZones();
    }

    _initDropZones() {
        ['a', 'b'].forEach(ch => {
            const deckId = ch.toUpperCase();
            const deckEl = document.getElementById(`deck-${ch}`);
            if (!deckEl) return;

            deckEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                deckEl.classList.add('drag-over');
            });

            deckEl.addEventListener('dragleave', () => {
                deckEl.classList.remove('drag-over');
            });

            deckEl.addEventListener('drop', (e) => {
                e.preventDefault();
                deckEl.classList.remove('drag-over');

                const files = Array.from(e.dataTransfer.files);
                const audioFile = files.find(f => this._isAudioFile(f));
                if (audioFile) {
                    this._loadFile(deckId, audioFile);
                }
            });
        });

        // Global drop zone as fallback (loads to first available deck)
        document.body.addEventListener('dragover', (e) => {
            if (e.target.closest('.deck')) return; // handled by deck zones
            e.preventDefault();
        });

        document.body.addEventListener('drop', (e) => {
            if (e.target.closest('.deck')) return;
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            const audioFile = files.find(f => this._isAudioFile(f));
            if (audioFile) {
                const deckId = !this.decks.A.isLoaded ? 'A' : (!this.decks.B.isLoaded ? 'B' : 'A');
                this._loadFile(deckId, audioFile);
            }
        });
    }

    _isAudioFile(file) {
        const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
        const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.opus'];
        return audioTypes.includes(file.type) || audioExts.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    async _loadFile(deckId, file) {
        const deck = this.decks[deckId];
        if (!deck) return;

        // Create a blob URL for the audio file
        const audioUrl = URL.createObjectURL(file);

        // Extract filename-based metadata
        const name = file.name.replace(/\.[^/.]+$/, '');
        const parts = name.split(' - ');
        const title = parts.length > 1 ? parts[1].trim() : name;
        const artist = parts.length > 1 ? parts[0].trim() : '';

        // Create minimal metadata object
        deck.metadata = {
            audio_files: { mp3: audioUrl },
            metadata: {
                title,
                artist,
                bpm: null,
                key: null,
            },
        };

        deck.hotCues = new Array(8).fill(null);
        deck.cuePoint = 0;
        deck.isLoaded = false;
        deck.isPlaying = false;
        deck.loop = { active: false, inPoint: null, outPoint: null, region: null };
        deck.currentRate = 1.0;
        deck.beatPositions = [];

        deck.wavesurfer.load(audioUrl);
        deck._updateDeckUI();

        // Show loading indicator
        const prefix = `deck-${deckId.toLowerCase()}`;
        const titleEl = document.getElementById(`${prefix}-title`);
        if (titleEl) titleEl.textContent = `Loading: ${title}...`;
    }
}
