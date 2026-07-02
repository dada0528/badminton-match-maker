import React from 'react';
import { Player, Gender } from '../types';
import { COLORS } from '../constants';
import { X, User, Plus, Minus, Pause, Play } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  onDelete?: (id: string) => void;
  size?: 'sm' | 'md' | 'lg';
  autoWidth?: boolean; // New prop to allow full width for long names
  className?: string;  // Allow custom classes
  showLevelAdjust?: boolean;
  onLevelChange?: (id: string, level: number) => void;
  onStatusToggle?: (id: string) => void;
  onClick?: (player: Player) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ 
  player, 
  onDelete, 
  size = 'md', 
  autoWidth = false, 
  className = '',
  showLevelAdjust = false,
  onLevelChange,
  onStatusToggle,
  onClick
}) => {
  const isMale = player.gender === Gender.MALE;
  const isSuspended = player.status === 'SUSPENDED';
  const colorClass = isSuspended 
    ? 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400' 
    : isMale ? COLORS.male : COLORS.female;
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const handleLevelChange = (delta: number) => {
    if (onLevelChange) {
      const currentLevel = player.level || 3;
      onLevelChange(player.id, currentLevel + delta);
    }
  };

  return (
    <div 
      onClick={onClick ? () => onClick(player) : undefined}
      className={`
      relative group flex items-center gap-2 rounded-full border-2 
      ${colorClass} ${sizeClasses[size]} 
      shadow-sm transition-all duration-300 hover:shadow-md select-none
      ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:ring-2 hover:ring-emerald-400/50' : 'cursor-default'}
      ${autoWidth ? 'w-auto max-w-none' : ''}
      ${className}
    `}>
      <div className={`
        rounded-full p-1 shrink-0 flex items-center justify-center
        ${isSuspended ? 'bg-slate-200 dark:bg-slate-700' : isMale ? 'bg-blue-200 dark:bg-blue-800' : 'bg-pink-200 dark:bg-pink-800'}
      `}>
        {isSuspended ? (
          <Pause size={size === 'sm' ? 12 : 16} className="text-slate-500 dark:text-slate-400" />
        ) : (
          <User size={size === 'sm' ? 12 : 16} className={isMale ? 'text-blue-600 dark:text-blue-300' : 'text-pink-600 dark:text-pink-300'} />
        )}
      </div>
      <span className={`font-bold tracking-wide ${autoWidth ? '' : 'truncate max-w-[100px]'} ${isSuspended ? 'line-through opacity-70' : ''}`}>
        {player.name}
      </span>
      
      {showLevelAdjust && (
        <div className="flex items-center ml-1 bg-white/80 dark:bg-slate-800/80 rounded-full shadow-inner border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <button 
            onClick={() => handleLevelChange(-1)}
            disabled={(player.level || 3) <= 1}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent active:bg-slate-200 dark:active:bg-slate-600 transition-colors"
          >
            <Minus size={16} strokeWidth={3} />
          </button>
          <span className="font-black text-slate-700 dark:text-slate-200 min-w-[1.5ch] text-center text-sm">
            {player.level || 3}
          </span>
          <button 
            onClick={() => handleLevelChange(1)}
            disabled={(player.level || 3) >= 9}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent active:bg-slate-200 dark:active:bg-slate-600 transition-colors"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>
      )}

      {onStatusToggle && (
        <button 
          onClick={(e) => { e.stopPropagation(); onStatusToggle(player.id); }}
          title={isSuspended ? '取消臨下場 (恢復輪替)' : '臨下場 (暫停輪替)'}
          className={`ml-1 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors active:scale-90 shrink-0 ${isSuspended ? 'text-emerald-500 hover:text-emerald-600' : 'text-amber-500 hover:text-amber-600'}`}
        >
          {isSuspended ? <Play size={16} strokeWidth={3} /> : <Pause size={16} strokeWidth={3} />}
        </button>
      )}

      {onDelete && (
        <button 
          onClick={() => onDelete(player.id)}
          className="ml-1 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors active:scale-90 shrink-0"
        >
          <X size={16} strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

export default PlayerCard;