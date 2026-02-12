/* Sarvam AI TTS Integration for LexiFlow */
/* Uses Bulbul v3 model with 35+ professional voice artists */

class SarvamTTS {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = 'https://api.sarvam.ai/text-to-speech';
    this.currentAudio = null;
    this.onEndCallback = null;
    
    // Available Sarvam voices - Professional voice artists
    // Categorized by style for audiobook narration
    this.voices = [
      // Narration / Audiobook Style
      { id: 'meera', name: 'Meera (Storyteller)', style: 'narration', gender: 'Female', lang: 'en-IN' },
      { id: 'shubh', name: 'Shubh (Conversational)', style: 'narration', gender: 'Male', lang: 'en-IN' },
      { id: 'manan', name: 'Manan (Consistent)', style: 'narration', gender: 'Male', lang: 'en-IN' },
      { id: 'ishita', name: 'Ishita (Dynamic)', style: 'narration', gender: 'Female', lang: 'en-IN' },
      { id: 'shreya', name: 'Shreya (Authoritative)', style: 'narration', gender: 'Female', lang: 'en-IN' },
      { id: 'kabir', name: 'Kabir (Deep)', style: 'narration', gender: 'Male', lang: 'en-IN' },
      { id: 'anand', name: 'Anand (Warm)', style: 'narration', gender: 'Male', lang: 'en-IN' },
      
      // Clear / Professional Style
      { id: 'amelia', name: 'Amelia (Clear)', style: 'professional', gender: 'Female', lang: 'en-IN' },
      { id: 'sophia', name: 'Sophia (Professional)', style: 'professional', gender: 'Female', lang: 'en-IN' },
      { id: 'aditya', name: 'Aditya (Professional)', style: 'professional', gender: 'Male', lang: 'en-IN' },
      { id: 'rohan', name: 'Rohan (Clear)', style: 'professional', gender: 'Male', lang: 'en-IN' },
      
      // Friendly / Engaging Style
      { id: 'priya', name: 'Priya (Friendly)', style: 'friendly', gender: 'Female', lang: 'en-IN' },
      { id: 'ritu', name: 'Ritu (Engaging)', style: 'friendly', gender: 'Female', lang: 'en-IN' },
      { id: 'neha', name: 'Neha (Warm)', style: 'friendly', gender: 'Female', lang: 'en-IN' },
      { id: 'rahul', name: 'Rahul (Friendly)', style: 'friendly', gender: 'Male', lang: 'en-IN' },
      { id: 'dev', name: 'Dev (Casual)', style: 'friendly', gender: 'Male', lang: 'en-IN' },
      
      // Additional voices
      { id: 'kavya', name: 'Kavya', style: 'general', gender: 'Female', lang: 'en-IN' },
      { id: 'tanya', name: 'Tanya', style: 'general', gender: 'Female', lang: 'en-IN' },
      { id: 'shruti', name: 'Shruti', style: 'general', gender: 'Female', lang: 'en-IN' },
      { id: 'amit', name: 'Amit', style: 'general', gender: 'Male', lang: 'en-IN' },
      { id: 'varun', name: 'Varun', style: 'general', gender: 'Male', lang: 'en-IN' },
      { id: 'tarun', name: 'Tarun', style: 'general', gender: 'Male', lang: 'en-IN' },
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

  // Synthesize text to speech
  async synthesize(text, voiceId = 'meera', options = {}) {
    try {
      console.log('[SarvamTTS] Synthesizing with voice:', voiceId);
      
      // Temperature for expressiveness (0.7-0.9 for audiobook style)
      const temperature = options.temperature || 0.75;
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': this.apiKey
        },
        body: JSON.stringify({
          text: text,
          target_language_code: 'en-IN',
          model: 'bulbul:v3',
          speaker: voiceId,
          temperature: temperature,
          enable_preprocessing: true
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

  // Speak text directly
  async speak(text, voiceId = 'meera', rate = 1.0, onEnd = null) {
    try {
      // Stop any current audio
      this.stop();
      
      const audioUrl = await this.synthesize(text, voiceId);
      
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this.onEndCallback = onEnd;
      
      // Set playback rate
      audio.playbackRate = rate;
      
      audio.onended = () => {
        console.log('[SarvamTTS] Playback ended');
        URL.revokeObjectURL(audioUrl);
        if (this.onEndCallback) {
          this.onEndCallback();
        }
      };
      
      audio.onerror = (e) => {
        console.error('[SarvamTTS] Audio playback error:', e);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
      console.log('[SarvamTTS] Playback started');
      
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
    }
  }

  // Pause current audio
  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      console.log('[SarvamTTS] Paused');
    }
  }

  // Resume current audio
  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
      console.log('[SarvamTTS] Resumed');
    }
  }

  // Stop current speech
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.onEndCallback = null;
      console.log('[SarvamTTS] Stopped');
    }
  }

  // Check if currently playing
  isPlaying() {
    return this.currentAudio && !this.currentAudio.paused;
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
