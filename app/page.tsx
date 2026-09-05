'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  BellRing,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';

type Track = { artist: string; title: string; file: string; fallbackDuration: number };
type SessionState = 'idle' | 'running' | 'paused' | 'finished';

const tracks: Track[] = [
  { artist: 'Drove Amaro', title: 'Cat', file: 'Drove Amaro - Cat (hitmos.fm).mp3', fallbackDuration: 241 },
  { artist: 'Nicolai Heidlas', title: 'Chill Tune', file: 'Nicolai Heidlas - Chill Tune (hitmos.fm).mp3', fallbackDuration: 238 },
  { artist: 'Michael FK', title: 'Low End Theory', file: 'Michael FK - Low End Theory (hitmos.fm).mp3', fallbackDuration: 246 },
  { artist: 'Content Sounds', title: 'Dance', file: 'Content Sounds - Dance (hitmos.fm).mp3', fallbackDuration: 142 },
  { artist: 'Biometrix', title: 'Pheromones', file: 'Biometrix - Pheromones (hitmos.fm).mp3', fallbackDuration: 211 },
  { artist: 'C152', title: 'From Inside', file: 'C152 - From Inside (hitmos.fm).mp3', fallbackDuration: 155 },
  { artist: 'C152 feat. Sam Ho', title: 'Close To Me', file: 'C152 feat Sam Ho - Close To Me (hitmos.fm).mp3', fallbackDuration: 137 },
  { artist: 'Ron Gelinas', title: 'Feeling Good', file: 'Ron Gelinas - Feeling Good (hitmos.fm).mp3', fallbackDuration: 220 },
];

const sourceFor = (file: string) => `/audio/tracks/${encodeURIComponent(file)}`;
const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

function playFinishChime() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.22;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.72);
  });
  window.setTimeout(() => void context.close(), 1500);
}

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const powerRef = useRef<HTMLAudioElement>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(tracks[0].fallbackDuration);
  const [durations, setDurations] = useState(tracks.map((track) => track.fallbackDuration));
  const [muted, setMuted] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  const currentTrack = tracks[currentIndex];
  const isRunning = sessionState === 'running';

  const queue = useMemo(() => {
    const result: { track: Track; sourceIndex: number; duration: number; queueIndex: number }[] = [];
    let total = 0;
    let cursor = 0;
    const target = selectedMinutes * 60;
    while (total < target && result.length < 60) {
      const sourceIndex = cursor % tracks.length;
      const trackDuration = durations[sourceIndex] || tracks[sourceIndex].fallbackDuration;
      result.push({ track: tracks[sourceIndex], sourceIndex, duration: trackDuration, queueIndex: cursor });
      total += trackDuration;
      cursor += 1;
    }
    return { items: result, total };
  }, [durations, selectedMinutes]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (secondsLeft !== 0 || sessionState !== 'running') return;
    audioRef.current?.pause();
    setSessionState('finished');
    setFinishOpen(true);
    playFinishChime();
  }, [secondsLeft, sessionState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    setCurrentTime(0);
    setDuration(durations[currentIndex] || currentTrack.fallbackDuration);
    if (isRunning) void audio.play().catch(() => setSessionState('paused'));
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMinutes = (minutes: number) => {
    if (sessionState === 'running') return;
    const value = Math.min(180, Math.max(1, minutes));
    setSelectedMinutes(value);
    setSecondsLeft(value * 60);
    setSessionState('idle');
  };

  const startOrToggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (sessionState === 'running') {
      audio.pause();
      setSessionState('paused');
      return;
    }
    if (sessionState === 'finished' || secondsLeft === 0) setSecondsLeft(selectedMinutes * 60);
    if (sessionState === 'idle' || sessionState === 'finished') {
      const power = powerRef.current;
      if (power) {
        power.currentTime = 0;
        try { await power.play(); } catch { /* Playback can continue without the switch sound. */ }
      }
    }
    try {
      await audio.play();
      setSessionState('running');
    } catch {
      setSessionState('paused');
    }
  };

  const resetSession = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setSecondsLeft(selectedMinutes * 60);
    setSessionState('idle');
    setFinishOpen(false);
  };

  const changeTrack = (direction: number) => {
    setCurrentIndex((index) => (index + direction + tracks.length) % tracks.length);
  };

  const selectTrack = (index: number) => {
    setCurrentIndex(index);
  };

  const handleEnded = () => changeTrack(1);
  const handleMetadata = () => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    setDuration(audio.duration);
    setDurations((values) => values.map((value, index) => index === currentIndex ? audio.duration : value));
  };

  const commitCustomMinutes = () => {
    const parsed = Number(customMinutes);
    if (Number.isFinite(parsed) && parsed > 0) setMinutes(parsed);
    setCustomMinutes('');
  };

  return (
    <main className="app-shell">
      <audio ref={audioRef} src={sourceFor(currentTrack.file)} muted={muted} onEnded={handleEnded} onLoadedMetadata={handleMetadata} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} />
      <audio ref={powerRef} src="/audio/sounds/turning-on-the-gramophone.mp3" muted={muted} preload="auto" />

      <header className="topbar">
        <a className="brand" href="#" aria-label="Needle home"><span className="brand-dot" /> NEEDLE</a>
        <p className="session-label"><span className={isRunning ? 'live' : ''} /> {isRunning ? 'focus in progress' : 'focus session'}</p>
        <button className="sound-button" aria-label={muted ? 'Turn sound on' : 'Mute sound'} onClick={() => setMuted((value) => !value)}>
          {muted ? <VolumeX /> : <Volume2 />}
        </button>
      </header>

      <section className="workspace">
        <div className="player-column">
          <div className="eyebrow">NOW SPINNING · {String(currentIndex + 1).padStart(2, '0')}</div>
          <div className={`turntable ${isRunning ? 'is-playing' : ''}`} aria-label={`Vinyl turntable playing ${currentTrack.title}`}>
            <div className="platter"><div className="record"><div className="record-label"><span>{currentTrack.title}</span><small>{currentTrack.artist}</small></div></div></div>
            <div className="tonearm"><span className="pivot" /><span className="arm" /><span className="needle" /></div>
            <button className="power" onClick={startOrToggle} aria-label={isRunning ? 'Pause player' : 'Start player'}><i /><small>{isRunning ? 'ON' : 'OFF'}</small></button>
          </div>

          <div className="track-heading">
            <div><p>TRACK {String(currentIndex + 1).padStart(2, '0')} / {String(tracks.length).padStart(2, '0')}</p><h1>{currentTrack.title}</h1><span>{currentTrack.artist}</span></div>
            <div className={`eq ${isRunning ? 'moving' : ''}`} aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
          </div>
          <input className="progress-range" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} aria-label="Track position" onChange={(event) => { const next = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = next; setCurrentTime(next); }} style={{ '--progress': `${duration ? (currentTime / duration) * 100 : 0}%` } as CSSProperties} />
          <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          <div className="controls">
            <button aria-label="Restart track" onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; }}><RotateCcw /></button>
            <button aria-label="Previous track" onClick={() => changeTrack(-1)}><SkipBack /></button>
            <button className="primary-control" aria-label={isRunning ? 'Pause session' : 'Play session'} onClick={startOrToggle}>{isRunning ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
            <button aria-label="Next track" onClick={() => changeTrack(1)}><SkipForward /></button>
            <button aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX /> : <Volume2 />}</button>
          </div>
        </div>

        <aside className="focus-panel">
          <div className="timer-head">
            <div><p>FOCUS TIMER</p><h2 aria-live="polite">{formatTime(secondsLeft)}</h2></div>
            <button aria-label="Reset timer" onClick={resetSession}><RotateCcw /></button>
          </div>
          <div className="presets" aria-label="Focus duration">
            {[15, 25, 45, 60].map((minutes) => <button disabled={isRunning} className={minutes === selectedMinutes ? 'active' : ''} key={minutes} onClick={() => setMinutes(minutes)}>{minutes}</button>)}
          </div>
          <label className="custom-time">
            <span>Custom</span>
            <input disabled={isRunning} type="number" min="1" max="180" inputMode="numeric" placeholder="minutes" value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} onBlur={commitCustomMinutes} onKeyDown={(event) => { if (event.key === 'Enter') commitCustomMinutes(); }} />
            <small>MIN</small>
          </label>
          <button className={`start-button ${isRunning ? 'active' : ''}`} onClick={startOrToggle}>{isRunning ? <Pause fill="currentColor" /> : <Play fill="currentColor" />} {isRunning ? 'PAUSE FOCUS' : sessionState === 'paused' ? 'RESUME FOCUS' : 'START FOCUS'}</button>

          <div className="playlist-head"><div><p>YOUR SESSION</p><h3>Focus flow</h3></div><span>{formatTime(queue.total)} · {queue.items.length} TRACKS</span></div>
          <ol className="playlist">
            {queue.items.map(({ track, sourceIndex, duration: trackDuration, queueIndex }) => (
              <li className={sourceIndex === currentIndex ? 'playing' : ''} key={`${track.title}-${queueIndex}`}>
                <button onClick={() => selectTrack(sourceIndex)} aria-label={`Play ${track.title} by ${track.artist}`}>
                  <span className="track-index">{String(queueIndex + 1).padStart(2, '0')}</span>
                  <span className="track-copy"><strong>{track.title}</strong><small>{track.artist}</small></span>
                  <time>{formatTime(trackDuration)}</time>
                </button>
              </li>
            ))}
          </ol>
          <p className="queue-note"><span /> The last track fades when your focus session ends.</p>
        </aside>
      </section>

      {finishOpen && (
        <div className="finish-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setFinishOpen(false); }}>
          <section className="finish-dialog" role="alertdialog" aria-modal="true" aria-labelledby="finish-title" aria-describedby="finish-description">
            <div className="finish-icon"><BellRing /></div>
            <h2 id="finish-title">Focus session complete</h2>
            <p id="finish-description">You gave this moment your full attention. Take a breath before the next spin.</p>
            <button autoFocus onClick={resetSession}>START ANOTHER SESSION</button>
          </section>
        </div>
      )}
    </main>
  );
}
