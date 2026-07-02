import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import Header from './components/Header';
import PlayerInputSection from './components/PlayerInputSection';
import ScheduleControls from './components/ScheduleControls';
import MatchResults from './components/MatchResults';
import Leaderboard from './components/Leaderboard';
import { useStore } from './store/useStore';

const App: React.FC = () => {
  const { errorMsg, history, theme } = useStore();

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

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10 lg:space-y-16">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <PlayerInputSection />
          </motion.div>

          {errorMsg && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-600 dark:text-red-400 px-6 py-4 rounded-xl font-bold shadow-sm flex items-center gap-3 backdrop-blur-sm"
            >
              <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full"><span role="img" aria-label="alert">🚨</span></div>
              {errorMsg}
            </motion.div>
          )}

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <ScheduleControls />
          </motion.div>
          
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <MatchResults />
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
            <Leaderboard />
          </motion.div>
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