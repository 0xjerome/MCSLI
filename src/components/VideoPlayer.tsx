import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Maximize, Minimize, Captions, RotateCcw, RotateCw, Gauge, Volume2, VolumeX, VideoOff } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';

export interface VideoPlayerProps {
  src: string | null;
  captionsSrc?: string | null;
  poster?: string | null;
  title: string;
  /** Start position in seconds (resume). */
  startAt?: number;
  /** Called at most every few seconds with the current position, and on pause/end. */
  onProgress?: (seconds: number, duration: number) => void;
  onEnded?: () => void;
  /** Mirror the picture horizontally (useful for copying signs). */
  mirror?: boolean;
  loop?: boolean;
  className?: string;
  compact?: boolean;
  defaultRate?: number;
}

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

/**
 * Accessible video player shell. Uses the native <video> element for maximum device
 * compatibility (mobile Safari, low-end Android) and adds keyboard-friendly controls,
 * playback speed, captions toggle and full screen. Never autoplays.
 */
export function VideoPlayer({ src, captionsSrc, poster, title, startAt = 0, onProgress, onEnded, mirror, loop, className, compact, defaultRate = 1 }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(defaultRate);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(false);
  const lastReport = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
  }, [rate, src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tracks = v.textTracks;
    for (let i = 0; i < tracks.length; i++) tracks[i]!.mode = captionsOn ? 'showing' : 'hidden';
  }, [captionsOn, src, captionsSrc]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const report = useCallback(
    (force = false) => {
      const v = videoRef.current;
      if (!v || !onProgress) return;
      const now = Date.now();
      if (force || now - lastReport.current > 5000) {
        lastReport.current = now;
        onProgress(v.currentTime, v.duration || 0);
      }
    },
    [onProgress],
  );

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setError(true));
    else v.pause();
  };

  const seek = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  if (!src) {
    return (
      <div className={cn('flex aspect-video w-full flex-col items-center justify-center rounded-2xl bg-ink-900 text-ink-300', className)} role="status">
        <VideoOff className="h-8 w-8" aria-hidden="true" />
        <p className="mt-2 text-sm">Video not yet available for this item.</p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn('group relative overflow-hidden rounded-2xl bg-ink-950', fullscreen && 'flex flex-col justify-center', className)}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions track rendered when provided */}
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        preload="metadata"
        playsInline
        loop={loop}
        muted={muted}
        crossOrigin={captionsSrc ? 'anonymous' : undefined}
        aria-label={title}
        className={cn('aspect-video w-full bg-black', mirror && '-scale-x-100')}
        onClick={toggle}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration || 0);
          if (startAt > 0 && startAt < (v.duration || 0) - 2) v.currentTime = startAt;
          v.playbackRate = rate;
        }}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime);
          report();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          report(true);
        }}
        onEnded={() => {
          setPlaying(false);
          report(true);
          onEnded?.();
        }}
        onError={() => setError(true)}
      >
        {captionsSrc && <track kind="captions" src={captionsSrc} srcLang="en" label="English captions" default />}
      </video>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-950/80 p-4 text-center text-sm text-white" role="alert">
          This video could not be loaded. Check your connection and try again.
        </div>
      )}

      {/* Controls */}
      <div className={cn('flex flex-wrap items-center gap-1 bg-ink-900 px-2 text-white', compact ? 'py-1' : 'py-1.5')}>
        <button type="button" onClick={toggle} className="rounded-lg p-2 hover:bg-white/10" aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => seek(-5)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Back 5 seconds">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => seek(5)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Forward 5 seconds">
          <RotateCw className="h-4 w-4" aria-hidden="true" />
        </button>
        <label className="flex min-w-[6rem] flex-1 items-center gap-2 px-1">
          <span className="sr-only">Seek</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => {
              const v = videoRef.current;
              if (v) v.currentTime = Number(e.target.value);
            }}
            aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
            className="h-1.5 w-full cursor-pointer accent-accent-500"
          />
        </label>
        <span className="px-1 text-xs tabular-nums text-ink-300" aria-live="off">
          {formatDuration(time)} / {formatDuration(duration)}
        </span>
        <label className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs hover:bg-white/10">
          <Gauge className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Playback speed</span>
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="bg-transparent text-xs text-white focus:outline-none [&>option]:text-ink-900">
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
        {captionsSrc && (
          <button type="button" onClick={() => setCaptionsOn((c) => !c)} className={cn('rounded-lg p-2 hover:bg-white/10', captionsOn && 'text-accent-300')} aria-pressed={captionsOn} aria-label="Captions">
            <Captions className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={() => setMuted((m) => !m)} className="rounded-lg p-2 hover:bg-white/10" aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
        </button>
        <button type="button" onClick={toggleFullscreen} className="rounded-lg p-2 hover:bg-white/10" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
          {fullscreen ? <Minimize className="h-5 w-5" aria-hidden="true" /> : <Maximize className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
