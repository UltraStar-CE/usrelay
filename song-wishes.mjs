import {randomUUID} from 'node:crypto';

// Wishes are text suggestions, never native catalog IDs or playable requests.
export class SongWishes {
  constructor() { this.items = []; }
  handle(message, player) {
    if (message.type === 'wish.list') return {accepted:true};
    if (message.type === 'wish.add') {
      const text = typeof message.text === 'string' ? message.text.replace(/[\x00-\x1f\x7f]/g, ' ').trim() : '';
      if (!text || text.length > 120) return {accepted:false, reason:'wish_text_invalid'};
      if (this.items.some(w => w.playerId === player.playerId && w.text.toLowerCase() === text.toLowerCase()))
        return {accepted:false, reason:'wish_duplicate'};
      if (this.items.length >= 100 || this.items.filter(w => w.playerId === player.playerId).length >= 5)
        return {accepted:false, reason:'wish_limit'};
      this.items.push({id:randomUUID(), text, playerId:player.playerId, name:player.name});
      return {accepted:true};
    }
    if (message.type === 'wish.remove') {
      const item = this.items.find(w => w.id === message.id);
      if (!item) return {accepted:false, reason:'wish_not_found'};
      if (item.playerId !== player.playerId && player.role !== 'controller')
        return {accepted:false, reason:'not_controller'};
      this.items = this.items.filter(w => w !== item);
      return {accepted:true};
    }
    return {accepted:false, reason:'unknown_wish_action'};
  }
}
