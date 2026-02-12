let isPlaying = false;
let currentSentenceIndex = 0;
let totalSentences = 0;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if tab URL is valid for content scripts
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    document.getElementById('statusText').textContent = 'Cannot run on this page (browser internal page)';
    document.getElementById('playBtn').disabled = true;
    return;
  }
  
  // Load saved settings
  chrome.storage.sync.get(['speed', 'voice'], (result) => {
    if (result.speed) {
      document.getElementById('speedSlider').value = result.speed;
      document.getElementById('speedValue').textContent = result.speed + 'x';
    }
  });

  // Load voices
  loadVoices();

  // Check if reading is active on this page (with error handling)
  try {
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not loaded yet, that's ok
        console.log('Content script not loaded yet');
        return;
      }
      if (response) {
        updateStatus(response);
      }
    });
  } catch (error) {
    console.log('Error checking status:', error);
  }

  // Event listeners
  document.getElementById('playBtn').addEventListener('click', togglePlay);
  document.getElementById('prevBtn').addEventListener('click', () => navigate('prev'));
  document.getElementById('nextBtn').addEventListener('click', () => navigate('next'));
  document.getElementById('speedSlider').addEventListener('input', updateSpeed);
  document.getElementById('voiceSelect').addEventListener('change', updateVoice);
  document.getElementById('chatBtn').addEventListener('click', openChat);
});

function loadVoices() {
  const voiceSelect = document.getElementById('voiceSelect');
  const voices = speechSynthesis.getVoices();
  
  if (voices.length > 0) {
    voiceSelect.innerHTML = '';
    
    // Sort voices by quality (prioritize natural/premium voices)
    const sortedVoices = voices.sort((a, b) => {
      // Prioritize voices with these keywords (usually better quality)
      const qualityKeywords = ['enhanced', 'premium', 'natural', 'neural', 'google', 'microsoft'];
      const aScore = qualityKeywords.some(k => a.name.toLowerCase().includes(k)) ? 1 : 0;
      const bScore = qualityKeywords.some(k => b.name.toLowerCase().includes(k)) ? 1 : 0;
      
      if (aScore !== bScore) return bScore - aScore;
      
      // Prefer English voices
      if (a.lang.startsWith('en') && !b.lang.startsWith('en')) return -1;
      if (!a.lang.startsWith('en') && b.lang.startsWith('en')) return 1;
      
      return a.name.localeCompare(b.name);
    });
    
    sortedVoices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = index;
      
      // Mark recommended voices
      const isRecommended = voice.name.toLowerCase().includes('enhanced') || 
                           voice.name.toLowerCase().includes('premium') ||
                           voice.name.toLowerCase().includes('natural') ||
                           voice.name.toLowerCase().includes('neural') ||
                           (voice.name.toLowerCase().includes('google') && voice.lang.startsWith('en'));
      
      option.textContent = `${isRecommended ? '⭐ ' : ''}${voice.name} (${voice.lang})`;
      
      // Set default to first recommended voice
      if (isRecommended && voiceSelect.children.length === 0) {
        option.selected = true;
      }
      
      voiceSelect.appendChild(option);
    });
    
    // Save the sorted voice indices mapping
    window.lexiflowVoices = sortedVoices;
  } else {
    // Voices may not be loaded yet, try again
    speechSynthesis.addEventListener('voiceschanged', () => {
      loadVoices();
    });
  }
}

async function togglePlay() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const playBtn = document.getElementById('playBtn');
  
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    alert('Cannot run on this page. Please navigate to a regular webpage.');
    return;
  }
  
  if (isPlaying) {
    // Pause
    chrome.tabs.sendMessage(tab.id, { action: 'pause' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      }
    });
    playBtn.textContent = '▶ Continue';
    isPlaying = false;
  } else {
    // Play
    const speed = parseFloat(document.getElementById('speedSlider').value);
    const voice = document.getElementById('voiceSelect').value;
    
    chrome.tabs.sendMessage(tab.id, { 
      action: 'start',
      speed: speed,
      voice: voice
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error starting:', chrome.runtime.lastError);
        alert('Failed to start reading. Please refresh the page and try again.');
        return;
      }
      if (response && response.success) {
        playBtn.textContent = '⏸ Pause';
        isPlaying = true;
      }
    });
  }
}

async function navigate(direction) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: direction }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Navigation error:', chrome.runtime.lastError);
    }
  });
}

function updateSpeed(e) {
  const speed = e.target.value;
  document.getElementById('speedValue').textContent = speed + 'x';
  chrome.storage.sync.set({ speed: speed });
  
  // Update active reading if any
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'updateSpeed', speed: parseFloat(speed) }, () => {
        if (chrome.runtime.lastError) {
          // Ignore error if content script not loaded
        }
      });
    }
  });
}

function updateVoice(e) {
  const voice = e.target.value;
  chrome.storage.sync.set({ voice: voice });
}

function updateStatus(status) {
  const statusText = document.getElementById('statusText');
  const progress = document.getElementById('progress');
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('progressFill');
  const playBtn = document.getElementById('playBtn');

  if (status.isActive) {
    statusText.innerHTML = '<span class="status-active">● Reading this page</span>';
    progress.style.display = 'block';
    
    currentSentenceIndex = status.currentIndex;
    totalSentences = status.totalSentences;
    
    progressText.textContent = `${status.currentIndex + 1} / ${status.totalSentences} sentences`;
    const percent = ((status.currentIndex + 1) / status.totalSentences) * 100;
    progressFill.style.width = percent + '%';
    
    if (status.isPlaying) {
      playBtn.textContent = '⏸ Pause';
      isPlaying = true;
    } else {
      playBtn.textContent = '▶ Continue';
      isPlaying = false;
    }
  } else {
    statusText.textContent = 'Ready to read this page';
    progress.style.display = 'none';
    playBtn.textContent = '▶ Start Reading';
    isPlaying = false;
  }
}

async function openChat() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Extract page content
  chrome.tabs.sendMessage(tab.id, { action: 'getContent' }, async (response) => {
    if (chrome.runtime.lastError) {
      console.error('Chat error:', chrome.runtime.lastError);
      alert('Cannot access page content. Please refresh the page and try again.');
      return;
    }
    if (response && response.content) {
      // For now, just show an alert with preview
      alert('Chat feature coming soon! Document has ' + response.content.split(' ').length + ' words.');
    }
  });
}

// Listen for updates from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'statusUpdate') {
    updateStatus(request.status);
  }
  return true;
});