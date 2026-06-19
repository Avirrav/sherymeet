'use client';

import { useEffect, useRef } from 'react';

interface MicVisualizerProps {
  isActive: boolean; // true when mic is enabled
}

const BAR_COUNT = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Why Canvas instead of useState for bars?
//
// The original code called setBars() inside useEffect — React 19 flags this
// as "setState synchronously within an effect" which causes cascading renders.
//
// Solution: use a <canvas> element (an external DOM system) and draw directly
// on it in the animation loop. This completely bypasses React's state/render
// cycle — no setState at all, zero re-renders at 60fps, better performance.
// ─────────────────────────────────────────────────────────────────────────────

export default function MicVisualizer({ isActive }: MicVisualizerProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cleanup: stop mic stream, disconnect audio graph, cancel animation frame
    const cleanup = () => {
      isCurrent = false;
      if (rafRef.current)    cancelAnimationFrame(rafRef.current);
      if (analyserRef.current) analyserRef.current.disconnect();
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      analyserRef.current = null;
      audioCtxRef.current = null;
      streamRef.current   = null;
      rafRef.current      = null;
    };

    if (!isActive) {
      // Mic muted: stop audio, draw flat bars on canvas
      cleanup();
      drawBars(ctx, canvas.width, canvas.height, Array(BAR_COUNT).fill(0), false);
      return;
    }

    // ── Mic is active: start the Web Audio pipeline ──────────────────────────
    const start = async () => {
      try {
        // Get raw mic stream (browser reuses already-granted permission)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!isCurrent) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;

        // AudioContext drives the entire Web Audio graph
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        // AnalyserNode in time-domain mode — reads raw waveform samples.
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8; // smooth decay between frames
        analyserRef.current = analyser;

        // Connect: mic stream source → analyser (no output, we just read data)
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        // dataArray holds fftSize time-domain samples (0–255, centered at 128)
        const dataArray = new Uint8Array(analyser.fftSize);

        const mid = (BAR_COUNT - 1) / 2;

        // Animation loop — ~60fps via requestAnimationFrame
        const draw = () => {
          if (!isCurrent) return;
          rafRef.current = requestAnimationFrame(draw);

          // Read raw waveform samples into dataArray
          analyser.getByteTimeDomainData(dataArray);

          // ── RMS (Root Mean Square) volume calculation ──────────────────────
          const sumOfSquares = dataArray.reduce((sum, v) => {
            const normalized = (v - 128) / 128; // shift: 128→0, 0→-1, 255→+1
            return sum + normalized * normalized;
          }, 0);
          const rms = Math.sqrt(sumOfSquares / dataArray.length);

          // ── Symmetric bar heights from RMS ─────────────────────────────────
          const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
            const dist   = Math.abs(i - mid) / mid;
            const weight = Math.cos(dist * Math.PI * 0.5);
            return rms * 12 * weight; // 0..1
          });

          drawBars(ctx, canvas.width, canvas.height, bars, true);
        };

        draw();
      } catch {
        if (isCurrent) {
          // Mic unavailable or permission denied — just show flat bars
          drawBars(ctx, canvas.width, canvas.height, Array(BAR_COUNT).fill(0), false);
        }
      }
    };

    start();
    return cleanup;
  }, [isActive]);

  return (
    // Rectangle container styled to match control bar buttons
    <div
      className="flex items-center justify-center px-2 bg-brand-surface border border-brand-border rounded-full overflow-hidden"
      style={{ width: '140px', height: '46px' }}
      title="Microphone level"
    >
      {/* Canvas is the "external system" — React never touches its pixels */}
      <canvas ref={canvasRef} width={88} height={28} style={{ display: 'block' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// drawBars — pure canvas drawing function, called every animation frame.
// Kept outside the component so it doesn't get recreated on every render.
// ─────────────────────────────────────────────────────────────────────────────
function drawBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bars: number[],
  isActive: boolean,
) {
  ctx.clearRect(0, 0, width, height);

  const gap      = 2;
  const barWidth = (width - (BAR_COUNT - 1) * gap) / BAR_COUNT;
  const centerY  = height / 2;

  bars.forEach((value, i) => {
    // bars[] values are already shaped by RMS × cos curve (pre-computed).
    // min height of 2px so the flat-line always shows when silent.
    const barHeight = Math.max(2, value * height);

    const x = i * (barWidth + gap);
    const y = centerY - barHeight / 2;

    // Orange when mic is active and bar is non-trivially tall (speaking)
    // Gray when silent or muted
    const isSpeaking = value > 0.03;
    ctx.fillStyle    = isActive && isSpeaking ? '#f97316' : '#374151';

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, barWidth, barHeight, 2);
    } else {
      ctx.rect(x, y, barWidth, barHeight);
    }
    ctx.fill();
  });
}

