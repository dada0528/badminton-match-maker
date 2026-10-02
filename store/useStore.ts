import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Player, Gender, Match, ScheduleItem, MatchType, SkillMode, Club, HistoryPlayer } from '../types';

interface PaymentInfo {
  amount: string;
  account: string;
  qrCode: string | null;
}

interface AppState {
  // Club Management
  clubs: Club[];
  currentClubId: string;

  // Data
  players: Player[];
  history: HistoryPlayer[];
  activeMatches: (ScheduleItem | null)[]; // One per court
  matchHistory: ScheduleItem[];
  fullSchedule: ScheduleItem[]; // Statically generated full schedule for 1 court
  
  // Settings
  rounds: number;
  courtCount: number;
  courtNames: string[];
  scheduleType: MatchType;
  mixPartners: boolean;
  avoidGenderSkew: boolean;
  enableSkillLevel: boolean;
  skillMode: SkillMode;
  autoVoiceEnabled: boolean;
  firstMatchPlayerIds: string[];
  fixedPairs: Array<[string, string]>;
  theme: 'light' | 'dark';
  
  // UI State
  errorMsg: string | null;
  isFullscreen: boolean;
  setIsFullscreen: (isFullscreen: boolean) => void;

  // Payment State
  paymentInfo: PaymentInfo;
  paidPlayerIds: string[];

  // Club Actions
  addClub: (name: string, copyFromClubId?: string) => void;
  renameClub: (id: string, name: string) => void;
  deleteClub: (id: string) => void;
  switchClub: (id: string) => void;

  // Actions
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  addPlayer: (name: string, gender: Gender) => void;
  updatePlayer: (id: string, name: string, gender: Gender) => boolean;
  updatePlayerLevel: (id: string, level: number) => void;
  togglePlayerStatus: (id: string) => void;
  removePlayer: (id: string) => void;
  clearPlayers: () => void;
  
  addFixedPair: (p1Id: string, p2Id: string) => void;
  removeFixedPair: (p1Id: string, p2Id: string) => void;
  
  addToHistory: (name: string, gender: Gender) => void;
  updateHistoryPlayer: (oldName: string, newName: string, newGender: Gender) => boolean;
  removeFromHistory: (name: string) => void;
  clearHistory: () => void;
  
  setActiveMatches: (matches: (ScheduleItem | null)[]) => void;
  setFullSchedule: (schedule: ScheduleItem[]) => void;
  endMatch: (courtIndex: number, nextMatch: ScheduleItem | null) => void;
  undoMatch: (courtIndex: number) => void;
  clearMatchHistory: () => void;
  
  setRounds: (rounds: number) => void;
  setCourtCount: (count: number) => void;
  setCourtName: (index: number, name: string) => void;
  setScheduleType: (type: MatchType) => void;
  setMixPartners: (mix: boolean) => void;
  setAvoidGenderSkew: (avoid: boolean) => void;
  setEnableSkillLevel: (enable: boolean) => void;
  setSkillMode: (mode: SkillMode) => void;
  setAutoVoiceEnabled: (enable: boolean) => void;
  setFirstMatchPlayerIds: (ids: string[]) => void;
  setTheme: (theme: 'light' | 'dark') => void;

  setErrorMsg: (msg: string | null) => void;

  setPaymentInfo: (info: PaymentInfo) => void;
  togglePlayerPaid: (playerId: string) => void;
  clearAllPayments: () => void;
}

const defaultInitialClub: Club = {
  id: 'default',
  name: '預設球團',
  history: [],
  players: [],
  activeMatches: [],
  matchHistory: [],
  fullSchedule: [],
  courtCount: 1,
  courtNames: ['1'],
  rounds: 2,
  paidPlayerIds: [],
  fixedPairs: [],
  firstMatchPlayerIds: [],
  createdAt: Date.now(),
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Club State
      clubs: [defaultInitialClub],
      currentClubId: 'default',

      // Initial State
      players: [],
      history: [],
      activeMatches: [],
      matchHistory: [],
      fullSchedule: [],
      
      rounds: 2,
      courtCount: 1,
      courtNames: ['1'],
      scheduleType: MatchType.RANDOM,
      mixPartners: true,
      avoidGenderSkew: true,
      enableSkillLevel: false,
      skillMode: 'BALANCED',
      autoVoiceEnabled: false,
      firstMatchPlayerIds: [],
      fixedPairs: [],
      theme: 'light',

      errorMsg: null,

      paymentInfo: { amount: '', account: '', qrCode: null },
      paidPlayerIds: [],

      // Club Actions
      addClub: (name: string, copyFromClubId?: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        set((state) => {
          // Snapshot current club state before creating new one
          const updatedClubs = state.clubs.map((c) => {
            if (c.id === state.currentClubId) {
              return {
                ...c,
                history: state.history,
                players: state.players,
                activeMatches: state.activeMatches,
                matchHistory: state.matchHistory,
                fullSchedule: state.fullSchedule,
                courtCount: state.courtCount,
                courtNames: state.courtNames,
                rounds: state.rounds,
                paidPlayerIds: state.paidPlayerIds,
                fixedPairs: state.fixedPairs,
                firstMatchPlayerIds: state.firstMatchPlayerIds,
              };
            }
            return c;
          });

          let initialHistory: HistoryPlayer[] = [];
          if (copyFromClubId) {
            const source = updatedClubs.find((c) => c.id === copyFromClubId);
            if (source?.history) {
              initialHistory = [...source.history];
            }
          }

          const newClubId = 'club_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          const newClub: Club = {
            id: newClubId,
            name: trimmedName,
            history: initialHistory,
            players: [],
            activeMatches: [],
            matchHistory: [],
            fullSchedule: [],
            courtCount: state.courtCount,
            courtNames: state.courtNames,
            rounds: state.rounds,
            paidPlayerIds: [],
            fixedPairs: [],
            firstMatchPlayerIds: [],
            createdAt: Date.now(),
          };

          return {
            clubs: [...updatedClubs, newClub],
            currentClubId: newClubId,
            history: initialHistory,
            players: [],
            activeMatches: [],
            matchHistory: [],
            fullSchedule: [],
            paidPlayerIds: [],
            fixedPairs: [],
            firstMatchPlayerIds: [],
          };
        });
      },

      renameClub: (id: string, name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        set((state) => ({
          clubs: state.clubs.map((c) => (c.id === id ? { ...c, name: trimmedName } : c)),
        }));
      },

      deleteClub: (id: string) => {
        const { clubs, currentClubId, setErrorMsg } = get();
        if (clubs.length <= 1) {
          setErrorMsg('至少需要保留一個球團！');
          setTimeout(() => get().setErrorMsg(null), 2000);
          return;
        }

        set((state) => {
          const remainingClubs = state.clubs.filter((c) => c.id !== id);
          if (state.currentClubId === id) {
            const nextClub = remainingClubs[0];
            return {
              clubs: remainingClubs,
              currentClubId: nextClub.id,
              history: nextClub.history || [],
              players: nextClub.players || [],
              activeMatches: nextClub.activeMatches || [],
              matchHistory: nextClub.matchHistory || [],
              fullSchedule: nextClub.fullSchedule || [],
              courtCount: nextClub.courtCount ?? state.courtCount,
              courtNames: nextClub.courtNames ?? state.courtNames,
              rounds: nextClub.rounds ?? state.rounds,
              paidPlayerIds: nextClub.paidPlayerIds || [],
              fixedPairs: nextClub.fixedPairs || [],
              firstMatchPlayerIds: nextClub.firstMatchPlayerIds || [],
            };
          }
          return { clubs: remainingClubs };
        });
      },

      switchClub: (clubId: string) => {
        set((state) => {
          if (clubId === state.currentClubId) return state;
          const targetClub = state.clubs.find((c) => c.id === clubId);
          if (!targetClub) return state;

          // Snapshot current club data
          const updatedClubs = state.clubs.map((c) => {
            if (c.id === state.currentClubId) {
              return {
                ...c,
                history: state.history,
                players: state.players,
                activeMatches: state.activeMatches,
                matchHistory: state.matchHistory,
                fullSchedule: state.fullSchedule,
                courtCount: state.courtCount,
                courtNames: state.courtNames,
                rounds: state.rounds,
                paidPlayerIds: state.paidPlayerIds,
                fixedPairs: state.fixedPairs,
                firstMatchPlayerIds: state.firstMatchPlayerIds,
              };
            }
            return c;
          });

          // Load target club data
          const next = updatedClubs.find((c) => c.id === clubId)!;
          return {
            clubs: updatedClubs,
            currentClubId: clubId,
            history: next.history || [],
            players: next.players || [],
            activeMatches: next.activeMatches || [],
            matchHistory: next.matchHistory || [],
            fullSchedule: next.fullSchedule || [],
            courtCount: next.courtCount ?? state.courtCount,
            courtNames: next.courtNames ?? state.courtNames,
            rounds: next.rounds ?? state.rounds,
            paidPlayerIds: next.paidPlayerIds || [],
            fixedPairs: next.fixedPairs || [],
            firstMatchPlayerIds: next.firstMatchPlayerIds || [],
          };
        });
      },

      // Actions
      setPlayers: (updater) => set((state) => {
        const newPlayers = typeof updater === 'function' ? updater(state.players) : updater;
        const newPlayerIds = new Set(newPlayers.map(p => p.id));
        const newFirstMatch = state.firstMatchPlayerIds.filter(id => newPlayerIds.has(id));
        const newFixedPairs = state.fixedPairs.filter(pair => newPlayerIds.has(pair[0]) && newPlayerIds.has(pair[1]));
        return {
          players: newPlayers,
          firstMatchPlayerIds: newFirstMatch,
          fixedPairs: newFixedPairs,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, players: newPlayers, firstMatchPlayerIds: newFirstMatch, fixedPairs: newFixedPairs } : c)
        };
      }),
      
      addPlayer: (name: string, gender: Gender) => {
        const { players, addToHistory, setErrorMsg } = get();
        const trimmedName = name.trim();
        
        if (!trimmedName) return;
        
        if (players.some(p => p.name === trimmedName)) {
          setErrorMsg(`${trimmedName} 已經在名單中囉！`);
          setTimeout(() => get().setErrorMsg(null), 2000);
          return;
        }

        const newPlayer: Player = {
          id: Date.now().toString() + Math.random().toString().substr(2, 5),
          name: trimmedName,
          gender,
          level: 3,
          createdAt: Date.now(),
          status: 'ACTIVE',
        };

        const newPlayers = [...players, newPlayer];
        set((state) => ({
          players: newPlayers,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, players: newPlayers } : c)
        }));
        addToHistory(trimmedName, gender);
      },
      
      updatePlayer: (id: string, name: string, gender: Gender) => {
        const { players, history, clubs, currentClubId, setErrorMsg } = get();
        const trimmedName = name.trim();
        if (!trimmedName) {
          setErrorMsg('選手姓名不可為空白！');
          setTimeout(() => get().setErrorMsg(null), 2500);
          return false;
        }

        const existingPlayer = players.find(p => p.id === id);
        if (!existingPlayer) return false;

        const isDuplicate = players.some(p => p.id !== id && p.name.trim().toLowerCase() === trimmedName.toLowerCase());
        if (isDuplicate) {
          setErrorMsg(`「${trimmedName}」已經存在於球員名單中！`);
          setTimeout(() => get().setErrorMsg(null), 2500);
          return false;
        }

        const oldName = existingPlayer.name;

        // 1. Update players array
        const updatedPlayers = players.map(p => 
          p.id === id ? { ...p, name: trimmedName, gender } : p
        );

        // 2. Update history
        let updatedHistory = [...history];
        const oldHistoryIndex = updatedHistory.findIndex(h => h.name === oldName);
        if (oldHistoryIndex !== -1) {
          updatedHistory = updatedHistory.filter((h, idx) => idx === oldHistoryIndex || h.name !== trimmedName);
          updatedHistory[oldHistoryIndex] = { name: trimmedName, gender };
        } else {
          const existingNewIndex = updatedHistory.findIndex(h => h.name === trimmedName);
          if (existingNewIndex !== -1) {
            updatedHistory[existingNewIndex] = { name: trimmedName, gender };
          } else {
            updatedHistory.push({ name: trimmedName, gender });
          }
        }

        // 3. Update activeMatches, matchHistory, fullSchedule
        const updatePlayerObj = <T extends Player>(p: T): T => {
          return p.id === id ? { ...p, name: trimmedName, gender } : p;
        };
        const updateTeam = (team: { player1: Player; player2: Player }) => ({
          player1: updatePlayerObj(team.player1),
          player2: updatePlayerObj(team.player2),
        });
        const updateScheduleItem = (item: ScheduleItem | null): ScheduleItem | null => {
          if (!item) return null;
          return {
            ...item,
            teamA: updateTeam(item.teamA),
            teamB: updateTeam(item.teamB),
            waiting: item.waiting?.map((w) => ({ ...w, player: updatePlayerObj(w.player) })),
          };
        };

        const updatedActiveMatches = get().activeMatches.map(updateScheduleItem);
        const updatedMatchHistory = get().matchHistory.map((m) => updateScheduleItem(m) as ScheduleItem);
        const updatedFullSchedule = get().fullSchedule.map((m) => updateScheduleItem(m) as ScheduleItem);

        // 4. Update current club in clubs
        const updatedClubs = clubs.map(c => {
          if (c.id === currentClubId) {
            return {
              ...c,
              players: updatedPlayers,
              history: updatedHistory,
              activeMatches: updatedActiveMatches,
              matchHistory: updatedMatchHistory,
              fullSchedule: updatedFullSchedule,
            };
          }
          return c;
        });

        set({
          players: updatedPlayers,
          history: updatedHistory,
          activeMatches: updatedActiveMatches,
          matchHistory: updatedMatchHistory,
          fullSchedule: updatedFullSchedule,
          clubs: updatedClubs,
        });

        return true;
      },
      
      updatePlayerLevel: (id: string, level: number) => set((state) => {
        const newLevel = Math.max(1, Math.min(9, level));
        const updatePlayerObj = <T extends Player>(p: T): T => {
          return p.id === id ? { ...p, level: newLevel } : p;
        };
        const updateTeam = (team: { player1: Player; player2: Player }) => ({
          player1: updatePlayerObj(team.player1),
          player2: updatePlayerObj(team.player2),
        });
        const updateScheduleItem = (item: ScheduleItem | null): ScheduleItem | null => {
          if (!item) return null;
          return {
            ...item,
            teamA: updateTeam(item.teamA),
            teamB: updateTeam(item.teamB),
            waiting: item.waiting?.map((w) => ({ ...w, player: updatePlayerObj(w.player) })),
          };
        };

        const newPlayers = state.players.map((p) => (p.id === id ? { ...p, level: newLevel } : p));
        const newActiveMatches = state.activeMatches.map(updateScheduleItem);
        const newFullSchedule = state.fullSchedule.map((m) => updateScheduleItem(m) as ScheduleItem);

        return {
          players: newPlayers,
          activeMatches: newActiveMatches,
          fullSchedule: newFullSchedule,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, players: newPlayers, activeMatches: newActiveMatches, fullSchedule: newFullSchedule } : c)
        };
      }),

      togglePlayerStatus: (id: string) => set((state) => {
        const pToToggle = state.players.find(p => p.id === id);
        const currentStatus = pToToggle?.status || 'ACTIVE';
        const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        
        if (newStatus === 'ACTIVE') {
          let totalPlays = 0;
          let activeCount = 0;
          
          const allMatches = [...state.matchHistory, ...state.activeMatches.filter((m): m is ScheduleItem => m !== null)];
          
          state.players.forEach(p => {
             if (p.id !== id && p.status !== 'SUSPENDED') {
                 const plays = allMatches.filter(m => 
                     m.teamA.player1.id === p.id || m.teamA.player2.id === p.id ||
                     m.teamB.player1.id === p.id || m.teamB.player2.id === p.id
                 ).length;
                 totalPlays += plays;
                 activeCount++;
             }
          });
          
          const avgPlays = activeCount > 0 ? totalPlays / activeCount : 0;
          
          const myPlays = allMatches.filter(m => 
              m.teamA.player1.id === id || m.teamA.player2.id === id ||
              m.teamB.player1.id === id || m.teamB.player2.id === id
          ).length;
          
          const offset = Math.max(0, Math.floor(avgPlays) - myPlays);
          
          const updatedPlayers = state.players.map(p => {
            if (p.id === id) {
              return { ...p, status: newStatus, missedPlaysOffset: offset };
            }
            return p;
          });

          return {
             players: updatedPlayers,
             clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, players: updatedPlayers } : c)
          };
        } else {
          const updatedPlayers = state.players.map(p => {
            if (p.id === id) {
              return { ...p, status: newStatus };
            }
            return p;
          });

          return {
             players: updatedPlayers,
             clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, players: updatedPlayers } : c)
          };
        }
      }),
      
      removePlayer: (id: string) => set((state) => {
        const newPlayers = state.players.filter(p => p.id !== id);
        const newFirstMatch = state.firstMatchPlayerIds.filter(pid => pid !== id);
        const newFixedPairs = state.fixedPairs.filter(pair => pair[0] !== id && pair[1] !== id);
        return {
          players: newPlayers,
          firstMatchPlayerIds: newFirstMatch,
          fixedPairs: newFixedPairs,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, players: newPlayers, firstMatchPlayerIds: newFirstMatch, fixedPairs: newFixedPairs } : c)
        };
      }),
      
      clearPlayers: () => set((state) => ({
        players: [],
        firstMatchPlayerIds: [],
        fixedPairs: [],
        clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, players: [], firstMatchPlayerIds: [], fixedPairs: [] } : c)
      })),
      
      addFixedPair: (p1Id: string, p2Id: string) => set((state) => {
        const filteredPairs = state.fixedPairs.filter(pair => 
          pair[0] !== p1Id && pair[1] !== p1Id && pair[0] !== p2Id && pair[1] !== p2Id
        );
        const newFixedPairs = [...filteredPairs, [p1Id, p2Id]];
        return {
          fixedPairs: newFixedPairs,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, fixedPairs: newFixedPairs } : c)
        };
      }),
      
      removeFixedPair: (p1Id: string, p2Id: string) => set((state) => {
        const newFixedPairs = state.fixedPairs.filter(pair => 
          !(pair[0] === p1Id && pair[1] === p2Id) && !(pair[0] === p2Id && pair[1] === p1Id)
        );
        return {
          fixedPairs: newFixedPairs,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, fixedPairs: newFixedPairs } : c)
        };
      }),
      
      addToHistory: (name: string, gender: Gender) => set((state) => {
        if (state.history.some(p => p.name === name)) return state;
        const newHistory = [...state.history, { name, gender }];
        return {
          history: newHistory,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, history: newHistory } : c)
        };
      }),

      updateHistoryPlayer: (oldName: string, newName: string, newGender: Gender) => {
        const { history, players, clubs, currentClubId, setErrorMsg } = get();
        const trimmedName = newName.trim();
        if (!trimmedName) {
          setErrorMsg('選手姓名不可為空白！');
          setTimeout(() => get().setErrorMsg(null), 2500);
          return false;
        }

        if (oldName !== trimmedName && history.some(h => h.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
          setErrorMsg(`歷史名單中已存在「${trimmedName}」！`);
          setTimeout(() => get().setErrorMsg(null), 2500);
          return false;
        }

        const updatedHistory = history.map(h => 
          h.name === oldName ? { name: trimmedName, gender: newGender } : h
        );

        // Also if player is currently in active players list, update them as well!
        const targetPlayer = players.find(p => p.name === oldName);
        let updatedPlayers = players;
        let updatedActiveMatches = get().activeMatches;
        let updatedMatchHistory = get().matchHistory;
        let updatedFullSchedule = get().fullSchedule;

        if (targetPlayer) {
          const playerId = targetPlayer.id;
          updatedPlayers = players.map(p => 
            p.id === playerId ? { ...p, name: trimmedName, gender: newGender } : p
          );
          const updatePlayerObj = <T extends Player>(p: T): T => {
            return p.id === playerId ? { ...p, name: trimmedName, gender: newGender } : p;
          };
          const updateTeam = (team: { player1: Player; player2: Player }) => ({
            player1: updatePlayerObj(team.player1),
            player2: updatePlayerObj(team.player2),
          });
          const updateScheduleItem = (item: ScheduleItem | null): ScheduleItem | null => {
            if (!item) return null;
            return {
              ...item,
              teamA: updateTeam(item.teamA),
              teamB: updateTeam(item.teamB),
              waiting: item.waiting?.map((w) => ({ ...w, player: updatePlayerObj(w.player) })),
            };
          };
          updatedActiveMatches = get().activeMatches.map(updateScheduleItem);
          updatedMatchHistory = get().matchHistory.map((m) => updateScheduleItem(m) as ScheduleItem);
          updatedFullSchedule = get().fullSchedule.map((m) => updateScheduleItem(m) as ScheduleItem);
        }

        const updatedClubs = clubs.map(c => {
          if (c.id === currentClubId) {
            return {
              ...c,
              history: updatedHistory,
              players: updatedPlayers,
              activeMatches: updatedActiveMatches,
              matchHistory: updatedMatchHistory,
              fullSchedule: updatedFullSchedule,
            };
          }
          return c;
        });

        set({
          history: updatedHistory,
          players: updatedPlayers,
          activeMatches: updatedActiveMatches,
          matchHistory: updatedMatchHistory,
          fullSchedule: updatedFullSchedule,
          clubs: updatedClubs,
        });

        return true;
      },
      
      removeFromHistory: (name: string) => set((state) => {
        const newHistory = state.history.filter(p => p.name !== name);
        return {
          history: newHistory,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, history: newHistory } : c)
        };
      }),
      
      clearHistory: () => set((state) => ({
        history: [],
        clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, history: [] } : c)
      })),
      
      setActiveMatches: (matches) => set((state) => ({
        activeMatches: matches,
        fullSchedule: [],
        clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, activeMatches: matches, fullSchedule: [] } : c)
      })),
      
      setFullSchedule: (schedule) => set((state) => ({
        fullSchedule: schedule,
        activeMatches: [],
        clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, fullSchedule: schedule, activeMatches: [] } : c)
      })),
      
      endMatch: (courtIndex, nextMatch) => set((state) => {
        const currentMatch = state.activeMatches[courtIndex];
        const newActiveMatches = [...state.activeMatches];
        newActiveMatches[courtIndex] = nextMatch;
        const newMatchHistory = currentMatch ? [...state.matchHistory, currentMatch] : state.matchHistory;
        
        return {
          activeMatches: newActiveMatches,
          matchHistory: newMatchHistory,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, activeMatches: newActiveMatches, matchHistory: newMatchHistory } : c)
        };
      }),

      undoMatch: (courtIndex: number) => set((state) => {
        const history = [...state.matchHistory];
        let lastMatchIndex = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].court === courtIndex + 1) {
            lastMatchIndex = i;
            break;
          }
        }

        if (lastMatchIndex === -1) return state;

        const lastMatch = history[lastMatchIndex];
        history.splice(lastMatchIndex, 1);

        const newActiveMatches = [...state.activeMatches];
        newActiveMatches[courtIndex] = lastMatch;

        return {
          matchHistory: history,
          activeMatches: newActiveMatches,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, activeMatches: newActiveMatches, matchHistory: history } : c)
        };
      }),

      clearMatchHistory: () => set((state) => ({
        matchHistory: [],
        activeMatches: [],
        fullSchedule: [],
        clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, matchHistory: [], activeMatches: [], fullSchedule: [] } : c)
      })),
      
      setRounds: (rounds) => set((state) => ({
        rounds,
        clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, rounds } : c)
      })),
      setCourtCount: (num) => set((state) => {
        // Adjust activeMatches array length
        let newActiveMatches = [...state.activeMatches];
        if (num > newActiveMatches.length) {
          newActiveMatches = [...newActiveMatches, ...Array(num - newActiveMatches.length).fill(null)];
        } else if (num < newActiveMatches.length) {
          newActiveMatches = newActiveMatches.slice(0, num);
        }

        // Adjust courtNames array length
        let newCourtNames = [...state.courtNames];
        if (num > newCourtNames.length) {
          for (let i = newCourtNames.length; i < num; i++) {
            newCourtNames.push((i + 1).toString());
          }
        } else if (num < newCourtNames.length) {
          newCourtNames = newCourtNames.slice(0, num);
        }

        return {
          courtCount: num,
          activeMatches: newActiveMatches,
          courtNames: newCourtNames,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, courtCount: num, activeMatches: newActiveMatches, courtNames: newCourtNames } : c)
        };
      }),
      setCourtName: (index, name) => set((state) => {
        const newCourtNames = [...state.courtNames];
        newCourtNames[index] = name;
        return {
          courtNames: newCourtNames,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, courtNames: newCourtNames } : c)
        };
      }),
      setScheduleType: (scheduleType) => set({ scheduleType }),
      setMixPartners: (mixPartners) => set({ mixPartners }),
      setAvoidGenderSkew: (avoidGenderSkew) => set({ avoidGenderSkew }),
      setEnableSkillLevel: (enableSkillLevel) => set({ enableSkillLevel }),
      setSkillMode: (skillMode) => set({ skillMode }),
      setAutoVoiceEnabled: (autoVoiceEnabled) => set({ autoVoiceEnabled }),
      setFirstMatchPlayerIds: (firstMatchPlayerIds) => set((state) => ({
        firstMatchPlayerIds,
        clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, firstMatchPlayerIds } : c)
      })),
      setTheme: (theme) => {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        set({ theme });
      },

      setErrorMsg: (errorMsg) => set({ errorMsg }),
      isFullscreen: false,
      setIsFullscreen: (isFullscreen) => set({ isFullscreen }),

      setPaymentInfo: (paymentInfo) => set({ paymentInfo }),
      togglePlayerPaid: (playerId) => set((state) => {
        const newPaidPlayerIds = state.paidPlayerIds.includes(playerId)
          ? state.paidPlayerIds.filter(id => id !== playerId)
          : [...state.paidPlayerIds, playerId];
        return {
          paidPlayerIds: newPaidPlayerIds,
          clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, paidPlayerIds: newPaidPlayerIds } : c)
        };
      }),
      clearAllPayments: () => set((state) => ({
        paidPlayerIds: [],
        clubs: state.clubs.map(c => c.id === state.currentClubId ? { ...c, paidPlayerIds: [] } : c)
      })),
    }),
    {
      name: 'badminton-app-storage',
      partialize: (state) => ({
        clubs: state.clubs,
        currentClubId: state.currentClubId,
        players: state.players,
        history: state.history,
        activeMatches: state.activeMatches,
        matchHistory: state.matchHistory,
        fullSchedule: state.fullSchedule,
        rounds: state.rounds,
        courtCount: state.courtCount,
        courtNames: state.courtNames,
        scheduleType: state.scheduleType,
        mixPartners: state.mixPartners,
        avoidGenderSkew: state.avoidGenderSkew,
        enableSkillLevel: state.enableSkillLevel,
        skillMode: state.skillMode,
        autoVoiceEnabled: state.autoVoiceEnabled,
        fixedPairs: state.fixedPairs,
        theme: state.theme,
        paymentInfo: state.paymentInfo,
        paidPlayerIds: state.paidPlayerIds,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.clubs || state.clubs.length === 0) {
          const defaultClub: Club = {
            id: 'default',
            name: '預設球團',
            history: state.history || [],
            players: state.players || [],
            activeMatches: state.activeMatches || [],
            matchHistory: state.matchHistory || [],
            fullSchedule: state.fullSchedule || [],
            courtCount: state.courtCount || 1,
            courtNames: state.courtNames || ['1'],
            rounds: state.rounds || 2,
            paidPlayerIds: state.paidPlayerIds || [],
            fixedPairs: state.fixedPairs || [],
            firstMatchPlayerIds: state.firstMatchPlayerIds || [],
            createdAt: Date.now(),
          };
          state.clubs = [defaultClub];
          state.currentClubId = 'default';
        } else {
          if (!state.currentClubId || !state.clubs.some((c) => c.id === state.currentClubId)) {
            state.currentClubId = state.clubs[0].id;
          }
          const curr = state.clubs.find((c) => c.id === state.currentClubId);
          if (curr) {
            state.history = curr.history || [];
            state.players = curr.players || [];
            state.activeMatches = curr.activeMatches || [];
            state.matchHistory = curr.matchHistory || [];
            state.fullSchedule = curr.fullSchedule || [];
            if (curr.courtCount) state.courtCount = curr.courtCount;
            if (curr.courtNames) state.courtNames = curr.courtNames;
            if (curr.rounds) state.rounds = curr.rounds;
            if (curr.paidPlayerIds) state.paidPlayerIds = curr.paidPlayerIds;
            if (curr.fixedPairs) state.fixedPairs = curr.fixedPairs;
            if (curr.firstMatchPlayerIds) state.firstMatchPlayerIds = curr.firstMatchPlayerIds;
          }
        }
      },
    }
  )
);
