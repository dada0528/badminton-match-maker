import { Player, Team, Match, MatchType, Gender, ScheduleItem, WaitingPlayerInfo } from '../types';

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
const getTeamKey = (p1: Player, p2: Player): string => {
  return [p1.id, p2.id].sort().join('-');
};

const createMatch = (t1: [Player, Player], t2: [Player, Player], type: MatchType): Match => ({
    id: Date.now().toString() + Math.random().toString(),
    teamA: { player1: t1[0], player2: t1[1] },
    teamB: { player1: t2[0], player2: t2[1] },
    type,
    timestamp: Date.now(),
});

// Single generation attempt
const generateCandidate = (players: Player[], type: MatchType): { matches: Match[], waiting: Player[], error: string | null } => {
  let pool = [...players];
  const matches: Match[] = [];

  // Filter logic
  if (type === MatchType.MENS_DOUBLES) {
    pool = pool.filter(p => p.gender === Gender.MALE);
  } else if (type === MatchType.WOMENS_DOUBLES) {
    pool = pool.filter(p => p.gender === Gender.FEMALE);
  }

  // Basic validation should be done by caller, but safe to check pool size logic for Mixed
  if (type === MatchType.MIXED_DOUBLES) {
    let males = shuffle(players.filter(p => p.gender === Gender.MALE));
    let females = shuffle(players.filter(p => p.gender === Gender.FEMALE));

    while (males.length >= 2 && females.length >= 2) {
      matches.push(createMatch([males.pop()!, females.pop()!], [males.pop()!, females.pop()!], type));
    }
  } else {
    // Standard / Single Gender
    let processingPool = shuffle(pool);
    while (processingPool.length >= 4) {
      matches.push(createMatch(
          [processingPool.pop()!, processingPool.pop()!], 
          [processingPool.pop()!, processingPool.pop()!], 
          type
      ));
    }
  }

  // Calculate waiting
  const playingIds = new Set(matches.flatMap(m => [m.teamA.player1.id, m.teamA.player2.id, m.teamB.player1.id, m.teamB.player2.id]));
  const waiting = players.filter(p => !playingIds.has(p.id));

  if (matches.length === 0 && type === MatchType.MIXED_DOUBLES) {
      return { matches: [], waiting: players, error: '混雙需要至少 2 男 2 女！' };
  }

  return { matches, waiting, error: null };
};

export const generateMatches = (
  players: Player[],
  type: MatchType,
  previousMatches: Match[] = []
): { matches: Match[]; waiting: Player[]; error: string | null } => {
  
  // 1. Initial Validation
  let poolCount = players.length;
  if (type === MatchType.MENS_DOUBLES) poolCount = players.filter(p => p.gender === Gender.MALE).length;
  if (type === MatchType.WOMENS_DOUBLES) poolCount = players.filter(p => p.gender === Gender.FEMALE).length;

  if (poolCount < 4) {
    if (type === MatchType.MENS_DOUBLES) return { matches: [], waiting: players, error: '男生人數不足 4 人，無法進行男雙！' };
    if (type === MatchType.WOMENS_DOUBLES) return { matches: [], waiting: players, error: '女生人數不足 4 人，無法進行女雙！' };
    return { matches: [], waiting: players, error: '人數不足，至少需要 4 人才能開始比賽！' };
  }

  // 2. Build avoidance set from previous matches
  const avoidKeys = new Set<string>();
  previousMatches.forEach(m => {
    avoidKeys.add(getTeamKey(m.teamA.player1, m.teamA.player2));
    avoidKeys.add(getTeamKey(m.teamB.player1, m.teamB.player2));
  });

  // 3. Try to find the best shuffle (least overlap with previous)
  let bestResult: { matches: Match[], waiting: Player[], error: string | null } | null = null;
  let minOverlap = Infinity;
  
  // Increase attempts to find a good shuffle
  const ATTEMPTS = avoidKeys.size > 0 ? 200 : 1;

  for (let i = 0; i < ATTEMPTS; i++) {
    const result = generateCandidate(players, type);
    
    if (result.error) return result; 

    // Calculate overlap score
    let currentOverlap = 0;
    result.matches.forEach(m => {
        // Heavy penalty for same teams
        if (avoidKeys.has(getTeamKey(m.teamA.player1, m.teamA.player2))) currentOverlap += 10;
        if (avoidKeys.has(getTeamKey(m.teamB.player1, m.teamB.player2))) currentOverlap += 10;
        
        // Minor penalty for same people in same match (even if swapped opponents)
        // This encourages completely different match compositions
        previousMatches.forEach(pm => {
           const currentIds = new Set([m.teamA.player1.id, m.teamA.player2.id, m.teamB.player1.id, m.teamB.player2.id]);
           const prevIds = new Set([pm.teamA.player1.id, pm.teamA.player2.id, pm.teamB.player1.id, pm.teamB.player2.id]);
           // Intersection count
           let common = 0;
           currentIds.forEach(id => { if(prevIds.has(id)) common++; });
           if (common === 4) currentOverlap += 1; // Same 4 people playing again
        });
    });

    if (currentOverlap < minOverlap) {
        minOverlap = currentOverlap;
        bestResult = result;
    }

    if (minOverlap === 0) break;
  }

  return bestResult || { matches: [], waiting: players, error: '生成失敗' };
};

// --- DYNAMIC MATCH GENERATOR ---

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
): { match: ScheduleItem | null, error: string | null } => {
  // 1. Filter Pool
  let pool = [...allPlayers];
  if (type === MatchType.MENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.MALE);
  if (type === MatchType.WOMENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.FEMALE);
  
  if (pool.length < 4) return { match: null, error: '人數不足 4 人，無法排程' };
  if (type === MatchType.MIXED_DOUBLES) {
     const m = pool.filter(p => p.gender === Gender.MALE).length;
     const f = pool.filter(p => p.gender === Gender.FEMALE).length;
     if (m < 2 || f < 2) return { match: null, error: '混雙需要至少 2 男 2 女' };
  }

  // 2. Initialize Stats and History from matchHistory and activeMatches
  const statsMap = new Map<string, PlayerStats & { lastPlayedIndex: number }>();
  const partnerHistory = new Map<string, number>(); 
  const opponentHistory = new Map<string, number>();

  const getPartnerKey = (p1: Player | string, p2: Player | string) => {
    const id1 = typeof p1 === 'string' ? p1 : p1.id;
    const id2 = typeof p2 === 'string' ? p2 : p2.id;
    return [id1, id2].sort().join('-');
  };
  
  const recordPartnership = (id1: string, id2: string) => {
    const key = getPartnerKey(id1, id2);
    partnerHistory.set(key, (partnerHistory.get(key) || 0) + 1);
  };
  
  const recordOpponent = (id1: string, id2: string) => {
    const key = getPartnerKey(id1, id2);
    opponentHistory.set(key, (opponentHistory.get(key) || 0) + 1);
  }

  pool.forEach(p => {
    statsMap.set(p.id, { 
      player: p, 
      played: 0, 
      consecutivePlays: 0, 
      consecutiveRests: 0,
      consecutiveRestTwiceCount: 0,
      forcedPlaysRemaining: 0,
      lastPlayedIndex: -1
    });
  });

  const allPastMatches = [...matchHistory, ...activeMatches.filter((m): m is ScheduleItem => m !== null)];
  // Use activeMatches.length as the estimated court count to group batches
  const courtCount = activeMatches.length || 1;

  for (let i = 0; i < allPastMatches.length; i += courtCount) {
      const batchMatches = allPastMatches.slice(i, i + courtCount);
      const playersInBatch = new Set<string>();
      
      batchMatches.forEach(match => {
          const p1 = match.teamA.player1.id;
          const p2 = match.teamA.player2.id;
          const p3 = match.teamB.player1.id;
          const p4 = match.teamB.player2.id;
          
          playersInBatch.add(p1);
          playersInBatch.add(p2);
          playersInBatch.add(p3);
          playersInBatch.add(p4);

          recordPartnership(p1, p2);
          recordPartnership(p3, p4);
          recordOpponent(p1, p3);
          recordOpponent(p1, p4);
          recordOpponent(p2, p3);
          recordOpponent(p2, p4);
      });

      statsMap.forEach(stat => {
          if (playersInBatch.has(stat.player.id)) {
              stat.played++;
              stat.consecutivePlays++;
              stat.consecutiveRests = 0;
              stat.lastPlayedIndex = i;
              if (stat.forcedPlaysRemaining > 0) stat.forcedPlaysRemaining--;
          } else {
              stat.consecutivePlays = 0;
              stat.consecutiveRests++;
              if (stat.consecutiveRests === 2) {
                  stat.consecutiveRestTwiceCount++;
                  stat.forcedPlaysRemaining = 2;
              }
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

  // Filter out players currently playing
  const availableStats = Array.from(statsMap.values()).filter(s => !activePlayerIds.has(s.player.id));

  // Handle first match forcing logic
  let selectedPlayersToPlay: (PlayerStats & { lastPlayedIndex: number })[] = [];
  
  if (matchHistory.length === 0 && activeMatches.every(m => m === null) && courtNumber === 1 && firstMatchPlayerIds.length === 4) {
      selectedPlayersToPlay = availableStats.filter(s => firstMatchPlayerIds.includes(s.player.id));
      if (selectedPlayersToPlay.length !== 4) {
          // If we couldn't find all 4, fallback to normal selection
          selectedPlayersToPlay = [];
      }
  }

  if (availableStats.length < 4) {
    return { match: null, error: '可用選手不足 4 人 (其他選手可能正在比賽中)' };
  }

  // --- SELECTION LOGIC ---
  let selectedStats = selectedPlayersToPlay;

  if (selectedStats.length !== 4) {
      const getScore = (s: PlayerStats & { lastPlayedIndex: number }): number => {
          if (s.forcedPlaysRemaining > 0) {
              return -10000000 + s.played; // 強制上場
          }

          let score = 0;
          if (mixPartners) {
              // 智慧輪替 (打散)：放寬一點出場數的嚴格限制，加入亂數來打破 A-B-A-B 輪替僵局
              if (s.consecutivePlays >= 2) {
                  score += 5000000; // 絕對禁止連打三場
              } else if (s.consecutiveRests >= 2) {
                  score -= 5000000; // 絕對禁止連休三場
              }
              score += s.played * 1000;
              score += Math.random() * 5000;
          } else {
              // 核心規則：出場次數最優先
              score = s.played * 1000000;
              
              if (s.consecutiveRests >= 3) {
                  score -= 300000;
              } else if (s.consecutiveRests >= 2) {
                  score -= 200000; // 在相同出場次數中，連休兩場者最優先上場
              }
              score -= s.consecutiveRestTwiceCount * 10000;

              if (s.consecutivePlays >= 1 && s.consecutiveRestTwiceCount === 0) {
                  score += 500000; // 嚴格做一休一
              }
              score -= s.consecutiveRests * 1000;
              score += Math.random() * 100;
          }
          
          return score; 
      };

      const scoreCache = new Map<string, number>();
      availableStats.forEach(s => scoreCache.set(s.player.id, getScore(s)));

      // Adjust scores for fixed pairs
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

      if (type === MatchType.MIXED_DOUBLES) {
          let mCount = 0;
          let fCount = 0;
          // Count initially forced players if any (though usually if forced, length == 4 and this block is skipped)
          for (const s of selectedStats) {
              if (s.player.gender === Gender.MALE) mCount++;
              else fCount++;
          }
          
          for (const s of availableStats) {
              if (mCount === 2 && fCount === 2) break;
              if (selectedStats.includes(s)) continue;
              
              const isMale = s.player.gender === Gender.MALE;
              if (isMale && mCount === 2) continue;
              if (!isMale && fCount === 2) continue;

              const pair = fixedPairs.find(p => p.includes(s.player.id));
              if (pair) {
                  const partnerId = pair[0] === s.player.id ? pair[1] : pair[0];
                  
                  if (selectedStats.some(ps => ps.player.id === partnerId)) {
                      selectedStats.push(s);
                      if (isMale) mCount++; else fCount++;
                      continue;
                  }

                  const partnerStat = availableStats.find(ps => ps.player.id === partnerId);
                  if (partnerStat && !selectedStats.includes(partnerStat)) {
                      const partnerIsMale = partnerStat.player.gender === Gender.MALE;
                      const newMCount = mCount + (isMale ? 1 : 0) + (partnerIsMale ? 1 : 0);
                      const newFCount = fCount + (!isMale ? 1 : 0) + (!partnerIsMale ? 1 : 0);
                      
                      if (newMCount <= 2 && newFCount <= 2) {
                          selectedStats.push(s, partnerStat);
                          mCount = newMCount;
                          fCount = newFCount;
                      }
                      continue;
                  } else {
                      continue;
                  }
              } else {
                  selectedStats.push(s);
                  if (isMale) mCount++; else fCount++;
              }
          }
          if (mCount < 2 || fCount < 2) {
              return { match: null, error: '無法湊齊混雙所需的男女比例 (可能受固定搭檔或比賽中選手影響)' };
          }
      } else {
          let count = selectedStats.length;
          for (const s of availableStats) {
              if (count === 4) break;
              if (selectedStats.includes(s)) continue;

              const pair = fixedPairs.find(p => p.includes(s.player.id));
              if (pair) {
                  const partnerId = pair[0] === s.player.id ? pair[1] : pair[0];
                  
                  if (selectedStats.some(ps => ps.player.id === partnerId)) {
                      selectedStats.push(s);
                      count++;
                      continue;
                  }

                  const partnerStat = availableStats.find(ps => ps.player.id === partnerId);
                  if (partnerStat && !selectedStats.includes(partnerStat)) {
                      if (count + 2 <= 4) {
                          selectedStats.push(s, partnerStat);
                          count += 2;
                      }
                      continue;
                  } else {
                      continue;
                  }
              } else {
                  selectedStats.push(s);
                  count++;
              }
          }
          if (count < 4) {
              return { match: null, error: '無法湊齊 4 人' };
          }
      }
  }

  const selectedPlayers = selectedStats.map(s => s.player);

  // --- FORM TEAMS ---
  let t1: [Player, Player], t2: [Player, Player];
  let chosenPermutation: { t1: [Player, Player], t2: [Player, Player] } | null = null;
  let permutations: Array<{ t1: [Player, Player], t2: [Player, Player], score: number }> = [];

  if (type === MatchType.MIXED_DOUBLES) {
      const m = selectedPlayers.filter(p => p.gender === Gender.MALE);
      const f = selectedPlayers.filter(p => p.gender === Gender.FEMALE);
      permutations.push({ t1: [m[0], f[0]], t2: [m[1], f[1]], score: 0 });
      permutations.push({ t1: [m[0], f[1]], t2: [m[1], f[0]], score: 0 });
  } else {
      const p = selectedPlayers;
      permutations.push({ t1: [p[0], p[1]], t2: [p[2], p[3]], score: 0 });
      permutations.push({ t1: [p[0], p[2]], t2: [p[1], p[3]], score: 0 });
      permutations.push({ t1: [p[0], p[3]], t2: [p[1], p[2]], score: 0 });
  }
  
  permutations.forEach(perm => {
       if (mixPartners) {
           let pScore = 0;
           pScore += (partnerHistory.get(getPartnerKey(perm.t1[0], perm.t1[1])) || 0);
           pScore += (partnerHistory.get(getPartnerKey(perm.t2[0], perm.t2[1])) || 0);

           let oppScore = 0;
           oppScore += (opponentHistory.get(getPartnerKey(perm.t1[0], perm.t2[0])) || 0);
           oppScore += (opponentHistory.get(getPartnerKey(perm.t1[0], perm.t2[1])) || 0);
           oppScore += (opponentHistory.get(getPartnerKey(perm.t1[1], perm.t2[0])) || 0);
           oppScore += (opponentHistory.get(getPartnerKey(perm.t1[1], perm.t2[1])) || 0);
           
           perm.score += (pScore * 10) + (oppScore * 2);
       }

       if (avoidGenderSkew) {
           const t1Males = (perm.t1[0].gender === Gender.MALE ? 1 : 0) + (perm.t1[1].gender === Gender.MALE ? 1 : 0);
           const t2Males = (perm.t2[0].gender === Gender.MALE ? 1 : 0) + (perm.t2[1].gender === Gender.MALE ? 1 : 0);
           
           if ((t1Males === 2 && t2Males === 0) || (t1Males === 0 && t2Males === 2)) {
               perm.score += 50000;
           }
       }

       if (enableSkillLevel) {
           const t1Level = (perm.t1[0].level || 3) + (perm.t1[1].level || 3);
           const t2Level = (perm.t2[0].level || 3) + (perm.t2[1].level || 3);
           const levelDiff = Math.abs(t1Level - t2Level);
           perm.score += (levelDiff * levelDiff * 1000);
       }

       fixedPairs.forEach(([id1, id2]) => {
           const oneInT1OneInT2 = ((perm.t1[0].id === id1 || perm.t1[1].id === id1) && (perm.t2[0].id === id2 || perm.t2[1].id === id2)) ||
                                  ((perm.t2[0].id === id1 || perm.t2[1].id === id1) && (perm.t1[0].id === id2 || perm.t1[1].id === id2));
           
           if (oneInT1OneInT2) {
               perm.score += 1000000;
           }
       });
  });

  permutations.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return Math.random() - 0.5;
  });

  chosenPermutation = permutations[0];
  t1 = chosenPermutation!.t1;
  t2 = chosenPermutation!.t2;

  const match: ScheduleItem = {
      id: Date.now().toString() + Math.random().toString(),
      teamA: { player1: t1[0], player2: t1[1] },
      teamB: { player1: t2[0], player2: t2[1] },
      type,
      timestamp: Date.now(),
      sequence: matchHistory.length + activeMatches.length + 1,
      court: courtNumber,
      waiting: []
  };

  return { match, error: null };
};

// --- SCHEDULE GENERATOR ---

interface PlayerStats {
  player: Player;
  played: number;
  consecutivePlays: number;
  consecutiveRests: number;
  consecutiveRestTwiceCount: number;
  forcedPlaysRemaining: number;
}

export const generateSchedule = (
  allPlayers: Player[],
  rounds: number,
  mixPartners: boolean, // Renamed from shuffleTeams to mixPartners to be more explicit
  avoidGenderSkew: boolean, // New parameter to avoid MM vs FF
  type: MatchType,
  courtCount: number = 1, // New parameter for number of courts
  firstMatchPlayerIds: string[] = [], // New parameter for forcing first match players
  enableSkillLevel: boolean = false, // New parameter for skill level balancing
  fixedPairs: Array<[string, string]> = [] // New parameter for fixed pairs
): { schedule: ScheduleItem[], error: string | null } => {

  // 1. Filter Pool
  let pool = [...allPlayers];
  if (type === MatchType.MENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.MALE);
  if (type === MatchType.WOMENS_DOUBLES) pool = pool.filter(p => p.gender === Gender.FEMALE);
  
  if (pool.length < 4) return { schedule: [], error: '人數不足 4 人，無法排程' };
  if (type === MatchType.MIXED_DOUBLES) {
     const m = pool.filter(p => p.gender === Gender.MALE).length;
     const f = pool.filter(p => p.gender === Gender.FEMALE).length;
     if (m < 2 || f < 2) return { schedule: [], error: '混雙需要至少 2 男 2 女' };
  }

  // 2. Initialize Stats and History
  const statsMap = new Map<string, PlayerStats>();
  // Track how many times players have partnered. Key: "id1-id2" (sorted), Value: count
  const partnerHistory = new Map<string, number>(); 
  // Track how many times players have been opponents. Key: "id1-id2" (sorted), Value: count
  const opponentHistory = new Map<string, number>();

  const getPartnerKey = (p1: Player, p2: Player) => [p1.id, p2.id].sort().join('-');
  
  // Update helpers
  const recordPartnership = (p1: Player, p2: Player) => {
    const key = getPartnerKey(p1, p2);
    partnerHistory.set(key, (partnerHistory.get(key) || 0) + 1);
  };
  
  const recordOpponent = (p1: Player, p2: Player) => {
    const key = getPartnerKey(p1, p2);
    opponentHistory.set(key, (opponentHistory.get(key) || 0) + 1);
  }

  pool.forEach(p => {
    statsMap.set(p.id, { 
      player: p, 
      played: 0, 
      consecutivePlays: 0, 
      consecutiveRests: 0,
      consecutiveRestTwiceCount: 0,
      forcedPlaysRemaining: 0
    });
  });

  const schedule: ScheduleItem[] = [];
  const totalSlotsNeeded = pool.length * rounds;
  const totalMatches = Math.ceil(totalSlotsNeeded / 4);
  
  let currentMatchCount = 0;
  let roundNumber = 1;

  while (currentMatchCount < totalMatches) {
    const matchesInThisBatch: ScheduleItem[] = [];
    const playersInThisBatch = new Set<string>();
    
    // Try to fill all courts
    for (let c = 0; c < courtCount; c++) {
        if (currentMatchCount >= totalMatches) break;

        // Filter out players already selected in this batch
        const currentStats = Array.from(statsMap.values()).filter(s => !playersInThisBatch.has(s.player.id));
        
        // --- SELECTION LOGIC (Who Plays) ---
        let selectedStats: PlayerStats[] = [];

        // Check if we need to force the first match players
        if (roundNumber === 1 && c === 0 && firstMatchPlayerIds.length === 4) {
            const forcedStats = currentStats.filter(s => firstMatchPlayerIds.includes(s.player.id));
            if (forcedStats.length === 4) {
                let isValid = true;
                if (type === MatchType.MIXED_DOUBLES) {
                    const m = forcedStats.filter(s => s.player.gender === Gender.MALE).length;
                    const f = forcedStats.filter(s => s.player.gender === Gender.FEMALE).length;
                    if (m !== 2 || f !== 2) isValid = false;
                }
                if (isValid) {
                    selectedStats = forcedStats;
                }
            }
        }

        if (selectedStats.length === 0) {
            const getScore = (s: PlayerStats): number => {
               if (s.forcedPlaysRemaining > 0) {
                   return -10000000 + s.played; // 強制上場，給予極端最高優先級
               }

               let score = 0;
               if (mixPartners) {
                   // 智慧輪替 (打散)：放寬一點出場數的嚴格限制，加入亂數來打破 A-B-A-B 輪替僵局
                   if (s.consecutivePlays >= 2) {
                       score += 5000000; // 絕對禁止連打三場
                   } else if (s.consecutiveRests >= 2) {
                       score -= 5000000; // 絕對禁止連休三場
                   }
                   // 出場數仍然重要，但不像之前那麼絕對，讓亂數有機會翻盤 (差1場=1000分)
                   score += s.played * 1000;
                   // 加入較大的隨機性 (範圍5000) 讓出場數差一場的人也有可能被選到，從而完美打散 8 人固定分組
                   score += Math.random() * 5000;
               } else {
                   // 核心規則：出場次數最優先，確保最多只差一場
                   score = s.played * 1000000;
                   
                   if (s.consecutiveRests >= 3) {
                       // 絕對避免連休三場
                       score -= 300000;
                   } else if (s.consecutiveRests >= 2) {
                       // 在相同出場次數中，連休兩場者最優先上場
                       score -= 200000;
                   }

                   // 新規則：盡量平攤「連休兩場」的次數
                   // 如果之前已經有過較多次「連休兩場」，則優先讓他上場，避免再次連休
                   score -= s.consecutiveRestTwiceCount * 10000;

                   // 固定輪替：嚴格做一休一 (除非已經有連休兩場的委屈紀錄，才稍微通融)
                   if (s.consecutivePlays >= 1 && s.consecutiveRestTwiceCount === 0) {
                       score += 500000; // 大幅增加分數，強迫休息
                   }
                   // 嚴格優先挑選休息較久的人
                   score -= s.consecutiveRests * 1000;
                   score += Math.random() * 100;
               }
               
               return score; 
            };
        
            // Cache scores to ensure stable sorting since getScore uses Math.random()
            const scoreCache = new Map<string, number>();
            currentStats.forEach(s => scoreCache.set(s.player.id, getScore(s)));

            // Adjust scores for fixed pairs so they are selected together
            fixedPairs.forEach(([id1, id2]) => {
                if (scoreCache.has(id1) && scoreCache.has(id2)) {
                    const avgScore = (scoreCache.get(id1)! + scoreCache.get(id2)!) / 2;
                    scoreCache.set(id1, avgScore);
                    scoreCache.set(id2, avgScore);
                }
            });

            currentStats.sort((a, b) => {
                const scoreA = scoreCache.get(a.player.id)!;
                const scoreB = scoreCache.get(b.player.id)!;
                if (scoreA !== scoreB) return scoreA - scoreB;
                return Math.random() - 0.5;
            });
        
            if (type === MatchType.MIXED_DOUBLES) {
                let mCount = selectedStats.filter(s => s.player.gender === Gender.MALE).length;
                let fCount = selectedStats.filter(s => s.player.gender === Gender.FEMALE).length;
                for (const s of currentStats) {
                    if (mCount === 2 && fCount === 2) break;
                    if (selectedStats.includes(s)) continue;
                    
                    const isMale = s.player.gender === Gender.MALE;
                    if (isMale && mCount === 2) continue;
                    if (!isMale && fCount === 2) continue;

                    const pair = fixedPairs.find(p => p.includes(s.player.id));
                    if (pair) {
                        const partnerId = pair[0] === s.player.id ? pair[1] : pair[0];
                        
                        if (selectedStats.some(ps => ps.player.id === partnerId)) {
                            selectedStats.push(s);
                            if (isMale) mCount++; else fCount++;
                            continue;
                        }

                        const partnerStat = currentStats.find(ps => ps.player.id === partnerId);
                        if (partnerStat && !selectedStats.includes(partnerStat)) {
                            const partnerIsMale = partnerStat.player.gender === Gender.MALE;
                            const newMCount = mCount + (isMale ? 1 : 0) + (partnerIsMale ? 1 : 0);
                            const newFCount = fCount + (!isMale ? 1 : 0) + (!partnerIsMale ? 1 : 0);
                            
                            if (newMCount <= 2 && newFCount <= 2) {
                                selectedStats.push(s, partnerStat);
                                mCount = newMCount;
                                fCount = newFCount;
                            }
                            continue;
                        } else {
                            continue; // Partner not available, skip
                        }
                    } else {
                        selectedStats.push(s);
                        if (isMale) mCount++; else fCount++;
                    }
                }
            } else {
                let count = selectedStats.length;
                for (const s of currentStats) {
                    if (count === 4) break;
                    if (selectedStats.includes(s)) continue;

                    const pair = fixedPairs.find(p => p.includes(s.player.id));
                    if (pair) {
                        const partnerId = pair[0] === s.player.id ? pair[1] : pair[0];
                        
                        if (selectedStats.some(ps => ps.player.id === partnerId)) {
                            selectedStats.push(s);
                            count++;
                            continue;
                        }

                        const partnerStat = currentStats.find(ps => ps.player.id === partnerId);
                        if (partnerStat && !selectedStats.includes(partnerStat)) {
                            if (count + 2 <= 4) {
                                selectedStats.push(s, partnerStat);
                                count += 2;
                            }
                            continue;
                        } else {
                            continue; // Partner not available, skip
                        }
                    } else {
                        selectedStats.push(s);
                        count++;
                    }
                }
            }
        }
        
        const selectedPlayers = selectedStats.map(s => s.player);
    
        if (selectedPlayers.length < 4) continue; // Skip if not enough players
        
        // Mark as selected for this batch
        selectedPlayers.forEach(p => playersInThisBatch.add(p.id));
    
        // --- FORM TEAMS (Smart Pairing) ---
        let t1: [Player, Player], t2: [Player, Player];
        let chosenPermutation: { t1: [Player, Player], t2: [Player, Player] } | null = null;
        let permutations: Array<{ t1: [Player, Player], t2: [Player, Player], score: number }> = [];
    
        if (type === MatchType.MIXED_DOUBLES) {
            const m = selectedPlayers.filter(p => p.gender === Gender.MALE);
            const f = selectedPlayers.filter(p => p.gender === Gender.FEMALE);
            permutations.push({ t1: [m[0], f[0]], t2: [m[1], f[1]], score: 0 });
            permutations.push({ t1: [m[0], f[1]], t2: [m[1], f[0]], score: 0 });
        } else {
            const p = selectedPlayers;
            permutations.push({ t1: [p[0], p[1]], t2: [p[2], p[3]], score: 0 });
            permutations.push({ t1: [p[0], p[2]], t2: [p[1], p[3]], score: 0 });
            permutations.push({ t1: [p[0], p[3]], t2: [p[1], p[2]], score: 0 });
        }
        
        permutations.forEach(perm => {
             if (mixPartners) {
                 let pScore = 0;
                 pScore += (partnerHistory.get(getPartnerKey(perm.t1[0], perm.t1[1])) || 0);
                 pScore += (partnerHistory.get(getPartnerKey(perm.t2[0], perm.t2[1])) || 0);
    
                 let oppScore = 0;
                 oppScore += (opponentHistory.get(getPartnerKey(perm.t1[0], perm.t2[0])) || 0);
                 oppScore += (opponentHistory.get(getPartnerKey(perm.t1[0], perm.t2[1])) || 0);
                 oppScore += (opponentHistory.get(getPartnerKey(perm.t1[1], perm.t2[0])) || 0);
                 oppScore += (opponentHistory.get(getPartnerKey(perm.t1[1], perm.t2[1])) || 0);
                 
                 perm.score += (pScore * 10) + (oppScore * 2);
             }
    
             if (avoidGenderSkew) {
                 const t1Males = (perm.t1[0].gender === Gender.MALE ? 1 : 0) + (perm.t1[1].gender === Gender.MALE ? 1 : 0);
                 const t2Males = (perm.t2[0].gender === Gender.MALE ? 1 : 0) + (perm.t2[1].gender === Gender.MALE ? 1 : 0);
                 
                 if ((t1Males === 2 && t2Males === 0) || (t1Males === 0 && t2Males === 2)) {
                     perm.score += 50000;
                 }
             }

             if (enableSkillLevel) {
                 const t1Level = (perm.t1[0].level || 3) + (perm.t1[1].level || 3);
                 const t2Level = (perm.t2[0].level || 3) + (perm.t2[1].level || 3);
                 const levelDiff = Math.abs(t1Level - t2Level);
                 
                 // Add penalty based on level difference. 
                 // A difference of 1 is okay, but larger differences should be heavily penalized.
                 perm.score += (levelDiff * levelDiff * 1000);
             }

             // Fixed Pairs Check
             fixedPairs.forEach(([id1, id2]) => {
                 const oneInT1OneInT2 = ((perm.t1[0].id === id1 || perm.t1[1].id === id1) && (perm.t2[0].id === id2 || perm.t2[1].id === id2)) ||
                                        ((perm.t2[0].id === id1 || perm.t2[1].id === id1) && (perm.t1[0].id === id2 || perm.t1[1].id === id2));
                 
                 if (oneInT1OneInT2) {
                     perm.score += 1000000; // Huge penalty to prevent splitting fixed pairs
                 }
             });
        });
    
        permutations.sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return Math.random() - 0.5;
        });
    
        chosenPermutation = permutations[0];
        t1 = chosenPermutation!.t1;
        t2 = chosenPermutation!.t2;
    
        recordPartnership(t1[0], t1[1]);
        recordPartnership(t2[0], t2[1]);
        recordOpponent(t1[0], t2[0]);
        recordOpponent(t1[0], t2[1]);
        recordOpponent(t1[1], t2[0]);
        recordOpponent(t1[1], t2[1]);

        matchesInThisBatch.push({
            ...createMatch(t1, t2, type),
            sequence: currentMatchCount + 1,
            round: roundNumber,
            court: c + 1
        });
        
        currentMatchCount++;
    }

    if (matchesInThisBatch.length === 0) break; // Should not happen unless pool < 4

    // --- UPDATE STATS (Batch Level) ---
    statsMap.forEach(stat => {
        if (playersInThisBatch.has(stat.player.id)) {
            // Selected
            stat.played++;

            stat.consecutivePlays++;
            stat.consecutiveRests = 0;
            if (stat.forcedPlaysRemaining > 0) {
                stat.forcedPlaysRemaining--;
            }
        } else {
            // Resting
            stat.consecutivePlays = 0;
            stat.consecutiveRests++;
            if (stat.consecutiveRests === 2) {
                stat.consecutiveRestTwiceCount++;
                stat.forcedPlaysRemaining = 2; // 被連休二次的選手，下一場要讓他連續上場二次
            }
        }
    });

    // --- CAPTURE WAITING STATE (Batch Level) ---
    const waitingForThisBatch: WaitingPlayerInfo[] = [];
    statsMap.forEach(stat => {
        if (!playersInThisBatch.has(stat.player.id)) {
            waitingForThisBatch.push({
                player: stat.player,
                restCount: stat.consecutiveRests
            });
        }
    });
    waitingForThisBatch.sort((a, b) => b.restCount - a.restCount);

    // Assign waiting list to all matches in this batch
    matchesInThisBatch.forEach(m => {
        m.waiting = waitingForThisBatch;
        schedule.push(m);
    });
    
    roundNumber++;
  }

  return { schedule, error: null };
};