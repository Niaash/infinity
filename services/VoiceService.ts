
import { GoogleGenAI, Modality } from "@google/genai";

class VoiceService {
  private ai: GoogleGenAI | null = null;
  private audioCtx: AudioContext | null = null;
  private cache: Map<string, AudioBuffer> = new Map();

  private init() {
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) });
    }
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
  }

  private decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  async speak(text: string) {
    try {
      this.init();
      if (this.cache.has(text)) {
        this.playBuffer(this.cache.get(text)!);
        return;
      }

      const response = await this.ai!.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say with a very sweet, friendly, and smooth female-sounding voice: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await this.decodeAudioData(
          this.decode(base64Audio),
          this.audioCtx!,
          24000,
          1
        );
        this.cache.set(text, audioBuffer);
        this.playBuffer(audioBuffer);
      }
    } catch (e) {
      console.error("Voice synthesis failed", e);
    }
  }

  private playBuffer(buffer: AudioBuffer) {
    if (!this.audioCtx) return;
    const source = this.audioCtx.createBufferSource();
    const gainNode = this.audioCtx.createGain();
    gainNode.gain.value = 0.8; 
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    source.start();
  }
}

export const voiceService = new VoiceService();
