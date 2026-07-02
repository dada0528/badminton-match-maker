import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Player, Gender, Match, ScheduleItem, MatchType } from '../types';

interface HistoryPlayer {
  name: string;
  gender: Gender;
}

interface PaymentInfo {
  amount: string;
  account: string;
  qrCode: string | null;
}

interface AppState {
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
  enableScoring: boolean;
  autoVoiceEnabled: boolean;
  firstMatchPlayerIds: string[];
  fixedPairs: Array<[string, string]>;
  theme: 'light' | 'dark';
  
  // UI State
  errorMsg: string | null;

  // Payment State
  paymentInfo: PaymentInfo;
  paidPlayerIds: string[];

  // Actions
  setPlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void;
  addPlayer: (name: string, gender: Gender) => void;
  updatePlayerLevel: (id: string, level: number) => void;
  togglePlayerStatus: (id: string) => void;
  removePlayer: (id: string) => void;
  clearPlayers: () => void;
  
  addFixedPair: (p1Id: string, p2Id: string) => void;
  removeFixedPair: (p1Id: string, p2Id: string) => void;
  
  addToHistory: (name: string, gender: Gender) => void;
  removeFromHistory: (name: string) => void;
  
  setActiveMatches: (matches: (ScheduleItem | null)[]) => void;
  setFullSchedule: (schedule: ScheduleItem[]) => void;
  endMatch: (courtIndex: number, nextMatch: ScheduleItem | null) => void;
  updateMatchScore: (courtIndex: number, scoreA?: number, scoreB?: number) => void;
  clearMatchHistory: () => void;
  
  setRounds: (rounds: number) => void;
  setCourtCount: (count: number) => void;
  setCourtName: (index: number, name: string) => void;
  setScheduleType: (type: MatchType) => void;
  setMixPartners: (mix: boolean) => void;
  setAvoidGenderSkew: (avoid: boolean) => void;
  setEnableSkillLevel: (enable: boolean) => void;
  setEnableScoring: (enable: boolean) => void;
  setAutoVoiceEnabled: (enable: boolean) => void;
  setFirstMatchPlayerIds: (ids: string[]) => void;
  setTheme: (theme: 'light' | 'dark') => void;

  setErrorMsg: (msg: string | null) => void;

  setPaymentInfo: (info: PaymentInfo) => void;
  togglePlayerPaid: (playerId: string) => void;
  clearAllPayments: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
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
      enableScoring: false,
      autoVoiceEnabled: false,
      firstMatchPlayerIds: [],
      fixedPairs: [],
      theme: 'light',

      errorMsg: null,

      paymentInfo: { amount: '', account: '', qrCode: null },
      paidPlayerIds: [],

      // Actions
      setPlayers: (updater) => set((state) => {
        const newPlayers = typeof updater === 'function' ? updater(state.players) : updater;
        const newPlayerIds = new Set(newPlayers.map(p => p.id));
        return {
          players: newPlayers,
          firstMatchPlayerIds: state.firstMatchPlayerIds.filter(id => newPlayerIds.has(id)),
          fixedPairs: state.fixedPairs.filter(pair => newPlayerIds.has(pair[0]) && newPlayerIds.has(pair[1]))
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

        set({ players: [...players, newPlayer] });
        addToHistory(trimmedName, gender);
      },
      
      updatePlayerLevel: (id: string, level: number) => set((state) => ({
        players: state.players.map(p => p.id === id ? { ...p, level: Math.max(1, Math.min(9, level)) } : p)
      })),

      togglePlayerStatus: (id: string) => set((state) => ({
        players: state.players.map(p => {
          if (p.id === id) {
            const currentStatus = p.status || 'ACTIVE';
            const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
            return { 
              ...p, 
              status: newStatus,
              // When coming back from suspension, reset createdAt to now so they don't get forced to "catch up" 
              // for the matches they missed while suspended.
              ...(newStatus === 'ACTIVE' ? { createdAt: Date.now() } : {})
            };
          }
          return p;
        })
      })),
      
      removePlayer: (id: string) => set((state) => ({
        players: state.players.filter(p => p.id !== id),
        firstMatchPlayerIds: state.firstMatchPlayerIds.filter(pid => pid !== id),
        fixedPairs: state.fixedPairs.filter(pair => pair[0] !== id && pair[1] !== id)
      })),
      
      clearPlayers: () => set({ players: [], firstMatchPlayerIds: [], fixedPairs: [] }),
      
      addFixedPair: (p1Id: string, p2Id: string) => set((state) => {
        // Remove any existing pairs involving these players
        const filteredPairs = state.fixedPairs.filter(pair => 
          pair[0] !== p1Id && pair[1] !== p1Id && pair[0] !== p2Id && pair[1] !== p2Id
        );
        return { fixedPairs: [...filteredPairs, [p1Id, p2Id]] };
      }),
      
      removeFixedPair: (p1Id: string, p2Id: string) => set((state) => ({
        fixedPairs: state.fixedPairs.filter(pair => 
          !(pair[0] === p1Id && pair[1] === p2Id) && !(pair[0] === p2Id && pair[1] === p1Id)
        )
      })),
      
      addToHistory: (name: string, gender: Gender) => set((state) => {
        if (state.history.some(p => p.name === name)) return state;
        return { history: [...state.history, { name, gender }] };
      }),
      
      removeFromHistory: (name: string) => set((state) => ({
        history: state.history.filter(p => p.name !== name)
      })),
      
      setActiveMatches: (matches) => set({ activeMatches: matches, fullSchedule: [] }),
      
      setFullSchedule: (schedule) => set({ fullSchedule: schedule, activeMatches: [] }),
      
      endMatch: (courtIndex, nextMatch) => set((state) => {
        const currentMatch = state.activeMatches[courtIndex];
        const newActiveMatches = [...state.activeMatches];
        newActiveMatches[courtIndex] = nextMatch;
        
        return {
          activeMatches: newActiveMatches,
          matchHistory: currentMatch ? [...state.matchHistory, currentMatch] : state.matchHistory
        };
      }),
      
      updateMatchScore: (courtIndex: number, scoreA?: number, scoreB?: number) => set((state) => {
        const newActiveMatches = [...state.activeMatches];
        const match = newActiveMatches[courtIndex];
        if (match) {
          newActiveMatches[courtIndex] = { ...match, scoreA, scoreB };
        }
        return { activeMatches: newActiveMatches };
      }),

      clearMatchHistory: () => set({ matchHistory: [], activeMatches: [], fullSchedule: [] }),
      
      setRounds: (rounds) => set({ rounds }),
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

        return { courtCount: num, activeMatches: newActiveMatches, courtNames: newCourtNames };
      }),
      setCourtName: (index, name) => set((state) => {
        const newCourtNames = [...state.courtNames];
        newCourtNames[index] = name;
        return { courtNames: newCourtNames };
      }),
      setScheduleType: (scheduleType) => set({ scheduleType }),
      setMixPartners: (mixPartners) => set({ mixPartners }),
      setAvoidGenderSkew: (avoidGenderSkew) => set({ avoidGenderSkew }),
      setEnableSkillLevel: (enableSkillLevel) => set({ enableSkillLevel }),
      setEnableScoring: (enableScoring) => set({ enableScoring }),
      setAutoVoiceEnabled: (autoVoiceEnabled) => set({ autoVoiceEnabled }),
      setFirstMatchPlayerIds: (firstMatchPlayerIds) => set({ firstMatchPlayerIds }),
      setTheme: (theme) => {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        set({ theme });
      },

      setErrorMsg: (errorMsg) => set({ errorMsg }),

      setPaymentInfo: (paymentInfo) => set({ paymentInfo }),
      togglePlayerPaid: (playerId) => set((state) => ({
        paidPlayerIds: state.paidPlayerIds.includes(playerId)
          ? state.paidPlayerIds.filter(id => id !== playerId)
          : [...state.paidPlayerIds, playerId]
      })),
      clearAllPayments: () => set({ paidPlayerIds: [] }),
    }),
    {
      name: 'badminton-app-storage',
      // Only persist these fields
      partialize: (state) => ({
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
        enableScoring: state.enableScoring,
        autoVoiceEnabled: state.autoVoiceEnabled,
        fixedPairs: state.fixedPairs,
        theme: state.theme,
        paymentInfo: state.paymentInfo,
        paidPlayerIds: state.paidPlayerIds,
      }),
    }
  )
);
