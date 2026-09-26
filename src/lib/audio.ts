// Web Audio API Sound Synthesizer for tactile scratch & victory effects
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

let lastScratchTime = 0;

/**
 * Play a synthesized physical friction scratch sound
 */
export function playScratchSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Throttle scratch sounds slightly so they don't overpower
  if (now - lastScratchTime < 0.04) return;
  lastScratchTime = now;

  try {
    const bufferSize = ctx.sampleRate * 0.05; // 50ms buffer
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // White noise with pinkish tint
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter to simulate paper/foil texture friction
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 800; // randomized frequency
    filter.Q.value = 3.0;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.05);
  } catch (err) {
    console.debug('Audio error', err);
  }
}

/**
 * Play celebratory win fanfare chime
 */
export function playWinChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  const startTime = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime + idx * 0.1);

    gain.gain.setValueAtTime(0.001, startTime + idx * 0.1);
    gain.gain.linearRampToValueAtTime(0.15, startTime + idx * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * 0.1 + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime + idx * 0.1);
    osc.stop(startTime + idx * 0.1 + 0.45);
  });
}
