import React, { useState } from 'react';
import { ListOrdered, Shuffle, Calendar, CheckCircle2, Circle, Shield, Link2, X, Settings2 } from 'lucide-react';
import { motion } from 'motion/react';
import { MatchType } from '../types';
import { useStore } from '../store/useStore';
import { generateSchedule, generateNextMatch } from '../services/matchService';

const ControlToggle = ({ active, onClick, icon: Icon, label, title, colorClass }: any) => (
  <motion.button 
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all ${
        active 
        ? colorClass 
        : 'bg-slate-50/50 dark:bg-slate-800/50 border-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
    }`}
    title={title}
  >
    {active ? <CheckCircle2 size={18} className="shrink-0" /> : <Circle size={18} className="shrink-0" />}
    <span className="text-sm font-bold whitespace-nowrap">{label}</span>
  </motion.button>
);

const ScheduleControls: React.FC = () => {
  const { 
    players, 
    rounds, 
    courtCount, 
    mixPartners, 
    avoidGenderSkew,
    enableSkillLevel,
    enableScoring,
    autoVoiceEnabled,
    fixedPairs,
    setRounds, 
    setCourtCount, 
    courtNames,
    setCourtName,
    setScheduleType, 
    setMixPartners, 
    setAvoidGenderSkew,
    setEnableScoring,
    setAutoVoiceEnabled,
    setErrorMsg,
    firstMatchPlayerIds,
    setFirstMatchPlayerIds,
    addFixedPair,
    removeFixedPair,
    activeMatches,
    clearMatchHistory
  } = useStore();

  const [selectedForPair, setSelectedForPair] = useState<string[]>([]);
  const [isFullScheduleMode, setIsFullScheduleMode] = useState<boolean>(false);

  const handleGenerateSchedule = (type: MatchType) => {
    setErrorMsg(null);
    if (activeMatches.some(m => m !== null)) {
      clearMatchHistory();
    }
    setScheduleType(type);

    const validFirstMatchIds = firstMatchPlayerIds.filter(id => players.some(p => p.id === id));
    const initialMatches: (ScheduleItem | null)[] = Array(courtCount).fill(null);
    
    let currentHistory: ScheduleItem[] = [];
    let currentActive: ScheduleItem[] = [];
    
    for (let i = 0; i < courtCount; i++) {
        const result = generateNextMatch(
            players, currentHistory, currentActive, mixPartners, avoidGenderSkew, type, enableSkillLevel, fixedPairs, i + 1, validFirstMatchIds
        );
        if (result.match) {
            initialMatches[i] = result.match;
            currentActive.push(result.match);
        }
    }
    
    if (initialMatches.every(m => m === null)) {
        setErrorMsg('無法產生任何賽程，請檢查人數或設定');
        setTimeout(() => setErrorMsg(null), 3000);
    } else {
        useStore.getState().setActiveMatches(initialMatches);
        scrollToResults();
    }
  };

  const handleGenerateFullSchedule = (type: MatchType) => {
    setErrorMsg(null);
    clearMatchHistory();
    setScheduleType(type);

    const validFirstMatchIds = firstMatchPlayerIds.filter(id => players.some(p => p.id === id));
    const result = generateSchedule(
        players, rounds, mixPartners, avoidGenderSkew, type, 1, validFirstMatchIds, enableSkillLevel, fixedPairs
    );

    if (result.error) {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(null), 3000);
    } else {
        useStore.getState().setFullSchedule(result.schedule);
        scrollToResults();
    }
  };

  const handleGenerateClick = (type: MatchType) => {
    if (courtCount === 1 && isFullScheduleMode) {
      handleGenerateFullSchedule(type);
    } else {
      handleGenerateSchedule(type);
    }
  };

  const scrollToResults = () => {
    setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const toggleFirstMatchPlayer = (id: string) => {
    const validFirstMatchIds = firstMatchPlayerIds.filter(pid => players.some(p => p.id === pid));
    if (validFirstMatchIds.includes(id)) {
      setFirstMatchPlayerIds(validFirstMatchIds.filter(pid => pid !== id));
    } else {
      if (validFirstMatchIds.length < 4) {
        setFirstMatchPlayerIds([...validFirstMatchIds, id]);
      }
    }
  };

  const toggleForPair = (id: string) => {
    if (selectedForPair.includes(id)) {
      setSelectedForPair(selectedForPair.filter(pid => pid !== id));
    } else {
      if (selectedForPair.length < 2) {
        const newSelected = [...selectedForPair, id];
        setSelectedForPair(newSelected);
        if (newSelected.length === 2) {
          addFixedPair(newSelected[0], newSelected[1]);
          setTimeout(() => setSelectedForPair([]), 300);
        }
      }
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-[2rem] border border-slate-200/60 dark:border-slate-700/60 shadow-sm transition-colors duration-300 relative overflow-hidden">
        {/* Decorative Graphic */}
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-slate-100 dark:bg-slate-700/30 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        <div className="flex items-center gap-3 mb-8 relative z-10">
           <div className="p-2.5 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/30">
             <Settings2 size={24} />
           </div>
           <h3 className="text-2xl font-black text-slate-800 dark:text-white italic tracking-tight">賽事策略</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <div className="space-y-6">
            
            {/* Setup Controls */}
            <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Calendar size={18} className="text-slate-400" />
                    分配場地
                  </span>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setCourtCount(Math.max(1, courtCount-1))} className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow shadow-slate-200 dark:shadow-none font-bold text-slate-600 dark:text-slate-200 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all text-xl leading-none">-</button>
                    <span className="w-6 text-center font-black text-xl text-slate-800 dark:text-white">{courtCount}</span>
                    <button onClick={() => setCourtCount(Math.min(10, courtCount+1))} className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow shadow-slate-200 dark:shadow-none font-bold text-slate-600 dark:text-slate-200 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all text-xl leading-none">+</button>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 block">場地客製化命名:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {courtNames.map((name, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border-2 border-transparent focus-within:border-indigo-400 transition-colors shadow-sm">
                        <span className="text-[10px] font-black text-white bg-indigo-500 rounded px-1.5 py-0.5">#{idx + 1}</span>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setCourtName(idx, e.target.value)}
                          className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-slate-100 focus:outline-none"
                          placeholder={`Court ${idx + 1}`}
                          maxLength={6}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {courtCount === 1 && (
                  <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300">
                    <span className="text-sm font-bold">全賽程表輪數</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setRounds(Math.max(1, rounds-1))} className="w-7 h-7 rounded-full bg-white/80 dark:bg-indigo-800 shadow-sm font-bold flex items-center justify-center hover:scale-105 active:scale-95 transition-all">-</button>
                      <span className="w-6 text-center font-black text-lg">{rounds}</span>
                      <button onClick={() => setRounds(Math.min(10, rounds+1))} className="w-7 h-7 rounded-full bg-white/80 dark:bg-indigo-800 shadow-sm font-bold flex items-center justify-center hover:scale-105 active:scale-95 transition-all">+</button>
                    </div>
                  </div>
                )}
            </div>

            {/* Smart Toggles */}
            <div className="grid grid-cols-2 gap-3">
               {courtCount === 1 && (
                 <div className="col-span-2">
                   <ControlToggle 
                     active={isFullScheduleMode} 
                     onClick={() => setIsFullScheduleMode(!isFullScheduleMode)}
                     label="一次列出所有賽程" 
                     colorClass="bg-indigo-50 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm"
                   />
                 </div>
               )}
               <ControlToggle 
                 active={mixPartners} 
                 onClick={() => setMixPartners(!mixPartners)}
                 label="盡量交換隊友" 
                 colorClass="bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm"
               />
               <ControlToggle 
                 active={avoidGenderSkew} 
                 onClick={() => setAvoidGenderSkew(!avoidGenderSkew)}
                 label="避免不平性別戰" 
                 title="避免男男vs女女"
                 colorClass="bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm"
               />
               <ControlToggle 
                 active={enableScoring} 
                 onClick={() => setEnableScoring(!enableScoring)}
                 label="開啟計分板" 
                 colorClass="bg-amber-50 dark:bg-amber-900/40 border-amber-300 dark:border-amber-500 text-amber-700 dark:text-amber-300 shadow-sm"
               />
               <ControlToggle 
                 active={autoVoiceEnabled} 
                 onClick={() => setAutoVoiceEnabled(!autoVoiceEnabled)}
                 label="自動語音播報" 
                 title="自動語音播報下一場對戰名單"
                 colorClass="bg-pink-50 dark:bg-pink-900/40 border-pink-300 dark:border-pink-500 text-pink-700 dark:text-pink-300 shadow-sm"
               />
            </div>
          </div>

          <div className="space-y-6 flex flex-col">
            {/* First Match Players */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">💎 指定首戰球員</span>
                <span className="text-xs font-bold bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full shadow-sm text-slate-500">
                  {firstMatchPlayerIds.filter(id => players.some(p => p.id === id)).length} / 4
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.map(p => {
                  const isSelected = firstMatchPlayerIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleFirstMatchPlayer(p.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                        isSelected 
                          ? 'bg-emerald-500 text-white shadow-md scale-105' 
                          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fixed Pairs */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Link2 size={16} className="text-blue-500" /> 指定搭檔
                </span>
                <span className="text-xs font-bold bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full shadow-sm text-slate-500">
                  {fixedPairs.length} 組
                </span>
              </div>
              
              {fixedPairs.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {fixedPairs.map(([p1Id, p2Id], idx) => {
                    const p1 = players.find(p => p.id === p1Id);
                    const p2 = players.find(p => p.id === p2Id);
                    if (!p1 || !p2) return null;
                    return (
                      <div key={idx} className="flex items-center gap-1 bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900/50 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                        <span>{p1.name}</span>
                        <span className="text-blue-400 dark:text-blue-500 mx-0.5">&amp;</span>
                        <span>{p2.name}</span>
                        <button 
                          onClick={() => removeFixedPair(p1Id, p2Id)}
                          className="ml-2 bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-600 dark:hover:text-red-300 p-0.5 rounded-md transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {players.map(p => {
                  if (fixedPairs.some(pair => pair.includes(p.id))) return null;
                  const isSelected = selectedForPair.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleForPair(p.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                        isSelected 
                          ? 'bg-blue-500 text-white shadow-md scale-105 ring-2 ring-blue-300 dark:ring-blue-800 ring-offset-1 dark:ring-offset-slate-900' 
                          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Generate Action Area */}
        <div className="mt-8 pt-8 border-t border-slate-200/60 dark:border-slate-700/60 relative z-10 w-full text-center">
            <h4 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">開始產生賽事</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => handleGenerateClick(MatchType.RANDOM)} className="group relative overflow-hidden py-4 sm:py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-500/20 transition-all flex flex-col items-center justify-center gap-1.5">
                 <Shuffle size={24} className="group-hover:rotate-180 transition-transform duration-500" />
                 <span className="tracking-widest">一般隨機</span>
               </motion.button>
               <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => handleGenerateClick(MatchType.MIXED_DOUBLES)} className="group relative overflow-hidden py-4 sm:py-5 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl font-black shadow-xl shadow-purple-500/20 transition-all flex flex-col items-center justify-center gap-1.5">
                 <Shuffle size={24} className="group-hover:rotate-180 transition-transform duration-500" />
                 <span className="tracking-widest">男女混雙</span>
               </motion.button>
               <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => handleGenerateClick(MatchType.MENS_DOUBLES)} className="group relative overflow-hidden py-4 sm:py-5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 transition-all flex flex-col items-center justify-center gap-1.5">
                 <Shuffle size={24} className="group-hover:rotate-180 transition-transform duration-500" />
                 <span className="tracking-widest">男雙限定</span>
               </motion.button>
               <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => handleGenerateClick(MatchType.WOMENS_DOUBLES)} className="group relative overflow-hidden py-4 sm:py-5 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl font-black shadow-xl shadow-pink-500/20 transition-all flex flex-col items-center justify-center gap-1.5">
                 <Shuffle size={24} className="group-hover:rotate-180 transition-transform duration-500" />
                 <span className="tracking-widest">女雙限定</span>
               </motion.button>
            </div>
        </div>
    </section>
  );
};

export default ScheduleControls;
