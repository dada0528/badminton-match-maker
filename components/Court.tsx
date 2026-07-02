import React from 'react';
import { Match, MatchType } from '../types';
import PlayerCard from './PlayerCard';
import { Zap } from 'lucide-react';

interface CourtProps {
  currentMatch: Match | null;
}

const Court: React.FC<CourtProps> = ({ currentMatch }) => {
  if (!currentMatch) {
    return (
      <div className="w-full aspect-[16/9] bg-emerald-500 rounded-3xl border-4 border-emerald-600 shadow-[inset_0_4px_10px_rgba(0,0,0,0.1)] flex flex-col items-center justify-center p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 10%)', backgroundSize: '20px 20px' }}></div>
        <div className="z-10 bg-white/20 backdrop-blur-sm p-6 rounded-2xl border-2 border-white/30 text-center animate-bounce">
          <Zap size={48} className="mx-auto mb-2 text-yellow-300" />
          <h3 className="text-2xl font-bold">準備比賽！</h3>
          <p className="opacity-90 mt-2">請加入球員並點擊下方按鈕開始分隊</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative bg-emerald-500 rounded-3xl border-4 border-emerald-700 shadow-xl overflow-hidden p-4 sm:p-6">
      {/* Court Lines - CSS Drawing */}
      <div className="absolute inset-4 sm:inset-6 border-2 border-white/80 rounded-sm pointer-events-none">
        {/* Net */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/60 -translate-y-1/2 border-dashed border-t-2 border-white/80"></div>
        {/* Center Lines */}
        <div className="absolute top-0 bottom-1/2 left-1/2 w-0.5 bg-white/60 -translate-x-1/2"></div>
        <div className="absolute top-1/2 bottom-0 left-1/2 w-0.5 bg-white/60 -translate-x-1/2"></div>
        {/* Service Lines */}
        <div className="absolute top-10 left-0 right-0 h-0.5 bg-white/60"></div>
        <div className="absolute bottom-10 left-0 right-0 h-0.5 bg-white/60"></div>
      </div>

      {/* Match Info Tag */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-b-xl font-bold text-sm shadow-md z-10 border-x-2 border-b-2 border-yellow-500">
        {currentMatch.type} 🔥
      </div>

      <div className="relative h-full min-h-[300px] flex flex-col justify-between py-6">
        
        {/* Team A */}
        <div className="flex justify-center items-center gap-4 sm:gap-12 h-1/2 pt-4">
           <div className="flex flex-col items-center gap-2 transform transition-all hover:-translate-y-1">
              <PlayerCard player={currentMatch.teamA.player1} size="lg" />
              <div className="w-2 h-2 rounded-full bg-white/50"></div>
           </div>
           <div className="flex flex-col items-center gap-2 transform transition-all hover:-translate-y-1">
              <PlayerCard player={currentMatch.teamA.player2} size="lg" />
              <div className="w-2 h-2 rounded-full bg-white/50"></div>
           </div>
        </div>

        {/* VS Badge */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="bg-red-500 text-white font-black text-xl italic px-4 py-2 rounded-full shadow-lg border-4 border-white transform -rotate-12 scale-110">
            VS
          </div>
        </div>

        {/* Team B */}
        <div className="flex justify-center items-center gap-4 sm:gap-12 h-1/2 pb-4">
           <div className="flex flex-col items-center gap-2 transform transition-all hover:translate-y-1">
              <div className="w-2 h-2 rounded-full bg-white/50"></div>
              <PlayerCard player={currentMatch.teamB.player1} size="lg" />
           </div>
           <div className="flex flex-col items-center gap-2 transform transition-all hover:translate-y-1">
              <div className="w-2 h-2 rounded-full bg-white/50"></div>
              <PlayerCard player={currentMatch.teamB.player2} size="lg" />
           </div>
        </div>
      </div>
    </div>
  );
};

export default Court;