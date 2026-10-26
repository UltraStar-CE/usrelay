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
      gameState:()=>room.gameState?.state||'waiting',now,
      send:message=>message.targetPlayerId||message.playerId
        ? sendClient(message.targetPlayerId||message.playerId,message) : broadcast(message),
      command:message=>sendHost({...message,protocol:1})});
  }
  async loadLibrary() {
    if(this.closed||this.loading||this.loaded||this.now()<this.retryAfter)return;
    this.loading=loadSongs(this.requests.request);
    try {
      const result=await this.loading;
      if(this.closed)return;
      this.library=result.songs;this.loaded=true;
      for(const message of this.pendingVotes.splice(0))this.party.handle(message);
      this.party.rosterChanged();this.party.tick();
    } catch(error) {
      if(!this.closed){this.retryAfter=this.now()+5000;this.party.notice=`Song loading failed: ${error.message}`;this.party.rosterChanged();}
    } finally {this.loading=null;}
  }
  observe(message) {
    if(this.closed)return;
    if(message.type==='ack'&&this.requests.accept(message))return;
    if(message.type==='song.select.state'||message.type==='playlist.state') {
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
      this.pendingVotes.push(structuredClone(message));this.loadLibrary();return true;
    }
    const handled=this.party.handle(message);if(handled)this.party.tick();return handled;
  }
  rosterChanged(){if(!this.closed){this.party.rosterChanged();this.party.tick();}}
  close(){this.closed=true;this.pendingVotes=[];this.requests.disconnect();}
}
