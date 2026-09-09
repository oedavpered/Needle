'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  BellRing,
  Cloud,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Shuffle,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';

type Track = {
  id: string;
  artist: string;
  title: string;
  src: string;
  duration: number;
  artwork?: string;
  source: 'audius';
};
type SessionState = 'idle' | 'running' | 'paused' | 'finished';
type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

const placeholderTrack: Track = { id: 'audius-loading', artist: 'Audius', title: 'Tuning in…', src: '', duration: 0, source: 'audius' };

const moods = [
  { label: 'CALM', genre: 'Ambient' },
  { label: 'FLOW', genre: 'Electronic' },
  { label: 'DEEP', genre: 'Classical' },
  { label: 'LO-FI', genre: 'Lo-Fi' },
];

const dialPresets = [
  { minutes: 5, angle: -150 },
  { minutes: 10, angle: -90 },
  { minutes: 15, angle: -30 },
  { minutes: 25, angle: 30 },
  { minutes: 45, angle: 90 },
  { minutes: 60, angle: 150 },
];

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

function shuffleTracks(tracks: Track[], seed: number) {
  const shuffled = [...tracks];
  let state = seed || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function hashTrack(track: Track) {
  const value = `${track.id}:${track.artist}:${track.title}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function getAudioContext() {
  return window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function playFinishChime() {
  const AudioContextClass = getAudioContext();
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
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
  const AudioContextClass = getAudioContext();
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

function playMechanism(muted: boolean, kind: 'dial' | 'plunger') {
  if (muted) return;
  const AudioContextClass = getAudioContext();
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.value = kind === 'plunger' ? .6 : .34;
  master.connect(context.destination);
  const hits = kind === 'dial' ? [0, .022, .044] : [0, .065];
  hits.forEach((delay, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(kind === 'dial' ? 1100 - index * 170 : 150 - index * 55, now + delay);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'dial' ? 420 : 48, now + delay + .055);
    gain.gain.setValueAtTime(kind === 'dial' ? .045 : .12, now + delay);
    gain.gain.exponentialRampToValueAtTime(.001, now + delay + .07);
    oscillator.connect(gain).connect(master);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + .075);
  });
  window.setTimeout(() => void context.close(), 260);
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
  const [duration, setDuration] = useState(0);
  const [knownDurations, setKnownDurations] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.82);
  const [finishOpen, setFinishOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [genre, setGenre] = useState('Ambient');
  const [onlineTracks, setOnlineTracks] = useState<Track[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('idle');
  const [refreshKey, setRefreshKey] = useState(0);
  const [shuffleKey, setShuffleKey] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogStatus('loading');
    fetch(`/api/audius?genre=${encodeURIComponent(genre)}&refresh=${refreshKey}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Audius catalog unavailable');
        return response.json() as Promise<{ tracks: Track[] }>;
      })
      .then(({ tracks }) => {
        if (!tracks.length) throw new Error('No streamable tracks');
        setOnlineTracks(tracks);
        setCurrentIndex(0);
        setCatalogStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setCatalogStatus('error');
      });
    return () => controller.abort();
  }, [genre, refreshKey]);

  const isAudiusReady = catalogStatus === 'ready' && onlineTracks.length > 0;
  const shuffledTracks = useMemo(() => shuffleTracks(onlineTracks, shuffleKey), [onlineTracks, shuffleKey]);
  const activeTracks = shuffledTracks.length ? shuffledTracks : [placeholderTrack];
  const safeIndex = currentIndex % activeTracks.length;
  const currentTrack = activeTracks[safeIndex];
  const isRunning = sessionState === 'running';
  const isCatalogLoading = catalogStatus === 'loading';

  const queue = useMemo(() => {
    const result: { track: Track; sourceIndex: number; duration: number; queueIndex: number }[] = [];
    if (!isAudiusReady) return { items: result, total: 0 };
    let total = 0;
    let cursor = 0;
    const target = selectedMinutes * 60;
    while (total < target && result.length < 60) {
      const sourceIndex = cursor % activeTracks.length;
      const track = activeTracks[sourceIndex];
      const trackDuration = knownDurations[track.id] || track.duration;
      result.push({ track, sourceIndex, duration: trackDuration, queueIndex: cursor });
      total += trackDuration;
      cursor += 1;
    }
    return { items: result, total };
  }, [activeTracks, isAudiusReady, knownDurations, selectedMinutes]);

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
    if (!muted) playFinishChime();
  }, [muted, secondsLeft, sessionState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    setCurrentTime(0);
    setDuration(knownDurations[currentTrack.id] || currentTrack.duration);
    if (isRunning) void audio.play().catch(() => setSessionState('paused'));
  }, [currentTrack.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const setMinutes = (minutes: number, withSound = true) => {
    if (isRunning || isStarting) return;
    if (withSound) playAnalogClick(muted, 'firm');
    const value = Math.min(180, Math.max(1, minutes));
    setSelectedMinutes(value);
    setSecondsLeft(value * 60);
    setSessionState('idle');
    setShuffleKey((key) => key + 1);
    setCurrentIndex(0);
  };

  const cycleTimer = () => {
    if (isRunning || isStarting) return;
    const values = dialPresets.map(({ minutes }) => minutes);
    const current = values.indexOf(selectedMinutes);
    playMechanism(muted, 'dial');
    setMinutes(values[(current < 0 ? 0 : current + 1) % values.length], false);
  };

  const startOrToggle = async () => {
    const audio = audioRef.current;
    if (!audio || isStarting || isCatalogLoading) return;
    if (isRunning) {
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
        } catch { /* Startup sound still gets its own play attempt. */ }
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
      setCatalogStatus('error');
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
    setCurrentIndex((index) => (index + direction + activeTracks.length) % activeTracks.length);
  };

  const plungeNext = () => {
    playMechanism(muted, 'plunger');
    changeTrack(1, false);
  };

  const selectTrack = (index: number) => {
    playAnalogClick(muted);
    setCurrentIndex(index);
  };

  const handleMetadata = () => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    setDuration(audio.duration);
    setKnownDurations((values) => ({ ...values, [currentTrack.id]: audio.duration }));
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

  const chooseMood = (nextGenre: string) => {
    if (nextGenre === genre || isRunning || isStarting) return;
    playAnalogClick(muted);
    setGenre(nextGenre);
    setCurrentIndex(0);
  };

  const refreshAudius = () => {
    if (isRunning || isStarting) return;
    playAnalogClick(muted, 'firm');
    setRefreshKey((value) => value + 1);
  };

  const randomizeQueue = () => {
    if (isRunning || isStarting) return;
    playAnalogClick(muted, 'firm');
    setShuffleKey((key) => key + 1);
    setCurrentIndex(0);
  };

  const labelStyle = currentTrack.artwork ? { '--label-art': `url("${currentTrack.artwork}")` } as CSSProperties : undefined;
  const vinylStyle = useMemo(() => {
    const tone = hashTrack(currentTrack) % 360;
    const phase = isRunning ? currentTime * 4.8 : 0;
    const pulse = isRunning ? (Math.sin(currentTime * 1.9 + tone) + 1) / 2 : 0.22;
    const driftX = 52 + Math.sin(currentTime * 0.31 + tone) * 18;
    const driftY = 42 + Math.cos(currentTime * 0.27 + tone * 0.5) * 20;
    return {
      '--vinyl-hue-a': `${(tone + phase) % 360}`,
      '--vinyl-hue-b': `${(tone + 96 + phase * 0.42) % 360}`,
      '--vinyl-hue-c': `${(tone + 214 - phase * 0.28 + 360) % 360}`,
      '--vinyl-angle': `${(tone * 0.7 + phase) % 360}deg`,
      '--vinyl-glow': `${0.2 + pulse * 0.08}`,
      '--vinyl-glow-soft': `${0.13 + pulse * 0.06}`,
      '--vinyl-glow-faint': `${0.08 + pulse * 0.04}`,
      '--vinyl-x': `${driftX}%`,
      '--vinyl-y': `${driftY}%`,
      '--vinyl-x-alt': `${100 - driftX * 0.72}%`,
      '--vinyl-y-alt': `${100 - driftY * 0.66}%`,
    } as CSSProperties;
  }, [currentTime, currentTrack, isRunning]);
  const moveVinylGlow = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    event.currentTarget.style.setProperty('--pointer-x', `${x}%`);
    event.currentTarget.style.setProperty('--pointer-y', `${y}%`);
    event.currentTarget.style.setProperty('--pointer-opacity', '.92');
  };
  const restVinylGlow = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--pointer-opacity', '.1');
  };
  const sourceLabel = 'AUDIUS';

  return (
    <main className="app-shell">
      <audio ref={audioRef} src={isAudiusReady ? currentTrack.src : undefined} muted={muted} onEnded={() => changeTrack(1, false)} onError={() => { setCatalogStatus('error'); setCurrentIndex(0); }} onLoadedMetadata={handleMetadata} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} />
      <audio ref={powerRef} src="/audio/sounds/turning-on-the-gramophone.mp3" muted={muted} preload="auto" />

      <header className="topbar">
        <a className="brand" href="#" aria-label="Needle home"><span className="brand-dot" /> NEEDLE</a>
        <nav className="session-nav" aria-label="Player sections"><span>FOR YOU</span><strong>MUSIC</strong><span>SESSION</span></nav>
        <button className="sound-button" aria-label={muted ? 'Turn sound on' : 'Mute sound'} onClick={toggleMute}>{muted ? <VolumeX /> : <Volume2 />}</button>
      </header>

      <section className="workspace">
        <div className="player-column">
          <div className="eyebrow">NOW SPINNING · {String(safeIndex + 1).padStart(2, '0')} · {sourceLabel}</div>
          <div className={`turntable ${isRunning ? 'is-playing' : ''} ${isStarting ? 'is-starting' : ''}`} aria-label={`Vinyl turntable playing ${currentTrack.title}`}>
            <div className="platter"><div className="record" style={vinylStyle} onPointerMove={moveVinylGlow} onPointerLeave={restVinylGlow}><div className={`record-label ${currentTrack.artwork ? 'has-artwork' : ''}`} style={labelStyle}><span>{currentTrack.title}</span><small>{currentTrack.artist}</small></div></div></div>
            <div className="tonearm"><span className="pivot" /><span className="arm" /><span className="needle" /></div>
            <div className="deck-console">
              <div className="console-label"><span>NEEDLE</span><small>FOCUS DECK / NF-25</small></div>
              <div className="timer-window"><small>FOCUS REMAINING</small><strong aria-live="polite">{formatTime(secondsLeft)}</strong></div>
              <div className="dial-zone">
                <button className="timer-knob" disabled={isRunning || isStarting} onClick={cycleTimer} aria-label={`Focus timer ${selectedMinutes} minutes. Turn to change`} style={{ '--dial-angle': `${dialPresets.find(({ minutes }) => minutes === selectedMinutes)?.angle ?? 24}deg` } as CSSProperties}><i /></button>
                <div className="dial-legend">{dialPresets.map(({ minutes, angle }) => <button style={{ '--mark-angle': `${angle}deg` } as CSSProperties} disabled={isRunning || isStarting} className={minutes === selectedMinutes ? 'active' : ''} key={minutes} onClick={() => { playMechanism(muted, 'dial'); setMinutes(minutes, false); }}>{minutes}</button>)}</div>
              </div>
              <div className="transport-deck">
                <button className={`play-toggle ${isRunning ? 'active' : ''}`} disabled={!isAudiusReady || isStarting} onClick={startOrToggle} aria-label={isRunning ? 'Pause session' : 'Play session'}><span>{isRunning ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</span><small>{isStarting ? 'STARTING' : isRunning ? 'PAUSE' : 'PLAY'}</small></button>
                <button className="next-plunger" disabled={!isAudiusReady} onClick={plungeNext} aria-label="Next track"><span><SkipForward /></span><small>NEXT</small></button>
                <button className="reset-toggle" disabled={isStarting} onClick={resetSession} aria-label="Reset timer"><RotateCcw /><small>RESET</small></button>
              </div>
              <div className="console-bottom">
                <label className="custom-time"><span>CUSTOM</span><input disabled={isRunning || isStarting} type="number" min="1" max="180" inputMode="numeric" placeholder="MIN" value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} onBlur={commitCustomMinutes} onKeyDown={(event) => { if (event.key === 'Enter') commitCustomMinutes(); }} /></label>
                <label className="volume-control"><span>VOLUME</span><span className="volume-knob" style={{ '--volume-angle': `${-135 + volume * 270}deg` } as CSSProperties}><i /><input type="range" min="0" max="1" step="0.02" value={volume} aria-label="Volume" onPointerDown={() => playMechanism(muted, 'dial')} onChange={(event) => { setVolume(Number(event.target.value)); if (muted) setMuted(false); }} /></span></label>
              </div>
            </div>
          </div>

          <div className="track-heading">
            <div><p>TRACK {String(safeIndex + 1).padStart(2, '0')} / {String(activeTracks.length).padStart(2, '0')}</p><h1>{currentTrack.title}</h1><span>{currentTrack.artist}</span><div className="track-tags"><b>FOCUS MIX</b><b>{sourceLabel}</b><b>{activeTracks.length} TRACKS</b></div></div>
            <div className={`eq ${isRunning ? 'moving' : ''}`} aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
          </div>
          <input className="progress-range" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} aria-label="Track position" onPointerDown={() => playAnalogClick(muted)} onChange={(event) => { const next = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = next; setCurrentTime(next); }} style={{ '--progress': `${duration ? (currentTime / duration) * 100 : 0}%` } as CSSProperties} />
          <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          <div className="catalog-controls catalog-below-player">
            <div className="catalog-title"><Cloud /> AUDIUS CATALOG</div>
            <div className="mood-row"><div className="moods">{moods.map((mood) => <button disabled={isRunning || isStarting} className={genre === mood.genre ? 'active' : ''} key={mood.genre} onClick={() => chooseMood(mood.genre)}>{mood.label}</button>)}</div><button className="refresh-catalog" disabled={isRunning || isStarting || !isAudiusReady} onClick={randomizeQueue} aria-label="Shuffle playlist"><Shuffle /></button><button className="refresh-catalog" disabled={isCatalogLoading || isRunning || isStarting} onClick={refreshAudius} aria-label="Refresh Audius playlist"><RefreshCw className={isCatalogLoading ? 'spinning' : ''} /></button></div>
            <p className={`catalog-status ${catalogStatus}`}><span />{catalogStatus === 'loading' ? 'TUNING INTO AUDIUS…' : catalogStatus === 'error' ? 'AUDIUS IS QUIET — TAP REFRESH TO RETRY' : `${genre.toUpperCase()} STREAM · LIVE FROM AUDIUS`}</p>
          </div>
          <aside className="focus-panel">
          <div className="playlist-head"><div><p>YOUR SESSION</p><h3>{isAudiusReady ? `${genre} flow` : 'Finding your flow'}</h3></div><span>{formatTime(queue.total)} · {queue.items.length} TRACKS</span></div>
          <ol className="playlist">{queue.items.map(({ track, sourceIndex, duration: trackDuration, queueIndex }) => <li className={sourceIndex === safeIndex ? 'playing' : ''} key={`${track.id}-${queueIndex}`}><button onClick={() => selectTrack(sourceIndex)} aria-label={`Play ${track.title} by ${track.artist}`}><span className="track-index">{String(queueIndex + 1).padStart(2, '0')}</span><span className="track-copy"><strong>{track.title}</strong><small>{track.artist}</small></span><time>{formatTime(trackDuration)}</time></button></li>)}</ol>
          <p className="queue-note"><span /> The last track fades when your focus session ends.</p>
          </aside>
        </div>
      </section>

      {finishOpen && <div className="finish-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setFinishOpen(false); }}><section className="finish-dialog" role="alertdialog" aria-modal="true" aria-labelledby="finish-title" aria-describedby="finish-description"><div className="finish-icon"><BellRing /></div><h2 id="finish-title">Focus session complete</h2><p id="finish-description">You gave this moment your full attention. Take a breath before the next spin.</p><button autoFocus onClick={resetSession}>START ANOTHER SESSION</button></section></div>}
    </main>
  );
}
