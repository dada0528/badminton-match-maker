import React from 'react';
import { User, Users, Zap, Trophy } from 'lucide-react';

export const COLORS = {
  male: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  female: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  maleIcon: '#3b82f6',
  femaleIcon: '#ec4899',
  primary: 'bg-emerald-400 hover:bg-emerald-500',
  secondary: 'bg-amber-300 hover:bg-amber-400',
  accent: 'bg-purple-400 hover:bg-purple-500',
};

export const ICONS = {
  User: <User size={20} />,
  Users: <Users size={20} />,
  Zap: <Zap size={20} />,
  Trophy: <Trophy size={20} />
};

// Empty initial players as requested
export const INITIAL_PLAYERS = [];