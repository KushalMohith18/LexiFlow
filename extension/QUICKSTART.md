# 🚀 LexiFlow Extension - Quick Start Guide

## ✅ What's New (v1.1)

- **High-Quality TTS**: New Puter.js integration provides neural-quality voices
- **Improved UI**: Better floating controls with smooth animations
- **Click-to-Start**: Click any sentence to begin reading from there
- **Auto-scroll**: Keeps the current sentence at eye level

## ✅ Pre-Installation Checklist

All files ready:
- ✅ manifest.json
- ✅ popup/ (HTML + JS)
- ✅ content/ (injection script with Puter TTS)
- ✅ background/ (service worker)
- ✅ icons/ (16px, 48px, 128px PNG)
- ✅ test.html (local test page)
- ✅ test-puter-tts.html (TTS test page)

---

## 📦 Installation Steps

### For Chrome/Edge/Brave

1. **Open Extensions Page**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle switch in top-right corner

3. **Load Extension**
   - Click "Load unpacked"
   - Select folder: `/app/extension`
   - Click "Select Folder"

4. **Verify Installation**
   - Look for "LexiFlow - Documentation Reader" in the list
   - Icon should appear in toolbar
   - No errors should be shown

### For Firefox

1. **Open Debugging Page**
   ```
   about:debugging#/runtime/this-firefox
   ```

2. **Load Add-on**
   - Click "Load Temporary Add-on"
   - Navigate to `/app/extension`
   - Select `manifest.json`

3. **Verify Installation**
   - Extension should appear in the list
   - Icon in toolbar (may need to click puzzle icon to see it)

---

## 🧪 Testing the Extension

### Method 1: Local Test Page

1. **Open test page in browser:**
   ```
   file:///app/extension/test.html
   ```

2. **Click LexiFlow icon** in toolbar

3. **Click "▶ Start Reading"**

4. **Verify:**
   - ✅ Text highlights as it reads
   - ✅ Page scrolls to keep text visible
   - ✅ Audio plays (you hear the voice)
   - ✅ Progress counter updates (1/20, 2/20, etc.)

### Method 2: Live Documentation

1. **Navigate to Kubernetes docs:**
   ```
   https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
   ```

2. **Click LexiFlow icon**

3. **Click "▶ Start Reading"**

4. **Verify same features as above**

---

## 🎮 Using the Controls

### Popup Panel

- **▶ Start Reading**: Begin reading from current position
- **⏸ Pause**: Pause reading (keeps position)
- **⏮ Previous**: Go to previous sentence
- **⏭ Next**: Go to next sentence
- **TTS Provider**: Choose between High Quality TTS (Puter.js) or Browser TTS
- **Voice**: Select from high-quality neural voices or browser voices
- **Speed Slider**: Adjust reading speed (0.5x - 2.5x)

### Floating Controls (On-Page)

A floating widget appears on the page while reading:
- **Play/Pause**: Quick toggle
- **Previous/Next**: Navigate sentences
- **Close**: Stop reading and hide controls
- **Progress**: Shows current sentence number

### What You'll See

1. **Status**: Shows if extension is active
2. **Progress**: Sentence counter (e.g., "5 / 201 sentences")
3. **Progress Bar**: Visual indicator
4. **Highlighting**: Purple gradient on current sentence
5. **Auto-scroll**: Page follows highlighted text

---

## 🔍 Troubleshooting

### Issue: "Could not load icon"
**Status:** ✅ FIXED - Icons created properly

### Issue: Extension popup shows "Cannot run on this page"
**Cause:** You're on a browser internal page (chrome://, about:, etc.)
**Solution:** Navigate to a regular webpage first

### Issue: TTS not working / No audio
**Solutions:**
1. Try switching TTS Provider in the popup (High Quality TTS vs Browser TTS)
2. Check system volume is not muted
3. Verify browser has audio permission
4. Open test-puter-tts.html to test TTS directly:
   ```
   file:///app/extension/test-puter-tts.html
   ```

### Issue: No voices in dropdown
**Solution 1:** Wait a few seconds - voices load asynchronously
**Solution 2:** Restart browser
**Solution 3:** Switch to "Browser TTS" provider for offline voices

### Issue: "Failed to start reading"
**Possible causes:**
1. **Page not fully loaded** - Wait for page to load completely
2. **Content script not injected** - Refresh the page
3. **No text content** - Page might be empty or all images

**Solutions:**
- Refresh the page (F5)
- Reload the extension
- Check browser console for errors (F12 → Console)

### Issue: Extension not working on some sites
**Expected behavior:** Some sites block extensions:
- ✅ Works: docs.python.org, react.dev, kubernetes.io, wikipedia.org
- ❌ Blocked: chrome://, chrome-extension://, some banking sites

### Issue: Highlighting not accurate
**Causes:**
- Dynamic content loading
- Heavy JavaScript frameworks
- Complex page structure

**Solutions:**
- Refresh page after content loads
- Try after page is fully rendered
- Works best on documentation sites

### Issue: Can't hear audio
**Check:**
1. System volume is not muted
2. Browser has permission to use audio
3. TTS is supported: `speechSynthesis.speak(new SpeechSynthesisUtterance('test'))`

---

## 📊 Debug Mode

### Enable Console Logging

1. Open DevTools (F12)
2. Go to Console tab
3. Look for `[LexiFlow]` messages

**Expected logs:**
```
[LexiFlow] Content script loaded on: kubernetes.io
[LexiFlow] Extracting content...
[LexiFlow] Found content in: main
[LexiFlow] Extracted 201 sentences
[LexiFlow] Received message: start
[LexiFlow] Starting reading...
[LexiFlow] Speaking sentence 1 of 201
[LexiFlow] Started speaking
```

### Check Extension Status

**Chrome:**
```
chrome://extensions/ → LexiFlow → Details → Inspect views
```

**Firefox:**
```
about:debugging → LexiFlow → Inspect
```

---

## ✅ Success Criteria

Extension is working correctly if:

1. ✅ Icon loads without errors
2. ✅ Popup opens when clicked
3. ✅ "Start Reading" button works
4. ✅ Text highlights as audio plays
5. ✅ Page auto-scrolls to highlighted text
6. ✅ Progress counter updates
7. ✅ Play/Pause/Next/Previous controls work
8. ✅ Speed slider changes reading speed
9. ✅ Works on multiple websites

---

## 🔄 Reloading Extension

If you make changes or encounter issues:

**Chrome:**
1. Go to `chrome://extensions/`
2. Find LexiFlow
3. Click refresh icon (⟳)

**Firefox:**
1. Go to `about:debugging`
2. Find LexiFlow
3. Click "Reload"

---

## 📝 Known Limitations

1. **Cannot run on browser internal pages** (chrome://, about:)
2. **Some sites block extensions** (rare, security reasons)
3. **Works best on text-heavy pages** (documentation, articles)
4. **Speech speed change applies to next sentence** (browser limitation)
5. **Temporary in Firefox** (removed when browser closes)

---

## 🎯 Best Sites to Test

✅ **Documentation:**
- https://kubernetes.io/docs/
- https://react.dev/learn
- https://docs.python.org/3/tutorial/
- https://developer.mozilla.org/en-US/

✅ **Articles:**
- https://en.wikipedia.org/wiki/JavaScript
- Any blog or article site

✅ **Local test:**
- file:///app/extension/test.html

---

## 💡 Tips for Best Experience

1. **Wait for page to fully load** before clicking "Start Reading"
2. **Refresh page if extraction fails** (rare cases with dynamic content)
3. **Try different voices** - some are more natural than others
4. **Adjust speed to your preference** - 1.2x is often comfortable
5. **Works great with documentation sites** - designed for technical content

---

## 🆘 Still Having Issues?

1. **Check console logs** (F12 → Console)
2. **Verify all files exist** in `/app/extension/`
3. **Reload extension** after any changes
4. **Test on local test.html** first
5. **Try a different browser** (Chrome vs Firefox)

---

## 📞 Getting Help

If extension still doesn't work:

1. **Capture error messages** from console
2. **Note which page you're testing on**
3. **Check if test.html works**
4. **Provide browser version**

---

**Extension Location:** `/app/extension/`
**Test Page:** `file:///app/extension/test.html`
**Size:** 80KB (12 files)

🎉 **Enjoy hands-free documentation reading!**
