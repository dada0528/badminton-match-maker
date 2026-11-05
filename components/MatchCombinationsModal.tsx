import React, { useState, useMemo, useRef } from 'react';
import { X, Users, Search, Share2, Copy, Check, ArrowRightLeft, Shield, UserCheck, Flame, Download, Loader2, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useStore } from '../store/useStore';
import { ScheduleItem, Player, Gender } from '../types';

interface MatchCombinationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MatchCombinationsModal: React.FC<MatchCombinationsModalProps> = ({ isOpen, onClose }) => {
  const { players, matchHistory, activeMatches } = useStore();
  const [activeTab, setActiveTab] = useState<'cards' | 'matrix'>('cards');
  const [matrixMode, setMatrixMode] = useState<'partners' | 'opponents'>('partners');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  // Combine matchHistory and non-null activeMatches
  const allCurrentMatches = useMemo(() => {
    const list: ScheduleItem[] = [...matchHistory];
    activeMatches.forEach(m => {
      if (m && !list.some(existing => existing.id === m.id)) {
        list.push(m);
      }
    });
    return list;
  }, [matchHistory, activeMatches]);

  // Compute partnership and opponent stats
  const combinationStats = useMemo(() => {
    // Map of player name -> { totalMatches, partnerCounts, opponentCounts, gender }
    const playerMap = new Map<string, {
      id: string;
      name: string;
      gender: Gender;
      totalMatches: number;
      partners: Map<string, number>;
      opponents: Map<string, number>;
    }>();

    // Initialize with all active players in roster
    players.forEach(p => {
      playerMap.set(p.name, {
        id: p.id,
        name: p.name,
        gender: p.gender,
        totalMatches: 0,
        partners: new Map<string, number>(),
        opponents: new Map<string, number>(),
      });
    });

    // Process all matches
    allCurrentMatches.forEach(match => {
      const pA1 = match.teamA.player1.name;
      const pA2 = match.teamA.player2.name;
      const pB1 = match.teamB.player1.name;
      const pB2 = match.teamB.player2.name;

      const recordPlayer = (name: string, pObj: Player) => {
        if (!playerMap.has(name)) {
          playerMap.set(name, {
            id: pObj.id,
            name,
            gender: pObj.gender,
            totalMatches: 0,
            partners: new Map<string, number>(),
            opponents: new Map<string, number>(),
          });
        }
        playerMap.get(name)!.totalMatches += 1;
      };

      recordPlayer(pA1, match.teamA.player1);
      recordPlayer(pA2, match.teamA.player2);
      recordPlayer(pB1, match.teamB.player1);
      recordPlayer(pB2, match.teamB.player2);

      // Partnerships
      const addPartner = (p1: string, p2: string) => {
        const stats1 = playerMap.get(p1)!;
        stats1.partners.set(p2, (stats1.partners.get(p2) || 0) + 1);

        const stats2 = playerMap.get(p2)!;
        stats2.partners.set(p1, (stats2.partners.get(p1) || 0) + 1);
      };

      addPartner(pA1, pA2);
      addPartner(pB1, pB2);

      // Opponents
      const addOpponents = (team1: [string, string], team2: [string, string]) => {
        team1.forEach(t1 => {
          const stats = playerMap.get(t1)!;
          team2.forEach(t2 => {
            stats.opponents.set(t2, (stats.opponents.get(t2) || 0) + 1);
          });
        });

        team2.forEach(t2 => {
          const stats = playerMap.get(t2)!;
          team1.forEach(t1 => {
            stats.opponents.set(t1, (stats.opponents.get(t1) || 0) + 1);
          });
        });
      };

      addOpponents([pA1, pA2], [pB1, pB2]);
    });

    // Format list
    const playerList = Array.from(playerMap.values()).map(p => {
      const partnersList = Array.from(p.partners.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const opponentsList = Array.from(p.opponents.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const allOtherNames = Array.from(playerMap.keys()).filter(n => n !== p.name);
      const neverPartnered = allOtherNames.filter(n => !p.partners.has(n));
      const neverFaced = allOtherNames.filter(n => !p.opponents.has(n));

      return {
        ...p,
        partnersList,
        opponentsList,
        neverPartnered,
        neverFaced,
      };
    });

    return playerList;
  }, [players, allCurrentMatches]);

  const filteredStats = useMemo(() => {
    if (!searchQuery.trim()) return combinationStats;
    const q = searchQuery.trim().toLowerCase();
    return combinationStats.filter(p => p.name.toLowerCase().includes(q));
  }, [combinationStats, searchQuery]);

  if (!isOpen) return null;

  const handleCopySummary = () => {
    if (combinationStats.length === 0) return;
    let text = `🏸【當次比賽搭檔與對戰組合表】(共 ${allCurrentMatches.length} 場)\n\n`;
    combinationStats.forEach(p => {
      text += `👤 ${p.name} (出賽 ${p.totalMatches} 場):\n`;
      const partnerStr = p.partnersList.map(item => `${item.name}(${item.count})`).join(', ') || '無';
      const oppStr = p.opponentsList.map(item => `${item.name}(${item.count})`).join(', ') || '無';
      text += `  🤝 搭檔: ${partnerStr}\n`;
      text += `  ⚔️ 對戰: ${oppStr}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotice('已複製搭檔與對戰組合摘要！');
      setTimeout(() => setCopiedNotice(null), 2500);
    });
  };

  const handleDownloadChart = async () => {
    const targetElement = activeTab === 'matrix' ? matrixContainerRef.current : cardsContainerRef.current;
    if (!targetElement) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(targetElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: Math.max(targetElement.scrollWidth + 40, 1100),
      });

      const title = activeTab === 'matrix' 
        ? (matrixMode === 'partners' ? '搭檔次數交叉對照矩陣表' : '對戰次數交叉對照矩陣表')
        : '選手搭檔對戰組合表';

      const link = document.createElement('a');
      link.download = `${title}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Download chart failed:', error);
      alert('圖表下載失敗，請稍後再試');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-emerald-500 p-4 sm:p-5 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Users size={24} />
            </div>
            <div>
              <h2 className="font-black text-lg sm:text-xl tracking-tight leading-tight">
                當次比賽對戰與搭檔組合表
              </h2>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                完整記錄每位選手搭檔過誰、對戰過誰與各幾次 (累計 {allCurrentMatches.length} 場)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white text-xs font-bold flex items-center gap-1.5"
              title="複製文字摘要"
            >
              <Copy size={16} />
              <span className="hidden sm:inline">複製統計</span>
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Action & Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'cards' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              選手個人卡片清單
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'matrix' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              交叉對照矩陣
            </button>
          </div>

          {/* If matrix mode: switch partner vs opponent */}
          {activeTab === 'matrix' && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                onClick={() => setMatrixMode('partners')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  matrixMode === 'partners'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                🤝 搭檔矩陣
              </button>
              <button
                onClick={() => setMatrixMode('opponents')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  matrixMode === 'opponents'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                ⚔️ 對戰矩陣
              </button>
            </div>
          )}

          {/* Actions: Download Chart & Search Box */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownloadChart}
              disabled={isExporting || allCurrentMatches.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs transition-all shrink-0 cursor-pointer"
              title="下載目前圖表為高畫質 PNG 圖片"
            >
              {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span>{isExporting ? '匯出中...' : '下載圖表'}</span>
            </button>

            <div className="relative w-full sm:w-52">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋選手姓名..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {copiedNotice && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Check size={14} /> {copiedNotice}</span>
            <button onClick={() => setCopiedNotice(null)}><X size={12} /></button>
          </div>
        )}

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-900">
          
          {allCurrentMatches.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 p-8">
              <Users size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="font-black text-slate-700 dark:text-slate-300 text-base">目前尚無比賽紀錄</h3>
              <p className="text-xs text-slate-400 mt-1">開始排點並進行比賽後，系統將自動為每位選手統計搭檔與對戰組合。</p>
            </div>
          ) : activeTab === 'cards' ? (
            /* Player Cards View */
            <div ref={cardsContainerRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredStats.map(p => (
                <div 
                  key={p.name}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-all space-y-3"
                >
                  {/* Player Title & Total */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${p.gender === Gender.MALE ? 'bg-blue-500' : 'bg-pink-500'}`} />
                      <span className="font-black text-slate-800 dark:text-slate-100 text-base">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400">總出場：</span>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                        p.totalMatches > 0 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-700'
                      }`}>
                        {p.totalMatches} 場
                      </span>
                    </div>
                  </div>

                  {/* Partners Section */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400">
                      <span>🤝 搭檔過的隊友 ({p.partnersList.length} 人)</span>
                    </div>
                    {p.partnersList.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-1">尚未搭檔過</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {p.partnersList.map(partner => (
                          <span
                            key={partner.name}
                            className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                              partner.count > 1 
                                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700' 
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50'
                            }`}
                          >
                            <span>{partner.name}</span>
                            <span className="text-[10px] bg-emerald-500 text-white rounded-full px-1.5 py-0.2 font-black leading-tight">
                              ×{partner.count}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Opponents Section */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-purple-700 dark:text-purple-400">
                      <span>⚔️ 對戰過的對手 ({p.opponentsList.length} 人)</span>
                    </div>
                    {p.opponentsList.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-1">尚未對戰過</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {p.opponentsList.map(opponent => (
                          <span
                            key={opponent.name}
                            className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                              opponent.count > 1 
                                ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 border border-purple-300 dark:border-purple-700' 
                                : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50'
                            }`}
                          >
                            <span>{opponent.name}</span>
                            <span className="text-[10px] bg-purple-500 text-white rounded-full px-1.5 py-0.2 font-black leading-tight">
                              ×{opponent.count}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Unmatched / Zero encounter info */}
                  {(p.neverPartnered.length > 0 || p.neverFaced.length > 0) && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                      {p.neverPartnered.length > 0 && (
                        <span>未搭檔過 ({p.neverPartnered.length}人): {p.neverPartnered.slice(0, 4).join('、')}{p.neverPartnered.length > 4 ? '...' : ''}</span>
                      )}
                      {p.neverFaced.length > 0 && (
                        <span>未對戰過 ({p.neverFaced.length}人): {p.neverFaced.slice(0, 4).join('、')}{p.neverFaced.length > 4 ? '...' : ''}</span>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </div>
          ) : (
            /* Matrix View */
            <div ref={matrixContainerRef} className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 gap-2">
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                    <span>{matrixMode === 'partners' ? '🤝 搭檔次數交叉對照矩陣' : '⚔️ 對戰次數交叉對照矩陣'}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                      累計 {allCurrentMatches.length} 場賽事
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    表內數字代表二位選手共同搭檔/對戰的累積次數 · 產生時間：{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 inline-block" /> 0次
                  </span>
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                    <span className={`w-3 h-3 rounded ${matrixMode === 'partners' ? 'bg-emerald-100 dark:bg-emerald-900 border border-emerald-300' : 'bg-purple-100 dark:bg-purple-900 border border-purple-300'} inline-block`} /> 1次
                  </span>
                  <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-black">
                    <span className={`w-3 h-3 rounded ${matrixMode === 'partners' ? 'bg-emerald-500' : 'bg-rose-500'} inline-block`} /> ≥2次
                  </span>
                </div>
              </div>
              
              <table className="min-w-full border-collapse text-center text-xs">
                <thead>
                  <tr>
                    <th className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-750 font-black text-slate-700 dark:text-slate-200 sticky left-0 z-10">
                      選手
                    </th>
                    {filteredStats.map(colP => (
                      <th 
                        key={colP.name} 
                        className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-750 font-black text-slate-700 dark:text-slate-200 min-w-[55px] max-w-[80px] truncate"
                        title={colP.name}
                      >
                        {colP.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map(rowP => (
                    <tr key={rowP.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 sticky left-0 z-10 text-left truncate max-w-[100px]">
                        {rowP.name}
                      </td>
                      {filteredStats.map(colP => {
                        if (rowP.name === colP.name) {
                          return (
                            <td key={colP.name} className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/80 text-slate-300 dark:text-slate-600">
                              -
                            </td>
                          );
                        }

                        const count = matrixMode === 'partners'
                          ? (rowP.partners.get(colP.name) || 0)
                          : (rowP.opponents.get(colP.name) || 0);

                        return (
                          <td 
                            key={colP.name} 
                            className={`p-2 border border-slate-200 dark:border-slate-700 font-black transition-colors ${
                              count === 0 
                                ? 'text-slate-300 dark:text-slate-600'
                                : matrixMode === 'partners'
                                ? count >= 2 
                                  ? 'bg-emerald-500 text-white font-extrabold'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : count >= 2
                                ? 'bg-rose-500 text-white font-extrabold'
                                : 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                            }`}
                            title={`${rowP.name} 與 ${colP.name} ${matrixMode === 'partners' ? '搭檔' : '對戰'} ${count} 次`}
                          >
                            {count > 0 ? count : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MatchCombinationsModal;
