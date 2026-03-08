// Playlists.js — Crates, playlists, smart playlists, ratings, play counts

export class Playlists {
    constructor(storage) {
        this.storage = storage;
        this.playlists = this.storage.get('playlists', []);
        this.ratings = this.storage.get('ratings', {}); // trackId → 1-5
        this.playCounts = this.storage.get('playCounts', {});
        this.recentlyPlayed = this.storage.get('recentlyPlayed', []);
        this.likedTracks = this.storage.get('likedTracks', []); // array of track objects
        this.activePlaylist = null;
        this.onFilterChange = null; // callback to re-render library

        this._initUI();
    }

    _initUI() {
        const createBtn = document.getElementById('playlist-create');
        const listEl = document.getElementById('playlist-list');

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                const name = prompt('Playlist name:');
                if (name) this.createPlaylist(name);
            });
        }
    }

    // ===== Playlists (Crates) =====

    createPlaylist(name) {
        const id = Date.now().toString();
        this.playlists.push({ id, name, tracks: [] });
        this._save('playlists');
        this._renderPlaylistList();
        return id;
    }

    deletePlaylist(id) {
        this.playlists = this.playlists.filter(p => p.id !== id);
        if (this.activePlaylist === id) this.activePlaylist = null;
        this._save('playlists');
        this._renderPlaylistList();
    }

    renamePlaylist(id, newName) {
        const p = this.playlists.find(p => p.id === id);
        if (p) { p.name = newName; this._save('playlists'); this._renderPlaylistList(); }
    }

    addToPlaylist(playlistId, trackId) {
        const p = this.playlists.find(p => p.id === playlistId);
        if (p && !p.tracks.includes(trackId)) {
            p.tracks.push(trackId);
            this._save('playlists');
        }
    }

    removeFromPlaylist(playlistId, trackId) {
        const p = this.playlists.find(p => p.id === playlistId);
        if (p) {
            p.tracks = p.tracks.filter(t => t !== trackId);
            this._save('playlists');
        }
    }

    getPlaylistTracks(playlistId) {
        const p = this.playlists.find(p => p.id === playlistId);
        return p ? p.tracks : [];
    }

    setActivePlaylist(id) {
        this.activePlaylist = id;
        this._renderPlaylistList();
        if (this.onFilterChange) this.onFilterChange();
    }

    // ===== Smart Playlists =====

    getSmartPlaylist(type, allTracks, params = {}) {
        switch (type) {
            case 'bpm-range':
                return allTracks.filter(t => t.bpm >= (params.min || 0) && t.bpm <= (params.max || 999));
            case 'key':
                return allTracks.filter(t => t.key === params.key);
            case 'genre':
                return allTracks.filter(t => (t.genre || '').toLowerCase() === (params.genre || '').toLowerCase());
            case 'top-rated':
                return allTracks.filter(t => (this.ratings[t.id] || 0) >= 4).sort((a, b) => (this.ratings[b.id] || 0) - (this.ratings[a.id] || 0));
            case 'most-played':
                return allTracks.sort((a, b) => (this.playCounts[b.id] || 0) - (this.playCounts[a.id] || 0)).slice(0, 50);
            case 'recently-played':
                return this.recentlyPlayed.slice(0, 30);
            default:
                return allTracks;
        }
    }

    // ===== Ratings =====

    setRating(trackId, rating) {
        this.ratings[trackId] = Math.max(0, Math.min(5, rating));
        this._save('ratings');
    }

    getRating(trackId) {
        return this.ratings[trackId] || 0;
    }

    // ===== Play Counts =====

    incrementPlayCount(trackId) {
        this.playCounts[trackId] = (this.playCounts[trackId] || 0) + 1;
        this._save('playCounts');

        // Update recently played
        this.recentlyPlayed = this.recentlyPlayed.filter(id => id !== trackId);
        this.recentlyPlayed.unshift(trackId);
        if (this.recentlyPlayed.length > 100) this.recentlyPlayed = this.recentlyPlayed.slice(0, 100);
        this._save('recentlyPlayed');
    }

    // ===== Related Tracks =====

    getRelatedTracks(currentTrack, allTracks, harmonicMixer) {
        if (!currentTrack) return [];

        return allTracks
            .filter(t => t.id !== currentTrack.id)
            .map(t => {
                let score = 0;

                // BPM compatibility (within ±5%)
                if (currentTrack.bpm && t.bpm) {
                    const bpmRatio = t.bpm / currentTrack.bpm;
                    if (bpmRatio >= 0.95 && bpmRatio <= 1.05) score += 3;
                    else if (bpmRatio >= 0.9 && bpmRatio <= 1.1) score += 1;
                }

                // Key compatibility
                if (harmonicMixer && currentTrack.key && t.key) {
                    if (harmonicMixer.isCompatible(currentTrack.key, t.key)) score += 4;
                }

                // Same genre
                if (currentTrack.genre && t.genre && currentTrack.genre === t.genre) score += 1;

                return { track: t, score };
            })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(r => r.track);
    }

    // ===== Liked Tracks =====

    toggleLike(track) {
        const trackKey = track.source === 'audius' ? `audius:${track.id}` : (track.dataFile || track.id);
        const idx = this.likedTracks.findIndex(t =>
            (t.source === 'audius' ? `audius:${t.id}` : (t.dataFile || t.id)) === trackKey
        );
        if (idx >= 0) {
            this.likedTracks.splice(idx, 1);
        } else {
            this.likedTracks.unshift({ ...track, likedAt: Date.now() });
        }
        this._save('likedTracks');
        return idx < 0; // returns true if now liked
    }

    isLiked(track) {
        const trackKey = track.source === 'audius' ? `audius:${track.id}` : (track.dataFile || track.id);
        return this.likedTracks.some(t =>
            (t.source === 'audius' ? `audius:${t.id}` : (t.dataFile || t.id)) === trackKey
        );
    }

    getLikedTracks() {
        return [...this.likedTracks];
    }

    _save(key) {
        this.storage.set(key, this[key]);
    }

    _renderPlaylistList() {
        const listEl = document.getElementById('playlist-list');
        if (!listEl) return;
        listEl.textContent = '';

        // "All tracks" option
        const allItem = document.createElement('div');
        allItem.className = `playlist-item${!this.activePlaylist ? ' active' : ''}`;
        allItem.textContent = 'All Tracks';
        allItem.addEventListener('click', () => this.setActivePlaylist(null));
        listEl.appendChild(allItem);

        this.playlists.forEach(p => {
            const item = document.createElement('div');
            item.className = `playlist-item${this.activePlaylist === p.id ? ' active' : ''}`;
            item.textContent = `${p.name} (${p.tracks.length})`;
            item.addEventListener('click', () => this.setActivePlaylist(p.id));

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const action = prompt(`${p.name}: rename, delete, or cancel?`);
                if (action === 'rename') {
                    const newName = prompt('New name:', p.name);
                    if (newName) this.renamePlaylist(p.id, newName);
                } else if (action === 'delete') {
                    this.deletePlaylist(p.id);
                }
            });

            listEl.appendChild(item);
        });
    }
}
