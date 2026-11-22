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

        // --- Capability & Platform Detection ---
        const isMobileUa = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
        const supportsDisplayCapture = !isMobileUa && Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');
        const supportsFolderPicker = !isMobileUa && ExportEngine.supportsDirectoryPicker();

        // --- DOM Elements ---
        const guidedStepBanner = document.getElementById('guidedStepBanner');
        const captureTabBtn = document.getElementById('captureTabBtn');
        const emptyCaptureTabBtn = document.getElementById('emptyCaptureTabBtn');
        const captureMicBtn = document.getElementById('captureMicBtn');
        const captureMicLabel = document.getElementById('captureMicLabel');
        const emptyCaptureMicBtn = document.getElementById('emptyCaptureMicBtn');
        const micDeviceSelect = document.getElementById('micDeviceSelect');
        const openFileBtn = document.getElementById('openFileBtn');
        const emptyOpenFileBtn = document.getElementById('emptyOpenFileBtn');
        const audioFileInput = document.getElementById('audioFileInput');
        const dragDropOverlay = document.getElementById('dragDropOverlay');
        const pickFolderBtn = document.getElementById('pickFolderBtn');
        const pickFolderLabel = document.getElementById('pickFolderLabel');
        const disconnectSourceBtn = document.getElementById('disconnectSourceBtn');
        const mobileHintBanner = document.getElementById('mobileHintBanner');
        const emptyCardDesc = document.getElementById('emptyCardDesc');

        // Transport & Equalizer & Meters
        const recordBtn = document.getElementById('recordBtn');
        const recordBtnLabel = document.getElementById('recordBtnLabel');
        const pauseRecBtn = document.getElementById('pauseRecBtn');
        const stopBtn = document.getElementById('stopBtn');
        const playBtn = document.getElementById('playBtn');
        const playBtnIcon = document.getElementById('playBtnIcon');
        const loopBtn = document.getElementById('loopBtn');
        const splitAtCursorBtn = document.getElementById('splitAtCursorBtn');
        const lcdTimecode = document.getElementById('lcdTimecode');
        const lcdFormatInfo = document.getElementById('lcdFormatInfo');
        const eqStatusBadge = document.getElementById('eqStatusBadge');
        const eqTrackTitle = document.getElementById('eqTrackTitle');
        const eqTrackSub = document.getElementById('eqTrackSub');
        const equalizerCanvas = document.getElementById('equalizerCanvas');
        const eqPresetBtns = document.querySelectorAll('.eq-preset-btn[data-eq-preset]');
        const vuMeterL = document.getElementById('vuMeterL');
        const vuMeterR = document.getElementById('vuMeterR');
        const vuClipL = document.getElementById('vuClipL');
        const vuClipR = document.getElementById('vuClipR');
        const inputGainSlider = document.getElementById('inputGainSlider');
        const playbackVolSlider = document.getElementById('playbackVolSlider');
        const monitorToggle = document.getElementById('monitorToggle');

        // Edit & Zoom Controls
        const waveformToolsBar = document.getElementById('waveformToolsBar');
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
        const autoSaveLiveRow = document.getElementById('autoSaveLiveRow');
        const autoSaveLiveToggle = document.getElementById('autoSaveLiveToggle');
        const thresholdDbSlider = document.getElementById('thresholdDbSlider');
        const thresholdDbVal = document.getElementById('thresholdDbVal');
        const minSilenceSlider = document.getElementById('minSilenceSlider');
        const minSilenceVal = document.getElementById('minSilenceVal');
        const minTrackSlider = document.getElementById('minTrackSlider');
        const minTrackVal = document.getElementById('minTrackVal');
        const scanSplitNowBtn = document.getElementById('scanSplitNowBtn');
        const quickAutoSplitBtn = document.getElementById('quickAutoSplitBtn');

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
        const exportPresetSelect = document.getElementById('exportPresetSelect');
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
        let viewSpanSamples = 0;
        let userHasZoomed = false;

        // Meter & Equalizer Peak State
        const EQ_NUM_BANDS = 32;
        const eqSmoothBars = new Float32Array(EQ_NUM_BANDS);
        const eqPeakCaps = new Float32Array(EQ_NUM_BANDS);
        let staticSpectrumCache = new Float32Array(EQ_NUM_BANDS);
        let staticSpectrumCursor = -1;
        let staticSpectrumLen = -1;
        let peakHoldL = -60;
        let peakHoldR = -60;
        let peakHoldTimeL = 0;
        let peakHoldTimeR = 0;
        let clipUntilL = 0;
        let clipUntilR = 0;

        // Pointer drag state on waveform
        let activePointerId = null;
        let dragMode = null;
        let dragAnchorSample = 0;
        let dragSplitTrackIdx = -1;
        let hasDraggedBeyondThreshold = false;
        let dragStartX = 0;
        let lastTapTime = 0;
        let lastTapX = 0;

        // Apply Capability Adaptations (Mobile vs Desktop)
        if (!supportsDisplayCapture) {
            if (captureTabBtn) captureTabBtn.classList.add('hidden');
            if (emptyCaptureTabBtn) emptyCaptureTabBtn.classList.add('hidden');
            if (captureMicBtn) captureMicBtn.classList.add('studio-btn-primary');
            if (captureMicLabel) captureMicLabel.textContent = 'Tap to Record';
            if (emptyCaptureMicBtn) emptyCaptureMicBtn.classList.remove('hidden');
            if (mobileHintBanner) mobileHintBanner.classList.remove('hidden');
            if (emptyCardDesc) {
                emptyCardDesc.textContent = 'Record audio from your mic or external interface, or open any audio file to watch it live on the equalizer, auto-split songs, and save MP3s.';
            }
        }
        if (!supportsFolderPicker) {
            if (pickFolderBtn) pickFolderBtn.classList.add('hidden');
            if (autoSaveLiveRow) autoSaveLiveRow.classList.add('hidden');
        }

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
            setTimeout(() => { try { toast.remove(); } catch (_) { } }, 4000);
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
                zoomLevelBadge.textContent = '1.0x';
                return;
            }
            waveformPanSlider.disabled = false;
            const maxStart = Math.max(1, total - viewSpanSamples);
            waveformPanSlider.value = String(Math.round((viewStartSample / maxStart) * 1000));
            const zoomFactor = total / viewSpanSamples;
            zoomLevelBadge.textContent = `${zoomFactor.toFixed(1)}x`;
        }

        function getSelectedPreset() {
            const raw = exportPresetSelect ? exportPresetSelect.value : 'mp3:192';
            const [fmt, kbpsStr] = raw.split(':');
            return { fmt: fmt || 'mp3', kbps: parseInt(kbpsStr, 10) || 192 };
        }

        // --- Instantiate Audio Engine ---
        const engine = new AudioEngineClass({
            onSourceConnected: ({ mode, label, sampleRate }) => {
                updateUiState();
                showToast(`Connected ${mode === 'display' ? 'Music Tab / Stream' : 'Mic'}: ${label} (${sampleRate} Hz)`, 'success');
            },
            onSourceDisconnected: () => {
                updateUiState();
            },
            onSourceEnded: () => {
                showToast('Capture stopped — your track is ready below!', 'info');
                updateUiState();
            },
            onRecordStateChanged: ({ state }) => {
                if (state === 'armed') {
                    showToast('Armed — waiting for music to start playing...', 'warning');
                }
                updateUiState();
            },
            onPlaybackStateChanged: () => {
                updateUiState();
                renderTracksList();
            },
            onTracksChanged: () => {
                staticSpectrumCursor = -1;
                renderTracksList();
                updateUiState();
            },
            onTrackAutoSplit: (track) => {
                showToast(`✂️ Split Track ${track.index + 1} (${formatTimecode((track.endSample - track.startSample) / engine.sampleRate, false)})`, 'success');
                renderTracksList();
                if (autoSaveLiveToggle && autoSaveLiveToggle.checked && dirHandle) {
                    queueLiveAutoSaveTrack(track);
                }
            },
            onBufferChanged: ({ length }) => {
                staticSpectrumLen = -1;
                if (length === 0) {
                    userHasZoomed = false;
                    viewStartSample = 0;
                    viewSpanSamples = 0;
                } else if (!userHasZoomed) {
                    viewStartSample = 0;
                    viewSpanSamples = length;
                } else if (engine.recordState === 'recording') {
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

        // --- Equalizer Active Track & Guided Step Readout ---
        let lastEqTitle = '';
        let lastEqSub = '';
        let lastEqBadge = '';

        function syncEqualizerTrackDisplay() {
            const trk = engine.getActiveTrackInfo();
            const isRec = engine.recordState === 'recording';
            const isArmed = engine.recordState === 'armed';
            const isPaused = engine.recordState === 'paused';
            const isPlay = engine.isPlaying;
            const connected = engine.isSourceConnected();

            let badgeText = 'STANDBY';
            let badgeClass = 'eq-status-badge';
            let titleText = 'No Track Active — Ready to Record';
            let subText = supportsDisplayCapture
                ? 'Tap Record Music Tab, Use Mic, or Open Audio to see your track live on the equalizer'
                : 'Tap Tap to Record or Open Audio to see your track live on the equalizer';

            if (isRec) {
                badgeText = '● RECORDING';
                badgeClass += ' is-live';
                titleText = `🎵 ${(trk && trk.title) || 'Track 01'}`;
                subText = `Live on Equalizer • Source: ${(trk && trk.artist) || engine.sourceLabel || 'Audio Stream'} • Auto-split active`;
            } else if (isArmed) {
                badgeText = '⚡ ARMED';
                badgeClass += ' is-live';
                titleText = 'Waiting for Music to Start...';
                subText = `Listening on ${engine.sourceLabel || 'Audio Input'} — recording begins automatically`;
            } else if (isPaused) {
                badgeText = '⏸ REC PAUSED';
                badgeClass += ' is-ready';
                titleText = `🎵 ${(trk && trk.title) || 'Track 01'}`;
                subText = 'Recording paused — tap Pause again to resume or Stop to finish';
            } else if (isPlay && trk) {
                badgeText = '▶ PLAYING';
                badgeClass += ' is-playing';
                const totalTracks = Math.max(1, engine.tracks.length);
                titleText = `🎵 ${trk.title}${trk.artist ? ' — ' + trk.artist : ''}`;
                subText = `Track ${trk.index + 1} of ${totalTracks} • ${formatTimecode(trk.durationSec, false)} • Live Equalizer Active`;
            } else if (trk && engine.length > 0) {
                badgeText = '● TRACK LOADED';
                badgeClass += ' is-ready';
                const totalTracks = Math.max(1, engine.tracks.length);
                titleText = `🎵 ${trk.title}${trk.artist ? ' — ' + trk.artist : ''}`;
                subText = `Track ${trk.index + 1} of ${totalTracks} • ${formatTimecode(trk.durationSec, false)} • Tap ▶ Play to animate live EQ or 💾 Save`;
            } else if (connected) {
                badgeText = '● INPUT READY';
                badgeClass += ' is-ready';
                titleText = `Connected: ${engine.sourceLabel || 'Audio Input'}`;
                subText = 'Monitoring input on equalizer — tap red Record to capture';
            }

            if (eqStatusBadge && (badgeText !== lastEqBadge || eqStatusBadge.className !== badgeClass)) {
                eqStatusBadge.textContent = badgeText;
                eqStatusBadge.className = badgeClass;
                lastEqBadge = badgeText;
            }
            if (eqTrackTitle && titleText !== lastEqTitle) {
                eqTrackTitle.textContent = titleText;
                lastEqTitle = titleText;
            }
            if (eqTrackSub && subText !== lastEqSub) {
                eqTrackSub.textContent = subText;
                lastEqSub = subText;
            }
        }

        function syncGuidedStepBanner() {
            if (!guidedStepBanner) return;
            if (engine.recordState === 'recording') {
                guidedStepBanner.innerHTML = '🔴 <strong>Recording live!</strong> Play your tracks — quiet gaps split songs automatically, or tap <strong>✂️ Split Song</strong> anytime.';
            } else if (engine.recordState === 'armed') {
                guidedStepBanner.innerHTML = '⚡ <strong>Armed:</strong> Hit Play on your music stream and recording will begin the instant sound starts.';
            } else if (engine.isPlaying) {
                guidedStepBanner.innerHTML = '🎧 <strong>Playing on Equalizer:</strong> Switch EQ presets (<em>Flat / Bass Boost / Vocal / Warm</em>) or drag the waveform to trim.';
            } else if (engine.length > 0) {
                const n = engine.tracks.length;
                guidedStepBanner.innerHTML = `✅ <strong>Ready to Save!</strong> ${n} track${n === 1 ? '' : 's'} detected — edit names below or tap <strong>💾 Save</strong>.`;
            } else if (supportsDisplayCapture) {
                guidedStepBanner.innerHTML = '✨ <strong>Step 1:</strong> Tap <strong>Record Music Tab</strong> (or <strong>Open Audio</strong>) — songs automatically split on quiet gaps.';
            } else {
                guidedStepBanner.innerHTML = '✨ <strong>Step 1:</strong> Tap <strong>Tap to Record</strong> or <strong>Open Audio</strong> to visualize your track and save MP3s.';
            }
        }

        // --- Source Connection Handlers ---
        async function handleCaptureTabClick() {
            try {
                await engine.connectDisplayAudio();
                userHasZoomed = false;
                engine.startRecording(false);
                showToast('Recording live! Play music in your shared tab.', 'success');
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
                opt.textContent = 'Default Microphone / Input';
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
                showToast((err && err.message) || 'Could not access microphone / audio input.', 'error');
            }
        }

        async function handleLoadAudioFile(file) {
            if (!file) return;
            try {
                showToast(`Loading ${file.name}...`, 'info');
                const info = await engine.importAudioFile(file);
                if (albumArtistMetaInput && info.artist && !albumArtistMetaInput.value) {
                    albumArtistMetaInput.value = info.artist;
                }
                userHasZoomed = false;
                clampViewport();
                syncPanScrollbar();
                renderTracksList();
                updateUiState();
                showToast(`Loaded "${file.name}" onto equalizer (${formatTimecode(info.length / info.sampleRate, false)})`, 'success');
            } catch (err) {
                showToast(`Could not decode audio file: ${(err && err.message) || 'Unsupported format'}`, 'error');
            }
        }

        // --- Folder Selection & Live Auto-Save ---
        async function handlePickFolder() {
            if (!ExportEngine.supportsDirectoryPicker()) {
                showToast('Folder saving requires Chrome or Edge on desktop.', 'info');
                return null;
            }
            try {
                const res = await ExportEngine.pickSaveDirectory();
                dirHandle = res.handle;
                if (pickFolderBtn) pickFolderBtn.classList.add('connected');
                if (pickFolderLabel) pickFolderLabel.textContent = res.name;
                showToast(`📁 Connected folder "${res.name}"`, 'success');
                return dirHandle;
            } catch (err) {
                if (!err || err.name !== 'AbortError') {
                    showToast((err && err.message) || 'Could not select folder.', 'error');
                }
                return null;
            }
        }

        async function encodeTrackToBlob(startSample, endSample, meta, onProgress) {
            const slice = engine.getSlice(startSample, endSample);
            const { fmt, kbps } = getSelectedPreset();
            if (fmt === 'wav') {
                if (typeof onProgress === 'function') onProgress(100);
                return {
                    ext: 'wav',
                    blob: ExportEngine.encodeWavBlob(slice.left, slice.right, slice.sampleRate)
                };
            }
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
                    const meta = buildTrackExportMeta(track, track.index, Math.max(track.index + 1, engine.tracks.length));
                    const { ext, blob } = await encodeTrackToBlob(track.startSample, track.endSample, meta);
                    const filename = ExportEngine.buildTrackFilename(meta, track.index, Math.max(track.index + 1, engine.tracks.length), ext);
                    await ExportEngine.saveBlobToDirectory(dirHandle, filename, blob);
                    track.saving = false;
                    track.saved = true;
                    renderTracksList();
                    showToast(`💾 Auto-saved "${filename}"`, 'success');
                } catch (err) {
                    track.saving = false;
                    renderTracksList();
                    showToast(`Auto-save warning: ${(err && err.message) || err}`, 'error');
                }
            });
        }

        // --- Export / Save / Share Flows ---
        function setExportProgress(visible, labelText = '', pct = 0) {
            if (!exportProgressWrap) return;
            exportProgressWrap.classList.toggle('hidden', !visible);
            if (exportProgressLabel && labelText) exportProgressLabel.textContent = labelText;
            if (exportProgressFill) exportProgressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        }

        async function saveSingleTrack(trackIdx, useNativeShare = false) {
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
                const res = useNativeShare
                    ? await ExportEngine.shareBlobFile(blob, filename)
                    : await ExportEngine.saveBlobWithPickerOrDownload(blob, filename, ext, dirHandle);
                track.saving = false;
                if (res.method !== 'cancelled') {
                    track.saved = true;
                    showToast(`💾 ${res.method === 'share' ? 'Shared' : 'Saved'} ${res.filename}`, 'success');
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
                await saveSingleTrack(0, false);
                return;
            }

            if (tracks.length > 1 && !dirHandle && supportsFolderPicker) {
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
                    showToast(`💾 Saved all ${savedCount} tracks to your folder!`, 'success');
                } else if (zipFiles.length > 0) {
                    setExportProgress(true, 'Packaging ZIP archive...', 98);
                    const zipBlob = ExportEngine.buildZipBlob(zipFiles);
                    const zipName = ExportEngine.sanitizeFilename(albumMetaInput && albumMetaInput.value.trim() ? albumMetaInput.value.trim() : 'MP3audio_Recorded_Tracks') + '.zip';
                    ExportEngine.triggerAnchorDownload(zipBlob, zipName);
                    showToast(`📦 Saved ${zipFiles.length} tracks as ${zipName}!`, 'success');
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
                const targetNoun = supportsFolderPicker ? 'Hard Drive' : 'Device';
                exportAllLabel.textContent = tracks.length > 1
                    ? `Save All ${tracks.length} Tracks to ${targetNoun}`
                    : `Save Track to ${targetNoun}`;
            }

            if (tracks.length === 0) {
                tracksList.innerHTML = `
                    <div class="track-row-empty">
                        Your recorded songs and silence-split tracks appear here. Ready to record or open an audio file.
                    </div>
                `;
                return;
            }

            tracksList.innerHTML = '';
            const showMobileShare = isMobileUa && ExportEngine.canShareFiles();

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

                const mainRow = document.createElement('div');
                mainRow.className = 'track-row-main';

                const numBadge = document.createElement('div');
                numBadge.className = 'track-num-badge';
                numBadge.textContent = String(idx + 1).padStart(2, '0');

                const titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.className = 'studio-input track-title-input';
                titleInput.value = trk.title || `Track ${idx + 1}`;
                titleInput.placeholder = 'Track Title';
                titleInput.setAttribute('aria-label', `Track ${idx + 1} title`);
                titleInput.addEventListener('input', () => {
                    engine.updateTrackMeta(trk.id, { title: titleInput.value, saved: false });
                    syncEqualizerTrackDisplay();
                });

                const actions = document.createElement('div');
                actions.className = 'track-row-actions';

                const playTrkBtn = document.createElement('button');
                playTrkBtn.type = 'button';
                playTrkBtn.className = 'row-icon-btn';
                playTrkBtn.title = 'Play on equalizer';
                playTrkBtn.textContent = '▶ Play';
                playTrkBtn.addEventListener('click', () => {
                    engine.setSelection(trk.startSample, trk.endSample);
                    engine.play(trk.startSample, trk.endSample);
                });

                const saveTrkBtn = document.createElement('button');
                saveTrkBtn.type = 'button';
                saveTrkBtn.className = `row-icon-btn row-save-btn${trk.saved ? ' saved' : ''}`;
                saveTrkBtn.title = 'Save this track';
                saveTrkBtn.disabled = Boolean(trk.saving);
                saveTrkBtn.textContent = trk.saving ? '⏳...' : (trk.saved ? '✓ Saved' : '💾 Save');
                saveTrkBtn.addEventListener('click', () => saveSingleTrack(idx, false));

                actions.appendChild(playTrkBtn);
                actions.appendChild(saveTrkBtn);

                if (showMobileShare) {
                    const shareBtn = document.createElement('button');
                    shareBtn.type = 'button';
                    shareBtn.className = 'row-icon-btn';
                    shareBtn.title = 'Share audio file';
                    shareBtn.disabled = Boolean(trk.saving);
                    shareBtn.textContent = '📤';
                    shareBtn.addEventListener('click', () => saveSingleTrack(idx, true));
                    actions.appendChild(shareBtn);
                }

                mainRow.appendChild(numBadge);
                mainRow.appendChild(titleInput);
                mainRow.appendChild(actions);

                const subRow = document.createElement('div');
                subRow.className = 'track-row-sub';

                const artistInput = document.createElement('input');
                artistInput.type = 'text';
                artistInput.className = 'studio-input track-artist-input';
                artistInput.value = trk.artist || '';
                artistInput.placeholder = albumArtistMetaInput && albumArtistMetaInput.value ? albumArtistMetaInput.value : 'Artist (optional)';
                artistInput.setAttribute('aria-label', `Track ${idx + 1} artist`);
                artistInput.addEventListener('input', () => {
                    engine.updateTrackMeta(trk.id, { artist: artistInput.value, saved: false });
                    syncEqualizerTrackDisplay();
                });

                const timeMeta = document.createElement('div');
                timeMeta.className = 'track-time-meta';
                timeMeta.textContent = `${startStr}–${endStr} (${durStr})`;

                const subTools = document.createElement('div');
                subTools.className = 'track-sub-tools';

                const selTrkBtn = document.createElement('button');
                selTrkBtn.type = 'button';
                selTrkBtn.className = 'row-icon-btn';
                selTrkBtn.title = 'Focus on equalizer & waveform';
                selTrkBtn.textContent = '🎯';
                selTrkBtn.addEventListener('click', () => {
                    engine.setSelection(trk.startSample, trk.endSample);
                    engine.cursorSample = trk.startSample;
                    updateUiState();
                });
                subTools.appendChild(selTrkBtn);

                if (idx > 0) {
                    const mergeBtn = document.createElement('button');
                    mergeBtn.type = 'button';
                    mergeBtn.className = 'row-icon-btn';
                    mergeBtn.title = 'Merge with previous track';
                    mergeBtn.textContent = '🔗';
                    mergeBtn.addEventListener('click', () => engine.mergeTrackWithPrevious(trk.id));
                    subTools.appendChild(mergeBtn);
                }

                if (tracks.length > 1) {
                    const rmBtn = document.createElement('button');
                    rmBtn.type = 'button';
                    rmBtn.className = 'row-icon-btn';
                    rmBtn.title = 'Remove track';
                    rmBtn.textContent = '✕';
                    rmBtn.addEventListener('click', () => engine.deleteTrackRegion(trk.id));
                    subTools.appendChild(rmBtn);
                }

                subRow.appendChild(artistInput);
                subRow.appendChild(timeMeta);
                subRow.appendChild(subTools);

                row.appendChild(mainRow);
                row.appendChild(subRow);
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
            if (waveformToolsBar) {
                waveformToolsBar.classList.toggle('hidden', !hasAudio);
            }
            if (disconnectSourceBtn) {
                disconnectSourceBtn.classList.toggle('hidden', !connected);
            }
            if (pauseRecBtn) {
                pauseRecBtn.classList.toggle('hidden', isIdle);
                pauseRecBtn.disabled = !(isRecording || isPaused);
                pauseRecBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
            }
            if (exportSelectionBtn) {
                exportSelectionBtn.classList.toggle('hidden', !hasSel);
                exportSelectionBtn.disabled = !hasSel || !isIdle;
            }

            if (recordBtn) {
                // Keep 1-click Record always enabled! Auto-connects source if idle & disconnected
                recordBtn.disabled = false;
                recordBtn.classList.toggle('is-recording', isRecording);
                recordBtn.classList.toggle('is-armed', isArmed);
            }
            if (recordBtnLabel) {
                recordBtnLabel.textContent = isRecording
                    ? 'Stop Rec'
                    : (isArmed ? 'Armed (Stop)' : (isPaused ? 'Stop Rec' : 'Record'));
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
            if (quickAutoSplitBtn) quickAutoSplitBtn.disabled = !hasAudio || !isIdle;
            if (exportAllBtn) exportAllBtn.disabled = !hasAudio || !isIdle;

            if (lcdFormatInfo) {
                const dur = formatTimecode(engine.getDurationSeconds(), false);
                lcdFormatInfo.textContent = `${(engine.sampleRate / 1000).toFixed(1)} kHz • ${dur}`;
            }

            if (selectionReadout) {
                if (hasSel) {
                    const sSec = engine.selection.startSample / engine.sampleRate;
                    const eSec = engine.selection.endSample / engine.sampleRate;
                    selectionReadout.textContent = `Sel: ${formatTimecode(sSec)}–${formatTimecode(eSec)}`;
                } else {
                    selectionReadout.textContent = `Cursor: ${formatTimecode(engine.cursorSample / engine.sampleRate)}`;
                }
            }

            syncEqualizerTrackDisplay();
            syncGuidedStepBanner();
        }

        // --- 32-Band Live Graphic Equalizer Renderer ---
        function drawEqualizer() {
            if (!equalizerCanvas) return;
            const rect = equalizerCanvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.round(rect.width * dpr);
            const h = Math.round(rect.height * dpr);
            if (equalizerCanvas.width !== w || equalizerCanvas.height !== h) {
                equalizerCanvas.width = w;
                equalizerCanvas.height = h;
            }

            const ctx = equalizerCanvas.getContext('2d');
            ctx.save();
            ctx.scale(dpr, dpr);

            const W = rect.width;
            const H = rect.height;

            ctx.fillStyle = '#04090e';
            ctx.fillRect(0, 0, W, H);

            // Subtle horizontal dB grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            for (let g = 1; g <= 3; g++) {
                const gy = Math.round((H * g) / 4) + 0.5;
                ctx.beginPath();
                ctx.moveTo(0, gy);
                ctx.lineTo(W, gy);
                ctx.stroke();
            }

            const freqInfo = engine.getFrequencyData();
            const isLiveMode = freqInfo.active && (engine.isPlaying || engine.isSourceConnected());
            let targetBars = null;

            if (isLiveMode && freqInfo.bins && freqInfo.bins.length > 0) {
                targetBars = new Float32Array(EQ_NUM_BANDS);
                const binCount = freqInfo.bins.length;
                for (let b = 0; b < EQ_NUM_BANDS; b++) {
                    // Logarithmic bin mapping across 32 visual bands
                    const f0 = Math.floor(Math.pow(b / EQ_NUM_BANDS, 1.55) * (binCount - 1));
                    const f1 = Math.max(f0 + 1, Math.ceil(Math.pow((b + 1) / EQ_NUM_BANDS, 1.55) * (binCount - 1)));
                    let peak = 0;
                    for (let k = f0; k < Math.min(binCount, f1); k++) {
                        if (freqInfo.bins[k] > peak) peak = freqInfo.bins[k];
                    }
                    targetBars[b] = peak / 255;
                }
            } else if (engine.length > 0) {
                // Track loaded & paused: show static spectrum preview around cursor so track is clearly visualized on EQ
                const cur = Math.max(0, Math.min(engine.length - 1, engine.cursorSample));
                if (staticSpectrumLen !== engine.length || Math.abs(staticSpectrumCursor - cur) > 2048) {
                    staticSpectrumCache = engine.getSampleWindowSpectrum(cur, EQ_NUM_BANDS);
                    staticSpectrumCursor = cur;
                    staticSpectrumLen = engine.length;
                }
                targetBars = staticSpectrumCache;
            }

            const gap = Math.max(2, Math.floor(W / 180));
            const barW = Math.max(3, (W - gap * (EQ_NUM_BANDS + 1)) / EQ_NUM_BANDS);

            const grad = ctx.createLinearGradient(0, H, 0, 0);
            if (isLiveMode) {
                grad.addColorStop(0, '#00a884');
                grad.addColorStop(0.55, '#38bdf8');
                grad.addColorStop(0.84, '#f59e0b');
                grad.addColorStop(1, '#ef4444');
            } else {
                grad.addColorStop(0, 'rgba(0, 168, 132, 0.55)');
                grad.addColorStop(1, 'rgba(56, 189, 248, 0.65)');
            }

            for (let b = 0; b < EQ_NUM_BANDS; b++) {
                const target = targetBars ? targetBars[b] : 0.03;
                const attack = target > eqSmoothBars[b] ? 0.45 : 0.16;
                eqSmoothBars[b] += (target - eqSmoothBars[b]) * attack;
                const val = Math.max(0.03, Math.min(1, eqSmoothBars[b]));

                if (val > eqPeakCaps[b]) {
                    eqPeakCaps[b] = val;
                } else {
                    eqPeakCaps[b] = Math.max(val, eqPeakCaps[b] - 0.008);
                }

                const x = gap + b * (barW + gap);
                const barH = Math.max(3, val * (H - 8));
                const y = H - barH;

                ctx.fillStyle = grad;
                ctx.fillRect(x, y, barW, barH);

                if (targetBars && eqPeakCaps[b] > 0.05) {
                    const capY = Math.max(2, H - eqPeakCaps[b] * (H - 8) - 3);
                    ctx.fillStyle = eqPeakCaps[b] > 0.88 ? '#ef4444' : '#e0f2fe';
                    ctx.fillRect(x, capY, barW, 2);
                }
            }

            ctx.restore();
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
            const RULER_H = 22;
            const LANE_H = 24;
            const WAVE_TOP = RULER_H;
            const WAVE_H = H - RULER_H - LANE_H;
            const MID_Y_L = WAVE_TOP + WAVE_H * 0.25;
            const MID_Y_R = WAVE_TOP + WAVE_H * 0.75;
            const CH_AMP = WAVE_H * 0.22;

            ctx.fillStyle = '#070f15';
            ctx.fillRect(0, 0, W, H);

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

            ctx.font = 'bold 10px ui-monospace, monospace';
            ctx.fillStyle = 'rgba(143, 160, 170, 0.65)';
            ctx.fillText('L', 8, WAVE_TOP + 13);
            ctx.fillText('R', 8, WAVE_TOP + WAVE_H * 0.5 + 13);

            ctx.fillStyle = '#0c161e';
            ctx.fillRect(0, 0, W, RULER_H);
            ctx.fillRect(0, H - LANE_H, W, LANE_H);

            const total = engine.length;
            if (total > 0 && viewSpanSamples > 0) {
                const startSec = viewStartSample / engine.sampleRate;
                const spanSec = viewSpanSamples / engine.sampleRate;
                const targetTicks = Math.max(3, Math.floor(W / 95));
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
                    ctx.moveTo(x, RULER_H - 5);
                    ctx.lineTo(x, RULER_H);
                    ctx.stroke();
                    ctx.fillText(formatTimecode(t, tickStep < 1), x + 4, 14);
                }

                const tracks = engine.tracks || [];
                tracks.forEach((trk, idx) => {
                    const x0 = Math.max(0, sampleToX(trk.startSample, W));
                    const x1 = Math.min(W, sampleToX(trk.endSample, W));
                    if (x1 <= 0 || x0 >= W) return;

                    ctx.fillStyle = idx % 2 === 0 ? 'rgba(56, 189, 248, 0.14)' : 'rgba(0, 168, 132, 0.14)';
                    ctx.fillRect(x0, H - LANE_H + 2, Math.max(2, x1 - x0 - 1), LANE_H - 4);

                    if (x1 - x0 > 28) {
                        ctx.fillStyle = '#e9edef';
                        ctx.font = 'bold 11px sans-serif';
                        const label = `${String(idx + 1).padStart(2, '0')} ${trk.title || ''}`;
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(x0 + 4, H - LANE_H, Math.max(0, x1 - x0 - 8), LANE_H);
                        ctx.clip();
                        ctx.fillText(label, x0 + 6, H - 8);
                        ctx.restore();
                    }

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

                if (engine.selection && engine.selection.endSample > engine.selection.startSample) {
                    const sx0 = sampleToX(engine.selection.startSample, W);
                    const sx1 = sampleToX(engine.selection.endSample, W);
                    if (sx1 >= 0 && sx0 <= W) {
                        const cl0 = Math.max(0, sx0);
                        const cl1 = Math.min(W, sx1);
                        ctx.fillStyle = 'rgba(255, 85, 0, 0.2)';
                        ctx.fillRect(cl0, WAVE_TOP, cl1 - cl0, WAVE_H);
                        ctx.strokeStyle = 'rgba(255, 115, 45, 0.95)';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(sx0, WAVE_TOP);
                        ctx.lineTo(sx0, WAVE_TOP + WAVE_H);
                        ctx.moveTo(sx1, WAVE_TOP);
                        ctx.lineTo(sx1, WAVE_TOP + WAVE_H);
                        ctx.stroke();
                    }
                }

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
                }
            }

            ctx.restore();
        }

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

            ctx.fillStyle = '#04090e';
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

        function animationTick(now) {
            if (lcdTimecode) {
                if (engine.recordState === 'recording') {
                    lcdTimecode.textContent = formatTimecode(engine.getDurationSeconds());
                } else if (engine.isPlaying) {
                    lcdTimecode.textContent = formatTimecode(engine.getPlaybackPositionSample() / engine.sampleRate);
                } else {
                    lcdTimecode.textContent = formatTimecode(engine.cursorSample / engine.sampleRate);
                }
            }

            if (engine.isPlaying) {
                syncEqualizerTrackDisplay();
            }

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

            drawEqualizer();
            drawVuBar(vuMeterL, levels.left.rmsDb, peakHoldL);
            drawVuBar(vuMeterR, levels.right.rmsDb, peakHoldR);

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

        // --- Unified Pointer (Mouse + Touch) Interactions on Waveform ---
        if (waveformCanvas) {
            waveformCanvas.addEventListener('pointerdown', (e) => {
                if (engine.length === 0 || (e.pointerType === 'mouse' && e.button !== 0)) return;
                const rect = waveformCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const edgePx = (e.pointerType === 'touch' || e.pointerType === 'pen') ? 20 : 8;

                activePointerId = e.pointerId;
                try { waveformCanvas.setPointerCapture(e.pointerId); } catch (_) { }
                dragStartX = x;
                hasDraggedBeyondThreshold = false;

                if (y > rect.height - 26) {
                    const clickSample = xToSample(x, rect.width);
                    const hitTrack = engine.tracks.find(t => clickSample >= t.startSample && clickSample <= t.endSample);
                    if (hitTrack) {
                        engine.setSelection(hitTrack.startSample, hitTrack.endSample);
                        engine.cursorSample = hitTrack.startSample;
                        activePointerId = null;
                        updateUiState();
                        return;
                    }
                }

                const nowMs = Date.now();
                if (nowMs - lastTapTime < 320 && Math.abs(x - lastTapX) < 24) {
                    const sample = xToSample(x, rect.width);
                    const hit = engine.tracks.find(t => sample >= t.startSample && sample <= t.endSample);
                    if (hit) engine.setSelection(hit.startSample, hit.endSample);
                    else engine.setSelection(0, engine.length);
                    activePointerId = null;
                    lastTapTime = 0;
                    updateUiState();
                    return;
                }
                lastTapTime = nowMs;
                lastTapX = x;

                if (engine.selection) {
                    const sx0 = sampleToX(engine.selection.startSample, rect.width);
                    const sx1 = sampleToX(engine.selection.endSample, rect.width);
                    if (Math.abs(x - sx0) <= edgePx) { dragMode = 'resize-start'; waveformCanvas.style.touchAction = 'none'; return; }
                    if (Math.abs(x - sx1) <= edgePx) { dragMode = 'resize-end'; waveformCanvas.style.touchAction = 'none'; return; }
                }

                for (let i = 1; i < engine.tracks.length; i++) {
                    const bx = sampleToX(engine.tracks[i].startSample, rect.width);
                    if (Math.abs(x - bx) <= edgePx) {
                        dragMode = 'move-split';
                        dragSplitTrackIdx = i;
                        waveformCanvas.style.touchAction = 'none';
                        return;
                    }
                }

                dragMode = 'select';
                dragAnchorSample = xToSample(x, rect.width);
            });

            waveformCanvas.addEventListener('pointermove', (e) => {
                const rect = waveformCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                if (dragMode && e.pointerId === activePointerId) {
                    const curSample = xToSample(x, rect.width);
                    if (Math.abs(x - dragStartX) > 6) {
                        hasDraggedBeyondThreshold = true;
                        waveformCanvas.style.touchAction = 'none';
                    }
                    if (!hasDraggedBeyondThreshold && dragMode === 'select') return;

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

                if (engine.length === 0 || e.pointerType !== 'mouse') return;
                const edgePx = 8;
                if (engine.selection) {
                    const sx0 = sampleToX(engine.selection.startSample, rect.width);
                    const sx1 = sampleToX(engine.selection.endSample, rect.width);
                    if (Math.abs(x - sx0) <= edgePx || Math.abs(x - sx1) <= edgePx) {
                        waveformCanvas.style.cursor = 'ew-resize';
                        return;
                    }
                }
                for (let i = 1; i < engine.tracks.length; i++) {
                    const bx = sampleToX(engine.tracks[i].startSample, rect.width);
                    if (Math.abs(x - bx) <= edgePx) {
                        waveformCanvas.style.cursor = 'col-resize';
                        return;
                    }
                }
                waveformCanvas.style.cursor = y > rect.height - 26 ? 'pointer' : 'crosshair';
            });

            const finishPointerDrag = (e) => {
                if (!dragMode || (activePointerId !== null && e.pointerId !== activePointerId)) return;
                const finishedMode = dragMode;
                dragMode = null;
                activePointerId = null;
                waveformCanvas.style.touchAction = 'pan-y';
                try { waveformCanvas.releasePointerCapture(e.pointerId); } catch (_) { }

                if (finishedMode === 'move-split') {
                    renderTracksList();
                } else if (finishedMode === 'select' && !hasDraggedBeyondThreshold) {
                    engine.setSelection(null, null);
                    engine.seek(dragAnchorSample);
                }
                dragSplitTrackIdx = -1;
                updateUiState();
            };

            waveformCanvas.addEventListener('pointerup', finishPointerDrag);
            waveformCanvas.addEventListener('pointercancel', finishPointerDrag);

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

        // --- Wire EQ Presets ---
        eqPresetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-eq-preset') || 'flat';
                engine.setEqPreset(preset);
                eqPresetBtns.forEach(b => b.classList.toggle('is-active', b === btn));
                showToast(`🎛️ EQ Preset: ${btn.textContent}`, 'info');
            });
        });

        // --- Wire Controls ---
        if (captureTabBtn) captureTabBtn.addEventListener('click', handleCaptureTabClick);
        if (emptyCaptureTabBtn) emptyCaptureTabBtn.addEventListener('click', handleCaptureTabClick);
        if (captureMicBtn) captureMicBtn.addEventListener('click', handleCaptureMicClick);
        if (emptyCaptureMicBtn) emptyCaptureMicBtn.addEventListener('click', handleCaptureMicClick);
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

        // 1-Click Smart Record Button
        if (recordBtn) {
            recordBtn.addEventListener('click', async () => {
                if (engine.recordState === 'idle') {
                    if (!engine.isSourceConnected()) {
                        if (supportsDisplayCapture) await handleCaptureTabClick();
                        else await handleCaptureMicClick();
                        return;
                    }
                    engine.startRecording(engine.length > 0 && confirm('Append to existing waveform? Click Cancel to start fresh.'));
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
                if (trk) showToast(`✂️ Split track at ${formatTimecode(pos / engine.sampleRate)}`, 'success');
                else showToast('Move cursor inside a track to split.', 'info');
            });
        }

        if (inputGainSlider) inputGainSlider.addEventListener('input', () => engine.setInputGain(inputGainSlider.value));
        if (playbackVolSlider) playbackVolSlider.addEventListener('input', () => engine.setPlaybackVolume(playbackVolSlider.value));
        if (monitorToggle) monitorToggle.addEventListener('change', () => engine.setMonitorEnabled(monitorToggle.checked));

        // Edits & Zoom
        if (undoBtn) undoBtn.addEventListener('click', () => { if (engine.undo()) showToast('↶ Undone', 'info'); });
        if (redoBtn) redoBtn.addEventListener('click', () => { if (engine.redo()) showToast('↷ Redone', 'info'); });
        if (trimSelBtn) trimSelBtn.addEventListener('click', () => { if (engine.trimToSelection()) showToast('✂️ Trimmed to selection', 'success'); });
        if (deleteSelBtn) deleteSelBtn.addEventListener('click', () => { if (engine.deleteSelection()) showToast('🗑️ Cut selection', 'info'); });
        if (silenceSelBtn) silenceSelBtn.addEventListener('click', () => { if (engine.silenceSelection()) showToast('🔇 Silenced selection', 'info'); });
        if (fadeInBtn) fadeInBtn.addEventListener('click', () => { if (engine.fadeIn()) showToast('📈 Applied Fade In', 'success'); });
        if (fadeOutBtn) fadeOutBtn.addEventListener('click', () => { if (engine.fadeOut()) showToast('📉 Applied Fade Out', 'success'); });
        if (normalizeBtn) normalizeBtn.addEventListener('click', () => { if (engine.normalize(null, null, -1.0)) showToast('🔊 Normalized to -1.0 dBFS', 'success'); });
        if (trimDeadAirBtn) trimDeadAirBtn.addEventListener('click', () => {
            if (engine.trimLeadingTrailingSilence()) showToast('🧹 Trimmed silence', 'success');
            else showToast('No dead air above threshold to trim.', 'info');
        });
        if (clearSessionBtn) clearSessionBtn.addEventListener('click', () => {
            engine.clearSession();
            showToast('Cleared waveform', 'info');
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

        // Auto-Split Settings
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

        const runAutoSplitScan = () => {
            const tracks = engine.scanAndAutoSplit();
            showToast(`🔍 Detected ${tracks.length} track${tracks.length === 1 ? '' : 's'} by silence gaps`, 'success');
        };
        if (scanSplitNowBtn) scanSplitNowBtn.addEventListener('click', runAutoSplitScan);
        if (quickAutoSplitBtn) quickAutoSplitBtn.addEventListener('click', runAutoSplitScan);

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
                    showToast('🎨 Cover art loaded for MP3 ID3 tags', 'success');
                } catch (_) {
                    showToast('Could not read cover art image.', 'error');
                }
            });
        }

        if (exportSelectionBtn) exportSelectionBtn.addEventListener('click', exportSelectionToDisk);
        if (exportAllBtn) exportAllBtn.addEventListener('click', exportAllTracksToHardDrive);

        // Keyboard Shortcuts
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
                e.preventDefault();
                recordBtn?.click();
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

        if (yearMetaInput && !yearMetaInput.value) {
            yearMetaInput.value = String(new Date().getFullYear());
        }

        refreshMicDevices();
        renderTracksList();
        updateUiState();
        requestAnimationFrame(animationTick);
    }

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
