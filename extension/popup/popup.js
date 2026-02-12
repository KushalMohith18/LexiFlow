/* LexiFlow Popup Controller v2.0 */
/* Enhanced with Sarvam AI support and real-time switching */

let isPlaying = false;
let isPaused = false;
let currentSentenceIndex = 0;
let totalSentences = 0;
let currentProvider = 'puter';

// Puter TTS voice options (AWS Polly neural voices via Puter.js)
// Organized for audiobook-quality narration
const puterVoices = [
  // Narration/Audiobook (Best)
  { id: 'Joanna', name: 'Joanna (Narrator ⭐)', locale: 'en-US', style: 'narration' },
  { id: 'Matthew', name: 'Matthew (Narrator ⭐)', locale: 'en-US', style: 'narration' },
  { id: 'Ruth', name: 'Ruth (Storyteller)', locale: 'en-US', style: 'narration' },
  { id: 'Stephen', name: 'Stephen (Storyteller)', locale: 'en-US', style: 'narration' },
  // Clear/Professional
  { id: 'Kendra', name: 'Kendra (Clear)', locale: 'en-US', style: 'professional' },
  { id: 'Joey', name: 'Joey (Clear)', locale: 'en-US', style: 'professional' },
  { id: 'Salli', name: 'Salli (Professional)', locale: 'en-US', style: 'professional' },
  { id: 'Kevin', name: 'Kevin (Professional)', locale: 'en-US', style: 'professional' },
  // Friendly
  { id: 'Ivy', name: 'Ivy (Friendly)', locale: 'en-US', style: 'friendly' },
  { id: 'Kimberly', name: 'Kimberly (Warm)', locale: 'en-US', style: 'friendly' },
  // UK English
  { id: 'Amy', name: 'Amy (UK Narrator ⭐)', locale: 'en-GB', style: 'narration' },
  { id: 'Brian', name: 'Brian (UK Narrator)', locale: 'en-GB', style: 'narration' },
  { id: 'Emma', name: 'Emma (UK Clear)', locale: 'en-GB', style: 'professional' },
  { id: 'Arthur', name: 'Arthur (UK Deep)', locale: 'en-GB', style: 'narration' },
  // Australian
  { id: 'Olivia', name: 'Olivia (AU)', locale: 'en-AU', style: 'professional' },
];

// Sarvam AI voice options (Indian Neural voices)
// Professional voice artists optimized for narration
const sarvamVoices = [
  // Premium Narration
  { id: 'meera', name: 'Meera (Storyteller ⭐)', lang: 'en-IN', style: 'narration' },
  { id: 'pavithra', name: 'Pavithra (Narrator)', lang: 'en-IN', style: 'narration' },
  { id: 'maitreyi', name: 'Maitreyi (Audiobook)', lang: 'en-IN', style: 'narration' },
  { id: 'arvind', name: 'Arvind (Narrator)', lang: 'en-IN', style: 'narration' },
  { id: 'kumar', name: 'Kumar (Storyteller)', lang: 'en-IN', style: 'narration' },
  // Professional
  { id: 'amelia', name: 'Amelia (Clear)', lang: 'en-IN', style: 'professional' },
  { id: 'amartya', name: 'Amartya (Professional)', lang: 'en-IN', style: 'professional' },
  { id: 'diya', name: 'Diya (Professional)', lang: 'en-IN', style: 'professional' },
  { id: 'neel', name: 'Neel (Clear)', lang: 'en-IN', style: 'professional' },
  // Friendly
  { id: 'vidya', name: 'Vidya (Warm)', lang: 'en-IN', style: 'friendly' },
  { id: 'arjun', name: 'Arjun (Engaging)', lang: 'en-IN', style: 'friendly' },
  { id: 'manisha', name: 'Manisha (Friendly)', lang: 'en-IN', style: 'friendly' },
  { id: 'karan', name: 'Karan (Casual)', lang: 'en-IN', style: 'friendly' },
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
        const voiceSelect = document.getElementById('voiceSelect');
        // Check if saved voice exists for current provider
        const voiceExists = Array.from(voiceSelect.options).some(opt => opt.value === result.voice);
        if (voiceExists) {
          voiceSelect.value = result.voice;
        }
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
    // Puter TTS voices
    voiceSelect.innerHTML = '';
    
    // Group by style for audiobook narration
    const narrationVoices = puterVoices.filter(v => v.style === 'narration');
    const professionalVoices = puterVoices.filter(v => v.style === 'professional');
    const friendlyVoices = puterVoices.filter(v => v.style === 'friendly');
    
    // Narration/Audiobook group
    if (narrationVoices.length > 0) {
      const optGroupNarr = document.createElement('optgroup');
      optGroupNarr.label = '📖 Audiobook Narration (Recommended)';
      narrationVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        if (index === 0) option.selected = true;
        optGroupNarr.appendChild(option);
      });
      voiceSelect.appendChild(optGroupNarr);
    }
    
    // Professional group
    if (professionalVoices.length > 0) {
      const optGroupProf = document.createElement('optgroup');
      optGroupProf.label = '💼 Clear & Professional';
      professionalVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        optGroupProf.appendChild(option);
      });
      voiceSelect.appendChild(optGroupProf);
    }
    
    // Friendly group
    if (friendlyVoices.length > 0) {
      const optGroupFriendly = document.createElement('optgroup');
      optGroupFriendly.label = '😊 Warm & Friendly';
      friendlyVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        optGroupFriendly.appendChild(option);
      });
      voiceSelect.appendChild(optGroupFriendly);
    }
    
    console.log('[LexiFlow] Loaded', puterVoices.length, 'Puter TTS voices');
    
  } else if (provider === 'sarvam') {
    // Sarvam AI voices
    voiceSelect.innerHTML = '';
    
    const narrationVoices = sarvamVoices.filter(v => v.style === 'narration');
    const professionalVoices = sarvamVoices.filter(v => v.style === 'professional');
    const friendlyVoices = sarvamVoices.filter(v => v.style === 'friendly');
    
    // Narration group
    if (narrationVoices.length > 0) {
      const optGroupNarr = document.createElement('optgroup');
      optGroupNarr.label = '📖 Audiobook Narration (Recommended)';
      narrationVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        if (index === 0) option.selected = true;
        optGroupNarr.appendChild(option);
      });
      voiceSelect.appendChild(optGroupNarr);
    }
    
    // Professional group
    if (professionalVoices.length > 0) {
      const optGroupProf = document.createElement('optgroup');
      optGroupProf.label = '💼 Clear & Professional';
      professionalVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        optGroupProf.appendChild(option);
      });
      voiceSelect.appendChild(optGroupProf);
    }
    
    // Friendly group
    if (friendlyVoices.length > 0) {
      const optGroupFriendly = document.createElement('optgroup');
      optGroupFriendly.label = '😊 Warm & Friendly';
      friendlyVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = voice.name;
        optGroupFriendly.appendChild(option);
      });
      voiceSelect.appendChild(optGroupFriendly);
    }
    
    console.log('[LexiFlow] Loaded', sarvamVoices.length, 'Sarvam TTS voices');
    
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
      // Sort by quality indicators for audiobook experience
      const sortedVoices = voices.sort((a, b) => {
        const qualityKeywords = ['enhanced', 'premium', 'natural', 'neural', 'google us', 'microsoft', 'samantha', 'daniel'];
        const aScore = qualityKeywords.some(k => a.name.toLowerCase().includes(k)) ? 2 : 
                       (a.name.toLowerCase().includes('google') || a.name.toLowerCase().includes('microsoft')) ? 1 : 0;
        const bScore = qualityKeywords.some(k => b.name.toLowerCase().includes(k)) ? 2 :
                       (b.name.toLowerCase().includes('google') || b.name.toLowerCase().includes('microsoft')) ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore;
        if (a.lang.startsWith('en') && !b.lang.startsWith('en')) return -1;
        if (!a.lang.startsWith('en') && b.lang.startsWith('en')) return 1;
        return a.name.localeCompare(b.name);
      });
      
      voiceSelect.innerHTML = '';
      
      const englishVoices = sortedVoices.filter(v => v.lang.startsWith('en'));
      const otherVoices = sortedVoices.filter(v => !v.lang.startsWith('en'));
      
      // Premium English voices
      const premiumVoices = englishVoices.filter(v => 
        ['enhanced', 'premium', 'natural', 'neural', 'google us'].some(k => v.name.toLowerCase().includes(k))
      );
      
      if (premiumVoices.length > 0) {
        const optGroupPremium = document.createElement('optgroup');
        optGroupPremium.label = '⭐ Premium Quality';
        premiumVoices.forEach((voice) => {
          const option = document.createElement('option');
          const idx = sortedVoices.indexOf(voice);
          option.value = `browser-${idx}`;
          option.textContent = voice.name;
          optGroupPremium.appendChild(option);
        });
        voiceSelect.appendChild(optGroupPremium);
      }
      
      // Standard English voices
      const standardVoices = englishVoices.filter(v => !premiumVoices.includes(v));
      if (standardVoices.length > 0) {
        const optGroupEn = document.createElement('optgroup');
        optGroupEn.label = '🔊 English Voices';
        standardVoices.slice(0, 15).forEach((voice) => {
          const option = document.createElement('option');
          const idx = sortedVoices.indexOf(voice);
          option.value = `browser-${idx}`;
          option.textContent = voice.name;
          optGroupEn.appendChild(option);
        });
        voiceSelect.appendChild(optGroupEn);
      }
      
      // Other languages
      if (otherVoices.length > 0) {
        const optGroupOther = document.createElement('optgroup');
        optGroupOther.label = '🌐 Other Languages';
        otherVoices.slice(0, 10).forEach((voice) => {
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
  const oldProvider = currentProvider;
  currentProvider = e.target.value;
  chrome.storage.sync.set({ ttsProvider: currentProvider });
  
  // Load voices for new provider
  await loadVoices();
  
  // Get new default voice
  const newVoice = document.getElementById('voiceSelect').value;
  chrome.storage.sync.set({ voice: newVoice });
  
  // Send provider change to content script (immediate switch)
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateVoice',
        voice: newVoice,
        provider: currentProvider,
        immediate: true  // Immediate switch
      }, () => {
        if (chrome.runtime.lastError) {
          console.log('Could not change provider');
        }
      });
    }
  });
  
  console.log('[LexiFlow] Provider changed:', oldProvider, '->', currentProvider);
}

async function togglePlay() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const playBtn = document.getElementById('playBtn');
  
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    alert('Cannot run on this page. Navigate to a regular webpage.');
    return;
  }
  
  if (isPlaying) {
    // Pause
    chrome.tabs.sendMessage(tab.id, { action: 'pause' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        return;
      }
      if (response && response.success) {
        playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Continue';
        isPlaying = false;
        isPaused = true;
      }
    });
  } else {
    // Start or resume
    const speed = parseFloat(document.getElementById('speedSlider').value);
    const voice = document.getElementById('voiceSelect').value;
    const provider = document.getElementById('ttsProvider').value;
    
    if (isPaused) {
      // Resume from pause
      chrome.tabs.sendMessage(tab.id, { action: 'resume' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error resuming:', chrome.runtime.lastError);
          return;
        }
        if (response && response.success) {
          playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
          isPlaying = true;
          isPaused = false;
        }
      });
    } else {
      // Start fresh
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
          isPaused = false;
          document.getElementById('statusText').innerHTML = '<span class="status-active">● Reading ' + response.sentences + ' sentences</span>';
          document.getElementById('progress').style.display = 'block';
        } else if (response && response.error) {
          playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Start Reading';
          alert(response.error);
        }
      });
    }
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
  
  // Send speed update - applies in real-time without restarting
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateSpeed', 
        speed: speed
      }, () => {
        if (chrome.runtime.lastError) {
          // Content script may not be ready
        }
      });
    }
  });
}

function updateVoice(e) {
  const voice = e.target.value;
  chrome.storage.sync.set({ voice: voice });
  
  // Send voice update - seamless transition at next sentence boundary
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateVoice',
        voice: voice,
        provider: currentProvider,
        immediate: false  // Seamless transition at next sentence
      }, () => {
        if (chrome.runtime.lastError) {
          // Content script may not be ready
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
    // Show provider info in status
    const providerName = status.provider === 'puter' ? 'Puter TTS' : 
                        status.provider === 'sarvam' ? 'Sarvam AI' : 'Browser TTS';
    statusText.innerHTML = `<span class="status-active">● Reading with ${providerName}</span>`;
    progress.style.display = 'block';
    
    currentSentenceIndex = status.currentIndex;
    totalSentences = status.totalSentences;
    
    progressText.textContent = `${status.currentIndex + 1} / ${status.totalSentences} sentences`;
    const percent = ((status.currentIndex + 1) / status.totalSentences) * 100;
    progressFill.style.width = percent + '%';
    
    if (status.isPlaying && !status.isPaused) {
      playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
      isPlaying = true;
      isPaused = false;
    } else {
      playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Continue';
      isPlaying = false;
      isPaused = status.isPaused;
    }
  } else {
    statusText.textContent = 'Ready to read this page';
    progress.style.display = 'none';
    playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Start Reading';
    isPlaying = false;
    isPaused = false;
  }
}

// Listen for status updates from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'statusUpdate') {
    updateStatus(request.status);
  }
  return true;
});
