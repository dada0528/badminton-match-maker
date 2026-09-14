import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Calendar } from 'lucide-react';
import Header from './components/Header';
import PlayerInputSection from './components/PlayerInputSection';
import ScheduleControls from './components/ScheduleControls';
import MatchResults from './components/MatchResults';
import { useStore } from './store/useStore';
import { Gender } from './types';

type Tab = 'players' | 'matches';

const App: React.FC = () => {
  const { players, activeMatches, fullSchedule, errorMsg, history, theme, isFullscreen } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('players');

  // Stats for tab badges
  const totalPlayers = players.length;
  const malesCount = players.filter(p => p.gender === Gender.MALE).length;
  const femalesCount = players.filter(p => p.gender === Gender.FEMALE).length;
  const activeMatchCount = activeMatches.filter(Boolean).length;

  // Initialize dark mode
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Migration from old localStorage format to Zustand persist
  useEffect(() => {
    const oldHistory = localStorage.getItem('badminton_player_history');
    if (oldHistory && history.length === 0) {
      try {
        const parsed = JSON.parse(oldHistory);
        useStore.setState({ history: parsed });
      } catch (e) {
        console.error("Failed to parse old history", e);
      }
    }
  }, [history.length]);

  return (
    <div className="min-h-screen relative bg-slate-50 dark:bg-slate-950 transition-colors duration-300 font-q overflow-hidden pb-24 sm:pb-20 selection:bg-emerald-200 dark:selection:bg-emerald-900 selection:text-emerald-900 dark:selection:text-emerald-100">
      
      {/* Sporty Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
         <div className="absolute top-0 right-0 w-[40vw] h-[100vh] bg-gradient-to-l from-slate-100 to-transparent dark:from-slate-900 dark:to-transparent opacity-50 transform -skew-x-12 translate-x-32"></div>
         <div className="absolute top-0 left-0 w-[30vw] h-[100vh] bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/20 dark:to-transparent opacity-40 transform skew-x-12 -translate-x-32"></div>
      </div>

      <div className="relative z-10 w-full h-full pb-20">
        <Header />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          
          {/* Top Tabs with Live Status Badges */}
          <div className="flex bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-2xl mb-8 backdrop-blur-md shadow-inner border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setActiveTab('players')}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'players' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-700/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Users size={18} />
                <span>選手名單</span>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold transition-all ${
                activeTab === 'players' 
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                  : 'bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400'
              }`}>
                {totalPlayers}人 {totalPlayers > 0 ? `· ♂${malesCount} ♀${femalesCount}` : ''}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('matches')}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'matches' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-700/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Calendar size={18} />
                <span>賽事安排</span>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold transition-all ${
                activeMatchCount > 0 
                  ? 'bg-emerald-500 text-white animate-pulse' 
                  : activeTab === 'matches'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400'
              }`}>
                {activeMatchCount > 0 ? `${activeMatchCount}場進行中` : fullSchedule.length > 0 ? `${fullSchedule.length}場對戰` : '排程中'}
              </span>
            </button>
          </div>

          {errorMsg && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl font-bold shadow-sm flex items-center gap-3 backdrop-blur-sm mb-8"
            >
              <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full"><span role="img" aria-label="alert">🚨</span></div>
              {errorMsg}
            </motion.div>
          )}

          <div className="relative">
            {activeTab === 'players' && (
              <motion.div 
                key="players"
                initial={{ y: 20, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <PlayerInputSection />
              </motion.div>
            )}
            
            {activeTab === 'matches' && (
              <motion.div 
                key="matches"
                initial={{ y: 20, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-10 lg:space-y-16"
              >
                <ScheduleControls />
                <MatchResults />
              </motion.div>
            )}
          </div>
        </main>
        
        {/* Watermark */}
        <div className="fixed bottom-16 sm:bottom-4 right-6 text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-700 pointer-events-none z-40 select-none">
          Design by Kunta
        </div>
      </div>

      {/* Mobile Sticky Bottom Navigation */}
      {!isFullscreen && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-2 py-1.5">
          <div className="flex items-center justify-around max-w-md mx-auto">
            
            {/* Tab 1: Players */}
            <button
              onClick={() => setActiveTab('players')}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-2xl transition-all relative ${
                activeTab === 'players'
                  ? 'text-emerald-600 dark:text-emerald-400 font-black'
                  : 'text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Users size={22} className={activeTab === 'players' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                {totalPlayers > 0 && (
                  <span className="absolute -top-1.5 -right-3 text-[10px] font-black bg-blue-500 text-white px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight shadow-sm">
                    {totalPlayers}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none">選手 ({malesCount}♂/{femalesCount}♀)</span>
              {activeTab === 'players' && (
                <motion.div layoutId="bottomNavIndicator" className="absolute top-0 w-8 h-1 bg-emerald-500 rounded-full" />
              )}
            </button>

            {/* Tab 2: Matches */}
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-2xl transition-all relative ${
                activeTab === 'matches'
                  ? 'text-emerald-600 dark:text-emerald-400 font-black'
                  : 'text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Calendar size={22} className={activeTab === 'matches' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                {activeMatchCount > 0 && (
                  <span className="absolute -top-1.5 -right-3 text-[10px] font-black bg-emerald-500 text-white px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight shadow-sm animate-pulse">
                    {activeMatchCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none">
                賽事 {activeMatchCount > 0 ? `(${activeMatchCount}進行)` : ''}
              </span>
              {activeTab === 'matches' && (
                <motion.div layoutId="bottomNavIndicator" className="absolute top-0 w-8 h-1 bg-emerald-500 rounded-full" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
