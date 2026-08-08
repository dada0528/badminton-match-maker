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
): { matches: ScheduleItem[], error: string | null, notice?: string | null } => {

  let pool = [...allPlayers].filter(p => p.status !== 'SUSPENDED');
  if (type === MatchType.MENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.MALE);
  if (type === MatchType.WOMENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.FEMALE);
  
  if (pool.length < 4) return { matches: [], error: '人數不足 4 人，無法排程' };
  
  const targetCourts = Math.min(courtsToGenerate, Math.floor(pool.length / 4));
  if (targetCourts === 0) return { matches: [], error: '人數不足以分配任何場地' };

  const statsMap = new Map<string, PlayerStats>();
  const partnerHistory = new Map<string, number>(); 
  const opponentHistory = new Map<string, number>();
  const recentPartnerDistance = new Map<string, number>();
  const recentOpponentDistance = new Map<string, number>();
  const rawPartnerCount = new Map<string, number>();
  const rawOpponentCount = new Map<string, number>();

  const recordPartnership = (id1: string, id2: string, weight: number = 1, distance: number = 999) => {
    const key = getPartnerKey(id1, id2);
    partnerHistory.set(key, (partnerHistory.get(key) || 0) + weight);
    rawPartnerCount.set(key, (rawPartnerCount.get(key) || 0) + 1);
    if (!recentPartnerDistance.has(key) || distance < recentPartnerDistance.get(key)!) {
      recentPartnerDistance.set(key, distance);
    }
  };
  
  const recordOpponent = (id1: string, id2: string, weight: number = 1, distance: number = 999) => {
    const key = getPartnerKey(id1, id2);
    opponentHistory.set(key, (opponentHistory.get(key) || 0) + weight);
    rawOpponentCount.set(key, (rawOpponentCount.get(key) || 0) + 1);
    if (!recentOpponentDistance.has(key) || distance < recentOpponentDistance.get(key)!) {
      recentOpponentDistance.set(key, distance);
    }
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
  
  const pastFourPlayerCombos = new Set<string>();
  allPastMatches.forEach(match => {
      const p1 = match.teamA.player1.id;
      const p2 = match.teamA.player2.id;
      const p3 = match.teamB.player1.id;
      const p4 = match.teamB.player2.id;
      const key = [p1, p2, p3, p4].sort().join('-');
      pastFourPlayerCombos.add(key);
  });

  // Group matches into rounds based on player overlap to accurately calculate recency
  const rounds: ScheduleItem[][] = [];
  let currentRound: ScheduleItem[] = [];
  let currentRoundPlayers = new Set<string>();

  for (const match of allPastMatches) {
      const p1 = match.teamA.player1.id;
      const p2 = match.teamA.player2.id;
      const p3 = match.teamB.player1.id;
      const p4 = match.teamB.player2.id;

      if (currentRoundPlayers.has(p1) || currentRoundPlayers.has(p2) || currentRoundPlayers.has(p3) || currentRoundPlayers.has(p4)) {
          // Conflict found, push current round and start a new one
          rounds.push(currentRound);
          currentRound = [match];
          currentRoundPlayers = new Set([p1, p2, p3, p4]);
      } else {
          currentRound.push(match);
          currentRoundPlayers.add(p1);
          currentRoundPlayers.add(p2);
          currentRoundPlayers.add(p3);
          currentRoundPlayers.add(p4);
      }
  }
  if (currentRound.length > 0) {
      rounds.push(currentRound);
  }

  const totalRounds = rounds.length;

  // Recency Decay Calculation
  for (let i = 0; i < rounds.length; i++) {
      const batchMatches = rounds[i];
      const distance = totalRounds - i;
      
      let weight = 1;
      if (distance === 1) weight = 100;
      else if (distance === 2) weight = 25;
      else if (distance === 3) weight = 8;
      else if (distance === 4) weight = 2.5;
      else weight = Math.max(0.1, 1 / Math.pow(distance - 3, 1.5));

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

          recordPartnership(p1, p2, weight, distance);
          recordPartnership(p3, p4, weight, distance);
          recordOpponent(p1, p3, weight, distance);
          recordOpponent(p1, p4, weight, distance);
          recordOpponent(p2, p3, weight, distance);
          recordOpponent(p2, p4, weight, distance);
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
                  stat.forcedPlaysRemaining = 1;
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

  // Score calculation for candidate prioritization (Fatigue Avoidance & Rest Prioritization)
  const getScore = (s: PlayerStats): number => {
      const effectivePlayed = s.played + Math.floor(s.virtualPlayed);
      if (s.forcedPlaysRemaining > 0) return -100000000 + effectivePlayed;
      
      let score = effectivePlayed * 10000000;
      
      // Rest rewards (prioritize rested players)
      if (s.consecutiveRests >= 2) score -= 80000000;
      else if (s.consecutiveRests === 1) score -= 3000000;
      
      // Continuous Play / Fatigue Penalties:
      if (s.consecutivePlays >= 3) score += 70000000;      // 3+ matches in a row -> massive penalty
      else if (s.consecutivePlays === 2) score += 25000000; // 2 matches in a row -> heavy penalty (forces rest if rested players exist)
      else if (s.consecutivePlays === 1) score += 3000000;  // 1 match in a row -> minor penalty
      
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

  // Mixed Doubles Fallback Calculation
  let courtTypes: MatchType[] = [];
  let fallbackNotice: string | null = null;

  if (type === MatchType.MIXED_DOUBLES) {
      const availM = availableStats.filter(s => s.player.gender === Gender.MALE);
      const availF = availableStats.filter(s => s.player.gender === Gender.FEMALE);

      let maxHeadcountMixed = Math.min(targetCourts, Math.floor(availM.length / 2), Math.floor(availF.length / 2));

      // Fatigue-aware mixed court reduction: if female (or male) players are fatigued (consecutivePlays >= 2) and surplus exists, allow them to rest
      if (maxHeadcountMixed > 0 && availM.length >= availF.length + 4) {
          const freshF = availF.filter(f => f.consecutivePlays < 2).length;
          const maxFreshMixed = Math.floor(freshF / 2);
          if (maxFreshMixed < maxHeadcountMixed) {
              maxHeadcountMixed = maxFreshMixed;
          }
      }

      for (let c = 0; c < targetCourts; c++) {
          if (c < maxHeadcountMixed) {
              courtTypes.push(MatchType.MIXED_DOUBLES);
          } else {
              // Fallback for excess courts
              if (availM.length - (c * 2) >= 4) {
                  courtTypes.push(MatchType.MENS_DOUBLES);
              } else if (availF.length - (c * 2) >= 4) {
                  courtTypes.push(MatchType.WOMENS_DOUBLES);
              } else {
                  courtTypes.push(MatchType.RANDOM);
              }
          }
      }

      if (maxHeadcountMixed < targetCourts) {
          fallbackNotice = `因男女人數不均 (${availM.length}男${availF.length}女)，部分場地已自動轉為雙打/男雙以維持順暢輪替。`;
      }
  } else {
      courtTypes = Array(targetCourts).fill(type);
  }

  // Dynamic candidate selection: expand pool based on strict scoring tiers to enforce equal rotations
  let candidateStats: PlayerStats[] = [];
  
  const thresholdBuffer = 2000000; // Allow a 2M variance to group players with same play/rest history
  
  if (type === MatchType.MIXED_DOUBLES) {
      const hasRandom = courtTypes.includes(MatchType.RANDOM);
      if (hasRandom) {
          const needed = targetCourts * 4;
          if (availableStats.length <= needed) {
              candidateStats = availableStats;
          } else {
              const thresholdScore = scoreCache.get(availableStats[needed - 1].player.id)!;
              candidateStats = availableStats.filter(s => scoreCache.get(s.player.id)! <= thresholdScore + thresholdBuffer);
          }
      } else {
          const mStats = availableStats.filter(s => s.player.gender === Gender.MALE);
          const fStats = availableStats.filter(s => s.player.gender === Gender.FEMALE);
          
          const mMixNeeded = courtTypes.filter(c => c === MatchType.MIXED_DOUBLES).length * 2;
          const mMenNeeded = courtTypes.filter(c => c === MatchType.MENS_DOUBLES).length * 4;
          const mNeeded = mMixNeeded + mMenNeeded;

          const fMixNeeded = courtTypes.filter(c => c === MatchType.MIXED_DOUBLES).length * 2;
          const fWomenNeeded = courtTypes.filter(c => c === MatchType.WOMENS_DOUBLES).length * 4;
          const fNeeded = fMixNeeded + fWomenNeeded;
          
          const getTieredCandidates = (stats: PlayerStats[], neededCount: number) => {
              if (stats.length <= neededCount || neededCount === 0) return stats;
              const thresholdScore = scoreCache.get(stats[neededCount - 1].player.id)!;
              return stats.filter(s => scoreCache.get(s.player.id)! <= thresholdScore + thresholdBuffer);
          };
          
          candidateStats = [
              ...getTieredCandidates(mStats, mNeeded),
              ...getTieredCandidates(fStats, fNeeded)
          ];
      }
  } else {
      const needed = targetCourts * 4;
      if (availableStats.length <= needed) {
          candidateStats = availableStats;
      } else {
          const thresholdScore = scoreCache.get(availableStats[needed - 1].player.id)!;
          candidateStats = availableStats.filter(s => scoreCache.get(s.player.id)! <= thresholdScore + thresholdBuffer);
      }
  }
  
  // Fallback if not enough candidates due to any unforeseen issue
  if (candidateStats.length < targetCourts * 4) {
      const cutoff = Math.min(targetCourts * 4 + 4, availableStats.length);
      candidateStats = availableStats.slice(0, cutoff);
  }

  // Handle first match explicit forcing
  if (allPastMatches.length === 0 && startCourtNumber === 1 && firstMatchPlayerIds.length === 4) {
      const forcedStats = availableStats.filter(s => firstMatchPlayerIds.includes(s.player.id));
      if (forcedStats.length === 4) {
          let isValid = true;
          if (type === MatchType.MIXED_DOUBLES && courtTypes[0] === MatchType.MIXED_DOUBLES) {
              const m = forcedStats.filter(s => s.player.gender === Gender.MALE).length;
              const f = forcedStats.filter(s => s.player.gender === Gender.FEMALE).length;
              if (m !== 2 || f !== 2) isValid = false;
          }
          if (isValid) {
              const t1: [Player, Player] = [forcedStats[0].player, forcedStats[1].player];
              const t2: [Player, Player] = [forcedStats[2].player, forcedStats[3].player];
              const match = createMatch(t1, t2, courtTypes[0]);
              return { 
                matches: [{ ...match, court: startCourtNumber, sequence: startSequence }],
                error: null,
                notice: fallbackNotice
              };
          }
      }
  }

  // --- MONTE CARLO SEARCH ---
  let bestCost = Infinity;
  let bestMatches: Array<{t1: PlayerStats[], t2: PlayerStats[], cType: MatchType}> = [];

  const calculateMatchPenalty = (t1: PlayerStats[], t2: PlayerStats[], matchType: MatchType) => {
      let penalty = 0;
      
      // 1. Partner Repetition & Recency
      const pA = getPartnerKey(t1[0].player, t1[1].player);
      const pB = getPartnerKey(t2[0].player, t2[1].player);
      
      const partnerKeys = [pA, pB];
      partnerKeys.forEach(pKey => {
          const recDist = recentPartnerDistance.get(pKey) ?? 999;
          const count = rawPartnerCount.get(pKey) || 0;

          if (mixPartners) {
              if (count === 0) {
                  penalty -= 60000; // Strong bonus for never-partnered
              } else {
                  if (recDist === 1) penalty += 400000;
                  else if (recDist === 2) penalty += 80000;
                  else if (recDist === 3) penalty += 20000;
                  
                  penalty += count * 15000; // Lifetime partner penalty
              }
          }
      });

      // 2. Opponent Repetition & Recency (Cross-pollination)
      const o1 = getPartnerKey(t1[0].player, t2[0].player);
      const o2 = getPartnerKey(t1[0].player, t2[1].player);
      const o3 = getPartnerKey(t1[1].player, t2[0].player);
      const o4 = getPartnerKey(t1[1].player, t2[1].player);
      
      const oppKeys = [o1, o2, o3, o4];
      oppKeys.forEach(opKey => {
          const recDist = recentOpponentDistance.get(opKey) ?? 999;
          const count = rawOpponentCount.get(opKey) || 0;
          
          if (count === 0) {
              penalty -= 20000; // Bonus for never-played opponents (forces mixing across courts)
          } else {
              if (recDist === 1) penalty += 200000;
              else if (recDist === 2) penalty += 40000;
              else if (recDist === 3) penalty += 10000;
              
              penalty += count * 5000; // Lifetime opponent penalty
          }
      });

      // 3. Consecutive Play / Fatigue Penalty inside Match
      const allFour = [t1[0], t1[1], t2[0], t2[1]];
      allFour.forEach(stat => {
          if (stat.consecutivePlays >= 3) penalty += 1000000;
          else if (stat.consecutivePlays === 2) penalty += 300000;
      });

      // 4. Same 4-player combination penalty
      const fourKey = [allFour[0].player.id, allFour[1].player.id, allFour[2].player.id, allFour[3].player.id].sort().join('-');
      if (pastFourPlayerCombos.has(fourKey)) {
          penalty += 50000000; // massive penalty for exactly the same 4 players on a court
      }

      // Fixed pairs enforcement
      fixedPairs.forEach(([id1, id2]) => {
          const inT1 = t1.some(p => p.player.id === id1) && t1.some(p => p.player.id === id2);
          const inT2 = t2.some(p => p.player.id === id1) && t2.some(p => p.player.id === id2);
          const anyPresent = t1.some(p => p.player.id === id1 || p.player.id === id2) || 
                             t2.some(p => p.player.id === id1 || p.player.id === id2);
          if (anyPresent && !inT1 && !inT2) penalty += 10000000; 
      });

      // Gender skew check for non-mixed courts
      if (avoidGenderSkew && matchType !== MatchType.MIXED_DOUBLES) {
          const t1M = t1.filter(p => p.player.gender === Gender.MALE).length;
          const t2M = t2.filter(p => p.player.gender === Gender.MALE).length;
          
          const totalM = t1M + t2M;
          
          // 1. Prevent completely unbalanced matchups within the same court (e.g., [M,M] vs [F,F] or 3M1F)
          if ((t1M === 2 && t2M === 0) || (t1M === 0 && t2M === 2)) {
              penalty += 1000000; // Men's pair vs Women's pair
          } else if (totalM === 1 || totalM === 3) {
              penalty += 1000000; // 3 of one, 1 of another (e.g., [M,M] vs [M,F])
          } else if (totalM === 0 || totalM === 4) {
              // 2. Allow all-men or all-women, but apply a slight nudge to encourage mixed doubles if possible
              penalty += 5000; 
          }
      }

      // Skill level balance
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
     let cost = 0;
     const matches: Array<{t1: PlayerStats[], t2: PlayerStats[], cType: MatchType}> = [];
     let availablePool = [...candidateStats];

     for (let c = 0; c < targetCourts; c++) {
         const cType = courtTypes[c];
         let selected: PlayerStats[] = [];

         if (cType === MatchType.MIXED_DOUBLES) {
             const mStats = shuffle(availablePool.filter(s => s.player.gender === Gender.MALE));
             const fStats = shuffle(availablePool.filter(s => s.player.gender === Gender.FEMALE));
             if (mStats.length < 2 || fStats.length < 2) break;
             
             const m0 = mStats[0], m1 = mStats[1];
             const f0 = fStats[0], f1 = fStats[1];
             const teamArrangement = Math.random() < 0.5;
             const t1 = [m0, teamArrangement ? f0 : f1];
             const t2 = [m1, teamArrangement ? f1 : f0];

             for (const s of [...t1, ...t2]) {
                 cost += scoreCache.get(s.player.id)!;
                 availablePool = availablePool.filter(p => p.player.id !== s.player.id);
             }

             const penalty = calculateMatchPenalty(t1, t2, cType);
             cost += penalty;
             matches.push({ t1, t2, cType });
         } else if (cType === MatchType.MENS_DOUBLES) {
             const mStats = shuffle(availablePool.filter(s => s.player.gender === Gender.MALE));
             if (mStats.length < 4) break;
             const p = mStats.slice(0, 4);
             const arr = Math.floor(Math.random() * 3);
             let t1: PlayerStats[], t2: PlayerStats[];
             if (arr === 0) { t1 = [p[0], p[1]]; t2 = [p[2], p[3]]; }
             else if (arr === 1) { t1 = [p[0], p[2]]; t2 = [p[1], p[3]]; }
             else { t1 = [p[0], p[3]]; t2 = [p[1], p[2]]; }

             for (const s of p) {
                 cost += scoreCache.get(s.player.id)!;
                 availablePool = availablePool.filter(item => item.player.id !== s.player.id);
             }

             const penalty = calculateMatchPenalty(t1, t2, cType);
             cost += penalty;
             matches.push({ t1, t2, cType });
         } else if (cType === MatchType.WOMENS_DOUBLES) {
             const fStats = shuffle(availablePool.filter(s => s.player.gender === Gender.FEMALE));
             if (fStats.length < 4) break;
             const p = fStats.slice(0, 4);
             const arr = Math.floor(Math.random() * 3);
             let t1: PlayerStats[], t2: PlayerStats[];
             if (arr === 0) { t1 = [p[0], p[1]]; t2 = [p[2], p[3]]; }
             else if (arr === 1) { t1 = [p[0], p[2]]; t2 = [p[1], p[3]]; }
             else { t1 = [p[0], p[3]]; t2 = [p[1], p[2]]; }

             for (const s of p) {
                 cost += scoreCache.get(s.player.id)!;
                 availablePool = availablePool.filter(item => item.player.id !== s.player.id);
             }

             const penalty = calculateMatchPenalty(t1, t2, cType);
             cost += penalty;
             matches.push({ t1, t2, cType });
         } else {
             const pStats = shuffle(availablePool);
             if (pStats.length < 4) break;
             const p = pStats.slice(0, 4);
             const arr = Math.floor(Math.random() * 3);
             let t1: PlayerStats[], t2: PlayerStats[];
             if (arr === 0) { t1 = [p[0], p[1]]; t2 = [p[2], p[3]]; }
             else if (arr === 1) { t1 = [p[0], p[2]]; t2 = [p[1], p[3]]; }
             else { t1 = [p[0], p[3]]; t2 = [p[1], p[2]]; }

             for (const s of p) {
                 cost += scoreCache.get(s.player.id)!;
                 availablePool = availablePool.filter(item => item.player.id !== s.player.id);
             }

             const penalty = calculateMatchPenalty(t1, t2, cType);
             cost += penalty;
             matches.push({ t1, t2, cType });
         }
     }
     
     if (matches.length === targetCourts && cost < bestCost) {
         bestCost = cost;
         bestMatches = matches;
     }
  }

  if (bestMatches.length === 0) {
      return { matches: [], error: '無法分配符合條件的組合，請檢查場地與性別設定' };
  }

  const generatedMatches: ScheduleItem[] = [];
  bestMatches.forEach((m, idx) => {
      const match = createMatch(
          [m.t1[0].player, m.t1[1].player],
          [m.t2[0].player, m.t2[1].player],
          m.cType
      );

      let msg: string | undefined = undefined;
      if (type === MatchType.MIXED_DOUBLES && m.cType !== MatchType.MIXED_DOUBLES) {
          if (m.cType === MatchType.MENS_DOUBLES) msg = '彈性切換男雙';
          else if (m.cType === MatchType.WOMENS_DOUBLES) msg = '彈性切換女雙';
          else msg = '彈性切換雙打';
      }

      generatedMatches.push({
          ...match,
          court: startCourtNumber + idx,
          sequence: startSequence + idx,
          message: msg
      });
  });

  return { matches: generatedMatches, error: null, notice: fallbackNotice };
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
): { match: ScheduleItem | null, error: string | null, notice?: string | null } => {
    const result = generateNextMatchesGroup(
        allPlayers, matchHistory, activeMatches, mixPartners, avoidGenderSkew, type, enableSkillLevel, fixedPairs, 1, courtNumber, firstMatchPlayerIds, skillMode
    );
    if (result.error || result.matches.length === 0) return { match: null, error: result.error, notice: result.notice };
    return { match: result.matches[0], error: null, notice: result.notice };
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
): { schedule: ScheduleItem[], error: string | null, notice?: string | null } => {

  const schedule: ScheduleItem[] = [];
  const pool = allPlayers.filter(p => p.status !== 'SUSPENDED');
  const totalSlotsNeeded = pool.length * rounds;
  const totalMatches = Math.ceil(totalSlotsNeeded / 4);
  
  let currentMatchCount = 0;
  let roundNumber = 1;
  let overallNotice: string | null = null;

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

      if (result.notice && !overallNotice) {
          overallNotice = result.notice;
      }

      schedule.push(...result.matches);
      currentMatchCount += result.matches.length;
      roundNumber++;
  }

  return { schedule, error: null, notice: overallNotice };
};

export const suggestWaitList = (
  allPlayers: Player[],
  matchHistory: ScheduleItem[],
  activeMatches: ScheduleItem[],
  type: MatchType
): WaitingPlayerInfo[] => {
  const statsMap = new Map<string, PlayerStats>();
  
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
                  stat.forcedPlaysRemaining = 1;
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
      if (s.consecutiveRests >= 2) score -= 80000000;
      else if (s.consecutiveRests === 1) score -= 3000000;
      
      if (s.consecutivePlays >= 3) score += 70000000;
      else if (s.consecutivePlays === 2) score += 25000000;
      else if (s.consecutivePlays === 1) score += 3000000;
      
      score -= (s.consecutiveRestTwiceCount || 0) * 50000;
      return score; 
  };

  waitingStats.sort((a, b) => getScore(a) - getScore(b));

  return waitingStats.map(s => ({
    player: s.player,
    restCount: s.consecutiveRests
  }));
};
