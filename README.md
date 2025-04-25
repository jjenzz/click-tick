# ClickTick

A Chrome extension that measures webpage reaction times to user navigation events. Track how quickly a webpage responds to clicks on buttons and links, with timing displayed in milliseconds and frames.

<video src="https://github.com/user-attachments/assets/2a382dd5-40b3-4488-b913-14f61891feb2" controls="controls" muted="muted" class="d-block rounded-bottom-2 border-top width-fit" style="max-height:640px; min-height: 200px"></video>

## Features

- Measures time between user interaction and DOM changes
- Displays timing in milliseconds and frames (60fps/120fps)
- Draggable timing display box
- Toggle on/off with a single click
- Works on any SPA (Single Page Application) webpage

## Installation

1. Download the extension:
   - Click the green "Code" button at the top of this repository
   - Select "Download ZIP"
   - Extract the ZIP file to a location on your computer

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top-right corner
   - Click "Load unpacked" and select the extracted folder
   - The ClickTick icon should appear in your Chrome toolbar

## Usage

1. Click the ClickTick icon in your Chrome toolbar to activate the extension
2. Click any link or button on the webpage
3. The timing box will appear showing:
   - Time elapsed in milliseconds
   - Frames elapsed at 60fps and 120fps
4. Click the icon again to deactivate the extension

## Development

The extension is built with vanilla JavaScript and follows Chrome's Manifest V3 specification. The source code is organized in the `src` directory:

- `background.js`: Handles extension activation/deactivation
- `content.js`: Implements the timing measurement and display

## License

MIT License