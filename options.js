const fields = {
  saveState: document.getElementById("saveState"),
  mp4Support: document.getElementById("mp4Support"),
  webmSupport: document.getElementById("webmSupport"),
  outputFormats: [...document.querySelectorAll("input[name='outputFormat']")]
};

function setSaveState(text) {
  fields.saveState.textContent = text;
}

function renderSupport() {
  const mp4MimeType = StarRecorder.getMp4MimeType();
  const webmMimeType = StarRecorder.getWebmMimeType();
  fields.mp4Support.textContent = mp4MimeType ? "Available" : "Not available";
  fields.webmSupport.textContent = webmMimeType ? "Available" : "Not available";
}

async function loadSettings() {
  const settings = await StarRecorder.getStoredSettings();
  const outputFormat = settings.outputFormat === StarRecorder.FORMAT.WEBM ? StarRecorder.FORMAT.WEBM : StarRecorder.FORMAT.MP4;
  fields.outputFormats.forEach((field) => {
    field.checked = field.value === outputFormat;
  });
}

async function handleFormatChange(event) {
  setSaveState("Saving...");
  await StarRecorder.saveSettings({ outputFormat: event.currentTarget.value });
  setSaveState("Saved");
}

fields.outputFormats.forEach((field) => {
  field.addEventListener("change", handleFormatChange);
});

renderSupport();
loadSettings();
