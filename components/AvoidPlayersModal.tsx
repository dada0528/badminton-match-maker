import React, { useState, useMemo } from 'react';
import { X, UserX, ShieldAlert, Check, Search, Trash2, User, Users, ShieldCheck, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Gender, Player } from '../types';

interface AvoidPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlayerId?: string;
}

export const AvoidPlayersModal: React.FC<AvoidPlayersModalProps> = ({
  isOpen,
  onClose,
  initialPlayerId,
}) => {
  const { players, avoidPairs, setPlayerAvoids, removeAvoidPair, clearAvoidPairs } = useStore();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [targetAvoidIds, setTargetAvoidIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Initialize selected player
  React.useEffect(() => {
    if (isOpen) {
      if (initialPlayerId && players.some(p => p.id === initialPlayerId)) {
        setSelectedPlayerId(initialPlayerId);
      } else if (players.length > 0 && !selectedPlayerId) {
        setSelectedPlayerId(players[0].id);
      }
    }
  }, [isOpen, initialPlayerId, players]);

  // When selectedPlayerId changes, load their current avoided player IDs
  React.useEffect(() => {
    if (!selectedPlayerId) {
      setTargetAvoidIds([]);
      return;
    }
    const currentAvoids: string[] = [];
    avoidPairs.forEach(([p1, p2]) => {
      if (p1 === selectedPlayerId && p2 !== selectedPlayerId) {
        currentAvoids.push(p2);
      } else if (p2 === selectedPlayerId && p1 !== selectedPlayerId) {
        currentAvoids.push(p1);
      }
    });
    setTargetAvoidIds(currentAvoids);
  }, [selectedPlayerId, avoidPairs]);

  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  // Available target candidates (all players except selectedPlayer)
  const candidatePlayers = useMemo(() => {
    return players.filter(p => p.id !== selectedPlayerId && p.status !== 'SUSPENDED');
  }, [players, selectedPlayerId]);

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidatePlayers;
    const q = searchQuery.trim().toLowerCase();
    return candidatePlayers.filter(p => p.name.toLowerCase().includes(q));
  }, [candidatePlayers, searchQuery]);

  // Grouped active avoid pairs with player objects
  const activeAvoidPairsDetailed = useMemo(() => {
    const list: Array<{ p1: Player; p2: Player; pairKey: string }> = [];
    const seen = new Set<string>();

    avoidPairs.forEach(([id1, id2]) => {
      const p1 = players.find(p => p.id === id1);
      const p2 = players.find(p => p.id === id2);
      if (!p1 || !p2) return;
      const key = [id1, id2].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ p1, p2, pairKey: key });
      }
    });

    return list;
  }, [avoidPairs, players]);

  if (!isOpen) return null;

  const handleToggleTarget = (id: string) => {
    setTargetAvoidIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSaveForSelectedPlayer = () => {
    if (!selectedPlayerId) return;
    setPlayerAvoids(selectedPlayerId, targetAvoidIds);
    const pName = selectedPlayer?.name || '此球員';
    setSavedNotice(`已更新【${pName}】的同場迴避名單！`);
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const handleClearForSelectedPlayer = () => {
    if (!selectedPlayerId) return;
    setTargetAvoidIds([]);
    setPlayerAvoids(selectedPlayerId, []);
    setSavedNotice(`已清空此球員的所有迴避設定`);
    setTimeout(() => setSavedNotice(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 p-4 sm:p-5 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <UserX size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-lg sm:text-xl tracking-tight leading-tight">
                  不想跟誰打球 (迴避同場名單)
                </h2>
                {activeAvoidPairsDetailed.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black">
                    已設定 {activeAvoidPairsDetailed.length} 組
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-100 font-medium mt-0.5">
                選擇一位球員，點選他不想同場的人（搭檔或對戰皆絕對不會同場）
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
            title="關閉"
          >
            <X size={20} />
          </button>
        </div>

        {/* Rule Reassurance Callout */}
        <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200/80 dark:border-rose-900/40 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300 font-bold">
          <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <span>
            🛡️ 系統絕對保證：被勾選的二人組合，排點時<strong>100% 嚴格禁止同場</strong>（隊友或對手皆不碰頭）。
          </span>
        </div>

        {/* Save Notice Banner */}
        {savedNotice && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" /> {savedNotice}
            </span>
            <button onClick={() => setSavedNotice(null)} className="text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-6">
          
          {players.length < 2 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-slate-400 font-bold">
              選手名單少於 2 人，無法設定迴避名單
            </div>
          ) : (
            <>
              {/* Step 1: Select Player */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <User size={14} className="text-rose-500" />
                    步驟 1：選擇主要球員
                  </label>
                  {selectedPlayer && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                      目前選中：【{selectedPlayer.name}】
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                  {players.map(p => {
                    const isSelected = p.id === selectedPlayerId;
                    // Count how many avoid pairs involve this player
                    const avoidCount = avoidPairs.filter(pair => pair[0] === p.id || pair[1] === p.id).length;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlayerId(p.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/50'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${p.gender === Gender.MALE ? 'bg-blue-400' : 'bg-pink-400'}`} />
                        <span>{p.name}</span>
                        {avoidCount > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            isSelected ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
                          }`}>
                            {avoidCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Multi-select avoided players for the selected player */}
              {selectedPlayer && (
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <UserX size={14} className="text-rose-500" />
                        步驟 2：點選【{selectedPlayer.name}】不想同場的人 (可單選或複選)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        被勾選的選手將永遠不會與【{selectedPlayer.name}】排在同一場地比賽
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {targetAvoidIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTargetAvoidIds([])}
                          className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          全部取消
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search filter for candidates */}
                  {candidatePlayers.length > 6 && (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜尋其他球員姓名..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Candidate Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {filteredCandidates.map(candidate => {
                      const isAvoided = targetAvoidIds.includes(candidate.id);

                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => handleToggleTarget(candidate.id)}
                          className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-between text-left ${
                            isAvoided
                              ? 'bg-rose-500 border-rose-600 text-white shadow-xs ring-1 ring-rose-400'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${candidate.gender === Gender.MALE ? 'bg-blue-400' : 'bg-pink-400'}`} />
                            <span className="truncate">{candidate.name}</span>
                          </div>
                          {isAvoided ? (
                            <span className="text-[10px] bg-white text-rose-600 rounded px-1.5 py-0.2 font-black shrink-0 ml-1">
                              迴避
                            </span>
                          ) : (
                            <span className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 shrink-0 ml-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Actions for this player */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-750">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      已選擇 <strong className="text-rose-600 dark:text-rose-400">{targetAvoidIds.length}</strong> 位不想同場球員
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClearForSelectedPlayer}
                        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
                      >
                        清空設定
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveForSelectedPlayer}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <Check size={14} />
                        儲存【{selectedPlayer.name}】的迴避名單
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Avoid Pairs Table / Chips */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Users size={14} className="text-slate-500" />
                    目前已生效的迴避同場名單 ({activeAvoidPairsDetailed.length} 組)
                  </h3>
                  {activeAvoidPairsDetailed.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('確定要清除全部的迴避同場名單嗎？')) {
                          clearAvoidPairs();
                          setTargetAvoidIds([]);
                        }
                      }}
                      className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1"
                    >
                      <Trash2 size={12} /> 全部清空
                    </button>
                  )}
                </div>

                {activeAvoidPairsDetailed.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl text-xs text-slate-400 font-bold border border-dashed border-slate-200 dark:border-slate-700">
                    目前尚未設定任何同場迴避名單（所有選手皆能自由搭檔或對戰）
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeAvoidPairsDetailed.map(({ p1, p2 }) => (
                      <div
                        key={`${p1.id}-${p2.id}`}
                        className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-2.5 py-1 text-xs font-bold text-rose-800 dark:text-rose-200 shadow-xs"
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${p1.gender === Gender.MALE ? 'bg-blue-400' : 'bg-pink-400'}`} />
                          <span>{p1.name}</span>
                        </div>
                        <span className="text-rose-400 font-black text-[10px]">🚫 不可同場 🚫</span>
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${p2.gender === Gender.MALE ? 'bg-blue-400' : 'bg-pink-400'}`} />
                          <span>{p2.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAvoidPair(p1.id, p2.id)}
                          className="ml-1 p-0.5 text-rose-400 hover:text-rose-700 rounded transition-colors"
                          title="移除此組迴避"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>設定即時儲存於當前球團中，產生比賽與下一組排點時立即生效</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-black rounded-xl transition-colors"
          >
            完成
          </button>
        </div>

      </div>
    </div>
  );
};

export default AvoidPlayersModal;
