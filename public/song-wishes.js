export function createSongWishes({send, identity, document}) {
  const form = document.getElementById('wishForm');
  const input = document.getElementById('wishInput');
  const list = document.getElementById('wishList');
  const status = document.getElementById('wishStatus');
  form?.addEventListener('submit', event => {
    event.preventDefault();
    if (!send({type:'wish.add', text:input.value})) status.textContent = 'Not connected.';
  });
  return {handle(message) {
    if (message.type === 'client.joined') {
      list?.replaceChildren();
      send({type:'wish.list'});
    }
    if (message.type === 'wish.ack') {
      status.textContent = message.accepted ? '' : ({wish_duplicate:'Already suggested.', wish_limit:'Limit reached (five per guest).',
        wish_text_invalid:'Enter up to 120 characters.', not_controller:'Only the requester or a controller can remove this wish.'}[message.reason] || 'Could not update wishes.');
      if (message.accepted && message.action === 'wish.add') input.value = '';
      return true;
    }
    if (message.type !== 'wish.state') return false;
    list?.replaceChildren();
    for (const wish of message.wishes || []) {
      const row = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = `${wish.text} — ${wish.name}`;
      row.append(text);
      const self = identity();
      if (wish.playerId === self.playerId || self.role === 'controller') {
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Remove';
        remove.addEventListener('click', () => send({type:'wish.remove', id:wish.id}));
        row.append(remove);
      }
      list?.append(row);
    }
    return true;
  }};
}
