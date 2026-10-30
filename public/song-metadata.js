export function songLanguages(song) {
  const values = [song?.language, ...(Array.isArray(song?.languages) ? song.languages : [])];
  const languages = new Map();
  for (const value of values) for (const token of String(value || '').split(/[,;|/]/)) {
    const name = token.trim();
    if (name) languages.set(name.toLocaleLowerCase(), name);
  }
  return [...languages.values()];
}

export function songInitial(song, sortBy = 'artist') {
  const text = String(song?.[sortBy === 'title' ? 'title' : 'artist'] || '').trim()
    .normalize('NFKD').replace(/\p{M}/gu, '').toLocaleUpperCase();
  const initial = Array.from(text)[0] || '';
  return /\p{L}/u.test(initial) ? initial : '#';
}
