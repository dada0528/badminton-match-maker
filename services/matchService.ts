import { Player, Gender, MatchType, SkillMode, ScheduleItem, WaitingPlayerInfo } from '../types';

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

const createMatch = (t1: [Player, Player], t2: [Player, Player], type: MatchType): MatchType extends any ? any : any => ({
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

const groupMatchesIntoRounds = (matches: ScheduleItem[], maxCourts: number): ScheduleItem[][] => {
  const rounds: ScheduleItem[][] = [];
  let currentRound: ScheduleItem[] = [];
  let currentRoundPlayers = new Set<string>();
  let currentRoundCourts = new Set<number>();

  for (const match of matches) {
    const p1 = match.teamA.player1.id;
    const p2 = match.teamA.player2.id;
    const p3 = match.teamB.player1.id;
    const p4 = match.teamB.player2.id;
    const court = match.court;

    const hasPlayerOverlap = currentRoundPlayers.has(p1) || currentRoundPlayers.has(p2) || currentRoundPlayers.has(p3) || currentRoundPlayers.has(p4);
    const hasCourtOverlap = court !== undefined && currentRoundCourts.has(court);
    const isRoundFull = currentRound.length >= maxCourts;

    if (hasPlayerOverlap || hasCourtOverlap || isRoundFull) {
      if (currentRound.length > 0) {
        rounds.push(currentRound);
      }
      currentRound = [match];
      currentRoundPlayers = new Set([p1, p2, p3, p4]);
      currentRoundCourts = court !== undefined ? new Set([court]) : new Set();
    } else {
      currentRound.push(match);
      currentRoundPlayers.add(p1);
      currentRoundPlayers.add(p2);
      currentRoundPlayers.add(p3);
      currentRoundPlayers.add(p4);
      if (court !== undefined) currentRoundCourts.add(court);
    }
  }
  if (currentRound.length > 0) {
    rounds.push(currentRound);
  }
  return rounds;
};

export const generateNextMatchesGroup = (
  allPlayers: Player[],
  matchHistory: ScheduleItem[],
  activeMatches: (ScheduleItem | null)[],
  mixPartners: boolean,
  avoidGenderSkew: boolean,
  type: MatchType,
  enableSkillLevel: boolean = false,
  fixedPairs: Array<[string, string]> = [],
  courtsToGenerate: number = 1,
  startCourtNumber: number = 1,
  firstMatchPlayerIds: string[] = [],
  skillMode: SkillMode = 'BALANCED',
  startSequence: number = 1,
  rejectedPlayerIds?: string[],
  rejectedTeamKeys?: string[]
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

  const maxCourts = Math.max(activeMatches.length, courtsToGenerate, 1);
  const rounds = groupMatchesIntoRounds(allPastMatches, maxCourts);
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
              if (stat.consecutiveRests >= 2) {
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
      
      // Absolute highest priority for players who have rested 2+ consecutive rounds
      if (s.consecutiveRests >= 2 || s.forcedPlaysRemaining > 0) {
          return -1000000000 * s.consecutiveRests + effectivePlayed * 1000 + Math.random() * 10;
      }
      
      let score = effectivePlayed * 10000000;
      
      // Rest rewards (prioritize rested players)
      if (s.consecutiveRests === 1) score -= 30000000;
      
      // Continuous Play / Fatigue Penalties:
      if (s.consecutivePlays >= 3) score += 70000000;      // 3+ matches in a row -> massive penalty
      else if (s.consecutivePlays === 2) score += 35000000; // 2 matches in a row -> heavy penalty
      else if (s.consecutivePlays === 1) score += 10000000; // 1 match in a row -> moderate penalty
      
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
                  penalty -= 60000;
              } else {
                  if (recDist === 1) penalty += 400000;
                  else if (recDist === 2) penalty += 80000;
                  else if (recDist === 3) penalty += 20000;
                  
                  penalty += count * 15000;
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
              penalty -= 20000;
          } else {
              if (recDist === 1) penalty += 200000;
              else if (recDist === 2) penalty += 40000;
              else if (recDist === 3) penalty += 10000;
              
              penalty += count * 5000;
          }
      });

      // 2.5 Cross-court Mixing Penalty: Prevent any 2 players from the same recent match being tied together
      const allPairs = [pA, pB, ...oppKeys];
      allPairs.forEach(key => {
          const pDist = recentPartnerDistance.get(key) ?? 999;
          const oDist = recentOpponentDistance.get(key) ?? 999;
          const minDist = Math.min(pDist, oDist);
          
          // Heavy penalty if they played in the EXACT SAME match in the previous round
          if (minDist === 1) penalty += 300000;
          else if (minDist === 2) penalty += 50000;
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
          penalty += 50000000000; // 50 Billion penalty to guarantee it never repeats
      }

      // 4.5 Reselect ("再選一次") line-up constraints:
      if (rejectedPlayerIds && rejectedPlayerIds.length > 0) {
          const rejectedSet = new Set(rejectedPlayerIds);
          const currentFourIds = [allFour[0].player.id, allFour[1].player.id, allFour[2].player.id, allFour[3].player.id];
          const overlapCount = currentFourIds.filter(id => rejectedSet.has(id)).length;

          // How many available eligible players are outside the rejected set?
          const nonRejectedAvailableCount = availableStats.filter(s => !rejectedSet.has(s.player.id)).length;

          // If there are at least 2 non-rejected players available, overlap can be at most 2.
          // If only 1 non-rejected player is available (e.g. 5 total available), overlap can be at most 3.
          // If 0 non-rejected players available (e.g. 4 total available), overlap is 4, but team pairings must change.
          let maxAllowedOverlap = 2;
          if (nonRejectedAvailableCount >= 2) {
              maxAllowedOverlap = 2;
          } else if (nonRejectedAvailableCount === 1) {
              maxAllowedOverlap = 3;
          } else {
              maxAllowedOverlap = 4;
          }

          if (overlapCount > maxAllowedOverlap) {
              penalty += 50000000000; // Strictly forbidden
          }

          if (overlapCount === 4) {
              // Same 4 players - ensure teams/partners are different
              const curTeamAKey = getTeamKey(t1[0].player.id, t1[1].player.id);
              const curTeamBKey = getTeamKey(t2[0].player.id, t2[1].player.id);
              if (rejectedTeamKeys && (rejectedTeamKeys.includes(curTeamAKey) || rejectedTeamKeys.includes(curTeamBKey))) {
                  penalty += 50000000000; // Disallow exact same team pairings
              }
          }

          // Preference for even fewer overlaps when possible (e.g. 0 or 1 overlap vs 2)
          penalty += overlapCount * 50000;
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
          
          if ((t1M === 2 && t2M === 0) || (t1M === 0 && t2M === 2)) {
              penalty += 1000000;
          } else if (totalM === 1 || totalM === 3) {
              penalty += 1000000;
          } else if (totalM === 0 || totalM === 4) {
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

  const rejectedSet = new Set(rejectedPlayerIds || []);
  const availableNonRejected = availableStats.filter(s => !rejectedSet.has(s.player.id));
  const availableRejected = availableStats.filter(s => rejectedSet.has(s.player.id));

  // Determine guaranteed mandatory players (players who rested >= 2 matches)
  const isMandatory = (s: PlayerStats) => s.consecutiveRests >= 2 || s.forcedPlaysRemaining > 0;
  
  // Prepare candidates pools
  let candidatePoolM: PlayerStats[] = [];
  let candidatePoolF: PlayerStats[] = [];
  let candidatePoolAll: PlayerStats[] = [];

  let guaranteedMandatoryM: PlayerStats[] = [];
  let guaranteedMandatoryF: PlayerStats[] = [];
  let guaranteedMandatoryAll: PlayerStats[] = [];

  const neededTotal = targetCourts * 4;

  if (type === MatchType.MIXED_DOUBLES) {
      const availM = availableStats.filter(s => s.player.gender === Gender.MALE);
      const availF = availableStats.filter(s => s.player.gender === Gender.FEMALE);
      
      const mMixNeeded = courtTypes.filter(c => c === MatchType.MIXED_DOUBLES).length * 2;
      const mMenNeeded = courtTypes.filter(c => c === MatchType.MENS_DOUBLES).length * 4;
      const mNeeded = mMixNeeded + mMenNeeded;

      const fMixNeeded = courtTypes.filter(c => c === MatchType.MIXED_DOUBLES).length * 2;
      const fWomenNeeded = courtTypes.filter(c => c === MatchType.WOMENS_DOUBLES).length * 4;
      const fNeeded = fMixNeeded + fWomenNeeded;

      if (rejectedPlayerIds && rejectedPlayerIds.length > 0) {
          candidatePoolM = availM;
          candidatePoolF = availF;
          guaranteedMandatoryM = availM.filter(s => isMandatory(s) && !rejectedSet.has(s.player.id)).slice(0, mNeeded);
          guaranteedMandatoryF = availF.filter(s => isMandatory(s) && !rejectedSet.has(s.player.id)).slice(0, fNeeded);
      } else {
          const mandM = availM.filter(isMandatory);
          const mandF = availF.filter(isMandatory);

          guaranteedMandatoryM = mandM.slice(0, mNeeded);
          guaranteedMandatoryF = mandF.slice(0, fNeeded);

          const nonMandM = availM.filter(s => !guaranteedMandatoryM.includes(s));
          const nonMandF = availF.filter(s => !guaranteedMandatoryF.includes(s));

          const extraMNeeded = mNeeded - guaranteedMandatoryM.length;
          const extraFNeeded = fNeeded - guaranteedMandatoryF.length;

          // Add top non-mandatory candidates plus a few extras for variety
          candidatePoolM = nonMandM.slice(0, Math.max(extraMNeeded + 6, extraMNeeded));
          candidatePoolF = nonMandF.slice(0, Math.max(extraFNeeded + 6, extraFNeeded));
      }
  } else {
      if (rejectedPlayerIds && rejectedPlayerIds.length > 0) {
          candidatePoolAll = [...availableNonRejected, ...availableRejected];
          guaranteedMandatoryAll = availableNonRejected.filter(isMandatory).slice(0, neededTotal);
      } else {
          const mand = availableStats.filter(isMandatory);
          guaranteedMandatoryAll = mand.slice(0, neededTotal);
          const nonMand = availableStats.filter(s => !guaranteedMandatoryAll.includes(s));
          const extraNeeded = neededTotal - guaranteedMandatoryAll.length;
          candidatePoolAll = nonMand.slice(0, Math.max(extraNeeded + 8, extraNeeded));
      }
  }

  const iterations = 3000;
  
  for (let i = 0; i < iterations; i++) {
     let cost = 0;
     const matches: Array<{t1: PlayerStats[], t2: PlayerStats[], cType: MatchType}> = [];
     
     let sampledPool: PlayerStats[];
     if (type === MatchType.MIXED_DOUBLES) {
         const mMixNeeded = courtTypes.filter(c => c === MatchType.MIXED_DOUBLES).length * 2;
         const mMenNeeded = courtTypes.filter(c => c === MatchType.MENS_DOUBLES).length * 4;
         const mNeeded = mMixNeeded + mMenNeeded;

         const fMixNeeded = courtTypes.filter(c => c === MatchType.MIXED_DOUBLES).length * 2;
         const fWomenNeeded = courtTypes.filter(c => c === MatchType.WOMENS_DOUBLES).length * 4;
         const fNeeded = fMixNeeded + fWomenNeeded;

         const neededMFromPool = Math.max(0, mNeeded - guaranteedMandatoryM.length);
         const neededFFromPool = Math.max(0, fNeeded - guaranteedMandatoryF.length);

         const selectedM = [...guaranteedMandatoryM, ...shuffle(candidatePoolM).slice(0, neededMFromPool)];
         const selectedF = [...guaranteedMandatoryF, ...shuffle(candidatePoolF).slice(0, neededFFromPool)];
         sampledPool = [...selectedM, ...selectedF];
     } else {
         if (rejectedPlayerIds && rejectedPlayerIds.length > 0 && availableNonRejected.length > 0) {
             const nonRejCount = availableNonRejected.length;
             const maxAllowed = nonRejCount >= 2 ? 2 : (nonRejCount === 1 ? 3 : 4);
             const minFromNonRej = Math.min(nonRejCount, 4 - maxAllowed);
             const takeNonRej = Math.min(nonRejCount, Math.max(minFromNonRej, Math.floor(Math.random() * (nonRejCount + 1))));
             const pickedNonRej = shuffle(availableNonRejected).slice(0, takeNonRej);
             const neededRemaining = Math.max(0, neededTotal - pickedNonRej.length);
             const poolRemaining = [...availableNonRejected.filter(s => !pickedNonRej.includes(s)), ...availableRejected];
             sampledPool = [...pickedNonRej, ...shuffle(poolRemaining).slice(0, neededRemaining)];
         } else {
             const neededFromPool = Math.max(0, neededTotal - guaranteedMandatoryAll.length);
             sampledPool = [...guaranteedMandatoryAll, ...shuffle(candidatePoolAll).slice(0, neededFromPool)];
         }
     }

     let availablePool = [...sampledPool];

     for (let c = 0; c < targetCourts; c++) {
         const cType = courtTypes[c];

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
  activeMatches: (ScheduleItem | null)[],
  mixPartners: boolean,
  avoidGenderSkew: boolean,
  type: MatchType,
  enableSkillLevel: boolean = false,
  fixedPairs: Array<[string, string]> = [],
  courtNumber: number = 1,
  firstMatchPlayerIds: string[] = [],
  skillMode: SkillMode = 'BALANCED',
  rejectedPlayerIds?: string[],
  rejectedTeamKeys?: string[]
): { match: ScheduleItem | null, error: string | null, notice?: string | null } => {
    const result = generateNextMatchesGroup(
        allPlayers, matchHistory, activeMatches, mixPartners, avoidGenderSkew, type, enableSkillLevel, fixedPairs, 1, courtNumber, firstMatchPlayerIds, skillMode, 1, rejectedPlayerIds, rejectedTeamKeys
    );
    if (result.error || result.matches.length === 0) return { match: null, error: result.error, notice: result.notice };
    return { match: result.matches[0], error: null, notice: result.notice };
};

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
  const maxCourts = Math.max(activeMatches.length, 1);
  const rounds = groupMatchesIntoRounds(allPastMatches, maxCourts);

  for (let i = 0; i < rounds.length; i++) {
      const batchMatches = rounds[i];
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
              if (stat.consecutiveRests >= 2) {
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
      if (s.consecutiveRests >= 2 || s.forcedPlaysRemaining > 0) {
          return -1000000000 * s.consecutiveRests + effectivePlayed;
      }
      
      let score = effectivePlayed * 10000000;
      if (s.consecutiveRests === 1) score -= 30000000;
      
      if (s.consecutivePlays >= 3) score += 70000000;
      else if (s.consecutivePlays === 2) score += 35000000;
      else if (s.consecutivePlays === 1) score += 10000000;
      
      score -= (s.consecutiveRestTwiceCount || 0) * 50000;
      return score; 
  };

  waitingStats.sort((a, b) => getScore(a) - getScore(b));

  return waitingStats.map(s => ({
    player: s.player,
    restCount: s.consecutiveRests
  }));
};
