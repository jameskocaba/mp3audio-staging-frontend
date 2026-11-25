(function () {
    'use strict';

    function initStudioApp() {
        if (window.__MP3AUDIO_STUDIO_INIT__) return;
        window.__MP3AUDIO_STUDIO_INIT__ = true;

        const ExportEngine = window.StudioExportEngine;
        const IdentifyEngine = window.StudioIdentifyEngine;
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
        const marathonModeBtn = document.getElementById('marathonModeBtn');
        const marathonModeLabel = document.getElementById('marathonModeLabel');
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

        // Transport, L/R Recording Meters & Wave Header
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
        const meterDbReadout = document.getElementById('meterDbReadout');
        const waveStatusBadge = document.getElementById('waveStatusBadge');
        const waveTrackTitle = document.getElementById('waveTrackTitle');
        const waveLiveViewBadge = document.getElementById('waveLiveViewBadge');
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

        // Continuous Waveform Stage
        const waveformCanvas = document.getElementById('waveformCanvas');
        const waveformEmptyHint = document.getElementById('waveformEmptyHint');
        const waveformPanSlider = document.getElementById('waveformPanSlider');
        const zoomLevelBadge = document.getElementById('zoomLevelBadge');

        // Auto-Split Settings
        const liveAutoSplitToggle = document.getElementById('liveAutoSplitToggle');
        const soundActivatedToggle = document.getElementById('soundActivatedToggle');
        const autoTrimSilenceToggle = document.getElementById('autoTrimSilenceToggle');
        const autoIdentifyToggle = document.getElementById('autoIdentifyToggle');
        const autoSaveLiveRow = document.getElementById('autoSaveLiveRow');
        const autoSaveLiveTitle = document.getElementById('autoSaveLiveTitle');
        const autoSaveLiveDesc = document.getElementById('autoSaveLiveDesc');
        const autoSaveLiveToggle = document.getElementById('autoSaveLiveToggle');
        const flushOnSaveRow = document.getElementById('flushOnSaveRow');
        const flushOnSaveToggle = document.getElementById('flushOnSaveToggle');
        const thresholdDbSlider = document.getElementById('thresholdDbSlider');
        const thresholdDbVal = document.getElementById('thresholdDbVal');
        const minSilenceSlider = document.getElementById('minSilenceSlider');
        const minSilenceVal = document.getElementById('minSilenceVal');
        const minTrackSlider = document.getElementById('minTrackSlider');
        const minTrackVal = document.getElementById('minTrackVal');
        const maxSegmentSlider = document.getElementById('maxSegmentSlider');
        const maxSegmentVal = document.getElementById('maxSegmentVal');
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
        const LIVE_SCROLL_SECONDS = 12;
        const TRACKS_WINDOW_STEP = 50;
        let dirHandle = null;
        let visibleFlushedLimit = TRACKS_WINDOW_STEP;
        let coverArtBytes = null;
        let coverArtMime = 'image/jpeg';
        let userEditedCoverArt = false;
        let isExporting = false;
        let autoSaveQueue = Promise.resolve();
        let lastObservedRecLength = 0;
        let prevRecordState = 'idle';
        let wakeLockSentinel = null;
        let diskAudioEl = null;
        let diskAudioUrl = '';
        let playingDiskTrackId = null;
        let warnedHighRamWithoutFolder = false;
        let lastRamCheckMs = 0;
        const usedSavedFilenames = new Set();
        const inFlightIdentifyPromises = new Map();
        const trackCoverUrlCache = new WeakMap();

        // Viewport / Zoom State
        let viewStartSample = 0;
        let viewSpanSamples = 0;
        let userHasZoomed = false;
        let lastAnimNow = 0;
        let smoothScrollStart = 0;
        let smoothScrollActive = false;
        let smoothPlaySample = 0;
        let smoothPlayActive = false;

        // Meter Peak State
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
                emptyCardDesc.innerHTML = 'Tap <strong>Tap to Record</strong> or <strong>Open Audio</strong> — Left &amp; Right wave streams appear live here.';
            }
        }
        if (!supportsFolderPicker) {
            if (pickFolderBtn) pickFolderBtn.classList.add('hidden');
            if (isMobileUa) {
                if (marathonModeBtn) marathonModeBtn.classList.add('hidden');
                if (autoSaveLiveRow) autoSaveLiveRow.classList.add('hidden');
                if (flushOnSaveRow) flushOnSaveRow.classList.add('hidden');
                if (autoSaveLiveToggle) autoSaveLiveToggle.checked = false;
            } else {
                // Firefox/Safari desktop fallback: opt-in segmented auto-download + RAM flush (0 browser storage)
                if (autoSaveLiveToggle) autoSaveLiveToggle.checked = false;
                if (autoSaveLiveTitle) autoSaveLiveTitle.textContent = 'Auto-Download Live Tracks';
                if (autoSaveLiveDesc) autoSaveLiveDesc.textContent = 'Downloads each finished track automatically and frees RAM (0 browser storage).';
            }
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
            const hrs = Math.floor(s / 3600);
            const remAfterHrs = s - hrs * 3600;
            const mins = Math.floor(remAfterHrs / 60);
            const rem = remAfterHrs - mins * 60;
            const secs = Math.floor(rem);
            const tenths = Math.floor((rem - secs) * 10);
            const mm = String(mins).padStart(2, '0');
            const ss = String(secs).padStart(2, '0');
            if (hrs > 0) {
                const hh = String(hrs).padStart(2, '0');
                return includeTenths ? `${hh}:${mm}:${ss}.${tenths}` : `${hh}:${mm}:${ss}`;
            }
            return includeTenths ? `${mm}:${ss}.${tenths}` : `${mm}:${ss}`;
        }

        function formatBytesCompact(bytes) {
            const b = Math.max(0, Number(bytes) || 0);
            if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            if (b >= 1024 * 1024) return `${Math.round(b / (1024 * 1024))} MB`;
            if (b >= 1024) return `${Math.round(b / 1024)} KB`;
            return `${b} B`;
        }

        function isLiveAutoSaveAvailable() {
            if (!autoSaveLiveToggle || !autoSaveLiveToggle.checked) return false;
            return Boolean(dirHandle || (!supportsFolderPicker && !isMobileUa));
        }

        function isTrackByTrackFlushActive() {
            return Boolean(flushOnSaveToggle && flushOnSaveToggle.checked && isLiveAutoSaveAvailable());
        }

        function allocateUniqueFilename(rawFilename) {
            const safe = ExportEngine.sanitizeFilename(rawFilename);
            const dot = safe.lastIndexOf('.');
            const base = dot > 0 ? safe.slice(0, dot) : safe;
            const ext = dot > 0 ? safe.slice(dot) : '';
            let candidate = safe;
            let suffix = 2;
            while (usedSavedFilenames.has(candidate.toLowerCase())) {
                candidate = `${base} (${suffix++})${ext}`;
            }
            usedSavedFilenames.add(candidate.toLowerCase());
            return candidate;
        }

        async function acquireWakeLock() {
            try {
                if (!navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
                if (wakeLockSentinel && !wakeLockSentinel.released) return;
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                wakeLockSentinel.addEventListener('release', () => {
                    wakeLockSentinel = null;
                });
            } catch (_) {
                // Non-fatal: browser or OS policy may deny wake lock
            }
        }

        async function releaseWakeLock() {
            try {
                if (wakeLockSentinel) {
                    const s = wakeLockSentinel;
                    wakeLockSentinel = null;
                    await s.release();
                }
            } catch (_) { }
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' &&
                (engine.recordState === 'recording' || engine.recordState === 'armed')) {
                acquireWakeLock();
            }
        });

        function stopDiskPlayback(silent = false) {
            if (diskAudioEl) {
                try { diskAudioEl.pause(); diskAudioEl.src = ''; } catch (_) { }
                diskAudioEl = null;
            }
            if (diskAudioUrl) {
                try { URL.revokeObjectURL(diskAudioUrl); } catch (_) { }
                diskAudioUrl = '';
            }
            const wasPlayingDisk = playingDiskTrackId !== null;
            playingDiskTrackId = null;
            if (wasPlayingDisk && !silent) {
                renderTracksList();
                updateUiState();
            }
        }

        async function playFlushedTrackFromDisk(track) {
            if (!track) return;
            if (playingDiskTrackId === track.id) {
                stopDiskPlayback(false);
                return;
            }
            stopDiskPlayback(true);
            engine.stopPlayback(true);

            if (!dirHandle || !track.savedFilename || typeof ExportEngine.readFileFromDirectory !== 'function') {
                showToast(`"${track.savedFilename || track.title}" was already saved to your downloads/folder.`, 'info');
                return;
            }
            try {
                const file = await ExportEngine.readFileFromDirectory(dirHandle, track.savedFilename);
                diskAudioUrl = URL.createObjectURL(file);
                const audio = new Audio(diskAudioUrl);
                audio.volume = Math.max(0, Math.min(1, engine.playbackVolume));
                diskAudioEl = audio;
                playingDiskTrackId = track.id;
                audio.addEventListener('ended', () => stopDiskPlayback(false));
                audio.addEventListener('error', () => {
                    stopDiskPlayback(false);
                    showToast(`Could not play "${track.savedFilename}" from folder.`, 'error');
                });
                await audio.play();
                renderTracksList();
                updateUiState();
            } catch (err) {
                stopDiskPlayback(false);
                showToast(`Could not open "${track.savedFilename}" from folder: ${(err && err.message) || 'File moved'}`, 'info');
            }
        }

        function resetSmoothScrollState() {
            smoothScrollActive = false;
            smoothPlayActive = false;
            lastAnimNow = 0;
        }

        function getVisualPlaybackSample() {
            if (!engine.isPlaying) return engine.cursorSample;
            return smoothPlayActive ? smoothPlaySample : engine.getPlaybackPositionSample();
        }

        function updateLiveScrollViewport(now = null) {
            const total = engine.length;
            const sr = engine.sampleRate || 44100;
            const liveWin = Math.max(sr * LIVE_SCROLL_SECONDS, 1);
            const hasClock = typeof now === 'number' && Number.isFinite(now);
            const dtSec = (hasClock && lastAnimNow > 0 && now > lastAnimNow)
                ? Math.min(0.1, (now - lastAnimNow) / 1000)
                : 0;
            if (hasClock) {
                lastAnimNow = now;
            }

            if (engine.recordState === 'recording' || engine.recordState === 'paused') {
                const leadAnchor = Math.round(liveWin * 0.88);
                viewSpanSamples = liveWin;
                const targetStart = total > leadAnchor ? (total - leadAnchor) : 0;

                if (engine.recordState === 'paused' || targetStart === 0 || !hasClock) {
                    smoothScrollStart = targetStart;
                    smoothScrollActive = false;
                    viewStartSample = targetStart;
                    return;
                }

                if (!smoothScrollActive || Math.abs(targetStart - smoothScrollStart) > sr * 0.35) {
                    smoothScrollStart = targetStart;
                    smoothScrollActive = true;
                } else if (dtSec > 0) {
                    smoothScrollStart += dtSec * sr;
                    const drift = targetStart - smoothScrollStart;
                    smoothScrollStart += drift * Math.min(1, dtSec * 8);
                    if (smoothScrollStart < 0) smoothScrollStart = 0;
                }
                viewStartSample = smoothScrollStart;
                return;
            }

            if (engine.isPlaying && total > 0) {
                if (!userHasZoomed || viewSpanSamples <= 0 || viewSpanSamples >= total) {
                    const fallbackSpan = Math.min(total, Math.max(sr * 4, Math.min(liveWin, Math.round(total * 0.45))));
                    viewSpanSamples = fallbackSpan > 0 ? fallbackSpan : total;
                }

                const rawPos = engine.getPlaybackPositionSample();
                if (!hasClock || !smoothPlayActive || Math.abs(rawPos - smoothPlaySample) > sr * 0.35) {
                    smoothPlaySample = rawPos;
                    smoothPlayActive = hasClock;
                } else if (dtSec > 0) {
                    smoothPlaySample += dtSec * sr;
                    const playDrift = rawPos - smoothPlaySample;
                    smoothPlaySample += playDrift * Math.min(1, dtSec * 12);
                    smoothPlaySample = Math.max(engine.playStartSample || 0, Math.min(engine.playEndSample || total, smoothPlaySample));
                }

                const anchorOffset = viewSpanSamples * 0.30;
                const maxStart = Math.max(0, total - viewSpanSamples);
                const targetStart = Math.max(0, Math.min(maxStart, smoothPlaySample - anchorOffset));
                smoothScrollStart = targetStart;
                smoothScrollActive = targetStart > 0 && targetStart < maxStart;
                viewStartSample = targetStart;
                return;
            }

            resetSmoothScrollState();
        }

        function clampViewport() {
            const total = engine.length;
            if (engine.recordState === 'recording' || engine.recordState === 'paused' || (engine.isPlaying && total > 0)) {
                updateLiveScrollViewport();
                return;
            }
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
            const liveActive = engine.recordState === 'recording' || engine.isPlaying;
            if (liveActive && viewSpanSamples > 0 && total > 0) {
                waveformPanSlider.disabled = true;
                const maxStart = Math.max(1, total - viewSpanSamples);
                waveformPanSlider.value = String(Math.min(1000, Math.round((viewStartSample / maxStart) * 1000)));
                zoomLevelBadge.textContent = 'LIVE';
                return;
            }
            if (total === 0 || !userHasZoomed || viewSpanSamples >= total || engine.recordState !== 'idle') {
                waveformPanSlider.disabled = true;
                waveformPanSlider.value = '0';
                zoomLevelBadge.textContent = engine.recordState === 'recording' ? 'LIVE' : '1.0x';
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
                showToast('Capture stopped — recorded wave is ready below.', 'info');
                updateUiState();
            },
            onRecordStateChanged: ({ state }) => {
                const wasActiveRec = prevRecordState !== 'idle';
                prevRecordState = state;
                resetSmoothScrollState();
                if (state === 'recording' || state === 'armed') {
                    stopDiskPlayback(true);
                    acquireWakeLock();
                    if (!wasActiveRec && engine.length === 0 && engine.tracks.length === 0) {
                        usedSavedFilenames.clear();
                        warnedHighRamWithoutFolder = false;
                        visibleFlushedLimit = TRACKS_WINDOW_STEP;
                    }
                } else if (state === 'idle') {
                    releaseWakeLock();
                }
                if (state === 'armed') {
                    showToast('Armed — recording begins as soon as sound starts.', 'warning');
                }
                if (state === 'idle' && engine.length > 0) {
                    userHasZoomed = false;
                    viewStartSample = 0;
                    viewSpanSamples = engine.length;
                }
                clampViewport();
                syncPanScrollbar();
                updateUiState();
                if (wasActiveRec && state === 'idle' && engine.length > 0 && isAutoTagEnabled()) {
                    queueAutoTagTracks(engine.getUnflushedTracks());
                }
            },
            onPlaybackStateChanged: ({ playing } = {}) => {
                if (playing) stopDiskPlayback(true);
                resetSmoothScrollState();
                if (!playing && !userHasZoomed && engine.recordState === 'idle') {
                    viewStartSample = 0;
                    viewSpanSamples = engine.length;
                }
                clampViewport();
                syncPanScrollbar();
                updateUiState();
                renderTracksList();
            },
            onTracksChanged: () => {
                renderTracksList();
                updateUiState();
            },
            onTracksCreated: ({ tracks }) => {
                if (!isAutoTagEnabled() || !Array.isArray(tracks) || tracks.length === 0) return;
                queueAutoTagTracks(tracks.filter(t => !t.flushed));
            },
            onTrackAutoSplit: async (track) => {
                const durSec = Math.max(0, (track.endSample - track.startSample) / Math.max(1, engine.sampleRate));
                const splitPrefix = track.splitReason === 'max-segment' ? '⏱️ Segment Split' : '✂️ Split';
                showToast(`${splitPrefix} Track ${track.index + 1} (${formatTimecode(durSec, false)})`, 'success');
                renderTracksList();
                const shouldTag = isAutoTagEnabled() && shouldAutoTagTrack(track);
                if (shouldTag) {
                    identifyTrackById(track.id, { manual: false, forceOverwrite: false });
                }
                if (isLiveAutoSaveAvailable()) {
                    if (shouldTag || inFlightIdentifyPromises.has(track.id)) {
                        await waitForTrackAutoTag(track.id, 12000);
                    }
                    const latest = engine.tracks.find(t => t.id === track.id) || track;
                    if (!latest.flushed && !latest.saving) {
                        queueLiveAutoSaveTrack(latest);
                    }
                }
            },
            onBufferEvicted: ({ evictedSamples }) => {
                if (evictedSamples > 0) {
                    viewStartSample = Math.max(0, viewStartSample - evictedSamples);
                    smoothScrollStart = Math.max(0, smoothScrollStart - evictedSamples);
                    lastObservedRecLength = engine.length;
                }
                clampViewport();
                syncPanScrollbar();
                updateUiState();
            },
            onBufferChanged: ({ length }) => {
                if (length === 0) {
                    userHasZoomed = false;
                    viewStartSample = 0;
                    viewSpanSamples = 0;
                } else if (!userHasZoomed && engine.recordState === 'idle') {
                    viewStartSample = 0;
                    viewSpanSamples = length;
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

        // --- Wave Header & Guided Step Readout ---
        let lastWaveTitle = '';
        let lastWaveBadge = '';

        function syncWaveTrackDisplay() {
            const trk = engine.getActiveTrackInfo();
            const isRec = engine.recordState === 'recording';
            const isArmed = engine.recordState === 'armed';
            const isPaused = engine.recordState === 'paused';
            const isPlay = engine.isPlaying;
            const connected = engine.isSourceConnected();

            let badgeText = 'STANDBY';
            let badgeClass = 'wave-status-badge';
            let titleText = 'Live Stereo Wave — Ready to Record';

            if (isRec) {
                badgeText = '● REC LIVE';
                badgeClass += ' is-live';
                titleText = `Recording ${(trk && trk.title) || 'Track 01'} — ${(trk && trk.artist) || engine.sourceLabel || 'Audio Stream'}`;
            } else if (isArmed) {
                badgeText = '⚡ ARMED';
                badgeClass += ' is-live';
                titleText = `Armed on ${engine.sourceLabel || 'Audio Input'} — Waiting for sound...`;
            } else if (isPaused) {
                badgeText = '⏸ PAUSED';
                badgeClass += ' is-ready';
                titleText = `Recording Paused — ${(trk && trk.title) || 'Track 01'}`;
            } else if (isPlay && trk) {
                badgeText = '▶ PLAYING';
                badgeClass += ' is-playing';
                const totalTracks = Math.max(1, engine.tracks.length);
                titleText = `${trk.title}${trk.artist ? ' — ' + trk.artist : ''} (Track ${trk.index + 1}/${totalTracks})`;
            } else if (trk && engine.length > 0) {
                badgeText = '● LOADED';
                badgeClass += ' is-ready';
                const totalTracks = Math.max(1, engine.tracks.length);
                titleText = `${trk.title}${trk.artist ? ' — ' + trk.artist : ''} (Track ${trk.index + 1}/${totalTracks})`;
            } else if (connected) {
                badgeText = '● INPUT LIVE';
                badgeClass += ' is-ready';
                titleText = `Live Input Preview — ${engine.sourceLabel || 'Audio Input'}`;
            }

            if (waveStatusBadge && (badgeText !== lastWaveBadge || waveStatusBadge.className !== badgeClass)) {
                waveStatusBadge.textContent = badgeText;
                waveStatusBadge.className = badgeClass;
                lastWaveBadge = badgeText;
            }
            if (waveTrackTitle && titleText !== lastWaveTitle) {
                waveTrackTitle.textContent = titleText;
                lastWaveTitle = titleText;
            }
            if (waveLiveViewBadge) {
                waveLiveViewBadge.classList.toggle('hidden', !isRec && !isPlay);
            }
        }

        function syncGuidedStepBanner() {
            if (!guidedStepBanner) return;
            if (engine.recordState === 'recording') {
                if (isTrackByTrackFlushActive()) {
                    const flushedCount = engine.getFlushedTrackCount();
                    guidedStepBanner.innerHTML = `🔴 <strong>Recording live (12h+ Flush Active)</strong> — finished tracks save directly to disk &amp; free RAM automatically${flushedCount > 0 ? ` (<strong>${flushedCount}</strong> flushed)` : ''}.`;
                } else {
                    guidedStepBanner.innerHTML = '🔴 <strong>Recording live!</strong> Watch the Left &amp; Right wave and level bars below — songs split automatically on quiet gaps.';
                }
            } else if (engine.recordState === 'armed') {
                guidedStepBanner.innerHTML = '⚡ <strong>Armed:</strong> Hit Play on your music stream and the continuous recording wave starts immediately.';
            } else if (engine.isPlaying || playingDiskTrackId) {
                guidedStepBanner.innerHTML = '🎧 <strong>Playing:</strong> Drag on the wave to highlight a section, or tap <strong>💾 Save</strong> below.';
            } else if (engine.length > 0 || engine.tracks.length > 0) {
                const n = engine.tracks.length;
                const flushedCount = engine.getFlushedTrackCount();
                if (flushedCount > 0 && engine.length === 0) {
                    guidedStepBanner.innerHTML = `✅ <strong>All ${flushedCount} track${flushedCount === 1 ? '' : 's'} flushed to disk!</strong> Browser storage &amp; RAM freed.`;
                } else if (flushedCount > 0) {
                    guidedStepBanner.innerHTML = `✅ <strong>Ready!</strong> ${n} track${n === 1 ? '' : 's'} (${flushedCount} already flushed to disk) — save remaining below.`;
                } else {
                    guidedStepBanner.innerHTML = `✅ <strong>Ready!</strong> ${n} track${n === 1 ? '' : 's'} captured — rename tracks below or tap <strong>💾 Save</strong>.`;
                }
            } else if (supportsDisplayCapture) {
                guidedStepBanner.innerHTML = '<span class="guided-steps-flow"><span class="guided-step-item">✨ <strong>Step 1:</strong> Tap <strong>Record Music Tab</strong> (or <strong>Open Audio</strong>)</span><span class="guided-step-sep" aria-hidden="true">→</span><span class="guided-step-item"><strong>Step 2:</strong> Choose what to record</span><span class="guided-step-sep" aria-hidden="true">→</span><span class="guided-step-item"><strong>Step 3:</strong> Press <strong>Record</strong></span><span class="guided-step-sep" aria-hidden="true">→</span><span class="guided-step-item"><strong>Step 4:</strong> Navigate back to the <strong>MP3aud.io</strong> tab</span></span>';
            } else {
                guidedStepBanner.innerHTML = '<span class="guided-steps-flow"><span class="guided-step-item">✨ <strong>Step 1:</strong> Tap <strong>Tap to Record</strong> (or <strong>Open Audio</strong>)</span><span class="guided-step-sep" aria-hidden="true">→</span><span class="guided-step-item"><strong>Step 2:</strong> Choose what to record</span><span class="guided-step-sep" aria-hidden="true">→</span><span class="guided-step-item"><strong>Step 3:</strong> Press <strong>Record</strong></span><span class="guided-step-sep" aria-hidden="true">→</span><span class="guided-step-item"><strong>Step 4:</strong> Navigate back to the <strong>MP3aud.io</strong> tab</span></span>';
            }
        }

        async function handleMarathonModeClick() {
            if (liveAutoSplitToggle) liveAutoSplitToggle.checked = true;
            if (autoSaveLiveToggle) autoSaveLiveToggle.checked = true;
            if (flushOnSaveToggle) flushOnSaveToggle.checked = true;

            if (supportsFolderPicker && !dirHandle) {
                const picked = await handlePickFolder();
                if (!picked) {
                    showToast('📁 Pick a local Save Folder to start Marathon (12h+) Mode.', 'info');
                    syncSettingsToEngine();
                    updateUiState();
                    return;
                }
            }

            syncSettingsToEngine();
            updateUiState();

            if (engine.recordState === 'recording' || engine.recordState === 'armed' || engine.recordState === 'paused') {
                engine.getUnflushedTracks().forEach(t => {
                    if (!t.saving) queueLiveAutoSaveTrack(t);
                });
                showToast('🏃 Marathon (12h+) Mode active — tracks will save & flush RAM automatically.', 'success');
                return;
            }

            if (engine.isSourceConnected()) {
                userHasZoomed = false;
                engine.startRecording(false);
                showToast('🏃 Marathon (12h+) Recording live — tracks flush directly to disk with flat RAM.', 'success');
                return;
            }

            if (supportsDisplayCapture) {
                await handleCaptureTabClick();
            } else {
                await handleCaptureMicClick();
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

        function setCoverArtPreview(bytes, mime = 'image/jpeg') {
            coverArtBytes = bytes || null;
            coverArtMime = mime || 'image/jpeg';
            if (!coverArtPreview || !coverArtPlaceholder) return;
            if (!coverArtBytes || coverArtBytes.length === 0) {
                coverArtPreview.src = '';
                coverArtPreview.classList.add('hidden');
                coverArtPlaceholder.classList.remove('hidden');
                return;
            }
            try {
                const blob = new Blob([coverArtBytes], { type: coverArtMime });
                const reader = new FileReader();
                reader.onload = () => {
                    coverArtPreview.src = String(reader.result);
                    coverArtPreview.classList.remove('hidden');
                    coverArtPlaceholder.classList.add('hidden');
                };
                reader.readAsDataURL(blob);
            } catch (_) { }
        }

        function applySessionMetaIfEmpty(meta = {}) {
            if (albumMetaInput && meta.album && !albumMetaInput.value.trim()) {
                albumMetaInput.value = meta.album;
            }
            if (yearMetaInput && meta.year && !yearMetaInput.value.trim()) {
                yearMetaInput.value = meta.year;
            }
            if (genreMetaInput && meta.genre && !genreMetaInput.value.trim()) {
                genreMetaInput.value = meta.genre;
            }
            if (!userEditedCoverArt && !coverArtBytes && meta.coverBytes && meta.coverBytes.length > 0) {
                setCoverArtPreview(meta.coverBytes, meta.coverMime || 'image/jpeg');
            }
        }

        function isAutoTagEnabled() {
            return Boolean(IdentifyEngine && (!autoIdentifyToggle || autoIdentifyToggle.checked));
        }

        function shouldAutoTagTrack(track) {
            if (!track || !IdentifyEngine) return false;
            if (track.identifying || inFlightIdentifyPromises.has(track.id)) return false;
            if (track.identified || track.autoTagAttempted) return false;
            if (track.userEditedTitle && track.userEditedArtist) return false;
            return true;
        }

        function waitForTrackAutoTag(trackId, timeoutMs = 8000) {
            const p = inFlightIdentifyPromises.get(trackId);
            if (!p) return Promise.resolve();
            return Promise.race([
                p.catch(() => false),
                new Promise(r => setTimeout(r, timeoutMs))
            ]);
        }

        function getTrackCoverObjectUrl(coverBytes, coverMime = 'image/jpeg') {
            if (!coverBytes || !coverBytes.length) return '';
            let cached = trackCoverUrlCache.get(coverBytes);
            if (!cached) {
                try {
                    const blob = new Blob([coverBytes], { type: coverMime || 'image/jpeg' });
                    cached = URL.createObjectURL(blob);
                    trackCoverUrlCache.set(coverBytes, cached);
                } catch (_) {
                    return '';
                }
            }
            return cached;
        }

        function identifyTrackById(trackId, { manual = false, forceOverwrite = false } = {}) {
            if (!IdentifyEngine) return Promise.resolve(false);
            if (inFlightIdentifyPromises.has(trackId)) {
                return inFlightIdentifyPromises.get(trackId);
            }
            const track = (engine.tracks || []).find(t => t.id === trackId);
            if (!track || track.flushed || track.evictedFromRam || track.identifying) return Promise.resolve(false);

            const durSec = Math.max(0, (track.endSample - track.startSample) / (engine.sampleRate || 44100));
            const minSec = manual ? 3 : 4;
            if (durSec < minSec) {
                if (manual) {
                    showToast('Track is too short to tag automatically (need at least 3 seconds).', 'info');
                } else {
                    engine.updateTrackMeta(trackId, { autoTagAttempted: true });
                }
                return Promise.resolve(false);
            }

            const runPromise = (async () => {
                engine.updateTrackMeta(trackId, { identifying: true, autoTagStatus: 'tagging', autoTagAttempted: true });
                renderTracksList();

                try {
                    const slice = engine.getSlice(track.startSample, track.endSample);
                    const result = await IdentifyEngine.identifyTrackSlice(slice.left, slice.right, slice.sampleRate, { manual });
                    const liveTrk = (engine.tracks || []).find(t => t.id === trackId);
                    if (!liveTrk) return false;

                    if (result && result.matched && result.title) {
                        const patch = {
                            identifying: false,
                            identified: true,
                            autoTagStatus: 'tagged',
                            tagSource: 'auto',
                            saved: false
                        };
                        const canReplaceTitle = forceOverwrite || (
                            !liveTrk.userEditedTitle &&
                            (!liveTrk.hasId3Title || IdentifyEngine.isGenericTrackTitle(liveTrk.title))
                        );
                        if (canReplaceTitle) {
                            patch.title = result.title;
                        }
                        const canReplaceArtist = forceOverwrite || (
                            !liveTrk.userEditedArtist &&
                            (!liveTrk.hasId3Artist || !String(liveTrk.artist || '').trim())
                        );
                        if (result.artist && canReplaceArtist) {
                            patch.artist = result.artist;
                        }
                        if (result.album && (forceOverwrite || !String(liveTrk.album || '').trim())) {
                            patch.album = result.album;
                        }
                        if (result.year && (forceOverwrite || !String(liveTrk.year || '').trim())) {
                            patch.year = result.year;
                        }
                        if (result.genre && (forceOverwrite || !String(liveTrk.genre || '').trim())) {
                            patch.genre = result.genre;
                        }
                        if (result.coverBytes && (forceOverwrite || !liveTrk.coverBytes)) {
                            patch.coverBytes = result.coverBytes;
                            patch.coverMime = result.coverMime || 'image/jpeg';
                        }

                        engine.updateTrackMeta(trackId, patch);
                        applySessionMetaIfEmpty({
                            album: result.album,
                            year: result.year,
                            genre: result.genre,
                            coverBytes: result.coverBytes,
                            coverMime: result.coverMime
                        });
                        syncWaveTrackDisplay();
                        renderTracksList();
                        const dispArtist = (patch.artist || liveTrk.artist || '').trim();
                        const dispTitle = (patch.title || liveTrk.title || '').trim();
                        showToast(`🏷️ Auto-tagged: ${dispArtist ? dispArtist + ' — ' : ''}${dispTitle}`, 'success');
                        return true;
                    }

                    // Fallback: if track already has a non-generic title (from ID3 or filename) and is missing album/art/tags, enrich via iTunes
                    const hasUsableQuery = !IdentifyEngine.isGenericTrackTitle(liveTrk.title) &&
                        (!liveTrk.album || !liveTrk.coverBytes || !liveTrk.artist || !liveTrk.genre || !liveTrk.year);
                    if (hasUsableQuery && typeof IdentifyEngine.enrichFromItunes === 'function') {
                        const extra = await IdentifyEngine.enrichFromItunes(liveTrk.title, liveTrk.artist);
                        const latestTrk = (engine.tracks || []).find(t => t.id === trackId);
                        if (!latestTrk) return false;
                        if (extra && extra.matched && (extra.album || extra.coverBytes || extra.artist || extra.genre || extra.year)) {
                            const patch = {
                                identifying: false,
                                identified: true,
                                autoTagStatus: 'tagged',
                                tagSource: latestTrk.tagSource === 'id3' ? 'id3' : 'auto',
                                saved: false
                            };
                            if (extra.title && (forceOverwrite || (!latestTrk.userEditedTitle && !latestTrk.hasId3Title))) {
                                patch.title = extra.title;
                            }
                            if (extra.artist && (forceOverwrite || (!latestTrk.userEditedArtist && !String(latestTrk.artist || '').trim()))) {
                                patch.artist = extra.artist;
                            }
                            if (extra.album && (forceOverwrite || !String(latestTrk.album || '').trim())) {
                                patch.album = extra.album;
                            }
                            if (extra.year && (forceOverwrite || !String(latestTrk.year || '').trim())) {
                                patch.year = extra.year;
                            }
                            if (extra.genre && (forceOverwrite || !String(latestTrk.genre || '').trim())) {
                                patch.genre = extra.genre;
                            }
                            if (extra.coverBytes && (forceOverwrite || !latestTrk.coverBytes)) {
                                patch.coverBytes = extra.coverBytes;
                                patch.coverMime = extra.coverMime || 'image/jpeg';
                            }
                            engine.updateTrackMeta(trackId, patch);
                            applySessionMetaIfEmpty({
                                album: extra.album,
                                year: extra.year,
                                genre: extra.genre,
                                coverBytes: extra.coverBytes,
                                coverMime: extra.coverMime
                            });
                            syncWaveTrackDisplay();
                            renderTracksList();
                            const dispArtist = (patch.artist || latestTrk.artist || '').trim();
                            const dispTitle = (patch.title || latestTrk.title || '').trim();
                            showToast(`🏷️ Tagged: ${dispArtist ? dispArtist + ' — ' : ''}${dispTitle}`, 'success');
                            return true;
                        }
                    }

                    engine.updateTrackMeta(trackId, {
                        identifying: false,
                        autoTagStatus: liveTrk.tagSource === 'id3' ? 'tagged' : 'unmatched'
                    });
                    renderTracksList();
                    if (manual) {
                        showToast('No automatic tag match found — type Title & Artist directly.', 'info');
                    }
                    return false;
                } catch (err) {
                    const liveTrk = (engine.tracks || []).find(t => t.id === trackId);
                    engine.updateTrackMeta(trackId, {
                        identifying: false,
                        autoTagStatus: (liveTrk && liveTrk.tagSource === 'id3') ? 'tagged' : 'unmatched'
                    });
                    renderTracksList();
                    if (manual) {
                        showToast(`Tagging unavailable: ${(err && err.message) || 'Network error'}`, 'info');
                    }
                    return false;
                } finally {
                    inFlightIdentifyPromises.delete(trackId);
                }
            })();

            inFlightIdentifyPromises.set(trackId, runPromise);
            return runPromise;
        }

        function queueAutoTagTracks(tracks = null) {
            if (!isAutoTagEnabled()) return;
            const list = (Array.isArray(tracks) ? tracks : (engine.tracks || [])).filter(shouldAutoTagTrack);
            list.forEach(trk => { identifyTrackById(trk.id, { manual: false, forceOverwrite: false }); });
        }

        function queueAutoIdentifyGenericTracks() {
            queueAutoTagTracks(engine.tracks);
        }

        async function handleLoadAudioFile(file) {
            if (!file) return;
            try {
                showToast(`Loading ${file.name}...`, 'info');
                const info = await engine.importAudioFile(file);
                if (albumArtistMetaInput && info.artist && !albumArtistMetaInput.value) {
                    albumArtistMetaInput.value = info.artist;
                }
                applySessionMetaIfEmpty(info);
                userHasZoomed = false;
                clampViewport();
                syncPanScrollbar();
                renderTracksList();
                updateUiState();
                showToast(`Loaded "${file.name}" (${formatTimecode(info.length / info.sampleRate, false)})`, 'success');
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
                syncSettingsToEngine();
                const flushActive = isTrackByTrackFlushActive();
                showToast(
                    flushActive
                        ? `📁 Connected "${res.name}" — Track-by-Track Flush armed (0 browser storage)`
                        : `📁 Connected folder "${res.name}"`,
                    'success'
                );
                // If connected mid-recording, immediately save & flush any already-completed tracks
                if (flushActive && (engine.recordState === 'recording' || engine.recordState === 'paused')) {
                    engine.getUnflushedTracks().forEach(t => {
                        if (!t.saving) queueLiveAutoSaveTrack(t);
                    });
                }
                updateUiState();
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
            const sessionAlbum = albumMetaInput ? albumMetaInput.value.trim() : '';
            const sessionYear = yearMetaInput ? yearMetaInput.value.trim() : '';
            const sessionGenre = genreMetaInput ? genreMetaInput.value.trim() : '';
            return {
                title: (track && track.title) || `Track ${idx + 1}`,
                artist: (track && track.artist) || albumArtist,
                album: (track && track.album) || sessionAlbum,
                trackNumber: `${idx + 1}/${Math.max(1, total)}`,
                year: (track && track.year) || sessionYear,
                genre: (track && track.genre) || sessionGenre,
                coverBytes: (track && track.coverBytes) || coverArtBytes,
                coverMime: (track && track.coverBytes ? track.coverMime : coverArtMime) || 'image/jpeg'
            };
        }

        function queueLiveAutoSaveTrack(track) {
            if (!track || track.flushed || track.evictedFromRam || track.saving) return;
            const useDirectory = Boolean(dirHandle);
            const useDownloadFallback = !useDirectory && !supportsFolderPicker && !isMobileUa && Boolean(autoSaveLiveToggle && autoSaveLiveToggle.checked);
            if (!useDirectory && !useDownloadFallback) return;

            track.saving = true;
            renderTracksList();
            autoSaveQueue = autoSaveQueue.then(async () => {
                if (track.flushed || track.evictedFromRam) {
                    track.saving = false;
                    return;
                }
                try {
                    const liveTrk = engine.tracks.find(t => t.id === track.id) || track;
                    if (liveTrk.flushed || liveTrk.evictedFromRam || liveTrk.endSample <= liveTrk.startSample) {
                        liveTrk.saving = false;
                        return;
                    }
                    const total = Math.max(liveTrk.index + 1, engine.tracks.length);
                    const meta = buildTrackExportMeta(liveTrk, liveTrk.index, total);
                    const { ext, blob } = await encodeTrackToBlob(liveTrk.startSample, liveTrk.endSample, meta);
                    const rawFilename = ExportEngine.buildTrackFilename(meta, liveTrk.index, total, ext);
                    const filename = allocateUniqueFilename(rawFilename);

                    let savedName = filename;
                    let method = 'download';
                    if (dirHandle) {
                        savedName = await ExportEngine.saveBlobToDirectory(dirHandle, filename, blob);
                        method = 'directory';
                    } else {
                        ExportEngine.triggerAnchorDownload(blob, filename);
                        method = 'download';
                    }

                    const shouldFlushRam = Boolean(flushOnSaveToggle && flushOnSaveToggle.checked);
                    if (shouldFlushRam) {
                        // Cap retained per-track cover bytes on marathon sessions so RAM stays flat over 12+ hours
                        if (engine.getFlushedTrackCount() >= 25 && liveTrk.coverBytes) {
                            liveTrk.coverBytes = null;
                        }
                        const res = engine.markTrackFlushedAndCompact(liveTrk.id, {
                            filename: savedName,
                            method,
                            byteSize: blob ? blob.size : 0
                        });
                        renderTracksList();
                        const freedMsg = res.freedBytes > 0 ? ` • ${formatBytesCompact(res.freedBytes)} RAM freed` : '';
                        showToast(`💾 Flushed "${savedName}"${freedMsg}`, 'success');
                    } else {
                        liveTrk.saving = false;
                        liveTrk.saved = true;
                        liveTrk.savedFilename = savedName;
                        liveTrk.savedMethod = method;
                        renderTracksList();
                        showToast(`💾 Auto-saved "${savedName}"`, 'success');
                    }
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
            if (isExporting) return;
            const track = engine.tracks[trackIdx];
            if (!track) return;
            if (track.flushed || track.evictedFromRam) {
                showToast(`"${track.savedFilename || track.title}" is already saved to disk.`, 'info');
                return;
            }
            if (engine.length === 0) return;
            isExporting = true;
            if (inFlightIdentifyPromises.has(track.id)) {
                setExportProgress(true, 'Auto-tagging song metadata...', 2);
                await waitForTrackAutoTag(track.id, 12000);
            }
            const latestTrack = engine.tracks[trackIdx] || track;
            latestTrack.saving = true;
            renderTracksList();
            setExportProgress(true, `Encoding ${latestTrack.title}...`, 5);
            try {
                const total = engine.tracks.length;
                const meta = buildTrackExportMeta(latestTrack, trackIdx, total);
                const { ext, blob } = await encodeTrackToBlob(latestTrack.startSample, latestTrack.endSample, meta, (pct) => {
                    setExportProgress(true, `Encoding ${latestTrack.title}... ${pct}%`, pct);
                });
                const filename = ExportEngine.buildTrackFilename(meta, trackIdx, total, ext);
                const res = useNativeShare
                    ? await ExportEngine.shareBlobFile(blob, filename)
                    : await ExportEngine.saveBlobWithPickerOrDownload(blob, filename, ext, dirHandle);
                latestTrack.saving = false;
                if (res.method !== 'cancelled') {
                    latestTrack.saved = true;
                    showToast(`💾 ${res.method === 'share' ? 'Shared' : 'Saved'} ${res.filename}`, 'success');
                }
            } catch (err) {
                latestTrack.saving = false;
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
            if (isExporting) return;
            const flushedCount = engine.getFlushedTrackCount();
            const unflushed = engine.getUnflushedTracks();

            if (engine.length === 0) {
                if (flushedCount > 0) {
                    showToast(`✅ All ${flushedCount} track${flushedCount === 1 ? '' : 's'} are already saved to disk!`, 'success');
                }
                return;
            }

            const tracks = unflushed.length > 0
                ? unflushed
                : [{ id: 'trk_full', index: engine.tracks.length, title: 'Recording 01', artist: '', startSample: 0, endSample: engine.length }];

            if (tracks.length === 1 && !dirHandle) {
                const idx = engine.tracks.indexOf(tracks[0]);
                if (idx >= 0) {
                    await saveSingleTrack(idx, false);
                    return;
                }
            }

            if (tracks.length > 1 && !dirHandle && supportsFolderPicker) {
                await handlePickFolder();
            }

            isExporting = true;
            const zipFiles = [];
            let savedCount = 0;

            try {
                const pendingTagIds = tracks.filter(t => inFlightIdentifyPromises.has(t.id)).map(t => t.id);
                if (pendingTagIds.length > 0) {
                    setExportProgress(true, `Auto-tagging ${pendingTagIds.length} song${pendingTagIds.length === 1 ? '' : 's'}...`, 2);
                    await Promise.all(pendingTagIds.map(id => waitForTrackAutoTag(id, 12000)));
                }
                const totalSessionTracks = Math.max(tracks.length, engine.tracks.length);
                for (let i = 0; i < tracks.length; i++) {
                    const trk = tracks[i];
                    const trkNumIdx = Number.isInteger(trk.index) ? trk.index : i;
                    trk.saving = true;
                    renderTracksList();
                    const meta = buildTrackExportMeta(trk, trkNumIdx, totalSessionTracks);
                    const { ext, blob } = await encodeTrackToBlob(trk.startSample, trk.endSample, meta, (pct) => {
                        const overall = Math.round(((i + pct / 100) / tracks.length) * 100);
                        setExportProgress(true, `Encoding track ${i + 1}/${tracks.length}: ${meta.title} (${pct}%)`, overall);
                    });
                    const filename = allocateUniqueFilename(ExportEngine.buildTrackFilename(meta, trkNumIdx, totalSessionTracks, ext));

                    if (dirHandle) {
                        const savedName = await ExportEngine.saveBlobToDirectory(dirHandle, filename, blob);
                        trk.saved = true;
                        trk.savedFilename = savedName;
                        trk.savedMethod = 'directory';
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
            const flushedCount = engine.getFlushedTrackCount();
            const unflushedCount = tracks.length - flushedCount;
            trackCountBadge.textContent = flushedCount > 0
                ? `${tracks.length} Track${tracks.length === 1 ? '' : 's'} (${flushedCount} Flushed)`
                : `${tracks.length} Track${tracks.length === 1 ? '' : 's'}`;

            if (exportAllLabel) {
                const targetNoun = supportsFolderPicker ? 'Hard Drive' : 'Device';
                if (tracks.length > 0 && unflushedCount === 0) {
                    exportAllLabel.textContent = `All ${tracks.length} Saved to Disk ✓`;
                } else if (unflushedCount > 1) {
                    exportAllLabel.textContent = flushedCount > 0
                        ? `Save ${unflushedCount} Remaining to ${targetNoun}`
                        : `Save All ${unflushedCount} Tracks to ${targetNoun}`;
                } else {
                    exportAllLabel.textContent = `Save Track to ${targetNoun}`;
                }
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

            // Window older flushed tracks to keep multi-day (1,000+ song) lists fast in the DOM
            const flushedIndices = [];
            for (let i = 0; i < tracks.length; i++) {
                if (tracks[i].flushed) flushedIndices.push(i);
            }
            const hiddenFlushedCount = Math.max(0, flushedIndices.length - visibleFlushedLimit);
            const hiddenSet = hiddenFlushedCount > 0 ? new Set(flushedIndices.slice(0, hiddenFlushedCount)) : null;

            if (flushedIndices.length > TRACKS_WINDOW_STEP) {
                const windowBar = document.createElement('div');
                windowBar.className = 'tracks-window-bar';

                const shownFlushed = flushedIndices.length - hiddenFlushedCount;
                const infoEl = document.createElement('span');
                infoEl.className = 'tracks-window-info';
                infoEl.textContent = hiddenFlushedCount > 0
                    ? `🗂️ Showing latest ${shownFlushed} of ${flushedIndices.length} flushed tracks (${hiddenFlushedCount} older saved on disk)`
                    : `🗂️ Showing all ${flushedIndices.length} flushed tracks`;

                const actionsEl = document.createElement('div');
                actionsEl.className = 'tracks-window-actions';

                if (hiddenFlushedCount > 0) {
                    const stepCount = Math.min(TRACKS_WINDOW_STEP, hiddenFlushedCount);
                    const loadMoreBtn = document.createElement('button');
                    loadMoreBtn.type = 'button';
                    loadMoreBtn.className = 'tracks-window-btn';
                    loadMoreBtn.textContent = `⬆ Load Earlier ${stepCount}`;
                    loadMoreBtn.addEventListener('click', () => {
                        visibleFlushedLimit += TRACKS_WINDOW_STEP;
                        renderTracksList();
                    });
                    actionsEl.appendChild(loadMoreBtn);

                    const showAllBtn = document.createElement('button');
                    showAllBtn.type = 'button';
                    showAllBtn.className = 'tracks-window-btn';
                    showAllBtn.textContent = `Show All (${flushedIndices.length})`;
                    showAllBtn.addEventListener('click', () => {
                        visibleFlushedLimit = flushedIndices.length;
                        renderTracksList();
                    });
                    actionsEl.appendChild(showAllBtn);
                }

                if (visibleFlushedLimit > TRACKS_WINDOW_STEP) {
                    const collapseBtn = document.createElement('button');
                    collapseBtn.type = 'button';
                    collapseBtn.className = 'tracks-window-btn';
                    collapseBtn.textContent = `Show Latest ${TRACKS_WINDOW_STEP}`;
                    collapseBtn.addEventListener('click', () => {
                        visibleFlushedLimit = TRACKS_WINDOW_STEP;
                        renderTracksList();
                    });
                    actionsEl.appendChild(collapseBtn);
                }

                windowBar.appendChild(infoEl);
                windowBar.appendChild(actionsEl);
                tracksList.appendChild(windowBar);
            }

            const padWidth = tracks.length >= 1000 ? 4 : (tracks.length >= 100 ? 3 : 2);

            tracks.forEach((trk, idx) => {
                if (hiddenSet && hiddenSet.has(idx)) return;
                const isFlushed = Boolean(trk.flushed);
                const sr = Math.max(1, engine.sampleRate);
                const durSec = isFlushed && Number.isFinite(trk.durationSec)
                    ? Math.max(0, trk.durationSec)
                    : Math.max(0, (trk.endSample - trk.startSample) / sr);
                const absStartSample = isFlushed && Number.isFinite(trk.sessionStartSample)
                    ? trk.sessionStartSample
                    : (engine.bufferOffsetSamples + trk.startSample);
                const absEndSample = isFlushed && Number.isFinite(trk.sessionEndSample)
                    ? trk.sessionEndSample
                    : (engine.bufferOffsetSamples + trk.endSample);
                const startStr = formatTimecode(absStartSample / sr, false);
                const endStr = formatTimecode(absEndSample / sr, false);
                const durStr = formatTimecode(durSec, false);

                const row = document.createElement('div');
                row.className = 'track-row-card';
                if (isFlushed) row.classList.add('is-flushed');
                const isPlayingThisDisk = isFlushed && playingDiskTrackId === trk.id;
                const isPlayingThisLive = !isFlushed && engine.isPlaying && engine._playbackRange &&
                    engine._playbackRange.start === trk.startSample &&
                    engine._playbackRange.end === trk.endSample;
                if (isPlayingThisDisk || isPlayingThisLive) {
                    row.classList.add('is-playing');
                }

                const mainRow = document.createElement('div');
                mainRow.className = 'track-row-main';

                const numBadge = document.createElement('div');
                numBadge.className = 'track-num-badge';
                numBadge.textContent = String(idx + 1).padStart(padWidth, '0');

                const coverThumbUrl = trk.coverBytes ? getTrackCoverObjectUrl(trk.coverBytes, trk.coverMime) : '';
                let coverThumbEl = null;
                if (coverThumbUrl) {
                    coverThumbEl = document.createElement('img');
                    coverThumbEl.className = 'track-cover-thumb';
                    coverThumbEl.src = coverThumbUrl;
                    coverThumbEl.alt = trk.album || trk.title || 'Cover art';
                    coverThumbEl.title = [trk.album, trk.year, trk.genre].filter(Boolean).join(' • ') || 'Embedded cover art';
                }

                const titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.className = 'studio-input track-title-input';
                titleInput.value = trk.title || `Track ${idx + 1}`;
                titleInput.placeholder = 'Track Title';
                titleInput.setAttribute('aria-label', `Track ${idx + 1} title`);
                if (isFlushed) {
                    titleInput.readOnly = true;
                    titleInput.title = trk.savedFilename ? `Flushed to disk: ${trk.savedFilename}` : 'Flushed to disk';
                } else {
                    titleInput.addEventListener('input', () => {
                        engine.updateTrackMeta(trk.id, { title: titleInput.value, userEditedTitle: true, saved: false });
                        syncWaveTrackDisplay();
                    });
                }

                const artistInput = document.createElement('input');
                artistInput.type = 'text';
                artistInput.className = 'studio-input track-artist-input';
                artistInput.value = trk.artist || '';
                artistInput.placeholder = albumArtistMetaInput && albumArtistMetaInput.value ? albumArtistMetaInput.value : 'Artist (optional)';
                artistInput.setAttribute('aria-label', `Track ${idx + 1} artist`);
                if (isFlushed) {
                    artistInput.readOnly = true;
                } else {
                    artistInput.addEventListener('input', () => {
                        engine.updateTrackMeta(trk.id, { artist: artistInput.value, userEditedArtist: true, saved: false });
                        syncWaveTrackDisplay();
                    });
                }

                const actions = document.createElement('div');
                actions.className = 'track-row-actions';

                const playTrkBtn = document.createElement('button');
                playTrkBtn.type = 'button';
                playTrkBtn.className = 'row-icon-btn';
                if (isFlushed) {
                    const canPlayFromFolder = Boolean(dirHandle && trk.savedFilename && trk.savedMethod === 'directory');
                    playTrkBtn.title = canPlayFromFolder ? `Play "${trk.savedFilename}" from folder` : 'Already downloaded to your device';
                    playTrkBtn.disabled = !canPlayFromFolder;
                    playTrkBtn.textContent = isPlayingThisDisk ? '⏹ Stop' : '▶ Play';
                    playTrkBtn.addEventListener('click', () => playFlushedTrackFromDisk(trk));
                } else {
                    playTrkBtn.title = 'Play track';
                    playTrkBtn.textContent = '▶ Play';
                    playTrkBtn.addEventListener('click', () => {
                        engine.setSelection(trk.startSample, trk.endSample);
                        engine.play(trk.startSample, trk.endSample);
                    });
                }

                const saveTrkBtn = document.createElement('button');
                saveTrkBtn.type = 'button';
                saveTrkBtn.className = `row-icon-btn row-save-btn${trk.saved ? ' saved' : ''}`;
                if (isFlushed) {
                    saveTrkBtn.title = trk.savedFilename ? `Flushed to disk: ${trk.savedFilename}` : 'Flushed to disk';
                    saveTrkBtn.disabled = true;
                    saveTrkBtn.textContent = '✓ On Disk';
                } else {
                    saveTrkBtn.title = 'Save this track';
                    saveTrkBtn.disabled = Boolean(trk.saving);
                    saveTrkBtn.textContent = trk.saving ? '⏳...' : (trk.saved ? '✓ Saved' : '💾 Save');
                    saveTrkBtn.addEventListener('click', () => saveSingleTrack(idx, false));
                }

                actions.appendChild(playTrkBtn);
                actions.appendChild(saveTrkBtn);

                if (showMobileShare && !isFlushed) {
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
                if (coverThumbEl) mainRow.appendChild(coverThumbEl);
                mainRow.appendChild(titleInput);
                mainRow.appendChild(artistInput);
                mainRow.appendChild(actions);

                const subRow = document.createElement('div');
                subRow.className = 'track-row-sub';

                const metaGroup = document.createElement('div');
                metaGroup.className = 'track-sub-meta-group';

                const timeMeta = document.createElement('div');
                timeMeta.className = 'track-time-meta';
                timeMeta.textContent = `${startStr}–${endStr} (${durStr})`;
                metaGroup.appendChild(timeMeta);

                if (isFlushed) {
                    const flushedPill = document.createElement('span');
                    flushedPill.className = 'track-tag-pill is-flushed';
                    flushedPill.textContent = trk.savedMethod === 'download' ? '💾 Downloaded • RAM Freed' : '💾 Flushed to Disk';
                    flushedPill.title = trk.savedFilename ? `Saved as ${trk.savedFilename} (PCM evicted from browser RAM)` : 'PCM evicted from browser RAM';
                    metaGroup.appendChild(flushedPill);
                }

                if (trk.identifying) {
                    const tagPill = document.createElement('span');
                    tagPill.className = 'track-tag-pill is-tagging';
                    tagPill.textContent = '⏳ Auto-tagging…';
                    metaGroup.appendChild(tagPill);
                } else {
                    const tagBits = [trk.album, trk.genre, trk.year].filter(Boolean);
                    if (trk.identified || tagBits.length > 0) {
                        const tagPill = document.createElement('span');
                        tagPill.className = 'track-tag-pill is-tagged';
                        const summary = tagBits.join(' • ');
                        const prefix = trk.tagSource === 'id3' ? '🏷️ ID3' : '🏷️ Auto-tagged';
                        tagPill.textContent = summary ? `🏷️ ${summary}` : prefix;
                        tagPill.title = summary ? `${prefix}: ${summary}` : prefix;
                        metaGroup.appendChild(tagPill);
                    }
                }

                const subTools = document.createElement('div');
                subTools.className = 'track-sub-tools';

                if (!isFlushed) {
                    const idBtn = document.createElement('button');
                    idBtn.type = 'button';
                    idBtn.className = `row-icon-btn row-identify-btn${trk.identified ? ' identified' : ''}`;
                    idBtn.disabled = Boolean(trk.identifying);
                    idBtn.title = trk.identifying ? 'Auto-tagging song...' : 'Re-tag song automatically (AcoustID)';
                    idBtn.setAttribute('aria-label', `Re-tag track ${idx + 1}`);
                    idBtn.textContent = trk.identifying ? '⏳' : '🪄';
                    idBtn.addEventListener('click', () => identifyTrackById(trk.id, { manual: true, forceOverwrite: true }));
                    subTools.appendChild(idBtn);

                    const selTrkBtn = document.createElement('button');
                    selTrkBtn.type = 'button';
                    selTrkBtn.className = 'row-icon-btn';
                    selTrkBtn.title = 'Select on wave';
                    selTrkBtn.textContent = '🎯';
                    selTrkBtn.addEventListener('click', () => {
                        engine.setSelection(trk.startSample, trk.endSample);
                        engine.cursorSample = trk.startSample;
                        updateUiState();
                    });
                    subTools.appendChild(selTrkBtn);

                    if (idx > 0 && !tracks[idx - 1].flushed) {
                        const mergeBtn = document.createElement('button');
                        mergeBtn.type = 'button';
                        mergeBtn.className = 'row-icon-btn';
                        mergeBtn.title = 'Merge with previous track';
                        mergeBtn.textContent = '🔗';
                        mergeBtn.addEventListener('click', () => engine.mergeTrackWithPrevious(trk.id));
                        subTools.appendChild(mergeBtn);
                    }
                }

                if (tracks.length > 1) {
                    const rmBtn = document.createElement('button');
                    rmBtn.type = 'button';
                    rmBtn.className = 'row-icon-btn';
                    rmBtn.title = isFlushed ? 'Remove from list (file stays on disk)' : 'Remove track';
                    rmBtn.textContent = '✕';
                    rmBtn.addEventListener('click', () => engine.deleteTrackRegion(trk.id));
                    subTools.appendChild(rmBtn);
                }

                subRow.appendChild(metaGroup);
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

            if (waveformEmptyHint) {
                waveformEmptyHint.classList.toggle('hidden', hasAudio || !isIdle || connected);
            }
            if (waveformToolsBar) {
                waveformToolsBar.classList.toggle('hidden', !hasAudio);
            }
            if (disconnectSourceBtn) {
                disconnectSourceBtn.classList.toggle('hidden', !connected);
            }
            if (marathonModeBtn) {
                const marathonActive = isTrackByTrackFlushActive();
                marathonModeBtn.classList.toggle('is-active', marathonActive);
                if (marathonModeLabel) {
                    marathonModeLabel.textContent = marathonActive ? 'Marathon Active ✓' : 'Marathon (12h+)';
                }
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
                stopBtn.disabled = isIdle && !engine.isPlaying && !playingDiskTrackId;
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
            if (clearSessionBtn) clearSessionBtn.disabled = !(hasAudio || engine.tracks.length > 0);
            if (scanSplitNowBtn) scanSplitNowBtn.disabled = !hasAudio || !isIdle;
            if (quickAutoSplitBtn) quickAutoSplitBtn.disabled = !hasAudio || !isIdle;
            if (exportAllBtn) exportAllBtn.disabled = !hasAudio || !isIdle;

            if (lcdFormatInfo) {
                const dur = formatTimecode(engine.getTotalDurationSeconds(), false);
                const flushedCount = engine.getFlushedTrackCount();
                const ramStr = formatBytesCompact(engine.getRamUsageBytes());
                if (flushedCount > 0 || (isTrackByTrackFlushActive() && !isIdle)) {
                    lcdFormatInfo.textContent = `${(engine.sampleRate / 1000).toFixed(1)} kHz • Stereo • ${dur} • RAM ${ramStr}${flushedCount > 0 ? ` • ${flushedCount} Flushed` : ''}`;
                } else {
                    lcdFormatInfo.textContent = `${(engine.sampleRate / 1000).toFixed(1)} kHz • Stereo • ${dur}`;
                }
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

            syncWaveTrackDisplay();
            syncGuidedStepBanner();
        }

        // --- Continuous Visible Stereo Waveform Canvas Rendering ---
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

            // Background
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, W, H);

            // Top Left lane subtle tint & ±50% amplitude guides
            ctx.fillStyle = 'rgba(2, 132, 199, 0.045)';
            ctx.fillRect(0, WAVE_TOP, W, WAVE_H * 0.5);
            ctx.fillStyle = 'rgba(13, 148, 136, 0.04)';
            ctx.fillRect(0, WAVE_TOP + WAVE_H * 0.5, W, WAVE_H * 0.5);

            // L/R divider
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, WAVE_TOP + WAVE_H * 0.5);
            ctx.lineTo(W, WAVE_TOP + WAVE_H * 0.5);
            ctx.stroke();

            // Zero-crossing centerlines for L and R
            ctx.strokeStyle = 'rgba(2, 132, 199, 0.28)';
            ctx.beginPath();
            ctx.moveTo(0, MID_Y_L);
            ctx.lineTo(W, MID_Y_L);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(13, 148, 136, 0.28)';
            ctx.beginPath();
            ctx.moveTo(0, MID_Y_R);
            ctx.lineTo(W, MID_Y_R);
            ctx.stroke();

            // Subtle ±50% guide lines
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)';
            ctx.beginPath();
            ctx.moveTo(0, MID_Y_L - CH_AMP * 0.5);
            ctx.lineTo(W, MID_Y_L - CH_AMP * 0.5);
            ctx.moveTo(0, MID_Y_L + CH_AMP * 0.5);
            ctx.lineTo(W, MID_Y_L + CH_AMP * 0.5);
            ctx.moveTo(0, MID_Y_R - CH_AMP * 0.5);
            ctx.lineTo(W, MID_Y_R - CH_AMP * 0.5);
            ctx.moveTo(0, MID_Y_R + CH_AMP * 0.5);
            ctx.lineTo(W, MID_Y_R + CH_AMP * 0.5);
            ctx.stroke();

            // Always-visible LEFT & RIGHT channel labels
            ctx.font = 'bold 10px ui-monospace, monospace';
            ctx.fillStyle = 'rgba(3, 105, 161, 0.9)';
            ctx.fillText('LEFT', 8, WAVE_TOP + 13);
            ctx.fillStyle = 'rgba(15, 118, 110, 0.9)';
            ctx.fillText('RIGHT', 8, WAVE_TOP + WAVE_H * 0.5 + 13);

            // Ruler & bottom tracks lane
            ctx.fillStyle = '#eef2f6';
            ctx.fillRect(0, 0, W, RULER_H);
            ctx.fillRect(0, H - LANE_H, W, LANE_H);

            const total = engine.length;
            const liveSampleInfo = engine.getLiveWaveSamples();

            // Live oscilloscope preview when input is connected/armed before samples accumulate
            if (total === 0 && liveSampleInfo.active && liveSampleInfo.left.length > 0) {
                const len = liveSampleInfo.left.length;
                ctx.lineWidth = 1.6;
                ctx.strokeStyle = '#0284c7';
                ctx.beginPath();
                for (let i = 0; i < len; i++) {
                    const x = (i / (len - 1)) * W;
                    const y = MID_Y_L - Math.max(-1, Math.min(1, liveSampleInfo.left[i])) * CH_AMP;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();

                ctx.strokeStyle = '#0d9488';
                ctx.beginPath();
                for (let i = 0; i < len; i++) {
                    const x = (i / (len - 1)) * W;
                    const y = MID_Y_R - Math.max(-1, Math.min(1, liveSampleInfo.right[i])) * CH_AMP;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            if (total > 0 && viewSpanSamples > 0) {
                const startSec = (engine.bufferOffsetSamples + viewStartSample) / engine.sampleRate;
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
                ctx.fillStyle = '#475569';
                for (let t = firstTick; t <= startSec + spanSec; t += tickStep) {
                    const x = ((t - startSec) / spanSec) * W;
                    ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
                    ctx.beginPath();
                    ctx.moveTo(x, RULER_H - 5);
                    ctx.lineTo(x, RULER_H);
                    ctx.stroke();
                    ctx.fillText(formatTimecode(t, tickStep < 1), x + 4, 14);
                }

                // Track Regions Lane
                const tracks = engine.tracks || [];
                tracks.forEach((trk, idx) => {
                    if (trk.flushed) return;
                    const x0 = Math.max(0, sampleToX(trk.startSample, W));
                    const x1 = Math.min(W, sampleToX(trk.endSample, W));
                    if (x1 <= 0 || x0 >= W) return;

                    ctx.fillStyle = idx % 2 === 0 ? 'rgba(2, 132, 199, 0.14)' : 'rgba(13, 148, 136, 0.14)';
                    ctx.fillRect(x0, H - LANE_H + 2, Math.max(2, x1 - x0 - 1), LANE_H - 4);

                    if (x1 - x0 > 28) {
                        ctx.fillStyle = '#0f172a';
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
                            ctx.strokeStyle = '#d97706';
                            ctx.lineWidth = 1.5;
                            ctx.beginPath();
                            ctx.moveTo(bx, WAVE_TOP);
                            ctx.lineTo(bx, H - LANE_H);
                            ctx.stroke();
                            ctx.restore();
                        }
                    }
                });

                // Continuous Stereo Wave Envelope (world-space locked blocks to eliminate scroll vibration/aliasing)
                const samplesPerPx = viewSpanSamples / W;
                const bucketSize = engine.peakBucketSize || 128;

                // Deterministic power-of-2 world-space block size (~0.5 to 1.0 CSS px per block)
                // independent of viewStartSample so each block's peaks remain invariant while scrolling
                let blockSamples = 1;
                while (blockSamples * 2 <= samplesPerPx) {
                    blockSamples *= 2;
                }

                const usePeakCache = blockSamples >= bucketSize && engine.peakCount > 0 && (blockSamples % bucketSize === 0);
                const bucketsPerBlock = usePeakCache ? (blockSamples / bucketSize) : 1;

                const totalBlocks = Math.ceil(total / blockSamples);
                const kStart = Math.max(0, Math.floor(viewStartSample / blockSamples) - 1);
                const kEnd = Math.min(totalBlocks - 1, Math.ceil((viewStartSample + viewSpanSamples) / blockSamples) + 1);
                const maxBlocks = kEnd - kStart + 1;

                if (maxBlocks > 0) {
                    const maxWaveX = sampleToX(total, W);
                    const xs = new Float32Array(maxBlocks);
                    const topL = new Float32Array(maxBlocks);
                    const botL = new Float32Array(maxBlocks);
                    const topR = new Float32Array(maxBlocks);
                    const botR = new Float32Array(maxBlocks);
                    const clipXsL = [];
                    const clipXsR = [];
                    let drawnCount = 0;

                    for (let k = kStart; k <= kEnd; k++) {
                        const s0 = k * blockSamples;
                        if (s0 >= total) break;
                        const s1 = Math.min(total, s0 + blockSamples);

                        let minL = 32767, maxL = -32768, minR = 32767, maxR = -32768;
                        if (usePeakCache) {
                            const b0 = k * bucketsPerBlock;
                            const b1 = Math.min(engine.peakCount - 1, b0 + bucketsPerBlock - 1);
                            for (let b = b0; b <= b1; b++) {
                                if (engine.peaksMinL[b] < minL) minL = engine.peaksMinL[b];
                                if (engine.peaksMaxL[b] > maxL) maxL = engine.peaksMaxL[b];
                                if (engine.peaksMinR[b] < minR) minR = engine.peaksMinR[b];
                                if (engine.peaksMaxR[b] > maxR) maxR = engine.peaksMaxR[b];
                            }
                        } else {
                            // Full exact scan of every sample in this fixed world block (zero stride aliasing)
                            for (let i = s0; i < s1; i++) {
                                const lv = engine.left[i];
                                const rv = engine.right[i];
                                if (lv < minL) minL = lv;
                                if (lv > maxL) maxL = lv;
                                if (rv < minR) minR = rv;
                                if (rv > maxR) maxR = rv;
                            }
                        }

                        if (minL > maxL) { minL = 0; maxL = 0; }
                        if (minR > maxR) { minR = 0; maxR = 0; }

                        const sampleXPos = (k === totalBlocks - 1) ? s1 : (s0 + blockSamples * 0.5);
                        const x = Math.min(maxWaveX, (sampleXPos - viewStartSample) / samplesPerPx);
                        xs[drawnCount] = x;

                        let yTL = MID_Y_L - (maxL / 32768) * CH_AMP;
                        let yBL = MID_Y_L - (minL / 32768) * CH_AMP;
                        if (yBL - yTL < 1.5) {
                            const mid = 0.5 * (yTL + yBL);
                            yTL = mid - 0.75;
                            yBL = mid + 0.75;
                        }
                        topL[drawnCount] = yTL;
                        botL[drawnCount] = yBL;

                        let yTR = MID_Y_R - (maxR / 32768) * CH_AMP;
                        let yBR = MID_Y_R - (minR / 32768) * CH_AMP;
                        if (yBR - yTR < 1.5) {
                            const mid = 0.5 * (yTR + yBR);
                            yTR = mid - 0.75;
                            yBR = mid + 0.75;
                        }
                        topR[drawnCount] = yTR;
                        botR[drawnCount] = yBR;

                        if (maxL >= 32500 || minL <= -32500) clipXsL.push(x, yTL, yBL);
                        if (maxR >= 32500 || minR <= -32500) clipXsR.push(x, yTR, yBR);
                        drawnCount++;
                    }

                    const drawChannelEnvelope = (topArr, botArr, fillPlayed, fillAhead, playX, isPlay) => {
                        if (drawnCount === 0) return;
                        if (drawnCount === 1) {
                            const x0 = xs[0];
                            ctx.fillStyle = (isPlay && x0 > playX) ? fillAhead : fillPlayed;
                            ctx.fillRect(x0 - 0.75, topArr[0], 1.5, Math.max(1.5, botArr[0] - topArr[0]));
                            return;
                        }

                        const tracePath = () => {
                            ctx.beginPath();
                            ctx.moveTo(xs[0], topArr[0]);
                            for (let i = 1; i < drawnCount; i++) {
                                ctx.lineTo(xs[i], topArr[i]);
                            }
                            for (let i = drawnCount - 1; i >= 0; i--) {
                                ctx.lineTo(xs[i], botArr[i]);
                            }
                            ctx.closePath();
                        };

                        if (isPlay) {
                            const splitX = Math.max(0, Math.min(W, playX));
                            if (splitX > 0) {
                                ctx.save();
                                ctx.beginPath();
                                ctx.rect(0, WAVE_TOP, splitX, WAVE_H);
                                ctx.clip();
                                tracePath();
                                ctx.fillStyle = fillPlayed;
                                ctx.fill();
                                ctx.restore();
                            }
                            if (splitX < W) {
                                ctx.save();
                                ctx.beginPath();
                                ctx.rect(splitX, WAVE_TOP, W - splitX, WAVE_H);
                                ctx.clip();
                                tracePath();
                                ctx.fillStyle = fillAhead;
                                ctx.fill();
                                ctx.restore();
                            }
                        } else {
                            ctx.save();
                            ctx.beginPath();
                            ctx.rect(0, WAVE_TOP, W, WAVE_H);
                            ctx.clip();
                            tracePath();
                            ctx.fillStyle = fillPlayed;
                            ctx.fill();
                            ctx.restore();
                        }
                    };

                    const playCursor = engine.isPlaying ? getVisualPlaybackSample() : -1;
                    const playX = engine.isPlaying ? sampleToX(playCursor, W) : W;

                    drawChannelEnvelope(topL, botL, '#0284c7', 'rgba(2, 132, 199, 0.42)', playX, engine.isPlaying);
                    drawChannelEnvelope(topR, botR, '#0d9488', 'rgba(13, 148, 136, 0.42)', playX, engine.isPlaying);

                    if (clipXsL.length > 0 || clipXsR.length > 0) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(0, WAVE_TOP, W, WAVE_H);
                        ctx.clip();
                        ctx.fillStyle = '#dc2626';
                        for (let i = 0; i < clipXsL.length; i += 3) {
                            ctx.fillRect(clipXsL[i] - 0.75, clipXsL[i + 1], 1.5, Math.max(2, clipXsL[i + 2] - clipXsL[i + 1]));
                        }
                        for (let i = 0; i < clipXsR.length; i += 3) {
                            ctx.fillRect(clipXsR[i] - 0.75, clipXsR[i + 1], 1.5, Math.max(2, clipXsR[i + 2] - clipXsR[i + 1]));
                        }
                        ctx.restore();
                    }
                }

                // Selection highlight
                if (engine.selection && engine.selection.endSample > engine.selection.startSample) {
                    const sx0 = sampleToX(engine.selection.startSample, W);
                    const sx1 = sampleToX(engine.selection.endSample, W);
                    if (sx1 >= 0 && sx0 <= W) {
                        const cl0 = Math.max(0, sx0);
                        const cl1 = Math.min(W, sx1);
                        ctx.fillStyle = 'rgba(234, 88, 12, 0.16)';
                        ctx.fillRect(cl0, WAVE_TOP, cl1 - cl0, WAVE_H);
                        ctx.strokeStyle = 'rgba(234, 88, 12, 0.9)';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(sx0, WAVE_TOP);
                        ctx.lineTo(sx0, WAVE_TOP + WAVE_H);
                        ctx.moveTo(sx1, WAVE_TOP);
                        ctx.lineTo(sx1, WAVE_TOP + WAVE_H);
                        ctx.stroke();
                    }
                }

                // Recording / Playback needle
                const headSample = engine.recordState === 'recording'
                    ? engine.length
                    : (engine.isPlaying ? getVisualPlaybackSample() : engine.cursorSample);
                const hx = sampleToX(headSample, W);
                if (hx >= -2 && hx <= W + 2) {
                    ctx.strokeStyle = engine.recordState === 'recording' ? '#dc2626' : '#0f172a';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(hx, RULER_H);
                    ctx.lineTo(hx, H - LANE_H);
                    ctx.stroke();

                    if (engine.recordState === 'recording') {
                        ctx.fillStyle = '#dc2626';
                        ctx.beginPath();
                        ctx.arc(hx, RULER_H + 5, 4, 0, Math.PI * 2);
                        ctx.fill();
                    }
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

            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(0, 0, W, H);

            const norm = (db) => Math.max(0, Math.min(1, (db + 60) / 60));
            const lvl = norm(rmsDb);
            const grad = ctx.createLinearGradient(0, 0, W, 0);
            grad.addColorStop(0, '#059669');
            grad.addColorStop(0.65, '#16a34a');
            grad.addColorStop(0.84, '#d97706');
            grad.addColorStop(1, '#dc2626');

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, lvl * W, H);

            // Subtle segmented studio LED ticks
            ctx.fillStyle = '#e2e8f0';
            const segStep = Math.max(6, Math.round(W / 44));
            for (let x = segStep; x < W; x += segStep) {
                ctx.fillRect(x, 0, 1.5, H);
            }

            // Peak hold tick
            const holdX = norm(peakHoldDb) * W;
            if (holdX > 2) {
                ctx.fillStyle = peakHoldDb >= -1 ? '#dc2626' : '#0f172a';
                ctx.fillRect(Math.min(W - 3, holdX), 0, 2.5, H);
            }
            ctx.restore();
        }

        function animationTick(now) {
            if (lcdTimecode) {
                if (engine.recordState === 'recording') {
                    lcdTimecode.textContent = formatTimecode(engine.getTotalDurationSeconds());
                } else if (engine.isPlaying) {
                    lcdTimecode.textContent = formatTimecode((engine.bufferOffsetSamples + engine.getPlaybackPositionSample()) / engine.sampleRate);
                } else {
                    lcdTimecode.textContent = formatTimecode((engine.bufferOffsetSamples + engine.cursorSample) / engine.sampleRate);
                }
            }

            if (engine.recordState === 'recording' && now - lastRamCheckMs > 5000) {
                lastRamCheckMs = now;
                if (!isTrackByTrackFlushActive() && !warnedHighRamWithoutFolder && engine.getRamUsageBytes() > 350 * 1024 * 1024) {
                    warnedHighRamWithoutFolder = true;
                    showToast(
                        supportsFolderPicker
                            ? '⚡ Long recording: connect a Save Folder (top right) to enable Track-by-Track Flush & keep RAM low.'
                            : '⚡ Long recording: enable Auto-Download Live Tracks in Settings to flush RAM track-by-track.',
                        'warning'
                    );
                }
            }

            if (engine.isPlaying) {
                syncWaveTrackDisplay();
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

            if (meterDbReadout) {
                const maxPeak = Math.max(levels.left.peakDb, levels.right.peakDb);
                meterDbReadout.textContent = (levels.mode === 'idle' || maxPeak <= -59.5)
                    ? '-∞ dB'
                    : `${maxPeak.toFixed(0)} dB`;
            }

            if (engine.length !== lastObservedRecLength && engine.recordState === 'recording') {
                const wasZero = lastObservedRecLength === 0;
                lastObservedRecLength = engine.length;
                if (wasZero) updateUiState();
            } else if (engine.recordState === 'idle') {
                lastObservedRecLength = engine.length;
            }

            if (engine.recordState === 'recording' || engine.recordState === 'paused' || (engine.isPlaying && engine.length > 0)) {
                updateLiveScrollViewport(now);
                syncPanScrollbar();
            } else {
                resetSmoothScrollState();
            }

            drawVuBar(vuMeterL, levels.left.rmsDb, peakHoldL);
            drawVuBar(vuMeterR, levels.right.rmsDb, peakHoldR);

            drawWaveform();
            requestAnimationFrame(animationTick);
        }

        // --- Unified Pointer (Mouse + Touch) Interactions on Continuous Wave ---
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
                    const hitTrack = engine.tracks.find(t => !t.flushed && clickSample >= t.startSample && clickSample <= t.endSample);
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
                    const hit = engine.tracks.find(t => !t.flushed && sample >= t.startSample && sample <= t.endSample);
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
                    if (engine.tracks[i].flushed || engine.tracks[i - 1].flushed) continue;
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
                    if (engine.tracks[i].flushed || engine.tracks[i - 1].flushed) continue;
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
                if (engine.length === 0 || engine.recordState !== 'idle') return;
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
            if (engine.length === 0 || engine.recordState !== 'idle') return;
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

        // --- Wire Controls ---
        if (captureTabBtn) captureTabBtn.addEventListener('click', handleCaptureTabClick);
        if (emptyCaptureTabBtn) emptyCaptureTabBtn.addEventListener('click', handleCaptureTabClick);
        if (marathonModeBtn) marathonModeBtn.addEventListener('click', handleMarathonModeClick);
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
                stopDiskPlayback(false);
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
            stopDiskPlayback(true);
            usedSavedFilenames.clear();
            warnedHighRamWithoutFolder = false;
            visibleFlushedLimit = TRACKS_WINDOW_STEP;
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
                if (engine.length === 0 || !userHasZoomed || engine.recordState !== 'idle') return;
                const maxStart = Math.max(0, engine.length - viewSpanSamples);
                viewStartSample = Math.round((Number(waveformPanSlider.value) / 1000) * maxStart);
                clampViewport();
            });
        }

        // Auto-Split & Track-by-Track Flush Settings
        const syncSettingsToEngine = () => {
            const thresholdDb = thresholdDbSlider ? Number(thresholdDbSlider.value) : -42;
            const minSilenceSec = minSilenceSlider ? Number(minSilenceSlider.value) : 1.5;
            const minTrackSec = minTrackSlider ? Number(minTrackSlider.value) : 10;
            const maxSegmentMin = maxSegmentSlider ? Number(maxSegmentSlider.value) : 15;
            if (thresholdDbVal) thresholdDbVal.textContent = `${thresholdDb} dB`;
            if (minSilenceVal) minSilenceVal.textContent = `${minSilenceSec.toFixed(1)} s`;
            if (minTrackVal) minTrackVal.textContent = `${minTrackSec} s`;
            if (maxSegmentVal) maxSegmentVal.textContent = `${maxSegmentMin} min`;

            engine.updateSettings({
                liveAutoSplit: liveAutoSplitToggle ? liveAutoSplitToggle.checked : true,
                soundActivated: soundActivatedToggle ? soundActivatedToggle.checked : false,
                autoTrimSilence: autoTrimSilenceToggle ? autoTrimSilenceToggle.checked : true,
                flushToDiskMode: isTrackByTrackFlushActive(),
                maxSegmentSec: Math.max(60, maxSegmentMin * 60),
                thresholdDb,
                minSilenceSec,
                minTrackSec
            });
        };

        [liveAutoSplitToggle, soundActivatedToggle, autoTrimSilenceToggle, autoSaveLiveToggle, flushOnSaveToggle, thresholdDbSlider, minSilenceSlider, minTrackSlider, maxSegmentSlider].forEach(el => {
            if (el) el.addEventListener('input', syncSettingsToEngine);
            if (el) el.addEventListener('change', syncSettingsToEngine);
        });
        if (flushOnSaveToggle) {
            flushOnSaveToggle.addEventListener('change', () => {
                if (flushOnSaveToggle.checked && supportsFolderPicker && !dirHandle) {
                    showToast('📁 Pick a Save Folder in the top bar so finished tracks flush directly to disk.', 'info');
                }
                updateUiState();
            });
        }
        if (autoSaveLiveToggle) {
            autoSaveLiveToggle.addEventListener('change', () => {
                if (autoSaveLiveToggle.checked && supportsFolderPicker && !dirHandle) {
                    showToast('📁 Pick a Save Folder in the top bar to auto-save & flush tracks live.', 'info');
                }
                updateUiState();
            });
        }
        syncSettingsToEngine();

        if (autoIdentifyToggle) {
            autoIdentifyToggle.addEventListener('change', () => {
                if (autoIdentifyToggle.checked && engine.tracks.length > 0) {
                    engine.tracks.forEach(t => {
                        if (!t.identified && !t.identifying) t.autoTagAttempted = false;
                    });
                    queueAutoTagTracks(engine.tracks);
                }
            });
        }

        const runAutoSplitScan = () => {
            const tracks = engine.scanAndAutoSplit();
            showToast(`🔍 Detected ${tracks.length} track${tracks.length === 1 ? '' : 's'} by silence gaps`, 'success');
            if (isAutoTagEnabled()) {
                queueAutoTagTracks(engine.tracks);
            }
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
                    userEditedCoverArt = true;
                    setCoverArtPreview(new Uint8Array(buf), file.type || 'image/jpeg');
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
            } else if (e.key === 'Escape') {
                closeInlineDrawers();
            }
        });

        const drawersBar = document.getElementById('studioDrawersBar');
        const inlineDrawers = Array.from(document.querySelectorAll('.studio-drawer-inline'));
        function closeInlineDrawers(exceptDrawer = null) {
            inlineDrawers.forEach(d => {
                if (d !== exceptDrawer && d.open) d.open = false;
            });
        }
        inlineDrawers.forEach(d => {
            const summary = d.querySelector('.drawer-summary');
            if (summary) {
                summary.addEventListener('click', () => closeInlineDrawers(d));
            }
            d.addEventListener('toggle', () => {
                if (d.open) closeInlineDrawers(d);
            });
        });
        document.addEventListener('click', (e) => {
            if (drawersBar && !drawersBar.contains(e.target)) {
                closeInlineDrawers();
            }
        });

        if (yearMetaInput && !yearMetaInput.value) {
            yearMetaInput.value = String(new Date().getFullYear());
        }

        window.__STUDIO_STATE__ = {
            engine,
            getViewport: () => ({ viewStartSample, viewSpanSamples, userHasZoomed })
        };

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
