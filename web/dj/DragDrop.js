// DragDrop.js — Drag & drop audio files from desktop onto decks + file picker buttons

export class DragDrop {
    constructor(decks, audioRouter) {
        this.decks = decks;
        this.router = audioRouter;

        this._initDropZones();
        this._initLoadButtons();
    }

    _initLoadButtons() {
        ['a', 'b'].forEach(ch => {
            const deckId = ch.toUpperCase();
            const deckEl = document.getElementById(`deck-${ch}`);
            if (!deckEl) return;

            // Find the deck header to insert the load button
            const header = deckEl.querySelector('.deck-header');
            if (!header) return;

            const loadBtn = document.createElement('button');
            loadBtn.className = 'btn-mini load-file-btn';
            loadBtn.id = `load-file-${ch}`;
            loadBtn.textContent = 'LOAD';
            loadBtn.title = 'Load audio file from disk';
            loadBtn.style.cssText = 'margin-left:8px;background:#00d4ff22;border:1px solid #00d4ff;color:#00d4ff;cursor:pointer;padding:2px 10px;font-weight:bold;';
            header.appendChild(loadBtn);

            // Hidden file input
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus';
            fileInput.style.display = 'none';
            fileInput.id = `file-input-${ch}`;
            deckEl.appendChild(fileInput);

            loadBtn.addEventListener('click', () => {
                console.log(`[AUDIO:LOAD] Load button clicked for Deck ${deckId}`);
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && this._isAudioFile(file)) {
                    console.log(`[AUDIO:LOAD] File selected for Deck ${deckId}: "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB, type=${file.type})`);
                    this.router.resume();
                    this._loadFile(deckId, file);
                } else if (file) {
                    console.warn(`[AUDIO:LOAD] Rejected file: "${file.name}" (type=${file.type}) — not a recognized audio format`);
                }
                fileInput.value = ''; // reset so same file can be re-selected
            });
        });
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
                    console.log(`[AUDIO:DROP] File dropped on Deck ${deckId}: "${audioFile.name}" (${(audioFile.size / 1024 / 1024).toFixed(1)}MB)`);
                    this.router.resume();
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
        if (!deck) {
            console.error(`[AUDIO:LOAD] Deck ${deckId} not found!`);
            return;
        }

        console.log(`[AUDIO:LOAD] Loading file to Deck ${deckId}...`);
        console.log(`[AUDIO:LOAD]   File: "${file.name}" | Size: ${(file.size / 1024 / 1024).toFixed(2)}MB | Type: ${file.type}`);
        console.log(`[AUDIO:LOAD]   AudioContext state: ${this.router.ctx.state} | Sample rate: ${this.router.ctx.sampleRate}Hz`);

        // Create a blob URL for the audio file
        const audioUrl = URL.createObjectURL(file);
        console.log(`[AUDIO:LOAD]   Blob URL: ${audioUrl}`);

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

        console.log(`[AUDIO:LOAD]   Calling wavesurfer.load()...`);
        deck.wavesurfer.load(audioUrl);
        deck._updateDeckUI();

        // Show loading indicator
        const prefix = `deck-${deckId.toLowerCase()}`;
        const titleEl = document.getElementById(`${prefix}-title`);
        if (titleEl) titleEl.textContent = `Loading: ${title}...`;
    }
}
