import React, { useState } from 'react';
import { X, Plus, Edit2, Check, Trash2, Shield, Users, ArrowRight, AlertTriangle, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';

interface ClubManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClubManagerModal: React.FC<ClubManagerModalProps> = ({ isOpen, onClose }) => {
  const { 
    clubs, 
    currentClubId, 
    addClub, 
    renameClub, 
    deleteClub, 
    switchClub,
    history,
    players
  } = useStore();

  const [newClubName, setNewClubName] = useState('');
  const [shouldCopyHistory, setShouldCopyHistory] = useState(false);
  const [copySourceClubId, setCopySourceClubId] = useState(currentClubId);
  const [editingClubId, setEditingClubId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingClubId, setDeletingClubId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateClub = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClubName.trim();
    if (!trimmed) {
      setErrorText('請輸入球團名稱！');
      return;
    }
    if (clubs.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorText('已存在相同名稱的球團，請使用不同名稱！');
      return;
    }

    addClub(trimmed, shouldCopyHistory ? copySourceClubId : undefined);
    setNewClubName('');
    setShouldCopyHistory(false);
    setErrorText(null);
    onClose();
  };

  const startRename = (id: string, currentName: string) => {
    setEditingClubId(id);
    setEditName(currentName);
  };

  const handleSaveRename = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    renameClub(id, trimmed);
    setEditingClubId(null);
    setEditName('');
  };

  const handleConfirmDelete = (id: string) => {
    deleteClub(id);
    setDeletingClubId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-850 bg-slate-50/95 dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-950/60 p-2.5 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <Shield size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                球團切換與管理
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                每個球團的名單與曾經加過的人各自獨立，開團互不干擾
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Section 1: Club List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} /> 我的球團列表 ({clubs.length})
              </span>
              <span className="text-[11px] text-slate-400 font-medium">點擊可直接切換球團</span>
            </div>

            <div className="space-y-2.5">
              {clubs.map((club) => {
                const isCurrent = club.id === currentClubId;
                const isEditing = editingClubId === club.id;
                const isDeleting = deletingClubId === club.id;
                // Live count for current club or snapshot for others
                const historyCount = isCurrent ? history.length : (club.history?.length || 0);
                const activePlayerCount = isCurrent ? players.length : (club.players?.length || 0);

                return (
                  <motion.div
                    layout
                    key={club.id}
                    className={`rounded-2xl border transition-all p-3.5 sm:p-4 ${
                      isCurrent 
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/80 shadow-sm' 
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {isDeleting ? (
                      /* Delete Confirmation Row */
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                          <AlertTriangle size={16} />
                          <span>確定要刪除「{club.name}」嗎？該團名單與排程將被刪除。</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => setDeletingClubId(null)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleConfirmDelete(club.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Trash2 size={13} /> 確認刪除
                          </button>
                        </div>
                      </div>
                    ) : isEditing ? (
                      /* Rename Input Row */
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(club.id);
                            if (e.key === 'Escape') setEditingClubId(null);
                          }}
                          autoFocus
                          placeholder="請輸入新球團名稱"
                          className="flex-1 px-3 py-1.5 rounded-xl border border-emerald-400 dark:border-emerald-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-white outline-none ring-2 ring-emerald-400/20"
                        />
                        <button
                          onClick={() => handleSaveRename(club.id)}
                          className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                          title="儲存"
                        >
                          <Check size={16} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => setEditingClubId(null)}
                          className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-600 dark:text-slate-300 transition-colors"
                          title="取消"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      /* Standard Club Display Row */
                      <div className="flex items-center justify-between gap-3">
                        <div 
                          onClick={() => !isCurrent && switchClub(club.id)}
                          className={`flex-1 min-w-0 ${!isCurrent ? 'cursor-pointer group' : ''}`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-black text-sm sm:text-base tracking-tight truncate ${
                              isCurrent 
                                ? 'text-emerald-700 dark:text-emerald-300' 
                                : 'text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                            }`}>
                              {club.name}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white shadow-sm">
                                使用中
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                            <span>歷史球員: <strong className="text-slate-700 dark:text-slate-300 font-bold">{historyCount}</strong> 人</span>
                            <span>·</span>
                            <span>上場名單: <strong className="text-slate-700 dark:text-slate-300 font-bold">{activePlayerCount}</strong> 人</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isCurrent ? (
                            <button
                              onClick={() => switchClub(club.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-all flex items-center gap-1 shadow-sm"
                            >
                              <span>切換</span>
                              <ArrowRight size={12} />
                            </button>
                          ) : null}

                          <button
                            onClick={() => startRename(club.id, club.name)}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="重新命名球團"
                          >
                            <Edit2 size={15} />
                          </button>

                          {clubs.length > 1 && (
                            <button
                              onClick={() => setDeletingClubId(club.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title="刪除此球團"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Create New Club Form */}
          <div className="bg-slate-100/70 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700/80">
            <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Plus size={14} /> 新增球團
            </h4>
            
            <form onSubmit={handleCreateClub} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                  球團名稱
                </label>
                <input
                  type="text"
                  value={newClubName}
                  onChange={(e) => {
                    setNewClubName(e.target.value);
                    if (errorText) setErrorText(null);
                  }}
                  placeholder="例如：冠羽週二團、週末同樂會、中原早鳥團..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all"
                />
              </div>

              {/* Option to copy history */}
              {clubs.length > 0 && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={shouldCopyHistory}
                      onChange={(e) => setShouldCopyHistory(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer w-4 h-4"
                    />
                    <span className="flex items-center gap-1">
                      <Copy size={13} className="text-slate-400" />
                      從現有球團複製歷史名單（選填）
                    </span>
                  </label>

                  {!shouldCopyHistory && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 pl-6">
                      * 未勾選：新球團將為全新空白名單（無任何歷史球員或上場球員）。
                    </p>
                  )}

                  {shouldCopyHistory && (
                    <div className="mt-2 pl-6">
                      <select
                        value={copySourceClubId}
                        onChange={(e) => setCopySourceClubId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                      >
                        {clubs.map((c) => (
                          <option key={c.id} value={c.id}>
                            複製自：{c.name} ({c.history?.length || 0} 位歷史球員)
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        * 複製後名單將成為全新獨立複本，後續在兩邊新增或刪除球員互不影響。
                      </p>
                    </div>
                  )}
                </div>
              )}

              {errorText && (
                <p className="text-xs text-red-500 font-bold flex items-center gap-1 pt-1">
                  <AlertTriangle size={13} /> {errorText}
                </p>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!newClubName.trim()}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                >
                  <Plus size={16} />
                  建立並切換至此球團
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Feature Explanations */}
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-xs text-amber-900 dark:text-amber-300 space-y-1.5 leading-relaxed font-medium">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
              💡 多球團獨立名單使用小撇步
            </div>
            <div>
              • <strong>名單完全獨立</strong>：每個球團的「歷史紀錄球員」和「上場名單」都是分開保存的。
            </div>
            <div>
              • <strong>輕鬆清理臨打球員</strong>：如果某位球友只來臨打一次，直接在該球團點垃圾桶刪除，完全不會影響到另一個球團的固定班底名單！
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default ClubManagerModal;
