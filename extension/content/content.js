/* LexiFlow Content Script - Enhanced TTS with Real-time Controls */

let isActive = false;
let isPlaying = false;
let currentSentenceIndex = 0;
let sentences = [];
let currentSpeed = 1.0;
let currentVoice = 'Joanna';
let currentProvider = 'puter';
let highlightedElement = null;
let puterTTS = null;
let pendingVoiceChange = null; // For applying voice change after current sentence

console.log('[LexiFlow] Content script loaded on:', window.location.href);

// Initialize Puter TTS
if (typeof PuterTTS !== 'undefined') {
  puterTTS = new PuterTTS();
  puterTTS.load().then(() => {
    console.log('[LexiFlow] Puter TTS initialized');
  }).catch(err => {
    console.warn('[LexiFlow] Puter TTS not available, using browser TTS:', err);
    currentProvider = 'browser';
  });
} else {
  console.log('[LexiFlow] PuterTTS class not found, will use browser TTS');
  currentProvider = 'browser';
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
    '.post-content',
    '.prose'
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
        if (['script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer', 'header'].includes(tagName)) {
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

// Highlight sentence
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

// Play audio using Puter TTS
async function playWithPuterTTS(text, voiceId, speed) {
  try {
    console.log('[LexiFlow] Using Puter TTS:', voiceId, 'speed:', speed);
    
    if (!puterTTS || !(await puterTTS.isAvailable())) {
      console.warn('[LexiFlow] Puter TTS not available, falling back to browser');
      playWithBrowserTTS(text, speed);
      return;
    }
    
    await puterTTS.speak(text, voiceId, speed, handleAudioEnd);
    
  } catch (error) {
    console.error('[LexiFlow] Puter TTS failed:', error);
    // Fallback to browser TTS
    playWithBrowserTTS(text, speed);
  }
}

// Play audio using Browser TTS (fallback)
function playWithBrowserTTS(text, speed) {
  console.log('[LexiFlow] Using Browser TTS, speed:', speed);
  
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  
  // Get voices and apply sorting for best quality
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
  
  // Find matching voice
  if (typeof currentVoice === 'string' && currentVoice.startsWith('browser-')) {
    const voiceIndex = parseInt(currentVoice.replace('browser-', ''), 10);
    if (sortedVoices[voiceIndex]) {
      utterance.voice = sortedVoices[voiceIndex];
    }
  } else if (sortedVoices.length > 0) {
    // Use best available English voice
    const englishVoice = sortedVoices.find(v => v.lang.startsWith('en'));
    utterance.voice = englishVoice || sortedVoices[0];
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
  
  // Apply pending voice change if any
  if (pendingVoiceChange) {
    currentVoice = pendingVoiceChange.voice;
    if (pendingVoiceChange.provider) {
      currentProvider = pendingVoiceChange.provider;
    }
    pendingVoiceChange = null;
    console.log('[LexiFlow] Applied pending voice change:', currentVoice);
  }
  
  if (isPlaying && currentSentenceIndex < sentences.length - 1) {
    setTimeout(() => {
      currentSentenceIndex++;
      speakSentence(currentSentenceIndex);
    }, 300);
  } else if (currentSentenceIndex >= sentences.length - 1) {
    stopReading();
    console.log('[LexiFlow] Finished reading all content');
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
  
  console.log('[LexiFlow] Speaking sentence', index + 1, 'of', sentences.length, '| Provider:', currentProvider, '| Voice:', currentVoice);
  
  // Highlight
  highlightSentence(text);
  
  // Update floating controls
  updateFloatingControls();
  
  // Speak using selected provider
  if (currentProvider === 'puter' && puterTTS) {
    await playWithPuterTTS(text, currentVoice, currentSpeed);
  } else {
    playWithBrowserTTS(text, currentSpeed);
  }
  
  // Update popup
  sendStatusUpdate();
}

function stopReading() {
  // Stop browser TTS
  speechSynthesis.cancel();
  
  // Stop Puter TTS if active
  if (puterTTS) {
    puterTTS.stop();
  }
  
  isPlaying = false;
  removeHighlight();
  updateFloatingControls();
  sendStatusUpdate();
  console.log('[LexiFlow] Reading stopped');
}

function pauseReading() {
  if (currentProvider === 'puter' && puterTTS) {
    puterTTS.pause();
  } else {
    speechSynthesis.pause();
  }
  isPlaying = false;
  updateFloatingControls();
  sendStatusUpdate();
  console.log('[LexiFlow] Reading paused');
}

function resumeReading() {
  if (currentProvider === 'puter' && puterTTS && puterTTS.currentAudio) {
    puterTTS.resume();
    isPlaying = true;
  } else if (speechSynthesis.paused) {
    speechSynthesis.resume();
    isPlaying = true;
  } else {
    // If no paused audio, start fresh
    isPlaying = true;
    speakSentence(currentSentenceIndex);
  }
  updateFloatingControls();
  sendStatusUpdate();
  console.log('[LexiFlow] Reading resumed');
}

function sendStatusUpdate() {
  try {
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status: {
        isActive: isActive,
        isPlaying: isPlaying,
        currentIndex: currentSentenceIndex,
        totalSentences: sentences.length,
        provider: currentProvider,
        voice: currentVoice,
        speed: currentSpeed
      }
    });
  } catch (error) {
    // Ignore if popup is closed
  }
}

// Click to start from selection
document.addEventListener('mouseup', (e) => {
  if (!isActive) return;
  if (e.target.closest('#lexiflow-floating-controls')) return;
  
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length > 5) {
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
  if (puterTTS) {
    puterTTS.stop();
  }
}

// Message handler from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LexiFlow] Received message:', request.action);
  
  if (request.action === 'start') {
    if (!isActive || sentences.length === 0) {
      try {
        extractContent();
        if (sentences.length === 0) {
          sendResponse({ success: false, error: 'No content found on this page' });
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
    currentVoice = request.voice || 'Joanna';
    currentProvider = request.provider || 'puter';
    isPlaying = true;
    
    speakSentence(currentSentenceIndex);
    sendResponse({ success: true, sentences: sentences.length });
  }
  
  else if (request.action === 'pause') {
    pauseReading();
    sendResponse({ success: true });
  }
  
  else if (request.action === 'resume') {
    resumeReading();
    sendResponse({ success: true });
  }
  
  else if (request.action === 'stop') {
    stopReading();
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
  
  else if (request.action === 'updateSpeed') {
    currentSpeed = request.speed;
    console.log('[LexiFlow] Speed updated to:', currentSpeed);
    
    // Apply speed change in real-time without restarting
    if (currentProvider === 'puter' && puterTTS) {
      puterTTS.setRate(currentSpeed);
    }
    // For browser TTS, rate changes apply to next utterance (browser limitation)
    // But we don't restart the current one
    
    sendResponse({ success: true });
  }
  
  else if (request.action === 'updateVoice') {
    // Queue voice change for next sentence (don't interrupt current)
    if (isPlaying) {
      pendingVoiceChange = {
        voice: request.voice,
        provider: request.provider || currentProvider
      };
      console.log('[LexiFlow] Voice change queued for next sentence:', request.voice);
    } else {
      currentVoice = request.voice;
      if (request.provider) {
        currentProvider = request.provider;
      }
      console.log('[LexiFlow] Voice updated to:', currentVoice);
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'changeProvider') {
    if (isPlaying) {
      pendingVoiceChange = {
        voice: currentVoice,
        provider: request.provider
      };
      console.log('[LexiFlow] Provider change queued:', request.provider);
    } else {
      currentProvider = request.provider;
      console.log('[LexiFlow] Provider changed to:', currentProvider);
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'getStatus') {
    sendResponse({
      isActive: isActive,
      isPlaying: isPlaying,
      currentIndex: currentSentenceIndex,
      totalSentences: sentences.length,
      provider: currentProvider,
      voice: currentVoice,
      speed: currentSpeed
    });
  }
  
  else if (request.action === 'getVoices') {
    const voices = [];
    
    // Add Puter TTS voices
    if (puterTTS) {
      const puterVoices = puterTTS.getVoices();
      puterVoices.forEach(v => {
        voices.push({
          id: v.id,
          name: v.name,
          provider: 'puter',
          locale: v.locale,
          gender: v.gender
        });
      });
    }
    
    // Add browser voices
    const browserVoices = speechSynthesis.getVoices();
    browserVoices
      .filter(v => v.lang.startsWith('en'))
      .forEach((v, i) => {
        voices.push({
          id: `browser-${i}`,
          name: v.name,
          provider: 'browser',
          locale: v.lang
        });
      });
    
    sendResponse({ voices });
  }
  
  return true;
});

// Floating Controls UI
function createFloatingControls() {
  const container = document.createElement('div');
  container.id = 'lexiflow-floating-controls';
  container.innerHTML = `
    <div class="lexiflow-logo" title="LexiFlow">
      <svg width="28" height="28" viewBox="0 0 32 32">
        <defs>
          <linearGradient id="lexiflow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6D28D9"/>
            <stop offset="100%" style="stop-color:#00F0FF"/>
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14" fill="url(#lexiflow-grad)"/>
        <path d="M 11 16 L 14 19 L 21 12" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="lexiflow-controls-panel">
      <div class="lexiflow-progress" id="lexiflow-progress-text">0 / 0</div>
      <div class="lexiflow-buttons">
        <button id="lexiflow-prev" title="Previous sentence">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
          </svg>
        </button>
        <button id="lexiflow-play" title="Play/Pause">
          <svg id="lexiflow-play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        <button id="lexiflow-next" title="Next sentence">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zm8.5 0h2V6h-2v12z"/>
          </svg>
        </button>
        <button id="lexiflow-close" title="Close LexiFlow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  // Event listeners
  container.querySelector('#lexiflow-prev').addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentSentenceIndex > 0) {
      stopCurrentPlayback();
      currentSentenceIndex--;
      if (isPlaying) speakSentence(currentSentenceIndex);
      else {
        highlightSentence(sentences[currentSentenceIndex]);
        updateFloatingControls();
      }
    }
  });
  
  container.querySelector('#lexiflow-play').addEventListener('click', (e) => {
    e.stopPropagation();
    if (isPlaying) {
      pauseReading();
    } else {
      resumeReading();
    }
  });
  
  container.querySelector('#lexiflow-next').addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentSentenceIndex < sentences.length - 1) {
      stopCurrentPlayback();
      currentSentenceIndex++;
      if (isPlaying) speakSentence(currentSentenceIndex);
      else {
        highlightSentence(sentences[currentSentenceIndex]);
        updateFloatingControls();
      }
    }
  });
  
  container.querySelector('#lexiflow-close').addEventListener('click', (e) => {
    e.stopPropagation();
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
  const playIcon = controls.querySelector('#lexiflow-play-icon');
  const playBtn = controls.querySelector('#lexiflow-play');
  
  if (progressText) {
    progressText.textContent = `${currentSentenceIndex + 1} / ${sentences.length}`;
  }
  
  if (playIcon && playBtn) {
    if (isPlaying) {
      playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
      playBtn.title = 'Pause';
    } else {
      playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      playBtn.title = 'Play';
    }
  }
}

// Add styles
const style = document.createElement('style');
style.textContent = `
  @keyframes lexiflow-pulse {
    0% { opacity: 0; transform: translateX(-20px) scale(0.98); }
    100% { opacity: 1; transform: translateX(0) scale(1); }
  }
  
  @keyframes lexiflow-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(109, 40, 217, 0.4); }
    50% { box-shadow: 0 0 30px rgba(109, 40, 217, 0.6), 0 0 40px rgba(0, 240, 255, 0.3); }
  }
  
  #lexiflow-highlight {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  #lexiflow-floating-controls {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transform: translateY(100px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  #lexiflow-floating-controls.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  
  .lexiflow-logo {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(109, 40, 217, 0.4), 0 0 0 1px rgba(109, 40, 217, 0.3);
    cursor: pointer;
    transition: all 0.2s ease;
    animation: lexiflow-glow 3s ease-in-out infinite;
  }
  
  .lexiflow-logo:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 30px rgba(109, 40, 217, 0.6);
  }
  
  .lexiflow-controls-panel {
    background: rgba(10, 10, 20, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(109, 40, 217, 0.3);
    border-radius: 16px;
    padding: 12px 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  
  .lexiflow-progress {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    margin-bottom: 8px;
    font-weight: 500;
    letter-spacing: 0.5px;
  }
  
  .lexiflow-buttons {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  
  .lexiflow-buttons button {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }
  
  .lexiflow-buttons button:hover {
    background: rgba(109, 40, 217, 0.3);
    border-color: rgba(109, 40, 217, 0.5);
    transform: scale(1.05);
  }
  
  .lexiflow-buttons button:active {
    transform: scale(0.95);
  }
  
  #lexiflow-play {
    background: linear-gradient(135deg, #6D28D9, #7C3AED);
    border-color: transparent;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(109, 40, 217, 0.4);
  }
  
  #lexiflow-play:hover {
    background: linear-gradient(135deg, #7C3AED, #8B5CF6);
    transform: scale(1.08);
    box-shadow: 0 4px 15px rgba(109, 40, 217, 0.5);
  }
  
  #lexiflow-close {
    background: rgba(255, 255, 255, 0.05);
  }
  
  #lexiflow-close:hover {
    background: rgba(220, 38, 38, 0.4);
    border-color: rgba(220, 38, 38, 0.6);
  }
`;
document.head.appendChild(style);

console.log('[LexiFlow] Extension ready');
console.log('[LexiFlow] 💡 Click any sentence to start reading from there');

// Notify background script
chrome.runtime.sendMessage({ action: 'contentScriptLoaded', url: window.location.href }, () => {
  if (chrome.runtime.lastError) {
    // Ignore
  }
});
