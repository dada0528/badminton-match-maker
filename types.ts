export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}

export type PlayerStatus = 'ACTIVE' | 'SUSPENDED';

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  level?: number;
  createdAt?: number;
  status?: PlayerStatus;
}

export interface Team {
  player1: Player;
  player2: Player;
}

export interface Match {
  id: string;
  teamA: Team;
  teamB: Team;
  type: MatchType;
  timestamp: number;
  scoreA?: number;
  scoreB?: number;
}

export interface WaitingPlayerInfo {
  player: Player;
  restCount: number;
}

export interface ScheduleItem extends Match {
  sequence: number;
  round?: number;
  court?: number;
  message?: string; // For explaining forced moves (e.g. "Continuous Play Bonus")
  waiting?: WaitingPlayerInfo[]; // Players resting during this match
}

export enum MatchType {
  RANDOM = '一般隨機',
  MENS_DOUBLES = '男雙',
  WOMENS_DOUBLES = '女雙',
  MIXED_DOUBLES = '混雙'
}