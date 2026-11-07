import {randomUUID} from 'node:crypto';

// Explicit performances are separate from long-lived song likes.
export class PerformanceRequests {
  constructor({library, ready, canStart, command, publish}) {
    Object.assign(this,{library,ready,canStart,command,publish});
    this.sessionId=randomUUID();this.items=[];this.nativeActive=null;this.submissions=new Map();
  }
  resolve(key) {
    const matches=this.library().filter(song=>song.catalogKey===key && !song.category);
    return matches.length===1?matches[0]:null;
  }
  snapshot() {
    return {type:'request.state',version:1,sessionId:this.sessionId,
      items:this.items.map(({votes,songId,songSeq,...item})=>({...item,votes:[...votes]}))};
  }
  changed() { this.publish(this.snapshot()); }
  async handle(message,player) {
    const host=player.role==='controller';
    if(message.type==='request.list')return {accepted:true};
    if(!this.ready())return {accepted:false,reason:'catalog_unavailable'};
    if(message.type==='request.add') {
      const source=message.clientRequestId;
      if(source!=null && (typeof source!=='string'||!source||source.length>128))return {accepted:false,reason:'invalid_request_identity'};
      const submission=source?JSON.stringify([player.playerId,source]):null;
      if(submission&&this.submissions.has(submission))return {accepted:true,id:this.submissions.get(submission)};
      if(submission&&this.submissions.size>=1000)return {accepted:false,reason:'request_limit'};
      const song=this.resolve(message.catalogKey);
      if(!song)return {accepted:false,reason:'song_unavailable_or_ambiguous'};
      if(this.items.length>=100 || this.items.filter(r=>r.requesterId===player.playerId&&r.status==='queued').length>=5)
        return {accepted:false,reason:'request_limit'};
      if(this.items.some(r=>r.requesterId===player.playerId&&r.catalogKey===song.catalogKey&&['queued','starting','playing','uncertain'].includes(r.status)))
        return {accepted:false,reason:'request_duplicate'};
      this.items.push({id:randomUUID(),catalogKey:song.catalogKey,title:song.title,artist:song.artist,
        requesterId:player.playerId,requesterName:player.name,status:'queued',votes:new Set([player.playerId])});
      if(submission)this.submissions.set(submission,this.items.at(-1).id);
      return {accepted:true,id:this.items.at(-1).id};
    }
    if(message.type==='request.restore') {
      if(!host)return {accepted:false,reason:'not_controller'};
      if(this.nativeActive!==false||this.items.some(r=>['starting','playing','uncertain'].includes(r.status)))return {accepted:false,reason:'playback_not_idle'};
      if(this.items.length)return {accepted:false,reason:'queue_not_empty'};
      if(message.snapshot?.version!==1||!Array.isArray(message.snapshot.items)||message.snapshot.items.length>100)
        return {accepted:false,reason:'invalid_queue'};
      const restored=[];
      for(const raw of message.snapshot.items) {
        if(typeof raw.catalogKey!=='string'||raw.catalogKey.length>512||!['queued','starting','playing','uncertain','finished','unavailable'].includes(raw.status))
          return {accepted:false,reason:'invalid_queue'};
        const song=this.resolve(raw.catalogKey);
        restored.push({id:randomUUID(),catalogKey:raw.catalogKey,title:song?.title||String(raw.title||'').slice(0,200),artist:song?.artist||String(raw.artist||'').slice(0,200),
          requesterId:null,requesterName:String(raw.requesterName||'Saved request').slice(0,24),votes:new Set(),
          status:raw.status==='finished'?'finished':!song?'unavailable':raw.status==='queued'?'queued':'uncertain'});
      }
      this.items=restored;return {accepted:true};
    }
    const item=this.items.find(r=>r.id===message.id);
    if(!item)return {accepted:false,reason:'request_not_found'};
    if(message.type==='request.vote') {
      if(item.status!=='queued')return {accepted:false,reason:'request_not_queued'};
      if(message.liked===false)item.votes.delete(player.playerId);else item.votes.add(player.playerId);
      return {accepted:true};
    }
    if(message.type==='request.withdraw') {
      if(!host&&item.requesterId!==player.playerId)return {accepted:false,reason:'not_requester'};
      if(!['queued','finished','unavailable'].includes(item.status))return {accepted:false,reason:'request_in_progress'};
      this.items=this.items.filter(r=>r!==item);return {accepted:true};
    }
    if(!host)return {accepted:false,reason:'not_controller'};
    if(message.type==='request.resolve') {
      if(item.status!=='uncertain'||!['queued','finished'].includes(message.status))return {accepted:false,reason:'invalid_resolution'};
      if(this.nativeActive!==false)return {accepted:false,reason:'playback_not_idle'};
      item.status=message.status==='queued'&&!this.resolve(item.catalogKey)?'unavailable':message.status;
      return {accepted:true};
    }
    if(message.type==='request.move') {
      if(item.status!=='queued'||![-1,1].includes(message.direction))return {accepted:false,reason:'invalid_move'};
      const at=this.items.indexOf(item),next=at+message.direction;
      if(next>=0&&next<this.items.length)[this.items[at],this.items[next]]=[this.items[next],this.items[at]];
      return {accepted:true};
    }
    if(message.type==='request.start') {
      if(item.status!=='queued'||this.nativeActive!==false||!this.canStart()||this.items.some(r=>['starting','playing','uncertain'].includes(r.status)))
        return {accepted:false,reason:'playback_not_idle'};
      const song=this.resolve(item.catalogKey);
      if(!song){item.status='unavailable';return {accepted:false,reason:'song_unavailable_or_ambiguous'};}
      item.status='starting';item.songId=Number(song.songId);this.changed();
      try {
        const reply=await this.command('continuous.start',{songIds:[item.songId],playerSetupSeconds:-1});
        if(!reply.accepted && item.status==='starting')item.status='queued';
        return {accepted:Boolean(reply.accepted),reason:reply.reason};
      } catch {
        if(item.status==='starting')item.status='uncertain';
        return {accepted:false,reason:'request_outcome_unknown'};
      }
    }
    return {accepted:false,reason:'unknown_request_action'};
  }
  observe(message) {
    if(message.type==='continuous.state')this.nativeActive=Boolean(message.active);
    const item=this.items.find(r=>r.status==='starting'||r.status==='playing');
    if(!item)return;
    if(message.type==='continuous.handoff'&&item.songId===Number(message.songId)) {item.handoffId=message.handoffId;this.changed();}
    if(message.type==='song.started'&&item.songId===Number(message.songId)) {
      item.status='playing';item.songSeq=message.songSeq;this.changed();
    }
    if(message.type==='song.ended'&&item.status==='playing'&&item.songSeq===message.songSeq) {
      item.status='finished';this.changed();
    }
    if(message.type==='continuous.state'&&!message.active&&['starting','playing'].includes(item.status)) {
      item.status='uncertain';this.changed();
    }
  }
  suspend() {
    this.nativeActive=null;
    for(const item of this.items)if(['starting','playing'].includes(item.status))item.status='uncertain';
    this.changed();
  }
}
