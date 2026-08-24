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
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&langRestrict=en`
  );
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const { items } = await res.json();
  return (items ?? []).map(b => {
    const info = b.volumeInfo ?? {};
    return {
      id:       b.id,
      tmdb_id:  null,
      title:    info.title,
      year:     info.publishedDate ? info.publishedDate.slice(0, 4) : null,
      type:     'book',
      overview: info.description ?? null,
      rating:   info.averageRating ?? null,
      poster:   info.imageLinks?.thumbnail ?? null,
      authors:  (info.authors ?? []).join(', '),
    };
  });
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

export async function searchMedia(query, type) {
  switch (type) {
    case 'movie': return searchMovies(query);
    case 'show':  return searchShows(query);
    case 'book':  return searchBooks(query);
    case 'game':  return searchGames(query);
    default:      return [];
  }
}
