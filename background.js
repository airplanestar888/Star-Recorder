let recorderWindowId = null;

chrome.action.onClicked.addListener(() => {
  if (recorderWindowId !== null) {
    chrome.windows.update(recorderWindowId, { focused: true }, () => {
      if (!chrome.runtime.lastError) {
        return;
      }
      recorderWindowId = null;
      openRecorderWindow();
    });
    return;
  }

  openRecorderWindow();
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === recorderWindowId) {
    recorderWindowId = null;
  }
});

function openRecorderWindow() {
  chrome.windows.create(
    {
      url: chrome.runtime.getURL("recorder.html?panel=1"),
      type: "popup",
      width: 390,
      height: 440,
      focused: true
    },
    (createdWindow) => {
      recorderWindowId = createdWindow ? createdWindow.id : null;
    }
  );
}
