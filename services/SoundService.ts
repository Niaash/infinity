
class SoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private musicEnabled: boolean = true;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive'
      });
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1, decay: number = 0.1, vibrato: boolean = false) {
    if (!this.enabled) return;
    this.init();
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    if (vibrato) {
      const lfo = this.ctx!.createOscillator();
      const lfoGain = this.ctx!.createGain();
      lfo.frequency.value = 8;
      lfoGain.gain.value = 15;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + duration);
    }
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    osc.connect(gain);
    gain.connect(this.masterGain!);
    
    osc.start(now);
    osc.stop(now + duration);
  }

  playPickUp() {
    // Quick 'push' sound
    this.playTone(400, 'sine', 0.05, 0.1);
    this.playTone(600, 'sine', 0.05, 0.05);
  }

  playPlace() {
    // Satisfying 'pop' sound
    this.playTone(150, 'sine', 0.1, 0.15);
    this.playTone(300, 'sine', 0.05, 0.08);
  }

  playClear() {
    // Clean electronic line clear (non-bell)
    const baseFreq = 440;
    [1, 1.2, 1.5, 2].forEach((m, i) => {
      setTimeout(() => this.playTone(baseFreq * m, 'sine', 0.3, 0.05), i * 30);
    });
  }

  playSuccess() {
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.8, 0.1, 0.2, true), i * 60);
    });
  }

  playFail() {
    this.playTone(100, 'sawtooth', 0.5, 0.1);
    this.playTone(70, 'sawtooth', 0.6, 0.1);
  }
  
  playClick() {
    this.playTone(700, 'sine', 0.05, 0.05);
  }

  startMusic() {
    // Background music loop removed as per request to remove 'bell sound on background'
  }

  stopMusic() {
    this.musicEnabled = false;
  }
}

export const soundService = new SoundService();
