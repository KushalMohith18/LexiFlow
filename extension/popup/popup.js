let isPlaying = false;
let currentSentenceIndex = 0;
let totalSentences = 0;
let currentProvider = 'puter';

// Puter TTS voice options (AWS Polly neural voices via Puter.js)
const puterVoices = [
  { id: 'Joanna', name: 'Joanna (US Female)', locale: 'en-US' },
  { id: 'Matthew', name: 'Matthew (US Male)', locale: 'en-US' },
  { id: 'Ivy', name: 'Ivy (US Female)', locale: 'en-US' },
  { id: 'Joey', name: 'Joey (US Male)', locale: 'en-US' },
  { id: 'Kendra', name: 'Kendra (US Female)', locale: 'en-US' },
  { id: 'Kimberly', name: 'Kimberly (US Female)', locale: 'en-US' },
  { id: 'Salli', name: 'Salli (US Female)', locale: 'en-US' },
  { id: 'Kevin', name: 'Kevin (US Male)', locale: 'en-US' },
  { id: 'Ruth', name: 'Ruth (US Female)', locale: 'en-US' },
  { id: 'Stephen', name: 'Stephen (US Male)', locale: 'en-US' },
  { id: 'Amy', name: 'Amy (UK Female)', locale: 'en-GB' },
  { id: 'Brian', name: 'Brian (UK Male)', locale: 'en-GB' },
  { id: 'Emma', name: 'Emma (UK Female)', locale: 'en-GB' },
  { id: 'Arthur', name: 'Arthur (UK Male)', locale: 'en-GB' },
  { id: 'Olivia', name: 'Olivia (AU Female)', locale: 'en-AU' },
];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if tab URL is valid
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    document.getElementById('statusText').innerHTML = '<span style="color: #f87171;">⚠ Cannot run on browser internal pages</span>';
    document.getElementById('playBtn').disabled = true;
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
    loadVoices().then(() => {
      if (result.voice) {
        document.getElementById('voiceSelect').value = result.voice;
      }
    });
  });

  // Check reading status
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
    voiceSelect.innerHTML = '';
    
    // US voices
    const usVoices = puterVoices.filter(v => v.locale === 'en-US');
    const ukVoices = puterVoices.filter(v => v.locale === 'en-GB');
    const auVoices = puterVoices.filter(v => v.locale === 'en-AU');
    
    if (usVoices.length > 0) {
      const optGroupUS = document.createElement('optgroup');
      optGroupUS.label = '🇺🇸 US English (Neural)';
      usVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        if (index === 0) option.selected = true;
        optGroupUS.appendChild(option);
      });
      voiceSelect.appendChild(optGroupUS);
    }
    
    if (ukVoices.length > 0) {
      const optGroupUK = document.createElement('optgroup');
      optGroupUK.label = '🇬🇧 UK English (Neural)';
      ukVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        optGroupUK.appendChild(option);
      });
      voiceSelect.appendChild(optGroupUK);
    }
    
    if (auVoices.length > 0) {
      const optGroupAU = document.createElement('optgroup');
      optGroupAU.label = '🇦🇺 AU English (Neural)';
      auVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        optGroupAU.appendChild(option);
      });
      voiceSelect.appendChild(optGroupAU);
    }
    
    console.log('[LexiFlow] Loaded', puterVoices.length, 'Puter TTS voices');
    
  } else {
    // Browser TTS voices
    let voices = speechSynthesis.getVoices();
    
    if (voices.length === 0) {
      await new Promise(resolve => {
        speechSynthesis.addEventListener('voiceschanged', () => {
          voices = speechSynthesis.getVoices();
          resolve();
        }, { once: true });
        setTimeout(resolve, 500);
      });
      voices = speechSynthesis.getVoices();
    }
    
    if (voices.length > 0) {
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
      
      const englishVoices = sortedVoices.filter(v => v.lang.startsWith('en'));
      const otherVoices = sortedVoices.filter(v => !v.lang.startsWith('en'));
      
      if (englishVoices.length > 0) {
        const optGroupEn = document.createElement('optgroup');
        optGroupEn.label = 'English Voices';
        englishVoices.forEach((voice) => {
          const option = document.createElement('option');
          const idx = sortedVoices.indexOf(voice);
          option.value = `browser-${idx}`;
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
        otherVoices.slice(0, 15).forEach((voice) => {
          const option = document.createElement('option');
          const idx = sortedVoices.indexOf(voice);
          option.value = `browser-${idx}`;
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
  
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'changeProvider',
        provider: currentProvider
      }, () => {
        if (chrome.runtime.lastError) {
          console.log('Could not change provider');
        }
      });
    }
  });
}

async function togglePlay() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const playBtn = document.getElementById('playBtn');
  
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    alert('Cannot run on this page. Navigate to a regular webpage.');
    return;
  }
  
  if (isPlaying) {
    chrome.tabs.sendMessage(tab.id, { action: 'pause' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      }
    });
    playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Continue';
    isPlaying = false;
  } else {
    const speed = parseFloat(document.getElementById('speedSlider').value);
    const voice = document.getElementById('voiceSelect').value;
    const provider = document.getElementById('ttsProvider').value;
    
    playBtn.innerHTML = '<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Starting...';
    
    chrome.tabs.sendMessage(tab.id, { 
      action: 'start',
      speed: speed,
      voice: voice,
      provider: provider
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error starting:', chrome.runtime.lastError);
        playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Start Reading';
        alert('Failed to start. Please refresh the page and try again.');
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
  
  // Send speed update - will apply in real-time without restarting
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateSpeed', 
        speed: speed
      }, () => {
        if (chrome.runtime.lastError) {
          // Ignore
        }
      });
    }
  });
}

function updateVoice(e) {
  const voice = e.target.value;
  chrome.storage.sync.set({ voice: voice });
  
  // Send voice update - will apply on next sentence without restarting current
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateVoice',
        voice: voice,
        provider: currentProvider
      }, () => {
        if (chrome.runtime.lastError) {
          // Ignore
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

// Listen for status updates
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'statusUpdate') {
    updateStatus(request.status);
  }
  return true;
});
