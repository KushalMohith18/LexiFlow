/* LexiFlow Content Script - Multi-Provider TTS with Audiobook Narration */

// State management
const state = {
  isActive: false,
  isPlaying: false,
  isPaused: false,
  currentSentenceIndex: 0,
  sentences: [],
  speed: 1.0,
  voice: 'Joanna',
  provider: 'puter',
  pendingVoiceChange: null,
  highlightElement: null
};

// TTS Providers
let puterTTS = null;
let sarvamTTS = null;
let currentAudio = null; // Track current audio element globally

// Sarvam API Key
const SARVAM_API_KEY = 'sk_jskshbhw_yh51ve4TLQEvERGAqRGw1XHE';

console.log('[LexiFlow] Content script loaded');

// Initialize TTS providers
function initProviders() {
  if (typeof PuterTTS !== 'undefined') {
    puterTTS = new PuterTTS();
    puterTTS.load().then(() => {
      console.log('[LexiFlow] Puter TTS ready');
    }).catch(err => {
      console.warn('[LexiFlow] Puter TTS failed:', err);
    });
  }
  
  if (typeof SarvamTTS !== 'undefined') {
    sarvamTTS = new SarvamTTS(SARVAM_API_KEY);
    console.log('[LexiFlow] Sarvam TTS ready');
  }
}

// Initialize on load
initProviders();

// Extract page content
function extractContent() {
  console.log('[LexiFlow] Extracting content...');
  
  const selectors = [
    'main', 'article', '[role="main"]', '.content', '.main-content',
    '#content', '.documentation', '.docs-content', '.markdown-body', '.prose'
  ];

  let contentEl = null;
  for (const sel of selectors) {
    contentEl = document.querySelector(sel);
    if (contentEl) break;
  }
  contentEl = contentEl || document.body;

  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }
      const style = window.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let text = '';
  let node;
  while (node = walker.nextNode()) {
    const t = node.textContent.trim();
    if (t.length > 0) text += t + ' ';
  }

  const raw = text.match(/[^.!?]+[.!?]+/g) || [];
  state.sentences = raw.map(s => s.trim()).filter(s => s.length > 10 && s.split(' ').length > 2);
  
  console.log('[LexiFlow] Found', state.sentences.length, 'sentences');
  return state.sentences;
}

// Highlight current sentence
function highlight(text) {
  removeHighlight();
  if (!text) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node;
  
  while (node = walker.nextNode()) {
    const content = node.textContent;
    const search = text.substring(0, 50).trim();
    
    if (content.includes(search) || content.replace(/\s+/g, ' ').includes(search)) {
      const parent = node.parentElement;
      if (!parent) continue;
      
      const rect = parent.getBoundingClientRect();
      if (rect.height === 0) continue;

      const el = document.createElement('div');
      el.id = 'lexiflow-highlight';
      el.style.cssText = `
        position: absolute;
        left: ${rect.left + window.scrollX}px;
        top: ${rect.top + window.scrollY}px;
        width: ${rect.width}px;
        min-height: ${rect.height}px;
        background: linear-gradient(90deg, rgba(109, 40, 217, 0.3) 0%, rgba(0, 240, 255, 0.15) 100%);
        border-left: 4px solid #6D28D9;
        pointer-events: none;
        z-index: 999998;
        border-radius: 4px;
        transition: all 0.2s ease;
      `;
      document.body.appendChild(el);
      state.highlightElement = el;

      // Scroll to eye level
      const targetY = rect.top + window.scrollY - (window.innerHeight / 3);
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      break;
    }
  }
}

function removeHighlight() {
  if (state.highlightElement) {
    state.highlightElement.remove();
    state.highlightElement = null;
  }
}

// Stop all audio playback
function stopAllAudio() {
  // Stop Puter TTS
  if (puterTTS) {
    puterTTS.stop();
  }
  
  // Stop Sarvam TTS
  if (sarvamTTS) {
    sarvamTTS.stop();
  }
  
  // Stop browser TTS
  speechSynthesis.cancel();
  
  // Stop any tracked audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

// Pause audio
function pauseAudio() {
  state.isPaused = true;
  state.isPlaying = false;
  
  if (state.provider === 'puter' && puterTTS && puterTTS.currentAudio) {
    puterTTS.currentAudio.pause();
  } else if (state.provider === 'sarvam' && sarvamTTS && sarvamTTS.currentAudio) {
    sarvamTTS.currentAudio.pause();
  } else if (state.provider === 'browser') {
    speechSynthesis.pause();
  }
  
  if (currentAudio) {
    currentAudio.pause();
  }
  
  updateUI();
  console.log('[LexiFlow] Paused');
}

// Resume audio
function resumeAudio() {
  state.isPaused = false;
  state.isPlaying = true;
  
  let resumed = false;
  
  if (state.provider === 'puter' && puterTTS && puterTTS.currentAudio && puterTTS.currentAudio.paused) {
    puterTTS.currentAudio.play();
    resumed = true;
  } else if (state.provider === 'sarvam' && sarvamTTS && sarvamTTS.currentAudio && sarvamTTS.currentAudio.paused) {
    sarvamTTS.currentAudio.play();
    resumed = true;
  } else if (state.provider === 'browser' && speechSynthesis.paused) {
    speechSynthesis.resume();
    resumed = true;
  }
  
  if (currentAudio && currentAudio.paused) {
    currentAudio.play();
    resumed = true;
  }
  
  // If nothing to resume, start speaking current sentence
  if (!resumed) {
    speakSentence(state.currentSentenceIndex);
  }
  
  updateUI();
  console.log('[LexiFlow] Resumed');
}

// Update playback speed in real-time
function updateSpeed(newSpeed) {
  state.speed = newSpeed;
  
  // Apply to current audio immediately
  if (puterTTS && puterTTS.currentAudio) {
    puterTTS.currentAudio.playbackRate = newSpeed;
  }
  if (sarvamTTS && sarvamTTS.currentAudio) {
    sarvamTTS.currentAudio.playbackRate = newSpeed;
  }
  if (currentAudio) {
    currentAudio.playbackRate = newSpeed;
  }
  // Browser TTS rate is set per utterance, can't change mid-speech
  
  console.log('[LexiFlow] Speed updated to:', newSpeed);
}

// Queue voice change for next sentence
function updateVoice(newVoice, newProvider) {
  if (state.isPlaying && !state.isPaused) {
    // Queue for next sentence
    state.pendingVoiceChange = { voice: newVoice, provider: newProvider || state.provider };
    console.log('[LexiFlow] Voice change queued:', newVoice);
  } else {
    // Apply immediately
    state.voice = newVoice;
    if (newProvider) state.provider = newProvider;
    console.log('[LexiFlow] Voice changed to:', newVoice);
  }
}

// Apply pending voice change
function applyPendingChanges() {
  if (state.pendingVoiceChange) {
    state.voice = state.pendingVoiceChange.voice;
    state.provider = state.pendingVoiceChange.provider;
    state.pendingVoiceChange = null;
    console.log('[LexiFlow] Applied pending voice:', state.voice);
  }
}

// Handle sentence completion
function onSentenceEnd() {
  console.log('[LexiFlow] Sentence', state.currentSentenceIndex + 1, 'completed');
  
  // Apply any pending voice changes
  applyPendingChanges();
  
  if (state.isPlaying && state.currentSentenceIndex < state.sentences.length - 1) {
    // Short pause between sentences for natural audiobook feel
    setTimeout(() => {
      state.currentSentenceIndex++;
      speakSentence(state.currentSentenceIndex);
    }, 350);
  } else if (state.currentSentenceIndex >= state.sentences.length - 1) {
    // Finished all sentences
    state.isPlaying = false;
    state.isPaused = false;
    removeHighlight();
    updateUI();
    console.log('[LexiFlow] Finished reading');
  }
}

// Speak using Puter TTS
async function speakWithPuter(text) {
  try {
    if (!puterTTS || !(await puterTTS.isAvailable())) {
      throw new Error('Puter TTS not available');
    }
    
    await puterTTS.speak(text, state.voice, state.speed, onSentenceEnd);
    currentAudio = puterTTS.currentAudio;
    
  } catch (error) {
    console.error('[LexiFlow] Puter TTS error:', error);
    // Fallback to browser
    speakWithBrowser(text);
  }
}

// Speak using Sarvam TTS
async function speakWithSarvam(text) {
  try {
    if (!sarvamTTS || !(await sarvamTTS.isAvailable())) {
      throw new Error('Sarvam TTS not available');
    }
    
    await sarvamTTS.speak(text, state.voice, state.speed, onSentenceEnd);
    currentAudio = sarvamTTS.currentAudio;
    
  } catch (error) {
    console.error('[LexiFlow] Sarvam TTS error:', error);
    // Fallback to browser
    speakWithBrowser(text);
  }
}

// Speak using Browser TTS
function speakWithBrowser(text) {
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = state.speed;
  
  // Get best voice
  const voices = speechSynthesis.getVoices();
  const sorted = voices.sort((a, b) => {
    const keywords = ['enhanced', 'premium', 'natural', 'neural', 'google', 'microsoft'];
    const aScore = keywords.some(k => a.name.toLowerCase().includes(k)) ? 1 : 0;
    const bScore = keywords.some(k => b.name.toLowerCase().includes(k)) ? 1 : 0;
    if (aScore !== bScore) return bScore - aScore;
    if (a.lang.startsWith('en') && !b.lang.startsWith('en')) return -1;
    if (!a.lang.startsWith('en') && b.lang.startsWith('en')) return 1;
    return 0;
  });
  
  if (state.voice && state.voice.startsWith('browser-')) {
    const idx = parseInt(state.voice.replace('browser-', ''), 10);
    if (sorted[idx]) utterance.voice = sorted[idx];
  } else if (sorted.length > 0) {
    utterance.voice = sorted.find(v => v.lang.startsWith('en')) || sorted[0];
  }
  
  utterance.onend = onSentenceEnd;
  utterance.onerror = (e) => {
    console.error('[LexiFlow] Browser TTS error:', e);
    onSentenceEnd();
  };
  
  speechSynthesis.speak(utterance);
}

// Main speak function
async function speakSentence(index) {
  if (index < 0 || index >= state.sentences.length) {
    console.log('[LexiFlow] Invalid index:', index);
    return;
  }

  state.currentSentenceIndex = index;
  state.isPaused = false;
  const text = state.sentences[index];
  
  console.log('[LexiFlow] Speaking', index + 1, '/', state.sentences.length, '| Provider:', state.provider, '| Voice:', state.voice);
  
  highlight(text);
  updateUI();
  
  // Route to appropriate TTS provider
  if (state.provider === 'sarvam' && sarvamTTS) {
    await speakWithSarvam(text);
  } else if (state.provider === 'puter' && puterTTS) {
    await speakWithPuter(text);
  } else {
    speakWithBrowser(text);
  }
}

// Start reading
function startReading(options = {}) {
  if (state.sentences.length === 0) {
    extractContent();
    if (state.sentences.length === 0) {
      return { success: false, error: 'No content found' };
    }
  }
  
  state.isActive = true;
  state.isPlaying = true;
  state.isPaused = false;
  state.speed = options.speed || state.speed;
  state.voice = options.voice || state.voice;
  state.provider = options.provider || state.provider;
  
  if (!state.isActive) {
    state.currentSentenceIndex = 0;
  }
  
  showFloatingControls();
  speakSentence(state.currentSentenceIndex);
  
  return { success: true, sentences: state.sentences.length };
}

// Stop reading
function stopReading() {
  stopAllAudio();
  state.isPlaying = false;
  state.isPaused = false;
  removeHighlight();
  updateUI();
}

// Navigate sentences
function navigate(direction) {
  stopAllAudio();
  
  if (direction === 'prev' && state.currentSentenceIndex > 0) {
    state.currentSentenceIndex--;
  } else if (direction === 'next' && state.currentSentenceIndex < state.sentences.length - 1) {
    state.currentSentenceIndex++;
  }
  
  highlight(state.sentences[state.currentSentenceIndex]);
  
  if (state.isPlaying) {
    speakSentence(state.currentSentenceIndex);
  }
  
  updateUI();
}

// Update UI elements
function updateUI() {
  updateFloatingControls();
  sendStatusUpdate();
}

function sendStatusUpdate() {
  try {
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status: {
        isActive: state.isActive,
        isPlaying: state.isPlaying,
        isPaused: state.isPaused,
        currentIndex: state.currentSentenceIndex,
        totalSentences: state.sentences.length,
        provider: state.provider,
        voice: state.voice,
        speed: state.speed
      }
    });
  } catch (e) {}
}

// Click to start from selection
document.addEventListener('mouseup', (e) => {
  if (!state.isActive) return;
  if (e.target.closest('#lexiflow-floating-controls')) return;
  
  const selection = window.getSelection().toString().trim();
  const clickText = selection.length > 5 ? selection : (e.target.textContent || '').trim();
  
  if (clickText.length < 10) return;
  
  const searchLengths = [80, 50, 30, 20];
  let matchIdx = -1;
  
  for (const len of searchLengths) {
    const search = clickText.substring(0, len).toLowerCase();
    matchIdx = state.sentences.findIndex(s => 
      s.toLowerCase().includes(search) || search.includes(s.substring(0, len).toLowerCase())
    );
    if (matchIdx !== -1) break;
  }
  
  if (matchIdx !== -1) {
    stopAllAudio();
    state.currentSentenceIndex = matchIdx;
    
    if (state.isPlaying) {
      speakSentence(matchIdx);
    } else {
      highlight(state.sentences[matchIdx]);
      updateUI();
    }
  }
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LexiFlow] Message:', request.action);
  
  switch (request.action) {
    case 'start':
      const result = startReading({
        speed: request.speed,
        voice: request.voice,
        provider: request.provider
      });
      sendResponse(result);
      break;
      
    case 'pause':
      pauseAudio();
      sendResponse({ success: true });
      break;
      
    case 'resume':
      resumeAudio();
      sendResponse({ success: true });
      break;
      
    case 'stop':
      stopReading();
      sendResponse({ success: true });
      break;
      
    case 'next':
      navigate('next');
      sendResponse({ success: true });
      break;
      
    case 'prev':
      navigate('prev');
      sendResponse({ success: true });
      break;
      
    case 'updateSpeed':
      updateSpeed(request.speed);
      sendResponse({ success: true });
      break;
      
    case 'updateVoice':
      updateVoice(request.voice, request.provider);
      sendResponse({ success: true });
      break;
      
    case 'changeProvider':
      updateVoice(state.voice, request.provider);
      sendResponse({ success: true });
      break;
      
    case 'getStatus':
      sendResponse({
        isActive: state.isActive,
        isPlaying: state.isPlaying,
        isPaused: state.isPaused,
        currentIndex: state.currentSentenceIndex,
        totalSentences: state.sentences.length,
        provider: state.provider,
        voice: state.voice,
        speed: state.speed
      });
      break;
      
    case 'getVoices':
      const voices = [];
      
      // Sarvam voices
      if (sarvamTTS) {
        sarvamTTS.getVoices().forEach(v => {
          voices.push({ ...v, provider: 'sarvam' });
        });
      }
      
      // Puter voices
      if (puterTTS) {
        puterTTS.getVoices().forEach(v => {
          voices.push({ ...v, provider: 'puter' });
        });
      }
      
      // Browser voices
      speechSynthesis.getVoices()
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
      break;
  }
  
  return true;
});

// Floating Controls
function createFloatingControls() {
  const el = document.createElement('div');
  el.id = 'lexiflow-floating-controls';
  el.innerHTML = `
    <div class="lf-panel">
      <div class="lf-progress" id="lf-progress">0 / 0</div>
      <div class="lf-buttons">
        <button id="lf-prev" title="Previous">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/></svg>
        </button>
        <button id="lf-play" class="lf-play-btn" title="Play/Pause">
          <svg id="lf-play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button id="lf-next" title="Next">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5 0h2V6h-2v12z"/></svg>
        </button>
        <button id="lf-close" title="Close">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  
  el.querySelector('#lf-prev').onclick = (e) => { e.stopPropagation(); navigate('prev'); };
  el.querySelector('#lf-next').onclick = (e) => { e.stopPropagation(); navigate('next'); };
  el.querySelector('#lf-close').onclick = (e) => { 
    e.stopPropagation(); 
    stopReading();
    state.isActive = false;
    hideFloatingControls();
  };
  
  el.querySelector('#lf-play').onclick = (e) => {
    e.stopPropagation();
    if (state.isPlaying && !state.isPaused) {
      pauseAudio();
    } else {
      resumeAudio();
    }
  };
}

function showFloatingControls() {
  let el = document.getElementById('lexiflow-floating-controls');
  if (!el) {
    createFloatingControls();
    el = document.getElementById('lexiflow-floating-controls');
  }
  el.classList.add('visible');
  updateFloatingControls();
}

function hideFloatingControls() {
  const el = document.getElementById('lexiflow-floating-controls');
  if (el) el.classList.remove('visible');
}

function updateFloatingControls() {
  const el = document.getElementById('lexiflow-floating-controls');
  if (!el) return;
  
  const progress = el.querySelector('#lf-progress');
  const playIcon = el.querySelector('#lf-play-icon');
  
  if (progress) {
    progress.textContent = `${state.currentSentenceIndex + 1} / ${state.sentences.length}`;
  }
  
  if (playIcon) {
    if (state.isPlaying && !state.isPaused) {
      playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    } else {
      playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    }
  }
}

// Styles
const style = document.createElement('style');
style.textContent = `
  #lexiflow-floating-controls {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    opacity: 0;
    transform: translateY(100px);
    transition: all 0.3s ease;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }
  #lexiflow-floating-controls.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  .lf-panel {
    background: rgba(10, 10, 20, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(109, 40, 217, 0.4);
    border-radius: 16px;
    padding: 12px 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .lf-progress {
    font-size: 11px;
    color: rgba(255,255,255,0.6);
    text-align: center;
    margin-bottom: 8px;
  }
  .lf-buttons {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .lf-buttons button {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fff;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .lf-buttons button:hover {
    background: rgba(109, 40, 217, 0.4);
    border-color: rgba(109, 40, 217, 0.6);
  }
  .lf-buttons button svg {
    width: 16px;
    height: 16px;
  }
  .lf-play-btn {
    background: linear-gradient(135deg, #6D28D9, #7C3AED) !important;
    border: none !important;
    width: 44px !important;
    height: 44px !important;
    border-radius: 10px !important;
  }
  .lf-play-btn:hover {
    background: linear-gradient(135deg, #7C3AED, #8B5CF6) !important;
    transform: scale(1.05);
  }
  .lf-play-btn svg {
    width: 20px !important;
    height: 20px !important;
  }
  #lf-close:hover {
    background: rgba(220, 38, 38, 0.5) !important;
    border-color: rgba(220, 38, 38, 0.7) !important;
  }
`;
document.head.appendChild(style);

console.log('[LexiFlow] Ready - Click any text to start reading from there');

// Notify background
chrome.runtime.sendMessage({ action: 'contentScriptLoaded', url: window.location.href }, () => {
  if (chrome.runtime.lastError) {}
});
