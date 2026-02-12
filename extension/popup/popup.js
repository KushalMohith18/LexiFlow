let isPlaying = false;
let currentSentenceIndex = 0;
let totalSentences = 0;
let currentProvider = 'puter';

// Puter TTS voice options (high quality cloud voices)
const puterVoices = [
  { id: 'en-US-Wavenet-D', name: 'Dylan (US Neural)', locale: 'en-US', quality: 'high' },
  { id: 'en-US-Wavenet-C', name: 'Clara (US Neural)', locale: 'en-US', quality: 'high' },
  { id: 'en-US-Wavenet-A', name: 'Aria (US Neural)', locale: 'en-US', quality: 'high' },
  { id: 'en-US-Wavenet-B', name: 'Blake (US Neural)', locale: 'en-US', quality: 'high' },
  { id: 'en-GB-Wavenet-A', name: 'Eleanor (UK Neural)', locale: 'en-GB', quality: 'high' },
  { id: 'en-GB-Wavenet-B', name: 'Henry (UK Neural)', locale: 'en-GB', quality: 'high' },
  { id: 'en-US-Standard-D', name: 'David (US Standard)', locale: 'en-US', quality: 'standard' },
  { id: 'en-US-Standard-C', name: 'Chloe (US Standard)', locale: 'en-US', quality: 'standard' },
  { id: 'en-US-Standard-A', name: 'Amy (US Standard)', locale: 'en-US', quality: 'standard' },
  { id: 'en-US-Standard-B', name: 'Brian (US Standard)', locale: 'en-US', quality: 'standard' },
  { id: 'en-GB-Standard-A', name: 'Emma (UK Standard)', locale: 'en-GB', quality: 'standard' },
  { id: 'en-GB-Standard-B', name: 'Harry (UK Standard)', locale: 'en-GB', quality: 'standard' },
  { id: 'en-AU-Standard-A', name: 'Olivia (AU Standard)', locale: 'en-AU', quality: 'standard' },
  { id: 'en-AU-Standard-B', name: 'Jack (AU Standard)', locale: 'en-AU', quality: 'standard' },
];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if tab URL is valid for content scripts
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    document.getElementById('statusText').textContent = 'Cannot run on this page';
    document.getElementById('playBtn').disabled = true;
    document.getElementById('statusText').innerHTML = '<span style="color: #f87171;">⚠ Cannot run on browser internal pages</span>';
    return;
  }
  
  // Load saved settings
  chrome.storage.sync.get(['speed', 'voice', 'ttsProvider'], (result) => {
    if (result.speed) {
      document.getElementById('speedSlider').value = result.speed;
      document.getElementById('speedValue').textContent = result.speed + 'x';
    }
    if (result.ttsProvider) {
      currentProvider = result.ttsProvider;
      document.getElementById('ttsProvider').value = result.ttsProvider;
    }
    // Load voice after settings are loaded
    loadVoices().then(() => {
      if (result.voice) {
        document.getElementById('voiceSelect').value = result.voice;
      }
    });
  });

  // Check if reading is active on this page
  try {
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError) {
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
  document.getElementById('ttsProvider').addEventListener('change', changeTTSProvider);
});

async function loadVoices() {
  const voiceSelect = document.getElementById('voiceSelect');
  const provider = document.getElementById('ttsProvider').value;
  
  voiceSelect.innerHTML = '<option value="">Loading voices...</option>';
  
  if (provider === 'puter') {
    // Load Puter TTS voices (high quality)
    voiceSelect.innerHTML = '';
    
    // Add high-quality voices first
    const highQuality = puterVoices.filter(v => v.quality === 'high');
    const standard = puterVoices.filter(v => v.quality === 'standard');
    
    if (highQuality.length > 0) {
      const optGroup1 = document.createElement('optgroup');
      optGroup1.label = '⭐ High Quality (Neural)';
      highQuality.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = `${voice.name} (${voice.locale})`;
        if (index === 0) option.selected = true;
        optGroup1.appendChild(option);
      });
      voiceSelect.appendChild(optGroup1);
    }
    
    if (standard.length > 0) {
      const optGroup2 = document.createElement('optgroup');
      optGroup2.label = 'Standard Quality';
      standard.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = `${voice.name} (${voice.locale})`;
        optGroup2.appendChild(option);
      });
      voiceSelect.appendChild(optGroup2);
    }
    
    console.log('[LexiFlow] Loaded', puterVoices.length, 'Puter TTS voices');
    
  } else {
    // Load Browser TTS voices
    let voices = speechSynthesis.getVoices();
    
    // If voices not ready, wait for them
    if (voices.length === 0) {
      await new Promise(resolve => {
        speechSynthesis.addEventListener('voiceschanged', () => {
          voices = speechSynthesis.getVoices();
          resolve();
        }, { once: true });
        // Timeout fallback
        setTimeout(resolve, 500);
      });
      voices = speechSynthesis.getVoices();
    }
    
    if (voices.length > 0) {
      // Sort voices by quality
      const sortedVoices = voices.sort((a, b) => {
        const qualityKeywords = ['enhanced', 'premium', 'natural', 'neural', 'google', 'microsoft'];
        const aScore = qualityKeywords.some(k => a.name.toLowerCase().includes(k)) ? 1 : 0;
        const bScore = qualityKeywords.some(k => b.name.toLowerCase().includes(k)) ? 1 : 0;
        
        if (aScore !== bScore) return bScore - aScore;
        if (a.lang.startsWith('en') && !b.lang.startsWith('en')) return -1;
        if (!a.lang.startsWith('en') && b.lang.startsWith('en')) return 1;
        return a.name.localeCompare(b.name);
      });
      
      voiceSelect.innerHTML = '';
      
      // Group English voices
      const englishVoices = sortedVoices.filter(v => v.lang.startsWith('en'));
      const otherVoices = sortedVoices.filter(v => !v.lang.startsWith('en'));
      
      if (englishVoices.length > 0) {
        const optGroupEn = document.createElement('optgroup');
        optGroupEn.label = 'English Voices';
        englishVoices.forEach((voice, index) => {
          const option = document.createElement('option');
          option.value = `browser-${sortedVoices.indexOf(voice)}`;
          const isRecommended = ['enhanced', 'premium', 'natural', 'neural'].some(k => 
            voice.name.toLowerCase().includes(k)
          );
          option.textContent = `${isRecommended ? '⭐ ' : ''}${voice.name}`;
          optGroupEn.appendChild(option);
        });
        voiceSelect.appendChild(optGroupEn);
      }
      
      if (otherVoices.length > 0) {
        const optGroupOther = document.createElement('optgroup');
        optGroupOther.label = 'Other Languages';
        otherVoices.slice(0, 20).forEach((voice) => {
          const option = document.createElement('option');
          option.value = `browser-${sortedVoices.indexOf(voice)}`;
          option.textContent = `${voice.name} (${voice.lang})`;
          optGroupOther.appendChild(option);
        });
        voiceSelect.appendChild(optGroupOther);
      }
      
      console.log('[LexiFlow] Loaded', sortedVoices.length, 'browser TTS voices');
    } else {
      voiceSelect.innerHTML = '<option value="">No browser voices available</option>';
    }
  }
}

async function changeTTSProvider(e) {
  currentProvider = e.target.value;
  chrome.storage.sync.set({ ttsProvider: currentProvider });
  await loadVoices();
  
  // Update status text
  const providerName = currentProvider === 'puter' ? 'High-Quality TTS' : 'Browser TTS';
  console.log('[LexiFlow] Switched to', providerName);
  
  // Notify content script to change provider
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'changeProvider',
        provider: currentProvider
      }, () => {
        if (chrome.runtime.lastError) {
          console.log('Could not change provider in content script');
        }
      });
    }
  });
}

async function togglePlay() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const playBtn = document.getElementById('playBtn');
  
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
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
    playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Continue';
    isPlaying = false;
  } else {
    // Play
    const speed = parseFloat(document.getElementById('speedSlider').value);
    const voice = document.getElementById('voiceSelect').value;
    const provider = document.getElementById('ttsProvider').value;
    
    playBtn.innerHTML = '<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg> Starting...';
    
    chrome.tabs.sendMessage(tab.id, { 
      action: 'start',
      speed: speed,
      voice: voice,
      provider: provider
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error starting:', chrome.runtime.lastError);
        playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Start Reading';
        alert('Failed to start reading. Please refresh the page and try again.');
        return;
      }
      if (response && response.success) {
        playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
        isPlaying = true;
        document.getElementById('statusText').innerHTML = '<span class="status-active">● Reading ' + response.sentences + ' sentences</span>';
      } else if (response && response.error) {
        playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Start Reading';
        alert(response.error);
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
  const speed = parseFloat(e.target.value);
  document.getElementById('speedValue').textContent = speed.toFixed(1) + 'x';
  chrome.storage.sync.set({ speed: speed });
  
  // Update active reading IMMEDIATELY
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateSpeed', 
        speed: speed,
        immediate: true
      }, () => {
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
  
  // Update active reading IMMEDIATELY with new voice
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateVoice',
        voice: voice,
        provider: currentProvider,
        immediate: true
      }, () => {
        if (chrome.runtime.lastError) {
          // Ignore error
        }
      });
    }
  });
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
      playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
      isPlaying = true;
    } else {
      playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Continue';
      isPlaying = false;
    }
  } else {
    statusText.textContent = 'Ready to read this page';
    progress.style.display = 'none';
    playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Start Reading';
    isPlaying = false;
  }
}

// Listen for updates from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'statusUpdate') {
    updateStatus(request.status);
  }
  return true;
});
