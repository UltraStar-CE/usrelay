// Presentation only. Native scores are never adjusted by these session awards.
export class SessionAwards {
  constructor() { this.players = new Map(); }
  reset() { this.players.clear(); }
  record(results) {
    const scores = new Map(results.filter(r=>r.playerId && Number.isFinite(r.score) && r.score>=0).map(r=>[r.playerId,r.score]));
    if (!scores.size) return;
    const best = Math.max(...scores.values());
    const winners = [...scores].filter(([,score])=>score===best);
    const winner = scores.size>1 && best>0 && winners.length===1 ? winners[0][0] : null;
    for (const [id,entry] of this.players) if (id!==winner) entry.streak=0;
    for (const [id,score] of scores) {
      const entry = this.players.get(id) || {rounds:0,bestScore:0,wins:0,streak:0,bestStreak:0,badges:[]};
      entry.badges=[];
      if (entry.rounds && score>entry.bestScore) entry.badges.push('Session best');
      entry.rounds++; entry.bestScore=Math.max(entry.bestScore,score);
      if (entry.rounds===1) entry.badges.push('First song');
      if ([5,10,25,50].includes(entry.rounds)) entry.badges.push(`${entry.rounds} songs`);
      if (id===winner) {
        entry.wins++;entry.streak++;entry.bestStreak=Math.max(entry.bestStreak,entry.streak);
        if (entry.streak>=2) entry.badges.push(`${entry.streak}-round winning streak`);
      } else entry.streak=0;
      this.players.set(id,entry);
    }
  }
  summary(id) { return this.players.get(id) || null; }
}
