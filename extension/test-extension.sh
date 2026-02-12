#!/bin/bash

echo "==================================="
echo "  LexiFlow Extension - Quick Test"
echo "==================================="
echo ""
echo "Extension location: /app/extension"
echo ""
echo "INSTALLATION INSTRUCTIONS:"
echo ""
echo "For Chrome/Edge:"
echo "1. Open chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle top-right)"
echo "3. Click 'Load unpacked'"
echo "4. Select: /app/extension"
echo "5. Pin extension to toolbar"
echo ""
echo "For Firefox:"
echo "1. Open about:debugging#/runtime/this-firefox"
echo "2. Click 'Load Temporary Add-on'"
echo "3. Select: /app/extension/manifest.json"
echo ""
echo "TESTING:"
echo "1. Navigate to: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/"
echo "2. Click LexiFlow extension icon"
echo "3. Click 'Start Reading'"
echo "4. Watch it highlight and read!"
echo ""
echo "==================================="
echo ""

# Verify all files exist
echo "Checking extension files..."
files=(
  "/app/extension/manifest.json"
  "/app/extension/popup/popup.html"
  "/app/extension/popup/popup.js"
  "/app/extension/content/content.js"
  "/app/extension/content/content.css"
  "/app/extension/background/background.js"
  "/app/extension/README.md"
)

all_ok=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ MISSING: $file"
    all_ok=false
  fi
done

if [ "$all_ok" = true ]; then
  echo ""
  echo "✓ All files present! Extension ready to install."
  echo ""
  echo "Extension size:"
  du -sh /app/extension
else
  echo ""
  echo "✗ Some files missing!"
fi
