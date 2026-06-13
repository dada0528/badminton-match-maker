import { Player, Gender, MatchType } from './types';
import { generateSchedule } from './services/matchService';

const players: Player[] = [
  { id: '1', name: 'P1', gender: Gender.MALE },
  { id: '2', name: 'P2', gender: Gender.MALE },
  { id: '3', name: 'P3', gender: Gender.MALE },
  { id: '4', name: 'P4', gender: Gender.MALE },
  { id: '5', name: 'P5', gender: Gender.MALE },
  { id: '6', name: 'P6', gender: Gender.MALE },
  { id: '7', name: 'P7', gender: Gender.MALE },
  { id: '8', name: 'P8', gender: Gender.MALE },
  { id: '9', name: 'P9', gender: Gender.MALE },
];

const result = generateSchedule(players, 9, false, false, MatchType.RANDOM, 1, []);
const schedule = result.schedule;

const stats = new Map<string, { played: number, rests: number, doubleRests: number, currentRest: number }>();
players.forEach(p => stats.set(p.id, { played: 0, rests: 0, doubleRests: 0, currentRest: 0 }));

schedule.forEach((match, index) => {
  const playing = new Set([
    match.teamA.player1.id, match.teamA.player2.id,
    match.teamB.player1.id, match.teamB.player2.id
  ]);
  
  console.log(`\nMatch ${index + 1}:`);
  console.log(`Playing: ${Array.from(playing).map(id => players.find(p=>p.id===id)?.name).join(', ')}`);
  
  console.log("Scores before this match:");
  players.forEach(p => {
    const s = stats.get(p.id)!;
    let score = s.played * 1000000;
    if (s.currentRest >= 3) score -= 300000;
    else if (s.currentRest >= 2) score -= 200000;
    score -= s.doubleRests * 10000;
    score -= s.currentRest * 1000;
    console.log(`${p.name}: ${score} (played: ${s.played}, cRests: ${s.currentRest}, doubleRests: ${s.doubleRests})`);
  });
  
  players.forEach(p => {
    const s = stats.get(p.id)!;
    if (playing.has(p.id)) {
      s.played++;
      s.currentRest = 0;
    } else {
      s.rests++;
      s.currentRest++;
      if (s.currentRest === 2) {
        s.doubleRests++;
      }
    }
  });
  
  console.log("Current Double Rests:");
  players.forEach(p => {
    console.log(`${p.name}: ${stats.get(p.id)?.doubleRests} (cRests: ${stats.get(p.id)?.currentRest}, played: ${stats.get(p.id)?.played})`);
  });
});
