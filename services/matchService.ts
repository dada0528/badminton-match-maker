import { Player, Team, Match, MatchType, Gender, ScheduleItem, WaitingPlayerInfo, SkillMode } from '../types';

// Fisher-Yates Shuffle
const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Helper to create a unique key for a team (sorted IDs)
const getTeamKey = (p1: Player | string, p2: Player | string): string => {
  const id1 = typeof p1 === 'string' ? p1 : p1.id;
  const id2 = typeof p2 === 'string' ? p2 : p2.id;
  return [id1, id2].sort().join('-');
};

const getPartnerKey = getTeamKey;

const createMatch = (t1: [Player, Player], t2: [Player, Player], type: MatchType): Match => ({
    id: Date.now().toString() + Math.random().toString(),
    teamA: { player1: t1[0], player2: t1[1] },
    teamB: { player1: t2[0], player2: t2[1] },
    type: type,
    timestamp: Date.now()
});

interface PlayerStats {
  player: Player;
  played: number;
  virtualPlayed: number;
  consecutivePlays: number;
  consecutiveRests: number;
  consecutiveRestTwiceCount: number;
  forcedPlaysRemaining: number;
  lastPlayedIndex: number;
}

export const generateNextMatchesGroup = (
  allPlayers: Player[],
  matchHistory: ScheduleItem[],
  activeMatches: ScheduleItem[],
  mixPartners: boolean,
  avoidGenderSkew: boolean,
  type: MatchType,
  enableSkillLevel: boolean = false,
  fixedPairs: Array<[string, string]> = [],
  courtsToGenerate: number = 1,
  startCourtNumber: number = 1,
  firstMatchPlayerIds: string[] = [],
  skillMode: SkillMode = 'BALANCED',
  startSequence: number = 1
): { matches: ScheduleItem[], error: string | null } => {

  let pool = [...allPlayers].filter(p => p.status !== 'SUSPENDED');
  if (type === MatchType.MENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.MALE);
  if (type === MatchType.WOMENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.FEMALE);
  
  if (pool.length < 4) return { matches: [], error: '人數不足 4 人，無法排程' };
  
  const targetCourts = Math.min(courtsToGenerate, Math.floor(pool.length / 4));
  if (targetCourts === 0) return { matches: [], error: '人數不足以分配任何場地' };

  if (type === MatchType.MIXED_DOUBLES) {
     const m = pool.filter(p => p.gender === Gender.MALE).length;
     const f = pool.filter(p => p.gender === Gender.FEMALE).length;
     if (m < targetCourts * 2 || f < targetCourts * 2) return { matches: [], error: `混雙需要至少 ${targetCourts * 2} 男 ${targetCourts * 2} 女` };
  }

  const statsMap = new Map<string, PlayerStats>();
  const partnerHistory = new Map<string, number>(); 
  const opponentHistory = new Map<string, number>();
  const rawPartnerCount = new Map<string, number>();
  const rawOpponentCount = new Map<string, number>();

  const recordPartnership = (id1: string, id2: string, weight: number = 1) => {
    const key = getPartnerKey(id1, id2);
    partnerHistory.set(key, (partnerHistory.get(key) || 0) + weight);
    rawPartnerCount.set(key, (rawPartnerCount.get(key) || 0) + 1);
  };
  
  const recordOpponent = (id1: string, id2: string, weight: number = 1) => {
    const key = getPartnerKey(id1, id2);
    opponentHistory.set(key, (opponentHistory.get(key) || 0) + weight);
    rawOpponentCount.set(key, (rawOpponentCount.get(key) || 0) + 1);
  };

  pool.forEach(p => {
    statsMap.set(p.id, { 
      player: p, 
      played: 0, 
      virtualPlayed: 0,
      consecutivePlays: 0, 
      consecutiveRests: 0,
      consecutiveRestTwiceCount: 0,
      forcedPlaysRemaining: 0,
      lastPlayedIndex: -1
    });
  });

  const allPastMatches = [...matchHistory, ...activeMatches.filter((m): m is ScheduleItem => m !== null)];
  const courtCount = activeMatches.length || 1;
  const totalBatches = Math.ceil(allPastMatches.length / courtCount);

  for (let i = 0; i < allPastMatches.length; i += courtCount) {
      const batchIndex = Math.floor(i / courtCount);
      const distance = totalBatches - batchIndex;
      let weight = 1;
      if (distance === 1) weight = 100;
      else if (distance === 2) weight = 30;
      else if (distance === 3) weight = 10;
      else if (distance === 4) weight = 3;

      const batchMatches = allPastMatches.slice(i, i + courtCount);
      const playersInBatch = new Set<string>();
      
      const batchTime = batchMatches[0]?.timestamp || 0;

      batchMatches.forEach(match => {
          const p1 = match.teamA.player1.id;
          const p2 = match.teamA.player2.id;
          const p3 = match.teamB.player1.id;
          const p4 = match.teamB.player2.id;
          
          playersInBatch.add(p1);
          playersInBatch.add(p2);
          playersInBatch.add(p3);
          playersInBatch.add(p4);

          recordPartnership(p1, p2, weight);
          recordPartnership(p3, p4, weight);
          recordOpponent(p1, p3, weight);
          recordOpponent(p1, p4, weight);
          recordOpponent(p2, p3, weight);
          recordOpponent(p2, p4, weight);
      });

      let activePoolSize = 0;
      statsMap.forEach(stat => {
          const isPresent = !stat.player.createdAt || stat.player.createdAt <= batchTime;
          if (isPresent) activePoolSize++;
      });
      const playProb = activePoolSize > 0 ? (batchMatches.length * 4) / activePoolSize : 0;

      statsMap.forEach(stat => {
          const isPresent = !stat.player.createdAt || stat.player.createdAt <= batchTime;

          if (playersInBatch.has(stat.player.id)) {
              stat.played++;
              stat.consecutivePlays++;
              stat.consecutiveRests = 0;
              stat.lastPlayedIndex = i;
              if (stat.forcedPlaysRemaining > 0) stat.forcedPlaysRemaining--;
          } else if (isPresent) {
              stat.consecutivePlays = 0;
              stat.consecutiveRests++;
              if (stat.consecutiveRests === 2) {
                  stat.consecutiveRestTwiceCount++;
                  stat.forcedPlaysRemaining = 2;
              }
          } else {
              stat.virtualPlayed += playProb;
          }
      });
  }

  const activePlayerIds = new Set<string>();
  activeMatches.forEach(m => {
    if (m) {
      activePlayerIds.add(m.teamA.player1.id);
      activePlayerIds.add(m.teamA.player2.id);
      activePlayerIds.add(m.teamB.player1.id);
      activePlayerIds.add(m.teamB.player2.id);
    }
  });

  const availableStats = Array.from(statsMap.values()).filter(s => !activePlayerIds.has(s.player.id));
  if (availableStats.length < targetCourts * 4) {
      return { matches: [], error: '可用人數不足以分配所選場地數' };
  }

  const getScore = (s: PlayerStats): number => {
      const effectivePlayed = s.played + Math.floor(s.virtualPlayed);
      if (s.forcedPlaysRemaining > 0) return -100000000 + effectivePlayed;
      let score = effectivePlayed * 10000000;
      if (s.consecutiveRests >= 2) score -= 5000000;
      else if (s.consecutiveRests === 1) score -= 2000000;
      else if (s.consecutivePlays >= 2) score += 8000000;
      else if (s.consecutivePlays === 1) score += 2000000;
      score -= (s.consecutiveRestTwiceCount || 0) * 50000;
      score += Math.random() * 500;
      return score; 
  };

  const scoreCache = new Map<string, number>();
  availableStats.forEach(s => scoreCache.set(s.player.id, getScore(s)));

  fixedPairs.forEach(([id1, id2]) => {
      if (scoreCache.has(id1) && scoreCache.has(id2)) {
          const avgScore = (scoreCache.get(id1)! + scoreCache.get(id2)!) / 2;
          scoreCache.set(id1, avgScore);
          scoreCache.set(id2, avgScore);
      }
  });

  availableStats.sort((a, b) => {
      const scoreA = scoreCache.get(a.player.id)!;
      const scoreB = scoreCache.get(b.player.id)!;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return Math.random() - 0.5;
  });

  // Dynamic candidate selection: expand pool to allow pairing players with unplayed history
  let candidateStats: PlayerStats[] = [];
  if (type === MatchType.MIXED_DOUBLES) {
      const mStats = availableStats.filter(s => s.player.gender === Gender.MALE);
      const fStats = availableStats.filter(s => s.player.gender === Gender.FEMALE);
      const mCutoff = Math.max(targetCourts * 2 + 6, Math.min(mStats.length, 16));
      const fCutoff = Math.max(targetCourts * 2 + 6, Math.min(fStats.length, 16));
      candidateStats = [
          ...mStats.slice(0, mCutoff),
          ...fStats.slice(0, fCutoff)
      ];
  } else {
      const cutoff = Math.max(targetCourts * 4 + 10, Math.min(availableStats.length, 24));
      candidateStats = availableStats.slice(0, cutoff);
  }

  // Handle first match explicit forcing
  if (allPastMatches.length === 0 && startCourtNumber === 1 && firstMatchPlayerIds.length === 4) {
      const forcedStats = availableStats.filter(s => firstMatchPlayerIds.includes(s.player.id));
      if (forcedStats.length === 4) {
          let isValid = true;
          if (type === MatchType.MIXED_DOUBLES) {
              const m = forcedStats.filter(s => s.player.gender === Gender.MALE).length;
              const f = forcedStats.filter(s => s.player.gender === Gender.FEMALE).length;
              if (m !== 2 || f !== 2) isValid = false;
          }
          if (isValid) {
              const t1: [Player, Player] = [forcedStats[0].player, forcedStats[1].player];
              const t2: [Player, Player] = [forcedStats[2].player, forcedStats[3].player];
              const match = createMatch(t1, t2, type);
              return { 
                matches: [{ ...match, court: startCourtNumber, sequence: startSequence }],
                error: null
              };
          }
      }
  }

  // --- MONTE CARLO SEARCH ---
  let bestCost = Infinity;
  let bestMatches: Array<{t1: PlayerStats[], t2: PlayerStats[]}> = [];

  const calculateMatchPenalty = (t1: PlayerStats[], t2: PlayerStats[]) => {
      let penalty = 0;
      
      const pA = getPartnerKey(t1[0].player, t1[1].player);
      const pB = getPartnerKey(t2[0].player, t2[1].player);
      
      const rawPartnersA = rawPartnerCount.get(pA) || 0;
      const rawPartnersB = rawPartnerCount.get(pB) || 0;

      // Partner repetition & unplayed bonus
      if (mixPartners) {
          penalty += (partnerHistory.get(pA) || 0) * 10000;
          penalty += (partnerHistory.get(pB) || 0) * 10000;
          penalty += rawPartnersA * 15000;
          penalty += rawPartnersB * 15000;

          if (rawPartnersA === 0) penalty -= 12000;
          if (rawPartnersB === 0) penalty -= 12000;
      }

      // Opponent repetition & unplayed bonus
      const o1 = getPartnerKey(t1[0].player, t2[0].player);
      const o2 = getPartnerKey(t1[0].player, t2[1].player);
      const o3 = getPartnerKey(t1[1].player, t2[0].player);
      const o4 = getPartnerKey(t1[1].player, t2[1].player);
      
      const oppKeys = [o1, o2, o3, o4];
      oppKeys.forEach(opKey => {
          const wOpp = opponentHistory.get(opKey) || 0;
          const rOpp = rawOpponentCount.get(opKey) || 0;
          penalty += wOpp * 4000;
          penalty += rOpp * 6000;
          if (mixPartners && rOpp === 0) {
              penalty -= 6000;
          }
      });

      // Overall lifetime court sharing bonus / penalty across all 6 pairs
      const allFour = [t1[0].player, t1[1].player, t2[0].player, t2[1].player];
      for (let i = 0; i < allFour.length; i++) {
          for (let j = i + 1; j < allFour.length; j++) {
              const pairKey = getPartnerKey(allFour[i], allFour[j]);
              const rPartner = rawPartnerCount.get(pairKey) || 0;
              const rOpponent = rawOpponentCount.get(pairKey) || 0;
              const totalEncounters = rPartner + rOpponent;

              if (mixPartners) {
                  if (totalEncounters === 0) {
                      // Massive bonus for players who have NEVER shared a court lifetime!
                      penalty -= 25000;
                  } else if (totalEncounters >= 2) {
                      penalty += (totalEncounters - 1) * 10000;
                  }
              }
          }
      }

      fixedPairs.forEach(([id1, id2]) => {
          const inT1 = t1.some(p => p.player.id === id1) && t1.some(p => p.player.id === id2);
          const inT2 = t2.some(p => p.player.id === id1) && t2.some(p => p.player.id === id2);
          const anyPresent = t1.some(p => p.player.id === id1 || p.player.id === id2) || 
                             t2.some(p => p.player.id === id1 || p.player.id === id2);
          if (anyPresent && !inT1 && !inT2) penalty += 10000000; 
      });

      if (avoidGenderSkew && type !== MatchType.MIXED_DOUBLES) {
          const t1M = t1.filter(p => p.player.gender === Gender.MALE).length;
          const t2M = t2.filter(p => p.player.gender === Gender.MALE).length;
          if ((t1M === 2 && t2M === 0) || (t1M === 0 && t2M === 2)) penalty += 1000000;
      }

      if (enableSkillLevel) {
          const t1Level = (t1[0].player.level || 3) + (t1[1].player.level || 3);
          const t2Level = (t2[0].player.level || 3) + (t2[1].player.level || 3);
          const levelDiff = Math.abs(t1Level - t2Level);
          
          penalty += levelDiff * 20000;
          if (levelDiff > 2) penalty += (levelDiff - 2) * 200000;

          const pA1 = t1[0].player.level || 3;
          const pA2 = t1[1].player.level || 3;
          const pB1 = t2[0].player.level || 3;
          const pB2 = t2[1].player.level || 3;

          const teamADiff = Math.abs(pA1 - pA2);
          const teamBDiff = Math.abs(pB1 - pB2);

          if (skillMode === 'STRONG_WEAK') {
              penalty -= (teamADiff + teamBDiff) * 3000;
          } else {
              penalty += (teamADiff + teamBDiff) * 3000;
          }
      }

      return penalty;
  };

  const iterations = 10000;
  
  for (let i = 0; i < iterations; i++) {
     let selected: PlayerStats[];
     if (type === MatchType.MIXED_DOUBLES) {
         const mStats = candidateStats.filter(s => s.player.gender === Gender.MALE);
         const fStats = candidateStats.filter(s => s.player.gender === Gender.FEMALE);
         selected = [ 
             ...shuffle(mStats).slice(0, targetCourts * 2), 
             ...shuffle(fStats).slice(0, targetCourts * 2) 
         ];
     } else {
         selected = shuffle(candidateStats).slice(0, targetCourts * 4);
     }

     let valid = true;
     let cost = 0;
     const matches: Array<{t1: PlayerStats[], t2: PlayerStats[]}> = [];

     for(const s of selected) cost += scoreCache.get(s.player.id)!;

     // Partition into courts
     if (type === MatchType.MIXED_DOUBLES) {
         const males = shuffle(selected.filter(p => p.player.gender === Gender.MALE));
         const females = shuffle(selected.filter(p => p.player.gender === Gender.FEMALE));
         for(let c = 0; c < targetCourts; c++) {
             const m0 = males[c*2], m1 = males[c*2+1];
             const f0 = females[c*2], f1 = females[c*2+1];
             const teamArrangement = Math.random() < 0.5;
             const t1 = [m0, teamArrangement ? f0 : f1];
             const t2 = [m1, teamArrangement ? f1 : f0];
             const penalty = calculateMatchPenalty(t1, t2);
             cost += penalty;
             matches.push({t1, t2});
         }
     } else {
         selected = shuffle(selected);
         for(let c = 0; c < targetCourts; c++) {
             const p = selected.slice(c * 4, c * 4 + 4);
             const arr = Math.floor(Math.random() * 3);
             let t1, t2;
             if (arr === 0) { t1 = [p[0], p[1]]; t2 = [p[2], p[3]]; }
             else if (arr === 1) { t1 = [p[0], p[2]]; t2 = [p[1], p[3]]; }
             else { t1 = [p[0], p[3]]; t2 = [p[1], p[2]]; }
             
             const penalty = calculateMatchPenalty(t1, t2);
             cost += penalty;
             matches.push({t1, t2});
         }
     }
     
     if (valid && cost < bestCost) {
         bestCost = cost;
         bestMatches = matches;
     }
  }

  const generatedMatches: ScheduleItem[] = [];
  bestMatches.forEach((m, idx) => {
      const match = createMatch(
          [m.t1[0].player, m.t1[1].player],
          [m.t2[0].player, m.t2[1].player],
          type
      );
      generatedMatches.push({
          ...match,
          court: startCourtNumber + idx,
          sequence: startSequence + idx
      });
  });

  return { matches: generatedMatches, error: null };
};

export const generateNextMatch = (
  allPlayers: Player[],
  matchHistory: ScheduleItem[],
  activeMatches: ScheduleItem[],
  mixPartners: boolean,
  avoidGenderSkew: boolean,
  type: MatchType,
  enableSkillLevel: boolean = false,
  fixedPairs: Array<[string, string]> = [],
  courtNumber: number = 1,
  firstMatchPlayerIds: string[] = [],
  skillMode: SkillMode = 'BALANCED'
): { match: ScheduleItem | null, error: string | null } => {
    const result = generateNextMatchesGroup(
        allPlayers, matchHistory, activeMatches, mixPartners, avoidGenderSkew, type, enableSkillLevel, fixedPairs, 1, courtNumber, firstMatchPlayerIds, skillMode
    );
    if (result.error || result.matches.length === 0) return { match: null, error: result.error };
    return { match: result.matches[0], error: null };
}

export const generateSchedule = (
  allPlayers: Player[],
  rounds: number,
  mixPartners: boolean, 
  avoidGenderSkew: boolean, 
  type: MatchType,
  courtCount: number = 1, 
  firstMatchPlayerIds: string[] = [], 
  enableSkillLevel: boolean = false, 
  fixedPairs: Array<[string, string]> = [], 
  skillMode: SkillMode = 'BALANCED'
): { schedule: ScheduleItem[], error: string | null } => {

  const schedule: ScheduleItem[] = [];
  const pool = allPlayers.filter(p => p.status !== 'SUSPENDED');
  const totalSlotsNeeded = pool.length * rounds;
  const totalMatches = Math.ceil(totalSlotsNeeded / 4);
  
  let currentMatchCount = 0;
  let roundNumber = 1;

  while (currentMatchCount < totalMatches) {
      const remainingMatches = totalMatches - currentMatchCount;
      const courtsToGenerate = Math.min(courtCount, remainingMatches);
      
      const result = generateNextMatchesGroup(
          allPlayers,
          schedule,
          [],
          mixPartners,
          avoidGenderSkew,
          type,
          enableSkillLevel,
          fixedPairs,
          courtsToGenerate,
          1,
          roundNumber === 1 ? firstMatchPlayerIds : [],
          skillMode,
          currentMatchCount + 1
      );

      if (result.error) return { schedule: [], error: result.error };
      if (result.matches.length === 0) break;

      schedule.push(...result.matches);
      currentMatchCount += result.matches.length;
      roundNumber++;
  }

  return { schedule, error: null };
};

export const suggestWaitList = (
  allPlayers: Player[],
  matchHistory: ScheduleItem[],
  activeMatches: ScheduleItem[],
  type: MatchType
): WaitingPlayerInfo[] => {
  const statsMap = new Map<string, PlayerStats>();
  
  // Minimal stats build just for waitlist display
  let pool = [...allPlayers].filter(p => p.status !== 'SUSPENDED');
  if (type === MatchType.MENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.MALE);
  if (type === MatchType.WOMENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.FEMALE);

  pool.forEach(p => {
    statsMap.set(p.id, { 
      player: p, 
      played: 0, 
      virtualPlayed: 0,
      consecutivePlays: 0, 
      consecutiveRests: 0,
      consecutiveRestTwiceCount: 0,
      forcedPlaysRemaining: 0,
      lastPlayedIndex: -1
    });
  });

  const allPastMatches = [...matchHistory, ...activeMatches.filter((m): m is ScheduleItem => m !== null)];
  const courtCount = activeMatches.length || 1;

  for (let i = 0; i < allPastMatches.length; i += courtCount) {
      const batchMatches = allPastMatches.slice(i, i + courtCount);
      const playersInBatch = new Set<string>();
      const batchTime = batchMatches[0]?.timestamp || 0;

      batchMatches.forEach(match => {
          playersInBatch.add(match.teamA.player1.id);
          playersInBatch.add(match.teamA.player2.id);
          playersInBatch.add(match.teamB.player1.id);
          playersInBatch.add(match.teamB.player2.id);
      });

      let activePoolSize = 0;
      statsMap.forEach(stat => {
          const isPresent = !stat.player.createdAt || stat.player.createdAt <= batchTime;
          if (isPresent) activePoolSize++;
      });
      const playProb = activePoolSize > 0 ? (batchMatches.length * 4) / activePoolSize : 0;

      statsMap.forEach(stat => {
          const isPresent = !stat.player.createdAt || stat.player.createdAt <= batchTime;
          if (playersInBatch.has(stat.player.id)) {
              stat.played++;
              stat.consecutivePlays++;
              stat.consecutiveRests = 0;
              if (stat.forcedPlaysRemaining > 0) stat.forcedPlaysRemaining--;
          } else if (isPresent) {
              stat.consecutivePlays = 0;
              stat.consecutiveRests++;
              if (stat.consecutiveRests === 2) {
                  stat.consecutiveRestTwiceCount++;
                  stat.forcedPlaysRemaining = 2;
              }
          } else {
              stat.virtualPlayed += playProb;
          }
      });
  }

  const activePlayerIds = new Set<string>();
  activeMatches.forEach(m => {
    if (m) {
      activePlayerIds.add(m.teamA.player1.id);
      activePlayerIds.add(m.teamA.player2.id);
      activePlayerIds.add(m.teamB.player1.id);
      activePlayerIds.add(m.teamB.player2.id);
    }
  });

  const waitingStats = Array.from(statsMap.values()).filter(s => !activePlayerIds.has(s.player.id));
  
  const getScore = (s: PlayerStats): number => {
      const effectivePlayed = s.played + Math.floor(s.virtualPlayed);
      if (s.forcedPlaysRemaining > 0) return -100000000 + effectivePlayed;
      let score = effectivePlayed * 10000000;
      if (s.consecutiveRests >= 2) score -= 5000000;
      else if (s.consecutiveRests === 1) score -= 2000000;
      else if (s.consecutivePlays >= 2) score += 8000000;
      else if (s.consecutivePlays === 1) score += 2000000;
      score -= (s.consecutiveRestTwiceCount || 0) * 50000;
      return score; 
  };

  waitingStats.sort((a, b) => getScore(a) - getScore(b));

  return waitingStats.map(s => ({
    player: s.player,
    restCount: s.consecutiveRests
  }));
};
