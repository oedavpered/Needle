'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  BellRing,
  Cloud,
  Disc3,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Shuffle,
  SkipBack,
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
  source: 'local' | 'audius';
};
type SessionState = 'idle' | 'running' | 'paused' | 'finished';
type MusicSource = 'local' | 'audius';
type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

const localSource = (file: string) => `/audio/tracks/${encodeURIComponent(file)}`;
const localTracks: Track[] = [
  { id: 'local-cat', artist: 'Drove Amaro', title: 'Cat', src: localSource('Drove Amaro - Cat (hitmos.fm).mp3'), duration: 241, source: 'local' },
  { id: 'local-chill-tune', artist: 'Nicolai Heidlas', title: 'Chill Tune', src: localSource('Nicolai Heidlas - Chill Tune (hitmos.fm).mp3'), duration: 238, source: 'local' },
  { id: 'local-low-end', artist: 'Michael FK', title: 'Low End Theory', src: localSource('Michael FK - Low End Theory (hitmos.fm).mp3'), duration: 246, source: 'local' },
  { id: 'local-dance', artist: 'Content Sounds', title: 'Dance', src: localSource('Content Sounds - Dance (hitmos.fm).mp3'), duration: 142, source: 'local' },
  { id: 'local-pheromones', artist: 'Biometrix', title: 'Pheromones', src: localSource('Biometrix - Pheromones (hitmos.fm).mp3'), duration: 211, source: 'local' },
  { id: 'local-from-inside', artist: 'C152', title: 'From Inside', src: localSource('C152 - From Inside (hitmos.fm).mp3'), duration: 155, source: 'local' },
  { id: 'local-close-to-me', artist: 'C152 feat. Sam Ho', title: 'Close To Me', src: localSource('C152 feat Sam Ho - Close To Me (hitmos.fm).mp3'), duration: 137, source: 'local' },
  { id: 'local-feeling-good', artist: 'Ron Gelinas', title: 'Feeling Good', src: localSource('Ron Gelinas - Feeling Good (hitmos.fm).mp3'), duration: 220, source: 'local' },
];

const moods = [
  { label: 'CALM', genre: 'Ambient' },
  { label: 'FLOW', genre: 'Electronic' },
  { label: 'DEEP', genre: 'Classical' },
  { label: 'LO-FI', genre: 'Lo-Fi' },
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

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const powerRef = useRef<HTMLAudioElement>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(localTracks[0].duration);
  const [knownDurations, setKnownDurations] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [musicSource, setMusicSource] = useState<MusicSource>('audius');
  const [genre, setGenre] = useState('Ambient');
  const [onlineTracks, setOnlineTracks] = useState<Track[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('idle');
  const [refreshKey, setRefreshKey] = useState(0);
  const [shuffleKey, setShuffleKey] = useState(1);

  useEffect(() => {
    if (musicSource !== 'audius') return;
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
  }, [genre, musicSource, refreshKey]);

  const isAudiusReady = musicSource === 'audius' && catalogStatus === 'ready' && onlineTracks.length > 0;
  const catalogTracks = isAudiusReady ? onlineTracks : localTracks;
  const activeTracks = useMemo(() => shuffleTracks(catalogTracks, shuffleKey), [catalogTracks, shuffleKey]);
  const safeIndex = currentIndex % activeTracks.length;
  const currentTrack = activeTracks[safeIndex];
  const isRunning = sessionState === 'running';
  const isCatalogLoading = musicSource === 'audius' && catalogStatus === 'loading';

  const queue = useMemo(() => {
    const result: { track: Track; sourceIndex: number; duration: number; queueIndex: number }[] = [];
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
  }, [activeTracks, knownDurations, selectedMinutes]);

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

  const setMinutes = (minutes: number) => {
    if (isRunning || isStarting) return;
    playAnalogClick(muted, 'firm');
    const value = Math.min(180, Math.max(1, minutes));
    setSelectedMinutes(value);
    setSecondsLeft(value * 60);
    setSessionState('idle');
    setShuffleKey((key) => key + 1);
    setCurrentIndex(0);
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
      if (currentTrack.source === 'audius') setCatalogStatus('error');
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

  const chooseSource = (source: MusicSource) => {
    if (source === musicSource || isRunning || isStarting) return;
    playAnalogClick(muted, 'firm');
    audioRef.current?.pause();
    setSessionState('idle');
    setSecondsLeft(selectedMinutes * 60);
    setCurrentIndex(0);
    setMusicSource(source);
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
  const sourceLabel = isAudiusReady ? 'AUDIUS' : musicSource === 'audius' && catalogStatus === 'error' ? 'LOCAL BACKUP' : 'MY RECORDS';

  return (
    <main className="app-shell">
      <audio ref={audioRef} src={currentTrack.src} muted={muted} onEnded={() => changeTrack(1, false)} onError={() => { if (currentTrack.source === 'audius') { setCatalogStatus('error'); setCurrentIndex(0); } }} onLoadedMetadata={handleMetadata} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} />
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
            <div className="platter"><div className="record"><div className={`record-label ${currentTrack.artwork ? 'has-artwork' : ''}`} style={labelStyle}><span>{currentTrack.title}</span><small>{currentTrack.artist}</small></div></div></div>
            <div className="tonearm"><span className="pivot" /><span className="arm" /><span className="needle" /></div>
            <button className="power" onClick={startOrToggle} aria-label={isRunning ? 'Pause player' : 'Start player'}><i /><small>{isRunning ? 'ON' : 'OFF'}</small></button>
            <div className="speed-switch" aria-hidden="true"><i /><small>33</small><small>45</small></div>
          </div>

          <div className="track-heading">
            <div><p>TRACK {String(safeIndex + 1).padStart(2, '0')} / {String(activeTracks.length).padStart(2, '0')}</p><h1>{currentTrack.title}</h1><span>{currentTrack.artist}</span><div className="track-tags"><b>FOCUS MIX</b><b>{sourceLabel}</b><b>{activeTracks.length} TRACKS</b></div></div>
            <div className={`eq ${isRunning ? 'moving' : ''}`} aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
          </div>
          <input className="progress-range" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} aria-label="Track position" onPointerDown={() => playAnalogClick(muted)} onChange={(event) => { const next = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = next; setCurrentTime(next); }} style={{ '--progress': `${duration ? (currentTime / duration) * 100 : 0}%` } as CSSProperties} />
          <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          <div className="controls">
            <button aria-label="Restart track" onClick={() => { playAnalogClick(muted); if (audioRef.current) audioRef.current.currentTime = 0; }}><RotateCcw /></button>
            <button aria-label="Previous track" onClick={() => changeTrack(-1)}><SkipBack /></button>
            <button disabled={isCatalogLoading} className="primary-control" aria-label={isRunning ? 'Pause session' : 'Play session'} onClick={startOrToggle}>{isRunning ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
            <button aria-label="Next track" onClick={() => changeTrack(1)}><SkipForward /></button>
            <button aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>{muted ? <VolumeX /> : <Volume2 />}</button>
          </div>
        </div>

        <aside className="focus-panel">
          <div className="catalog-controls">
            <div className="source-switch" aria-label="Music source">
              <button disabled={isRunning || isStarting} className={musicSource === 'audius' ? 'active' : ''} onClick={() => chooseSource('audius')}><Cloud /> AUDIUS</button>
              <button disabled={isRunning || isStarting} className={musicSource === 'local' ? 'active' : ''} onClick={() => chooseSource('local')}><Disc3 /> MY RECORDS</button>
            </div>
            {musicSource === 'audius' && <div className="mood-row"><div className="moods">{moods.map((mood) => <button disabled={isRunning || isStarting} className={genre === mood.genre ? 'active' : ''} key={mood.genre} onClick={() => chooseMood(mood.genre)}>{mood.label}</button>)}</div><button className="refresh-catalog" disabled={isRunning || isStarting} onClick={randomizeQueue} aria-label="Shuffle playlist"><Shuffle /></button><button className="refresh-catalog" disabled={isCatalogLoading || isRunning || isStarting} onClick={refreshAudius} aria-label="Refresh Audius playlist"><RefreshCw className={isCatalogLoading ? 'spinning' : ''} /></button></div>}
            {musicSource === 'audius' && <p className={`catalog-status ${catalogStatus}`}><span />{catalogStatus === 'loading' ? 'TUNING INTO AUDIUS…' : catalogStatus === 'error' ? 'AUDIUS IS QUIET — PLAYING LOCAL BACKUP' : `${genre.toUpperCase()} STREAM · LIVE FROM AUDIUS`}</p>}
          </div>

          <div className="timer-head"><div><p>FOCUS TIMER</p><h2 aria-live="polite">{formatTime(secondsLeft)}</h2></div><button disabled={isStarting} aria-label="Reset timer" onClick={resetSession}><RotateCcw /></button></div>
          <div className="presets" aria-label="Focus duration">{[5, 10, 15, 25, 45, 60].map((minutes) => <button disabled={isRunning || isStarting} className={minutes === selectedMinutes ? 'active' : ''} key={minutes} onClick={() => setMinutes(minutes)}>{minutes}</button>)}</div>
          <label className="custom-time"><span>Custom</span><input disabled={isRunning || isStarting} type="number" min="1" max="180" inputMode="numeric" placeholder="minutes" value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} onBlur={commitCustomMinutes} onKeyDown={(event) => { if (event.key === 'Enter') commitCustomMinutes(); }} /><small>MIN</small></label>
          <button disabled={isStarting || isCatalogLoading} className={`start-button ${isRunning ? 'active' : ''} ${isStarting || isCatalogLoading ? 'starting' : ''}`} onClick={startOrToggle}>{isRunning ? <Pause fill="currentColor" /> : <Play fill="currentColor" />} {isCatalogLoading ? 'TUNING INTO AUDIUS…' : isStarting ? 'DROPPING THE NEEDLE…' : isRunning ? 'PAUSE FOCUS' : sessionState === 'paused' ? 'RESUME FOCUS' : 'START FOCUS'}</button>
          <p className="startup-note"><span /> Needle drop plays before every new session</p>

          <div className="playlist-head"><div><p>YOUR SESSION</p><h3>{isAudiusReady ? `${genre} flow` : 'Focus flow'}</h3></div><span>{formatTime(queue.total)} · {queue.items.length} TRACKS</span></div>
          <ol className="playlist">{queue.items.map(({ track, sourceIndex, duration: trackDuration, queueIndex }) => <li className={sourceIndex === safeIndex ? 'playing' : ''} key={`${track.id}-${queueIndex}`}><button onClick={() => selectTrack(sourceIndex)} aria-label={`Play ${track.title} by ${track.artist}`}><span className="track-index">{String(queueIndex + 1).padStart(2, '0')}</span><span className="track-copy"><strong>{track.title}</strong><small>{track.artist}</small></span><time>{formatTime(trackDuration)}</time></button></li>)}</ol>
          <p className="queue-note"><span /> The last track fades when your focus session ends.</p>
        </aside>
      </section>

      {finishOpen && <div className="finish-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setFinishOpen(false); }}><section className="finish-dialog" role="alertdialog" aria-modal="true" aria-labelledby="finish-title" aria-describedby="finish-description"><div className="finish-icon"><BellRing /></div><h2 id="finish-title">Focus session complete</h2><p id="finish-description">You gave this moment your full attention. Take a breath before the next spin.</p><button autoFocus onClick={resetSession}>START ANOTHER SESSION</button></section></div>}
    </main>
  );
}
