import React, { useState } from 'react';
import { Trash2, UserPlus, Users, History, Upload, Activity, Share2, Play, Pause, Plus, Minus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, Gender } from '../types';
import PlayerCard from './PlayerCard';
import ImportModal from './ImportModal';
import { ShareGroupModal } from './ShareGroupModal';
import { useStore } from '../store/useStore';

const PlayerListItem = ({ 
  player, 
  enableSkillLevel, 
  onUpdateLevel, 
  onToggleStatus, 
  onRemove 
}: { 
  player: Player, 
  enableSkillLevel: boolean, 
  onUpdateLevel: (id: string, level: number) => void, 
  onToggleStatus: (id: string) => void, 
  onRemove: (id: string) => void 
}) => {
  const isMale = player.gender === Gender.MALE;
  const isSuspended = player.status === 'SUSPENDED';
  const level = player.level || 3;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group flex items-center justify-between p-2 sm:px-3 sm:py-2.5 rounded-xl border transition-all ${
        isSuspended 
          ? 'bg-slate-50 border-slate-200/50 dark:bg-slate-800/30 dark:border-slate-700/50 opacity-70' 
          : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-sm hover:shadow'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={`w-2 h-2 rounded-full shrink-0 ${isSuspended ? 'bg-slate-300 dark:bg-slate-600' : isMale ? 'bg-blue-400' : 'bg-pink-400'}`} />
        <span className={`font-bold truncate text-sm sm:text-base ${isSuspended ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
          {player.name}
        </span>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {enableSkillLevel && (
          <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
             <button onClick={() => onUpdateLevel(player.id, level - 1)} disabled={level <= 1} className="px-2 py-1 sm:py-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"><Minus size={12} strokeWidth={3}/></button>
             <span className="text-xs font-bold w-4 text-center text-slate-700 dark:text-slate-300">{level}</span>
             <button onClick={() => onUpdateLevel(player.id, level + 1)} disabled={level >= 9} className="px-2 py-1 sm:py-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30"><Plus size={12} strokeWidth={3}/></button>
          </div>
        )}
        <button onClick={() => onToggleStatus(player.id)} title={isSuspended ? '上場' : '休息'} className={`p-1.5 sm:p-2 rounded-lg transition-colors ${isSuspended ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30'} dark:bg-opacity-20`}>
          {isSuspended ? <Play size={14} strokeWidth={3}/> : <Pause size={14} strokeWidth={3}/>}
        </button>
        <button onClick={() => onRemove(player.id)} title="刪除" className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors">
          <X size={14} strokeWidth={3}/>
        </button>
      </div>
    </motion.div>
  );
};

const PlayerInputSection: React.FC = () => {
  const { 
    players, 
    history, 
    addPlayer, 
    removePlayer, 
    togglePlayerStatus,
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-8 relative z-10">
         <div className="flex flex-col">
           <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 italic tracking-tight">
              <Users className="text-emerald-500" strokeWidth={2.5} />
              球員名錄
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1 rounded-full ml-2 not-italic">
                {players.length} 人
              </span>
           </h2>
         </div>
         <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 w-full sm:w-auto">
           <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsShareModalOpen(true)}
              className="text-[11px] sm:text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 px-2.5 py-2 sm:px-4 sm:py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors font-bold shadow-sm whitespace-nowrap shrink-0"
           >
              <Share2 size={14} className="shrink-0 sm:w-4 sm:h-4" /> <span>分享揪團</span>
           </motion.button>
           <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsImportModalOpen(true)}
              className="text-[11px] sm:text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-2 sm:px-4 sm:py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors font-bold shadow-sm whitespace-nowrap shrink-0"
           >
              <Upload size={14} className="shrink-0 sm:w-4 sm:h-4" /> <span>批次匯入</span>
           </motion.button>
           <motion.button 
              whileHover={{ scale: 1.05, color: '#ef4444' }}
              whileTap={{ scale: 0.95 }}
              onClick={clearPlayers} 
              className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors font-bold whitespace-nowrap shrink-0"
           >
              <Trash2 size={14} className="shrink-0 sm:w-4 sm:h-4" /> <span>清空名單</span>
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
      <div className="min-h-[120px] relative z-10 mt-6">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-700/50 pb-4">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 tracking-wider">上場名單</h3>
          
          <label className="flex items-center gap-2 cursor-pointer group bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors flex items-center gap-1.5">
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
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <Users size={40} className="mb-3 opacity-40 text-slate-400" />
            <p className="font-bold text-slate-500 dark:text-slate-400">目前沒有球員</p>
            <p className="text-sm mt-1 opacity-70">請在上方輸入姓名加入清單</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {/* Male Players */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <span className="font-bold">👦</span>
                  </div>
                  <span className="font-bold text-slate-700 dark:text-slate-200">男生</span>
                </div>
                <span className="text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full">
                  {players.filter(p => p.gender === Gender.MALE).length} 人
                </span>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {players.filter(p => p.gender === Gender.MALE).map(player => (
                    <PlayerListItem 
                      key={player.id} 
                      player={player} 
                      enableSkillLevel={enableSkillLevel}
                      onUpdateLevel={updatePlayerLevel}
                      onToggleStatus={togglePlayerStatus}
                      onRemove={removePlayer}
                    />
                  ))}
                  {players.filter(p => p.gender === Gender.MALE).length === 0 && (
                     <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                       無男生球員
                     </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Female Players */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center text-pink-600 dark:text-pink-400">
                    <span className="font-bold">👧</span>
                  </div>
                  <span className="font-bold text-slate-700 dark:text-slate-200">女生</span>
                </div>
                <span className="text-xs font-bold bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 px-2.5 py-1 rounded-full">
                  {players.filter(p => p.gender === Gender.FEMALE).length} 人
                </span>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {players.filter(p => p.gender === Gender.FEMALE).map(player => (
                    <PlayerListItem 
                      key={player.id} 
                      player={player} 
                      enableSkillLevel={enableSkillLevel}
                      onUpdateLevel={updatePlayerLevel}
                      onToggleStatus={togglePlayerStatus}
                      onRemove={removePlayer}
                    />
                  ))}
                  {players.filter(p => p.gender === Gender.FEMALE).length === 0 && (
                     <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                       無女生球員
                     </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleBatchImport}
        existingNames={new Set(players.map(p => p.name))}
      />

      <ShareGroupModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </section>
  );
};

export default PlayerInputSection;
