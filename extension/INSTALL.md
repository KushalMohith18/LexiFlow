# LexiFlow Extension - Installation Guide

## ✅ Extension Ready to Install!

All files are present and icons are created. Follow these steps:

---

## For Chrome/Edge/Brave

### Step 1: Open Extensions Page
- **Method 1**: Type `chrome://extensions/` in address bar
- **Method 2**: Menu → More Tools → Extensions

### Step 2: Enable Developer Mode
- Look for "Developer mode" toggle in the top-right corner
- Click to enable it

### Step 3: Load Extension
1. Click "Load unpacked" button
2. Navigate to and select this folder: `/app/extension`
3. Click "Select Folder"

### Step 4: Pin Extension (Optional)
1. Click the puzzle icon in toolbar
2. Find "LexiFlow - Documentation Reader"
3. Click the pin icon to keep it visible

---

## For Firefox

### Step 1: Open Debugging Page
- Type `about:debugging#/runtime/this-firefox` in address bar

### Step 2: Load Temporary Add-on
1. Click "Load Temporary Add-on" button
2. Navigate to `/app/extension`
3. Select the `manifest.json` file
4. Click "Open"

**Note**: Temporary add-ons in Firefox are removed when you close the browser.

---

## Testing the Extension

### Quick Test:
1. Navigate to: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
2. Click the LexiFlow extension icon in your toolbar
3. Click "▶ Start Reading"
4. Watch it highlight and read the documentation!

### Test Controls:
- **Play/Pause**: Toggle reading
- **⏮ Previous**: Go to previous sentence
- **⏭ Next**: Go to next sentence
- **Speed Slider**: Adjust reading speed (0.5x - 2x)
- **Voice Selector**: Choose different voices

---

## Troubleshooting

### "Could not load icon" error
✅ **FIXED**: Icons are now properly created in `/app/extension/icons/`

### Extension not visible after loading
- Make sure Developer mode is enabled
- Check for error messages in the extensions page
- Try reloading the extension

### No voices in dropdown
- Voices load asynchronously - wait a few seconds
- Restart your browser if voices don't appear
- Check browser TTS support: Open console and type `speechSynthesis.getVoices()`

### Extension not working on some pages
- Some pages (like chrome:// URLs) don't allow extensions for security
- Try on documentation sites like docs.python.org, reactjs.org, etc.

---

## What Happens After Installation

1. Extension icon appears in toolbar (purple gradient icon)
2. Navigate to any documentation page
3. Click extension icon to open popup
4. Click "Start Reading" to begin
5. Text highlights as it reads line-by-line!

---

## File Structure

```
/app/extension/
├── manifest.json           # Extension config
├── popup/
│   ├── popup.html         # Control panel UI
│   └── popup.js           # Control logic
├── content/
│   ├── content.js         # Runs on pages (highlighting, TTS)
│   └── content.css        # Highlight styles
├── background/
│   └── background.js      # Service worker
├── icons/
│   ├── icon16.png         # ✅ Created
│   ├── icon48.png         # ✅ Created
│   └── icon128.png        # ✅ Created
└── README.md              # Full documentation
```

---

## Next Steps

After installation:
1. Test on Kubernetes docs (provided URL)
2. Try on your favorite documentation sites
3. Adjust speed and voice to your preference
4. Enjoy hands-free documentation reading!

---

**Need Help?** Check `/app/extension/README.md` for detailed usage guide.
