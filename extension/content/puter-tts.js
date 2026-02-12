/* Puter TTS Integration for LexiFlow */
/* Uses puter.ai.txt2speech() for high-quality neural voices */

class PuterTTS {
  constructor() {
    this.loaded = false;
    this.loadPromise = null;
    this.currentAudio = null;
    this.onEndCallback = null;
    
    // Available voices for Puter TTS (AWS Polly neural voices)
    this.voices = [
      { id: 'Joanna', name: 'Joanna (US Female)', locale: 'en-US', gender: 'Female', engine: 'neural' },
      { id: 'Matthew', name: 'Matthew (US Male)', locale: 'en-US', gender: 'Male', engine: 'neural' },
      { id: 'Ivy', name: 'Ivy (US Female)', locale: 'en-US', gender: 'Female', engine: 'neural' },
      { id: 'Joey', name: 'Joey (US Male)', locale: 'en-US', gender: 'Male', engine: 'neural' },
      { id: 'Kendra', name: 'Kendra (US Female)', locale: 'en-US', gender: 'Female', engine: 'neural' },
      { id: 'Kimberly', name: 'Kimberly (US Female)', locale: 'en-US', gender: 'Female', engine: 'neural' },
      { id: 'Salli', name: 'Salli (US Female)', locale: 'en-US', gender: 'Female', engine: 'neural' },
      { id: 'Kevin', name: 'Kevin (US Male)', locale: 'en-US', gender: 'Male', engine: 'neural' },
      { id: 'Ruth', name: 'Ruth (US Female)', locale: 'en-US', gender: 'Female', engine: 'neural' },
      { id: 'Stephen', name: 'Stephen (US Male)', locale: 'en-US', gender: 'Male', engine: 'neural' },
      { id: 'Amy', name: 'Amy (UK Female)', locale: 'en-GB', gender: 'Female', engine: 'neural' },
      { id: 'Brian', name: 'Brian (UK Male)', locale: 'en-GB', gender: 'Male', engine: 'neural' },
      { id: 'Emma', name: 'Emma (UK Female)', locale: 'en-GB', gender: 'Female', engine: 'neural' },
      { id: 'Arthur', name: 'Arthur (UK Male)', locale: 'en-GB', gender: 'Male', engine: 'neural' },
      { id: 'Olivia', name: 'Olivia (AU Female)', locale: 'en-AU', gender: 'Female', engine: 'neural' },
    ];
  }

  // Load Puter.js library dynamically
  async load() {
    if (this.loaded && typeof puter !== 'undefined') return true;
    if (this.loadPromise) return this.loadPromise;
    
    this.loadPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof puter !== 'undefined' && puter.ai && puter.ai.txt2speech) {
        this.loaded = true;
        console.log('[PuterTTS] Library already loaded');
        resolve(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.async = true;
      
      script.onload = () => {
        // Wait a bit for puter to initialize
        const checkPuter = () => {
          if (typeof puter !== 'undefined' && puter.ai) {
            console.log('[PuterTTS] Library loaded successfully');
            this.loaded = true;
            resolve(true);
          } else {
            setTimeout(checkPuter, 100);
          }
        };
        setTimeout(checkPuter, 100);
      };
      
      script.onerror = (error) => {
        console.error('[PuterTTS] Failed to load library:', error);
        reject(new Error('Failed to load Puter.js'));
      };
      
      document.head.appendChild(script);
    });
    
    return this.loadPromise;
  }

  // Get available voices
  getVoices() {
    return this.voices;
  }

  // Speak text and return audio element for control
  async speak(text, voiceId = 'Joanna', rate = 1.0, onEnd = null) {
    try {
      await this.load();
      
      if (typeof puter === 'undefined' || !puter.ai || !puter.ai.txt2speech) {
        throw new Error('Puter.js TTS not available');
      }
      
      console.log('[PuterTTS] Speaking with voice:', voiceId, 'rate:', rate);
      
      // Stop any current audio
      this.stop();
      
      // Call Puter TTS API
      const audio = await puter.ai.txt2speech(text, {
        voice: voiceId,
        engine: 'neural'
      });
      
      this.currentAudio = audio;
      this.onEndCallback = onEnd;
      
      // Set playback rate
      audio.playbackRate = rate;
      
      // Set up event handlers
      audio.onended = () => {
        console.log('[PuterTTS] Audio ended');
        if (this.onEndCallback) {
          this.onEndCallback();
        }
      };
      
      audio.onerror = (e) => {
        console.error('[PuterTTS] Audio error:', e);
      };
      
      // Play the audio
      await audio.play();
      console.log('[PuterTTS] Playback started');
      
      return audio;
      
    } catch (error) {
      console.error('[PuterTTS] Speech error:', error);
      throw error;
    }
  }

  // Change playback rate without restarting (real-time)
  setRate(rate) {
    if (this.currentAudio) {
      this.currentAudio.playbackRate = rate;
      console.log('[PuterTTS] Rate changed to:', rate);
    }
  }

  // Pause current audio
  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      console.log('[PuterTTS] Paused');
    }
  }

  // Resume current audio
  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
      console.log('[PuterTTS] Resumed');
    }
  }

  // Stop current speech
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.onEndCallback = null;
      console.log('[PuterTTS] Stopped');
    }
  }

  // Check if currently playing
  isPlaying() {
    return this.currentAudio && !this.currentAudio.paused;
  }

  // Check if Puter.js is available and working
  async isAvailable() {
    try {
      await this.load();
      return typeof puter !== 'undefined' && puter.ai && puter.ai.txt2speech;
    } catch {
      return false;
    }
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.PuterTTS = PuterTTS;
}
