import { useEffect, useRef, useState } from 'react';
import { vi } from '../i18n/vi';

interface AudioPlayerProps {
  url: string | null;
  maxPlays?: number;
  audioIndex?: number;
  questionFrom?: number;
  questionTo?: number;
}

export function AudioPlayer({
  url,
  maxPlays = 2,
  audioIndex = 1,
  questionFrom = 1,
  questionTo = 5,
}: AudioPlayerProps) {
  const [plays, setPlays] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setPlays(0);
    setCurrentTime(0);
  }, [url]);

  if (!url) return null;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handlePlay = () => {
    if (plays >= maxPlays) {
      audioRef.current?.pause();
      return;
    }
    setPlays((p) => p + 1);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="cbt-audio-block">
      <h3 className="cbt-audio-title">{vi.audio.title(audioIndex)}</h3>
      <p className="cbt-audio-sub">{vi.audio.shared(questionFrom, questionTo)}</p>
      <div className="cbt-audio-player">
        <button
          type="button"
          className="cbt-audio-play"
          disabled={plays >= maxPlays}
          onClick={() => audioRef.current?.play()}
        >
          ▶
        </button>
        <div className="cbt-audio-track">
          <div className="cbt-audio-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="cbt-audio-time">
          {formatTime(currentTime)} / {formatTime(duration || 180)}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={url}
        onPlay={handlePlay}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onSeeking={(e) => {
          e.currentTarget.currentTime = 0;
        }}
        controlsList="nodownload noplaybackrate"
        style={{ display: 'none' }}
      />
      <div className="cbt-audio-warning">{vi.audio.regulation(plays, maxPlays)}</div>
      <style>{`
        .cbt-audio-block { margin-bottom: 1rem; }
        .cbt-audio-title { color: var(--cbt-primary); margin: 0 0 0.25rem; }
        .cbt-audio-sub { color: var(--cbt-text-muted); margin: 0 0 1rem; font-size: 0.9rem; }
        .cbt-audio-player { display: flex; align-items: center; gap: 0.75rem; background: #eff6ff; padding: 1rem; border-radius: var(--cbt-radius); }
        .cbt-audio-play { width: 44px; height: 44px; border-radius: 50%; background: var(--cbt-primary); color: #fff; border: none; font-size: 1rem; cursor: pointer; flex-shrink: 0; }
        .cbt-audio-play:disabled { opacity: 0.4; cursor: not-allowed; }
        .cbt-audio-track { flex: 1; height: 8px; background: #cbd5e1; border-radius: 4px; overflow: hidden; pointer-events: none; }
        .cbt-audio-fill { height: 100%; background: var(--cbt-primary); transition: width 0.2s; }
        .cbt-audio-time { font-family: monospace; font-size: 0.85rem; color: var(--cbt-text-muted); white-space: nowrap; }
        .cbt-audio-warning { margin-top: 1rem; padding: 0.75rem 1rem; background: var(--cbt-danger-bg); border-left: 4px solid var(--cbt-danger); color: var(--cbt-danger); font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
