interface Props {
  remainingSec: number;
  totalSec: number;
}

export function TimerBar({ remainingSec, totalSec }: Props) {
  const pct = Math.max(0, (remainingSec / totalSec) * 100);
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const urgent = remainingSec < 300;

  return (
    <div className={`timer-bar ${urgent ? 'urgent' : ''}`}>
      <div className="timer-fill" style={{ width: `${pct}%` }} />
      <span className="timer-text">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}
