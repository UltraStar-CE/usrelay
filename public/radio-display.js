export function radioTracks(message, songSeq) {
  if (!message || (message.songSeq!=null && Number(message.songSeq)!==Number(songSeq)))return [];
  return Array.isArray(message.tracks)?message.tracks:message.text?[{text:String(message.text),notes:[]}]:[];
}
export function createRadioDisplay({document,state,position,progress,renderLyrics,control,music,wake}) {
  const root=document.getElementById('radioPanel'),lyrics=document.getElementById('radioLyrics');
  const status=document.getElementById('radioStatus'),title=document.getElementById('radioTitle');
  const bar=document.getElementById('radioProgress'),scores=document.getElementById('radioScores');
  document.getElementById('radioMusic').addEventListener('click',()=>music());
  document.getElementById('radioPrevious').addEventListener('click',()=>control('continuous.previous'));
  document.getElementById('radioNext').addEventListener('click',()=>control('continuous.skip'));
  document.getElementById('radioPause').addEventListener('click',()=>control(state().gameState==='paused'?'game.resume':'game.pause'));
  document.getElementById('radioWake').addEventListener('click',()=>wake());
  document.getElementById('radioFullscreen').addEventListener('click',async()=>{
    try {if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();}
    catch {status.textContent='Fullscreen is unavailable in this browser.';}
  });
  return {render() {
    const current=state(),tracks=radioTracks(current.currentLyricsMessage,current.songSeq);
    title.textContent=[current.currentSongMessage?.artist,current.currentSongMessage?.title].filter(Boolean).join(' - ')||'Waiting for a song';
    while(lyrics.children.length>tracks.length)lyrics.lastElementChild.remove();
    while(lyrics.children.length<tracks.length)lyrics.append(document.createElement('p'));
    tracks.forEach((track,index)=>renderLyrics(lyrics.children[index],track,position()));
    bar.value=progress();
    const showScores=document.getElementById('radioShowScores').checked;
    scores.textContent=showScores?(current.scoreSnapshot?.players||[]).map(p=>`${p.name||`Player ${p.slot}`}: ${p.scoreTotal||0}`).join(' / '):'';
    document.getElementById('radioPause').textContent=current.gameState==='paused'?'Resume':'Pause';
    if(current.hostRecovering)status.textContent='Game disconnected. Reconnecting…';
  }};
}
