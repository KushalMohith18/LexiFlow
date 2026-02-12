# LexiFlow - Documentation Reader Extension

## Product Requirements Document

### Overview
LexiFlow is a browser extension that reads online documentation aloud with synchronized highlighting, making it easier to consume technical content hands-free.

### Core Features
1. **Text-to-Speech Reading**
   - High-quality neural voices via Puter.js TTS
   - Browser TTS as offline fallback
   - Multiple voice options (US, UK, AU accents)
   - Adjustable reading speed (0.5x - 2.5x)

2. **Synchronized Highlighting**
   - Current sentence highlighted with gradient effect
   - Auto-scroll to keep content at eye level (1/3 from top)
   - Smooth animations

3. **Navigation Controls**
   - Play/Pause/Stop
   - Previous/Next sentence
   - Click any text to start from that position
   - Floating on-page controls

4. **Smart Content Extraction**
   - Automatically finds main content area
   - Filters out navigation, headers, footers
   - Sentence-level parsing

### Target Users
- Developers reading documentation
- People with visual impairments
- Users who prefer audio learning
- Multitaskers who want to listen while doing other things

### Technical Architecture
```
/app/extension/
├── manifest.json          # Extension configuration (v1.1.0)
├── popup/
│   ├── popup.html        # Settings UI
│   └── popup.js          # Popup logic
├── content/
│   ├── puter-tts.js     # Puter.js TTS integration
│   ├── content.js       # Main content script
│   └── content.css      # Styles
├── background/
│   └── background.js    # Service worker
└── icons/               # Extension icons
```

### TTS Providers
1. **Puter.js (Primary)** - High-quality neural voices, cloud-based
2. **Browser TTS (Fallback)** - Offline capability, variable quality

### Status: Implemented ✅
- [x] Core TTS functionality
- [x] Highlighting and auto-scroll
- [x] Floating controls
- [x] Click-to-start navigation
- [x] Real-time speed/voice changes
- [x] Puter.js integration (replaced broken Edge TTS)

### Known Limitations
- Cannot run on browser internal pages (chrome://, about:)
- Requires internet for Puter.js voices
- Some sites with heavy JavaScript may not extract properly

### Installation
See `/app/extension/QUICKSTART.md` for installation instructions.

---
*Last Updated: February 2025*
