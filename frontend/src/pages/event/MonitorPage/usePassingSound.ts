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

    // Resume context if suspended (browser autoplay policy).
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { play, muted, toggleMute };
}
