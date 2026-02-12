/* LexiFlow Content Script - Runs on every page */

let isActive = false;
let isPlaying = false;
let currentSentenceIndex = 0;
let sentences = [];
let utterance = null;
let highlightedElement = null;
let currentSpeed = 1.0;
let currentVoice = 0;

console.log('[LexiFlow] Content script loaded on:', window.location.href);

// Extract text content from page
function extractContent() {
  console.log('[LexiFlow] Extracting content...');
  
  // Get main content (try common selectors first)
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
    '.markdown-body'
  ];

  let contentElement = null;
  for (const selector of mainSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) {
      console.log('[LexiFlow] Found content in:', selector);
      break;
    }
  }

  // Fallback to body if no main content found
  if (!contentElement) {
    console.log('[LexiFlow] Using body as fallback');
    contentElement = document.body;
  }

  // Get text content
  const walker = document.createTreeWalker(
    contentElement,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script, style, and hidden elements
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) {
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

  // Split into sentences
  const rawSentences = textContent.match(/[^.!?]+[.!?]+/g) || [];
  sentences = rawSentences
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.split(' ').length > 3); // Filter out very short sentences

  console.log('[LexiFlow] Extracted', sentences.length, 'sentences');
  return sentences;
}

// Find and highlight a sentence in the DOM
function highlightSentence(sentenceText) {
  // Remove previous highlight
  removeHighlight();

  if (!sentenceText) return;

  // Search for the sentence in the DOM
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent;
    // Check if this node contains our sentence (allowing for some variation)
    const searchText = sentenceText.substring(0, 50).trim();
    if (text.includes(searchText) || text.replace(/\s+/g, ' ').includes(searchText)) {
      const parent = node.parentElement;
      if (!parent) continue;

      // Create highlight overlay
      const rect = parent.getBoundingClientRect();
      if (rect.height === 0) continue; // Skip invisible elements

      const highlight = document.createElement('div');
      highlight.id = 'lexiflow-highlight';
      highlight.style.cssText = `
        position: absolute;
        left: ${rect.left + window.scrollX}px;
        top: ${rect.top + window.scrollY}px;
        width: ${rect.width}px;
        min-height: ${rect.height}px;
        background: linear-gradient(90deg, rgba(109, 40, 217, 0.2) 0%, rgba(0, 240, 255, 0.1) 100%);
        border-left: 4px solid #6D28D9;
        padding-left: 12px;
        pointer-events: none;
        z-index: 999999;
        animation: lexiflow-pulse 0.5s ease-in-out;
        box-shadow: 0 0 20px rgba(109, 40, 217, 0.3);
      `;

      document.body.appendChild(highlight);
      highlightedElement = highlight;

      // Scroll into view
      parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      break;
    }
  }
}

function removeHighlight() {
  if (highlightedElement) {
    highlightedElement.remove();
    highlightedElement = null;
  }
}

// Speak a sentence using browser TTS
function speakSentence(index, speed = 1.0, voiceIndex = 0) {
  console.log('[LexiFlow] Speaking sentence', index + 1, 'of', sentences.length);
  
  if (index >= sentences.length) {
    // Reached end
    console.log('[LexiFlow] Reached end of document');
    stopReading();
    return;
  }

  currentSentenceIndex = index;
  currentSpeed = speed;
  currentVoice = voiceIndex;
  const text = sentences[index];

  // Stop any current speech
  speechSynthesis.cancel();

  // Highlight this sentence
  highlightSentence(text);

  // Create new utterance
  utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  
  const voices = speechSynthesis.getVoices();
  if (voices[voiceIndex]) {
    utterance.voice = voices[voiceIndex];
  }

  utterance.onstart = () => {
    console.log('[LexiFlow] Started speaking');
  };

  utterance.onend = () => {
    console.log('[LexiFlow] Finished speaking');
    if (isPlaying) {
      // Auto-advance to next sentence
      setTimeout(() => {
        speakSentence(index + 1, speed, voiceIndex);
      }, 500);
    }
  };

  utterance.onerror = (e) => {
    console.error('[LexiFlow] TTS error:', e);
  };

  try {
    speechSynthesis.speak(utterance);
    console.log('[LexiFlow] Speech started');
  } catch (error) {
    console.error('[LexiFlow] Failed to speak:', error);
  }
  
  // Update popup
  sendStatusUpdate();
}

function stopReading() {
  speechSynthesis.cancel();
  isPlaying = false;
  removeHighlight();
  sendStatusUpdate();
}

function pauseReading() {
  speechSynthesis.cancel();
  isPlaying = false;
  sendStatusUpdate();
}

function sendStatusUpdate() {
  chrome.runtime.sendMessage({
    action: 'statusUpdate',
    status: {
      isActive: isActive,
      isPlaying: isPlaying,
      currentIndex: currentSentenceIndex,
      totalSentences: sentences.length
    }
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LexiFlow] Received message:', request.action);
  
  if (request.action === 'start') {
    console.log('[LexiFlow] Starting reading...');
    if (!isActive || sentences.length === 0) {
      // First time - extract content
      try {
        extractContent();
        if (sentences.length === 0) {
          console.error('[LexiFlow] No sentences found');
          sendResponse({ success: false, error: 'No content found on this page' });
          return true;
        }
        isActive = true;
        currentSentenceIndex = 0;
      } catch (error) {
        console.error('[LexiFlow] Extract error:', error);
        sendResponse({ success: false, error: error.message });
        return true;
      }
    }
    isPlaying = true;
    speakSentence(currentSentenceIndex, request.speed || 1.0, parseInt(request.voice) || 0);
    sendResponse({ success: true, sentences: sentences.length });
  }
  
  else if (request.action === 'pause') {
    console.log('[LexiFlow] Pausing...');
    pauseReading();
    sendResponse({ success: true });
  }
  
  else if (request.action === 'next') {
    console.log('[LexiFlow] Next sentence...');
    if (currentSentenceIndex < sentences.length - 1) {
      speechSynthesis.cancel();
      speakSentence(currentSentenceIndex + 1, currentSpeed, currentVoice);
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'prev') {
    console.log('[LexiFlow] Previous sentence...');
    if (currentSentenceIndex > 0) {
      speechSynthesis.cancel();
      speakSentence(currentSentenceIndex - 1, currentSpeed, currentVoice);
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'updateSpeed') {
    console.log('[LexiFlow] Updating speed to:', request.speed);
    currentSpeed = request.speed;
    if (utterance && isPlaying) {
      // Note: Cannot change speed of current utterance, will apply to next
      utterance.rate = request.speed;
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'getStatus') {
    const status = {
      isActive: isActive,
      isPlaying: isPlaying,
      currentIndex: currentSentenceIndex,
      totalSentences: sentences.length
    };
    console.log('[LexiFlow] Status:', status);
    sendResponse(status);
  }
  
  else if (request.action === 'getContent') {
    if (sentences.length === 0) {
      extractContent();
    }
    sendResponse({ content: sentences.join(' ') });
  }
  
  return true; // Keep channel open for async response
});

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes lexiflow-pulse {
    0% { opacity: 0; transform: translateX(-10px); }
    100% { opacity: 1; transform: translateX(0); }
  }
`;
document.head.appendChild(style);

console.log('LexiFlow extension loaded');
