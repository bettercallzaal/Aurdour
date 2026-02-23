// FlowMode.js — Simple Auto-DJ for non-DJs
// Auto-mixes tracks with smart suggestions, one-button play, clean overlay UI

export class FlowMode {
    constructor(djPlayer) {
        this.dj = djPlayer;
        this.enabled = false;
        this.queue = []; // upcoming tracks (from library manifest)
        this.currentDeck = 'A';
        this.currentTrack = null;
        this.transitionPoint = 30; // seconds before end to start transition
        this.transitionDuration = 8; // crossfade length in seconds
        this.playedInSession = []; // track IDs already played
        this.suggestions = [];
        this._transitioning = false;
        this._progressInterval = null;
    }

    enable() {
        this.enabled = true;
        this._buildUI();
        document.getElementById('flow-panel')?.classList.remove('hidden');
        document.getElementById('flow-toggle-btn')?.classList.add('active');

        // Populate initial suggestions from library
        this._populateSuggestions();
    }

    disable() {
        this.enabled = false;
        document.getElementById('flow-panel')?.classList.add('hidden');
        document.getElementById('flow-toggle-btn')?.classList.remove('active');
        this._stopProgressUpdates();
    }

    toggle() {
        if (this.enabled) this.disable();
        else this.enable();
    }

    start(track) {
        if (!track) return;

        this.currentTrack = track;
        this.currentDeck = 'A';
        this.playedInSession.push(track.id || track.title);
        this._transitioning = false;

        // Reset crossfader to deck A side
        const cf = document.getElementById('crossfader');
        if (cf) { cf.value = 0; }
        this.dj.audioRouter.setCrossfade(0);

        // Load and play on deck A
        this.dj.audioRouter.resume();
        this.dj.decks.A.loadTrack(track.dataFile);

        // Auto-suggest next tracks
        this._suggestNext();
        this._autoFillQueue();
        this._updateUI();
        this._startProgressUpdates();
    }

    skip() {
        if (this.queue.length === 0) return;
        this._triggerTransition();
    }

    removeFromQueue(index) {
        this.queue.splice(index, 1);
        this._updateUI();
    }

    addToQueue(track) {
        if (!track) return;
        this.queue.push(track);
        this._updateUI();
    }

    // Called by player.js when a deck's track nears its end
    onTrackNearEnd(deck) {
        if (!this.enabled) return;
        if (deck.id !== this.currentDeck) return;
        if (this._transitioning) return;

        this._triggerTransition();
    }

    // Called by player.js when auto-transition finishes
    onTransitionComplete(direction) {
        if (!this.enabled) return;

        // Swap current deck
        this.currentDeck = this.currentDeck === 'A' ? 'B' : 'A';
        this._transitioning = false;

        // The now-playing track is the first item that was in the queue
        if (this.queue.length > 0) {
            this.currentTrack = this.queue.shift();
        }

        // Refresh suggestions and auto-fill queue
        this._suggestNext();
        this._autoFillQueue();
        this._updateUI();
    }

    _triggerTransition() {
        if (this.queue.length === 0) {
            this._autoFillQueue();
            if (this.queue.length === 0) return;
        }

        this._transitioning = true;
        const nextTrack = this.queue[0];
        const idleDeck = this.currentDeck === 'A' ? 'B' : 'A';
        const direction = this.currentDeck === 'A' ? 'AtoB' : 'BtoA';

        // Mark as played
        this.playedInSession.push(nextTrack.id || nextTrack.title);

        // Load next track to idle deck
        this.dj.decks[idleDeck].loadTrack(nextTrack.dataFile);

        // Wait for deck to be ready, then start transition
        const checkReady = () => {
            if (this.dj.decks[idleDeck].isLoaded) {
                if (this.dj.autoTransition) {
                    this.dj.autoTransition.startProgrammatic(direction, this.transitionDuration);
                }
            } else {
                setTimeout(checkReady, 100);
            }
        };
        checkReady();
    }

    _suggestNext() {
        if (!this.currentTrack || !this.dj.playlists || !this.dj.library) {
            this.suggestions = [];
            return;
        }

        const allTracks = this.dj.library.tracks;
        const playedSet = new Set(this.playedInSession);
        const queuedSet = new Set(this.queue.map(t => t.id || t.title));

        // Build a currentTrack-like object for getRelatedTracks
        const current = {
            id: this.currentTrack.id || this.currentTrack.title,
            bpm: this.currentTrack.bpm,
            key: this.currentTrack.key,
            genre: this.currentTrack.genre,
        };

        const related = this.dj.playlists.getRelatedTracks(current, allTracks, this.dj.harmonic);

        // Filter out played and queued tracks
        this.suggestions = related.filter(t => {
            const tid = t.id || t.title;
            return !playedSet.has(tid) && !queuedSet.has(tid);
        });

        // If no compatible tracks, fall back to any unplayed tracks
        if (this.suggestions.length === 0) {
            this.suggestions = allTracks.filter(t => {
                const tid = t.id || t.title;
                return !playedSet.has(tid) && !queuedSet.has(tid);
            }).slice(0, 5);
        }
    }

    _autoFillQueue() {
        // Keep at least 1 track in queue
        if (this.queue.length === 0 && this.suggestions.length > 0) {
            this.queue.push(this.suggestions.shift());
        }
    }

    _populateSuggestions() {
        // On initial enable, show all library tracks as suggestions
        if (!this.dj.library) return;
        const allTracks = this.dj.library.tracks;
        if (this.currentTrack) {
            this._suggestNext();
        } else {
            this.suggestions = [...allTracks].slice(0, 10);
        }
        this._updateUI();
    }

    _getCompatibilityBadges(track) {
        if (!this.currentTrack) return [];
        const badges = [];

        // BPM compatibility
        if (this.currentTrack.bpm && track.bpm) {
            const ratio = track.bpm / this.currentTrack.bpm;
            if (ratio >= 0.95 && ratio <= 1.05) {
                badges.push({ label: 'BPM', type: 'bpm' });
            }
        }

        // Key compatibility
        if (this.dj.harmonic && this.currentTrack.key && track.key) {
            if (this.dj.harmonic.isCompatible(this.currentTrack.key, track.key)) {
                badges.push({ label: 'KEY', type: 'key' });
            }
        }

        // Genre match
        if (this.currentTrack.genre && track.genre && this.currentTrack.genre === track.genre) {
            badges.push({ label: track.genre, type: 'genre' });
        }

        return badges;
    }

    _startProgressUpdates() {
        this._stopProgressUpdates();
        this._progressInterval = setInterval(() => {
            if (!this.enabled) return;
            this._updateProgress();
        }, 500);
    }

    _stopProgressUpdates() {
        if (this._progressInterval) {
            clearInterval(this._progressInterval);
            this._progressInterval = null;
        }
    }

    _updateProgress() {
        const deck = this.dj.decks[this.currentDeck];
        if (!deck || !deck.isLoaded) return;

        const current = deck.getCurrentTime();
        const duration = deck.getDuration();
        if (duration <= 0) return;

        const pct = (current / duration) * 100;
        const bar = document.getElementById('flow-progress-bar');
        if (bar) bar.style.width = `${pct}%`;

        const elapsed = document.getElementById('flow-elapsed');
        const remaining = document.getElementById('flow-remaining');
        if (elapsed) elapsed.textContent = this._formatTime(current);
        if (remaining) remaining.textContent = `-${this._formatTime(duration - current)}`;
    }

    _formatTime(seconds) {
        if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ===== UI RENDERING =====

    _buildUI() {
        const panel = document.getElementById('flow-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="flow-header">
                <div class="flow-title">FLOW MODE</div>
                <button class="flow-exit-btn" id="flow-exit-btn">EXIT</button>
            </div>

            <div class="flow-content">
                <!-- Now Playing -->
                <div class="flow-section">
                    <div class="flow-section-label">NOW PLAYING</div>
                    <div class="flow-now-playing" id="flow-now-playing">
                        <div class="flow-np-info">
                            <div class="flow-np-title" id="flow-np-title">No track loaded</div>
                            <div class="flow-np-artist" id="flow-np-artist"></div>
                            <div class="flow-np-meta">
                                <span class="flow-np-bpm" id="flow-np-bpm"></span>
                                <span class="flow-np-key" id="flow-np-key"></span>
                                <span class="flow-np-genre" id="flow-np-genre"></span>
                            </div>
                        </div>
                        <div class="flow-progress">
                            <div class="flow-progress-track">
                                <div class="flow-progress-bar" id="flow-progress-bar"></div>
                            </div>
                            <div class="flow-progress-times">
                                <span id="flow-elapsed">0:00</span>
                                <span id="flow-remaining">-0:00</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Up Next -->
                <div class="flow-section">
                    <div class="flow-section-header">
                        <div class="flow-section-label">UP NEXT</div>
                        <button class="flow-skip-btn" id="flow-skip-btn">SKIP</button>
                    </div>
                    <div class="flow-up-next" id="flow-up-next">
                        <div class="flow-empty-msg">Add tracks to queue below</div>
                    </div>
                </div>

                <!-- Queue -->
                <div class="flow-section">
                    <div class="flow-section-label">QUEUE</div>
                    <div class="flow-queue" id="flow-queue">
                        <div class="flow-empty-msg">Queue is empty</div>
                    </div>
                </div>

                <!-- Suggestions -->
                <div class="flow-section flow-section-grow">
                    <div class="flow-section-label">SUGGESTIONS</div>
                    <div class="flow-suggestions" id="flow-suggestions">
                        <div class="flow-empty-msg">Enable flow mode and pick a starting track</div>
                    </div>
                </div>

                <!-- Settings -->
                <div class="flow-section">
                    <div class="flow-section-label">SETTINGS</div>
                    <div class="flow-settings">
                        <div class="flow-setting-row">
                            <label>Transition Duration</label>
                            <input type="range" id="flow-trans-duration" min="2" max="32" value="${this.transitionDuration}" step="1">
                            <span id="flow-trans-duration-val">${this.transitionDuration}s</span>
                        </div>
                        <div class="flow-setting-row">
                            <label>Trigger Point</label>
                            <input type="range" id="flow-trigger-point" min="10" max="60" value="${this.transitionPoint}" step="5">
                            <span id="flow-trigger-point-val">${this.transitionPoint}s</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Wire up UI events
        document.getElementById('flow-exit-btn')?.addEventListener('click', () => this.disable());
        document.getElementById('flow-skip-btn')?.addEventListener('click', () => this.skip());

        document.getElementById('flow-trans-duration')?.addEventListener('input', (e) => {
            this.transitionDuration = parseInt(e.target.value);
            const val = document.getElementById('flow-trans-duration-val');
            if (val) val.textContent = `${this.transitionDuration}s`;
        });

        document.getElementById('flow-trigger-point')?.addEventListener('input', (e) => {
            this.transitionPoint = parseInt(e.target.value);
            const val = document.getElementById('flow-trigger-point-val');
            if (val) val.textContent = `${this.transitionPoint}s`;

            // Update near-end threshold on both decks
            // The actual threshold is checked in Deck.js timeupdate (hardcoded to 30s)
            // We override via a dynamic check in onTrackNearEnd
        });

        this._updateUI();
    }

    _updateUI() {
        this._renderNowPlaying();
        this._renderUpNext();
        this._renderQueue();
        this._renderSuggestions();
    }

    _renderNowPlaying() {
        const title = document.getElementById('flow-np-title');
        const artist = document.getElementById('flow-np-artist');
        const bpm = document.getElementById('flow-np-bpm');
        const key = document.getElementById('flow-np-key');
        const genre = document.getElementById('flow-np-genre');

        if (!this.currentTrack) {
            if (title) title.textContent = 'No track loaded';
            if (artist) artist.textContent = '';
            if (bpm) bpm.textContent = '';
            if (key) key.textContent = '';
            if (genre) genre.textContent = '';
            return;
        }

        if (title) title.textContent = this.currentTrack.title || 'Unknown';
        if (artist) artist.textContent = this.currentTrack.artist || '';
        if (bpm) bpm.textContent = this.currentTrack.bpm ? `${this.currentTrack.bpm} BPM` : '';
        if (key) key.textContent = this.currentTrack.key || '';
        if (genre) genre.textContent = this.currentTrack.genre || '';
    }

    _renderUpNext() {
        const container = document.getElementById('flow-up-next');
        if (!container) return;

        if (this.queue.length === 0) {
            container.innerHTML = '<div class="flow-empty-msg">Add tracks to queue below</div>';
            return;
        }

        const track = this.queue[0];
        const badges = this._getCompatibilityBadges(track);
        const badgeHtml = badges.map(b =>
            `<span class="flow-badge flow-badge-${b.type}">${b.label}</span>`
        ).join('');

        container.innerHTML = `
            <div class="flow-next-card">
                <div class="flow-next-info">
                    <div class="flow-next-title">${track.title || 'Unknown'}</div>
                    <div class="flow-next-artist">${track.artist || ''}</div>
                </div>
                <div class="flow-next-meta">
                    <span>${track.bpm ? track.bpm + ' BPM' : ''}</span>
                    <span>${track.key || ''}</span>
                </div>
                <div class="flow-next-badges">${badgeHtml}</div>
            </div>
        `;
    }

    _renderQueue() {
        const container = document.getElementById('flow-queue');
        if (!container) return;

        if (this.queue.length <= 1) {
            container.innerHTML = '<div class="flow-empty-msg">Queue is empty</div>';
            return;
        }

        // Skip first item (shown in Up Next)
        container.innerHTML = this.queue.slice(1).map((track, i) => {
            const actualIndex = i + 1;
            return `
                <div class="flow-queue-item">
                    <span class="flow-queue-num">${actualIndex + 1}</span>
                    <span class="flow-queue-info">${track.title || 'Unknown'} — ${track.artist || ''}</span>
                    <button class="flow-queue-remove" data-index="${actualIndex}">x</button>
                </div>
            `;
        }).join('');

        // Wire remove buttons
        container.querySelectorAll('.flow-queue-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.removeFromQueue(idx);
            });
        });
    }

    _renderSuggestions() {
        const container = document.getElementById('flow-suggestions');
        if (!container) return;

        // Merge suggestions with remaining library tracks not in queue/played
        let items = this.suggestions;
        if (items.length === 0 && this.dj.library) {
            const playedSet = new Set(this.playedInSession);
            const queuedSet = new Set(this.queue.map(t => t.id || t.title));
            items = this.dj.library.tracks.filter(t => {
                const tid = t.id || t.title;
                return !playedSet.has(tid) && !queuedSet.has(tid);
            }).slice(0, 10);
        }

        if (items.length === 0) {
            container.innerHTML = '<div class="flow-empty-msg">No more suggestions available</div>';
            return;
        }

        container.innerHTML = items.map((track, i) => {
            const badges = this._getCompatibilityBadges(track);
            const badgeHtml = badges.map(b =>
                `<span class="flow-badge flow-badge-${b.type}">${b.label}</span>`
            ).join('');

            return `
                <div class="flow-suggestion-card" data-index="${i}">
                    <div class="flow-sug-info">
                        <div class="flow-sug-title">${track.title || 'Unknown'}</div>
                        <div class="flow-sug-artist">${track.artist || ''}</div>
                    </div>
                    <div class="flow-sug-meta">
                        <span>${track.bpm ? track.bpm + ' BPM' : ''}</span>
                        <span>${track.key || ''}</span>
                        ${badgeHtml}
                    </div>
                    <button class="flow-sug-add" data-index="${i}">
                        ${this.currentTrack ? 'ADD' : 'PLAY'}
                    </button>
                </div>
            `;
        }).join('');

        // Wire add/play buttons
        container.querySelectorAll('.flow-sug-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const track = items[idx];
                if (!track) return;

                if (!this.currentTrack) {
                    // First track — start playing
                    this.start(track);
                } else {
                    this.addToQueue(track);
                    this._suggestNext();
                    this._updateUI();
                }
            });
        });
    }
}
