import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Coffee, Calendar, Download, Shuffle, Volume2, VolumeX, BarChart3, ArrowRight, Maximize, Minimize, RotateCw, Users, MoveHorizontal, X, LayoutTemplate, Plus, Minus, Pencil, Wallet, Clock, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { MatchType, Gender, ScheduleItem, Player } from '../types';
import PlayerCard from './PlayerCard';
import EditPlayerModal from './EditPlayerModal';
import PaymentManagerModal from './PaymentManagerModal';
import MatchCombinationsModal from './MatchCombinationsModal';
import PlayerWaitAnalysisModal from './PlayerWaitAnalysisModal';
import AvoidPlayersModal from './AvoidPlayersModal';
import html2canvas from 'html2canvas';
import { generateNextMatch, suggestWaitList } from '../services/matchService';

const CourtPlayerBadge = ({ 
  player, 
  onClick, 
  onEdit 
}: { 
  player: Player; 
  onClick?: () => void; 
  onEdit?: () => void;
}) => (
  <motion.div 
    whileHover={onClick ? { scale: 1.05 } : {}}
    whileTap={onClick ? { scale: 0.95 } : {}}
    onClick={onClick}
    title={onClick ? "點擊更換選手 / 管理" : undefined}
    className={`flex items-center justify-center min-w-[3.8rem] px-2.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black shadow-xl border-2 overflow-hidden backdrop-blur-md ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-emerald-300 transition-all' : ''} ${
    player.gender === Gender.MALE 
      ? 'bg-blue-500/90 border-blue-200/50 text-white dark:bg-blue-600/90' 
      : 'bg-pink-500/90 border-pink-200/50 text-white dark:bg-pink-600/90'
  }`}>
    <span 
      className="whitespace-nowrap tracking-wide select-none cursor-pointer"
      style={{ lineHeight: '1.2' }}
    >
      {player.name}
    </span>
    {onEdit && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        title="修改姓名與性別"
        className="w-4 h-4 flex items-center justify-center ml-1 text-white/80 hover:text-white rounded-full bg-white/20 hover:bg-white/35 transition-all active:scale-90 shrink-0"
      >
        <Pencil size={9} strokeWidth={2.5} />
      </button>
    )}
  </motion.div>
);

const shouldShowMatchMessage = (msg?: string) => {
  if (!msg) return false;
  if (msg.includes('自由配') || msg.includes('不分男女') || msg.includes('全男雙') || msg.includes('全女雙')) return false;
  return true;
};

const getLandscapeColsClass = (count: number) => {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  if (count === 4) return 'grid-cols-2';
  if (count === 5 || count === 6) return 'grid-cols-3';
  if (count >= 7 && count <= 8) return 'grid-cols-4';
  if (count === 9) return 'grid-cols-3';
  if (count >= 10 && count <= 12) return 'grid-cols-4';
  if (count > 12 && count <= 15) return 'grid-cols-5';
  return 'grid-cols-6';
};

const getBadgeScaleClass = (count: number) => {
  if (count <= 1) return 'scale-[2.5] sm:scale-[3]';
  if (count === 2) return 'scale-150 sm:scale-[2]';
  if (count === 3) return 'scale-125 sm:scale-150';
  if (count === 4) return 'scale-150 sm:scale-[1.75]';
  if (count === 5 || count === 6) return 'scale-125 sm:scale-150';
  if (count >= 7 && count <= 8) return 'scale-110 sm:scale-125';
  if (count === 9) return 'scale-125 sm:scale-150';
  if (count >= 10 && count <= 12) return 'scale-110 sm:scale-125';
  if (count > 12) return 'scale-90 sm:scale-100';
  return 'scale-90';
};

const MatchResults: React.FC = () => {
  const { 
    players, 
    activeMatches, 
    matchHistory,
    fullSchedule,
    scheduleType,
    errorMsg,
    enableSkillLevel,
    skillMode,
    endMatch,
    undoMatch,
    mixPartners,
    avoidGenderSkew,
    freeGender,
    fixedPairs,
    courtNames,
    autoVoiceEnabled,
    setAutoVoiceEnabled,
    togglePlayerStatus,
    updatePlayerLevel,
    isFullscreen,
    setIsFullscreen,
    avoidPairs
  } = useStore();

  const isFullScheduleMode = fullSchedule && fullSchedule.length > 0;
  const hasMatches = (activeMatches && activeMatches.length > 0) || isFullScheduleMode;
  const displayMatches = isFullScheduleMode ? fullSchedule : activeMatches;

  const scheduleRef = useRef<HTMLDivElement>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isCombinationsOpen, setIsCombinationsOpen] = useState(false);
  const [isAvoidModalOpen, setIsAvoidModalOpen] = useState(false);
  const [isWaitAnalysisOpen, setIsWaitAnalysisOpen] = useState(false);
  const [targetWaitPlayerId, setTargetWaitPlayerId] = useState<string | undefined>(undefined);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [swappingPlayer, setSwappingPlayer] = useState<{
    matchIdx: number;
    team: 'teamA' | 'teamB';
    playerKey: 'player1' | 'player2';
    player: Player;
  } | null>(null);

  useEffect(() => {
    if (isFullscreen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isFullscreen]);

  const waitingPlayers = useMemo(() => {
    if (isFullScheduleMode) return [];
    if (!activeMatches || activeMatches.length === 0) return [];
    
    return suggestWaitList(players, matchHistory, activeMatches, scheduleType, freeGender);
  }, [players, matchHistory, activeMatches, scheduleType, freeGender]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (isFullscreen) {
      setIsLandscape(false);
    }
  };

  const handleEndMatch = (courtIndex: number) => {
    const { players, activeMatches, matchHistory, mixPartners, avoidGenderSkew, scheduleType, enableSkillLevel, fixedPairs, freeGender, skillMode, avoidPairs } = useStore.getState();
    
    let eligiblePlayers = [...players].filter(p => p.status !== 'SUSPENDED');
    if (!freeGender) {
      if (scheduleType === MatchType.MENS_DOUBLES) eligiblePlayers = eligiblePlayers.filter(p => p.gender === Gender.MALE);
      if (scheduleType === MatchType.WOMENS_DOUBLES) eligiblePlayers = eligiblePlayers.filter(p => p.gender === Gender.FEMALE);
    }
    
    if (eligiblePlayers.length < 4) {
        alert('總人數不足 4 人，無法繼續安排比賽');
        endMatch(courtIndex, null);
        return;
    }

    const currentMatch = activeMatches[courtIndex];
    const nextActiveMatches = [...activeMatches];
    nextActiveMatches[courtIndex] = null;
    const nextMatchHistory = currentMatch ? [...matchHistory, currentMatch] : matchHistory;

    const result = generateNextMatch(
        players,
        nextMatchHistory,
        nextActiveMatches,
        mixPartners,
        avoidGenderSkew,
        scheduleType,
        enableSkillLevel,
        fixedPairs,
        courtIndex + 1,
        [],
        skillMode,
        freeGender,
        avoidPairs
    );
    
    if (result.error) {
        endMatch(courtIndex, null);
        if (!result.error.includes('可用選手不足')) {
            alert(result.error);
        }
    } else {
        endMatch(courtIndex, result.match);
        if (useStore.getState().autoVoiceEnabled && result.match) {
            handleSpeak(result.match);
        }
    }
  };

  const handleExport = async () => {
    if (!scheduleRef.current) return;
    
    try {
        const canvas = await html2canvas(scheduleRef.current, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            windowWidth: 1024,
        });
        
        const link = document.createElement('a');
        link.download = `badminton-schedule-${new Date().toISOString().slice(0,10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Export failed:', error);
        alert('圖片匯出失敗，請稍後再試');
    }
  };

  const handleSpeak = (match: ScheduleItem, sequenceIdx?: number) => {
    if (typeof window.speechSynthesis !== 'undefined') {
      window.speechSynthesis.cancel();
      const courtName = sequenceIdx !== undefined ? sequenceIdx.toString() : (courtNames[match.court - 1] || match.court.toString());
      let text = `第${courtName}場地，${match.teamA.player1.name} 與 ${match.teamA.player2.name}，對戰，${match.teamB.player1.name} 與 ${match.teamB.player2.name}`;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-TW';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  };

  const handleSwapConfirm = (targetPlayer: Player) => {
    if (!swappingPlayer) return;

    const { matchIdx, team, playerKey, player } = swappingPlayer;
    let matchToEdit = isFullScheduleMode 
      ? JSON.parse(JSON.stringify(fullSchedule[matchIdx])) 
      : JSON.parse(JSON.stringify(activeMatches[matchIdx]));
      
    if (!matchToEdit) return;

    const isTargetSameMatchIdx = [matchToEdit.teamA.player1.id, matchToEdit.teamA.player2.id, matchToEdit.teamB.player1.id, matchToEdit.teamB.player2.id].includes(targetPlayer.id);

    if (isTargetSameMatchIdx) {
      if (matchToEdit.teamA.player1.id === targetPlayer.id) { matchToEdit.teamA.player1 = player; }
      else if (matchToEdit.teamA.player2.id === targetPlayer.id) { matchToEdit.teamA.player2 = player; }
      else if (matchToEdit.teamB.player1.id === targetPlayer.id) { matchToEdit.teamB.player1 = player; }
      else if (matchToEdit.teamB.player2.id === targetPlayer.id) { matchToEdit.teamB.player2 = player; }
      matchToEdit[team][playerKey] = targetPlayer;
    } else {
      matchToEdit[team][playerKey] = targetPlayer;
    }

    // Check avoid conflict for the proposed 4 players on this court
    const courtPlayerIds = [
      matchToEdit.teamA.player1.id,
      matchToEdit.teamA.player2.id,
      matchToEdit.teamB.player1.id,
      matchToEdit.teamB.player2.id
    ];
    
    for (let i = 0; i < courtPlayerIds.length; i++) {
      for (let j = i + 1; j < courtPlayerIds.length; j++) {
        const idA = courtPlayerIds[i];
        const idB = courtPlayerIds[j];
        const isConflict = avoidPairs.some(
          ([p1, p2]) => (p1 === idA && p2 === idB) || (p1 === idB && p2 === idA)
        );
        if (isConflict) {
          const nameA = players.find(p => p.id === idA)?.name || '選手';
          const nameB = players.find(p => p.id === idB)?.name || '選手';
          alert(`無法完成換人：${nameA} 與 ${nameB} 設定為同場迴避（不能同場打球，搭檔或對戰皆不行）！`);
          return;
        }
      }
    }

    if (isFullScheduleMode) {
      let newHistory = fullSchedule.slice(0, matchIdx);
      newHistory.push(matchToEdit);
      
      for (let i = matchIdx + 1; i < fullSchedule.length; i++) {
         const nextMatchResult = generateNextMatch(
            players, newHistory, [], mixPartners, avoidGenderSkew, scheduleType, enableSkillLevel, fixedPairs, 1, [], skillMode, freeGender, avoidPairs
         );
         if (nextMatchResult.match) {
             nextMatchResult.match.sequence = i + 1;
             newHistory.push(nextMatchResult.match);
         } else {
             const remainder = fullSchedule.slice(i);
             newHistory = [...newHistory, ...remainder];
             break;
         }
      }
      useStore.getState().setFullSchedule(newHistory);
    } else {
      const newActive = [...activeMatches];
      newActive[matchIdx] = matchToEdit;
      useStore.getState().setActiveMatches(newActive);
    }
    
    setSwappingPlayer(null);
  };

  const renderSwapModal = () => {
    if (!swappingPlayer) return null;

    const { matchIdx, player } = swappingPlayer;
    const currentMatch = isFullScheduleMode ? fullSchedule[matchIdx] : activeMatches[matchIdx];
    if (!currentMatch) return null;

    let benchPlayers: Player[] = [];
    if (isFullScheduleMode) {
      const playingIds = new Set([
        currentMatch.teamA.player1.id,
        currentMatch.teamA.player2.id,
        currentMatch.teamB.player1.id,
        currentMatch.teamB.player2.id
      ]);
      benchPlayers = players.filter(p => !playingIds.has(p.id) && p.status !== 'SUSPENDED');
    } else {
      benchPlayers = waitingPlayers.map(wp => wp.player);
    }

    if (!freeGender) {
      if (scheduleType === MatchType.MENS_DOUBLES) benchPlayers = benchPlayers.filter(p => p.gender === Gender.MALE);
      if (scheduleType === MatchType.WOMENS_DOUBLES) benchPlayers = benchPlayers.filter(p => p.gender === Gender.FEMALE);
    }

    const otherPlayersInMatch = [
      currentMatch.teamA.player1,
      currentMatch.teamA.player2,
      currentMatch.teamB.player1,
      currentMatch.teamB.player2
    ].filter(p => p.id !== player.id);

    const storePlayer = players.find(p => p.id === player.id) || player;
    const isSuspended = storePlayer.status === 'SUSPENDED';

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                     換人: <PlayerCard player={storePlayer} size="sm" className="pointer-events-none" />
                  </h3>
                  <button
                    onClick={() => {
                      setEditingPlayer(storePlayer);
                      setSwappingPlayer(null);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-colors"
                    title="修改姓名與性別"
                  >
                    <Pencil size={12} strokeWidth={2.5} />
                    修改姓名/性別
                  </button>
                </div>
                <button onClick={() => setSwappingPlayer(null)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                  <X size={20} />
                </button>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <div>
                    <span className="font-bold text-slate-700 dark:text-slate-200 block text-sm">選手狀態</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{isSuspended ? '已臨時下場，將不參與後續賽程安排' : '目前為正常輪替狀態'}</p>
                 </div>
                 <button
                    onClick={() => {
                        togglePlayerStatus(player.id);
                        setSwappingPlayer(null);
                    }}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95 shrink-0 ${
                        isSuspended 
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400' 
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-400'
                    }`}
                 >
                    {isSuspended ? '恢復正常輪替' : '設為臨時下場'}
                 </button>
              </div>

              {/* Skill Level Adjustment Row */}
              <div className="px-6 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                 <div>
                    <span className="font-bold text-slate-700 dark:text-slate-200 block text-sm">等級 (Level) 調整</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">即時微調實力，自動同步後續對陣與排點</p>
                 </div>
                 <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/80 rounded-xl p-1 border border-slate-200 dark:border-slate-600 shrink-0">
                   <button
                     onClick={() => updatePlayerLevel(storePlayer.id, (storePlayer.level || 3) - 1)}
                     disabled={(storePlayer.level || 3) <= 1}
                     className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-200 disabled:opacity-30 transition-colors active:scale-95"
                     title="降低等級"
                   >
                     <Minus size={14} strokeWidth={3} />
                   </button>
                   <span className="font-black text-slate-800 dark:text-slate-100 min-w-[3ch] text-center text-sm">
                     Lv.{storePlayer.level || 3}
                   </span>
                   <button
                     onClick={() => updatePlayerLevel(storePlayer.id, (storePlayer.level || 3) + 1)}
                     disabled={(storePlayer.level || 3) >= 9}
                     className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-200 disabled:opacity-30 transition-colors active:scale-95"
                     title="提高等級"
                   >
                     <Plus size={14} strokeWidth={3} />
                   </button>
                 </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[50vh] space-y-6">
                <div>
                   <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase">與場上其他選手互換</h4>
                   <div className="flex flex-wrap gap-3">
                      {otherPlayersInMatch.map(p => (
                         <PlayerCard 
                           key={p.id} 
                           player={p} 
                           onClick={() => handleSwapConfirm(p)}
                           className="!border-amber-200"
                         />
                      ))}
                   </div>
                </div>

                <div>
                   <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase">與休息中選手替換</h4>
                   {benchPlayers.length > 0 ? (
                       <div className="flex flex-wrap gap-3">
                         {benchPlayers.map(p => {
                             const otherIds = new Set(otherPlayersInMatch.map(op => op.id));
                             const hasAvoidConflict = avoidPairs.some(
                               ([p1, p2]) => (p1 === p.id && otherIds.has(p2)) || (p2 === p.id && otherIds.has(p1))
                             );
                             return (
                               <div key={p.id} className="relative">
                                 <PlayerCard 
                                   player={p} 
                                   onClick={() => handleSwapConfirm(p)}
                                   className={hasAvoidConflict ? "!border-rose-400 opacity-60" : "!border-emerald-200"}
                                 />
                                 {hasAvoidConflict && (
                                   <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm pointer-events-none">
                                     迴避衝突
                                   </span>
                                 )}
                               </div>
                             );
                         })}
                       </div>
                   ) : (
                       <p className="text-sm text-slate-400">目前沒有符合條件的休息選手</p>
                   )}
                </div>
              </div>
            </motion.div>
        </div>
    );
  };

  const getPlayerMatchCount = (playerId: string) => {
    const allMatches = isFullScheduleMode 
      ? fullSchedule 
      : [...matchHistory, ...activeMatches.filter((m): m is ScheduleItem => m !== null)];
    return allMatches.reduce((count, match) => {
      const isPlaying = 
        match.teamA.player1.id === playerId || 
        match.teamA.player2.id === playerId || 
        match.teamB.player1.id === playerId || 
        match.teamB.player2.id === playerId;
      return count + (isPlaying ? 1 : 0);
    }, 0);
  };

  return (
    <div id="results-section">
      {hasMatches && (
        <section className="space-y-6">
           <div className="flex flex-col items-center justify-center gap-4 mb-6 w-full">
               <div className="flex items-center justify-center gap-4 w-full">
                   <div className="h-0.5 w-12 bg-emerald-200 dark:bg-emerald-800 rounded-full hidden sm:block"></div>
                   <h3 className="text-3xl font-black text-slate-800 dark:text-white capitalize tracking-tight flex items-center gap-2 italic">
                      <LayoutTemplate className="text-emerald-500" strokeWidth={2.5} size={28} /> 
                      賽程看板
                   </h3>
                   <div className="h-0.5 w-12 bg-emerald-200 dark:bg-emerald-800 rounded-full hidden sm:block"></div>
               </div>
               
               {/* All-in-one Function Dashboard (Zero horizontal scroll, fits all screens) */}
               <div className="w-full max-w-4xl mx-auto px-1 sm:px-0">
                 <div className="bg-slate-50/90 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-2 sm:p-3 border border-slate-200/90 dark:border-slate-700/80 shadow-xs space-y-2">
                   {/* Row 1: 4 Core Management & Analysis Tools (Equal 4-column grid) */}
                   <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
                     {/* 收費記錄 */}
                     <motion.button 
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.96 }}
                       onClick={() => setIsPaymentOpen(true)}
                       className="bg-amber-500 hover:bg-amber-600 text-white p-2 sm:py-2.5 sm:px-3 rounded-xl font-black shadow-xs transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center min-h-[46px] cursor-pointer"
                       title="臨打收費與會員管理"
                     >
                       <Wallet size={16} className="shrink-0 text-amber-100 sm:text-white" />
                       <span className="text-[11px] sm:text-xs tracking-tight">收費記錄</span>
                     </motion.button>

                     {/* 搭檔對戰 */}
                     <motion.button 
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.96 }}
                       onClick={() => setIsCombinationsOpen(true)}
                       className="bg-teal-600 hover:bg-teal-700 text-white p-2 sm:py-2.5 sm:px-3 rounded-xl font-black shadow-xs transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center min-h-[46px] cursor-pointer"
                       title="當次比賽對戰與搭檔組合表"
                     >
                       <Users size={16} className="shrink-0 text-teal-100 sm:text-white" />
                       <span className="text-[11px] sm:text-xs tracking-tight">搭檔對戰</span>
                     </motion.button>

                     {/* 等待分析 */}
                     <motion.button 
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.96 }}
                       onClick={() => {
                         setTargetWaitPlayerId(undefined);
                         setIsWaitAnalysisOpen(true);
                       }}
                       className="bg-blue-600 hover:bg-blue-700 text-white p-2 sm:py-2.5 sm:px-3 rounded-xl font-black shadow-xs transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center min-h-[46px] cursor-pointer"
                       title="選手下場等待場次分析"
                     >
                       <Clock size={16} className="shrink-0 text-blue-100 sm:text-white" />
                       <span className="text-[11px] sm:text-xs tracking-tight">等待分析</span>
                     </motion.button>

                     {/* 同場迴避 */}
                     <motion.button 
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.96 }}
                       onClick={() => setIsAvoidModalOpen(true)}
                       className="bg-rose-600 hover:bg-rose-700 text-white p-2 sm:py-2.5 sm:px-3 rounded-xl font-black shadow-xs transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center relative min-h-[46px] cursor-pointer"
                       title="設定不想一起打球的選手（同場迴避）"
                     >
                       <div className="relative">
                         <UserX size={16} className="shrink-0 text-rose-100 sm:text-white" />
                         {avoidPairs.length > 0 && (
                           <span className="sm:hidden absolute -top-1.5 -right-2.5 bg-white text-rose-700 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                             {avoidPairs.length}
                           </span>
                         )}
                       </div>
                       <div className="flex items-center gap-1">
                         <span className="text-[11px] sm:text-xs tracking-tight">同場迴避</span>
                         {avoidPairs.length > 0 && (
                           <span className="hidden sm:inline-block bg-white/25 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                             {avoidPairs.length}
                           </span>
                         )}
                       </div>
                     </motion.button>
                   </div>

                   {/* Row 2: 3 Board Display & Media Actions (Equal 3-column grid) */}
                   <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                     {/* 語音播報 */}
                     <motion.button 
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.96 }}
                       onClick={() => setAutoVoiceEnabled(!autoVoiceEnabled)}
                       className={`p-2 sm:py-2.5 sm:px-3 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 text-xs sm:text-xs shadow-xs min-h-[42px] border cursor-pointer ${
                         autoVoiceEnabled
                           ? "bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-800"
                           : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-650"
                       }`}
                       title="自動語音播報設定"
                     >
                       {autoVoiceEnabled ? (
                         <Volume2 size={16} className="text-pink-600 dark:text-pink-400 shrink-0" />
                       ) : (
                         <VolumeX size={16} className="text-slate-400 shrink-0" />
                       )}
                       <span className="tracking-tight">{autoVoiceEnabled ? "語音：開" : "語音：關"}</span>
                     </motion.button>

                     {/* 全螢幕展示 */}
                     <motion.button 
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.96 }}
                       onClick={toggleFullscreen}
                       className="bg-slate-800 hover:bg-slate-900 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 p-2 sm:py-2.5 sm:px-3 rounded-xl font-black shadow-xs transition-all flex items-center justify-center gap-1.5 text-xs sm:text-xs min-h-[42px] cursor-pointer"
                       title="切換為大螢幕全螢幕看板展示"
                     >
                       <Maximize size={15} className="shrink-0" />
                       <span className="tracking-tight">全螢幕展示</span>
                     </motion.button>

                     {/* 儲存圖片 */}
                     <motion.button 
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.96 }}
                       onClick={handleExport}
                       className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-700 p-2 sm:py-2.5 sm:px-3 rounded-xl font-black shadow-xs transition-all flex items-center justify-center gap-1.5 text-xs sm:text-xs min-h-[42px] cursor-pointer"
                       title="將賽程與看板儲存為完整長圖"
                     >
                       <Download size={15} className="shrink-0 text-slate-500 dark:text-slate-300" />
                       <span className="tracking-tight">儲存圖片</span>
                     </motion.button>
                   </div>
                 </div>
               </div>
           </div>

           <div className="rounded-[2rem] bg-white dark:bg-slate-800 shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden relative">
               {/* Capture Area */}
               <div ref={scheduleRef} className="bg-white dark:bg-slate-900 pb-10 transition-colors duration-300 relative z-10 w-full">
                  
                  {/* Premium Export Header */}
                  <div className="flex flex-col items-center justify-center mb-8 pt-10 text-center relative overflow-hidden bg-emerald-500 text-white rounded-b-[3rem] pb-10 shadow-inner">
                      <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDhMODAwWm04IDBMMCAwWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3N2Zz4=')] mix-blend-overlay"></div>
                      <h2 className="text-4xl font-black tracking-tight mb-2 italic">菜雞互啄分隊趣</h2>
                      <div className="font-bold bg-white/20 px-5 py-1.5 rounded-full text-sm backdrop-blur-md">
                          {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })} • {isFullScheduleMode ? '賽程總表' : '即時賽事'}
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 lg:px-8 max-w-5xl mx-auto">
                    {displayMatches.map((match, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={match ? match.id : `empty-${idx}`} 
                        className="bg-white dark:bg-slate-800 rounded-[1.5rem] p-4 shadow-lg border-2 border-slate-100 dark:border-slate-700 relative overflow-hidden group flex flex-col"
                      >
                         <div className="flex items-center gap-4 mb-3">
                           {/* Court Badge */}
                           <div className="bg-gradient-to-b from-slate-800 to-slate-900 text-white w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black shrink-0 shadow-md leading-none transform -rotate-2">
                             {match ? (
                               <>
                                 <span className="text-[9px] text-emerald-400 font-bold uppercase mb-0.5 tracking-widest">{isFullScheduleMode ? 'SEQ' : 'CRT'}</span>
                                 <span className="text-xl">{isFullScheduleMode ? idx + 1 : courtNames[idx]}</span>
                               </>
                             ) : (
                               <>
                                 <span className="text-[9px] text-slate-400 font-bold uppercase mb-0.5 tracking-widest">CRT</span>
                                 <span className="text-xl">{courtNames[idx]}</span>
                               </>
                             )}
                           </div>

                           <div className="flex-1">
                             <div className="flex justify-between items-start">
                               <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Arena status</span>
                               {match && shouldShowMatchMessage(match.message) && (
                                 <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase">
                                   {match.message}
                                 </span>
                               )}
                             </div>
                             <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                               {match ? '進行中 Match Active' : '等待分配 Waiting...'}
                             </div>
                           </div>

                           {match && (
                             <button
                               onClick={() => handleSpeak(match, isFullScheduleMode ? idx + 1 : undefined)}
                               data-html2canvas-ignore="true"
                               className="p-2.5 text-slate-400 hover:text-emerald-500 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-colors z-20 shadow-sm"
                             >
                               <Volume2 size={16} />
                             </button>
                           )}
                         </div>

                         {/* Court Visual Playground */}
                         <div className="relative w-full aspect-[2.2/1] bg-emerald-500 rounded-xl border-[3px] border-emerald-600 dark:border-emerald-700 shadow-inner overflow-hidden mb-4">
                           {/* Badminton Court Lines */}
                           <div className="absolute inset-1 border-[2px] border-white/60"></div>
                           <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-white -translate-x-1/2 z-10 shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                           {/* Service Zones */}
                           <div className="absolute top-[10%] bottom-[10%] left-1/2 w-[15%] border-y-[2px] border-r-[2px] border-white/40"></div>
                           <div className="absolute top-[10%] bottom-[10%] right-1/2 w-[15%] border-y-[2px] border-l-[2px] border-white/40"></div>
                           {/* Center Line for Doubles */}
                           <div className="absolute top-1/2 bottom-[10%] left-[10%] right-[50%] border-t-[2px] border-white/40"></div>
                           <div className="absolute top-1/2 bottom-[10%] left-[50%] right-[10%] border-t-[2px] border-white/40"></div>

                           {match ? (
                             <>
                               {/* Team A */}
                               <div className="absolute top-1/4 left-[22%] -translate-x-1/2 -translate-y-1/2 z-20">
                                 <CourtPlayerBadge player={match.teamA.player1} onClick={() => setSwappingPlayer({ matchIdx: idx, team: 'teamA', playerKey: 'player1', player: match.teamA.player1 })} onEdit={() => setEditingPlayer(match.teamA.player1)} />
                               </div>
                               <div className="absolute top-3/4 left-[22%] -translate-x-1/2 -translate-y-1/2 z-20">
                                 <CourtPlayerBadge player={match.teamA.player2} onClick={() => setSwappingPlayer({ matchIdx: idx, team: 'teamA', playerKey: 'player2', player: match.teamA.player2 })} onEdit={() => setEditingPlayer(match.teamA.player2)} />
                               </div>
                               {/* Team B */}
                               <div className="absolute top-1/4 left-[78%] -translate-x-1/2 -translate-y-1/2 z-20">
                                 <CourtPlayerBadge player={match.teamB.player1} onClick={() => setSwappingPlayer({ matchIdx: idx, team: 'teamB', playerKey: 'player1', player: match.teamB.player1 })} onEdit={() => setEditingPlayer(match.teamB.player1)} />
                               </div>
                               <div className="absolute top-3/4 left-[78%] -translate-x-1/2 -translate-y-1/2 z-20">
                                 <CourtPlayerBadge player={match.teamB.player2} onClick={() => setSwappingPlayer({ matchIdx: idx, team: 'teamB', playerKey: 'player2', player: match.teamB.player2 })} onEdit={() => setEditingPlayer(match.teamB.player2)} />
                               </div>
                               
                             </>
                           ) : (
                             <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/20">
                               <span className="text-white/60 font-black text-xl italic tracking-widest drop-shadow-md">N/A</span>
                             </div>
                           )}
                         </div>
                         
                         {/* End Match Button */}
                         {!isFullScheduleMode && (
                             <div className="mt-auto flex justify-center gap-2" data-html2canvas-ignore="true">
                                <motion.button
                                   whileHover={{ scale: 1.02 }}
                                   whileTap={{ scale: 0.98 }}
                                   onClick={() => handleEndMatch(idx)}
                                   className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors shadow-sm ${
                                       match 
                                       ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200' 
                                       : 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-emerald-500/30'
                                   }`}
                                >
                                   {match ? '換下一組' : '開始安排'}
                                </motion.button>
                                {matchHistory.some(m => m.court === idx + 1) && (
                                   <motion.button
                                     whileHover={{ scale: 1.05 }}
                                     whileTap={{ scale: 0.95 }}
                                     onClick={() => undoMatch(idx)}
                                     title="還原上一場"
                                     className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-500 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center shrink-0"
                                   >
                                      <RotateCw size={18} className="-scale-x-100" />
                                   </motion.button>
                                )}
                             </div>
                         )}
                      </motion.div>
                    ))}
                  </div>

                  {/* Waiting Players & Stats Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 lg:px-8 max-w-5xl mx-auto mt-12">
                    {/* Waiting Players */}
                    {waitingPlayers.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700" data-html2canvas-ignore="true">
                        <h4 className="text-emerald-600 dark:text-emerald-400 font-black mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                           <Users size={16} /> 休息選手 / Bench ({waitingPlayers.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {waitingPlayers.map(p => (
                            <PlayerCard 
                              key={p.player.id} 
                              player={p.player} 
                              restCount={p.restCount}
                              onStatusToggle={togglePlayerStatus}
                              onEdit={(p) => setEditingPlayer(p)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className={`${waitingPlayers.length === 0 ? 'lg:col-span-2' : ''} bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700`}>
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h4 className="text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-2 uppercase tracking-wide text-sm">
                           <BarChart3 size={16} /> 出賽統計 / Stats
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setIsCombinationsOpen(true)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <Users size={12} />
                            <span>搭檔對戰表</span>
                          </button>
                          <button
                            onClick={() => {
                              setTargetWaitPlayerId(undefined);
                              setIsWaitAnalysisOpen(true);
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <Clock size={12} />
                            <span>等待分析</span>
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                         {players.filter(p => {
                             if (scheduleType === MatchType.MENS_DOUBLES) return p.gender === Gender.MALE;
                             if (scheduleType === MatchType.WOMENS_DOUBLES) return p.gender === Gender.FEMALE;
                             return true;
                         }).map(p => (
                           <div key={p.id} onClick={() => setEditingPlayer(p)} title="點擊修改姓名與性別" className="flex items-center justify-between gap-2 bg-white dark:bg-slate-700 p-2.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500 transition-all group">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">{p.name}</span>
                                <Pencil size={11} className="opacity-0 group-hover:opacity-100 text-slate-400 shrink-0" />
                              </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTargetWaitPlayerId(p.id);
                                    setIsWaitAnalysisOpen(true);
                                  }}
                                  title={`查看【${p.name}】下場等待場次分析`}
                                  className="p-1 text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition-colors"
                                >
                                  <Clock size={12} />
                                </button>
                              <span className={`shrink-0 text-xs font-black min-w-6 text-center py-0.5 rounded-md ${getPlayerMatchCount(p.id) === 0 ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'}`}>
                                 {getPlayerMatchCount(p.id)}
                              </span>
                           </div>
                         ))}
                      </div>
                    </div>
                  </div>

                  {/* History List */}
                  {!isFullScheduleMode && matchHistory.length > 0 && (
                     <div className="px-6 lg:px-8 max-w-5xl mx-auto mt-12" data-html2canvas-ignore="true">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                          <h4 className="text-slate-600 dark:text-slate-400 font-black mb-6 flex items-center gap-2 uppercase tracking-wide text-sm">
                             <Calendar size={16} /> 歷史賽程紀錄 / History
                          </h4>
                          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                             {[...matchHistory].reverse().map((match, i) => (
                               <div key={match.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white dark:bg-slate-700 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 shadow-sm">
                                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                     <span className="text-xs font-black text-white bg-slate-800 px-2 py-1 rounded">第 {match.court} 場地</span>
                                     <span className="text-xs font-bold text-slate-400">{new Date(match.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  </div>
                                  <div className="flex-1 flex items-center justify-between sm:justify-start gap-4">
                                     <div className="flex-1 text-right">
                                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{match.teamA.player1.name} &amp; {match.teamA.player2.name}</span>
                                     </div>
                                     <span className="text-xs font-black text-slate-300 dark:text-slate-500">VS</span>
                                     <div className="flex-1 text-left">
                                        <span className="text-sm font-bold text-pink-600 dark:text-pink-400">{match.teamB.player1.name} &amp; {match.teamB.player2.name}</span>
                                     </div>
                                  </div>
                               </div>
                             ))}
                          </div>
                        </div>
                     </div>
                  )}

                  {/* Export Footer */}
                  <div className="mt-12 text-center text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase text-xs">
                     Generated by Match Maker
                  </div>
              </div>
           </div>
        </section>
      )}

      {/* Empty State */}
      {!hasMatches && !errorMsg && (
         <div className="flex flex-col items-center justify-center py-20 opacity-60">
           <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <ArrowRight size={40} className="text-slate-300 dark:text-slate-600 rotate-90 md:rotate-0" />
           </div>
           <h3 className="text-xl font-black text-slate-700 dark:text-slate-300">裝備就緒</h3>
           <p className="text-slate-500 font-bold mt-1">選定上場人數與場地後即可開賽</p>
         </div>
      )}

      {/* Fullscreen Overlay */}
      <AnimatePresence>
      {isFullscreen && hasMatches && (
        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[100] bg-slate-900 flex flex-col h-screen overflow-hidden overscroll-none"
        >
          {/* Fullscreen Header */}
          <div className="bg-slate-900 border-b border-slate-800 p-4 sm:px-8 flex items-center justify-between shrink-0">
            <h3 className="text-white font-black text-xl flex items-center gap-2 italic">
              <LayoutTemplate className="text-emerald-500" /> ARENA STATUS
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLandscape(!isLandscape)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors border border-slate-700"
              >
                <RotateCw size={16} />
                <span className="hidden sm:inline">{isLandscape ? '標準列距' : '舒適列距'}</span>
              </button>
              <button
                onClick={toggleFullscreen}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-emerald-500/20 shadow-lg"
              >
                <Minimize size={16} />
                <span className="hidden sm:inline">結束展演模式</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center bg-slate-950">
            <div className={`w-full ${isLandscape ? `grid ${getLandscapeColsClass(displayMatches.length)} gap-4 sm:gap-6` : 'flex flex-col gap-6 max-w-4xl'}`}>
                {displayMatches.map((match, idx) => (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    key={match ? match.id : `fs-empty-${idx}`} 
                    className="bg-slate-900 rounded-[2rem] p-6 shadow-2xl border border-slate-800 relative overflow-hidden flex flex-col w-full"
                  >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-500 text-white w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-lg leading-none transform -rotate-3">
                        <span className="text-[10px] text-emerald-100 uppercase mb-0.5 tracking-widest">{isFullScheduleMode ? 'SEQ' : 'CRT'}</span>
                        <span className="text-2xl">{isFullScheduleMode ? idx + 1 : courtNames[idx]}</span>
                      </div>
                      {match && shouldShowMatchMessage(match.message) && (
                        <div className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider">
                          {match.message}
                        </div>
                      )}
                    </div>
                    {match && (
                      <button
                        onClick={() => handleSpeak(match, isFullScheduleMode ? idx + 1 : undefined)}
                        className="p-4 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-white rounded-2xl transition-all shadow-inner"
                      >
                        <Volume2 size={24} />
                      </button>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="relative w-full aspect-[2.2/1] bg-emerald-600 rounded-2xl border-4 border-slate-800 shadow-inner overflow-hidden">
                      <div className="absolute inset-1 border-[2px] border-white/40"></div>
                      <div className="absolute top-0 bottom-0 left-1/2 w-[2px] bg-white -translate-x-1/2 shadow-[0_0_15px_rgba(255,255,255,0.8)]"></div>
                      <div className="absolute top-[10%] bottom-[10%] left-1/2 w-[15%] border-y-[2px] border-r-[2px] border-white/30"></div>
                      <div className="absolute top-[10%] bottom-[10%] right-1/2 w-[15%] border-y-[2px] border-l-[2px] border-white/30"></div>
                      <div className="absolute top-1/2 bottom-[10%] left-[10%] right-[50%] border-t-[2px] border-white/30"></div>
                      <div className="absolute top-1/2 bottom-[10%] left-[50%] right-[10%] border-t-[2px] border-white/30"></div>

                      {match ? (
                        <>
                          <div className={`absolute top-1/4 left-[22%] -translate-x-1/2 -translate-y-1/2 z-20 ${isLandscape ? getBadgeScaleClass(displayMatches.length) : 'scale-125'}`}>
                            <CourtPlayerBadge player={match.teamA.player1} onClick={() => setSwappingPlayer({ matchIdx: idx, team: 'teamA', playerKey: 'player1', player: match.teamA.player1 })} onEdit={() => setEditingPlayer(match.teamA.player1)} />
                          </div>
                          <div className={`absolute top-3/4 left-[22%] -translate-x-1/2 -translate-y-1/2 z-20 ${isLandscape ? getBadgeScaleClass(displayMatches.length) : 'scale-125'}`}>
                            <CourtPlayerBadge player={match.teamA.player2} onClick={() => setSwappingPlayer({ matchIdx: idx, team: 'teamA', playerKey: 'player2', player: match.teamA.player2 })} onEdit={() => setEditingPlayer(match.teamA.player2)} />
                          </div>
                          <div className={`absolute top-1/4 left-[78%] -translate-x-1/2 -translate-y-1/2 z-20 ${isLandscape ? getBadgeScaleClass(displayMatches.length) : 'scale-125'}`}>
                            <CourtPlayerBadge player={match.teamB.player1} onClick={() => setSwappingPlayer({ matchIdx: idx, team: 'teamB', playerKey: 'player1', player: match.teamB.player1 })} onEdit={() => setEditingPlayer(match.teamB.player1)} />
                          </div>
                          <div className={`absolute top-3/4 left-[78%] -translate-x-1/2 -translate-y-1/2 z-20 ${isLandscape ? getBadgeScaleClass(displayMatches.length) : 'scale-125'}`}>
                            <CourtPlayerBadge player={match.teamB.player2} onClick={() => setSwappingPlayer({ matchIdx: idx, team: 'teamB', playerKey: 'player2', player: match.teamB.player2 })} onEdit={() => setEditingPlayer(match.teamB.player2)} />
                          </div>
                          
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center z-20">
                          <span className="text-slate-900/40 font-black text-4xl tracking-widest italic">WAITING</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* End Match Button (Fullscreen) */}
                  {!isFullScheduleMode && (
                      <div className="mt-6 flex justify-center gap-2">
                         <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleEndMatch(idx)}
                            className={`flex-1 py-4 rounded-xl font-black text-lg transition-colors shadow-lg ${
                                match 
                                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' 
                                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20'
                            }`}
                         >
                            {match ? '換下一組' : '開始安排'}
                         </motion.button>
                         {matchHistory.some(m => m.court === idx + 1) && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => undoMatch(idx)}
                              title="還原上一場"
                              className="px-5 py-4 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center border border-red-800/50 shrink-0"
                            >
                               <RotateCw size={22} className="-scale-x-100" />
                            </motion.button>
                         )}
                      </div>
                  )}
                  </motion.div>
                ))}
            </div>
            
            {/* Waiting Players */}
            {waitingPlayers.length > 0 && (
              <div className="w-full max-w-screen-2xl mt-12 bg-slate-900 p-8 rounded-3xl border border-slate-800">
                <h4 className="text-slate-400 font-black mb-6 flex items-center gap-2 text-lg tracking-widest uppercase">
                  <Users size={20} className="text-slate-500" /> Bench Players
                </h4>
                <div className="flex flex-wrap gap-4">
                  {waitingPlayers.map(p => (
                    <PlayerCard 
                      key={p.player.id} 
                      player={p.player} 
                      restCount={p.restCount}
                      onStatusToggle={togglePlayerStatus}
                      onEdit={(p) => setEditingPlayer(p)}
                      size="lg"
                      className="border-slate-700 bg-slate-800 text-slate-200"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      {renderSwapModal()}
      <PaymentManagerModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
      />
      <MatchCombinationsModal
        isOpen={isCombinationsOpen}
        onClose={() => setIsCombinationsOpen(false)}
      />
      <PlayerWaitAnalysisModal
        isOpen={isWaitAnalysisOpen}
        onClose={() => setIsWaitAnalysisOpen(false)}
        initialPlayerId={targetWaitPlayerId}
      />
      <AvoidPlayersModal
        isOpen={isAvoidModalOpen}
        onClose={() => setIsAvoidModalOpen(false)}
      />
      <EditPlayerModal
        isOpen={!!editingPlayer}
        player={editingPlayer}
        onClose={() => setEditingPlayer(null)}
      />
    </div>
  );
};

export default MatchResults;
