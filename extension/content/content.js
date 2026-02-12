/* LexiFlow Content Script - Runs on every page */

let isActive = false;
let isPlaying = false;
let currentSentenceIndex = 0;
let sentences = [];
let utterance = null;
let highlightedElement = null;

// Extract text content from page
function extractContent() {
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
    '.docs-content'
  ];

  let contentElement = null;
  for (const selector of mainSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) break;
  }

  // Fallback to body if no main content found
  if (!contentElement) {
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
  if (index >= sentences.length) {
    // Reached end
    stopReading();
    return;
  }

  currentSentenceIndex = index;
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

  utterance.onend = () => {
    if (isPlaying) {
      // Auto-advance to next sentence
      setTimeout(() => {
        speakSentence(index + 1, speed, voiceIndex);
      }, 500);
    }
  };

  utterance.onerror = (e) => {
    console.error('LexiFlow TTS error:', e);
  };

  speechSynthesis.speak(utterance);
  
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
  if (request.action === 'start') {
    if (!isActive || sentences.length === 0) {
      // First time - extract content
      extractContent();
      isActive = true;
      currentSentenceIndex = 0;
    }
    isPlaying = true;
    speakSentence(currentSentenceIndex, request.speed || 1.0, parseInt(request.voice) || 0);
    sendResponse({ success: true });
  }
  
  else if (request.action === 'pause') {
    pauseReading();
    sendResponse({ success: true });
  }
  
  else if (request.action === 'next') {
    if (currentSentenceIndex < sentences.length - 1) {
      speechSynthesis.cancel();
      speakSentence(currentSentenceIndex + 1, request.speed || 1.0, parseInt(request.voice) || 0);
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'prev') {
    if (currentSentenceIndex > 0) {
      speechSynthesis.cancel();
      speakSentence(currentSentenceIndex - 1, request.speed || 1.0, parseInt(request.voice) || 0);
    }
    sendResponse({ success: true });
  }
  
  else if (request.action === 'updateSpeed') {
    if (utterance) {
      utterance.rate = request.speed;
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
  
  else if (request.action === 'getContent') {
    if (sentences.length === 0) {
      extractContent();
    }
    sendResponse({ content: sentences.join(' ') });
  }
  
  return true;
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
