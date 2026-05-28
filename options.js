const DEFAULT_SETTINGS = {
  outputFormat: "mp4"
};

const fields = {
  saveState: document.getElementById("saveState"),
  mp4Support: document.getElementById("mp4Support"),
  webmSupport: document.getElementById("webmSupport"),
  outputFormats: [...document.querySelectorAll("input[name='outputFormat']")]
};

function getMp4MimeType() {
  return [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1.4D401E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=avc1",
    "video/mp4"
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
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

function saveSettings(settings) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      resolve();
      return;
    }
    chrome.storage.local.set(settings, resolve);
  });
}

function setSaveState(text) {
  fields.saveState.textContent = text;
}

function renderSupport() {
  const mp4MimeType = getMp4MimeType();
  const webmMimeType = getWebmMimeType();
  fields.mp4Support.textContent = mp4MimeType ? "Available" : "Not available";
  fields.webmSupport.textContent = webmMimeType ? "Available" : "Not available";
}

async function loadSettings() {
  const settings = await getStoredSettings();
  const outputFormat = settings.outputFormat === "webm" ? "webm" : "mp4";
  fields.outputFormats.forEach((field) => {
    field.checked = field.value === outputFormat;
  });
}

async function handleFormatChange(event) {
  setSaveState("Saving...");
  await saveSettings({ outputFormat: event.currentTarget.value });
  setSaveState("Saved");
}

fields.outputFormats.forEach((field) => {
  field.addEventListener("change", handleFormatChange);
});

renderSupport();
loadSettings();
