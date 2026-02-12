/* Puter TTS Integration for LexiFlow */
/* Uses Puter.js for high-quality, free, unlimited TTS */

class PuterTTS {
  constructor() {
    this.loaded = false;
    this.loadPromise = null;
    this.audioContext = null;
    this.currentAudio = null;
    
    // High-quality voice options
    this.voices = [
      { id: 'en-US-Standard-A', name: 'Amy (US Female)', locale: 'en-US', gender: 'Female' },
      { id: 'en-US-Standard-B', name: 'Brian (US Male)', locale: 'en-US', gender: 'Male' },
      { id: 'en-US-Standard-C', name: 'Chloe (US Female)', locale: 'en-US', gender: 'Female' },
      { id: 'en-US-Standard-D', name: 'David (US Male)', locale: 'en-US', gender: 'Male' },
      { id: 'en-US-Wavenet-A', name: 'Aria (US Neural)', locale: 'en-US', gender: 'Female' },
      { id: 'en-US-Wavenet-B', name: 'Blake (US Neural)', locale: 'en-US', gender: 'Male' },
      { id: 'en-US-Wavenet-C', name: 'Clara (US Neural)', locale: 'en-US', gender: 'Female' },
      { id: 'en-US-Wavenet-D', name: 'Dylan (US Neural)', locale: 'en-US', gender: 'Male' },
      { id: 'en-GB-Standard-A', name: 'Emma (UK Female)', locale: 'en-GB', gender: 'Female' },
      { id: 'en-GB-Standard-B', name: 'Harry (UK Male)', locale: 'en-GB', gender: 'Male' },
      { id: 'en-GB-Wavenet-A', name: 'Eleanor (UK Neural)', locale: 'en-GB', gender: 'Female' },
      { id: 'en-GB-Wavenet-B', name: 'Henry (UK Neural)', locale: 'en-GB', gender: 'Male' },
      { id: 'en-AU-Standard-A', name: 'Olivia (AU Female)', locale: 'en-AU', gender: 'Female' },
      { id: 'en-AU-Standard-B', name: 'Jack (AU Male)', locale: 'en-AU', gender: 'Male' },
    ];
  }

  // Load Puter.js library dynamically
  async load() {
    if (this.loaded) return true;
    if (this.loadPromise) return this.loadPromise;
    
    this.loadPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof puter !== 'undefined') {
        this.loaded = true;
        console.log('[PuterTTS] Library already loaded');
        resolve(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.async = true;
      
      script.onload = () => {
        console.log('[PuterTTS] Library loaded successfully');
        this.loaded = true;
        resolve(true);
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

  // Get recommended voices for documentation reading
  getRecommendedVoices() {
    // Prioritize neural/wavenet voices for better quality
    return this.voices.filter(v => v.id.includes('Wavenet')).concat(
      this.voices.filter(v => v.id.includes('Standard'))
    );
  }

  // Synthesize text and return audio
  async synthesize(text, voiceId = 'en-US-Wavenet-D', rate = 1.0) {
    try {
      await this.load();
      
      if (typeof puter === 'undefined') {
        throw new Error('Puter.js not available');
      }
      
      console.log('[PuterTTS] Synthesizing with voice:', voiceId);
      
      // Use puter.tts.speak which returns audio data
      // Note: puter.say() plays directly, we need more control
      return new Promise((resolve, reject) => {
        // Create a temporary audio element to capture the audio
        const options = {
          voice: voiceId,
          rate: rate
        };
        
        // puter.tts.speak returns a promise with audio data
        if (puter.tts && puter.tts.speak) {
          puter.tts.speak(text, options)
            .then(audioData => {
              resolve(audioData);
            })
            .catch(reject);
        } else if (puter.say) {
          // Fallback to puter.say which plays directly
          // We'll need to handle this differently
          puter.say(text, options);
          resolve(null); // Indicate direct playback
        } else {
          reject(new Error('Puter TTS methods not available'));
        }
      });
      
    } catch (error) {
      console.error('[PuterTTS] Synthesis error:', error);
      throw error;
    }
  }

  // Speak text directly using puter.say
  async speak(text, voiceId = 'en-US-Wavenet-D', rate = 1.0) {
    try {
      await this.load();
      
      if (typeof puter === 'undefined') {
        throw new Error('Puter.js not available');
      }
      
      console.log('[PuterTTS] Speaking with voice:', voiceId, 'rate:', rate);
      
      return new Promise((resolve, reject) => {
        try {
          // puter.say handles TTS directly
          puter.say(text, {
            voice: voiceId,
            rate: rate
          }).then(() => {
            console.log('[PuterTTS] Speech completed');
            resolve();
          }).catch(reject);
        } catch (e) {
          reject(e);
        }
      });
      
    } catch (error) {
      console.error('[PuterTTS] Speech error:', error);
      throw error;
    }
  }

  // Stop current speech
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    // Also try to stop any puter speech
    if (typeof puter !== 'undefined' && puter.tts && puter.tts.stop) {
      try {
        puter.tts.stop();
      } catch (e) {
        // Ignore
      }
    }
  }

  // Check if Puter.js is available and working
  async isAvailable() {
    try {
      await this.load();
      return typeof puter !== 'undefined';
    } catch {
      return false;
    }
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.PuterTTS = PuterTTS;
}
