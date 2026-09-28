// Web Audio API Sound Synthesizer for tactile scratch & victory effects
let audioCtx: AudioContext | null = null;
let lastScratchTime = 0;
let lastWinChimeTime = 0;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Unlocks the Web Audio API on iOS and mobile browsers by playing an inaudible buffer
 * upon direct user interaction (touchstart, pointerdown, click).
 */
export function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Ignore restricted policy failures
  }
}

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
    const bufferSize = Math.floor(ctx.sampleRate * 0.05); // 50ms buffer
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // White noise with pinkish friction tint
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
 * Play celebratory win fanfare chime optimized for mobile speakers and all browsers
 */
export async function playWinChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Prevent double trigger within 1 second
  const nowMs = Date.now();
  if (nowMs - lastWinChimeTime < 1000) return;
  lastWinChimeTime = nowMs;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Best effort
    }
  }

  try {
    const startTime = ctx.currentTime;

    // Ascending arpeggio tuned for mobile speaker projection: C5, E5, G5, C6, E6
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Triangle wave creates bright, bell-like tones that cut through mobile phone speakers
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.08);

      gain.gain.setValueAtTime(0.001, startTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, startTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * 0.08 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + idx * 0.08);
      osc.stop(startTime + idx * 0.08 + 0.5);
    });

    // Secondary victory chord for warm, celebratory reverberation
    setTimeout(() => {
      if (!ctx || ctx.state !== 'running') return;
      const chordTime = ctx.currentTime;
      [783.99, 1046.50, 1318.51].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, chordTime);
        gain.gain.setValueAtTime(0.001, chordTime);
        gain.gain.linearRampToValueAtTime(0.12, chordTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, chordTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(chordTime);
        osc.stop(chordTime + 0.65);
      });
    }, 320);
  } catch (err) {
    console.debug('Win chime error', err);
  }
}
