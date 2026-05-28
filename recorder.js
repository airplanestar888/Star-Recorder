const DEFAULT_SETTINGS = {
  outputFormat: "mp4"
};

const state = {
  stream: null,
  recorder: null,
  chunks: [],
  recordingStartedAt: 0,
  elapsedBeforePause: 0,
  pausedAt: 0,
  discardOnStop: false,
  timerId: 0,
  videoUrl: null,
  recordingFormat: "webm",
  recordingFallback: false,
  floatingWindow: null,
  panelMode: new URLSearchParams(window.location.search).get("panel") === "1"
};

const elements = {
  optionsButton: document.getElementById("optionsButton"),
  sourceButton: document.getElementById("sourceButton"),
  recordPanel: document.getElementById("recordPanel"),
  panelState: document.getElementById("panelState"),
  panelStatus: document.getElementById("panelStatus"),
  panelDuration: document.getElementById("panelDuration"),
  panelSize: document.getElementById("panelSize"),
  panelSource: document.getElementById("panelSource"),
  panelStart: document.getElementById("panelStart"),
  panelPause: document.getElementById("panelPause"),
  panelStop: document.getElementById("panelStop"),
  panelOptions: document.getElementById("panelOptions"),
  panelPopout: document.getElementById("panelPopout"),
  panelDownload: document.getElementById("panelDownload"),
  transportControls: document.getElementById("transportControls"),
  recordButton: document.getElementById("recordButton"),
  pauseButton: document.getElementById("pauseButton"),
  stopButton: document.getElementById("stopButton"),
  floatingButton: document.getElementById("floatingButton"),
  resetButton: document.getElementById("resetButton"),
  downloadLink: document.getElementById("downloadLink"),
  statusText: document.getElementById("statusText"),
  previewVideo: document.getElementById("previewVideo"),
  emptyState: document.getElementById("emptyState"),
  recordingPulse: document.getElementById("recordingPulse"),
  recordingState: document.getElementById("recordingState"),
  durationText: document.getElementById("durationText"),
  sizeText: document.getElementById("sizeText"),
  resolutionText: document.getElementById("resolutionText"),
  audioText: document.getElementById("audioText"),
  audioTrackText: document.getElementById("audioTrackText"),
  fpsInput: document.getElementById("fpsInput"),
  widthInput: document.getElementById("widthInput"),
  heightInput: document.getElementById("heightInput"),
  audioInput: document.getElementById("audioInput")
};

function setStatus(message) {
  elements.statusText.textContent = message;
  syncRecordPanel();
  syncFloatingControls();
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatBytes(bytes) {
  if (!bytes) {
    return "0 MB";
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getStoredSettings() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      resolve({ ...DEFAULT_SETTINGS });
      return;
    }
    chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
      resolve({ ...DEFAULT_SETTINGS, ...settings });
    });
  });
}

function getWebmMimeType() {
  return [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getMp4MimeType() {
  return [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1.4D401E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=avc1",
    "video/mp4"
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getRecordingFormat(settings) {
  const preferredFormat = settings.outputFormat === "webm" ? "webm" : "mp4";
  const mp4MimeType = getMp4MimeType();
  const webmMimeType = getWebmMimeType();

  if (preferredFormat === "mp4" && mp4MimeType) {
    return { mimeType: mp4MimeType, extension: "mp4", fallback: false };
  }

  if (preferredFormat === "webm" && webmMimeType) {
    return { mimeType: webmMimeType, extension: "webm", fallback: false };
  }

  if (webmMimeType) {
    return { mimeType: webmMimeType, extension: "webm", fallback: preferredFormat === "mp4" };
  }

  return { mimeType: "", extension: preferredFormat, fallback: false };
}

function createMediaRecorder(stream, settings) {
  const recordingFormat = getRecordingFormat(settings);
  const options = recordingFormat.mimeType ? { mimeType: recordingFormat.mimeType } : undefined;

  try {
    return {
      recorder: new MediaRecorder(stream, options),
      format: recordingFormat
    };
  } catch (error) {
    const webmMimeType = getWebmMimeType();
    if (recordingFormat.extension === "mp4" && webmMimeType) {
      return {
        recorder: new MediaRecorder(stream, { mimeType: webmMimeType }),
        format: { mimeType: webmMimeType, extension: "webm", fallback: true }
      };
    }
    throw error;
  }
}

function openOptionsPage() {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
    return;
  }
  window.open("options.html", "_blank");
}

function resetVideoUrl() {
  if (state.videoUrl) {
    URL.revokeObjectURL(state.videoUrl);
    state.videoUrl = null;
  }
  elements.downloadLink.removeAttribute("href");
  elements.downloadLink.classList.add("is-hidden");
  syncRecordPanel();
  syncFloatingControls();
}

function stopCurrentStream() {
  if (!state.stream) {
    return;
  }
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  elements.previewVideo.srcObject = null;
}

function closeFloatingControls() {
  if (state.floatingWindow && !state.floatingWindow.closed) {
    state.floatingWindow.close();
  }
  state.floatingWindow = null;
}

function refocusPanelWindow() {
  if (typeof chrome !== "undefined" && chrome.windows && chrome.windows.getCurrent) {
    chrome.windows.getCurrent((currentWindow) => {
      if (chrome.runtime.lastError || !currentWindow || !currentWindow.id) {
        window.focus();
        return;
      }
      chrome.windows.update(currentWindow.id, { focused: true }, () => {
        window.focus();
      });
    });
    return;
  }

  window.focus();
}

function refocusPanelWindowSoon() {
  window.setTimeout(refocusPanelWindow, 100);
  window.setTimeout(refocusPanelWindow, 450);
  window.setTimeout(refocusPanelWindow, 900);
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = 0;
  }
}

function updateRecordingStats() {
  let elapsedMs = state.elapsedBeforePause;
  if (state.recorder && state.recorder.state === "recording") {
    elapsedMs += Date.now() - state.recordingStartedAt;
  }
  const bytes = state.chunks.reduce((total, chunk) => total + chunk.size, 0);
  elements.durationText.textContent = formatDuration(elapsedMs / 1000);
  elements.sizeText.textContent = formatBytes(bytes);
  syncRecordPanel();
  syncFloatingControls();
}

function updateStreamStats() {
  if (!state.stream) {
    elements.resolutionText.textContent = "-";
    elements.audioText.textContent = "Off";
    elements.audioTrackText.textContent = "Not selected";
    elements.previewVideo.style.aspectRatio = "16 / 9";
    syncFloatingControls();
    return;
  }

  const [videoTrack] = state.stream.getVideoTracks();
  const [audioTrack] = state.stream.getAudioTracks();
  const settings = videoTrack ? videoTrack.getSettings() : {};
  const width = settings.width || "-";
  const height = settings.height || "-";
  elements.resolutionText.textContent = `${width} x ${height}`;
  elements.audioText.textContent = audioTrack ? "On" : "Off";
  elements.audioTrackText.textContent = audioTrack ? audioTrack.label || "Ready" : "Missing";

  if (settings.width && settings.height) {
    elements.previewVideo.style.aspectRatio = `${settings.width} / ${settings.height}`;
  }
  syncFloatingControls();
}

function updateControls() {
  const hasStream = Boolean(state.stream);
  const isRecording = Boolean(state.recorder && state.recorder.state === "recording");
  const isPaused = Boolean(state.recorder && state.recorder.state === "paused");
  const hasActiveRecorder = isRecording || isPaused;
  const isSaving = Boolean(state.recorder && !hasActiveRecorder);

  elements.sourceButton.disabled = hasActiveRecorder;
  elements.panelSource.disabled = hasActiveRecorder;
  elements.recordButton.disabled = !hasStream || hasActiveRecorder || isSaving;
  elements.pauseButton.disabled = !hasActiveRecorder;
  elements.pauseButton.textContent = isPaused ? "Resume" : "Pause";
  elements.stopButton.disabled = !hasActiveRecorder;
  elements.floatingButton.disabled = !hasStream;
  elements.panelStart.disabled = !hasStream || hasActiveRecorder || isSaving;
  elements.panelPause.disabled = !hasActiveRecorder;
  elements.panelPause.textContent = isPaused ? "Resume" : "Pause";
  elements.panelStop.disabled = !hasActiveRecorder;
  elements.panelPopout.disabled = !hasStream;
  elements.resetButton.disabled = !hasStream && !state.videoUrl;
  elements.fpsInput.disabled = hasActiveRecorder;
  elements.widthInput.disabled = hasActiveRecorder;
  elements.heightInput.disabled = hasActiveRecorder;
  elements.audioInput.disabled = hasActiveRecorder;

  elements.transportControls.classList.toggle("is-hidden", !hasStream && !state.videoUrl);
  elements.recordPanel.classList.toggle("is-hidden", !state.panelMode && !hasStream && !state.videoUrl);
  elements.panelDownload.classList.toggle("is-hidden", !state.videoUrl);
  elements.emptyState.classList.toggle("is-hidden", hasStream);
  elements.recordingPulse.classList.toggle("is-recording", isRecording);
  elements.recordingPulse.classList.toggle("is-paused", isPaused);
  elements.recordingState.textContent = isRecording ? "Recording" : isPaused ? "Paused" : hasStream ? "Ready" : "Empty";
  syncRecordPanel();
  syncFloatingControls();
}

function getRecorderFlags() {
  const hasStream = Boolean(state.stream);
  const isRecording = Boolean(state.recorder && state.recorder.state === "recording");
  const isPaused = Boolean(state.recorder && state.recorder.state === "paused");
  const hasActiveRecorder = isRecording || isPaused;
  const isSaving = Boolean(state.recorder && !hasActiveRecorder);

  return { hasStream, isRecording, isPaused, hasActiveRecorder, isSaving };
}

function syncRecordPanel() {
  const { hasStream, isRecording, isPaused, hasActiveRecorder, isSaving } = getRecorderFlags();

  elements.panelState.textContent = isRecording ? "Recording" : isPaused ? "Paused" : hasStream ? "Ready" : "Empty";
  elements.panelStatus.textContent = elements.statusText.textContent;
  elements.panelDuration.textContent = elements.durationText.textContent;
  elements.panelSize.textContent = elements.sizeText.textContent;
  elements.panelSource.disabled = hasActiveRecorder;
  elements.panelStart.disabled = !hasStream || hasActiveRecorder || isSaving;
  elements.panelPause.disabled = !hasActiveRecorder;
  elements.panelPause.textContent = isPaused ? "Resume" : "Pause";
  elements.panelStop.disabled = !hasActiveRecorder;
  elements.panelPopout.disabled = !hasStream;
  elements.panelDownload.classList.toggle("is-hidden", !state.videoUrl);
}

function syncFloatingControls() {
  const pip = state.floatingWindow;
  if (!pip || pip.closed) {
    return;
  }

  const { hasStream, isRecording, isPaused, hasActiveRecorder, isSaving } = getRecorderFlags();
  const setText = (id, text) => {
    const node = pip.document.getElementById(id);
    if (node) {
      node.textContent = text;
    }
  };
  const setDisabled = (id, disabled) => {
    const node = pip.document.getElementById(id);
    if (node) {
      node.disabled = disabled;
    }
  };
  const setHidden = (id, hidden) => {
    const node = pip.document.getElementById(id);
    if (node) {
      node.classList.toggle("is-hidden", hidden);
    }
  };

  setText("pipState", isRecording ? "Recording" : isPaused ? "Paused" : hasStream ? "Ready" : "Empty");
  setText("pipStatus", elements.statusText.textContent);
  setText("pipDuration", elements.durationText.textContent);
  setText("pipSize", elements.sizeText.textContent);
  setText("pipPause", isPaused ? "Resume" : "Pause");

  setDisabled("pipStart", !hasStream || hasActiveRecorder || isSaving);
  setDisabled("pipPause", !hasActiveRecorder);
  setDisabled("pipStop", !hasActiveRecorder);
  setHidden("pipDownload", !state.videoUrl);

  const pulse = pip.document.getElementById("pipPulse");
  if (pulse) {
    pulse.classList.toggle("is-recording", isRecording);
    pulse.classList.toggle("is-paused", isPaused);
  }
}

async function openFloatingControls() {
  if (!state.stream) {
    setStatus("Choose a source before opening floating controls.");
    return;
  }

  if (state.floatingWindow && !state.floatingWindow.closed) {
    state.floatingWindow.focus();
    syncFloatingControls();
    return;
  }

  let pip;
  if ("documentPictureInPicture" in window) {
    try {
      pip = await window.documentPictureInPicture.requestWindow({
        width: 360,
        height: 220
      });
    } catch (error) {
      setStatus(`Could not open always-on-top panel: ${error.message}`);
    }
  }

  if (!pip) {
    pip = window.open(
      "",
      "starRecorderPanel",
      "popup=yes,width=360,height=240,left=80,top=80"
    );
  }

  if (!pip) {
    setStatus("Could not open the pop-out panel. Allow pop-ups for this extension, then try again.");
    return;
  }

  state.floatingWindow = pip;

  pip.document.body.innerHTML = `
    <main class="pip">
      <header>
        <strong>Star Recorder</strong>
        <span id="pipState">Ready</span>
      </header>
      <div class="pipStats">
        <span id="pipDuration">00:00</span>
        <span id="pipSize">0 MB</span>
      </div>
      <p id="pipStatus">Source ready.</p>
      <div class="pipBar"><div id="pipPulse"></div></div>
      <nav>
        <button id="pipStart" type="button">Start</button>
        <button id="pipPause" class="warning" type="button" disabled>Pause</button>
        <button id="pipStop" class="danger" type="button" disabled>Stop</button>
        <button id="pipDownload" class="download is-hidden" type="button">Download</button>
      </nav>
    </main>
  `;

  const style = pip.document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      color: #111827;
      background: #f8fafc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pip { display: grid; gap: 12px; padding: 14px; }
    header, .pipStats, nav { display: flex; align-items: center; gap: 8px; }
    header, .pipStats { justify-content: space-between; }
    strong { font-size: 14px; }
    span { color: #5d6675; font-size: 12px; font-weight: 700; }
    .pipStats span { color: #111827; font-size: 20px; font-weight: 850; }
    p { min-height: 34px; margin: 0; color: #334155; font-size: 12px; line-height: 1.4; }
    .pipBar { overflow: hidden; height: 7px; border-radius: 999px; background: #dce3ec; }
    #pipPulse { width: 0%; height: 100%; border-radius: inherit; background: #b47805; }
    #pipPulse.is-recording { width: 100%; animation: pulse 1.2s ease-in-out infinite; }
    #pipPulse.is-paused { width: 100%; background: #94a3b8; }
    nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    button {
      min-height: 38px;
      border: 0;
      border-radius: 8px;
      color: #ffffff;
      background: #126a5c;
      font: inherit;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }
    button:disabled { cursor: not-allowed; opacity: 0.55; }
    .warning { color: #17202a; background: #f0c25a; }
    .danger { background: #b42318; }
    .download { background: #2f5f9e; }
    .is-hidden { display: none !important; }
    @keyframes pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
  `;
  pip.document.head.append(style);

  pip.document.getElementById("pipStart").addEventListener("click", startRecording);
  pip.document.getElementById("pipPause").addEventListener("click", togglePauseRecording);
  pip.document.getElementById("pipStop").addEventListener("click", stopRecording);
  pip.document.getElementById("pipDownload").addEventListener("click", () => {
    if (state.videoUrl) {
      elements.downloadLink.click();
    }
  });
  pip.addEventListener("pagehide", () => {
    state.floatingWindow = null;
  });
  pip.addEventListener("beforeunload", () => {
    state.floatingWindow = null;
  });

  syncFloatingControls();
}

function chooseDesktopMedia(sources) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.desktopCapture) {
      reject(new Error("desktopCapture is unavailable. Run this page from the loaded Chrome extension."));
      return;
    }

    chrome.desktopCapture.chooseDesktopMedia(sources, (streamId) => {
      if (!streamId) {
        reject(new Error("Source selection was canceled."));
        return;
      }
      resolve(streamId);
    });
  });
}

async function getDesktopStream(streamId) {
  const maxFrameRate = clampNumber(elements.fpsInput.value, 5, 60, 30);
  const maxWidth = clampNumber(elements.widthInput.value, 640, 3840, 1920);
  const maxHeight = clampNumber(elements.heightInput.value, 360, 2160, 1080);
  const mandatory = {
    chromeMediaSource: "desktop",
    chromeMediaSourceId: streamId,
    maxFrameRate,
    maxWidth,
    maxHeight
  };
  const constraints = {
    video: { mandatory },
    audio: false
  };

  if (elements.audioInput.checked) {
    constraints.audio = {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: streamId
      }
    };
  }

  return navigator.mediaDevices.getUserMedia(constraints);
}

async function useSelectedSource(streamId) {
  state.stream = await getDesktopStream(streamId);
  elements.previewVideo.srcObject = state.stream;
  await Promise.allSettled([elements.previewVideo.play()]);
  state.stream.getVideoTracks()[0].addEventListener("ended", handleStreamEnded);
  updateStreamStats();
  refocusPanelWindowSoon();

  if (elements.audioInput.checked && !state.stream.getAudioTracks().length) {
    setStatus("Source ready, but no audio track was shared. For X Spaces, choose Chrome Tab and enable tab audio in the share dialog.");
  } else {
    setStatus("Source ready. Click Start Recording.");
  }
}

async function pickSource() {
  resetVideoUrl();
  stopCurrentStream();
  clearTimer();
  state.chunks = [];
  state.elapsedBeforePause = 0;
  state.pausedAt = 0;
  elements.durationText.textContent = "00:00";
  elements.sizeText.textContent = "0 MB";
  updateControls();

  setStatus("Choose the tab, window, or screen you want to record...");

  try {
    const sources = elements.audioInput.checked
      ? ["tab", "audio", "window", "screen"]
      : ["tab", "window", "screen"];
    refocusPanelWindow();
    const streamId = await chooseDesktopMedia(sources);
    await useSelectedSource(streamId);
  } catch (error) {
    setStatus(error.message);
    stopCurrentStream();
    updateStreamStats();
  } finally {
    updateControls();
  }
}

async function startRecording() {
  if (!state.stream || state.recorder) {
    return;
  }

  resetVideoUrl();
  state.chunks = [];
  state.recordingStartedAt = Date.now();
  state.elapsedBeforePause = 0;
  state.pausedAt = 0;
  elements.durationText.textContent = "00:00";
  elements.sizeText.textContent = "0 MB";

  const settings = await getStoredSettings();
  let recording;
  try {
    recording = createMediaRecorder(state.stream, settings);
  } catch (error) {
    setStatus(`Could not start recorder: ${error.message}`);
    updateControls();
    return;
  }

  const recordingFormat = recording.format;
  state.recordingFormat = recordingFormat.extension;
  state.recordingFallback = recordingFormat.fallback;
  state.recorder = recording.recorder;

  state.recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      state.chunks.push(event.data);
      updateRecordingStats();
    }
  });

  state.recorder.addEventListener("stop", finishRecording, { once: true });
  state.recorder.start(1000);
  state.timerId = window.setInterval(updateRecordingStats, 250);

  if (state.recordingFallback) {
    setStatus("MP4 is not supported by this Chrome build, so recording fell back to WebM.");
  } else if (elements.audioInput.checked && !state.stream.getAudioTracks().length) {
    setStatus("Recording video only. No audio track was shared by Chrome.");
  } else {
    setStatus(`Recording ${state.recordingFormat.toUpperCase()} video...`);
  }
  updateControls();
}

function togglePauseRecording() {
  if (!state.recorder) {
    return;
  }

  if (state.recorder.state === "recording") {
    state.elapsedBeforePause += Date.now() - state.recordingStartedAt;
    state.pausedAt = Date.now();
    state.recorder.pause();
    clearTimer();
    updateRecordingStats();
    setStatus("Recording paused.");
  } else if (state.recorder.state === "paused") {
    state.recordingStartedAt = Date.now();
    state.pausedAt = 0;
    state.recorder.resume();
    state.timerId = window.setInterval(updateRecordingStats, 250);
    setStatus("Recording resumed.");
  }

  updateControls();
}

function stopRecording() {
  if (!state.recorder || state.recorder.state === "inactive") {
    return;
  }
  if (state.recorder.state === "recording") {
    state.elapsedBeforePause += Date.now() - state.recordingStartedAt;
  }
  state.recorder.stop();
  setStatus("Saving video...");
  updateControls();
}

function finishRecording() {
  clearTimer();
  updateRecordingStats();

  const recorder = state.recorder;
  state.recorder = null;

  if (state.discardOnStop) {
    state.discardOnStop = false;
    state.chunks = [];
    state.elapsedBeforePause = 0;
    state.pausedAt = 0;
    elements.durationText.textContent = "00:00";
    elements.sizeText.textContent = "0 MB";
    setStatus("Choose a capture source to start.");
    updateControls();
    return;
  }

  const mimeType = recorder.mimeType || "video/webm";
  const blob = new Blob(state.chunks, { type: mimeType });
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  state.videoUrl = URL.createObjectURL(blob);
  elements.downloadLink.href = state.videoUrl;
  elements.downloadLink.download = `star-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  elements.downloadLink.classList.remove("is-hidden");
  stopCurrentStream();
  updateStreamStats();

  setStatus("Video is ready to download.");
  updateControls();
}

function handleStreamEnded() {
  if (state.recorder && state.recorder.state !== "inactive") {
    stopRecording();
  }
  stopCurrentStream();
  updateStreamStats();
  setStatus("The capture source stopped. Choose a source again to record another video.");
  updateControls();
}

function resetRecorder() {
  if (state.recorder && state.recorder.state !== "inactive") {
    state.discardOnStop = true;
    stopRecording();
    stopCurrentStream();
    closeFloatingControls();
    updateStreamStats();
    updateControls();
    return;
  }
  stopCurrentStream();
  closeFloatingControls();
  clearTimer();
  resetVideoUrl();
  state.chunks = [];
  state.recorder = null;
  state.elapsedBeforePause = 0;
  state.pausedAt = 0;
  state.discardOnStop = false;
  elements.durationText.textContent = "00:00";
  elements.sizeText.textContent = "0 MB";
  updateStreamStats();
  setStatus("Choose a capture source to start.");
  updateControls();
}

elements.optionsButton.addEventListener("click", openOptionsPage);
elements.sourceButton.addEventListener("click", pickSource);
elements.panelSource.addEventListener("click", pickSource);
elements.recordButton.addEventListener("click", startRecording);
elements.pauseButton.addEventListener("click", togglePauseRecording);
elements.stopButton.addEventListener("click", stopRecording);
elements.floatingButton.addEventListener("click", openFloatingControls);
elements.panelStart.addEventListener("click", startRecording);
elements.panelPause.addEventListener("click", togglePauseRecording);
elements.panelStop.addEventListener("click", stopRecording);
elements.panelOptions.addEventListener("click", openOptionsPage);
elements.panelPopout.addEventListener("click", openFloatingControls);
elements.panelDownload.addEventListener("click", () => {
  if (state.videoUrl) {
    elements.downloadLink.click();
  }
});
elements.resetButton.addEventListener("click", resetRecorder);

window.addEventListener("beforeunload", () => {
  closeFloatingControls();
  stopCurrentStream();
  resetVideoUrl();
});

updateStreamStats();
document.body.classList.toggle("panelMode", state.panelMode);
updateControls();
