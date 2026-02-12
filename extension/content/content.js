/* LexiFlow Content Script - Enhanced with Edge TTS */

let isActive = false;
let isPlaying = false;
let currentSentenceIndex = 0;
let sentences = [];
let currentSpeed = 1.0;
let currentVoice = 'en-US-JennyNeural';
let currentProvider = 'edge';
let highlightedElement = null;
let audioElement = null;
let edgeTTS = null;

console.log('[LexiFlow] Content script loaded on:', window.location.href);

// Initialize Edge TTS
if (typeof EdgeTTS !== 'undefined') {
  edgeTTS = new EdgeTTS();
  console.log('[LexiFlow] Edge TTS initialized');
}

// Extract text content from page
function extractContent() {
  console.log('[LexiFlow] Extracting content...');
  
  const mainSelectors = [
    'main',
    'article', 
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '.article-content',
    '.documentation',
    '.docs-content',
    '.markdown-body',
    '.post-content'
  ];

  let contentElement = null;
  for (const selector of mainSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) {
      console.log('[LexiFlow] Found content in:', selector);
      break;
    }
  }

  if (!contentElement) {
    console.log('[LexiFlow] Using body as fallback');
    contentElement = document.body;
  }

  const walker = document.createTreeWalker(
    contentElement,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let textContent = '';
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text.length > 0) {
      textContent += text + ' ';
    }
  }

  // Better sentence splitting
  const rawSentences = textContent.match(/[^.!?]+[.!?]+/g) || [];
  sentences = rawSentences
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.split(' ').length > 2);

  console.log('[LexiFlow] Extracted', sentences.length, 'sentences');
  return sentences;
}

// Highlight sentence with improved positioning
function highlightSentence(sentenceText) {
  removeHighlight();
  if (!sentenceText) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  let found = false;
  while (node = walker.nextNode()) {
    const text = node.textContent;
    const searchText = sentenceText.substring(0, 50).trim();
    
    if (text.includes(searchText) || text.replace(/\s+/g, ' ').includes(searchText)) {
      const parent = node.parentElement;
      if (!parent) continue;

      const rect = parent.getBoundingClientRect();
      if (rect.height === 0) continue;

      const highlight = document.createElement('div');
      highlight.id = 'lexiflow-highlight';
      highlight.style.cssText = `
        position: absolute;
        left: ${rect.left + window.scrollX}px;
        top: ${rect.top + window.scrollY}px;
        width: ${rect.width}px;
        min-height: ${rect.height}px;
        background: linear-gradient(90deg, rgba(109, 40, 217, 0.25) 0%, rgba(0, 240, 255, 0.15) 100%);
        border-left: 5px solid #6D28D9;
        padding-left: 12px;
        pointer-events: none;
        z-index: 999998;
        animation: lexiflow-pulse 0.4s ease-in-out;
        box-shadow: 0 0 30px rgba(109, 40, 217, 0.4), inset 0 0 20px rgba(0, 240, 255, 0.1);
        border-radius: 4px;
      `;

      document.body.appendChild(highlight);
      highlightedElement = highlight;

      // Scroll to eye level (1/3 from top)
      const viewportHeight = window.innerHeight;
      const targetPosition = rect.top + window.scrollY - (viewportHeight / 3);
      
      window.scrollTo({
        top: Math.max(0, targetPosition),
        behavior: 'smooth'
      });
      
      console.log('[LexiFlow] Highlighted and scrolled to sentence');
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.log('[LexiFlow] Could not find sentence in DOM');
  }
}

function removeHighlight() {
  if (highlightedElement) {
    highlightedElement.remove();
    highlightedElement = null;
  }
}

// Play audio using Edge TTS
async function playWithEdgeTTS(text, voiceName, speed) {
  try {
    console.log('[LexiFlow] Using Edge TTS:', voiceName);
    
    const audioBlob = await edgeTTS.synthesize(text, voiceName, speed);
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Create or reuse audio element
    if (!audioElement) {
      audioElement = new Audio();
    }
    
    audioElement.src = audioUrl;
    audioElement.onended = handleAudioEnd;
    audioElement.onerror = (e) => {
      console.error('[LexiFlow] Edge TTS audio error:', e);
      // Fallback to browser TTS
      playWithBrowserTTS(text, speed);
    };
    
    await audioElement.play();
    console.log('[LexiFlow] Edge TTS playback started');
    
  } catch (error) {
    console.error('[LexiFlow] Edge TTS failed:', error);
    // Fallback to browser TTS
    playWithBrowserTTS(text, speed);
  }
}

// Play audio using Browser TTS
function playWithBrowserTTS(text, speed) {
  console.log('[LexiFlow] Using Browser TTS');
  
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  
  // Get voices and apply sorting
  const voices = speechSynthesis.getVoices();
  const sortedVoices = voices.sort((a, b) => {
    const qualityKeywords = ['enhanced', 'premium', 'natural', 'neural', 'google', 'microsoft'];
    const aScore = qualityKeywords.some(k => a.name.toLowerCase().includes(k)) ? 1 : 0;
    const bScore = qualityKeywords.some(k => b.name.toLowerCase().includes(k)) ? 1 : 0;
    if (aScore !== bScore) return bScore - aScore;
    if (a.lang.startsWith('en') && !b.lang.startsWith('en')) return -1;
    if (!a.lang.startsWith('en') && b.lang.startsWith('en')) return 1;
    return a.name.localeCompare(b.name);
  });
  
  if (sortedVoices[currentVoice]) {
    utterance.voice = sortedVoices[currentVoice];
  }
  
  utterance.onend = handleAudioEnd;
  utterance.onerror = (e) => {
    console.error('[LexiFlow] Browser TTS error:', e);
  };
  
  speechSynthesis.speak(utterance);
}

// Handle audio end
function handleAudioEnd() {
  console.log('[LexiFlow] Finished speaking sentence', currentSentenceIndex + 1);
  
  if (isPlaying && currentSentenceIndex < sentences.length - 1) {
    setTimeout(() => {
      currentSentenceIndex++;
      speakSentence(currentSentenceIndex);
    }, 500);
  } else if (currentSentenceIndex >= sentences.length - 1) {
    stopReading();
  }
}

// Main speak function
async function speakSentence(index) {
  if (index >= sentences.length || index < 0) {
    console.log('[LexiFlow] Invalid sentence index:', index);
    return;
  }

  currentSentenceIndex = index;
  const text = sentences[index];
  
  console.log('[LexiFlow] Speaking sentence', index + 1, 'of', sentences.length);
  
  // Highlight
  highlightSentence(text);
  
  // Update floating controls
  updateFloatingControls();
  
  // Speak
  if (currentProvider === 'edge' && edgeTTS) {
    await playWithEdgeTTS(text, currentVoice, currentSpeed);
  } else {
    playWithBrowserTTS(text, currentSpeed);
  }
  
  // Update popup
  sendStatusUpdate();
}

function stopReading() {
  speechSynthesis.cancel();
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
  }
  isPlaying = false;
  removeHighlight();
  updateFloatingControls();
  sendStatusUpdate();
  console.log('[LexiFlow] Reading stopped');
}

function pauseReading() {
  speechSynthesis.cancel();
  if (audioElement) {
    audioElement.pause();
  }
  isPlaying = false;
  updateFloatingControls();
  sendStatusUpdate();
  console.log('[LexiFlow] Reading paused');
}

function sendStatusUpdate() {
  try {
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status: {
        isActive: isActive,
        isPlaying: isPlaying,
        currentIndex: currentSentenceIndex,
        totalSentences: sentences.length
      }
    });
  } catch (error) {
    // Ignore if popup is closed
  }
}

// Improved text selection
document.addEventListener('mouseup', (e) => {
  if (!isActive) return;
  
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length > 5) {
    console.log('[LexiFlow] User selected text:', selectedText.substring(0, 50));
    findAndStartFromSelection(selectedText);
  } else {
    const clickedElement = e.target;
    if (clickedElement && clickedElement.textContent) {
      const clickedText = clickedElement.textContent.trim();
      if (clickedText.length > 20) {
        findAndStartFromSelection(clickedText);
      }
    }
  }
});

function findAndStartFromSelection(selectedText) {
  if (sentences.length === 0) return;
  
  // Improved matching - check multiple lengths
  const searchLengths = [100, 50, 30, 20];
  let matchIndex = -1;
  
  for (const len of searchLengths) {
    const searchText = selectedText.substring(0, len).trim().toLowerCase();
    matchIndex = sentences.findIndex(sentence => 
      sentence.toLowerCase().includes(searchText) ||
      searchText.includes(sentence.substring(0, len).trim().toLowerCase())
    );
    if (matchIndex !== -1) break;
  }
  
  if (matchIndex !== -1) {
    console.log('[LexiFlow] Found matching sentence at index:', matchIndex);
    currentSentenceIndex = matchIndex;
    
    if (isPlaying) {
      stopCurrentPlayback();
      speakSentence(matchIndex);
    } else {
      highlightSentence(sentences[matchIndex]);
      updateFloatingControls();
      sendStatusUpdate();
    }
  }
}

function stopCurrentPlayback() {
  speechSynthesis.cancel();
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LexiFlow] Received message:', request.action);
  
  if (request.action === 'start') {
    if (!isActive || sentences.length === 0) {
      try {
        extractContent();
        if (sentences.length === 0) {
          sendResponse({ success: false, error: 'No content found' });
          return true;
        }
        isActive = true;
        currentSentenceIndex = 0;
        showFloatingControls();
      } catch (error) {
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }
    
    currentSpeed = request.speed || 1.0;
    currentVoice = request.voice || 'en-US-JennyNeural';
    currentProvider = request.provider || 'edge';
    isPlaying = true;
    
    speakSentence(currentSentenceIndex);
    sendResponse({ success: true, sentences: sentences.length });
  }
  
  else if (request.action === 'pause') {
    pauseReading();
    sendResponse({ success: true });
  }
  
  else if (request.action === 'next') {
    if (currentSentenceIndex < sentences.length - 1) {
      stopCurrentPlayback();
      currentSentenceIndex++;
      if (isPlaying) {
        speakSentence(currentSentenceIndex);
      } else {
        highlightSentence(sentences[currentSentenceIndex]);
        updateFloatingControls();
      }
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'prev') {
    if (currentSentenceIndex > 0) {
      stopCurrentPlayback();
      currentSentenceIndex--;
      if (isPlaying) {
        speakSentence(currentSentenceIndex);
      } else {
        highlightSentence(sentences[currentSentenceIndex]);
        updateFloatingControls();
      }
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'updateSpeed' && request.immediate) {
    currentSpeed = request.speed;
    if (isPlaying) {
      stopCurrentPlayback();
      speakSentence(currentSentenceIndex);
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'updateVoice' && request.immediate) {
    currentVoice = request.voice;
    currentProvider = request.provider || currentProvider;
    if (isPlaying) {
      stopCurrentPlayback();
      speakSentence(currentSentenceIndex);
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'changeProvider') {
    currentProvider = request.provider;
    if (isPlaying) {
      stopCurrentPlayback();
      speakSentence(currentSentenceIndex);
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'getStatus') {
    sendResponse({
      isActive: isActive,
      isPlaying: isPlaying,
      currentIndex: currentSentenceIndex,
      totalSentences: sentences.length
    });
  }
  
  return true;
});

// Floating Controls UI
function createFloatingControls() {
  const container = document.createElement('div');
  container.id = 'lexiflow-floating-controls';
  container.innerHTML = `
    <div class="lexiflow-logo">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" fill="#6D28D9"/>
        <path d="M 10 16 L 14 20 L 22 12" stroke="#00F0FF" stroke-width="2" fill="none"/>
      </svg>
    </div>
    <div class="lexiflow-controls-panel">
      <div class="lexiflow-progress" id="lexiflow-progress-text">0 / 0</div>
      <div class="lexiflow-buttons">
        <button id="lexiflow-prev" title="Previous">⏮</button>
        <button id="lexiflow-play" title="Play/Pause">▶</button>
        <button id="lexiflow-next" title="Next">⏭</button>
        <button id="lexiflow-close" title="Close">✕</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  // Event listeners
  container.querySelector('#lexiflow-prev').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'navigate', direction: 'prev' });
    if (currentSentenceIndex > 0) {
      stopCurrentPlayback();
      currentSentenceIndex--;
      if (isPlaying) speakSentence(currentSentenceIndex);
      else highlightSentence(sentences[currentSentenceIndex]);
    }
  });
  
  container.querySelector('#lexiflow-play').addEventListener('click', () => {
    if (isPlaying) {
      pauseReading();
    } else {
      isPlaying = true;
      speakSentence(currentSentenceIndex);
    }
    updateFloatingControls();
  });
  
  container.querySelector('#lexiflow-next').addEventListener('click', () => {
    if (currentSentenceIndex < sentences.length - 1) {
      stopCurrentPlayback();
      currentSentenceIndex++;
      if (isPlaying) speakSentence(currentSentenceIndex);
      else highlightSentence(sentences[currentSentenceIndex]);
    }
  });
  
  container.querySelector('#lexiflow-close').addEventListener('click', () => {
    hideFloatingControls();
    stopReading();
    isActive = false;
  });
}

function showFloatingControls() {
  let controls = document.getElementById('lexiflow-floating-controls');
  if (!controls) {
    createFloatingControls();
    controls = document.getElementById('lexiflow-floating-controls');
  }
  controls.classList.add('visible');
  updateFloatingControls();
}

function hideFloatingControls() {
  const controls = document.getElementById('lexiflow-floating-controls');
  if (controls) {
    controls.classList.remove('visible');
  }
}

function updateFloatingControls() {
  const controls = document.getElementById('lexiflow-floating-controls');
  if (!controls) return;
  
  const progressText = controls.querySelector('#lexiflow-progress-text');
  const playBtn = controls.querySelector('#lexiflow-play');
  
  if (progressText) {
    progressText.textContent = `${currentSentenceIndex + 1} / ${sentences.length}`;
  }
  
  if (playBtn) {
    playBtn.textContent = isPlaying ? '⏸' : '▶';
    playBtn.title = isPlaying ? 'Pause' : 'Play';
  }
}

// Add styles
const style = document.createElement('style');
style.textContent = `
  @keyframes lexiflow-pulse {
    0% { 
      opacity: 0; 
      transform: translateX(-20px) scale(0.98);
    }
    100% { 
      opacity: 1; 
      transform: translateX(0) scale(1);
    }
  }
  
  #lexiflow-highlight {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  #lexiflow-floating-controls {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transform: translateY(100px);
    transition: all 0.3s ease-in-out;
    pointer-events: none;
  }
  
  #lexiflow-floating-controls.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  
  .lexiflow-logo {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #6D28D9, #00F0FF);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(109, 40, 217, 0.4);
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .lexiflow-logo:hover {
    transform: scale(1.1);
  }
  
  .lexiflow-controls-panel {
    background: rgba(10, 10, 10, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(109, 40, 217, 0.3);
    border-radius: 16px;
    padding: 12px 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  
  .lexiflow-progress {
    font-size: 12px;
    color: #aaa;
    text-align: center;
    margin-bottom: 8px;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  .lexiflow-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .lexiflow-buttons button {
    background: #1a1a1a;
    border: 1px solid #333;
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .lexiflow-buttons button:hover {
    background: #6D28D9;
    border-color: #6D28D9;
    transform: scale(1.05);
  }
  
  .lexiflow-buttons button:active {
    transform: scale(0.95);
  }
  
  #lexiflow-play {
    background: #6D28D9;
    border-color: #6D28D9;
    width: 40px;
    height: 40px;
    font-size: 16px;
  }
  
  #lexiflow-close {
    background: #333;
  }
  
  #lexiflow-close:hover {
    background: #d32f2f;
    border-color: #d32f2f;
  }
`;
document.head.appendChild(style);

console.log('[LexiFlow] Extension ready with floating controls');
console.log('[LexiFlow] 💡 Tip: Click any text to start reading from there');

// Notify background
chrome.runtime.sendMessage({ action: 'contentScriptLoaded', url: window.location.href }, () => {
  if (chrome.runtime.lastError) {
    // Ignore
  }
});
