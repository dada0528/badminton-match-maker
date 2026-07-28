import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Calendar, Trophy } from 'lucide-react';
import Header from './components/Header';
import PlayerInputSection from './components/PlayerInputSection';
import ScheduleControls from './components/ScheduleControls';
import MatchResults from './components/MatchResults';
import Leaderboard from './components/Leaderboard';
import { useStore } from './store/useStore';

type Tab = 'players' | 'matches' | 'leaderboard';

const App: React.FC = () => {
  const { errorMsg, history, theme } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('players');

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
    <div className="min-h-screen relative bg-slate-50 dark:bg-slate-950 transition-colors duration-300 font-q overflow-hidden pb-20 selection:bg-emerald-200 dark:selection:bg-emerald-900 selection:text-emerald-900 dark:selection:text-emerald-100">
      
      {/* Sporty Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
         <div className="absolute top-0 right-0 w-[40vw] h-[100vh] bg-gradient-to-l from-slate-100 to-transparent dark:from-slate-900 dark:to-transparent opacity-50 transform -skew-x-12 translate-x-32"></div>
         <div className="absolute top-0 left-0 w-[30vw] h-[100vh] bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/20 dark:to-transparent opacity-40 transform skew-x-12 -translate-x-32"></div>
      </div>

      <div className="relative z-10 w-full h-full pb-20">
        <Header />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          
          {/* Tabs */}
          <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-2xl mb-8 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('players')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'players' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Users size={18} />
              <span className="hidden sm:inline">選手名單</span>
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'matches' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Calendar size={18} />
              <span className="hidden sm:inline">賽事安排</span>
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'leaderboard' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Trophy size={18} />
              <span className="hidden sm:inline">排行榜</span>
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

            {activeTab === 'leaderboard' && (
              <motion.div 
                key="leaderboard"
                initial={{ y: 20, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Leaderboard />
              </motion.div>
            )}
          </div>
        </main>
        
        {/* Watermark */}
        <div className="fixed bottom-4 right-6 text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-700 pointer-events-none z-50 select-none">
          Design by Kunta
        </div>
      </div>
    </div>
  );
};

export default App;
