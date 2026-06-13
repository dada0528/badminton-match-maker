import React, { useState } from 'react';
import { Trash2, UserPlus, Users, History, Upload, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, Gender } from '../types';
import PlayerCard from './PlayerCard';
import ImportModal from './ImportModal';
import { useStore } from '../store/useStore';

const PlayerInputSection: React.FC = () => {
  const { 
    players, 
    history, 
    addPlayer, 
    removePlayer, 
    clearPlayers, 
    addToHistory,
    removeFromHistory,
    setPlayers,
    setErrorMsg,
    enableSkillLevel,
    setEnableSkillLevel,
    updatePlayerLevel
  } = useStore();

  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<Gender>(Gender.MALE);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addPlayer(newName.trim(), newGender);
    setNewName('');
  };

  const handleAddAllHistory = () => {
    const currentNames = new Set(players.map(p => p.name));
    const playersToAdd: Player[] = [];

    history.forEach((h, index) => {
      if (!currentNames.has(h.name)) {
        playersToAdd.push({
          id: Date.now().toString() + '-' + index + '-' + Math.random().toString().substring(2, 7),
          name: h.name,
          gender: h.gender,
        });
      }
    });

    if (playersToAdd.length > 0) {
      setPlayers(prev => [...prev, ...playersToAdd]);
    } else {
       setErrorMsg('所有歷史球員都在名單內囉！');
       setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  const handleBatchImport = (newPlayers: { name: string; gender: Gender }[]) => {
    const playersToAdd: Player[] = [];
    
    newPlayers.forEach((p, index) => {
      if (!players.some(existing => existing.name === p.name)) {
        playersToAdd.push({
          id: Date.now().toString() + '-batch-' + index + '-' + Math.random().toString().substring(2, 7),
          name: p.name,
          gender: p.gender,
        });
        addToHistory(p.name, p.gender);
      }
    });

    if (playersToAdd.length > 0) {
      setPlayers(prev => [...prev, ...playersToAdd]);
      setErrorMsg(`成功匯入 ${playersToAdd.length} 位球員！`);
      setTimeout(() => setErrorMsg(null), 2000);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-200/60 dark:border-slate-700/60 transition-colors duration-300 relative overflow-hidden">
      {/* Decorative Sporty Stripes */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rotate-45 transform origin-top-right -translate-y-16 translate-x-16 pointer-events-none"></div>
      
      <div className="flex items-center justify-between mb-8 relative z-10">
         <div className="flex flex-col">
           <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 italic tracking-tight">
              <Users className="text-emerald-500" strokeWidth={2.5} />
              球員名錄
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1 rounded-full ml-2 not-italic">
                {players.length} 人
              </span>
           </h2>
         </div>
         <div className="flex items-center gap-2 sm:gap-3">
           <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsImportModalOpen(true)}
              className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors font-bold shadow-sm"
           >
              <Upload size={16} /> <span className="hidden sm:inline">批次匯入</span>
           </motion.button>
           <motion.button 
              whileHover={{ scale: 1.05, color: '#ef4444' }}
              whileTap={{ scale: 0.95 }}
              onClick={clearPlayers} 
              className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors font-bold"
              title="清空名單"
           >
              <Trash2 size={16} />
           </motion.button>
         </div>
      </div>

      {/* Add Player Form */}
      <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-3 mb-8 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner relative z-10">
        <div className="flex-1 relative">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="輸入球員姓名..."
            className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 font-bold text-lg text-slate-800 dark:text-white placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:focus:ring-emerald-500 shadow-sm transition-all"
          />
        </div>
        
        <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1.5 shadow-sm w-full sm:w-auto h-[60px] items-center">
          <button
            type="button"
            onClick={() => setNewGender(Gender.MALE)}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-bold transition-all h-full flex items-center justify-center ${
              newGender === Gender.MALE 
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            男生
          </button>
          <button
            type="button"
            onClick={() => setNewGender(Gender.FEMALE)}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-bold transition-all h-full flex items-center justify-center ${
              newGender === Gender.FEMALE 
                ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            女生
          </button>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          type="submit"
          disabled={!newName.trim()}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 h-[60px]"
        >
          <UserPlus size={20} />
          加入
        </motion.button>
      </form>

      {/* History Quick Add */}
      {history.length > 0 && (
        <div className="mb-8 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              <History size={14} /> 歷史紀錄球員
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddAllHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              <Users size={14} /> 全部加入
            </motion.button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {history.map((h) => {
                const isActive = players.some(p => p.name === h.name);
                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    layout
                    key={h.name} 
                    className={`
                      flex items-center border rounded-xl overflow-hidden
                      ${isActive 
                        ? 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-50' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-sm hover:shadow'
                      }
                    `}
                  >
                    <button
                      onClick={() => !isActive && addPlayer(h.name, h.gender)}
                      disabled={isActive}
                      className={`
                        px-3 py-1.5 text-sm font-bold outline-none flex items-center gap-1.5
                        ${isActive 
                          ? 'text-slate-400 cursor-default' 
                          : h.gender === Gender.MALE ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'
                        }
                      `}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-slate-300' : h.gender === Gender.MALE ? 'bg-blue-500' : 'bg-pink-500'}`}></div>
                      {h.name}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromHistory(h.name); }}
                      className="px-2 py-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors outline-none"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Active Player Grid */}
      <div className="min-h-[120px] relative z-10">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700/50 pb-3">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wider uppercase">上場名單</h3>
          
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors flex items-center gap-1">
              <Activity size={14} className={enableSkillLevel ? 'text-emerald-500' : ''} />
              戰力分級
            </span>
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enableSkillLevel ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={enableSkillLevel}
                onChange={(e) => setEnableSkillLevel(e.target.checked)}
              />
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableSkillLevel ? 'translate-x-4' : 'translate-x-[2px]'} shadow-sm`} />
            </div>
          </label>
        </div>
        
        {players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <Users size={32} className="mb-2 opacity-50" />
            <p className="font-bold">目前沒有球員</p>
            <p className="text-xs mt-1">請在上方輸入姓名加入清單</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <AnimatePresence>
              {players.map(player => (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <PlayerCard 
                    player={player} 
                    onDelete={removePlayer} 
                    showLevelAdjust={enableSkillLevel}
                    onLevelChange={updatePlayerLevel}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleBatchImport}
        existingNames={new Set(players.map(p => p.name))}
      />
    </section>
  );
};

export default PlayerInputSection;
