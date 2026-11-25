(function (global) {
    'use strict';

    /**
     * StudioAudioEngine
     * 100% client-side Audacity-style capture, live silence auto-splitting,
     * stereo Int16 PCM buffer management, DSP editing, Undo/Redo, and playback engine.
     */
    const PEAK_BUCKET_SIZE = 128;
    const MAX_UNDO_STATES = 15;
    const INITIAL_CAPACITY_SAMPLES = 48000 * 120; // 2 minutes initial capacity, grows automatically

    function floatToInt16Sample(v) {
        if (v >= 1.0) return 32767;
        if (v <= -1.0) return -32768;
        return v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
    }

    function computeStereoFrameDb(left, right, start, end) {
        let sumSq = 0;
        const count = Math.max(1, end - start);
        for (let i = start; i < end; i++) {
            const l = left[i] / 32768;
            const r = right[i] / 32768;
            sumSq += 0.5 * (l * l + r * r);
        }
        const rms = Math.sqrt(sumSq / count);
        return 20 * Math.log10(Math.max(rms, 1e-7));
    }

    class StudioAudioEngine {
        constructor(callbacks = {}) {
            this.callbacks = callbacks;

            // Core PCM storage
            this.sampleRate = 44100;
            this.left = new Int16Array(0);
            this.right = new Int16Array(0);
            this.length = 0;

            // Recording backing capacity (to avoid reallocating every block)
            this._recLeftCap = new Int16Array(0);
            this._recRightCap = new Int16Array(0);

            // Downsampled peak cache (512 samples/bucket)
            this.peakBucketSize = PEAK_BUCKET_SIZE;
            this.peaksMinL = new Int16Array(0);
            this.peaksMaxL = new Int16Array(0);
            this.peaksMinR = new Int16Array(0);
            this.peaksMaxR = new Int16Array(0);
            this.peakCount = 0;
            this._peakCap = 0;

            // Session tracks / split regions & selection
            this.tracks = [];
            this._nextTrackUid = 1;
            this.selection = null; // { startSample, endSample }
            this.cursorSample = 0;

            // Undo / Redo stacks
            this.undoStack = [];
            this.redoStack = [];

            // Web Audio nodes & capture stream
            this.audioCtx = null;
            this.mediaStream = null;
            this.sourceMode = null; // 'display' | 'mic' | 'file'
            this.sourceLabel = '';
            this.streamSourceNode = null;
            this.inputGainNode = null;
            this.monitorGainNode = null;
            this.silentSinkNode = null;
            this.captureNode = null;
            this.captureMode = ''; // 'worklet' | 'script'
            this.inAnalyserL = null;
            this.inAnalyserR = null;

            // Playback nodes
            this.playbackGainNode = null;
            this.outAnalyserL = null;
            this.outAnalyserR = null;
            this._meterBufL = new Float32Array(1024);
            this._meterBufR = new Float32Array(1024);
            this._waveBufL = new Float32Array(512);
            this._waveBufR = new Float32Array(512);
            this.playbackSource = null;
            this.isPlaying = false;
            this.loopPlayback = false;
            this.playStartSample = 0;
            this.playEndSample = 0;
            this.playStartedAtCtxTime = 0;
            this._playbackRange = null;

            // Gain / Monitor state
            this.inputGain = 1.0;
            this.playbackVolume = 1.0;
            this.monitorEnabled = false;

            // Recording & live silence state machine
            this.recordState = 'idle'; // 'idle' | 'armed' | 'recording' | 'paused'
            this.settings = {
                liveAutoSplit: true,
                soundActivated: false,
                thresholdDb: -42,
                minSilenceSec: 1.5,
                minTrackSec: 10,
                autoTrimSilence: true
            };

            this._liveState = null;
            this._preRollBuffer = [];
            this._preRollSamples = 0;
            this._armedSpeechSamples = 0;
            this._workletBlobUrl = null;
            this._workletLoadedCtx = null;
        }

        _emit(name, payload) {
            const fn = this.callbacks && this.callbacks[name];
            if (typeof fn === 'function') {
                try { fn(payload); } catch (err) { console.error(`[StudioAudioEngine] callback ${name} error:`, err); }
            }
        }

        async _ensureAudioContext(preferredSampleRate = null) {
            const Ctx = global.AudioContext || global.webkitAudioContext;
            if (!Ctx) throw new Error('Web Audio API is not supported in this browser.');

            if (!this.audioCtx || this.audioCtx.state === 'closed') {
                const opts = preferredSampleRate ? { sampleRate: preferredSampleRate } : undefined;
                try {
                    this.audioCtx = opts ? new Ctx(opts) : new Ctx();
                } catch (_) {
                    this.audioCtx = new Ctx();
                }
                this._setupSharedPlaybackNodes();
                this._workletLoadedCtx = null;
            }
            if (this.audioCtx.state === 'suspended') {
                await this.audioCtx.resume();
            }
            return this.audioCtx;
        }

        _setupSharedPlaybackNodes() {
            const ctx = this.audioCtx;
            this.playbackGainNode = ctx.createGain();
            this.playbackGainNode.gain.value = this.playbackVolume;
            this.playbackGainNode.channelCount = 2;
            this.playbackGainNode.channelCountMode = 'explicit';
            this.playbackGainNode.channelInterpretation = 'speakers';

            const splitter = ctx.createChannelSplitter(2);
            this.outAnalyserL = ctx.createAnalyser();
            this.outAnalyserR = ctx.createAnalyser();
            this.outAnalyserL.fftSize = 1024;
            this.outAnalyserR.fftSize = 1024;

            this.playbackGainNode.connect(ctx.destination);
            this.playbackGainNode.connect(splitter);
            splitter.connect(this.outAnalyserL, 0);
            splitter.connect(this.outAnalyserR, 1);
        }

        async listInputDevices() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
            try {
                const devs = await navigator.mediaDevices.enumerateDevices();
                return devs.filter(d => d.kind === 'audioinput');
            } catch (_) {
                return [];
            }
        }

        async connectDisplayAudio() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                const err = new Error('Browser Tab / System Audio capture is not supported in this browser.');
                err.code = 'UNSUPPORTED_DISPLAY_MEDIA';
                throw err;
            }

            this.disconnectSource();

            const primaryConstraints = {
                video: { width: { ideal: 64 }, height: { ideal: 64 }, frameRate: { ideal: 1 } },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 2,
                    sampleRate: 48000,
                    suppressLocalAudioPlayback: false
                },
                systemAudio: 'include',
                selfBrowserSurface: 'exclude'
            };

            let stream;
            try {
                stream = await navigator.mediaDevices.getDisplayMedia(primaryConstraints);
            } catch (err) {
                if (err && (err.name === 'TypeError' || err.name === 'OverconstrainedError')) {
                    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                } else {
                    throw err;
                }
            }

            const audioTracks = stream.getAudioTracks();
            if (!audioTracks || audioTracks.length === 0) {
                stream.getTracks().forEach(t => { try { t.stop(); } catch (_) { } });
                const noAudioErr = new Error('No audio track was shared. Re-select your tab or screen and make sure "Share tab audio" (or "Share system audio") is checked.');
                noAudioErr.code = 'NO_AUDIO_TRACK';
                throw noAudioErr;
            }

            // Keep video track disabled rather than stopped so Chromium never tears down system audio
            stream.getVideoTracks().forEach(vt => {
                try { vt.enabled = false; } catch (_) { }
            });

            const trackLabel = audioTracks[0].label || 'Browser Tab / System Audio';
            const settings = typeof audioTracks[0].getSettings === 'function' ? audioTracks[0].getSettings() : {};
            const preferredRate = settings.sampleRate || null;

            await this._attachMediaStream(stream, 'display', trackLabel, preferredRate);
            return { mode: 'display', label: trackLabel, sampleRate: this.audioCtx.sampleRate };
        }

        async connectMicAudio(deviceId = '') {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Microphone / Line-In capture is not supported in this browser.');
            }

            this.disconnectSource();

            const constraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 2
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const audioTracks = stream.getAudioTracks();
            const label = (audioTracks[0] && audioTracks[0].label) || 'Microphone / Line-In';
            const settings = audioTracks[0] && typeof audioTracks[0].getSettings === 'function' ? audioTracks[0].getSettings() : {};

            await this._attachMediaStream(stream, 'mic', label, settings.sampleRate || null);
            return { mode: 'mic', label, sampleRate: this.audioCtx.sampleRate };
        }

        async _attachMediaStream(stream, mode, label, preferredSampleRate) {
            const ctx = await this._ensureAudioContext(preferredSampleRate);
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }
            this.mediaStream = stream;
            this.sourceMode = mode;
            this.sourceLabel = label;

            const audioTracks = stream.getAudioTracks();
            const audioOnlyStream = audioTracks.length > 0 ? new MediaStream(audioTracks) : stream;
            this.streamSourceNode = ctx.createMediaStreamSource(audioOnlyStream);
            this.inputGainNode = ctx.createGain();
            this.inputGainNode.gain.value = this.inputGain;
            this.inputGainNode.channelCount = 2;
            this.inputGainNode.channelCountMode = 'explicit';
            this.inputGainNode.channelInterpretation = 'speakers';

            const splitter = ctx.createChannelSplitter(2);
            this.inAnalyserL = ctx.createAnalyser();
            this.inAnalyserR = ctx.createAnalyser();
            this.inAnalyserL.fftSize = 1024;
            this.inAnalyserR.fftSize = 1024;

            this.monitorGainNode = ctx.createGain();
            this.monitorGainNode.gain.value = this.monitorEnabled ? this.playbackVolume : 0;

            this.silentSinkNode = ctx.createGain();
            this.silentSinkNode.gain.value = 0;

            this.streamSourceNode.connect(this.inputGainNode);
            this.inputGainNode.connect(splitter);
            splitter.connect(this.inAnalyserL, 0);
            splitter.connect(this.inAnalyserR, 1);
            this.inputGainNode.connect(this.monitorGainNode);
            this.monitorGainNode.connect(ctx.destination);

            await this._setupCaptureProcessor(ctx);

            const handleEnded = () => {
                if (this.recordState === 'recording' || this.recordState === 'paused' || this.recordState === 'armed') {
                    this.stopRecording();
                }
                this.disconnectSource();
                this._emit('onSourceEnded', { mode, label });
            };

            stream.getAudioTracks().forEach(t => {
                t.onended = handleEnded;
            });
            stream.getVideoTracks().forEach(t => {
                t.onended = handleEnded;
            });

            this._emit('onSourceConnected', { mode, label, sampleRate: ctx.sampleRate });
        }

        async _setupCaptureProcessor(ctx) {
            // Try AudioWorklet first, fallback to ScriptProcessorNode if blocked/unsupported
            if (ctx.audioWorklet && typeof AudioWorkletNode === 'function') {
                try {
                    if (this._workletLoadedCtx !== ctx) {
                        const processorCode = `
                            class PcmCaptureProcessor extends AudioWorkletProcessor {
                                process(inputs) {
                                    const input = inputs[0];
                                    if (!input || input.length === 0) return true;
                                    const ch0 = input[0];
                                    if (!ch0 || ch0.length === 0) return true;
                                    const ch1 = input.length > 1 && input[1] && input[1].length === ch0.length ? input[1] : ch0;
                                    const leftCopy = new Float32Array(ch0);
                                    const rightCopy = new Float32Array(ch1);
                                    this.port.postMessage({ left: leftCopy, right: rightCopy }, [leftCopy.buffer, rightCopy.buffer]);
                                    return true;
                                }
                            }
                            registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
                        `;
                        if (this._workletBlobUrl) {
                            try { URL.revokeObjectURL(this._workletBlobUrl); } catch (_) { }
                        }
                        this._workletBlobUrl = URL.createObjectURL(new Blob([processorCode], { type: 'application/javascript' }));
                        await ctx.audioWorklet.addModule(this._workletBlobUrl);
                        this._workletLoadedCtx = ctx;
                    }

                    const workletNode = new AudioWorkletNode(ctx, 'pcm-capture-processor', {
                        numberOfInputs: 1,
                        numberOfOutputs: 1,
                        channelCount: 2,
                        channelCountMode: 'explicit'
                    });
                    workletNode.port.onmessage = (ev) => {
                        const data = ev.data;
                        if (data && data.left && data.right) {
                            this._handleIncomingFloatBlock(data.left, data.right);
                        }
                    };
                    this.inputGainNode.connect(workletNode);
                    workletNode.connect(this.silentSinkNode);
                    this.silentSinkNode.connect(ctx.destination);
                    this.captureNode = workletNode;
                    this.captureMode = 'worklet';
                    return;
                } catch (err) {
                    console.warn('[StudioAudioEngine] AudioWorklet fallback to ScriptProcessor:', err);
                }
            }

            const scriptNode = ctx.createScriptProcessor(4096, 2, 2);
            scriptNode.onaudioprocess = (ev) => {
                const input = ev.inputBuffer;
                if (!input || input.numberOfChannels === 0) return;
                const ch0 = input.getChannelData(0);
                const ch1 = input.numberOfChannels > 1 ? input.getChannelData(1) : ch0;
                this._handleIncomingFloatBlock(ch0, ch1);
            };
            this.inputGainNode.connect(scriptNode);
            scriptNode.connect(this.silentSinkNode);
            this.silentSinkNode.connect(ctx.destination);
            this.captureNode = scriptNode;
            this.captureMode = 'script';
        }

        disconnectSource() {
            try { if (this.captureNode) this.captureNode.disconnect(); } catch (_) { }
            try { if (this.streamSourceNode) this.streamSourceNode.disconnect(); } catch (_) { }
            try { if (this.inputGainNode) this.inputGainNode.disconnect(); } catch (_) { }
            try { if (this.monitorGainNode) this.monitorGainNode.disconnect(); } catch (_) { }
            try { if (this.silentSinkNode) this.silentSinkNode.disconnect(); } catch (_) { }

            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(t => {
                    try { t.onended = null; t.stop(); } catch (_) { }
                });
            }

            this.captureNode = null;
            this.streamSourceNode = null;
            this.inputGainNode = null;
            this.monitorGainNode = null;
            this.silentSinkNode = null;
            this.inAnalyserL = null;
            this.inAnalyserR = null;
            this.mediaStream = null;
            this.sourceMode = null;
            this.sourceLabel = '';
            this._emit('onSourceDisconnected', {});
        }

        setInputGain(gain) {
            this.inputGain = Math.max(0, Math.min(2.5, Number(gain) || 0));
            if (this.inputGainNode && this.audioCtx) {
                this.inputGainNode.gain.setValueAtTime(this.inputGain, this.audioCtx.currentTime);
            }
        }

        setPlaybackVolume(vol) {
            this.playbackVolume = Math.max(0, Math.min(1.5, Number(vol) || 0));
            if (this.playbackGainNode && this.audioCtx) {
                this.playbackGainNode.gain.setValueAtTime(this.playbackVolume, this.audioCtx.currentTime);
            }
            if (this.monitorGainNode && this.audioCtx && this.monitorEnabled) {
                this.monitorGainNode.gain.setValueAtTime(this.playbackVolume, this.audioCtx.currentTime);
            }
        }

        setMonitorEnabled(enabled) {
            this.monitorEnabled = Boolean(enabled);
            if (this.monitorGainNode && this.audioCtx) {
                this.monitorGainNode.gain.setValueAtTime(this.monitorEnabled ? this.playbackVolume : 0, this.audioCtx.currentTime);
            }
        }

        updateSettings(partial = {}) {
            this.settings = Object.assign({}, this.settings, partial);
        }

        isSourceConnected() {
            return Boolean(this.mediaStream && this.mediaStream.getAudioTracks().some(t => t.readyState === 'live'));
        }

        startRecording(appendToExisting = false) {
            if (!this.isSourceConnected()) {
                throw new Error('Connect a Browser Tab/System Audio or Microphone source before recording.');
            }
            if (this.recordState === 'recording' || this.recordState === 'armed') return;
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                try { this.audioCtx.resume(); } catch (_) { }
            }

            this.stopPlayback();
            this._pushUndo();

            const ctxRate = this.audioCtx ? this.audioCtx.sampleRate : 44100;

            if (!appendToExisting || this.length === 0) {
                this.sampleRate = ctxRate;
                this._initRecordingCapacity(Math.max(INITIAL_CAPACITY_SAMPLES, ctxRate * 120));
                this.length = 0;
                this.tracks = [];
                this._nextTrackUid = 1;
                this.selection = null;
                this.cursorSample = 0;
                this._resetPeaks();
            } else {
                // Ensure sampleRate matches; if session has existing audio, allocate capacity from it
                this._ensureRecordingCapacityFromExisting();
            }

            this._preRollBuffer = [];
            this._preRollSamples = 0;
            this._armedSpeechSamples = 0;

            this._liveState = {
                currentTrackStartSample: this.length,
                inSilence: false,
                silenceStartSample: 0,
                waitingForNextTrackStart: false,
                frameAccumLeft: [],
                frameAccumRight: [],
                frameAccumLen: 0,
                frameSize: Math.max(256, Math.round(this.sampleRate * 0.05))
            };

            this.recordState = this.settings.soundActivated ? 'armed' : 'recording';
            this._emit('onRecordStateChanged', { state: this.recordState });
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
        }

        pauseRecording() {
            if (this.recordState === 'recording') {
                this.recordState = 'paused';
                this._emit('onRecordStateChanged', { state: this.recordState });
            }
        }

        resumeRecording() {
            if (this.recordState === 'paused') {
                this.recordState = 'recording';
                this._emit('onRecordStateChanged', { state: this.recordState });
            }
        }

        stopRecording() {
            if (this.recordState === 'idle') return;

            const wasArmedOnly = this.recordState === 'armed' && this.length === 0;
            this.recordState = 'idle';

            // Trim capacity tightly to recorded length
            this.left = this._recLeftCap.slice(0, this.length);
            this.right = this._recRightCap.slice(0, this.length);
            this._recLeftCap = new Int16Array(0);
            this._recRightCap = new Int16Array(0);

            // Finalize trailing track region if there is recorded audio since currentTrackStartSample
            const createdOnStop = [];
            if (!wasArmedOnly && this.length > 0 && this._liveState && !this._liveState.waitingForNextTrackStart) {
                let startS = Math.max(0, Math.min(this.length, this._liveState.currentTrackStartSample));
                let endS = this.length;
                const pad = Math.round(this.sampleRate * 0.12);
                if (this._liveState.inSilence && this._liveState.silenceStartSample > startS) {
                    endS = Math.min(this.length, this._liveState.silenceStartSample + pad);
                }
                if (this.settings.autoTrimSilence && endS - startS > Math.round(this.sampleRate * 0.5)) {
                    const frameSize = Math.max(256, Math.round(this.sampleRate * 0.05));
                    const dbLimit = Number(this.settings.thresholdDb ?? -42);
                    let firstSound = -1;
                    let lastSound = -1;
                    for (let pos = startS; pos < endS; pos += frameSize) {
                        const fEnd = Math.min(endS, pos + frameSize);
                        if (computeStereoFrameDb(this.left, this.right, pos, fEnd) >= dbLimit) {
                            if (firstSound === -1) firstSound = pos;
                            lastSound = fEnd;
                        }
                    }
                    if (firstSound !== -1 && lastSound > firstSound) {
                        const trimmedStart = Math.max(startS, firstSound - pad);
                        const trimmedEnd = Math.min(endS, lastSound + pad);
                        if (trimmedEnd - trimmedStart > Math.round(this.sampleRate * 0.5)) {
                            startS = trimmedStart;
                            endS = trimmedEnd;
                        }
                    }
                }
                if (endS - startS > Math.round(this.sampleRate * 0.5)) {
                    const track = this._createTrackObject(this.tracks.length, startS, endS);
                    this.tracks.push(track);
                    createdOnStop.push(track);
                    this._emit('onTrackAutoSplit', track);
                }
            }

            if (this.length > 0 && this.tracks.length === 0) {
                const track = this._createTrackObject(0, 0, this.length);
                this.tracks.push(track);
                createdOnStop.push(track);
            }

            this._liveState = null;
            this._preRollBuffer = [];
            this._preRollSamples = 0;

            this._rebuildPeakCache();
            this.cursorSample = 0;

            this._emit('onRecordStateChanged', { state: 'idle' });
            this._emit('onTracksChanged', this.tracks);
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
            if (createdOnStop.length > 0) {
                this._emit('onTracksCreated', { tracks: createdOnStop, reason: 'record-stop' });
            }
        }

        _initRecordingCapacity(cap) {
            this._recLeftCap = new Int16Array(cap);
            this._recRightCap = new Int16Array(cap);
            this.left = this._recLeftCap;
            this.right = this._recRightCap;
        }

        _ensureRecordingCapacityFromExisting() {
            const needed = Math.max(this.length + INITIAL_CAPACITY_SAMPLES, this.length * 2);
            const newL = new Int16Array(needed);
            const newR = new Int16Array(needed);
            newL.set(this.left.subarray(0, this.length));
            newR.set(this.right.subarray(0, this.length));
            this._recLeftCap = newL;
            this._recRightCap = newR;
            this.left = newL;
            this.right = newR;
        }

        _growRecordingCapacity(extraSamples) {
            const needed = this.length + extraSamples;
            if (needed <= this._recLeftCap.length) return;
            const newCap = Math.max(needed, this._recLeftCap.length * 2, this.sampleRate * 120);
            const newL = new Int16Array(newCap);
            const newR = new Int16Array(newCap);
            newL.set(this._recLeftCap.subarray(0, this.length));
            newR.set(this._recRightCap.subarray(0, this.length));
            this._recLeftCap = newL;
            this._recRightCap = newR;
            this.left = newL;
            this.right = newR;
        }

        _resetPeaks() {
            this._peakCap = 2048;
            this.peaksMinL = new Int16Array(this._peakCap);
            this.peaksMaxL = new Int16Array(this._peakCap);
            this.peaksMinR = new Int16Array(this._peakCap);
            this.peaksMaxR = new Int16Array(this._peakCap);
            this.peakCount = 0;
        }

        _appendSamplesToBuffer(leftF32, rightF32) {
            const n = leftF32.length;
            this._growRecordingCapacity(n);
            const start = this.length;
            const L = this._recLeftCap;
            const R = this._recRightCap;
            for (let i = 0; i < n; i++) {
                L[start + i] = floatToInt16Sample(leftF32[i]);
                R[start + i] = floatToInt16Sample(rightF32[i]);
            }
            this.length += n;
            this._updatePeaksIncremental(start, this.length);
            this._processLiveSplitSamples(start, this.length);
        }

        _appendInt16BlockToBuffer(leftI16, rightI16) {
            const n = leftI16.length;
            this._growRecordingCapacity(n);
            const start = this.length;
            this._recLeftCap.set(leftI16, start);
            this._recRightCap.set(rightI16, start);
            this.length += n;
            this._updatePeaksIncremental(start, this.length);
            this._processLiveSplitSamples(start, this.length);
        }

        _updatePeaksIncremental(fromSample, toSample) {
            const bucketSize = this.peakBucketSize;
            const startBucket = Math.floor(fromSample / bucketSize);
            const endBucket = Math.floor(Math.max(0, toSample - 1) / bucketSize);
            if (endBucket + 1 > this._peakCap) {
                const nextCap = Math.max(endBucket + 1024, this._peakCap * 2);
                const nMinL = new Int16Array(nextCap);
                const nMaxL = new Int16Array(nextCap);
                const nMinR = new Int16Array(nextCap);
                const nMaxR = new Int16Array(nextCap);
                nMinL.set(this.peaksMinL.subarray(0, this.peakCount));
                nMaxL.set(this.peaksMaxL.subarray(0, this.peakCount));
                nMinR.set(this.peaksMinR.subarray(0, this.peakCount));
                nMaxR.set(this.peaksMaxR.subarray(0, this.peakCount));
                this.peaksMinL = nMinL;
                this.peaksMaxL = nMaxL;
                this.peaksMinR = nMinR;
                this.peaksMaxR = nMaxR;
                this._peakCap = nextCap;
            }
            for (let b = startBucket; b <= endBucket; b++) {
                const s0 = b * bucketSize;
                const s1 = Math.min(this.length, s0 + bucketSize);
                let minL = 32767, maxL = -32768, minR = 32767, maxR = -32768;
                for (let i = s0; i < s1; i++) {
                    const lv = this.left[i];
                    const rv = this.right[i];
                    if (lv < minL) minL = lv;
                    if (lv > maxL) maxL = lv;
                    if (rv < minR) minR = rv;
                    if (rv > maxR) maxR = rv;
                }
                this.peaksMinL[b] = minL;
                this.peaksMaxL[b] = maxL;
                this.peaksMinR[b] = minR;
                this.peaksMaxR[b] = maxR;
            }
            this.peakCount = Math.max(this.peakCount, endBucket + 1);
        }

        _rebuildPeakCache() {
            const bucketSize = this.peakBucketSize;
            const buckets = this.length > 0 ? Math.ceil(this.length / bucketSize) : 0;
            this.peaksMinL = new Int16Array(buckets);
            this.peaksMaxL = new Int16Array(buckets);
            this.peaksMinR = new Int16Array(buckets);
            this.peaksMaxR = new Int16Array(buckets);
            this._peakCap = buckets;
            this.peakCount = buckets;

            for (let b = 0; b < buckets; b++) {
                const s0 = b * bucketSize;
                const s1 = Math.min(this.length, s0 + bucketSize);
                let minL = 32767, maxL = -32768, minR = 32767, maxR = -32768;
                for (let i = s0; i < s1; i++) {
                    const lv = this.left[i];
                    const rv = this.right[i];
                    if (lv < minL) minL = lv;
                    if (lv > maxL) maxL = lv;
                    if (rv < minR) minR = rv;
                    if (rv > maxR) maxR = rv;
                }
                this.peaksMinL[b] = minL;
                this.peaksMaxL[b] = maxL;
                this.peaksMinR[b] = minR;
                this.peaksMaxR[b] = maxR;
            }
        }

        _pushPreRoll(leftF32, rightF32) {
            const maxPreRollSamples = Math.round(this.sampleRate * 0.28);
            const li = new Int16Array(leftF32.length);
            const ri = new Int16Array(rightF32.length);
            for (let i = 0; i < leftF32.length; i++) {
                li[i] = floatToInt16Sample(leftF32[i]);
                ri[i] = floatToInt16Sample(rightF32[i]);
            }
            this._preRollBuffer.push({ left: li, right: ri });
            this._preRollSamples += li.length;
            while (this._preRollSamples > maxPreRollSamples && this._preRollBuffer.length > 1) {
                const dropped = this._preRollBuffer.shift();
                this._preRollSamples -= dropped.left.length;
            }
        }

        _handleIncomingFloatBlock(leftF32, rightF32) {
            if (this.recordState === 'idle' || this.recordState === 'paused') return;

            if (this.recordState === 'armed') {
                this._pushPreRoll(leftF32, rightF32);
                let sumSq = 0;
                for (let i = 0; i < leftF32.length; i++) {
                    const l = leftF32[i];
                    const r = rightF32[i];
                    sumSq += 0.5 * (l * l + r * r);
                }
                const rms = Math.sqrt(sumSq / Math.max(1, leftF32.length));
                const db = 20 * Math.log10(Math.max(rms, 1e-7));
                if (db >= this.settings.thresholdDb) {
                    this._armedSpeechSamples += leftF32.length;
                    if (this._armedSpeechSamples >= Math.round(this.sampleRate * 0.15)) {
                        this.recordState = 'recording';
                        this._emit('onRecordStateChanged', { state: 'recording' });
                        // Flush pre-roll into buffer so initial transient isn't lost
                        for (const blk of this._preRollBuffer) {
                            this._appendInt16BlockToBuffer(blk.left, blk.right);
                        }
                        this._preRollBuffer = [];
                        this._preRollSamples = 0;
                    }
                } else {
                    this._armedSpeechSamples = 0;
                }
                return;
            }

            if (this.recordState === 'recording') {
                this._appendSamplesToBuffer(leftF32, rightF32);
                this.cursorSample = this.length;
            }
        }

        _processLiveSplitSamples(fromSample, toSample) {
            if (!this._liveState || !this.settings.liveAutoSplit) return;

            const ls = this._liveState;
            const frameLen = ls.frameSize;
            const thresholdDb = this.settings.thresholdDb;
            const minSilenceSamples = Math.round(this.settings.minSilenceSec * this.sampleRate);
            const minTrackSamples = Math.round(this.settings.minTrackSec * this.sampleRate);
            const padSamples = Math.round(this.sampleRate * 0.12);

            let pos = fromSample;
            while (pos < toSample) {
                const chunkEnd = Math.min(toSample, pos + frameLen);
                const db = computeStereoFrameDb(this.left, this.right, pos, chunkEnd);
                const isSilent = db < thresholdDb;

                if (ls.waitingForNextTrackStart) {
                    if (!isSilent) {
                        ls.waitingForNextTrackStart = false;
                        ls.inSilence = false;
                        ls.currentTrackStartSample = Math.max(0, pos - padSamples);
                    }
                } else {
                    if (isSilent) {
                        if (!ls.inSilence) {
                            ls.inSilence = true;
                            ls.silenceStartSample = pos;
                        } else {
                            const silenceDur = chunkEnd - ls.silenceStartSample;
                            const trackDur = ls.silenceStartSample - ls.currentTrackStartSample;
                            if (silenceDur >= minSilenceSamples && trackDur >= minTrackSamples) {
                                const trackEnd = Math.min(this.length, ls.silenceStartSample + padSamples);
                                const track = this._createTrackObject(this.tracks.length, ls.currentTrackStartSample, trackEnd);
                                this.tracks.push(track);
                                ls.waitingForNextTrackStart = true;
                                ls.inSilence = false;
                                this._emit('onTrackAutoSplit', track);
                                this._emit('onTracksChanged', this.tracks);
                                this._emit('onTracksCreated', { tracks: [track], reason: 'live-split' });
                            }
                        }
                    } else {
                        ls.inSilence = false;
                    }
                }
                pos = chunkEnd;
            }
        }

        _createTrackObject(index, startSample, endSample, prevMeta = null) {
            const num = index + 1;
            return {
                id: `trk_${this._nextTrackUid++}`,
                index,
                title: (prevMeta && prevMeta.title) || `Track ${String(num).padStart(2, '0')}`,
                artist: (prevMeta && prevMeta.artist) || '',
                album: (prevMeta && prevMeta.album) || '',
                year: (prevMeta && prevMeta.year) || '',
                genre: (prevMeta && prevMeta.genre) || '',
                coverBytes: (prevMeta && prevMeta.coverBytes) || null,
                coverMime: (prevMeta && prevMeta.coverMime) || 'image/jpeg',
                tagSource: (prevMeta && prevMeta.tagSource) || 'none',
                hasId3Title: Boolean(prevMeta && prevMeta.hasId3Title),
                hasId3Artist: Boolean(prevMeta && prevMeta.hasId3Artist),
                autoTagStatus: (prevMeta && prevMeta.autoTagStatus) || '',
                autoTagAttempted: Boolean(prevMeta && prevMeta.autoTagAttempted),
                identifying: false,
                identified: Boolean(prevMeta && prevMeta.identified),
                userEditedTitle: Boolean(prevMeta && prevMeta.userEditedTitle),
                userEditedArtist: Boolean(prevMeta && prevMeta.userEditedArtist),
                startSample: Math.max(0, Math.floor(startSample)),
                endSample: Math.max(0, Math.floor(endSample)),
                saved: false,
                saving: false
            };
        }

        addManualSplitMarker(samplePos = null) {
            if (this.length === 0) return null;
            const splitAt = Math.max(1, Math.min(this.length - 1, Math.floor(samplePos === null ? this.cursorSample : samplePos)));

            if (this.recordState === 'recording' && this._liveState) {
                const startS = this._liveState.currentTrackStartSample;
                if (splitAt - startS >= Math.round(this.sampleRate * 0.5)) {
                    const track = this._createTrackObject(this.tracks.length, startS, splitAt);
                    this.tracks.push(track);
                    this._liveState.currentTrackStartSample = splitAt;
                    this._liveState.waitingForNextTrackStart = false;
                    this._liveState.inSilence = false;
                    this._emit('onTrackAutoSplit', track);
                    this._emit('onTracksChanged', this.tracks);
                    this._emit('onTracksCreated', { tracks: [track], reason: 'manual-split-live' });
                    return track;
                }
                return null;
            }

            this._pushUndo();
            if (this.tracks.length === 0) {
                const t0 = this._createTrackObject(0, 0, splitAt);
                const t1 = this._createTrackObject(1, splitAt, this.length);
                this.tracks.push(t0, t1);
                this._emit('onTracksChanged', this.tracks);
                this._emit('onTracksCreated', { tracks: [t0, t1], reason: 'manual-split' });
                return t1;
            }

            // Find the track containing splitAt and split it into two
            const idx = this.tracks.findIndex(t => splitAt > t.startSample + 200 && splitAt < t.endSample - 200);
            if (idx === -1) return null;

            const orig = this.tracks[idx];
            const preserveFirst = Boolean(orig.userEditedTitle || orig.userEditedArtist);
            const first = this._createTrackObject(idx, orig.startSample, splitAt, preserveFirst ? {
                title: orig.title,
                artist: orig.artist,
                album: orig.album,
                year: orig.year,
                genre: orig.genre,
                coverBytes: orig.coverBytes,
                coverMime: orig.coverMime,
                tagSource: orig.tagSource,
                userEditedTitle: orig.userEditedTitle,
                userEditedArtist: orig.userEditedArtist
            } : null);
            const second = this._createTrackObject(idx + 1, splitAt, orig.endSample);
            this.tracks.splice(idx, 1, first, second);
            this._reindexTracks();
            this._emit('onTracksChanged', this.tracks);
            this._emit('onTracksCreated', { tracks: preserveFirst ? [second] : [first, second], reason: 'manual-split' });
            return second;
        }

        scanAndAutoSplit(options = {}) {
            if (this.length === 0) return [];
            const opts = Object.assign({}, this.settings, options);
            const thresholdDb = Number(opts.thresholdDb ?? -42);
            const minSilenceSec = Math.max(0.2, Number(opts.minSilenceSec ?? 1.5));
            const minTrackSec = Math.max(0.5, Number(opts.minTrackSec ?? 10));
            const autoTrimSilence = opts.autoTrimSilence !== false;

            const frameSize = Math.max(256, Math.round(this.sampleRate * 0.05));
            const minSilenceSamples = Math.round(minSilenceSec * this.sampleRate);
            const minTrackSamples = Math.round(minTrackSec * this.sampleRate);
            const padSamples = Math.round(this.sampleRate * 0.12);

            const prevTracks = this.tracks.slice();
            const detected = [];

            let trackStart = null;
            let inSilence = false;
            let silenceStart = 0;

            for (let pos = 0; pos < this.length; pos += frameSize) {
                const end = Math.min(this.length, pos + frameSize);
                const db = computeStereoFrameDb(this.left, this.right, pos, end);
                const isSilent = db < thresholdDb;

                if (trackStart === null) {
                    if (!isSilent || !autoTrimSilence) {
                        trackStart = Math.max(0, pos - padSamples);
                        inSilence = false;
                    }
                } else {
                    if (isSilent) {
                        if (!inSilence) {
                            inSilence = true;
                            silenceStart = pos;
                        } else {
                            const silenceDur = end - silenceStart;
                            const trackDur = silenceStart - trackStart;
                            if (silenceDur >= minSilenceSamples && trackDur >= minTrackSamples) {
                                const trackEnd = autoTrimSilence
                                    ? Math.min(this.length, silenceStart + padSamples)
                                    : Math.min(this.length, Math.round((silenceStart + end) / 2));
                                detected.push({ startSample: trackStart, endSample: Math.max(trackStart + 1, trackEnd) });
                                trackStart = autoTrimSilence ? null : trackEnd;
                                inSilence = false;
                            }
                        }
                    } else {
                        inSilence = false;
                    }
                }
            }

            if (trackStart !== null) {
                let tailEnd = this.length;
                if (autoTrimSilence && inSilence && silenceStart > trackStart) {
                    tailEnd = Math.min(this.length, silenceStart + padSamples);
                }
                if (tailEnd - trackStart >= Math.round(this.sampleRate * 0.4)) {
                    detected.push({ startSample: trackStart, endSample: tailEnd });
                }
            }

            if (detected.length === 0) {
                detected.push({ startSample: 0, endSample: this.length });
            }

            this._pushUndo();
            const matchTol = Math.round(this.sampleRate * 1.0);
            const usedPrev = new Set();
            const createdTracks = [];
            this.tracks = detected.map((seg, idx) => {
                const matchingPrev = prevTracks.find((pt, pIdx) =>
                    !usedPrev.has(pIdx) &&
                    Math.abs(pt.startSample - seg.startSample) <= matchTol &&
                    Math.abs(pt.endSample - seg.endSample) <= matchTol
                );
                if (matchingPrev) {
                    usedPrev.add(prevTracks.indexOf(matchingPrev));
                    return this._createTrackObject(idx, seg.startSample, seg.endSample, matchingPrev);
                }
                const fresh = this._createTrackObject(idx, seg.startSample, seg.endSample, null);
                createdTracks.push(fresh);
                return fresh;
            });
            this._emit('onTracksChanged', this.tracks);
            if (createdTracks.length > 0) {
                this._emit('onTracksCreated', { tracks: createdTracks, reason: 'auto-split' });
            }
            return this.tracks;
        }

        mergeTrackWithPrevious(trackId) {
            const idx = this.tracks.findIndex(t => t.id === trackId);
            if (idx <= 0) return false;
            this._pushUndo();
            const prev = this.tracks[idx - 1];
            const curr = this.tracks[idx];
            prev.endSample = curr.endSample;
            prev.saved = false;
            if (!prev.userEditedTitle && !prev.userEditedArtist) {
                prev.identified = false;
                prev.autoTagAttempted = false;
                prev.autoTagStatus = '';
            }
            this.tracks.splice(idx, 1);
            this._reindexTracks();
            this._emit('onTracksChanged', this.tracks);
            if (!prev.userEditedTitle && !prev.userEditedArtist) {
                this._emit('onTracksCreated', { tracks: [prev], reason: 'merge' });
            }
            return true;
        }

        deleteTrackRegion(trackId) {
            const idx = this.tracks.findIndex(t => t.id === trackId);
            if (idx === -1) return false;
            this._pushUndo();
            this.tracks.splice(idx, 1);
            this._reindexTracks();
            this._emit('onTracksChanged', this.tracks);
            return true;
        }

        updateTrackBounds(trackId, startSample, endSample) {
            const t = this.tracks.find(item => item.id === trackId);
            if (!t) return false;
            const s = Math.max(0, Math.min(this.length - 1, Math.floor(startSample)));
            const e = Math.max(s + 1, Math.min(this.length, Math.floor(endSample)));
            t.startSample = s;
            t.endSample = e;
            t.saved = false;
            this._emit('onTracksChanged', this.tracks);
            return true;
        }

        updateTrackMeta(trackId, patch = {}) {
            const t = this.tracks.find(item => item.id === trackId);
            if (!t) return false;
            Object.assign(t, patch);
            return true;
        }

        _reindexTracks() {
            this.tracks.forEach((t, i) => { t.index = i; });
        }

        // --- Undo / Redo ---
        _captureSnapshot() {
            return {
                sampleRate: this.sampleRate,
                length: this.length,
                left: this.left.slice(0, this.length),
                right: this.right.slice(0, this.length),
                tracks: this.tracks.map(t => Object.assign({}, t)),
                selection: this.selection ? Object.assign({}, this.selection) : null,
                cursorSample: this.cursorSample
            };
        }

        _restoreSnapshot(snap) {
            this.sampleRate = snap.sampleRate;
            this.length = snap.length;
            this.left = snap.left.slice();
            this.right = snap.right.slice();
            this.tracks = snap.tracks.map(t => Object.assign({}, t));
            this.selection = snap.selection ? Object.assign({}, snap.selection) : null;
            this.cursorSample = Math.min(this.length, snap.cursorSample || 0);
            this._rebuildPeakCache();
            this._emit('onTracksChanged', this.tracks);
            this._emit('onSelectionChanged', this.selection);
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
        }

        _pushUndo() {
            this.undoStack.push(this._captureSnapshot());
            if (this.undoStack.length > MAX_UNDO_STATES) {
                this.undoStack.shift();
            }
            this.redoStack = [];
            this._emit('onHistoryChanged', { canUndo: this.undoStack.length > 0, canRedo: false });
        }

        canUndo() { return this.undoStack.length > 0 && this.recordState === 'idle'; }
        canRedo() { return this.redoStack.length > 0 && this.recordState === 'idle'; }

        undo() {
            if (!this.canUndo()) return false;
            this.stopPlayback();
            this.redoStack.push(this._captureSnapshot());
            const prev = this.undoStack.pop();
            this._restoreSnapshot(prev);
            this._emit('onHistoryChanged', { canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 });
            return true;
        }

        redo() {
            if (!this.canRedo()) return false;
            this.stopPlayback();
            this.undoStack.push(this._captureSnapshot());
            const next = this.redoStack.pop();
            this._restoreSnapshot(next);
            this._emit('onHistoryChanged', { canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 });
            return true;
        }

        // --- Selection & DSP Editing ---
        setSelection(startSample, endSample) {
            if (startSample === null || endSample === null || this.length === 0) {
                this.selection = null;
            } else {
                const a = Math.max(0, Math.min(this.length, Math.floor(Math.min(startSample, endSample))));
                const b = Math.max(0, Math.min(this.length, Math.floor(Math.max(startSample, endSample))));
                this.selection = (b - a >= 1) ? { startSample: a, endSample: b } : null;
            }
            this._emit('onSelectionChanged', this.selection);
        }

        _resolveEditRange(startSample, endSample, defaultTailOnly = false) {
            if (this.length === 0) return null;
            if (startSample !== undefined && startSample !== null && endSample !== undefined && endSample !== null) {
                const a = Math.max(0, Math.min(this.length, Math.floor(Math.min(startSample, endSample))));
                const b = Math.max(0, Math.min(this.length, Math.floor(Math.max(startSample, endSample))));
                return b > a ? { start: a, end: b } : null;
            }
            if (this.selection && this.selection.endSample > this.selection.startSample) {
                return { start: this.selection.startSample, end: this.selection.endSample };
            }
            if (defaultTailOnly === 'head') {
                return { start: 0, end: Math.min(this.length, Math.round(this.sampleRate * 2)) };
            }
            if (defaultTailOnly === 'tail') {
                return { start: Math.max(0, this.length - Math.round(this.sampleRate * 2)), end: this.length };
            }
            return { start: 0, end: this.length };
        }

        trimToSelection(startSample = null, endSample = null) {
            if (this.length === 0 || this.recordState !== 'idle') return false;
            const range = this._resolveEditRange(startSample, endSample);
            if (!range || (range.start === 0 && range.end === this.length)) return false;
            this.stopPlayback();
            this._pushUndo();

            this.left = this.left.slice(range.start, range.end);
            this.right = this.right.slice(range.start, range.end);
            this.length = this.left.length;

            const updated = [];
            for (const t of this.tracks) {
                const ns = Math.max(0, t.startSample - range.start);
                const ne = Math.min(this.length, t.endSample - range.start);
                if (ne > ns) {
                    t.startSample = ns;
                    t.endSample = ne;
                    t.saved = false;
                    updated.push(t);
                }
            }
            const createdFallback = updated.length === 0 ? this._createTrackObject(0, 0, this.length) : null;
            this.tracks = updated.length ? updated : [createdFallback];
            this._reindexTracks();
            this.selection = null;
            this.cursorSample = 0;

            this._rebuildPeakCache();
            this._emit('onTracksChanged', this.tracks);
            this._emit('onSelectionChanged', null);
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
            if (createdFallback) {
                this._emit('onTracksCreated', { tracks: [createdFallback], reason: 'trim' });
            }
            return true;
        }

        deleteSelection(startSample = null, endSample = null) {
            if (this.length === 0 || this.recordState !== 'idle') return false;
            const range = this._resolveEditRange(startSample, endSample);
            if (!range || (range.start === 0 && range.end === this.length)) return false;
            this.stopPlayback();
            this._pushUndo();

            const cutLen = range.end - range.start;
            const newLen = this.length - cutLen;
            const newL = new Int16Array(newLen);
            const newR = new Int16Array(newLen);
            newL.set(this.left.subarray(0, range.start), 0);
            newL.set(this.left.subarray(range.end, this.length), range.start);
            newR.set(this.right.subarray(0, range.start), 0);
            newR.set(this.right.subarray(range.end, this.length), range.start);

            this.left = newL;
            this.right = newR;
            this.length = newLen;

            const updated = [];
            for (const t of this.tracks) {
                if (t.endSample <= range.start) {
                    updated.push(t);
                } else if (t.startSample >= range.end) {
                    t.startSample -= cutLen;
                    t.endSample -= cutLen;
                    t.saved = false;
                    updated.push(t);
                } else {
                    const beforeLen = Math.max(0, range.start - t.startSample);
                    const afterLen = Math.max(0, t.endSample - range.end);
                    const newStart = Math.min(t.startSample, range.start);
                    const newEnd = newStart + beforeLen + afterLen;
                    if (newEnd > newStart) {
                        t.startSample = newStart;
                        t.endSample = newEnd;
                        t.saved = false;
                        updated.push(t);
                    }
                }
            }
            const createdFallback = (updated.length === 0 && newLen > 0) ? this._createTrackObject(0, 0, newLen) : null;
            this.tracks = updated.length ? updated : (createdFallback ? [createdFallback] : []);
            this._reindexTracks();
            this.selection = null;
            this.cursorSample = Math.min(range.start, newLen);

            this._rebuildPeakCache();
            this._emit('onTracksChanged', this.tracks);
            this._emit('onSelectionChanged', null);
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
            if (createdFallback) {
                this._emit('onTracksCreated', { tracks: [createdFallback], reason: 'delete' });
            }
            return true;
        }

        silenceSelection(startSample = null, endSample = null) {
            if (this.length === 0 || this.recordState !== 'idle') return false;
            const range = this._resolveEditRange(startSample, endSample);
            if (!range) return false;
            this._pushUndo();
            this.left.fill(0, range.start, range.end);
            this.right.fill(0, range.start, range.end);
            this._rebuildPeakCache();
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
            return true;
        }

        fadeIn(startSample = null, endSample = null) {
            if (this.length === 0 || this.recordState !== 'idle') return false;
            const range = this._resolveEditRange(startSample, endSample, 'head');
            if (!range) return false;
            this._pushUndo();
            const span = Math.max(1, range.end - range.start);
            for (let i = range.start; i < range.end; i++) {
                const gain = (i - range.start) / span;
                this.left[i] = Math.round(this.left[i] * gain);
                this.right[i] = Math.round(this.right[i] * gain);
            }
            this._rebuildPeakCache();
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
            return true;
        }

        fadeOut(startSample = null, endSample = null) {
            if (this.length === 0 || this.recordState !== 'idle') return false;
            const range = this._resolveEditRange(startSample, endSample, 'tail');
            if (!range) return false;
            this._pushUndo();
            const span = Math.max(1, range.end - range.start);
            for (let i = range.start; i < range.end; i++) {
                const gain = 1 - ((i - range.start) / span);
                this.left[i] = Math.round(this.left[i] * gain);
                this.right[i] = Math.round(this.right[i] * gain);
            }
            this._rebuildPeakCache();
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
            return true;
        }

        normalize(startSample = null, endSample = null, targetDb = -1.0) {
            if (this.length === 0 || this.recordState !== 'idle') return false;
            const range = this._resolveEditRange(startSample, endSample);
            if (!range) return false;
            let peak = 0;
            for (let i = range.start; i < range.end; i++) {
                const al = Math.abs(this.left[i]);
                const ar = Math.abs(this.right[i]);
                if (al > peak) peak = al;
                if (ar > peak) peak = ar;
            }
            if (peak === 0) return false;

            const targetAmp = Math.pow(10, targetDb / 20) * 32767;
            const factor = targetAmp / peak;
            this._pushUndo();
            for (let i = range.start; i < range.end; i++) {
                const nl = Math.round(this.left[i] * factor);
                const nr = Math.round(this.right[i] * factor);
                this.left[i] = Math.max(-32768, Math.min(32767, nl));
                this.right[i] = Math.max(-32768, Math.min(32767, nr));
            }
            this._rebuildPeakCache();
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
            return true;
        }

        trimLeadingTrailingSilence(thresholdDb = null) {
            if (this.length === 0 || this.recordState !== 'idle') return false;
            const dbLimit = Number(thresholdDb !== null ? thresholdDb : this.settings.thresholdDb);
            const frameSize = Math.max(256, Math.round(this.sampleRate * 0.05));
            const pad = Math.round(this.sampleRate * 0.1);

            let firstSound = -1;
            let lastSound = -1;
            for (let pos = 0; pos < this.length; pos += frameSize) {
                const end = Math.min(this.length, pos + frameSize);
                if (computeStereoFrameDb(this.left, this.right, pos, end) >= dbLimit) {
                    if (firstSound === -1) firstSound = pos;
                    lastSound = end;
                }
            }
            if (firstSound === -1) return false;
            const trimStart = Math.max(0, firstSound - pad);
            const trimEnd = Math.min(this.length, lastSound + pad);
            if (trimStart === 0 && trimEnd === this.length) return false;
            return this.trimToSelection(trimStart, trimEnd);
        }

        // --- File Import & Synthetic Testing ---
        async importAudioFile(file) {
            if (!file) throw new Error('No file selected');
            this.stopPlayback();
            if (this.recordState !== 'idle') this.stopRecording();

            const ctx = await this._ensureAudioContext();
            const arrayBuf = await file.arrayBuffer();
            let id3Tags = {};
            try {
                if (global.StudioIdentifyEngine && typeof global.StudioIdentifyEngine.readLocalAudioTags === 'function') {
                    id3Tags = global.StudioIdentifyEngine.readLocalAudioTags(arrayBuf) || {};
                }
            } catch (_) {
                id3Tags = {};
            }
            const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));

            const len = decoded.length;
            const ch0 = decoded.getChannelData(0);
            const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : ch0;

            const leftI16 = new Int16Array(len);
            const rightI16 = new Int16Array(len);
            for (let i = 0; i < len; i++) {
                leftI16[i] = floatToInt16Sample(ch0[i]);
                rightI16[i] = floatToInt16Sample(ch1[i]);
            }

            const base = String(file.name || 'Imported Track').replace(/\.[^/.]+$/, '').trim();
            const parts = base.split(/\s+[-–—]\s+/);
            const fallbackArtist = parts.length >= 2 ? parts[0].trim() : '';
            const fallbackTitle = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : base;

            const hasId3Title = Boolean(id3Tags.title && id3Tags.title.trim());
            const hasId3Artist = Boolean(id3Tags.artist && id3Tags.artist.trim());
            const hasAnyId3 = Boolean(hasId3Title || hasId3Artist || id3Tags.album || id3Tags.year || id3Tags.genre || id3Tags.coverBytes);
            const title = hasId3Title ? id3Tags.title.trim() : fallbackTitle;
            const artist = hasId3Artist ? id3Tags.artist.trim() : fallbackArtist;
            const album = (id3Tags.album && id3Tags.album.trim()) || '';
            const year = (id3Tags.year && id3Tags.year.trim()) || '';
            const genre = (id3Tags.genre && id3Tags.genre.trim()) || '';
            const coverBytes = id3Tags.coverBytes || null;
            const coverMime = id3Tags.coverMime || 'image/jpeg';
            const tagSource = (hasId3Title && hasId3Artist) ? 'id3' : (hasAnyId3 ? 'id3-partial' : 'filename');
            const fullyTagged = Boolean(hasId3Title && hasId3Artist && (album || coverBytes));

            this.loadSyntheticBuffer(leftI16, rightI16, decoded.sampleRate, {
                title,
                artist,
                album,
                year,
                genre,
                coverBytes,
                coverMime,
                tagSource,
                hasId3Title,
                hasId3Artist,
                identified: fullyTagged,
                autoTagStatus: fullyTagged ? 'tagged' : '',
                sourceReason: 'import'
            });
            return { length: len, sampleRate: decoded.sampleRate, title, artist, album, year, genre, coverBytes, coverMime, tagSource, hasId3Title, hasId3Artist };
        }

        loadSyntheticBuffer(leftInt16, rightInt16, sampleRate = 44100, meta = {}) {
            this.stopPlayback();
            if (this.length > 0) this._pushUndo();
            this.sampleRate = sampleRate || 44100;
            this.left = leftInt16 instanceof Int16Array ? leftInt16.slice() : new Int16Array(leftInt16);
            this.right = rightInt16 instanceof Int16Array ? rightInt16.slice() : this.left.slice();
            this.length = Math.min(this.left.length, this.right.length);
            this.selection = null;
            this.cursorSample = 0;
            this.tracks = this.length > 0
                ? [this._createTrackObject(0, 0, this.length, {
                    title: meta.title || 'Track 01',
                    artist: meta.artist || '',
                    album: meta.album || '',
                    year: meta.year || '',
                    genre: meta.genre || '',
                    coverBytes: meta.coverBytes || null,
                    coverMime: meta.coverMime || 'image/jpeg',
                    tagSource: meta.tagSource || (meta.title ? 'filename' : 'none'),
                    hasId3Title: Boolean(meta.hasId3Title),
                    hasId3Artist: Boolean(meta.hasId3Artist),
                    identified: Boolean(meta.identified),
                    autoTagStatus: meta.autoTagStatus || ''
                })]
                : [];
            this._rebuildPeakCache();
            this._emit('onTracksChanged', this.tracks);
            this._emit('onSelectionChanged', null);
            this._emit('onBufferChanged', { length: this.length, sampleRate: this.sampleRate });
            if (this.tracks.length > 0) {
                this._emit('onTracksCreated', { tracks: this.tracks.slice(), reason: meta.sourceReason || 'load' });
            }
        }

        clearSession() {
            this.stopPlayback();
            if (this.recordState !== 'idle') this.stopRecording();
            if (this.length > 0) this._pushUndo();
            this.left = new Int16Array(0);
            this.right = new Int16Array(0);
            this.length = 0;
            this.tracks = [];
            this.selection = null;
            this.cursorSample = 0;
            this._rebuildPeakCache();
            this._emit('onTracksChanged', this.tracks);
            this._emit('onSelectionChanged', null);
            this._emit('onBufferChanged', { length: 0, sampleRate: this.sampleRate });
        }

        // --- Playback ---
        async play(startSample = null, endSample = null) {
            if (this.length === 0) return;
            const ctx = await this._ensureAudioContext();
            this.stopPlayback(true);

            let s = startSample !== null && startSample !== undefined ? Math.floor(startSample) : null;
            let e = endSample !== null && endSample !== undefined ? Math.floor(endSample) : null;

            if (s === null) {
                if (this.selection && this.selection.endSample > this.selection.startSample) {
                    s = this.selection.startSample;
                    e = this.selection.endSample;
                } else {
                    s = this.cursorSample < this.length - 10 ? this.cursorSample : 0;
                    e = this.length;
                }
            }
            if (e === null || e <= s) e = this.length;

            s = Math.max(0, Math.min(this.length - 1, s));
            e = Math.max(s + 1, Math.min(this.length, e));
            const span = e - s;
            if (span <= 0) return;

            const audioBuf = ctx.createBuffer(2, span, this.sampleRate);
            const ch0 = audioBuf.getChannelData(0);
            const ch1 = audioBuf.getChannelData(1);
            for (let i = 0; i < span; i++) {
                ch0[i] = this.left[s + i] / 32768;
                ch1[i] = this.right[s + i] / 32768;
            }

            const src = ctx.createBufferSource();
            src.buffer = audioBuf;
            src.loop = Boolean(this.loopPlayback);
            src.connect(this.playbackGainNode);

            this.playbackSource = src;
            this.playStartSample = s;
            this.playEndSample = e;
            this.playStartedAtCtxTime = ctx.currentTime;
            this.isPlaying = true;
            this._playbackRange = { start: s, end: e };

            src.onended = () => {
                if (this.playbackSource === src) {
                    const endedNaturally = this.isPlaying && !src.loop;
                    this.isPlaying = false;
                    this.playbackSource = null;
                    if (endedNaturally) {
                        this.cursorSample = s;
                    }
                    this._emit('onPlaybackStateChanged', { playing: false });
                }
            };

            src.start(0);
            this._emit('onPlaybackStateChanged', { playing: true, startSample: s, endSample: e });
        }

        pausePlayback() {
            if (!this.isPlaying) return;
            this.cursorSample = this.getPlaybackPositionSample();
            this.stopPlayback(false);
        }

        stopPlayback(silent = false) {
            if (this.playbackSource) {
                const old = this.playbackSource;
                this.playbackSource = null;
                try { old.onended = null; old.stop(); old.disconnect(); } catch (_) { }
            }
            const wasPlaying = this.isPlaying;
            this.isPlaying = false;
            if (wasPlaying && !silent) {
                this._emit('onPlaybackStateChanged', { playing: false });
            }
        }

        seek(samplePos) {
            const clamped = Math.max(0, Math.min(this.length, Math.floor(samplePos || 0)));
            this.cursorSample = clamped;
            if (this.isPlaying) {
                const end = this.selection && clamped >= this.selection.startSample && clamped < this.selection.endSample
                    ? this.selection.endSample
                    : this.length;
                this.play(clamped, end);
            }
        }

        getPlaybackPositionSample() {
            if (!this.isPlaying || !this.audioCtx) return this.cursorSample;
            const elapsedSec = Math.max(0, this.audioCtx.currentTime - this.playStartedAtCtxTime);
            const span = Math.max(1, this.playEndSample - this.playStartSample);
            const offsetSamples = Math.floor(elapsedSec * this.sampleRate);
            if (this.loopPlayback) {
                return this.playStartSample + (offsetSamples % span);
            }
            return Math.min(this.playEndSample, this.playStartSample + offsetSamples);
        }

        getMeterLevels() {
            const readAnalyser = (analyser, buf) => {
                if (!analyser) return { rmsDb: -60, peakDb: -60, clipped: false };
                analyser.getFloatTimeDomainData(buf);
                let sum = 0;
                let peak = 0;
                for (let i = 0; i < buf.length; i++) {
                    const a = Math.abs(buf[i]);
                    if (a > peak) peak = a;
                    sum += buf[i] * buf[i];
                }
                const rms = Math.sqrt(sum / buf.length);
                return {
                    rmsDb: Math.max(-60, 20 * Math.log10(Math.max(rms, 1e-4))),
                    peakDb: Math.max(-60, 20 * Math.log10(Math.max(peak, 1e-4))),
                    clipped: peak >= 0.99
                };
            };

            if (this.isPlaying && this.outAnalyserL && this.outAnalyserR) {
                return {
                    left: readAnalyser(this.outAnalyserL, this._meterBufL),
                    right: readAnalyser(this.outAnalyserR, this._meterBufR),
                    mode: 'playback'
                };
            }
            if (this.isSourceConnected() && this.inAnalyserL && this.inAnalyserR) {
                return {
                    left: readAnalyser(this.inAnalyserL, this._meterBufL),
                    right: readAnalyser(this.inAnalyserR, this._meterBufR),
                    mode: 'input'
                };
            }
            return {
                left: { rmsDb: -60, peakDb: -60, clipped: false },
                right: { rmsDb: -60, peakDb: -60, clipped: false },
                mode: 'idle'
            };
        }

        getLiveWaveSamples() {
            if (this.isPlaying && this.outAnalyserL && this.outAnalyserR) {
                this.outAnalyserL.getFloatTimeDomainData(this._waveBufL);
                this.outAnalyserR.getFloatTimeDomainData(this._waveBufR);
                return { left: this._waveBufL, right: this._waveBufR, active: true, mode: 'playback' };
            }
            if (this.isSourceConnected() && this.inAnalyserL && this.inAnalyserR) {
                this.inAnalyserL.getFloatTimeDomainData(this._waveBufL);
                this.inAnalyserR.getFloatTimeDomainData(this._waveBufR);
                return { left: this._waveBufL, right: this._waveBufR, active: true, mode: 'input' };
            }
            this._waveBufL.fill(0);
            this._waveBufR.fill(0);
            return { left: this._waveBufL, right: this._waveBufR, active: false, mode: 'idle' };
        }

        getActiveTrackInfo() {
            if (this.recordState === 'recording' || this.recordState === 'armed' || this.recordState === 'paused') {
                const idx = this.tracks.length;
                return {
                    index: idx,
                    title: `Track ${String(idx + 1).padStart(2, '0')}`,
                    artist: this.sourceLabel || 'Live Audio Stream',
                    durationSec: this.getDurationSeconds(),
                    isLive: true
                };
            }
            if (this.length > 0) {
                const pos = this.isPlaying ? this.getPlaybackPositionSample() : this.cursorSample;
                let trk = this.tracks.find(t => pos >= t.startSample && pos <= t.endSample);
                if (!trk) trk = this.tracks[0] || null;
                if (trk) {
                    return {
                        id: trk.id,
                        index: trk.index,
                        title: trk.title || `Track ${String(trk.index + 1).padStart(2, '0')}`,
                        artist: trk.artist || '',
                        durationSec: (trk.endSample - trk.startSample) / Math.max(1, this.sampleRate),
                        isLive: false
                    };
                }
                return {
                    index: 0,
                    title: 'Recording 01',
                    artist: '',
                    durationSec: this.getDurationSeconds(),
                    isLive: false
                };
            }
            return null;
        }

        getDurationSeconds() {
            return this.sampleRate > 0 ? this.length / this.sampleRate : 0;
        }

        getSlice(startSample, endSample) {
            const s = Math.max(0, Math.min(this.length, Math.floor(startSample || 0)));
            const e = Math.max(s, Math.min(this.length, Math.floor(endSample === undefined ? this.length : endSample)));
            return {
                left: this.left.subarray(s, e),
                right: this.right.subarray(s, e),
                sampleRate: this.sampleRate
            };
        }
    }

    global.StudioAudioEngine = StudioAudioEngine;
})(typeof window !== 'undefined' ? window : globalThis);
