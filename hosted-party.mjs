// Party orchestration for native-capable rooms; gameplay stays in USCE.
import {PartySession} from './party-session.mjs';
import {createApiRequests} from './public/api-requests.js';
import {loadSongs} from './public/song-query.js';
export class HostedParty {
  constructor({room, sendHost, sendClient, broadcast, now=Date.now}) {
    Object.assign(this,{room,sendHost,sendClient,broadcast,now});
    this.library=[]; this.playlist=[]; this.loading=null; this.loaded=false; this.closed=false;
    this.sequence=2000000000; this.retryAfter=0; this.pendingVotes=[];
    this.requests=createApiRequests({send:message=>sendHost({...message,protocol:1,playerId:'relay-party',role:'controller'}),
      nextId:()=>++this.sequence});
    this.party=new PartySession({players:()=>room.players,library:()=>this.library,playlist:()=>this.playlist,
      gameState:()=>room.gameState?.state||'waiting',now,catalogReady:()=>this.loaded,
      send:message=>message.targetPlayerId||message.playerId
        ? sendClient(message.targetPlayerId||message.playerId,{...message,libraryHash:this.loaded?this.loadedSnapshotId:this.snapshotId}) : broadcast({...message,libraryHash:this.loaded?this.loadedSnapshotId:this.snapshotId}),
      command:message=>sendHost({...message,protocol:1})});
  }
  async loadLibrary() {
    if(this.closed||this.loading||this.loaded||this.now()<this.retryAfter)return;
    const expectedSnapshot=this.snapshotId;
    let superseded=false;
    this.loading=loadSongs(this.requests.request);
    try {
      const result=await this.loading;
      if(this.closed)return;
      if(expectedSnapshot!==this.snapshotId) {superseded=true;return;}
      if(expectedSnapshot && result.snapshotId!==expectedSnapshot)throw Error('snapshot_changed');
      this.party.reindexLibrary(this.library,result.songs);
      this.library=result.songs;this.loaded=true;this.loadedSnapshotId=result.snapshotId;
      if(this.party.notice.startsWith('Song loading failed:'))this.party.notice='';
      for(const message of this.pendingVotes.splice(0))this.party.handle(message);
      this.party.rosterChanged();this.party.tick();
    } catch(error) {
      if(!this.closed){this.retryAfter=this.now()+5000;this.party.notice=`Song loading failed: ${error.message}`;this.party.rosterChanged();}
    } finally {this.loading=null;if(superseded&&!this.closed)this.loadLibrary();}
  }
  observe(message) {
    if(this.closed)return;
    if(message.type==='ack'&&this.requests.accept(message))return;
    if(message.type==='api.state'||message.type==='song.select.state'||message.type==='playlist.state') {
      if(message.type==='api.state' && message.libraryHash!==this.snapshotId) {
        this.snapshotId=message.libraryHash;this.loaded=this.loadedSnapshotId===message.libraryHash;this.retryAfter=0;
      }
      if(Array.isArray(message.playlistItems)&&JSON.stringify(this.playlist)!==JSON.stringify(message.playlistItems)) {
        this.playlist=message.playlistItems;this.party.rosterChanged();
      }
      this.loadLibrary();
    }
    this.party.observe(message);this.party.tick();
  }
  handle(message) {
    if(this.closed)return false;
    if(!this.loaded&&['party.like','party.unlike','party.likeShown','party.unlikeShown'].includes(message.type)) {
      // Votes can arrive immediately after joining, before the paged library.
      if(this.pendingVotes.length>=1000)this.pendingVotes.shift();
      const pending=structuredClone(message);
      // Preserve intent for votes received against the previous live snapshot.
      if(this.library.length) {
        const byId=new Map(this.library.map(song=>[Number(song.songId),song]));
        const songs=Array.isArray(pending.songs)?pending.songs:[pending];
        for(const song of songs)if(!song.catalogKey) {
          const old=byId.get(Number(song.songId));
          if(old?.catalogKey)song.catalogKey=old.catalogKey;
        }
      }
      this.pendingVotes.push(pending);this.loadLibrary();return true;
    }
    const handled=this.party.handle(message);if(handled)this.party.tick();return handled;
  }
  rosterChanged(){if(!this.closed){this.loadLibrary();this.party.rosterChanged();this.party.tick();}}
  close(){this.closed=true;this.pendingVotes=[];this.requests.disconnect();}
}
