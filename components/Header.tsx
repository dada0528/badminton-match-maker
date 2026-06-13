import React, { useState } from 'react';
import { Calculator, Moon, Sun, Star, BookOpen, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import FeeCalculatorModal from './FeeCalculatorModal';
import PaymentManagerModal from './PaymentManagerModal';
import InfoModal from './InfoModal';
import { useStore } from '../store/useStore';

const BadmintonIcon = () => (
  <motion.svg
    width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    className="text-white"
    initial={{ rotate: -20, y: 10 }}
    animate={{ rotate: 10, y: 0 }}
    transition={{ type: "spring", stiffness: 200, damping: 10, repeat: Infinity, repeatType: "mirror", duration: 1.5 }}
  >
    <path d="M12 21a3 3 0 0 0 3-3V7s-1 0-3 0-3 0-3 0v11a3 3 0 0 0 3 3z" />
    <path d="M9 10s-5-1-6 2c0 0 0 4 6 5" />
    <path d="M15 10s5-1 6 2c0 0 0 4-6 5" />
    <path d="M12 7V3" />
    <path d="M9 7L6 3" />
    <path d="M15 7l3-4" />
  </motion.svg>
);

const Header: React.FC = () => {
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isPaymentManagerOpen, setIsPaymentManagerOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; type: 'features' | 'guide' }>({
    isOpen: false,
    type: 'features'
  });
  const { theme, setTheme } = useStore();

  const openInfo = (type: 'features' | 'guide') => {
    setInfoModal({ isOpen: true, type });
  };

  return (
    <>
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-md border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex flex-col gap-4">
          
          {/* Top Row: Logo + Title + Theme Toggle */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 min-w-0">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-emerald-500/30 dark:shadow-emerald-900/40 shadow-xl shrink-0 flex items-center justify-center relative overflow-hidden"
              >
                {/* Decorative background lines inside icon */}
                <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDhMODAwWm04IDBMMCAwWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3N2Zz4=')]"></div>
                <BadmintonIcon />
              </motion.div>
              <div className="flex flex-col">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight italic">
                  菜雞互啄 <span className="text-emerald-500 dark:text-emerald-400">分隊趣</span>
                </h1>
                <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-[-2px]">
                  Match Generator v4.3
                </span>
              </div>
            </div>
            
            {/* Universal Theme Toggle */}
            <motion.button
              whileHover={{ rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 sm:p-2.5 rounded-full text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all border border-transparent"
              title={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
            >
              {theme === 'dark' ? <Sun size={18} className="sm:w-5 sm:h-5" /> : <Moon size={18} className="sm:w-5 sm:h-5" />}
            </motion.button>
          </div>

          {/* Bottom Row: Action Buttons Section */}
          <div className="flex flex-row flex-nowrap overflow-x-auto hide-scrollbar items-center gap-2 sm:gap-3 w-full pb-1 mask-linear-fade">
            
            {/* Money Management Buttons */}
            <div className="flex bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50 shadow-inner shrink-0">
              <motion.button 
                whileHover={{ backgroundColor: 'white', scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsCalculatorOpen(true)}
                className="flex items-center justify-center flex-nowrap gap-1.5 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 dark:hover:bg-slate-700 px-3 py-2 sm:px-4 sm:py-2 rounded-lg transition-all whitespace-nowrap shrink-0"
              >
                <Calculator size={16} className="sm:w-4 sm:h-4 shrink-0" />
                <span className="whitespace-nowrap shrink-0">算錢</span>
              </motion.button>
              <div className="w-px bg-slate-200 dark:bg-slate-700 mx-0.5 my-1"></div>
              <motion.button 
                whileHover={{ backgroundColor: 'white', scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsPaymentManagerOpen(true)}
                className="flex items-center justify-center flex-nowrap gap-1.5 text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 dark:hover:bg-slate-700 px-3 py-2 sm:px-4 sm:py-2 rounded-lg transition-all whitespace-nowrap shrink-0"
              >
                <Wallet size={16} className="sm:w-4 sm:h-4 shrink-0" />
                <span className="whitespace-nowrap shrink-0">收費管理</span>
              </motion.button>
            </div>

            {/* Info & Guide Buttons */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openInfo('features')}
                className="flex items-center justify-center flex-nowrap gap-1.5 px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-sm whitespace-nowrap shrink-0"
              >
                <Star size={14} className="shrink-0 text-amber-500" />
                <span className="whitespace-nowrap shrink-0">功能介紹</span>
              </motion.button>
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openInfo('guide')}
                className="flex items-center justify-center flex-nowrap gap-1.5 px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-sm whitespace-nowrap shrink-0"
              >
                <BookOpen size={14} className="shrink-0 text-blue-500" />
                <span className="whitespace-nowrap shrink-0">使用方法</span>
              </motion.button>
            </div>
            
          </div>
        </div>
      </header>
      <FeeCalculatorModal isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      <PaymentManagerModal isOpen={isPaymentManagerOpen} onClose={() => setIsPaymentManagerOpen(false)} />
      <InfoModal 
        isOpen={infoModal.isOpen} 
        type={infoModal.type} 
        onClose={() => setInfoModal({ ...infoModal, isOpen: false })} 
      />
    </>
  );
};

export default Header;
