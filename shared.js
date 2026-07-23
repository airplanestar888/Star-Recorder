const StarRecorder = {
  DEFAULT_SETTINGS: Object.freeze({ outputFormat: "mp4" }),

  FORMAT: Object.freeze({ MP4: "mp4", WEBM: "webm" }),

  getStoredSettings() {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        resolve({ ...this.DEFAULT_SETTINGS });
        return;
      }
      chrome.storage.local.get(this.DEFAULT_SETTINGS, (settings) => {
        resolve({ ...this.DEFAULT_SETTINGS, ...settings });
      });
    });
  },

  saveSettings(settings) {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }
      chrome.storage.local.set(settings, resolve);
    });
  },

  getWebmMimeType() {
    return [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
  },

  getMp4MimeType() {
    return [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1.4D401E,mp4a.40.2",
      "video/mp4;codecs=h264,aac",
      "video/mp4;codecs=avc1",
      "video/mp4"
    ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
  },

  getRecordingFormat(settings) {
    const preferredFormat = settings.outputFormat === this.FORMAT.WEBM ? this.FORMAT.WEBM : this.FORMAT.MP4;
    const mp4MimeType = this.getMp4MimeType();
    const webmMimeType = this.getWebmMimeType();

    if (preferredFormat === this.FORMAT.MP4 && mp4MimeType) {
      return { mimeType: mp4MimeType, extension: this.FORMAT.MP4, fallback: false };
    }

    if (preferredFormat === this.FORMAT.WEBM && webmMimeType) {
      return { mimeType: webmMimeType, extension: this.FORMAT.WEBM, fallback: false };
    }

    if (webmMimeType) {
      return { mimeType: webmMimeType, extension: this.FORMAT.WEBM, fallback: preferredFormat === this.FORMAT.MP4 };
    }

    return { mimeType: "", extension: preferredFormat, fallback: false };
  }
};
