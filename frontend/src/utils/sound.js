// Minimal retro sound effects (Base64 encoded to avoid asset management issues)

// Short "coin" sound for buy
const BUY_SFX = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgICAf39/f39/f39/f39/f39/f39/f39/fwAAgICAgICAgICAgICAgICAgICA"; 
// Note: The above is a dummy placeholder. Real base64 would be too long. 
// For a better experience, I will use browser's AudioContext oscillator which needs no files!
// This is much cooler and truly "code-only".

class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled) return;
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playBuy() {
        // High pitched coin sound
        this.playTone(1200, 'square', 0.1, 0.1);
        setTimeout(() => this.playTone(1600, 'square', 0.2, 0.1), 100);
    }

    playSell() {
        // Lower pitched confirmation
        this.playTone(600, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(400, 'sine', 0.2, 0.1), 100);
    }

    playNews() {
        // Urgent alarm
        this.playTone(800, 'sawtooth', 0.1, 0.05);
        setTimeout(() => this.playTone(600, 'sawtooth', 0.1, 0.05), 100);
        setTimeout(() => this.playTone(800, 'sawtooth', 0.1, 0.05), 200);
    }

    playError() {
        // Buzzer
        this.playTone(150, 'sawtooth', 0.3, 0.2);
    }
}

export const sounds = new SoundManager();
