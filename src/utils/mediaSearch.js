const TMDB_TOKEN = process.env.EXPO_PUBLIC_TMDB_KEY;
const TMDB_BASE  = 'https://api.themoviedb.org/3';
const TMDB_HEADS = { Authorization: `Bearer ${TMDB_TOKEN}`, 'Content-Type': 'application/json' };

function tmdbYear(dateStr) {
  return dateStr ? dateStr.slice(0, 4) : null;
}

export async function searchMovies(query) {
  const res = await fetch(
    `${TMDB_BASE}/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1`,
    { headers: TMDB_HEADS }
  );
  if (!res.ok) throw new Error(`TMDB movies ${res.status}`);
  const { results } = await res.json();
  return (results ?? []).slice(0, 8).map(m => ({
    id:       String(m.id),
    tmdb_id:  String(m.id),
    title:    m.title,
    year:     tmdbYear(m.release_date),
    type:     'movie',
    overview: m.overview,
    rating:   m.vote_average,
    poster:   m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : null,
  }));
}

export async function searchShows(query) {
  const res = await fetch(
    `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=1`,
    { headers: TMDB_HEADS }
  );
  if (!res.ok) throw new Error(`TMDB shows ${res.status}`);
  const { results } = await res.json();
  return (results ?? []).slice(0, 8).map(s => ({
    id:       String(s.id),
    tmdb_id:  String(s.id),
    title:    s.name,
    year:     tmdbYear(s.first_air_date),
    type:     'show',
    overview: s.overview,
    rating:   s.vote_average,
    poster:   s.poster_path ? `https://image.tmdb.org/t/p/w92${s.poster_path}` : null,
  }));
}

export async function searchBooks(query) {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,first_publish_year,author_name,cover_i,edition_count`
  );
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const { docs } = await res.json();
  return (docs ?? [])
    .filter(b => b.title && b.edition_count > 0)
    .slice(0, 8)
    .map(b => ({
      id:      b.key,
      tmdb_id: null,
      title:   b.title,
      year:    b.first_publish_year ? String(b.first_publish_year) : null,
      type:    'book',
      overview: null,
      rating:  null,
      poster:  b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
      authors: (b.author_name ?? []).slice(0, 2).join(', '),
    }));
}

const RAWG_KEY = process.env.EXPO_PUBLIC_RAWG_KEY ?? '';

export async function searchGames(query) {
  const res = await fetch(
    `https://api.rawg.io/api/games?search=${encodeURIComponent(query)}&page_size=8&key=${RAWG_KEY}`
  );
  if (!res.ok) throw new Error(`RAWG ${res.status}`);
  const { results } = await res.json();
  return (results ?? []).map(g => ({
    id:       String(g.id),
    tmdb_id:  null,
    title:    g.name,
    year:     g.released ? g.released.slice(0, 4) : null,
    type:     'game',
    overview: null,
    rating:   g.rating ?? null,
    poster:   g.background_image ?? null,
    genres:   (g.genres ?? []).map(x => x.name).join(', '),
    esrb:     g.esrb_rating?.name ?? null,
  }));
}

const YT_KEY = process.env.EXPO_PUBLIC_YOUTUBE_KEY ?? '';

export async function searchChannels(query) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=8&key=${YT_KEY}`
  );
  if (!res.ok) throw new Error(`YouTube channels ${res.status}`);
  const { items } = await res.json();
  return (items ?? []).map(item => ({
    id:           item.id.channelId,
    tmdb_id:      item.id.channelId,
    title:        item.snippet.title,
    year:         null,
    type:         'channel',
    overview:     item.snippet.description,
    rating:       null,
    poster:       item.snippet.thumbnails?.medium?.url ?? null,
    channelTitle: item.snippet.title,
  }));
}

export async function searchVideos(query) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=8&key=${YT_KEY}`
  );
  if (!res.ok) throw new Error(`YouTube videos ${res.status}`);
  const { items } = await res.json();
  return (items ?? []).map(item => ({
    id:           item.id.videoId,
    tmdb_id:      item.id.videoId,
    title:        item.snippet.title,
    year:         item.snippet.publishedAt?.slice(0, 4) ?? null,
    type:         'video',
    overview:     item.snippet.description,
    rating:       null,
    poster:       item.snippet.thumbnails?.medium?.url ?? null,
    channelTitle: item.snippet.channelTitle,
  }));
}

export async function searchMedia(query, type) {
  switch (type) {
    case 'movie':   return searchMovies(query);
    case 'show':    return searchShows(query);
    case 'book':    return searchBooks(query);
    case 'game':    return searchGames(query);
    case 'channel': return searchChannels(query);
    case 'video':   return searchVideos(query);
    default:        return [];
  }
}
