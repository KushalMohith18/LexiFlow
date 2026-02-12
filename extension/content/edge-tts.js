/* Edge TTS Integration for Browser Extension */

class EdgeTTS {
  constructor() {
    this.endpoint = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
    this.voices = null;
  }

  // Get available Edge TTS voices
  async getVoices() {
    if (this.voices) return this.voices;
    
    try {
      const response = await fetch(
        'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4',
        { method: 'GET' }
      );
      this.voices = await response.json();
      return this.voices;
    } catch (error) {
      console.error('[EdgeTTS] Failed to fetch voices:', error);
      return [];
    }
  }

  // Synthesize text to speech
  async synthesize(text, voiceName = 'en-US-JennyNeural', rate = 1.0, pitch = 0) {
    try {
      // Convert rate to percentage (+0% to +100%)
      const ratePercent = Math.round((rate - 1) * 100);
      const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
      
      // Convert pitch to Hz
      const pitchHz = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;

      // Create SSML
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="${voiceName}">
            <prosody rate="${rateStr}" pitch="${pitchHz}">
              ${this.escapeXml(text)}
            </prosody>
          </voice>
        </speak>
      `.trim();

      // Generate unique IDs
      const requestId = this.generateId();
      const timestamp = new Date().toISOString();

      // Build request
      const response = await fetch(this.endpoint + `?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: ssml
      });

      if (!response.ok) {
        throw new Error(`Edge TTS request failed: ${response.status}`);
      }

      // Get audio blob
      const audioBlob = await response.blob();
      return audioBlob;

    } catch (error) {
      console.error('[EdgeTTS] Synthesis error:', error);
      throw error;
    }
  }

  // Helper: Escape XML special characters
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Helper: Generate unique ID
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Get recommended voices sorted by quality
  getRecommendedVoices(allVoices) {
    const qualityKeywords = ['neural', 'multilingual'];
    const preferredLocales = ['en-US', 'en-GB', 'en-AU', 'en-CA'];
    
    return allVoices
      .filter(v => v.Locale && v.Locale.startsWith('en'))
      .sort((a, b) => {
        // Prioritize quality keywords
        const aQuality = qualityKeywords.some(k => a.ShortName?.toLowerCase().includes(k)) ? 1 : 0;
        const bQuality = qualityKeywords.some(k => b.ShortName?.toLowerCase().includes(k)) ? 1 : 0;
        if (aQuality !== bQuality) return bQuality - aQuality;
        
        // Prioritize preferred locales
        const aLocale = preferredLocales.indexOf(a.Locale) !== -1 ? 1 : 0;
        const bLocale = preferredLocales.indexOf(b.Locale) !== -1 ? 1 : 0;
        if (aLocale !== bLocale) return bLocale - aLocale;
        
        return (a.FriendlyName || '').localeCompare(b.FriendlyName || '');
      });
  }
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.EdgeTTS = EdgeTTS;
}
