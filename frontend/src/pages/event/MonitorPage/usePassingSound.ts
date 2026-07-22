import { useEffect, useRef, useCallback, useState } from 'react';
import addSoundUrl from '../../../assets/add.mp3';

const MIN_INTERVAL_MS = 150;

/**
 * Preloads the passing sound and returns a throttled play() function
 * along with muted state and toggle.
 */
export function usePassingSound() {
  const bufferRef = useRef<AudioBuffer | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const lastPlayRef = useRef(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    // Chrome autoplay policy: the context starts suspended until the page has
    // had a user gesture. Resume right away (covers navigating here by
    // clicking through the app — activation is sticky) and again on the first
    // gesture (covers direct loads / hard refreshes straight onto the
    // monitor, where punches would otherwise stay silent until some click).
    const unlock = () => {
      void ctx.resume();
    };
    unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    fetch(addSoundUrl)
      .then((res) => res.arrayBuffer())
      .then((arr) => ctx.decodeAudioData(arr))
      .then((buf) => {
        bufferRef.current = buf;
      })
      .catch(() => {
        // Audio not available — silently degrade.
      });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      void ctx.close();
    };
  }, []);

  const play = useCallback(() => {
    if (mutedRef.current) return;

    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;

    const now = performance.now();
    if (now - lastPlayRef.current < MIN_INTERVAL_MS) return;
    lastPlayRef.current = now;

    // Still suspended = the page has had no user gesture yet — the browser
    // will not let audio through. Don't queue a source on the sleeping
    // context (it would fire as a stale burst once resumed); just try to
    // resume for the next punch.
    if (ctx.state === 'suspended') {
      void ctx.resume();
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { play, muted, toggleMute };
}
