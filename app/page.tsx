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

function playAnalogClick(muted: boolean, weight: 'light' | 'firm' = 'light') {
  if (muted) return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.value = weight === 'firm' ? 0.62 : 0.46;
  master.connect(context.destination);

  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.045), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    const envelope = 1 - index / data.length;
    data[index] = (Math.random() * 2 - 1) * envelope * envelope;
  }
  const snap = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const snapGain = context.createGain();
  snap.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = weight === 'firm' ? 920 : 1320;
  filter.Q.value = 0.75;
  snapGain.gain.setValueAtTime(0.09, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  snap.connect(filter).connect(snapGain).connect(master);

  const thud = context.createOscillator();
  const thudGain = context.createGain();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(weight === 'firm' ? 165 : 220, now);
  thud.frequency.exponentialRampToValueAtTime(82, now + 0.07);
  thudGain.gain.setValueAtTime(weight === 'firm' ? 0.11 : 0.075, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
  thud.connect(thudGain).connect(master);
  snap.start(now);
  thud.start(now);
  thud.stop(now + 0.08);
  window.setTimeout(() => void context.close(), 180);
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
  const [isStarting, setIsStarting] = useState(false);

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
    playAnalogClick(muted, 'firm');
    const value = Math.min(180, Math.max(1, minutes));
    setSelectedMinutes(value);
    setSecondsLeft(value * 60);
    setSessionState('idle');
  };

  const startOrToggle = async () => {
    const audio = audioRef.current;
    if (!audio || isStarting) return;
    if (sessionState === 'running') {
      playAnalogClick(muted, 'firm');
      audio.pause();
      setSessionState('paused');
      return;
    }
    if (sessionState === 'paused') playAnalogClick(muted, 'firm');
    if (sessionState === 'finished' || secondsLeft === 0) setSecondsLeft(selectedMinutes * 60);
    if (sessionState === 'idle' || sessionState === 'finished') {
      const power = powerRef.current;
      if (power && !muted) {
        setIsStarting(true);
        audio.volume = 0;
        try {
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
        } catch { /* The startup sound still gets its own play attempt below. */ }
        audio.volume = 1;
        power.currentTime = 0;
        power.volume = 0.92;
        await new Promise<void>((resolve) => {
          let timeout = 0;
          const finish = () => {
            window.clearTimeout(timeout);
            power.removeEventListener('ended', finish);
            power.removeEventListener('error', finish);
            resolve();
          };
          power.addEventListener('ended', finish, { once: true });
          power.addEventListener('error', finish, { once: true });
          timeout = window.setTimeout(finish, 6200);
          void power.play().catch(finish);
        });
      }
    }
    try {
      await audio.play();
      setSessionState('running');
    } catch {
      setSessionState('paused');
    }
    setIsStarting(false);
  };

  const resetSession = () => {
    playAnalogClick(muted, 'firm');
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setSecondsLeft(selectedMinutes * 60);
    setSessionState('idle');
    setFinishOpen(false);
  };

  const changeTrack = (direction: number, withSound = true) => {
    if (withSound) playAnalogClick(muted);
    setCurrentIndex((index) => (index + direction + tracks.length) % tracks.length);
  };

  const selectTrack = (index: number) => {
    playAnalogClick(muted);
    setCurrentIndex(index);
  };

  const handleEnded = () => changeTrack(1, false);
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

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (!nextMuted) playAnalogClick(false, 'firm');
  };

  return (
    <main className="app-shell">
      <audio ref={audioRef} src={sourceFor(currentTrack.file)} muted={muted} onEnded={handleEnded} onLoadedMetadata={handleMetadata} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} />
      <audio ref={powerRef} src="/audio/sounds/turning-on-the-gramophone.mp3" muted={muted} preload="auto" />

      <header className="topbar">
        <a className="brand" href="#" aria-label="Needle home"><span className="brand-dot" /> NEEDLE</a>
        <nav className="session-nav" aria-label="Player sections"><span>FOR YOU</span><strong>MUSIC</strong><span>SESSION</span></nav>
        <button className="sound-button" aria-label={muted ? 'Turn sound on' : 'Mute sound'} onClick={toggleMute}>
          {muted ? <VolumeX /> : <Volume2 />}
        </button>
      </header>

      <section className="workspace">
        <div className="player-column">
          <div className="eyebrow">NOW SPINNING · {String(currentIndex + 1).padStart(2, '0')}</div>
          <div className={`turntable ${isRunning ? 'is-playing' : ''} ${isStarting ? 'is-starting' : ''}`} aria-label={`Vinyl turntable playing ${currentTrack.title}`}>
            <div className="platter"><div className="record"><div className="record-label"><span>{currentTrack.title}</span><small>{currentTrack.artist}</small></div></div></div>
            <div className="tonearm"><span className="pivot" /><span className="arm" /><span className="needle" /></div>
            <button className="power" onClick={startOrToggle} aria-label={isRunning ? 'Pause player' : 'Start player'}><i /><small>{isRunning ? 'ON' : 'OFF'}</small></button>
            <div className="speed-switch" aria-hidden="true"><i /><small>33</small><small>45</small></div>
          </div>

          <div className="track-heading">
            <div><p>TRACK {String(currentIndex + 1).padStart(2, '0')} / {String(tracks.length).padStart(2, '0')}</p><h1>{currentTrack.title}</h1><span>{currentTrack.artist}</span><div className="track-tags"><b>FOCUS MIX</b><b>VINYL</b><b>{tracks.length} TRACKS</b></div></div>
            <div className={`eq ${isRunning ? 'moving' : ''}`} aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
          </div>
          <input className="progress-range" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} aria-label="Track position" onPointerDown={() => playAnalogClick(muted)} onChange={(event) => { const next = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = next; setCurrentTime(next); }} style={{ '--progress': `${duration ? (currentTime / duration) * 100 : 0}%` } as CSSProperties} />
          <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          <div className="controls">
            <button aria-label="Restart track" onClick={() => { playAnalogClick(muted); if (audioRef.current) audioRef.current.currentTime = 0; }}><RotateCcw /></button>
            <button aria-label="Previous track" onClick={() => changeTrack(-1)}><SkipBack /></button>
            <button className="primary-control" aria-label={isRunning ? 'Pause session' : 'Play session'} onClick={startOrToggle}>{isRunning ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
            <button aria-label="Next track" onClick={() => changeTrack(1)}><SkipForward /></button>
            <button aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>{muted ? <VolumeX /> : <Volume2 />}</button>
          </div>
        </div>

        <aside className="focus-panel">
          <div className="timer-head">
            <div><p>FOCUS TIMER</p><h2 aria-live="polite">{formatTime(secondsLeft)}</h2></div>
            <button disabled={isStarting} aria-label="Reset timer" onClick={resetSession}><RotateCcw /></button>
          </div>
          <div className="presets" aria-label="Focus duration">
            {[5, 10, 15, 25, 45, 60].map((minutes) => <button disabled={isRunning || isStarting} className={minutes === selectedMinutes ? 'active' : ''} key={minutes} onClick={() => setMinutes(minutes)}>{minutes}</button>)}
          </div>
          <label className="custom-time">
            <span>Custom</span>
            <input disabled={isRunning || isStarting} type="number" min="1" max="180" inputMode="numeric" placeholder="minutes" value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} onBlur={commitCustomMinutes} onKeyDown={(event) => { if (event.key === 'Enter') commitCustomMinutes(); }} />
            <small>MIN</small>
          </label>
          <button disabled={isStarting} className={`start-button ${isRunning ? 'active' : ''} ${isStarting ? 'starting' : ''}`} onClick={startOrToggle}>{isRunning ? <Pause fill="currentColor" /> : <Play fill="currentColor" />} {isStarting ? 'DROPPING THE NEEDLE…' : isRunning ? 'PAUSE FOCUS' : sessionState === 'paused' ? 'RESUME FOCUS' : 'START FOCUS'}</button>
          <p className="startup-note"><span /> Needle drop plays before every new session</p>

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
