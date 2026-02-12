/* Sarvam AI TTS Integration for LexiFlow */
/* Uses Bulbul v3 model with professional voice artists */
/* Optimized for audiobook-style narration */

class SarvamTTS {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = 'https://api.sarvam.ai/text-to-speech';
    this.currentAudio = null;
    this.onEndCallback = null;
    this.isPaused = false;
    
    // Available Sarvam voices - Professional voice artists optimized for narration
    // All voices configured for audiobook-style delivery
    this.voices = [
      // Premium Narration / Audiobook Style (Best for docs)
      { id: 'meera', name: 'Meera (Storyteller)', style: 'narration', gender: 'Female', lang: 'en-IN', quality: 'premium' },
      { id: 'pavithra', name: 'Pavithra (Narrator)', style: 'narration', gender: 'Female', lang: 'en-IN', quality: 'premium' },
      { id: 'maitreyi', name: 'Maitreyi (Audiobook)', style: 'narration', gender: 'Female', lang: 'en-IN', quality: 'premium' },
      { id: 'arvind', name: 'Arvind (Narrator)', style: 'narration', gender: 'Male', lang: 'en-IN', quality: 'premium' },
      { id: 'kumar', name: 'Kumar (Storyteller)', style: 'narration', gender: 'Male', lang: 'en-IN', quality: 'premium' },
      
      // Clear & Professional (Good for technical docs)
      { id: 'amelia', name: 'Amelia (Clear)', style: 'professional', gender: 'Female', lang: 'en-IN', quality: 'premium' },
      { id: 'amartya', name: 'Amartya (Professional)', style: 'professional', gender: 'Male', lang: 'en-IN', quality: 'premium' },
      { id: 'diya', name: 'Diya (Professional)', style: 'professional', gender: 'Female', lang: 'en-IN', quality: 'premium' },
      { id: 'neel', name: 'Neel (Clear)', style: 'professional', gender: 'Male', lang: 'en-IN', quality: 'premium' },
      
      // Warm & Engaging (Great for tutorials)
      { id: 'vidya', name: 'Vidya (Warm)', style: 'friendly', gender: 'Female', lang: 'en-IN', quality: 'premium' },
      { id: 'arjun', name: 'Arjun (Engaging)', style: 'friendly', gender: 'Male', lang: 'en-IN', quality: 'premium' },
      { id: 'manisha', name: 'Manisha (Friendly)', style: 'friendly', gender: 'Female', lang: 'en-IN', quality: 'premium' },
      { id: 'karan', name: 'Karan (Casual)', style: 'friendly', gender: 'Male', lang: 'en-IN', quality: 'premium' },
    ];
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
    return this.voices.filter(v => v.style === 'narration' || v.quality === 'premium');
  }

  // Synthesize text to speech with audiobook settings
  async synthesize(text, voiceId = 'meera', options = {}) {
    try {
      console.log('[SarvamTTS] Synthesizing with voice:', voiceId);
      
      // Temperature for expressiveness
      // 0.7-0.85 = Natural, audiobook-like narration
      // Higher values add more expression but may reduce consistency
      const temperature = options.temperature || 0.78;
      
      // Pace adjustment for better narration
      // Slightly slower for better comprehension
      const pace = options.pace || 1.0;
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': this.apiKey
        },
        body: JSON.stringify({
          text: text,
          target_language_code: 'en-IN',
          model: 'bulbul:v2',
          speaker: voiceId,
          temperature: temperature,
          pace: pace,
          loudness: 1.2, // Slightly louder for clarity
          enable_preprocessing: true,
          speech_sample_rate: 22050 // Higher quality audio
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sarvam API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.audios || data.audios.length === 0) {
        throw new Error('No audio data received from Sarvam API');
      }

      // Decode base64 audio
      const audioBase64 = data.audios[0];
      const audioBlob = this.base64ToBlob(audioBase64, 'audio/wav');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      console.log('[SarvamTTS] Audio generated successfully');
      return audioUrl;

    } catch (error) {
      console.error('[SarvamTTS] Synthesis error:', error);
      throw error;
    }
  }

  // Speak text directly with audiobook-optimized settings
  async speak(text, voiceId = 'meera', rate = 1.0, onEnd = null) {
    try {
      // Stop any current audio
      this.stop();
      this.isPaused = false;
      
      const audioUrl = await this.synthesize(text, voiceId, {
        temperature: 0.78, // Natural narration feel
        pace: rate <= 1.0 ? 1.0 : 0.95 // Slightly adjust base pace for faster playback
      });
      
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this.onEndCallback = onEnd;
      
      // Set playback rate for speed control
      audio.playbackRate = rate;
      
      // Store URL for cleanup
      audio._audioUrl = audioUrl;
      
      audio.onended = () => {
        console.log('[SarvamTTS] Playback ended');
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        if (this.onEndCallback && !this.isPaused) {
          this.onEndCallback();
        }
      };
      
      audio.onerror = (e) => {
        console.error('[SarvamTTS] Audio playback error:', e);
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };
      
      await audio.play();
      console.log('[SarvamTTS] Playback started at rate:', rate);
      
      return audio;
      
    } catch (error) {
      console.error('[SarvamTTS] Speak error:', error);
      throw error;
    }
  }

  // Helper: Convert base64 to Blob
  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  // Change playback rate in real-time
  setRate(rate) {
    if (this.currentAudio) {
      this.currentAudio.playbackRate = rate;
      console.log('[SarvamTTS] Rate changed to:', rate);
      return true;
    }
    return false;
  }

  // Pause current audio
  pause() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.isPaused = true;
      console.log('[SarvamTTS] Paused');
      return true;
    }
    return false;
  }

  // Resume current audio
  resume() {
    if (this.currentAudio && this.currentAudio.paused && this.isPaused) {
      this.currentAudio.play();
      this.isPaused = false;
      console.log('[SarvamTTS] Resumed');
      return true;
    }
    return false;
  }

  // Stop current speech
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      if (this.currentAudio._audioUrl) {
        URL.revokeObjectURL(this.currentAudio._audioUrl);
      }
      this.currentAudio = null;
      this.onEndCallback = null;
      this.isPaused = false;
      console.log('[SarvamTTS] Stopped');
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

  // Check if API is available
  async isAvailable() {
    return !!this.apiKey;
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.SarvamTTS = SarvamTTS;
}
