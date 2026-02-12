# LexiFlow Browser Extension

## Overview
LexiFlow is a browser extension that reads documentation line-by-line with Spotify-style highlighting. Works on ANY webpage!

## Features
- ✅ **Works on all websites** - No iframe restrictions
- ✅ **Direct page highlighting** - Highlights actual content as it reads
- ✅ **Browser TTS** - Built-in text-to-speech, no API keys needed
- ✅ **Auto-scroll** - Keeps current sentence visible
- ✅ **Adjustable speed** - 0.5x to 2x playback
- ✅ **Multiple voices** - Choose from system voices
- ✅ **Progress tracking** - See sentence count and progress

## Installation

### Chrome/Edge
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `/app/extension` folder
5. Pin the extension to your toolbar

### Firefox
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to `/app/extension` and select `manifest.json`

## Usage

1. **Navigate** to any documentation page (e.g., https://kubernetes.io/docs/)
2. **Click** the LexiFlow extension icon in your toolbar
3. **Click** "Start Reading"
4. **Watch** as it highlights and reads the content line-by-line!

### Controls
- **Play/Pause**: Start or pause reading
- **Previous** (⏮): Go to previous sentence
- **Next** (⏭): Go to next sentence
- **Speed slider**: Adjust reading speed (0.5x - 2x)
- **Voice selector**: Choose different voices

## Tested On
- ✅ Kubernetes documentation
- ✅ React documentation
- ✅ Python documentation
- ✅ MDN Web Docs
- ✅ Wikipedia
- ✅ Any webpage with text content!

## Technical Details

### Architecture
- **Manifest V3**: Modern Chrome extension format
- **Content Script**: Injects into every page for text extraction and highlighting
- **Popup**: Control panel with settings
- **Background Worker**: Manages state and communication

### How It Works
1. Content script extracts text from main content areas
2. Splits text into sentences using regex
3. Uses browser's SpeechSynthesis API for TTS
4. Highlights sentences by finding them in the DOM
5. Auto-scrolls to keep highlighted content visible

## Advantages Over Web App

| Feature | Web App | Extension |
|---------|---------|----------|
| Works on all sites | ❌ (CORS/iframe blocks) | ✅ Yes |
| Direct page access | ❌ No | ✅ Yes |
| Highlight on actual page | ❌ No | ✅ Yes |
| Setup required | ✅ Backend needed | ❌ Just install |
| API keys needed | ✅ For AI TTS | ❌ Browser TTS |

## Future Enhancements
- AI chat integration (connect to backend)
- Bookmarking sentences
- Custom highlight colors
- Keyboard shortcuts
- Multi-language support

## Troubleshooting

### No voices available
- **Solution**: Restart your browser. Voices load asynchronously.

### Extension not working on some pages
- **Solution**: Some pages (like chrome://extensions) block extensions for security.

### Highlighting not accurate
- **Solution**: Some dynamic pages may need to be refreshed after loading.

## Development

### File Structure
```
/app/extension/
├── manifest.json          # Extension configuration
├── popup/
│   ├── popup.html       # Popup UI
│   └── popup.js         # Popup logic
├── content/
│   ├── content.js       # Content script (runs on pages)
│   └── content.css      # Highlight styles
├── background/
│   └── background.js    # Service worker
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## License
MIT License

## Support
For issues or feature requests, please open an issue.

---

**Built with ❤️ by LexiFlow Team**