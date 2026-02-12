/* Puter TTS Integration for LexiFlow */
/* Uses puter.ai.txt2speech() for high-quality neural voices */
/* Configured for audiobook-style narration */

class PuterTTS {
  constructor() {
    this.loaded = false;
    this.loadPromise = null;
    this.currentAudio = null;
    this.onEndCallback = null;
    
    // Available voices for Puter TTS (AWS Polly neural voices)
    // Selected for audiobook/narration quality
    this.voices = [
      // Best for Audiobook Narration
      { id: 'Joanna', name: 'Joanna (Narrator)', locale: 'en-US', gender: 'Female', style: 'narration' },
      { id: 'Matthew', name: 'Matthew (Narrator)', locale: 'en-US', gender: 'Male', style: 'narration' },
      { id: 'Ruth', name: 'Ruth (Storyteller)', locale: 'en-US', gender: 'Female', style: 'narration' },
      { id: 'Stephen', name: 'Stephen (Storyteller)', locale: 'en-US', gender: 'Male', style: 'narration' },
      
      // Clear & Professional
      { id: 'Kendra', name: 'Kendra (Clear)', locale: 'en-US', gender: 'Female', style: 'professional' },
      { id: 'Joey', name: 'Joey (Clear)', locale: 'en-US', gender: 'Male', style: 'professional' },
      { id: 'Salli', name: 'Salli (Professional)', locale: 'en-US', gender: 'Female', style: 'professional' },
      { id: 'Kevin', name: 'Kevin (Professional)', locale: 'en-US', gender: 'Male', style: 'professional' },
      
      // Friendly & Engaging
      { id: 'Ivy', name: 'Ivy (Friendly)', locale: 'en-US', gender: 'Female', style: 'friendly' },
      { id: 'Kimberly', name: 'Kimberly (Warm)', locale: 'en-US', gender: 'Female', style: 'friendly' },
      
      // UK English - Great for documentation
      { id: 'Amy', name: 'Amy (UK Narrator)', locale: 'en-GB', gender: 'Female', style: 'narration' },
      { id: 'Brian', name: 'Brian (UK Narrator)', locale: 'en-GB', gender: 'Male', style: 'narration' },
      { id: 'Emma', name: 'Emma (UK Clear)', locale: 'en-GB', gender: 'Female', style: 'professional' },
      { id: 'Arthur', name: 'Arthur (UK Deep)', locale: 'en-GB', gender: 'Male', style: 'narration' },
      
      // Australian
      { id: 'Olivia', name: 'Olivia (AU)', locale: 'en-AU', gender: 'Female', style: 'professional' },
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
      
      // Call Puter TTS API with neural engine for best quality
      const audio = await puter.ai.txt2speech(text, {
        voice: voiceId,
        engine: 'neural'  // Neural engine provides audiobook-quality voices
      });
      
      this.currentAudio = audio;
      this.onEndCallback = onEnd;
      
      // Set playback rate (0.85-0.95 is ideal for audiobook listening)
      audio.playbackRate = rate;
      
      audio.onended = () => {
        console.log('[PuterTTS] Audio ended');
        if (this.onEndCallback) {
          this.onEndCallback();
        }
      };
      
      audio.onerror = (e) => {
        console.error('[PuterTTS] Audio error:', e);
      };
      
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
