/* Puter TTS Integration for LexiFlow */
/* Uses puter.ai.txt2speech() for high-quality neural voices */
/* Optimized for audiobook-style narration */

class PuterTTS {
  constructor() {
    this.loaded = false;
    this.loadPromise = null;
    this.currentAudio = null;
    this.onEndCallback = null;
    this.isPaused = false;
    
    // Available voices for Puter TTS (AWS Polly neural voices)
    // Curated and ordered by audiobook/narration quality
    this.voices = [
      // ⭐ Best for Audiobook Narration (Recommended)
      { id: 'Joanna', name: 'Joanna (Narrator ⭐)', locale: 'en-US', gender: 'Female', style: 'narration', quality: 'premium' },
      { id: 'Matthew', name: 'Matthew (Narrator ⭐)', locale: 'en-US', gender: 'Male', style: 'narration', quality: 'premium' },
      { id: 'Ruth', name: 'Ruth (Storyteller)', locale: 'en-US', gender: 'Female', style: 'narration', quality: 'premium' },
      { id: 'Stephen', name: 'Stephen (Storyteller)', locale: 'en-US', gender: 'Male', style: 'narration', quality: 'premium' },
      
      // Clear & Professional (Great for technical docs)
      { id: 'Kendra', name: 'Kendra (Clear)', locale: 'en-US', gender: 'Female', style: 'professional', quality: 'premium' },
      { id: 'Joey', name: 'Joey (Clear)', locale: 'en-US', gender: 'Male', style: 'professional', quality: 'premium' },
      { id: 'Salli', name: 'Salli (Professional)', locale: 'en-US', gender: 'Female', style: 'professional', quality: 'premium' },
      { id: 'Kevin', name: 'Kevin (Professional)', locale: 'en-US', gender: 'Male', style: 'professional', quality: 'premium' },
      
      // Friendly & Engaging (Good for tutorials)
      { id: 'Ivy', name: 'Ivy (Friendly)', locale: 'en-US', gender: 'Female', style: 'friendly', quality: 'premium' },
      { id: 'Kimberly', name: 'Kimberly (Warm)', locale: 'en-US', gender: 'Female', style: 'friendly', quality: 'premium' },
      
      // 🇬🇧 UK English - Excellent for documentation
      { id: 'Amy', name: 'Amy (UK Narrator ⭐)', locale: 'en-GB', gender: 'Female', style: 'narration', quality: 'premium' },
      { id: 'Brian', name: 'Brian (UK Narrator)', locale: 'en-GB', gender: 'Male', style: 'narration', quality: 'premium' },
      { id: 'Emma', name: 'Emma (UK Clear)', locale: 'en-GB', gender: 'Female', style: 'professional', quality: 'premium' },
      { id: 'Arthur', name: 'Arthur (UK Deep)', locale: 'en-GB', gender: 'Male', style: 'narration', quality: 'premium' },
      
      // 🇦🇺 Australian
      { id: 'Olivia', name: 'Olivia (AU)', locale: 'en-AU', gender: 'Female', style: 'professional', quality: 'premium' },
    ];
  }

  // Load Puter.js library dynamically
  async load() {
    if (this.loaded && typeof puter !== 'undefined') return true;
    if (this.loadPromise) return this.loadPromise;
    
    this.loadPromise = new Promise((resolve, reject) => {
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

  // Get voices by style
  getVoicesByStyle(style) {
    return this.voices.filter(v => v.style === style);
  }

  // Get narration-optimized voices
  getNarrationVoices() {
    return this.voices.filter(v => v.style === 'narration');
  }

  // Speak text with audiobook-optimized settings
  async speak(text, voiceId = 'Joanna', rate = 1.0, onEnd = null) {
    try {
      await this.load();
      
      if (typeof puter === 'undefined' || !puter.ai || !puter.ai.txt2speech) {
        throw new Error('Puter.js TTS not available');
      }
      
      // Stop any current audio
      this.stop();
      this.isPaused = false;
      
      console.log('[PuterTTS] Speaking with voice:', voiceId, 'rate:', rate);
      
      // Call Puter TTS API with neural engine for best audiobook quality
      const audio = await puter.ai.txt2speech(text, {
        voice: voiceId,
        engine: 'neural'  // Neural engine provides audiobook-quality voices
      });
      
      this.currentAudio = audio;
      this.onEndCallback = onEnd;
      
      // Set playback rate for speed control
      // Audiobook sweet spot is 0.9-1.1x
      audio.playbackRate = rate;
      
      audio.onended = () => {
        console.log('[PuterTTS] Audio ended');
        this.currentAudio = null;
        if (this.onEndCallback && !this.isPaused) {
          this.onEndCallback();
        }
      };
      
      audio.onerror = (e) => {
        console.error('[PuterTTS] Audio error:', e);
        this.currentAudio = null;
      };
      
      await audio.play();
      console.log('[PuterTTS] Playback started at rate:', rate);
      
      return audio;
      
    } catch (error) {
      console.error('[PuterTTS] Speech error:', error);
      throw error;
    }
  }

  // Change playback rate in real-time (works without restart)
  setRate(rate) {
    if (this.currentAudio) {
      this.currentAudio.playbackRate = rate;
      console.log('[PuterTTS] Rate changed to:', rate);
      return true;
    }
    return false;
  }

  // Pause current audio
  pause() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.isPaused = true;
      console.log('[PuterTTS] Paused');
      return true;
    }
    return false;
  }

  // Resume current audio
  resume() {
    if (this.currentAudio && this.currentAudio.paused && this.isPaused) {
      this.currentAudio.play();
      this.isPaused = false;
      console.log('[PuterTTS] Resumed');
      return true;
    }
    return false;
  }

  // Stop current speech
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.onEndCallback = null;
      this.isPaused = false;
      console.log('[PuterTTS] Stopped');
    }
  }

  // Check if currently playing
  isPlaying() {
    return this.currentAudio && !this.currentAudio.paused;
  }

  // Check if paused
  isPausedState() {
    return this.isPaused && this.currentAudio && this.currentAudio.paused;
  }

  // Check if Puter.js is available
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
