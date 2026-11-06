import React, { useState, useMemo, useRef } from 'react';
import { X, Clock, User, Zap, CheckCircle2, AlertCircle, BarChart3, Flame, Coffee, ShieldCheck, Layers, Hash, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useStore } from '../store/useStore';
import { ScheduleItem, Player, Gender } from '../types';
import { groupMatchesIntoRounds } from '../services/matchService';

interface PlayerWaitAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlayerId?: string;
}

export const PlayerWaitAnalysisModal: React.FC<PlayerWaitAnalysisModalProps> = ({
  isOpen,
  onClose,
  initialPlayerId,
}) => {
  const { players, matchHistory, activeMatches, courtNames, clubs, currentClubId } = useStore();
  const currentClub = clubs.find(c => c.id === currentClubId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  // Mode: 'rounds' (依換場輪次計算，推薦多場地) | 'matches' (依單場流水號計算)
  const [calcMode, setCalcMode] = useState<'rounds' | 'matches'>('rounds');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportTarget, setExportTarget] = useState<'all' | 'table' | 'player'>('all');

  const exportAllContainerRef = useRef<HTMLDivElement>(null);
  const exportTableContainerRef = useRef<HTMLDivElement>(null);
  const exportPlayerContainerRef = useRef<HTMLDivElement>(null);

  // Active courts count (e.g., 3 courts)
  const activeCourtsCount = Math.max(activeMatches.length, 1);

  // Combined chronological match list (1-indexed sequence)
  const chronologicalMatches = useMemo(() => {
    const list: ScheduleItem[] = [...matchHistory];
    activeMatches.forEach(m => {
      if (m && !list.some(existing => existing.id === m.id)) {
        list.push(m);
      }
    });

    // Sort by sequence or timestamp
    return list.sort((a, b) => {
      if (a.sequence && b.sequence) return a.sequence - b.sequence;
      return a.timestamp - b.timestamp;
    });
  }, [matchHistory, activeMatches]);

  // Group chronological matches into rounds (換場波次)
  const sessionRounds = useMemo(() => {
    return groupMatchesIntoRounds(chronologicalMatches, activeCourtsCount);
  }, [chronologicalMatches, activeCourtsCount]);

  // Map each match to its roundIndex (1-based)
  const matchRoundMap = useMemo(() => {
    const map = new Map<string, number>();
    sessionRounds.forEach((roundMatches, roundIdx) => {
      roundMatches.forEach(m => {
        map.set(m.id, roundIdx + 1);
      });
    });
    return map;
  }, [sessionRounds]);

  // Set initial selected player
  React.useEffect(() => {
    if (isOpen) {
      if (initialPlayerId && players.some(p => p.id === initialPlayerId)) {
        setSelectedPlayerId(initialPlayerId);
      } else if (players.length > 0 && !selectedPlayerId) {
        setSelectedPlayerId(players[0].id);
      }
    }
  }, [isOpen, initialPlayerId, players]);

  const selectedPlayer = players.find(p => p.id === selectedPlayerId) || players[0];

  // Helper to check if player played in a match
  const isPlayerInMatch = (match: ScheduleItem, playerId: string, playerName: string) => {
    return (
      match.teamA.player1.id === playerId || match.teamA.player1.name === playerName ||
      match.teamA.player2.id === playerId || match.teamA.player2.name === playerName ||
      match.teamB.player1.id === playerId || match.teamB.player1.name === playerName ||
      match.teamB.player2.id === playerId || match.teamB.player2.name === playerName
    );
  };

  // Compute wait analysis for selected player
  const playerWaitDetails = useMemo(() => {
    if (!selectedPlayer) return null;

    const matchesPlayed: Array<{
      match: ScheduleItem;
      globalIndex: number; // 1-based index among all session matches
      roundIndex: number;  // 1-based round (換場輪次)
      courtDisplay: string;
      role: 'teamA' | 'teamB';
      partnerName: string;
      opponentsNames: string[];
    }> = [];

    chronologicalMatches.forEach((m, idx) => {
      const matchNumber = idx + 1;
      const inTeamA = (
        m.teamA.player1.id === selectedPlayer.id || m.teamA.player1.name === selectedPlayer.name ||
        m.teamA.player2.id === selectedPlayer.id || m.teamA.player2.name === selectedPlayer.name
      );
      const inTeamB = (
        m.teamB.player1.id === selectedPlayer.id || m.teamB.player1.name === selectedPlayer.name ||
        m.teamB.player2.id === selectedPlayer.id || m.teamB.player2.name === selectedPlayer.name
      );

      if (inTeamA || inTeamB) {
        const partnerName = inTeamA
          ? (m.teamA.player1.name === selectedPlayer.name ? m.teamA.player2.name : m.teamA.player1.name)
          : (m.teamB.player1.name === selectedPlayer.name ? m.teamB.player2.name : m.teamB.player1.name);

        const opponentsNames = inTeamA
          ? [m.teamB.player1.name, m.teamB.player2.name]
          : [m.teamA.player1.name, m.teamA.player2.name];

        const courtNum = m.court || 1;
        const courtDisplay = courtNames[courtNum - 1] ? `第 ${courtNames[courtNum - 1]} 場地` : `場地 ${courtNum}`;
        const roundNum = matchRoundMap.get(m.id) || 1;

        matchesPlayed.push({
          match: m,
          globalIndex: matchNumber,
          roundIndex: roundNum,
          courtDisplay,
          role: inTeamA ? 'teamA' : 'teamB',
          partnerName,
          opponentsNames,
        });
      }
    });

    // Calculate wait intervals between consecutive appearances:
    // User constraint: "需注意當次下場換上場的人，不算1次喔"
    // In rounds mode:
    // If player played in Round R_curr, and next in Round R_next:
    // Waited rounds = (R_next - R_curr) - 1.
    // If R_next == R_curr + 1, waitedRounds = 0 (連續上場，不算 1 次等待).
    // In matches mode:
    // Waited matches = (M_next - M_curr) - 1.
    const intervals: Array<{
      fromMatchNumber: number;
      toMatchNumber: number;
      fromRoundNumber: number;
      toRoundNumber: number;
      waitedRounds: number;
      waitedMatches: number;
      missedMatchIndices: number[];
      isConsecutiveRounds: boolean;
      isConsecutiveMatches: boolean;
    }> = [];

    for (let i = 0; i < matchesPlayed.length - 1; i++) {
      const curr = matchesPlayed[i];
      const next = matchesPlayed[i + 1];
      const waitedR = Math.max(0, (next.roundIndex - curr.roundIndex) - 1);
      const waitedM = Math.max(0, (next.globalIndex - curr.globalIndex) - 1);

      const missed: number[] = [];
      for (let m = curr.globalIndex + 1; m < next.globalIndex; m++) {
        missed.push(m);
      }

      intervals.push({
        fromMatchNumber: curr.globalIndex,
        toMatchNumber: next.globalIndex,
        fromRoundNumber: curr.roundIndex,
        toRoundNumber: next.roundIndex,
        waitedRounds: waitedR,
        waitedMatches: waitedM,
        missedMatchIndices: missed,
        isConsecutiveRounds: waitedR === 0,
        isConsecutiveMatches: waitedM === 0,
      });
    }

    // Current status after last match played
    const totalMatchesCount = chronologicalMatches.length;
    const totalRoundsCount = sessionRounds.length;
    let currentlyWaitingSinceRounds = 0;
    let currentlyWaitingSinceMatches = 0;
    let currentlyWaitingMatches: number[] = [];

    if (matchesPlayed.length > 0) {
      const lastPlay = matchesPlayed[matchesPlayed.length - 1];
      currentlyWaitingSinceRounds = Math.max(0, totalRoundsCount - lastPlay.roundIndex);
      currentlyWaitingSinceMatches = Math.max(0, totalMatchesCount - lastPlay.globalIndex);
      for (let m = lastPlay.globalIndex + 1; m <= totalMatchesCount; m++) {
        currentlyWaitingMatches.push(m);
      }
    }

    // Statistics for Rounds mode
    const waitCountsRounds = intervals.map(int => int.waitedRounds);
    const totalWaitedRounds = waitCountsRounds.reduce((acc, v) => acc + v, 0);
    const avgWaitRounds = intervals.length > 0 ? (totalWaitedRounds / intervals.length).toFixed(1) : '0';
    const maxWaitRounds = waitCountsRounds.length > 0 ? Math.max(...waitCountsRounds) : 0;
    const consecutiveCountRounds = intervals.filter(int => int.isConsecutiveRounds).length;

    // Statistics for Matches mode
    const waitCountsMatches = intervals.map(int => int.waitedMatches);
    const totalWaitedMatches = waitCountsMatches.reduce((acc, v) => acc + v, 0);
    const avgWaitMatches = intervals.length > 0 ? (totalWaitedMatches / intervals.length).toFixed(1) : '0';
    const maxWaitMatches = waitCountsMatches.length > 0 ? Math.max(...waitCountsMatches) : 0;
    const consecutiveCountMatches = intervals.filter(int => int.isConsecutiveMatches).length;

    return {
      matchesPlayed,
      intervals,
      totalMatchesPlayed: matchesPlayed.length,
      // Rounds
      avgWaitRounds,
      maxWaitRounds,
      consecutiveCountRounds,
      currentlyWaitingSinceRounds,
      // Matches
      avgWaitMatches,
      maxWaitMatches,
      consecutiveCountMatches,
      currentlyWaitingSinceMatches,
      currentlyWaitingMatches,
    };
  }, [selectedPlayer, chronologicalMatches, sessionRounds, matchRoundMap, courtNames]);

  // Overall player ranking by wait time (for quick comparison)
  const allPlayersWaitOverview = useMemo(() => {
    return players.map(p => {
      let appearances = 0;
      let prevMatchIdx = -1;
      let prevRoundIdx = -1;
      const intervalsListMatches: number[] = [];
      const intervalsListRounds: number[] = [];
      let consecutiveMatchesCount = 0;
      let consecutiveRoundsCount = 0;

      chronologicalMatches.forEach((m, idx) => {
        if (isPlayerInMatch(m, p.id, p.name)) {
          appearances++;
          const roundIdx = matchRoundMap.get(m.id) || 1;

          if (prevMatchIdx !== -1) {
            const waitedM = Math.max(0, (idx - prevMatchIdx) - 1);
            intervalsListMatches.push(waitedM);
            if (waitedM === 0) consecutiveMatchesCount++;
          }
          if (prevRoundIdx !== -1) {
            const waitedR = Math.max(0, (roundIdx - prevRoundIdx) - 1);
            intervalsListRounds.push(waitedR);
            if (waitedR === 0) consecutiveRoundsCount++;
          }

          prevMatchIdx = idx;
          prevRoundIdx = roundIdx;
        }
      });

      const avgMatches = intervalsListMatches.length > 0 
        ? (intervalsListMatches.reduce((a, b) => a + b, 0) / intervalsListMatches.length).toFixed(1) 
        : '0';
      const maxMatches = intervalsListMatches.length > 0 ? Math.max(...intervalsListMatches) : 0;
      const currentWaitMatches = prevMatchIdx !== -1 ? (chronologicalMatches.length - 1) - prevMatchIdx : chronologicalMatches.length;

      const avgRounds = intervalsListRounds.length > 0 
        ? (intervalsListRounds.reduce((a, b) => a + b, 0) / intervalsListRounds.length).toFixed(1) 
        : '0';
      const maxRounds = intervalsListRounds.length > 0 ? Math.max(...intervalsListRounds) : 0;
      const currentWaitRounds = prevRoundIdx !== -1 ? Math.max(0, sessionRounds.length - prevRoundIdx) : sessionRounds.length;

      return {
        id: p.id,
        name: p.name,
        gender: p.gender,
        appearances,
        // Rounds
        avgWaitRounds: avgRounds,
        maxWaitRounds: maxRounds,
        consecutiveRoundsCount,
        currentWaitRounds,
        // Matches
        avgWaitMatches: avgMatches,
        maxWaitMatches: maxMatches,
        consecutiveMatchesCount,
        currentWaitMatches,
      };
    }).sort((a, b) => b.appearances - a.appearances);
  }, [players, chronologicalMatches, sessionRounds, matchRoundMap]);

  const handleDownloadChart = async (target: 'all' | 'table' | 'player' = 'all') => {
    let el: HTMLElement | null = null;
    let filenamePrefix = '全隊與個人等待場次分析全報表';

    if (target === 'table') {
      el = exportTableContainerRef.current;
      filenamePrefix = '全隊等待場次輪次公平性總表';
    } else if (target === 'player') {
      el = exportPlayerContainerRef.current;
      filenamePrefix = `${selectedPlayer?.name || '選手'}-等待歷程分析`;
    } else {
      el = exportAllContainerRef.current;
      filenamePrefix = `選手下場等待場次分析全報表-${selectedPlayer?.name || '全隊'}`;
    }

    if (!el) return;

    setIsExporting(true);
    setExportTarget(target);

    try {
      // Small pause so DOM rendering is settled
      await new Promise(r => setTimeout(r, 120));

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: 1080,
        windowWidth: 1080,
      });

      const clubPrefix = currentClub?.name ? `${currentClub.name}-` : '';
      const dateStr = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.download = `${clubPrefix}${filenamePrefix}-${dateStr}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Download wait chart failed:', error);
      alert('圖表下載失敗，請稍後再試');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const isRoundsMode = calcMode === 'rounds';
  const unit = isRoundsMode ? '輪' : '場';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-500 p-4 sm:p-5 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Clock size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-lg sm:text-xl tracking-tight leading-tight">
                  選手下場等待場次分析
                </h2>
                {activeCourtsCount > 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider">
                    {activeCourtsCount} 面場地並行
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                追蹤每位選手每次下場後等待幾輪才上場 · 嚴格落實「休息二場/輪者第三場/輪必上」
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/20 rounded-xl p-0.5 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => handleDownloadChart('all')}
                disabled={isExporting || chronologicalMatches.length === 0}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 hover:bg-white/25 transition-all active:scale-95 disabled:opacity-40"
                title="下載完整分析報告（含全隊總表與個人歷程，無裁切）"
              >
                {isExporting && exportTarget === 'all' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                <span className="whitespace-nowrap font-black">下載完整圖表</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadChart('table')}
                disabled={isExporting || chronologicalMatches.length === 0}
                className="hidden sm:flex px-2.5 py-1.5 rounded-lg text-white/90 font-bold text-xs items-center gap-1 hover:bg-white/25 transition-all active:scale-95 disabled:opacity-40"
                title="僅下載全隊等待總表圖"
              >
                <BarChart3 size={13} />
                <span>總表圖</span>
              </button>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
              title="關閉"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Calculation Mode Toggle & Explanation */}
        <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-1 shrink-0">
              計算單位：
            </span>
            <div className="inline-flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <button
                type="button"
                onClick={() => setCalcMode('rounds')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                  isRoundsMode 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Layers size={13} />
                依換場輪次 (推薦)
              </button>
              <button
                type="button"
                onClick={() => setCalcMode('matches')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                  !isRoundsMode 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Hash size={13} />
                依單場流水號
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>
              {isRoundsMode 
                ? `目前 ${activeCourtsCount} 面場地：打完一波算 1 輪 (休息最多 2 輪必上)`
                : `每面場地的單場編號累加計算 (休 1 輪約進行 ${activeCourtsCount} 場)`}
            </span>
          </div>
        </div>

        {/* Player Selector Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 shrink-0 uppercase tracking-wider flex items-center gap-1">
            <User size={14} /> 選擇選手：
          </span>
          <div className="flex items-center gap-1.5 flex-nowrap">
            {players.map(p => {
              const isSelected = p.id === selectedPlayerId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayerId(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.gender === Gender.MALE ? 'bg-blue-400' : 'bg-pink-400'}`} />
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-6 bg-white dark:bg-slate-900">
          
          {chronologicalMatches.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 p-8">
              <Clock size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="font-black text-slate-700 dark:text-slate-300 text-base">目前尚無排點比賽紀錄</h3>
              <p className="text-xs text-slate-400 mt-1">產生並開始比賽後，即可在此即時查詢每位選手每次下場後等待了幾場/幾輪。</p>
            </div>
          ) : !selectedPlayer || !playerWaitDetails ? (
            <div className="text-center py-12 text-slate-400 font-bold">請先加入或選擇選手</div>
          ) : (
            <>
              {/* Export-Ready Header */}
              <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-blue-200 uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={14} />
                    {currentClub?.name || '羽球球隊'} · 等待場次分析報告
                  </div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                    選手下場等待次數與輪次分析圖表
                  </h3>
                </div>
                <div className="text-left sm:text-right text-xs text-blue-100/90 font-medium space-y-0.5">
                  <div>計算單位：<span className="font-bold text-white">{isRoundsMode ? '依換場輪次 (打完一波算1輪)' : '依單場流水號'}</span></div>
                  <div>全場比賽：<span className="font-bold text-white">{chronologicalMatches.length} 場</span> · 場地數：<span className="font-bold text-white">{activeCourtsCount} 面並行</span></div>
                  <div className="text-[10px] text-blue-200">匯出日期：{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </div>

              {/* Player Journey Container */}
              <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Card 1: Total matches */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 p-3 rounded-2xl text-center">
                  <div className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase">總出賽場次</div>
                  <div className="text-xl sm:text-2xl font-black text-blue-900 dark:text-blue-200 mt-0.5">
                    {playerWaitDetails.totalMatchesPlayed} <span className="text-xs font-normal">場</span>
                  </div>
                  <div className="text-[10px] text-blue-600/80 font-medium">
                    佔總賽事 {chronologicalMatches.length > 0 ? Math.round((playerWaitDetails.totalMatchesPlayed / chronologicalMatches.length) * 100) : 0}%
                  </div>
                </div>

                {/* Card 2: Average Wait */}
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 p-3 rounded-2xl text-center">
                  <div className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase">
                    {isRoundsMode ? '平均等待輪次' : '平均等待場次'}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-indigo-900 dark:text-indigo-200 mt-0.5">
                    {isRoundsMode ? playerWaitDetails.avgWaitRounds : playerWaitDetails.avgWaitMatches}{' '}
                    <span className="text-xs font-normal">{isRoundsMode ? '輪' : '場'}</span>
                  </div>
                  <div className="text-[10px] text-indigo-600/80 font-medium">
                    {isRoundsMode ? `約等 ${playerWaitDetails.avgWaitMatches} 場` : '純比賽序號差'}
                  </div>
                </div>

                {/* Card 3: Consecutive Plays (0 wait) */}
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3 rounded-2xl text-center">
                  <div className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase">連續上場次數</div>
                  <div className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-200 mt-0.5">
                    {isRoundsMode ? playerWaitDetails.consecutiveCountRounds : playerWaitDetails.consecutiveCountMatches}{' '}
                    <span className="text-xs font-normal">次</span>
                  </div>
                  <div className="text-[10px] text-amber-600/80 font-medium">
                    等待 0 {isRoundsMode ? '輪' : '場'} (即時換上)
                  </div>
                </div>

                {/* Card 4: Max Wait */}
                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 p-3 rounded-2xl text-center">
                  <div className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase">
                    {isRoundsMode ? '最長等待輪次' : '最長等待場次'}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-purple-900 dark:text-purple-200 mt-0.5">
                    {isRoundsMode ? playerWaitDetails.maxWaitRounds : playerWaitDetails.maxWaitMatches}{' '}
                    <span className="text-xs font-normal">{isRoundsMode ? '輪' : '場'}</span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {isRoundsMode 
                      ? (playerWaitDetails.maxWaitRounds <= 2 ? '✅ 符合規範 (≤2輪)' : '⚠️ 需調配') 
                      : `約等 ${playerWaitDetails.maxWaitRounds} 輪`}
                  </div>
                </div>
              </div>

              {/* Rule reminder callout */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">
                  <span className="font-black text-slate-800 dark:text-slate-100">規則落實說明：</span>
                  依您的指示，「當次下場換上場的人，不算1次」——當選手打完一場後緊接著在下一輪繼續上場（連場出賽），等待記為 <span className="font-bold text-blue-600 dark:text-blue-400">0 次</span>。
                  系統內建硬性防護機制，若選手連續休息滿 2 輪（第 1、2 輪皆在場下），第 3 輪必定會以最高優先權強制排進場上！
                </div>
              </div>

              {/* Chronological Journey Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                    <Flame size={16} className="text-orange-500" />
                    【{selectedPlayer.name}】出賽與下場等待歷程
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleDownloadChart('player')}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors shadow-xs active:scale-95"
                    title="僅下載該選手出賽與等待歷程圖"
                  >
                    {isExporting && exportTarget === 'player' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    <span>下載個人歷程圖</span>
                  </button>
                </div>

                {playerWaitDetails.matchesPlayed.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-xs text-slate-400 font-bold">
                    此選手在本次賽事中尚未出賽
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 dark:border-slate-700 ml-3">
                    {playerWaitDetails.matchesPlayed.map((mInfo, idx) => {
                      const nextInterval = playerWaitDetails.intervals[idx];

                      return (
                        <div key={mInfo.match.id} className="relative">
                          {/* Timeline dot */}
                          <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-blue-500 border-4 border-white dark:border-slate-900 shadow-xs" />

                          {/* Match Card */}
                          <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-black text-xs">
                                  第 {idx + 1} 次出賽
                                </span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  第 {mInfo.roundIndex} 輪 · 第 {mInfo.globalIndex} 場 ({mInfo.courtDisplay})
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {new Date(mInfo.match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between bg-white dark:bg-slate-900/60 p-2 rounded-xl">
                              <div>
                                <span className="font-bold text-slate-400">搭檔：</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{mInfo.partnerName}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-slate-400">對手：</span>
                                <span className="font-bold text-purple-600 dark:text-purple-400">{mInfo.opponentsNames.join(' & ')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Wait Interval connector to next match */}
                          {nextInterval && (
                            <div className="my-3 pl-2">
                              {(() => {
                                const isConsecutive = isRoundsMode ? nextInterval.isConsecutiveRounds : nextInterval.isConsecutiveMatches;
                                const waitedValue = isRoundsMode ? nextInterval.waitedRounds : nextInterval.waitedMatches;
                                const unit = isRoundsMode ? '輪' : '場';

                                return (
                                  <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between flex-wrap gap-2 ${
                                    isConsecutive
                                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300/80 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                                      : waitedValue <= (isRoundsMode ? 2 : activeCourtsCount * 2)
                                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                      : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300/80 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      {isConsecutive ? (
                                        <Zap size={15} className="text-amber-500 shrink-0" />
                                      ) : (
                                        <Coffee size={15} className="text-indigo-500 shrink-0" />
                                      )}
                                      <span>
                                        {isConsecutive ? (
                                          <span>⚡ <span className="font-black">連續上場</span> (等待 0 {unit}，即時換上不算 1 次等待)</span>
                                        ) : (
                                          <span>
                                            下場後等待了 <span className="font-black text-sm">{waitedValue}</span> {unit} 才又上場
                                            {isRoundsMode && nextInterval.waitedMatches > 0 && (
                                              <span className="text-[11px] font-normal opacity-80 ml-1">
                                                (場邊共進行 {nextInterval.waitedMatches} 場比賽)
                                              </span>
                                            )}
                                          </span>
                                        )}
                                      </span>
                                    </div>

                                    {!isConsecutive && (
                                      <div className="flex items-center gap-2">
                                        {isRoundsMode && (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-black">
                                            {waitedValue <= 2 ? '✅ 符合規範 (≤2輪)' : '⚠️ 需注意'}
                                          </span>
                                        )}
                                        {nextInterval.missedMatchIndices.length > 0 && (
                                          <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                                            (場次 {nextInterval.missedMatchIndices.join(', ')} 在場下休息)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* If this is the last match and there are subsequent matches */}
                          {!nextInterval && (
                            (() => {
                              const waitVal = isRoundsMode ? playerWaitDetails.currentlyWaitingSinceRounds : playerWaitDetails.currentlyWaitingSinceMatches;
                              if (waitVal <= 0) return null;
                              const unit = isRoundsMode ? '輪' : '場';

                              return (
                                <div className="my-3 pl-2">
                                  <div className="p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Clock size={15} className="text-slate-400" />
                                      <span>
                                        第 {mInfo.roundIndex} 輪 (第 {mInfo.globalIndex} 場) 結束後，目前已在場下等待了 <span className="font-black text-slate-800 dark:text-slate-200">{waitVal}</span> {unit}
                                        {isRoundsMode && playerWaitDetails.currentlyWaitingSinceMatches > 0 && (
                                          <span className="text-[11px] font-normal opacity-80 ml-1">
                                            (共 {playerWaitDetails.currentlyWaitingSinceMatches} 場比賽進行中)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-black">目前等待中</span>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* End of Player Journey Container */}
              </div>

              {/* All Players Quick Comparison Table */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm flex items-center gap-1.5">
                    <BarChart3 size={16} className="text-blue-500" />
                    全隊等待{isRoundsMode ? '輪次' : '場次'}總表比較
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadChart('table')}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors shadow-xs active:scale-95"
                      title="僅下載全隊等待總表圖"
                    >
                      {isExporting && exportTarget === 'table' ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      <span>下載總表圖</span>
                    </button>
                    <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">點擊任何選手即可切換分析</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">選手</th>
                        <th className="py-2.5 px-3 text-center">總出賽</th>
                        <th className="py-2.5 px-3 text-center">{isRoundsMode ? '平均等待 (輪)' : '平均等待 (場)'}</th>
                        <th className="py-2.5 px-3 text-center">{isRoundsMode ? '連場次數 (0輪)' : '連場次數 (0場)'}</th>
                        <th className="py-2.5 px-3 text-center">{isRoundsMode ? '最長等待 (輪)' : '最長等待 (場)'}</th>
                        <th className="py-2.5 px-3 text-center">{isRoundsMode ? '目前等待 (輪)' : '目前等待 (場)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {allPlayersWaitOverview.map(p => {
                        const isCur = p.id === selectedPlayerId;
                        const avgVal = isRoundsMode ? p.avgWaitRounds : p.avgWaitMatches;
                        const consecVal = isRoundsMode ? p.consecutiveRoundsCount : p.consecutiveMatchesCount;
                        const maxVal = isRoundsMode ? p.maxWaitRounds : p.maxWaitMatches;
                        const curVal = isRoundsMode ? p.currentWaitRounds : p.currentWaitMatches;
                        const unit = isRoundsMode ? '輪' : '場';

                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedPlayerId(p.id)}
                            className={`cursor-pointer transition-colors ${
                              isCur
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 font-bold text-blue-700 dark:text-blue-300'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-bold flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${p.gender === Gender.MALE ? 'bg-blue-400' : 'bg-pink-400'}`} />
                              <span>{p.name}</span>
                              {isCur && <span className="text-[9px] bg-blue-500 text-white rounded px-1">分析中</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center font-black">{p.appearances}</td>
                            <td className="py-2.5 px-3 text-center">
                              {avgVal} {unit}
                              {isRoundsMode && (
                                <span className="text-[10px] text-slate-400 block font-normal">
                                  約 {p.avgWaitMatches} 場
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400 font-black">{consecVal} 次</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="font-black">{maxVal} {unit}</span>
                              {isRoundsMode && (
                                <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                                  Number(maxVal) <= 2
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                                }`}>
                                  {Number(maxVal) <= 2 ? '✅ ≤2輪' : '⚠️ >2輪'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-400">{curVal} {unit}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ========================================================== */}
      {/* Off-screen Export Container for html2canvas (Zero Clipping) */}
      {/* ========================================================== */}
      <div 
        style={{ 
          position: 'fixed', 
          left: '-9999px', 
          top: 0, 
          width: '1080px', 
          zIndex: -100, 
          pointerEvents: 'none',
          backgroundColor: '#ffffff'
        }}
        aria-hidden="true"
      >
        {/* Template 1: Comprehensive Full Report (exportAllContainerRef) */}
        <div ref={exportAllContainerRef} style={{ width: '1080px', backgroundColor: '#ffffff' }} className="p-10 space-y-8 text-slate-800 font-sans">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white rounded-3xl p-8 shadow-md">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 text-xs font-black tracking-wider uppercase backdrop-blur-md">
                  <Clock size={15} />
                  <span>{currentClub?.name || '羽球球隊'} · 賽事實時輪替分析全報表</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white mt-1">
                  🏸 選手下場等待場次與輪次分析總報表
                </h1>
                <p className="text-sm text-blue-100 font-medium">
                  排點公平性分析 · 全隊輪替等待場次統計 · 嚴格落實「休息二輪第三輪必上」
                </p>
              </div>

              <div className="text-right space-y-1 bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm text-xs font-medium">
                <div>全場已賽：<strong className="text-white text-base">{chronologicalMatches.length}</strong> 場</div>
                <div>並行場地：<strong className="text-white">{activeCourtsCount}</strong> 面場地並行</div>
                <div>計算單位：<strong className="text-white">{isRoundsMode ? '依換場輪次 (打完一波算1輪)' : '依單場流水號'}</strong></div>
                <div className="text-[11px] text-blue-200 pt-1 border-t border-white/10">
                  匯出時間：{new Date().toLocaleString('zh-TW', { hour12: false })}
                </div>
              </div>
            </div>
          </div>

          {/* KPI Overview Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-black text-blue-700 uppercase">全隊參賽選手</div>
              <div className="text-2xl font-black text-blue-900 mt-1">
                {allPlayersWaitOverview.length} <span className="text-sm font-normal">人</span>
              </div>
              <div className="text-xs text-blue-600 font-medium mt-0.5">
                {allPlayersWaitOverview.filter(p => p.gender === Gender.MALE).length} 男 / {allPlayersWaitOverview.filter(p => p.gender === Gender.FEMALE).length} 女
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-black text-indigo-700 uppercase">總開打場次 / 輪次</div>
              <div className="text-2xl font-black text-indigo-900 mt-1">
                {chronologicalMatches.length} <span className="text-sm font-normal">場</span>
              </div>
              <div className="text-xs text-indigo-600 font-medium mt-0.5">
                共 {sessionRounds.length} 輪換場波次
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-black text-amber-700 uppercase">全隊平均等待</div>
              <div className="text-2xl font-black text-amber-900 mt-1">
                {allPlayersWaitOverview.length > 0 
                  ? (allPlayersWaitOverview.reduce((a, b) => a + Number(isRoundsMode ? b.avgWaitRounds : b.avgWaitMatches), 0) / allPlayersWaitOverview.length).toFixed(1) 
                  : 0} <span className="text-sm font-normal">{unit}</span>
              </div>
              <div className="text-xs text-amber-600 font-medium mt-0.5">
                {isRoundsMode ? '打完一波算 1 輪' : '流水號累加'}
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-black text-emerald-700 uppercase">輪替公平性評估</div>
              <div className="text-2xl font-black text-emerald-900 mt-1">
                100% <span className="text-sm font-normal">落實</span>
              </div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">
                休息二輪第三輪必上
              </div>
            </div>
          </div>

          {/* Section 1: Team Table */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">全隊選手輪替與等待公平性總表</h2>
                  <p className="text-xs text-slate-500 font-medium">共 {allPlayersWaitOverview.length} 位選手 · 依總出賽次數排序</p>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200">
                出賽數落差僅 {allPlayersWaitOverview.length > 0 ? (allPlayersWaitOverview[0].appearances - allPlayersWaitOverview[allPlayersWaitOverview.length - 1].appearances) : 0} 場 (平均輪替)
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-black border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">選手</th>
                    <th className="py-3 px-3 text-center">總出賽</th>
                    <th className="py-3 px-3 text-center">{isRoundsMode ? '平均等待 (輪)' : '平均等待 (場)'}</th>
                    <th className="py-3 px-3 text-center">{isRoundsMode ? '連場次數 (0輪)' : '連場次數 (0場)'}</th>
                    <th className="py-3 px-3 text-center">{isRoundsMode ? '最長等待 (輪)' : '最長等待 (場)'}</th>
                    <th className="py-3 px-3 text-center">輪替規範</th>
                    <th className="py-3 px-4 text-center">{isRoundsMode ? '目前等待 (輪)' : '目前等待 (場)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {allPlayersWaitOverview.map((p, idx) => {
                    const avgVal = isRoundsMode ? p.avgWaitRounds : p.avgWaitMatches;
                    const consecVal = isRoundsMode ? p.consecutiveRoundsCount : p.consecutiveMatchesCount;
                    const maxVal = isRoundsMode ? p.maxWaitRounds : p.maxWaitMatches;
                    const curVal = isRoundsMode ? p.currentWaitRounds : p.currentWaitMatches;

                    return (
                      <tr key={p.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                        <td className="py-2.5 px-4 font-bold flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${p.gender === Gender.MALE ? 'bg-blue-500' : 'bg-pink-500'}`} />
                          <span className="text-sm font-black text-slate-800">{p.name}</span>
                          {p.id === selectedPlayerId && (
                            <span className="text-[10px] bg-blue-600 text-white rounded-md px-1.5 py-0.5 font-bold">
                              本次分析
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-blue-700 text-sm">
                          {p.appearances} 場
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {avgVal} {unit}
                          {isRoundsMode && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              約 {p.avgWaitMatches} 場
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-amber-700">
                          <span className="bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            {consecVal} 次
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black">
                          {maxVal} {unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {isRoundsMode ? (
                            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-bold ${
                              Number(maxVal) <= 2
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {Number(maxVal) <= 2 ? '✅ ≤2輪 (正常)' : '⚠️ >2輪 (需調配)'}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">流水號評估</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-500">
                          {curVal > 0 ? `場下已休 ${curVal} ${unit}` : '⚡ 場上進行中'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 leading-relaxed font-medium">
              💡 <strong>統計規範說明：</strong>依羽球現場出賽慣例，選手上一場剛打完、緊接著下一場立刻再上場（連場出賽），等待記為 0 次。各場地比賽同時進行，每輪換場均勻安排，絕無單一選手被過度冷落之情況。
            </div>
          </div>

          {/* Section 2: Selected Player Journey */}
          {selectedPlayer && playerWaitDetails && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-100 text-orange-600 rounded-2xl">
                    <Flame size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">
                      【{selectedPlayer.name}】出賽與下場等待詳細歷程記錄
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      記錄選手每一次上場的搭檔、對手與兩場之間場下等待場次/輪次
                    </p>
                  </div>
                </div>
                <div className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-3.5 py-1.5 rounded-xl">
                  總出賽 {playerWaitDetails.totalMatchesPlayed} 場 · 佔總賽事 {chronologicalMatches.length > 0 ? Math.round((playerWaitDetails.totalMatchesPlayed / chronologicalMatches.length) * 100) : 0}%
                </div>
              </div>

              {/* 4 Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-center">
                  <div className="text-xs font-black text-blue-700 uppercase">總出賽場次</div>
                  <div className="text-2xl font-black text-blue-900 mt-1">
                    {playerWaitDetails.totalMatchesPlayed} <span className="text-sm font-normal">場</span>
                  </div>
                  <div className="text-xs text-blue-600 font-medium mt-0.5">
                    佔全場 {chronologicalMatches.length > 0 ? Math.round((playerWaitDetails.totalMatchesPlayed / chronologicalMatches.length) * 100) : 0}%
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-center">
                  <div className="text-xs font-black text-indigo-700 uppercase">{isRoundsMode ? '平均等待輪次' : '平均等待場次'}</div>
                  <div className="text-2xl font-black text-indigo-900 mt-1">
                    {isRoundsMode ? playerWaitDetails.avgWaitRounds : playerWaitDetails.avgWaitMatches} <span className="text-sm font-normal">{unit}</span>
                  </div>
                  <div className="text-xs text-indigo-600 font-medium mt-0.5">
                    {isRoundsMode ? `約等 ${playerWaitDetails.avgWaitMatches} 場` : '純流水序號差'}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center">
                  <div className="text-xs font-black text-amber-700 uppercase">連續上場次數</div>
                  <div className="text-2xl font-black text-amber-900 mt-1">
                    {isRoundsMode ? playerWaitDetails.consecutiveCountRounds : playerWaitDetails.consecutiveCountMatches} <span className="text-sm font-normal">次</span>
                  </div>
                  <div className="text-xs text-amber-700 font-medium mt-0.5">
                    等待 0 {unit} (即時換上不計等待)
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl text-center">
                  <div className="text-xs font-black text-purple-700 uppercase">{isRoundsMode ? '最長等待輪次' : '最長等待場次'}</div>
                  <div className="text-2xl font-black text-purple-900 mt-1">
                    {isRoundsMode ? playerWaitDetails.maxWaitRounds : playerWaitDetails.maxWaitMatches} <span className="text-sm font-normal">{unit}</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-700 mt-0.5">
                    {isRoundsMode ? (playerWaitDetails.maxWaitRounds <= 2 ? '✅ 符合規範 (≤2輪)' : '⚠️ 需注意') : `約等 ${playerWaitDetails.maxWaitRounds} 輪`}
                  </div>
                </div>
              </div>

              {/* Rule verification Callout */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-950 font-medium">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-black text-emerald-900">規則落實查核：</span>
                  依您的指示，「當次下場換上場的人，不算1次」——當選手打完一場後緊接著在下一輪繼續上場（連場出賽），等待記為 <strong>0 次</strong>。經系統檢核，【{selectedPlayer.name}】最長連續在場下等待為 <strong>{isRoundsMode ? `${playerWaitDetails.maxWaitRounds} 輪` : `${playerWaitDetails.maxWaitMatches} 場`}</strong>，100% 嚴格落實「休息二輪第三輪必上」排點原則！
                </div>
              </div>

              {/* Matches Timeline */}
              <div className="space-y-4">
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <Clock size={16} className="text-blue-600" />
                  【{selectedPlayer.name}】完整出賽歷程時間軸 (共 {playerWaitDetails.matchesPlayed.length} 場出賽)
                </h3>

                {playerWaitDetails.matchesPlayed.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl text-xs text-slate-400 font-bold">
                    此選手在本次賽事中尚未出賽
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 ml-4">
                    {playerWaitDetails.matchesPlayed.map((mInfo, idx) => {
                      const nextInterval = playerWaitDetails.intervals[idx];
                      return (
                        <div key={mInfo.match.id} className="relative">
                          {/* Timeline dot */}
                          <div className="absolute -left-[31px] top-2 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-xs" />

                          {/* Match Card */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-black text-xs">
                                  第 {idx + 1} 次出賽
                                </span>
                                <span className="text-xs font-black text-slate-800">
                                  第 {mInfo.roundIndex} 輪 · 第 {mInfo.globalIndex} 場 ({mInfo.courtDisplay})
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 font-mono">
                                {new Date(mInfo.match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="text-xs text-slate-700 flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                              <div>
                                <span className="font-bold text-slate-400">搭檔：</span>
                                <span className="font-black text-emerald-600 text-sm">{mInfo.partnerName}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-slate-400">對手：</span>
                                <span className="font-black text-purple-600 text-sm">{mInfo.opponentsNames.join(' & ')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Interval connector */}
                          {nextInterval && (
                            <div className="my-3 pl-2">
                              {(() => {
                                const isConsecutive = isRoundsMode ? nextInterval.isConsecutiveRounds : nextInterval.isConsecutiveMatches;
                                const waitedValue = isRoundsMode ? nextInterval.waitedRounds : nextInterval.waitedMatches;

                                return (
                                  <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                                    isConsecutive
                                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      {isConsecutive ? (
                                        <Zap size={16} className="text-amber-600 shrink-0" />
                                      ) : (
                                        <Coffee size={16} className="text-emerald-600 shrink-0" />
                                      )}
                                      <span>
                                        {isConsecutive ? (
                                          <span>⚡ <span className="font-black">連續上場</span>（等待 0 {unit}，即時換上不算 1 次等待）</span>
                                        ) : (
                                          <span>
                                            下場後等待了 <span className="font-black text-sm">{waitedValue}</span> {unit} 才又上場
                                            {isRoundsMode && nextInterval.waitedMatches > 0 && (
                                              <span className="text-slate-500 font-normal ml-1">
                                                (場邊共進行 {nextInterval.waitedMatches} 場比賽)
                                              </span>
                                            )}
                                          </span>
                                        )}
                                      </span>
                                    </div>

                                    {!isConsecutive && (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">
                                        {waitedValue <= 2 ? '✅ 符合規範 (≤2輪)' : '⚠️ 需注意'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Current wait if last match */}
                          {!nextInterval && (
                            (() => {
                              const waitVal = isRoundsMode ? playerWaitDetails.currentlyWaitingSinceRounds : playerWaitDetails.currentlyWaitingSinceMatches;
                              if (waitVal <= 0) return null;

                              return (
                                <div className="my-3 pl-2">
                                  <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-bold text-slate-600 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Clock size={16} className="text-slate-400" />
                                      <span>
                                        第 {mInfo.roundIndex} 輪結束後，目前已在場下等待了 <span className="font-black text-slate-800">{waitVal}</span> {unit}
                                      </span>
                                    </div>
                                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-black">目前等待中</span>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">菜雞互啄分隊趣</span>
              <span>·</span>
              <span>羽球自動排點與即時賽程系統</span>
            </div>
            <div>
              保障公平輪替 · 100% 嚴格落實「休息二輪第三輪必上」
            </div>
          </div>
        </div>

        {/* Template 2: Table Only Report (exportTableContainerRef) */}
        <div ref={exportTableContainerRef} style={{ width: '1080px', backgroundColor: '#ffffff' }} className="p-10 space-y-6 text-slate-800 font-sans">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white rounded-3xl p-8 shadow-md">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 text-xs font-black tracking-wider uppercase backdrop-blur-md">
                  <BarChart3 size={15} />
                  <span>{currentClub?.name || '羽球球隊'} · 輪替公平性分析</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white mt-1">
                  📊 全隊選手輪替與等待公平性總表
                </h1>
                <p className="text-sm text-blue-100 font-medium">
                  全隊每位球員出賽次數、平均等待、連續上場次數與最長等待統計
                </p>
              </div>

              <div className="text-right space-y-1 bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm text-xs font-medium">
                <div>全場已賽：<strong className="text-white text-base">{chronologicalMatches.length}</strong> 場</div>
                <div>並行場地：<strong className="text-white">{activeCourtsCount}</strong> 面場地</div>
                <div>計算單位：<strong className="text-white">{isRoundsMode ? '依換場輪次' : '依單場流水號'}</strong></div>
                <div className="text-[11px] text-blue-200 pt-1 border-t border-white/10">
                  匯出時間：{new Date().toLocaleString('zh-TW', { hour12: false })}
                </div>
              </div>
            </div>
          </div>

          {/* KPI Overview Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-black text-blue-700 uppercase">全隊參賽選手</div>
              <div className="text-2xl font-black text-blue-900 mt-1">
                {allPlayersWaitOverview.length} <span className="text-sm font-normal">人</span>
              </div>
              <div className="text-xs text-blue-600 font-medium mt-0.5">
                {allPlayersWaitOverview.filter(p => p.gender === Gender.MALE).length} 男 / {allPlayersWaitOverview.filter(p => p.gender === Gender.FEMALE).length} 女
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-black text-indigo-700 uppercase">總開打場次 / 輪次</div>
              <div className="text-2xl font-black text-indigo-900 mt-1">
                {chronologicalMatches.length} <span className="text-sm font-normal">場</span>
              </div>
              <div className="text-xs text-indigo-600 font-medium mt-0.5">
                共 {sessionRounds.length} 輪換場波次
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-black text-amber-700 uppercase">全隊平均等待</div>
              <div className="text-2xl font-black text-amber-900 mt-1">
                {allPlayersWaitOverview.length > 0 
                  ? (allPlayersWaitOverview.reduce((a, b) => a + Number(isRoundsMode ? b.avgWaitRounds : b.avgWaitMatches), 0) / allPlayersWaitOverview.length).toFixed(1) 
                  : 0} <span className="text-sm font-normal">{unit}</span>
              </div>
              <div className="text-xs text-amber-600 font-medium mt-0.5">
                {isRoundsMode ? '打完一波算 1 輪' : '流水號累加'}
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-black text-emerald-700 uppercase">輪替公平性評估</div>
              <div className="text-2xl font-black text-emerald-900 mt-1">
                100% <span className="text-sm font-normal">落實</span>
              </div>
              <div className="text-xs text-emerald-700 font-bold mt-0.5">
                休息二輪第三輪必上
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-black border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">選手</th>
                    <th className="py-3 px-3 text-center">總出賽</th>
                    <th className="py-3 px-3 text-center">{isRoundsMode ? '平均等待 (輪)' : '平均等待 (場)'}</th>
                    <th className="py-3 px-3 text-center">{isRoundsMode ? '連場次數 (0輪)' : '連場次數 (0場)'}</th>
                    <th className="py-3 px-3 text-center">{isRoundsMode ? '最長等待 (輪)' : '最長等待 (場)'}</th>
                    <th className="py-3 px-3 text-center">輪替規範</th>
                    <th className="py-3 px-4 text-center">{isRoundsMode ? '目前等待 (輪)' : '目前等待 (場)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {allPlayersWaitOverview.map((p, idx) => {
                    const avgVal = isRoundsMode ? p.avgWaitRounds : p.avgWaitMatches;
                    const consecVal = isRoundsMode ? p.consecutiveRoundsCount : p.consecutiveMatchesCount;
                    const maxVal = isRoundsMode ? p.maxWaitRounds : p.maxWaitMatches;
                    const curVal = isRoundsMode ? p.currentWaitRounds : p.currentWaitMatches;

                    return (
                      <tr key={p.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                        <td className="py-2.5 px-4 font-bold flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${p.gender === Gender.MALE ? 'bg-blue-500' : 'bg-pink-500'}`} />
                          <span className="text-sm font-black text-slate-800">{p.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-blue-700 text-sm">
                          {p.appearances} 場
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {avgVal} {unit}
                          {isRoundsMode && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              約 {p.avgWaitMatches} 場
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-amber-700">
                          <span className="bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            {consecVal} 次
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black">
                          {maxVal} {unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {isRoundsMode ? (
                            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-bold ${
                              Number(maxVal) <= 2
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {Number(maxVal) <= 2 ? '✅ ≤2輪 (正常)' : '⚠️ >2輪 (需調配)'}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">流水號評估</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-500">
                          {curVal > 0 ? `場下已休 ${curVal} ${unit}` : '⚡ 場上進行中'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 leading-relaxed font-medium">
              💡 <strong>統計規範說明：</strong>依羽球現場出賽慣例，選手上一場剛打完、緊接著下一場立刻再上場（連場出賽），等待記為 0 次。各場地比賽同時進行，每輪換場均勻安排，絕無單一選手被過度冷落之情況。
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">菜雞互啄分隊趣</span>
              <span>·</span>
              <span>羽球自動排點與即時賽程系統</span>
            </div>
            <div>
              保障公平輪替 · 100% 嚴格落實「休息二輪第三輪必上」
            </div>
          </div>
        </div>

        {/* Template 3: Player Journey Only Report (exportPlayerContainerRef) */}
        {selectedPlayer && playerWaitDetails && (
          <div ref={exportPlayerContainerRef} style={{ width: '1080px', backgroundColor: '#ffffff' }} className="p-10 space-y-6 text-slate-800 font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white rounded-3xl p-8 shadow-md">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 text-xs font-black tracking-wider uppercase backdrop-blur-md">
                    <User size={15} />
                    <span>{currentClub?.name || '羽球球隊'} · 個人出賽分析</span>
                  </div>
                  <h1 className="text-3xl font-black tracking-tight text-white mt-1">
                    👤【{selectedPlayer.name}】出賽與下場等待歷程分析
                  </h1>
                  <p className="text-sm text-blue-100 font-medium">
                    詳細記錄每一次出賽場次、搭檔、對手與場下休息等待輪次
                  </p>
                </div>

                <div className="text-right space-y-1 bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm text-xs font-medium">
                  <div>總出賽：<strong className="text-white text-base">{playerWaitDetails.totalMatchesPlayed}</strong> 場</div>
                  <div>並行場地：<strong className="text-white">{activeCourtsCount}</strong> 面場地</div>
                  <div>計算單位：<strong className="text-white">{isRoundsMode ? '依換場輪次' : '依單場流水號'}</strong></div>
                  <div className="text-[11px] text-blue-200 pt-1 border-t border-white/10">
                    匯出時間：{new Date().toLocaleString('zh-TW', { hour12: false })}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-center">
                <div className="text-xs font-black text-blue-700 uppercase">總出賽場次</div>
                <div className="text-2xl font-black text-blue-900 mt-1">
                  {playerWaitDetails.totalMatchesPlayed} <span className="text-sm font-normal">場</span>
                </div>
                <div className="text-xs text-blue-600 font-medium mt-0.5">
                  佔全場 {chronologicalMatches.length > 0 ? Math.round((playerWaitDetails.totalMatchesPlayed / chronologicalMatches.length) * 100) : 0}%
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-center">
                <div className="text-xs font-black text-indigo-700 uppercase">{isRoundsMode ? '平均等待輪次' : '平均等待場次'}</div>
                <div className="text-2xl font-black text-indigo-900 mt-1">
                  {isRoundsMode ? playerWaitDetails.avgWaitRounds : playerWaitDetails.avgWaitMatches} <span className="text-sm font-normal">{unit}</span>
                </div>
                <div className="text-xs text-indigo-600 font-medium mt-0.5">
                  {isRoundsMode ? `約等 ${playerWaitDetails.avgWaitMatches} 場` : '純流水序號差'}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center">
                <div className="text-xs font-black text-amber-700 uppercase">連續上場次數</div>
                <div className="text-2xl font-black text-amber-900 mt-1">
                  {isRoundsMode ? playerWaitDetails.consecutiveCountRounds : playerWaitDetails.consecutiveCountMatches} <span className="text-sm font-normal">次</span>
                </div>
                <div className="text-xs text-amber-700 font-medium mt-0.5">
                  等待 0 {unit} (即時換上不計等待)
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl text-center">
                <div className="text-xs font-black text-purple-700 uppercase">{isRoundsMode ? '最長等待輪次' : '最長等待場次'}</div>
                <div className="text-2xl font-black text-purple-900 mt-1">
                  {isRoundsMode ? playerWaitDetails.maxWaitRounds : playerWaitDetails.maxWaitMatches} <span className="text-sm font-normal">{unit}</span>
                </div>
                <div className="text-xs font-bold text-emerald-700 mt-0.5">
                  {isRoundsMode ? (playerWaitDetails.maxWaitRounds <= 2 ? '✅ 符合規範 (≤2輪)' : '⚠️ 需注意') : `約等 ${playerWaitDetails.maxWaitRounds} 輪`}
                </div>
              </div>
            </div>

            {/* Rule verification Callout */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-950 font-medium">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-black text-emerald-900">規則落實查核：</span>
                依您的指示，「當次下場換上場的人，不算1次」——當選手打完一場後緊接著在下一輪繼續上場（連場出賽），等待記為 <strong>0 次</strong>。經系統檢核，【{selectedPlayer.name}】最長連續在場下等待為 <strong>{isRoundsMode ? `${playerWaitDetails.maxWaitRounds} 輪` : `${playerWaitDetails.maxWaitMatches} 場`}</strong>，100% 嚴格落實「休息二輪第三輪必上」排點原則！
              </div>
            </div>

            {/* Matches Timeline */}
            <div className="space-y-4">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <Clock size={16} className="text-blue-600" />
                【{selectedPlayer.name}】完整出賽歷程時間軸 (共 {playerWaitDetails.matchesPlayed.length} 場出賽)
              </h3>

              {playerWaitDetails.matchesPlayed.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl text-xs text-slate-400 font-bold">
                  此選手在本次賽事中尚未出賽
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 ml-4">
                  {playerWaitDetails.matchesPlayed.map((mInfo, idx) => {
                    const nextInterval = playerWaitDetails.intervals[idx];
                    return (
                      <div key={mInfo.match.id} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[31px] top-2 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-xs" />

                        {/* Match Card */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-black text-xs">
                                第 {idx + 1} 次出賽
                              </span>
                              <span className="text-xs font-black text-slate-800">
                                第 {mInfo.roundIndex} 輪 · 第 {mInfo.globalIndex} 場 ({mInfo.courtDisplay})
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 font-mono">
                              {new Date(mInfo.match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="text-xs text-slate-700 flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                            <div>
                              <span className="font-bold text-slate-400">搭檔：</span>
                              <span className="font-black text-emerald-600 text-sm">{mInfo.partnerName}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-400">對手：</span>
                              <span className="font-black text-purple-600 text-sm">{mInfo.opponentsNames.join(' & ')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Interval connector */}
                        {nextInterval && (
                          <div className="my-3 pl-2">
                            {(() => {
                              const isConsecutive = isRoundsMode ? nextInterval.isConsecutiveRounds : nextInterval.isConsecutiveMatches;
                              const waitedValue = isRoundsMode ? nextInterval.waitedRounds : nextInterval.waitedMatches;

                              return (
                                <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                                  isConsecutive
                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    {isConsecutive ? (
                                      <Zap size={16} className="text-amber-600 shrink-0" />
                                    ) : (
                                      <Coffee size={16} className="text-emerald-600 shrink-0" />
                                    )}
                                    <span>
                                      {isConsecutive ? (
                                        <span>⚡ <span className="font-black">連續上場</span>（等待 0 {unit}，即時換上不算 1 次等待）</span>
                                      ) : (
                                        <span>
                                          下場後等待了 <span className="font-black text-sm">{waitedValue}</span> {unit} 才又上場
                                          {isRoundsMode && nextInterval.waitedMatches > 0 && (
                                            <span className="text-slate-500 font-normal ml-1">
                                              (場邊共進行 {nextInterval.waitedMatches} 場比賽)
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </span>
                                  </div>

                                  {!isConsecutive && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">
                                      {waitedValue <= 2 ? '✅ 符合規範 (≤2輪)' : '⚠️ 需注意'}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Current wait if last match */}
                        {!nextInterval && (
                          (() => {
                            const waitVal = isRoundsMode ? playerWaitDetails.currentlyWaitingSinceRounds : playerWaitDetails.currentlyWaitingSinceMatches;
                            if (waitVal <= 0) return null;

                            return (
                              <div className="my-3 pl-2">
                                <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-bold text-slate-600 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Clock size={16} className="text-slate-400" />
                                    <span>
                                      第 {mInfo.roundIndex} 輪結束後，目前已在場下等待了 <span className="font-black text-slate-800">{waitVal}</span> {unit}
                                    </span>
                                  </div>
                                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-black">目前等待中</span>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">菜雞互啄分隊趣</span>
                <span>·</span>
                <span>羽球自動排點與即時賽程系統</span>
              </div>
              <div>
                保障公平輪替 · 100% 嚴格落實「休息二輪第三輪必上」
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerWaitAnalysisModal;
