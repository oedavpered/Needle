import { NextResponse } from 'next/server';

const allowedGenres = new Set(['Ambient', 'Electronic', 'Classical', 'Lo-Fi']);

type AudiusTrack = {
  id?: string;
  title?: string;
  duration?: number;
  is_streamable?: boolean;
  artwork?: { '480x480'?: string; '1000x1000'?: string };
  user?: { name?: string };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedGenre = searchParams.get('genre') || 'Ambient';
  const genre = allowedGenres.has(requestedGenre) ? requestedGenre : 'Ambient';

  try {
    const endpoint = new URL('https://api.audius.co/v1/tracks/trending');
    endpoint.searchParams.set('genre', genre);
    endpoint.searchParams.set('time', 'month');
    endpoint.searchParams.set('limit', '24');
    const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Audius returned ${response.status}`);
    const payload = await response.json() as { data?: AudiusTrack[] };
    const tracks = (payload.data || [])
      .filter((track) => track.id && track.title && track.is_streamable !== false && (track.duration || 0) > 45)
      .slice(0, 18)
      .map((track) => ({
        id: `audius-${track.id}`,
        artist: track.user?.name?.trim() || 'Audius artist',
        title: track.title || 'Untitled',
        src: `https://api.audius.co/v1/tracks/${track.id}/stream`,
        duration: track.duration || 180,
        artwork: track.artwork?.['480x480'] || track.artwork?.['1000x1000'],
        source: 'audius' as const,
      }));
    if (!tracks.length) throw new Error('No streamable tracks');
    return NextResponse.json({ tracks }, { headers: { 'Cache-Control': 'public, max-age=120, s-maxage=300' } });
  } catch {
    return NextResponse.json({ tracks: [], error: 'Audius is temporarily unavailable' }, { status: 503 });
  }
}
