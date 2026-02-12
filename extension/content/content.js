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

// Listen for text selection/click to start from that point
document.addEventListener('mouseup', (e) => {
  if (!isActive && !isPlaying) return; // Only work when extension is active
  
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText.length > 10) {
    // User selected text - find which sentence it's in
    console.log('[LexiFlow] User selected text:', selectedText.substring(0, 50));
    findAndStartFromSelection(selectedText);
  } else {
    // User clicked without selecting - find clicked element's text
    const clickedElement = e.target;
    if (clickedElement && clickedElement.textContent) {
      const clickedText = clickedElement.textContent.trim();
      if (clickedText.length > 10) {
        console.log('[LexiFlow] User clicked element');
        findAndStartFromSelection(clickedText);
      }
    }
  }
});

// Find sentence containing selected text and start from there
function findAndStartFromSelection(selectedText) {
  if (sentences.length === 0) {
    console.log('[LexiFlow] No sentences extracted yet');
    return;
  }
  
  // Find which sentence contains this text
  const matchIndex = sentences.findIndex(sentence => 
    sentence.includes(selectedText.substring(0, 50)) ||
    selectedText.includes(sentence.substring(0, 50))
  );
  
  if (matchIndex !== -1) {
    console.log('[LexiFlow] Found matching sentence at index:', matchIndex);
    currentSentenceIndex = matchIndex;
    
    if (isPlaying) {
      // If already playing, jump to this sentence
      speechSynthesis.cancel();
      speakSentence(matchIndex, currentSpeed, currentVoice);
    } else {
      // Just highlight it
      highlightSentence(sentences[matchIndex]);
      sendStatusUpdate();
    }
  }
}

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
  let found = false;
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
        background: linear-gradient(90deg, rgba(109, 40, 217, 0.25) 0%, rgba(0, 240, 255, 0.15) 100%);
        border-left: 5px solid #6D28D9;
        padding-left: 12px;
        pointer-events: none;
        z-index: 999999;
        animation: lexiflow-pulse 0.4s ease-in-out;
        box-shadow: 0 0 30px rgba(109, 40, 217, 0.4), inset 0 0 20px rgba(0, 240, 255, 0.1);
        border-radius: 4px;
      `;

      document.body.appendChild(highlight);
      highlightedElement = highlight;

      // Improved scroll: Keep at eye level (1/3 from top for comfortable reading)
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
    console.log('[LexiFlow] Could not find sentence in DOM for highlighting');
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
    0% { 
      opacity: 0; 
      transform: translateX(-20px) scale(0.98);
      filter: brightness(1);
    }
    50% {
      filter: brightness(1.1);
    }
    100% { 
      opacity: 1; 
      transform: translateX(0) scale(1);
      filter: brightness(1);
    }
  }
  
  #lexiflow-highlight {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;
document.head.appendChild(style);

console.log('[LexiFlow] Extension loaded and ready on:', window.location.hostname);
console.log('[LexiFlow] 💡 Tip: Click or select any text to start reading from that sentence');

// Notify background that content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptLoaded', url: window.location.href }, () => {
  if (chrome.runtime.lastError) {
    // Ignore error if background script isn't listening
  }
});
