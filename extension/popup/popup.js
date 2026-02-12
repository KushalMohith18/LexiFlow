let isPlaying = false;
let currentSentenceIndex = 0;
let totalSentences = 0;
let edgeTTSVoices = [];
let currentProvider = 'edge';

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
  chrome.storage.sync.get(['speed', 'voice', 'ttsProvider'], (result) => {
    if (result.speed) {
      document.getElementById('speedSlider').value = result.speed;
      document.getElementById('speedValue').textContent = result.speed + 'x';
    }
    if (result.ttsProvider) {
      currentProvider = result.ttsProvider;
      document.getElementById('ttsProvider').value = result.ttsProvider;
    }
  });

  // Load voices based on provider
  await loadVoices();

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
  
  if (provider === 'edge') {
    // Load Edge TTS voices
    try {
      const response = await fetch(
        'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4'
      );
      const voices = await response.json();
      edgeTTSVoices = voices;
      
      // Filter and sort English voices
      const englishVoices = voices
        .filter(v => v.Locale && v.Locale.startsWith('en'))
        .sort((a, b) => {
          // Prioritize Neural voices
          const aNeural = a.ShortName?.includes('Neural') ? 1 : 0;
          const bNeural = b.ShortName?.includes('Neural') ? 1 : 0;
          if (aNeural !== bNeural) return bNeural - aNeural;
          
          // Prioritize US/GB/AU
          const preferredLocales = ['en-US', 'en-GB', 'en-AU'];
          const aLocale = preferredLocales.indexOf(a.Locale) !== -1 ? 1 : 0;
          const bLocale = preferredLocales.indexOf(b.Locale) !== -1 ? 1 : 0;
          if (aLocale !== bLocale) return bLocale - aLocale;
          
          return (a.FriendlyName || '').localeCompare(b.FriendlyName || '');
        });
      
      voiceSelect.innerHTML = '';
      englishVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.ShortName;
        const isRecommended = voice.ShortName?.includes('Neural');
        option.textContent = `${isRecommended ? '⭐ ' : ''}${voice.FriendlyName} (${voice.Locale})`;
        if (index === 0) option.selected = true;
        voiceSelect.appendChild(option);
      });
      
      console.log('[LexiFlow] Loaded', englishVoices.length, 'Edge TTS voices');
      
    } catch (error) {
      console.error('[LexiFlow] Failed to load Edge voices:', error);
      voiceSelect.innerHTML = '<option value="">Failed to load Edge voices</option>';
    }
    
  } else {
    // Load Browser TTS voices
    const voices = speechSynthesis.getVoices();
    
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
      sortedVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = index;
        const isRecommended = ['enhanced', 'premium', 'natural', 'neural'].some(k => 
          voice.name.toLowerCase().includes(k)
        );
        option.textContent = `${isRecommended ? '⭐ ' : ''}${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(option);
      });
      
      window.lexiflowVoices = sortedVoices;
    } else {
      speechSynthesis.addEventListener('voiceschanged', () => {
        loadVoices();
      });
    }
  }
}

async function changeTTSProvider(e) {
  currentProvider = e.target.value;
  chrome.storage.sync.set({ ttsProvider: currentProvider });
  await loadVoices();
  
  // Notify content script to change provider
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) {
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
  const speed = parseFloat(e.target.value);
  document.getElementById('speedValue').textContent = speed.toFixed(1) + 'x';
  chrome.storage.sync.set({ speed: speed });
  
  // Update active reading IMMEDIATELY
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateSpeed', 
        speed: speed,
        immediate: true  // Flag for immediate restart
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
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateVoice',
        voice: voice,
        provider: currentProvider,
        immediate: true  // Flag for immediate restart
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