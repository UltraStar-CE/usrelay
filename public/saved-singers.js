const key = 'usrelay.saved-singers.v1';
export function singerProfile(value) {
  return {name:String(value?.name || '').trim().slice(0,24),
    difficultyMode:String(value?.difficultyMode || 'free'), difficulty:Number(value?.difficulty) || 0,
    avatarId:String(value?.avatarId || '').slice(0,128), avatarFile:String(value?.avatarFile || '').slice(0,160)};
}
export function createSavedSingers({document, storage, state, send}) {
  const root = document.getElementById('savedSingers');
  const target = document.getElementById('rosterTarget');
  const select = document.getElementById('rosterSaved');
  const status = document.getElementById('rosterStatus');
  let profiles = [];
  try { const saved = JSON.parse(storage.getItem(key) || '[]');
    if (Array.isArray(saved)) profiles = saved.slice(0,24).map(singerProfile).filter(p=>p.name);
  } catch {}
  let signature = '';
  function persist() {
    try {storage.setItem(key, JSON.stringify(profiles)); return true;}
    catch {status.textContent = 'Could not save on this browser.'; return false;}
  }
  function savedOptions() {
    select.replaceChildren();
    profiles.forEach((profile,index)=>{
      const option = document.createElement('option'); option.value = String(index); option.textContent = profile.name;
      select.append(option);
    });
  }
  savedOptions();
  document.getElementById('rosterSave').addEventListener('click', () => {
    const player = state().players.find(p=>p.playerId === target.value);
    if (!player) return;
    if (profiles.length >= 24) {status.textContent = 'Remove a saved singer first (24 maximum).'; return;}
    profiles.push(singerProfile(player)); persist(); savedOptions(); select.value = String(profiles.length-1);
  });
  document.getElementById('rosterApply').addEventListener('click', () => {
    const profile = profiles[Number(select.value)];
    if (profile && target.value && !send({type:'player.roster.apply', targetPlayerId:target.value, profile}))
      status.textContent = 'Not connected.';
  });
  document.getElementById('rosterDelete').addEventListener('click', () => {
    if (!select.value || !profiles.length) return;
    profiles.splice(Number(select.value),1); persist(); savedOptions();
  });
  return {render() {
    const current = state();
    root.hidden = current.role !== 'controller';
    const players = (current.players || []).filter(p=>p.connected !== false);
    const next = JSON.stringify(players.map(p=>[p.playerId,p.name]));
    if (signature === next) return;
    signature = next;
    const previous = target.value;
    target.replaceChildren();
    for (const player of players) {
      const option = document.createElement('option'); option.value = player.playerId; option.textContent = player.name;
      target.append(option);
    }
    if (players.some(p=>p.playerId === previous)) target.value = previous;
  }, handle(message) {
    if (message.type !== 'roster.ack') return false;
    status.textContent = message.accepted ? 'Singer applied.' : `Could not apply singer: ${message.reason}`;
    return true;
  }};
}
