# LexiFlow v1.1.0 - Testing Guide

## Changes Made

### 1. Fixed TTS Integration
- **Replaced broken Edge TTS** with **Puter.js TTS** (`puter.ai.txt2speech()`)
- Correct API: Uses `puter.ai.txt2speech(text, {voice, engine: 'neural'})`
- Returns an Audio element that can be controlled directly

### 2. Real-time Speed Control (NO RESTART)
- Speed changes now apply **instantly** using `audio.playbackRate`
- The current sentence continues playing at the new speed
- No interruption or restart

### 3. Voice Changes (Applied on Next Sentence)
- Voice changes are **queued** and applied when the next sentence starts
- This prevents interrupting the current sentence
- Provides a smooth listening experience

## Available Voices (Puter TTS)

### 🇺🇸 US English (Neural)
- Joanna (Female) - Default
- Matthew (Male)
- Ivy (Female)
- Joey (Male)
- Kendra (Female)
- Kimberly (Female)
- Salli (Female)
- Kevin (Male)
- Ruth (Female)
- Stephen (Male)

### 🇬🇧 UK English (Neural)
- Amy (Female)
- Brian (Male)
- Emma (Female)
- Arthur (Male)

### 🇦🇺 Australian (Neural)
- Olivia (Female)

## How to Test

### Step 1: Load the Extension
1. Open `chrome://extensions/` (or `about:debugging` for Firefox)
2. Enable "Developer mode"
3. Click "Load unpacked" and select `/app/extension`
4. If already loaded, click the refresh icon to reload

### Step 2: Test TTS Functionality
1. Open the test page: `file:///app/extension/test-puter-tts.html`
2. Click "Test Puter TTS" - you should hear the Joanna voice
3. Try different voices from the dropdown
4. Adjust speed and test again

### Step 3: Test Real-time Speed
1. Click "Start (then adjust speed)" in section 3
2. While audio plays, move the speed slider
3. The speed should change IMMEDIATELY without restarting

### Step 4: Test on a Documentation Page
1. Navigate to any documentation site (e.g., https://developer.mozilla.org)
2. Click the LexiFlow extension icon
3. Click "Start Reading"
4. While reading:
   - Adjust speed slider → Should change in real-time
   - Change voice → Should apply on next sentence (not restart current)

## Troubleshooting

### "Puter TTS not working"
- Check browser console (F12) for errors
- Ensure you have internet connection (Puter uses cloud TTS)
- Try refreshing the page and extension

### "Only browser TTS works"
- Puter.js might not have loaded
- Check console for `[PuterTTS] Library loaded successfully`
- Fallback to browser TTS is automatic if Puter fails

### "Speed change restarts sentence"
- This should NOT happen with Puter TTS
- For browser TTS, speed only affects next sentence (browser limitation)

## Files Modified
- `/app/extension/content/puter-tts.js` - Puter TTS wrapper
- `/app/extension/content/content.js` - Main content script
- `/app/extension/popup/popup.js` - Popup UI logic
- `/app/extension/manifest.json` - Updated to v1.1.0
