# NovaCast

NovaCast is a Chrome extension for recording a tab, window, or screen as a video.

## How to use

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the extracted or cloned project folder.
5. Click the `NovaCast` extension icon.
6. The recorder panel opens in a small popup window.
7. Click `Choose Source`.
8. Pick the tab, window, or screen you want to record.
9. Use `Start`, `Pause`, `Resume`, and `Stop` from the recorder panel.
10. Click `Download` when the video is ready.

## Options

Open the extension options page to choose the output format. `MP4 for social upload` is best for X and most social platforms, but Chrome support depends on the installed browser build. If MP4 recording is unavailable, NovaCast falls back to WebM.

## Output

The video downloads as `.mp4` when Chrome supports MP4 recording. Otherwise, it downloads as `.webm`.

Audio can be recorded when `Record audio when available` is enabled and the selected source provides audio.

For X Spaces, pick the `Chrome Tab` source for the X tab and enable the tab-audio option in Chrome's share dialog. Window capture often records video only.
