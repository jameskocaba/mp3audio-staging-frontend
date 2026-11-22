(function () {
    'use strict';

    function initStudioApp() {
        if (window.__MP3AUDIO_STUDIO_INIT__) return;
        window.__MP3AUDIO_STUDIO_INIT__ = true;

        const ExportEngine = window.StudioExportEngine;
        const AudioEngineClass = window.StudioAudioEngine;
        if (!ExportEngine || !AudioEngineClass) {
            console.error('Studio engines missing');
            return;
        }

        // --- DOM Elements ---
        const captureTabBtn = document.getElementById('captureTabBtn');
        const emptyCaptureTabBtn = document.getElementById('emptyCaptureTabBtn');
        const captureMicBtn = document.getElementById('captureMicBtn');
        const micDeviceSelect = document.getElementById('micDeviceSelect');
        const openFileBtn = document.getElementById('openFileBtn');
        const emptyOpenFileBtn = document.getElementById('emptyOpenFileBtn');
        const audioFileInput = document.getElementById('audioFileInput');
        const dragDropOverlay = document.getElementById('dragDropOverlay');
        const pickFolderBtn = document.getElementById('pickFolderBtn');
        const pickFolderLabel = document.getElementById('pickFolderLabel');
        const disconnectSourceBtn = document.getElementById('disconnectSourceBtn');

        // Transport & Meters
        const recordBtn = document.getElementById('recordBtn');
        const recordBtnLabel = document.getElementById('recordBtnLabel');
        const pauseRecBtn = document.getElementById('pauseRecBtn');
        const stopBtn = document.getElementById('stopBtn');
        const playBtn = document.getElementById('playBtn');
        const playBtnIcon = document.getElementById('playBtnIcon');
        const loopBtn = document.getElementById('loopBtn');
        const splitAtCursorBtn = document.getElementById('splitAtCursorBtn');
        const lcdTimecode = document.getElementById('lcdTimecode');
        const lcdSourceStatus = document.getElementById('lcdSourceStatus');
        const lcdFormatInfo = document.getElementById('lcdFormatInfo');
        const vuMeterL = document.getElementById('vuMeterL');
        const vuMeterR = document.getElementById('vuMeterR');
        const vuClipL = document.getElementById('vuClipL');
        const vuClipR = document.getElementById('vuClipR');
        const inputGainSlider = document.getElementById('inputGainSlider');
        const playbackVolSlider = document.getElementById('playbackVolSlider');
        const monitorToggle = document.getElementById('monitorToggle');

        // Edit & Zoom Toolbar
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        const trimSelBtn = document.getElementById('trimSelBtn');
        const deleteSelBtn = document.getElementById('deleteSelBtn');
        const silenceSelBtn = document.getElementById('silenceSelBtn');
        const fadeInBtn = document.getElementById('fadeInBtn');
        const fadeOutBtn = document.getElementById('fadeOutBtn');
        const normalizeBtn = document.getElementById('normalizeBtn');
        const trimDeadAirBtn = document.getElementById('trimDeadAirBtn');
        const clearSessionBtn = document.getElementById('clearSessionBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomFitBtn = document.getElementById('zoomFitBtn');
        const selectionReadout = document.getElementById('selectionReadout');

        // Waveform Stage
        const waveformCanvas = document.getElementById('waveformCanvas');
        const waveformEmptyOverlay = document.getElementById('waveformEmptyOverlay');
        const waveformPanSlider = document.getElementById('waveformPanSlider');
        const zoomLevelBadge = document.getElementById('zoomLevelBadge');

        // Auto-Split Settings
        const liveAutoSplitToggle = document.getElementById('liveAutoSplitToggle');
        const soundActivatedToggle = document.getElementById('soundActivatedToggle');
        const autoTrimSilenceToggle = document.getElementById('autoTrimSilenceToggle');
        const thresholdDbSlider = document.getElementById('thresholdDbSlider');
        const thresholdDbVal = document.getElementById('thresholdDbVal');
        const minSilenceSlider = document.getElementById('minSilenceSlider');
        const minSilenceVal = document.getElementById('minSilenceVal');
        const minTrackSlider = document.getElementById('minTrackSlider');
        const minTrackVal = document.getElementById('minTrackVal');
        const scanSplitNowBtn = document.getElementById('scanSplitNowBtn');

        // Track Queue & Metadata & Export
        const trackCountBadge = document.getElementById('trackCountBadge');
        const tracksList = document.getElementById('tracksList');
        const coverArtPickerBtn = document.getElementById('coverArtPickerBtn');
        const coverArtInput = document.getElementById('coverArtInput');
        const coverArtPreview = document.getElementById('coverArtPreview');
        const coverArtPlaceholder = document.getElementById('coverArtPlaceholder');
        const albumMetaInput = document.getElementById('albumMetaInput');
        const albumArtistMetaInput = document.getElementById('albumArtistMetaInput');
        const genreMetaInput = document.getElementById('genreMetaInput');
        const yearMetaInput = document.getElementById('yearMetaInput');
        const exportFormatSelect = document.getElementById('exportFormatSelect');
        const exportBitrateSelect = document.getElementById('exportBitrateSelect');
        const autoSaveLiveToggle = document.getElementById('autoSaveLiveToggle');
        const exportSelectionBtn = document.getElementById('exportSelectionBtn');
        const exportAllBtn = document.getElementById('exportAllBtn');
        const exportAllLabel = document.getElementById('exportAllLabel');
        const exportProgressWrap = document.getElementById('exportProgressWrap');
        const exportProgressLabel = document.getElementById('exportProgressLabel');
        const exportProgressFill = document.getElementById('exportProgressFill');

        // --- App State ---
        let dirHandle = null;
        let coverArtBytes = null;
        let coverArtMime = 'image/jpeg';
        let isExporting = false;
        let autoSaveQueue = Promise.resolve();

        // Viewport / Zoom State
        let viewStartSample = 0;
        let viewSpanSamples = 0; // 0 = auto fit entire recording
        let userHasZoomed = false;

        // Meter peak hold state
        let peakHoldL = -60;
        let peakHoldR = -60;
        let peakHoldTimeL = 0;
        let peakHoldTimeR = 0;
        let clipUntilL = 0;
        let clipUntilR = 0;

        // Canvas drag state
        let dragMode = null; // 'select' | 'resize-start' | 'resize-end' | 'move-split'
        let dragAnchorSample = 0;
        let dragSplitTrackIdx = -1;
        let hasDraggedBeyondThreshold = false;
        let dragStartX = 0;

        // --- Toast Helper ---
        function showToast(message, type = 'info') {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                document.body.appendChild(container);
            }
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            const icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : (type === 'warning' ? '⚡' : '🎛️'));
            toast.innerHTML = `<span>${icon}</span><span></span>`;
            toast.children[1].textContent = message;
            container.appendChild(toast);
            setTimeout(() => { try { toast.remove(); } catch (_) { } }, 4200);
        }

        function formatTimecode(seconds, includeTenths = true) {
            const s = Math.max(0, Number(seconds) || 0);
            const mins = Math.floor(s / 60);
            const rem = s - mins * 60;
            const secs = Math.floor(rem);
            const tenths = Math.floor((rem - secs) * 10);
            const mm = String(mins).padStart(2, '0');
            const ss = String(secs).padStart(2, '0');
            return includeTenths ? `${mm}:${ss}.${tenths}` : `${mm}:${ss}`;
        }

        function clampViewport() {
            const total = engine.length;
            if (total === 0 || !userHasZoomed || viewSpanSamples <= 0 || viewSpanSamples >= total) {
                viewStartSample = 0;
                viewSpanSamples = total;
                return;
            }
            const minSpan = Math.min(total, Math.max(256, Math.round(engine.sampleRate * 0.1)));
            viewSpanSamples = Math.max(minSpan, Math.min(total, viewSpanSamples));
            viewStartSample = Math.max(0, Math.min(total - viewSpanSamples, viewStartSample));
        }

        function syncPanScrollbar() {
            if (!waveformPanSlider || !zoomLevelBadge) return;
            const total = engine.length;
            if (total === 0 || !userHasZoomed || viewSpanSamples >= total) {
                waveformPanSlider.disabled = true;
                waveformPanSlider.value = '0';
                zoomLevelBadge.textContent = 'Fit (1.0x)';
                return;
            }
            waveformPanSlider.disabled = false;
            const maxStart = Math.max(1, total - viewSpanSamples);
            waveformPanSlider.value = String(Math.round((viewStartSample / maxStart) * 1000));
            const zoomFactor = total / viewSpanSamples;
            zoomLevelBadge.textContent = `${zoomFactor.toFixed(1)}x`;
        }

        // --- Instantiate Audio Engine ---
        const engine = new AudioEngineClass({
            onSourceConnected: ({ mode, label, sampleRate }) => {
                updateUiState();
                showToast(`Connected ${mode === 'display' ? 'Stream/Tab Audio' : 'Input'}: ${label} (${sampleRate} Hz)`, 'success');
            },
            onSourceDisconnected: () => {
                updateUiState();
            },
            onSourceEnded: () => {
                showToast('Audio capture stream ended. Captured audio is ready in the waveform.', 'info');
                updateUiState();
            },
            onRecordStateChanged: ({ state }) => {
                if (state === 'armed') {
                    showToast('Sound-Activated Recording Armed — waiting for audio above threshold...', 'warning');
                }
                updateUiState();
            },
            onPlaybackStateChanged: () => {
                updateUiState();
                renderTracksList();
            },
            onTracksChanged: () => {
                renderTracksList();
                updateUiState();
            },
            onTrackAutoSplit: (track) => {
                showToast(`✂️ Auto-detected Track ${track.index + 1} (${formatTimecode((track.endSample - track.startSample) / engine.sampleRate)})`, 'success');
                renderTracksList();
                if (autoSaveLiveToggle && autoSaveLiveToggle.checked && dirHandle) {
                    queueLiveAutoSaveTrack(track);
                }
            },
            onBufferChanged: ({ length }) => {
                if (length === 0) {
                    userHasZoomed = false;
                    viewStartSample = 0;
                    viewSpanSamples = 0;
                } else if (!userHasZoomed) {
                    viewStartSample = 0;
                    viewSpanSamples = length;
                } else if (engine.recordState === 'recording') {
                    // Follow playhead smoothly while zoomed during live recording
                    viewStartSample = Math.max(0, length - viewSpanSamples);
                }
                clampViewport();
                syncPanScrollbar();
                updateUiState();
            },
            onSelectionChanged: () => {
                updateUiState();
            },
            onHistoryChanged: () => {
                updateUiState();
            }
        });

        // --- Source Connection Handlers ---
        async function handleCaptureTabClick() {
            try {
                await engine.connectDisplayAudio();
                userHasZoomed = false;
                engine.startRecording(false);
                showToast('Recording started! Play your track in the shared tab/app — silence gaps will auto-split songs.', 'success');
            } catch (err) {
                if (err && err.name === 'NotAllowedError') {
                    showToast('Screen/tab audio permission was cancelled.', 'info');
                } else if (err && err.code === 'NO_AUDIO_TRACK') {
                    showToast(err.message, 'error');
                    openModal('howToRecordModal');
                } else {
                    showToast((err && err.message) || 'Could not start tab/system audio capture.', 'error');
                }
            }
        }

        async function refreshMicDevices() {
            if (!micDeviceSelect) return;
            const devices = await engine.listInputDevices();
            const currentVal = micDeviceSelect.value;
            micDeviceSelect.innerHTML = '';
            if (devices.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Default Audio Input / Loopback';
                micDeviceSelect.appendChild(opt);
                return;
            }
            devices.forEach((d, idx) => {
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.textContent = d.label || `Audio Input ${idx + 1}`;
                micDeviceSelect.appendChild(opt);
            });
            if (currentVal && Array.from(micDeviceSelect.options).some(o => o.value === currentVal)) {
                micDeviceSelect.value = currentVal;
            }
        }

        async function handleCaptureMicClick() {
            try {
                const devId = micDeviceSelect ? micDeviceSelect.value : '';
                await engine.connectMicAudio(devId);
                await refreshMicDevices();
                userHasZoomed = false;
                engine.startRecording(false);
            } catch (err) {
                showToast((err && err.message) || 'Could not access microphone / line-in device.', 'error');
            }
        }

        async function handleLoadAudioFile(file) {
            if (!file) return;
            try {
                showToast(`Decoding ${file.name}...`, 'info');
                const info = await engine.importAudioFile(file);
                if (albumArtistMetaInput && info.artist && !albumArtistMetaInput.value) {
                    albumArtistMetaInput.value = info.artist;
                }
                userHasZoomed = false;
                clampViewport();
                syncPanScrollbar();
                renderTracksList();
                updateUiState();
                showToast(`Loaded "${file.name}" (${formatTimecode(info.length / info.sampleRate)})`, 'success');
            } catch (err) {
                showToast(`Could not decode audio file: ${(err && err.message) || 'Unsupported format'}`, 'error');
            }
        }

        // --- Folder Selection & Live Auto-Save ---
        async function handlePickFolder() {
            if (!ExportEngine.supportsDirectoryPicker()) {
                showToast('Direct folder access works in Chrome/Edge desktop. In this browser, exports save to Downloads.', 'info');
                return null;
            }
            try {
                const res = await ExportEngine.pickSaveDirectory();
                dirHandle = res.handle;
                if (pickFolderBtn) pickFolderBtn.classList.add('connected');
                if (pickFolderLabel) pickFolderLabel.textContent = `Folder: ${res.name}`;
                showToast(`📁 Connected hard drive folder "${res.name}" for direct saving!`, 'success');
                return dirHandle;
            } catch (err) {
                if (!err || err.name !== 'AbortError') {
                    showToast((err && err.message) || 'Could not select hard drive folder.', 'error');
                }
                return null;
            }
        }

        async function encodeTrackToBlob(startSample, endSample, meta, onProgress) {
            const slice = engine.getSlice(startSample, endSample);
            const fmt = exportFormatSelect ? exportFormatSelect.value : 'mp3';
            if (fmt === 'wav') {
                if (typeof onProgress === 'function') onProgress(100);
                return {
                    ext: 'wav',
                    blob: ExportEngine.encodeWavBlob(slice.left, slice.right, slice.sampleRate)
                };
            }
            const kbps = exportBitrateSelect ? parseInt(exportBitrateSelect.value, 10) || 192 : 192;
            const blob = await ExportEngine.encodeMp3Blob(slice.left, slice.right, slice.sampleRate, kbps, meta, onProgress);
            return { ext: 'mp3', blob };
        }

        function buildTrackExportMeta(track, idx, total) {
            const albumArtist = albumArtistMetaInput ? albumArtistMetaInput.value.trim() : '';
            return {
                title: (track && track.title) || `Track ${idx + 1}`,
                artist: (track && track.artist) || albumArtist,
                album: albumMetaInput ? albumMetaInput.value.trim() : '',
                trackNumber: `${idx + 1}/${Math.max(1, total)}`,
                year: yearMetaInput ? yearMetaInput.value.trim() : '',
                genre: genreMetaInput ? genreMetaInput.value.trim() : '',
                coverBytes: coverArtBytes,
                coverMime: coverArtMime
            };
        }

        function queueLiveAutoSaveTrack(track) {
            if (!dirHandle || !track) return;
            track.saving = true;
            renderTracksList();
            autoSaveQueue = autoSaveQueue.then(async () => {
                try {
                    const fmt = exportFormatSelect ? exportFormatSelect.value : 'mp3';
                    const meta = buildTrackExportMeta(track, track.index, Math.max(track.index + 1, engine.tracks.length));
                    const { ext, blob } = await encodeTrackToBlob(track.startSample, track.endSample, meta);
                    const filename = ExportEngine.buildTrackFilename(meta, track.index, Math.max(track.index + 1, engine.tracks.length), ext || fmt);
                    await ExportEngine.saveBlobToDirectory(dirHandle, filename, blob);
                    track.saving = false;
                    track.saved = true;
                    renderTracksList();
                    showToast(`💾 Auto-saved "${filename}" to hard drive!`, 'success');
                } catch (err) {
                    track.saving = false;
                    renderTracksList();
                    showToast(`Auto-save warning: ${(err && err.message) || err}`, 'error');
                }
            });
        }

        // --- Export / Save Flows ---
        function setExportProgress(visible, labelText = '', pct = 0) {
            if (!exportProgressWrap) return;
            exportProgressWrap.classList.toggle('hidden', !visible);
            if (exportProgressLabel && labelText) exportProgressLabel.textContent = labelText;
            if (exportProgressFill) exportProgressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        }

        async function saveSingleTrack(trackIdx) {
            if (isExporting || engine.length === 0) return;
            const track = engine.tracks[trackIdx];
            if (!track) return;
            isExporting = true;
            track.saving = true;
            renderTracksList();
            setExportProgress(true, `Encoding ${track.title}...`, 5);
            try {
                const total = engine.tracks.length;
                const meta = buildTrackExportMeta(track, trackIdx, total);
                const { ext, blob } = await encodeTrackToBlob(track.startSample, track.endSample, meta, (pct) => {
                    setExportProgress(true, `Encoding ${track.title}... ${pct}%`, pct);
                });
                const filename = ExportEngine.buildTrackFilename(meta, trackIdx, total, ext);
                const res = await ExportEngine.saveBlobWithPickerOrDownload(blob, filename, ext, dirHandle);
                track.saving = false;
                if (res.method !== 'cancelled') {
                    track.saved = true;
                    showToast(`💾 Saved ${res.filename}`, 'success');
                }
            } catch (err) {
                track.saving = false;
                showToast(`Save failed: ${(err && err.message) || err}`, 'error');
            } finally {
                isExporting = false;
                setExportProgress(false);
                renderTracksList();
            }
        }

        async function exportSelectionToDisk() {
            if (isExporting || engine.length === 0) return;
            const s = engine.selection ? engine.selection.startSample : 0;
            const e = engine.selection ? engine.selection.endSample : engine.length;
            isExporting = true;
            setExportProgress(true, 'Encoding selection...', 5);
            try {
                const meta = buildTrackExportMeta({ title: 'Selection', artist: albumArtistMetaInput ? albumArtistMetaInput.value.trim() : '' }, 0, 1);
                const { ext, blob } = await encodeTrackToBlob(s, e, meta, (pct) => {
                    setExportProgress(true, `Encoding selection... ${pct}%`, pct);
                });
                const baseTitle = ExportEngine.sanitizeFilename(albumMetaInput && albumMetaInput.value.trim() ? `${albumMetaInput.value.trim()} - Clip` : 'MP3audio_Recording');
                const filename = `${baseTitle}.${ext}`;
                const res = await ExportEngine.saveBlobWithPickerOrDownload(blob, filename, ext, dirHandle);
                if (res.method !== 'cancelled') {
                    showToast(`💾 Saved ${res.filename}`, 'success');
                }
            } catch (err) {
                showToast(`Export failed: ${(err && err.message) || err}`, 'error');
            } finally {
                isExporting = false;
                setExportProgress(false);
            }
        }

        async function exportAllTracksToHardDrive() {
            if (isExporting || engine.length === 0) return;

            const tracks = engine.tracks.length > 0
                ? engine.tracks
                : [{ id: 'trk_full', index: 0, title: 'Recording 01', artist: '', startSample: 0, endSample: engine.length }];

            if (tracks.length === 1 && !dirHandle) {
                await saveSingleTrack(0);
                return;
            }

            // If browser supports Folder Picker and user hasn't picked one yet, offer to pick a folder once
            if (tracks.length > 1 && !dirHandle && ExportEngine.supportsDirectoryPicker()) {
                await handlePickFolder();
            }

            isExporting = true;
            const zipFiles = [];
            let savedCount = 0;

            try {
                for (let i = 0; i < tracks.length; i++) {
                    const trk = tracks[i];
                    trk.saving = true;
                    renderTracksList();
                    const meta = buildTrackExportMeta(trk, i, tracks.length);
                    const { ext, blob } = await encodeTrackToBlob(trk.startSample, trk.endSample, meta, (pct) => {
                        const overall = Math.round(((i + pct / 100) / tracks.length) * 100);
                        setExportProgress(true, `Encoding track ${i + 1}/${tracks.length}: ${meta.title} (${pct}%)`, overall);
                    });
                    const filename = ExportEngine.buildTrackFilename(meta, i, tracks.length, ext);

                    if (dirHandle) {
                        await ExportEngine.saveBlobToDirectory(dirHandle, filename, blob);
                        trk.saved = true;
                        savedCount++;
                    } else {
                        const bytes = new Uint8Array(await blob.arrayBuffer());
                        zipFiles.push({ name: filename, bytes });
                        trk.saved = true;
                        savedCount++;
                    }
                    trk.saving = false;
                    renderTracksList();
                }

                if (dirHandle) {
                    showToast(`💾 Saved all ${savedCount} tracks directly to your hard drive folder!`, 'success');
                } else if (zipFiles.length > 0) {
                    setExportProgress(true, 'Packaging tracks into ZIP archive...', 98);
                    const zipBlob = ExportEngine.buildZipBlob(zipFiles);
                    const zipName = ExportEngine.sanitizeFilename(albumMetaInput && albumMetaInput.value.trim() ? albumMetaInput.value.trim() : 'MP3audio_Recorded_Tracks') + '.zip';
                    ExportEngine.triggerAnchorDownload(zipBlob, zipName);
                    showToast(`📦 Downloaded ${zipFiles.length} tracks as ${zipName}!`, 'success');
                }
            } catch (err) {
                showToast(`Export error: ${(err && err.message) || err}`, 'error');
            } finally {
                isExporting = false;
                setExportProgress(false);
                tracks.forEach(t => { t.saving = false; });
                renderTracksList();
            }
        }

        // --- Tracks Queue Renderer ---
        function renderTracksList() {
            if (!tracksList || !trackCountBadge) return;
            const tracks = engine.tracks || [];
            trackCountBadge.textContent = `${tracks.length} Track${tracks.length === 1 ? '' : 's'}`;
            if (exportAllLabel) {
                exportAllLabel.textContent = tracks.length > 1
                    ? `Save All ${tracks.length} Tracks to Hard Drive`
                    : 'Save Track to Hard Drive';
            }

            if (tracks.length === 0) {
                tracksList.innerHTML = `
                    <div class="track-row-empty">
                        Recorded songs and silence-split tracks will appear here. Hit <strong>Capture Tab / System Audio</strong> or drag an audio file onto the waveform to begin.
                    </div>
                `;
                return;
            }

            tracksList.innerHTML = '';
            tracks.forEach((trk, idx) => {
                const durSec = Math.max(0, (trk.endSample - trk.startSample) / engine.sampleRate);
                const startStr = formatTimecode(trk.startSample / engine.sampleRate, false);
                const endStr = formatTimecode(trk.endSample / engine.sampleRate, false);
                const durStr = formatTimecode(durSec, false);

                const row = document.createElement('div');
                row.className = 'track-row-card';
                if (engine.isPlaying && engine._playbackRange &&
                    engine._playbackRange.start === trk.startSample &&
                    engine._playbackRange.end === trk.endSample) {
                    row.classList.add('is-playing');
                }

                const numBadge = document.createElement('div');
                numBadge.className = 'track-num-badge';
                numBadge.textContent = String(idx + 1).padStart(2, '0');

                const titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.className = 'studio-input';
                titleInput.value = trk.title || `Track ${idx + 1}`;
                titleInput.placeholder = 'Track Title';
                titleInput.setAttribute('aria-label', `Track ${idx + 1} title`);
                titleInput.addEventListener('input', () => {
                    engine.updateTrackMeta(trk.id, { title: titleInput.value, saved: false });
                });

                const artistInput = document.createElement('input');
                artistInput.type = 'text';
                artistInput.className = 'studio-input';
                artistInput.value = trk.artist || '';
                artistInput.placeholder = albumArtistMetaInput && albumArtistMetaInput.value ? albumArtistMetaInput.value : 'Artist (optional)';
                artistInput.setAttribute('aria-label', `Track ${idx + 1} artist`);
                artistInput.addEventListener('input', () => {
                    engine.updateTrackMeta(trk.id, { artist: artistInput.value, saved: false });
                });

                const timeMeta = document.createElement('div');
                timeMeta.className = 'track-time-meta';
                timeMeta.textContent = `${startStr}–${endStr} (${durStr})`;

                const actions = document.createElement('div');
                actions.className = 'track-row-actions';

                const playTrkBtn = document.createElement('button');
                playTrkBtn.type = 'button';
                playTrkBtn.className = 'row-icon-btn';
                playTrkBtn.title = 'Play this track';
                playTrkBtn.textContent = '▶';
                playTrkBtn.addEventListener('click', () => {
                    engine.setSelection(trk.startSample, trk.endSample);
                    engine.play(trk.startSample, trk.endSample);
                });

                const selTrkBtn = document.createElement('button');
                selTrkBtn.type = 'button';
                selTrkBtn.className = 'row-icon-btn';
                selTrkBtn.title = 'Highlight track on waveform';
                selTrkBtn.textContent = '🎯';
                selTrkBtn.addEventListener('click', () => {
                    engine.setSelection(trk.startSample, trk.endSample);
                    engine.cursorSample = trk.startSample;
                });

                const saveTrkBtn = document.createElement('button');
                saveTrkBtn.type = 'button';
                saveTrkBtn.className = `row-icon-btn row-save-btn${trk.saved ? ' saved' : ''}`;
                saveTrkBtn.title = 'Save this track to hard drive';
                saveTrkBtn.disabled = Boolean(trk.saving);
                saveTrkBtn.textContent = trk.saving ? '⏳ Saving...' : (trk.saved ? '✓ Saved' : '💾 Save');
                saveTrkBtn.addEventListener('click', () => saveSingleTrack(idx));

                actions.appendChild(playTrkBtn);
                actions.appendChild(selTrkBtn);
                actions.appendChild(saveTrkBtn);

                if (idx > 0) {
                    const mergeBtn = document.createElement('button');
                    mergeBtn.type = 'button';
                    mergeBtn.className = 'row-icon-btn';
                    mergeBtn.title = 'Merge with previous track';
                    mergeBtn.textContent = '🔗';
                    mergeBtn.addEventListener('click', () => {
                        engine.mergeTrackWithPrevious(trk.id);
                    });
                    actions.appendChild(mergeBtn);
                }

                if (tracks.length > 1) {
                    const rmBtn = document.createElement('button');
                    rmBtn.type = 'button';
                    rmBtn.className = 'row-icon-btn';
                    rmBtn.title = 'Remove track region';
                    rmBtn.textContent = '✕';
                    rmBtn.addEventListener('click', () => {
                        engine.deleteTrackRegion(trk.id);
                    });
                    actions.appendChild(rmBtn);
                }

                row.appendChild(numBadge);
                row.appendChild(titleInput);
                row.appendChild(artistInput);
                row.appendChild(timeMeta);
                row.appendChild(actions);
                tracksList.appendChild(row);
            });
        }

        // --- UI State Synchronization ---
        function updateUiState() {
            const hasAudio = engine.length > 0;
            const connected = engine.isSourceConnected();
            const isIdle = engine.recordState === 'idle';
            const isRecording = engine.recordState === 'recording';
            const isArmed = engine.recordState === 'armed';
            const isPaused = engine.recordState === 'paused';
            const hasSel = Boolean(engine.selection && engine.selection.endSample > engine.selection.startSample);

            if (waveformEmptyOverlay) {
                waveformEmptyOverlay.classList.toggle('hidden', hasAudio || !isIdle);
            }
            if (disconnectSourceBtn) {
                disconnectSourceBtn.classList.toggle('hidden', !connected);
            }

            if (recordBtn) {
                recordBtn.disabled = !connected;
                recordBtn.classList.toggle('is-recording', isRecording);
                recordBtn.classList.toggle('is-armed', isArmed);
            }
            if (recordBtnLabel) {
                recordBtnLabel.textContent = isRecording
                    ? 'Recording...'
                    : (isArmed ? 'Armed (Waiting)' : (isPaused ? 'Paused' : 'Record'));
            }
            if (pauseRecBtn) {
                pauseRecBtn.disabled = !(isRecording || isPaused);
                pauseRecBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause Rec';
            }
            if (stopBtn) {
                stopBtn.disabled = isIdle && !engine.isPlaying;
            }
            if (playBtn) {
                playBtn.disabled = !hasAudio || !isIdle;
                playBtn.classList.toggle('is-playing', engine.isPlaying);
            }
            if (playBtnIcon) {
                playBtnIcon.textContent = engine.isPlaying ? '⏸ Pause' : '▶ Play';
            }
            if (loopBtn) {
                loopBtn.classList.toggle('is-active', engine.loopPlayback);
            }
            if (splitAtCursorBtn) {
                splitAtCursorBtn.disabled = !hasAudio;
            }

            if (undoBtn) undoBtn.disabled = !engine.canUndo();
            if (redoBtn) redoBtn.disabled = !engine.canRedo();
            if (trimSelBtn) trimSelBtn.disabled = !hasSel || !isIdle;
            if (deleteSelBtn) deleteSelBtn.disabled = !hasSel || !isIdle;
            if (silenceSelBtn) silenceSelBtn.disabled = !hasSel || !isIdle;
            if (fadeInBtn) fadeInBtn.disabled = !hasAudio || !isIdle;
            if (fadeOutBtn) fadeOutBtn.disabled = !hasAudio || !isIdle;
            if (normalizeBtn) normalizeBtn.disabled = !hasAudio || !isIdle;
            if (trimDeadAirBtn) trimDeadAirBtn.disabled = !hasAudio || !isIdle;
            if (clearSessionBtn) clearSessionBtn.disabled = !hasAudio;
            if (scanSplitNowBtn) scanSplitNowBtn.disabled = !hasAudio || !isIdle;
            if (exportSelectionBtn) exportSelectionBtn.disabled = !hasAudio || !isIdle;
            if (exportAllBtn) exportAllBtn.disabled = !hasAudio || !isIdle;

            if (lcdSourceStatus) {
                lcdSourceStatus.classList.remove('is-live', 'is-armed', 'is-ready');
                if (isRecording) {
                    lcdSourceStatus.textContent = '● REC LIVE';
                    lcdSourceStatus.classList.add('is-live');
                } else if (isArmed) {
                    lcdSourceStatus.textContent = '⚡ ARMED';
                    lcdSourceStatus.classList.add('is-armed');
                } else if (isPaused) {
                    lcdSourceStatus.textContent = '⏸ PAUSED';
                    lcdSourceStatus.classList.add('is-armed');
                } else if (connected) {
                    lcdSourceStatus.textContent = `● READY: ${engine.sourceLabel.slice(0, 22)}`;
                    lcdSourceStatus.classList.add('is-ready');
                } else {
                    lcdSourceStatus.textContent = 'STANDBY';
                }
            }
            if (lcdFormatInfo) {
                const dur = formatTimecode(engine.getDurationSeconds(), false);
                lcdFormatInfo.textContent = `${engine.sampleRate} Hz • Stereo 16-bit • Total ${dur}`;
            }

            if (selectionReadout) {
                if (hasSel) {
                    const sSec = engine.selection.startSample / engine.sampleRate;
                    const eSec = engine.selection.endSample / engine.sampleRate;
                    selectionReadout.textContent = `Sel: ${formatTimecode(sSec)} – ${formatTimecode(eSec)} (${formatTimecode(eSec - sSec)})`;
                } else {
                    selectionReadout.textContent = hasAudio
                        ? `Cursor: ${formatTimecode(engine.cursorSample / engine.sampleRate)}`
                        : 'Sel: 00:00.0 – 00:00.0';
                }
            }
        }

        // --- High-DPI Stereo Waveform Canvas Rendering ---
        function sampleToX(sample, width) {
            if (viewSpanSamples <= 0) return 0;
            return ((sample - viewStartSample) / viewSpanSamples) * width;
        }

        function xToSample(x, width) {
            if (width <= 0 || engine.length === 0) return 0;
            const ratio = Math.max(0, Math.min(1, x / width));
            return Math.round(viewStartSample + ratio * viewSpanSamples);
        }

        function drawWaveform() {
            if (!waveformCanvas) return;
            const rect = waveformCanvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const targetW = Math.round(rect.width * dpr);
            const targetH = Math.round(rect.height * dpr);
            if (waveformCanvas.width !== targetW || waveformCanvas.height !== targetH) {
                waveformCanvas.width = targetW;
                waveformCanvas.height = targetH;
            }

            const ctx = waveformCanvas.getContext('2d');
            ctx.save();
            ctx.scale(dpr, dpr);

            const W = rect.width;
            const H = rect.height;
            const RULER_H = 24;
            const LANE_H = 26;
            const WAVE_TOP = RULER_H;
            const WAVE_H = H - RULER_H - LANE_H;
            const MID_Y_L = WAVE_TOP + WAVE_H * 0.25;
            const MID_Y_R = WAVE_TOP + WAVE_H * 0.75;
            const CH_AMP = WAVE_H * 0.22;

            // Background
            ctx.fillStyle = '#070f15';
            ctx.fillRect(0, 0, W, H);

            // Channel background bands & centerlines
            ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
            ctx.fillRect(0, WAVE_TOP, W, WAVE_H * 0.5);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, WAVE_TOP + WAVE_H * 0.5);
            ctx.lineTo(W, WAVE_TOP + WAVE_H * 0.5);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
            ctx.beginPath();
            ctx.moveTo(0, MID_Y_L);
            ctx.lineTo(W, MID_Y_L);
            ctx.moveTo(0, MID_Y_R);
            ctx.lineTo(W, MID_Y_R);
            ctx.stroke();

            // Channel Labels
            ctx.font = 'bold 10px ui-monospace, monospace';
            ctx.fillStyle = 'rgba(143, 160, 170, 0.65)';
            ctx.fillText('L', 8, WAVE_TOP + 14);
            ctx.fillText('R', 8, WAVE_TOP + WAVE_H * 0.5 + 14);

            // Top Time Ruler
            ctx.fillStyle = '#0c161e';
            ctx.fillRect(0, 0, W, RULER_H);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
            ctx.beginPath();
            ctx.moveTo(0, RULER_H - 0.5);
            ctx.lineTo(W, RULER_H - 0.5);
            ctx.stroke();

            // Bottom Track Regions Lane
            ctx.fillStyle = '#0c161e';
            ctx.fillRect(0, H - LANE_H, W, LANE_H);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
            ctx.beginPath();
            ctx.moveTo(0, H - LANE_H + 0.5);
            ctx.lineTo(W, H - LANE_H + 0.5);
            ctx.stroke();

            const total = engine.length;
            if (total > 0 && viewSpanSamples > 0) {
                const startSec = viewStartSample / engine.sampleRate;
                const spanSec = viewSpanSamples / engine.sampleRate;
                const targetTicks = Math.max(4, Math.floor(W / 110));
                const rawStep = spanSec / targetTicks;
                const niceSteps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
                let tickStep = niceSteps[niceSteps.length - 1];
                for (let i = 0; i < niceSteps.length; i++) {
                    if (niceSteps[i] >= rawStep) { tickStep = niceSteps[i]; break; }
                }

                const firstTick = Math.ceil(startSec / tickStep) * tickStep;
                ctx.font = '10px ui-monospace, monospace';
                ctx.fillStyle = '#8fa0aa';
                for (let t = firstTick; t <= startSec + spanSec; t += tickStep) {
                    const x = ((t - startSec) / spanSec) * W;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                    ctx.beginPath();
                    ctx.moveTo(x, RULER_H - 6);
                    ctx.lineTo(x, RULER_H);
                    ctx.stroke();
                    ctx.fillText(formatTimecode(t, tickStep < 1), x + 4, 15);
                }

                // Track Region Alternating Tints & Labels
                const tracks = engine.tracks || [];
                tracks.forEach((trk, idx) => {
                    const x0 = Math.max(0, sampleToX(trk.startSample, W));
                    const x1 = Math.min(W, sampleToX(trk.endSample, W));
                    if (x1 <= 0 || x0 >= W) return;

                    ctx.fillStyle = idx % 2 === 0 ? 'rgba(56, 189, 248, 0.14)' : 'rgba(0, 168, 132, 0.14)';
                    ctx.fillRect(x0, H - LANE_H + 2, Math.max(2, x1 - x0 - 1), LANE_H - 4);
                    ctx.strokeStyle = idx % 2 === 0 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(0, 168, 132, 0.5)';
                    ctx.strokeRect(x0 + 0.5, H - LANE_H + 2.5, Math.max(1, x1 - x0 - 2), LANE_H - 5);

                    if (x1 - x0 > 32) {
                        ctx.fillStyle = '#e9edef';
                        ctx.font = 'bold 11px sans-serif';
                        const label = `${String(idx + 1).padStart(2, '0')} ${trk.title || ''}`;
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(x0 + 4, H - LANE_H, Math.max(0, x1 - x0 - 8), LANE_H);
                        ctx.clip();
                        ctx.fillText(label, x0 + 6, H - 9);
                        ctx.restore();
                    }

                    // Split boundary line between tracks
                    if (idx > 0) {
                        const bx = sampleToX(trk.startSample, W);
                        if (bx >= 0 && bx <= W) {
                            ctx.save();
                            ctx.setLineDash([4, 4]);
                            ctx.strokeStyle = '#f59e0b';
                            ctx.lineWidth = 1.5;
                            ctx.beginPath();
                            ctx.moveTo(bx, WAVE_TOP);
                            ctx.lineTo(bx, H - LANE_H);
                            ctx.stroke();
                            ctx.restore();
                        }
                    }
                });

                // Stereo Waveform Envelope Rendering (512-sample peak cache or raw zoom)
                const samplesPerPx = viewSpanSamples / W;
                const bucketSize = engine.peakBucketSize;
                const usePeakCache = samplesPerPx >= bucketSize && engine.peakCount > 0;

                for (let px = 0; px < W; px++) {
                    const s0 = Math.floor(viewStartSample + px * samplesPerPx);
                    const s1 = Math.min(total, Math.ceil(viewStartSample + (px + 1) * samplesPerPx));
                    if (s0 >= total) break;

                    let minL = 32767, maxL = -32768, minR = 32767, maxR = -32768;
                    if (usePeakCache) {
                        const b0 = Math.floor(s0 / bucketSize);
                        const b1 = Math.min(engine.peakCount - 1, Math.floor(Math.max(s0, s1 - 1) / bucketSize));
                        for (let b = b0; b <= b1; b++) {
                            if (engine.peaksMinL[b] < minL) minL = engine.peaksMinL[b];
                            if (engine.peaksMaxL[b] > maxL) maxL = engine.peaksMaxL[b];
                            if (engine.peaksMinR[b] < minR) minR = engine.peaksMinR[b];
                            if (engine.peaksMaxR[b] > maxR) maxR = engine.peaksMaxR[b];
                        }
                    } else {
                        const step = Math.max(1, Math.floor((s1 - s0) / 32));
                        for (let i = s0; i < s1; i += step) {
                            const lv = engine.left[i];
                            const rv = engine.right[i];
                            if (lv < minL) minL = lv;
                            if (lv > maxL) maxL = lv;
                            if (rv < minR) minR = rv;
                            if (rv > maxR) maxR = rv;
                        }
                    }

                    const clipL = maxL >= 32500 || minL <= -32500;
                    const clipR = maxR >= 32500 || minR <= -32500;

                    const yTopL = MID_Y_L - (maxL / 32768) * CH_AMP;
                    const yBotL = MID_Y_L - (minL / 32768) * CH_AMP;
                    ctx.fillStyle = clipL ? '#ef4444' : '#38bdf8';
                    ctx.fillRect(px, yTopL, 1, Math.max(1.2, yBotL - yTopL));

                    const yTopR = MID_Y_R - (maxR / 32768) * CH_AMP;
                    const yBotR = MID_Y_R - (minR / 32768) * CH_AMP;
                    ctx.fillStyle = clipR ? '#ef4444' : '#22d3ee';
                    ctx.fillRect(px, yTopR, 1, Math.max(1.2, yBotR - yTopR));
                }

                // Selection Highlight Overlay
                if (engine.selection && engine.selection.endSample > engine.selection.startSample) {
                    const sx0 = sampleToX(engine.selection.startSample, W);
                    const sx1 = sampleToX(engine.selection.endSample, W);
                    if (sx1 >= 0 && sx0 <= W) {
                        const cl0 = Math.max(0, sx0);
                        const cl1 = Math.min(W, sx1);
                        ctx.fillStyle = 'rgba(255, 85, 0, 0.18)';
                        ctx.fillRect(cl0, WAVE_TOP, cl1 - cl0, WAVE_H);
                        ctx.strokeStyle = 'rgba(255, 115, 45, 0.9)';
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.moveTo(sx0, WAVE_TOP);
                        ctx.lineTo(sx0, WAVE_TOP + WAVE_H);
                        ctx.moveTo(sx1, WAVE_TOP);
                        ctx.lineTo(sx1, WAVE_TOP + WAVE_H);
                        ctx.stroke();
                    }
                }

                // Playhead / Record Needle
                const headSample = engine.recordState === 'recording'
                    ? engine.length
                    : (engine.isPlaying ? engine.getPlaybackPositionSample() : engine.cursorSample);
                const hx = sampleToX(headSample, W);
                if (hx >= -2 && hx <= W + 2) {
                    ctx.strokeStyle = engine.recordState === 'recording' ? '#ef4444' : '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(hx, RULER_H);
                    ctx.lineTo(hx, H - LANE_H);
                    ctx.stroke();

                    ctx.fillStyle = engine.recordState === 'recording' ? '#ef4444' : '#ff5500';
                    ctx.beginPath();
                    ctx.moveTo(hx - 6, RULER_H - 9);
                    ctx.lineTo(hx + 6, RULER_H - 9);
                    ctx.lineTo(hx, RULER_H);
                    ctx.closePath();
                    ctx.fill();
                }
            }

            ctx.restore();
        }

        // --- Stereo VU Meter Rendering ---
        function drawVuBar(canvas, rmsDb, peakHoldDb) {
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.round(rect.width * dpr);
            const h = Math.round(rect.height * dpr);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.scale(dpr, dpr);
            const W = rect.width;
            const H = rect.height;

            ctx.fillStyle = '#050b10';
            ctx.fillRect(0, 0, W, H);

            const norm = (db) => Math.max(0, Math.min(1, (db + 60) / 60));
            const lvl = norm(rmsDb);
            const grad = ctx.createLinearGradient(0, 0, W, 0);
            grad.addColorStop(0, '#00a884');
            grad.addColorStop(0.7, '#22c55e');
            grad.addColorStop(0.86, '#f59e0b');
            grad.addColorStop(1, '#ef4444');

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, lvl * W, H);

            const holdX = norm(peakHoldDb) * W;
            if (holdX > 2) {
                ctx.fillStyle = peakHoldDb >= -1 ? '#ef4444' : '#ffffff';
                ctx.fillRect(Math.min(W - 2, holdX), 0, 2, H);
            }
            ctx.restore();
        }

        // --- 60 FPS Animation Loop ---
        function animationTick(now) {
            // Update LCD timecode during record/play
            if (lcdTimecode) {
                if (engine.recordState === 'recording') {
                    lcdTimecode.textContent = formatTimecode(engine.getDurationSeconds());
                } else if (engine.isPlaying) {
                    lcdTimecode.textContent = formatTimecode(engine.getPlaybackPositionSample() / engine.sampleRate);
                } else {
                    lcdTimecode.textContent = formatTimecode(engine.cursorSample / engine.sampleRate);
                }
            }

            // Update VU Meters
            const levels = engine.getMeterLevels();
            if (levels.left.peakDb > peakHoldL || now - peakHoldTimeL > 1100) {
                peakHoldL = levels.left.peakDb;
                peakHoldTimeL = now;
            } else {
                peakHoldL = Math.max(-60, peakHoldL - 0.35);
            }
            if (levels.right.peakDb > peakHoldR || now - peakHoldTimeR > 1100) {
                peakHoldR = levels.right.peakDb;
                peakHoldTimeR = now;
            } else {
                peakHoldR = Math.max(-60, peakHoldR - 0.35);
            }
            if (levels.left.clipped) clipUntilL = now + 1500;
            if (levels.right.clipped) clipUntilR = now + 1500;
            if (vuClipL) vuClipL.classList.toggle('clipped', now < clipUntilL);
            if (vuClipR) vuClipR.classList.toggle('clipped', now < clipUntilR);

            drawVuBar(vuMeterL, levels.left.rmsDb, peakHoldL);
            drawVuBar(vuMeterR, levels.right.rmsDb, peakHoldR);

            // Auto-scroll waveform when zoomed during playback
            if (engine.isPlaying && userHasZoomed && viewSpanSamples < engine.length) {
                const pos = engine.getPlaybackPositionSample();
                if (pos < viewStartSample || pos > viewStartSample + viewSpanSamples) {
                    viewStartSample = Math.max(0, Math.min(engine.length - viewSpanSamples, pos - viewSpanSamples * 0.15));
                    syncPanScrollbar();
                }
            }

            drawWaveform();
            requestAnimationFrame(animationTick);
        }

        // --- Waveform Canvas Mouse & Wheel Interactions ---
        if (waveformCanvas) {
            const EDGE_PX = 8;

            waveformCanvas.addEventListener('mousemove', (e) => {
                const rect = waveformCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                if (dragMode) {
                    const curSample = xToSample(x, rect.width);
                    if (Math.abs(x - dragStartX) > 3) hasDraggedBeyondThreshold = true;
                    if (dragMode === 'select') {
                        engine.setSelection(dragAnchorSample, curSample);
                    } else if (dragMode === 'resize-start' && engine.selection) {
                        engine.setSelection(curSample, engine.selection.endSample);
                    } else if (dragMode === 'resize-end' && engine.selection) {
                        engine.setSelection(engine.selection.startSample, curSample);
                    } else if (dragMode === 'move-split' && dragSplitTrackIdx > 0) {
                        const prev = engine.tracks[dragSplitTrackIdx - 1];
                        const curr = engine.tracks[dragSplitTrackIdx];
                        if (prev && curr) {
                            const minGap = Math.round(engine.sampleRate * 0.25);
                            const clamped = Math.max(prev.startSample + minGap, Math.min(curr.endSample - minGap, curSample));
                            prev.endSample = clamped;
                            curr.startSample = clamped;
                            prev.saved = false;
                            curr.saved = false;
                        }
                    }
                    return;
                }

                // Hover cursor feedback
                if (engine.length === 0) {
                    waveformCanvas.style.cursor = 'default';
                    return;
                }
                if (engine.selection) {
                    const sx0 = sampleToX(engine.selection.startSample, rect.width);
                    const sx1 = sampleToX(engine.selection.endSample, rect.width);
                    if (Math.abs(x - sx0) <= EDGE_PX || Math.abs(x - sx1) <= EDGE_PX) {
                        waveformCanvas.style.cursor = 'ew-resize';
                        return;
                    }
                }
                for (let i = 1; i < engine.tracks.length; i++) {
                    const bx = sampleToX(engine.tracks[i].startSample, rect.width);
                    if (Math.abs(x - bx) <= EDGE_PX) {
                        waveformCanvas.style.cursor = 'col-resize';
                        return;
                    }
                }
                waveformCanvas.style.cursor = y > rect.height - 26 ? 'pointer' : 'crosshair';
            });

            waveformCanvas.addEventListener('mousedown', (e) => {
                if (engine.length === 0 || e.button !== 0) return;
                const rect = waveformCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                dragStartX = x;
                hasDraggedBeyondThreshold = false;

                // Click inside bottom Track Regions lane selects that track
                if (y > rect.height - 26) {
                    const clickSample = xToSample(x, rect.width);
                    const hitTrack = engine.tracks.find(t => clickSample >= t.startSample && clickSample <= t.endSample);
                    if (hitTrack) {
                        engine.setSelection(hitTrack.startSample, hitTrack.endSample);
                        engine.cursorSample = hitTrack.startSample;
                        return;
                    }
                }

                // Check selection edge resize
                if (engine.selection) {
                    const sx0 = sampleToX(engine.selection.startSample, rect.width);
                    const sx1 = sampleToX(engine.selection.endSample, rect.width);
                    if (Math.abs(x - sx0) <= EDGE_PX) { dragMode = 'resize-start'; return; }
                    if (Math.abs(x - sx1) <= EDGE_PX) { dragMode = 'resize-end'; return; }
                }

                // Check split marker drag
                for (let i = 1; i < engine.tracks.length; i++) {
                    const bx = sampleToX(engine.tracks[i].startSample, rect.width);
                    if (Math.abs(x - bx) <= EDGE_PX) {
                        dragMode = 'move-split';
                        dragSplitTrackIdx = i;
                        return;
                    }
                }

                dragMode = 'select';
                dragAnchorSample = xToSample(x, rect.width);
            });

            window.addEventListener('mouseup', () => {
                if (!dragMode) return;
                const finishedMode = dragMode;
                dragMode = null;
                if (finishedMode === 'move-split') {
                    renderTracksList();
                } else if (finishedMode === 'select' && !hasDraggedBeyondThreshold) {
                    engine.setSelection(null, null);
                    engine.seek(dragAnchorSample);
                }
                dragSplitTrackIdx = -1;
                updateUiState();
            });

            waveformCanvas.addEventListener('dblclick', (e) => {
                if (engine.length === 0) return;
                const rect = waveformCanvas.getBoundingClientRect();
                const sample = xToSample(e.clientX - rect.left, rect.width);
                const hit = engine.tracks.find(t => sample >= t.startSample && sample <= t.endSample);
                if (hit) {
                    engine.setSelection(hit.startSample, hit.endSample);
                    engine.cursorSample = hit.startSample;
                } else {
                    engine.setSelection(0, engine.length);
                }
            });

            waveformCanvas.addEventListener('wheel', (e) => {
                if (engine.length === 0) return;
                e.preventDefault();
                const rect = waveformCanvas.getBoundingClientRect();
                if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    const delta = e.deltaX || e.deltaY;
                    const panAmount = Math.round((delta / Math.max(100, rect.width)) * viewSpanSamples);
                    viewStartSample += panAmount;
                    clampViewport();
                    syncPanScrollbar();
                    return;
                }
                const factor = e.deltaY < 0 ? 0.8 : 1.25;
                zoomWaveform(factor, (e.clientX - rect.left) / Math.max(1, rect.width));
            }, { passive: false });
        }

        function zoomWaveform(factor, focusRatio = 0.5) {
            if (engine.length === 0) return;
            if (!userHasZoomed) {
                viewStartSample = 0;
                viewSpanSamples = engine.length;
                userHasZoomed = true;
            }
            const focusSample = viewStartSample + focusRatio * viewSpanSamples;
            const nextSpan = Math.round(viewSpanSamples * factor);
            if (nextSpan >= engine.length) {
                userHasZoomed = false;
                viewStartSample = 0;
                viewSpanSamples = engine.length;
            } else {
                const minSpan = Math.min(engine.length, Math.max(256, Math.round(engine.sampleRate * 0.1)));
                viewSpanSamples = Math.max(minSpan, nextSpan);
                viewStartSample = Math.round(focusSample - focusRatio * viewSpanSamples);
            }
            clampViewport();
            syncPanScrollbar();
        }

        // --- Wire All Controls ---
        if (captureTabBtn) captureTabBtn.addEventListener('click', handleCaptureTabClick);
        if (emptyCaptureTabBtn) emptyCaptureTabBtn.addEventListener('click', handleCaptureTabClick);
        if (captureMicBtn) captureMicBtn.addEventListener('click', handleCaptureMicClick);
        if (disconnectSourceBtn) disconnectSourceBtn.addEventListener('click', () => {
            if (engine.recordState !== 'idle') engine.stopRecording();
            engine.disconnectSource();
            showToast('Capture source disconnected.', 'info');
        });

        const triggerFileOpen = () => { if (audioFileInput) audioFileInput.click(); };
        if (openFileBtn) openFileBtn.addEventListener('click', triggerFileOpen);
        if (emptyOpenFileBtn) emptyOpenFileBtn.addEventListener('click', triggerFileOpen);
        if (audioFileInput) {
            audioFileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) handleLoadAudioFile(file);
                audioFileInput.value = '';
            });
        }

        // Global Drag & Drop
        let dragCounter = 0;
        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (dragDropOverlay) dragDropOverlay.classList.remove('hidden');
        });
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter = Math.max(0, dragCounter - 1);
            if (dragCounter === 0 && dragDropOverlay) dragDropOverlay.classList.add('hidden');
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            if (dragDropOverlay) dragDropOverlay.classList.add('hidden');
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleLoadAudioFile(file);
        });

        if (pickFolderBtn) pickFolderBtn.addEventListener('click', handlePickFolder);

        // Transport
        if (recordBtn) {
            recordBtn.addEventListener('click', () => {
                if (engine.recordState === 'idle') {
                    engine.startRecording(engine.length > 0 && confirm('Append new recording to the current waveform? Click Cancel to start fresh.'));
                } else {
                    engine.stopRecording();
                }
            });
        }
        if (pauseRecBtn) {
            pauseRecBtn.addEventListener('click', () => {
                if (engine.recordState === 'recording') engine.pauseRecording();
                else if (engine.recordState === 'paused') engine.resumeRecording();
            });
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                if (engine.recordState !== 'idle') engine.stopRecording();
                if (engine.isPlaying) engine.stopPlayback();
                engine.cursorSample = 0;
                updateUiState();
            });
        }
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (engine.isPlaying) engine.pausePlayback();
                else engine.play();
            });
        }
        if (loopBtn) {
            loopBtn.addEventListener('click', () => {
                engine.loopPlayback = !engine.loopPlayback;
                if (engine.playbackSource) engine.playbackSource.loop = engine.loopPlayback;
                updateUiState();
            });
        }
        if (splitAtCursorBtn) {
            splitAtCursorBtn.addEventListener('click', () => {
                const pos = engine.recordState === 'recording' ? engine.length : engine.cursorSample;
                const trk = engine.addManualSplitMarker(pos);
                if (trk) showToast(`✂️ Split track marker added at ${formatTimecode(pos / engine.sampleRate)}`, 'success');
                else showToast('Place cursor inside a track (away from edges) to split.', 'info');
            });
        }

        if (inputGainSlider) inputGainSlider.addEventListener('input', () => engine.setInputGain(inputGainSlider.value));
        if (playbackVolSlider) playbackVolSlider.addEventListener('input', () => engine.setPlaybackVolume(playbackVolSlider.value));
        if (monitorToggle) monitorToggle.addEventListener('change', () => engine.setMonitorEnabled(monitorToggle.checked));

        // Edit & Zoom Toolbar
        if (undoBtn) undoBtn.addEventListener('click', () => { if (engine.undo()) showToast('↶ Undone', 'info'); });
        if (redoBtn) redoBtn.addEventListener('click', () => { if (engine.redo()) showToast('↷ Redone', 'info'); });
        if (trimSelBtn) trimSelBtn.addEventListener('click', () => { if (engine.trimToSelection()) showToast('✂️ Trimmed waveform to selection', 'success'); });
        if (deleteSelBtn) deleteSelBtn.addEventListener('click', () => { if (engine.deleteSelection()) showToast('🗑️ Cut selected audio', 'info'); });
        if (silenceSelBtn) silenceSelBtn.addEventListener('click', () => { if (engine.silenceSelection()) showToast('🔇 Silenced selection', 'info'); });
        if (fadeInBtn) fadeInBtn.addEventListener('click', () => { if (engine.fadeIn()) showToast('📈 Applied Fade In', 'success'); });
        if (fadeOutBtn) fadeOutBtn.addEventListener('click', () => { if (engine.fadeOut()) showToast('📉 Applied Fade Out', 'success'); });
        if (normalizeBtn) normalizeBtn.addEventListener('click', () => { if (engine.normalize(null, null, -1.0)) showToast('🔊 Normalized peak to -1.0 dBFS', 'success'); });
        if (trimDeadAirBtn) trimDeadAirBtn.addEventListener('click', () => {
            if (engine.trimLeadingTrailingSilence()) showToast('🧹 Trimmed leading & trailing silence', 'success');
            else showToast('No leading/trailing silence above threshold to trim.', 'info');
        });
        if (clearSessionBtn) clearSessionBtn.addEventListener('click', () => {
            engine.clearSession();
            showToast('Cleared waveform session', 'info');
        });
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoomWaveform(0.6));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoomWaveform(1.6));
        if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => {
            userHasZoomed = false;
            viewStartSample = 0;
            viewSpanSamples = engine.length;
            syncPanScrollbar();
        });
        if (waveformPanSlider) {
            waveformPanSlider.addEventListener('input', () => {
                if (engine.length === 0 || !userHasZoomed) return;
                const maxStart = Math.max(0, engine.length - viewSpanSamples);
                viewStartSample = Math.round((Number(waveformPanSlider.value) / 1000) * maxStart);
                clampViewport();
            });
        }

        // Auto-Split Panel Bindings
        const syncSettingsToEngine = () => {
            const thresholdDb = thresholdDbSlider ? Number(thresholdDbSlider.value) : -42;
            const minSilenceSec = minSilenceSlider ? Number(minSilenceSlider.value) : 1.5;
            const minTrackSec = minTrackSlider ? Number(minTrackSlider.value) : 10;
            if (thresholdDbVal) thresholdDbVal.textContent = `${thresholdDb} dB`;
            if (minSilenceVal) minSilenceVal.textContent = `${minSilenceSec.toFixed(1)} s`;
            if (minTrackVal) minTrackVal.textContent = `${minTrackSec} s`;

            engine.updateSettings({
                liveAutoSplit: liveAutoSplitToggle ? liveAutoSplitToggle.checked : true,
                soundActivated: soundActivatedToggle ? soundActivatedToggle.checked : false,
                autoTrimSilence: autoTrimSilenceToggle ? autoTrimSilenceToggle.checked : true,
                thresholdDb,
                minSilenceSec,
                minTrackSec
            });
        };

        [liveAutoSplitToggle, soundActivatedToggle, autoTrimSilenceToggle, thresholdDbSlider, minSilenceSlider, minTrackSlider].forEach(el => {
            if (el) el.addEventListener('input', syncSettingsToEngine);
            if (el) el.addEventListener('change', syncSettingsToEngine);
        });
        syncSettingsToEngine();

        if (scanSplitNowBtn) {
            scanSplitNowBtn.addEventListener('click', () => {
                const tracks = engine.scanAndAutoSplit();
                showToast(`🔍 Detected ${tracks.length} track${tracks.length === 1 ? '' : 's'} by silence gaps!`, 'success');
            });
        }

        // Cover Art Picker
        if (coverArtPickerBtn && coverArtInput) {
            coverArtPickerBtn.addEventListener('click', () => coverArtInput.click());
            coverArtInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                try {
                    const buf = await file.arrayBuffer();
                    coverArtBytes = new Uint8Array(buf);
                    coverArtMime = file.type || 'image/jpeg';
                    const reader = new FileReader();
                    reader.onload = () => {
                        if (coverArtPreview) {
                            coverArtPreview.src = String(reader.result);
                            coverArtPreview.classList.remove('hidden');
                        }
                        if (coverArtPlaceholder) coverArtPlaceholder.classList.add('hidden');
                    };
                    reader.readAsDataURL(file);
                    showToast('🎨 Embedded cover art loaded for MP3 ID3 tags', 'success');
                } catch (_) {
                    showToast('Could not read cover art image.', 'error');
                }
            });
        }

        // Export Format Bitrate Toggle
        if (exportFormatSelect && exportBitrateSelect) {
            exportFormatSelect.addEventListener('change', () => {
                exportBitrateSelect.disabled = exportFormatSelect.value === 'wav';
            });
        }
        if (exportSelectionBtn) exportSelectionBtn.addEventListener('click', exportSelectionToDisk);
        if (exportAllBtn) exportAllBtn.addEventListener('click', exportAllTracksToHardDrive);

        // Keyboard Shortcuts (Audacity style)
        document.addEventListener('keydown', (e) => {
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;

            const mod = e.ctrlKey || e.metaKey;
            if (e.code === 'Space') {
                e.preventDefault();
                if (engine.length > 0 && engine.recordState === 'idle') {
                    if (engine.isPlaying) engine.pausePlayback();
                    else engine.play();
                }
            } else if (!mod && (e.key === 'r' || e.key === 'R')) {
                if (engine.isSourceConnected()) {
                    e.preventDefault();
                    if (engine.recordState === 'idle') engine.startRecording(false);
                    else engine.stopRecording();
                }
            } else if (!mod && (e.key === 'p' || e.key === 'P')) {
                if (engine.recordState === 'recording') engine.pauseRecording();
                else if (engine.recordState === 'paused') engine.resumeRecording();
            } else if (!mod && (e.key === 'm' || e.key === 'M')) {
                if (engine.length > 0) {
                    const pos = engine.recordState === 'recording' ? engine.length : engine.cursorSample;
                    if (engine.addManualSplitMarker(pos)) showToast('✂️ Split marker added', 'success');
                }
            } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (engine.selection && engine.recordState === 'idle') {
                    e.preventDefault();
                    engine.deleteSelection();
                }
            } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                engine.undo();
            } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
                e.preventDefault();
                engine.redo();
            } else if (mod && e.key.toLowerCase() === 't') {
                if (engine.selection && engine.recordState === 'idle') {
                    e.preventDefault();
                    engine.trimToSelection();
                }
            } else if (mod && e.key.toLowerCase() === 'l') {
                if (engine.selection && engine.recordState === 'idle') {
                    e.preventDefault();
                    engine.silenceSelection();
                }
            } else if (mod && e.key.toLowerCase() === 's') {
                if (engine.length > 0 && engine.recordState === 'idle') {
                    e.preventDefault();
                    exportAllTracksToHardDrive();
                }
            } else if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                zoomWaveform(0.65);
            } else if (e.key === '-') {
                e.preventDefault();
                zoomWaveform(1.5);
            } else if (e.key === 'Home') {
                engine.seek(0);
            } else if (e.key === 'End') {
                engine.seek(engine.length);
            }
        });

        // Default year metadata
        if (yearMetaInput && !yearMetaInput.value) {
            yearMetaInput.value = String(new Date().getFullYear());
        }

        // Disable folder button cleanly on browsers without File System Access API
        if (pickFolderBtn && !ExportEngine.supportsDirectoryPicker()) {
            pickFolderBtn.title = 'Folder picker is supported in Chrome/Edge desktop. Exports will save via browser Downloads / ZIP.';
            if (pickFolderLabel) pickFolderLabel.textContent = 'Save Mode: Browser Downloads';
        }

        refreshMicDevices();
        renderTracksList();
        updateUiState();
        requestAnimationFrame(animationTick);
    }

    // Modal Helpers
    window.openModal = function (id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'flex';
    };
    window.closeModal = function (id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    };
    window.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStudioApp);
    } else {
        initStudioApp();
    }
})();
