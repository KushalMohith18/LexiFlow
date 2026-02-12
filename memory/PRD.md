# LexiFlow - Documentation Reader Extension

## Product Requirements Document

### Overview
LexiFlow is a browser extension that reads online documentation aloud with synchronized highlighting, making it easier to consume technical content hands-free. Features audiobook-quality narration with multiple TTS providers.

### Version 2.0 Features

1. **Multi-Provider Text-to-Speech**
   - **Puter TTS (Primary)** - High-quality AWS Polly neural voices via Puter.js
   - **Sarvam AI (Indian)** - Professional Indian voice artists with Bulbul v2 model
   - **Browser TTS (Fallback)** - Offline capability with system voices
   
2. **Audiobook-Style Narration**
   - All voices optimized for narration quality
   - Natural sentence pacing (350ms between sentences)
   - Temperature-controlled expressiveness for natural delivery
   - Premium quality audio settings

3. **Synchronized Highlighting**
   - Current sentence highlighted with gradient effect
   - Auto-scroll to keep content at eye level (1/3 from top)
   - Smooth animations

4. **Real-Time Controls (Fixed in v2.0)**
   - ✅ **Pause/Resume** - Properly tracks audio state across all providers
   - ✅ **Speed Control** - Live adjustment without restarting (0.5x - 2.5x)
   - ✅ **Voice Switching** - Seamless transition at sentence boundary
   - ✅ **Provider Switching** - Immediate switch with correct voice loading

5. **Navigation Controls**
   - Play/Pause/Stop
   - Previous/Next sentence
   - Click any text to start from that position
   - Floating on-page controls

6. **Smart Content Extraction**
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
├── manifest.json          # Extension configuration (v2.0.0)
├── popup/
│   ├── popup.html        # Settings UI (dark theme)
│   └── popup.js          # Popup logic with multi-provider support
├── content/
│   ├── sarvam-tts.js     # Sarvam AI TTS integration (NEW)
│   ├── puter-tts.js      # Puter.js TTS integration (Enhanced)
│   ├── content.js        # Main content script (v2.0)
│   └── content.css       # Styles
├── background/
│   └── background.js     # Service worker
└── icons/                # Extension icons
```

### TTS Providers

| Provider | Quality | Voices | Features |
|----------|---------|--------|----------|
| **Puter TTS** | Neural (AWS Polly) | 15 (US, UK, AU) | Cloud-based, narration voices |
| **Sarvam AI** | Neural (Bulbul v2) | 13 (Indian) | Indian accents, warm voices |
| **Browser TTS** | System-dependent | Varies | Offline, no setup needed |

### Sarvam AI Integration
- API Key: Configured in extension
- Model: Bulbul v2 (optimized for narration)
- Temperature: 0.78 (natural expressiveness)
- Features: Preprocessing, 22050Hz sample rate

### Status: Implemented ✅
- [x] Core TTS functionality
- [x] Highlighting and auto-scroll
- [x] Floating controls
- [x] Click-to-start navigation
- [x] Real-time speed/voice changes (FIXED)
- [x] Pause/Resume functionality (FIXED)
- [x] Puter.js integration
- [x] Sarvam AI integration (NEW)
- [x] Multi-provider voice selection (NEW)
- [x] Audiobook-style narration settings (NEW)

### Known Limitations
- Cannot run on browser internal pages (chrome://, about:)
- Requires internet for Puter.js and Sarvam AI voices
- Some sites with heavy JavaScript may not extract properly

### Installation
1. Open Chrome/Edge and go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `/app/extension` folder
5. Click the LexiFlow icon to start reading any page!

---
*Last Updated: July 2025 - Version 2.0*
