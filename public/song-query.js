// Frontend-independent helper; request owns transport, authorization and timeout.
export async function loadSongs(request, {signal, pageSize = 100} = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw Error('invalid_page');
  const songs = [];
  let snapshotId = '', total = null;
  for (;;) {
    signal?.throwIfAborted();
    const reply = await request('song.list', {offset:songs.length, limit:pageSize, ...(snapshotId ? {snapshotId} : {})}, {signal});
    signal?.throwIfAborted();
    if (!reply?.accepted) throw Error(reply?.reason || 'song_query_failed');
    const data = reply.data;
    if (!data || typeof data.snapshotId !== 'string' || !data.snapshotId ||
        !Number.isSafeInteger(data.total) || data.total < 0 || data.offset !== songs.length ||
        !Array.isArray(data.songs) || data.songs.length > pageSize) throw Error('invalid_song_page');
    if (snapshotId && (snapshotId !== data.snapshotId || total !== data.total)) throw Error('snapshot_changed');
    snapshotId = data.snapshotId; total = data.total;
    if (songs.length + data.songs.length > total || (!data.songs.length && songs.length < total)) throw Error('invalid_song_page');
    songs.push(...data.songs);
    if (songs.length === total) return {snapshotId, songs};
  }
}
