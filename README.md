# Star Recorder

Star Recorder is a simple Chrome extension for recording a tab, window, or screen as a WebM video.

## How to use

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `C:\Users\bobyr\Documents\Playground\camstar`.
5. Click the `Star Recorder` extension icon.
6. The recorder panel opens in a small popup window.
7. Click `Choose Source`.
8. Pick the tab, window, or screen you want to record.
9. Use `Start`, `Pause`, `Resume`, and `Stop` from the recorder panel.
10. Click `Download` when the video is ready.

## Output

The video downloads as a `.webm` file. Chrome supports this format directly, and it is good for quick previews. If you need MP4, convert the WebM file with a tool like FFmpeg.

Audio can be recorded when `Record audio when available` is enabled and the selected source provides audio.

For X Spaces, pick the `Chrome Tab` source for the X tab and enable the tab-audio option in Chrome's share dialog. Window capture often records video only.
