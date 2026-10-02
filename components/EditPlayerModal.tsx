import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import { Gender, Player } from '../types';
import { useStore } from '../store/useStore';

interface EditPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: {
    id?: string;
    name: string;
    gender: Gender;
    level?: number;
    status?: string;
  } | null;
  isHistoryOnly?: boolean;
  onSaveSuccess?: () => void;
}

export const EditPlayerModal: React.FC<EditPlayerModalProps> = ({
  isOpen,
  onClose,
  player,
  isHistoryOnly = false,
  onSaveSuccess
}) => {
  const { updatePlayer, updateHistoryPlayer } = useStore();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (player && isOpen) {
      setName(player.name || '');
      setGender(player.gender || Gender.MALE);
      setError(null);
    }
  }, [player, isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !player) return null;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('請輸入球員姓名！');
      return;
    }

    let success = false;
    if (player.id && !isHistoryOnly) {
      success = updatePlayer(player.id, trimmed, gender);
    } else {
      success = updateHistoryPlayer(player.name, trimmed, gender);
    }

    if (success) {
      setError(null);
      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } else {
      setError('修改失敗，該姓名可能已存在或其他錯誤。');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <UserCheck size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  修改選手資料
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  臨時修正姓名與性別，即時同步賽程
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSave} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>選手姓名</span>
                <span className="text-[11px] font-normal text-slate-400">必填</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="請輸入選手姓名..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-all text-base placeholder:text-slate-400 placeholder:font-normal"
                />
                {name && (
                  <button
                    type="button"
                    onClick={() => setName('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Gender Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                生理性別 (影響男雙/女雙/混雙排點)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender(Gender.MALE)}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold border-2 transition-all active:scale-95 ${
                    gender === Gender.MALE
                      ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/60 dark:border-blue-500 dark:text-blue-300 shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <span className="text-xl">👦</span>
                  <span className="text-sm">男生 (Male)</span>
                  {gender === Gender.MALE && <Check size={16} className="text-blue-600 dark:text-blue-400 ml-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => setGender(Gender.FEMALE)}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold border-2 transition-all active:scale-95 ${
                    gender === Gender.FEMALE
                      ? 'bg-pink-50 border-pink-500 text-pink-700 dark:bg-pink-950/60 dark:border-pink-500 dark:text-pink-300 shadow-sm ring-2 ring-pink-500/20'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-pink-300 dark:hover:border-pink-700'
                  }`}
                >
                  <span className="text-xl">👧</span>
                  <span className="text-sm">女生 (Female)</span>
                  {gender === Gender.FEMALE && <Check size={16} className="text-pink-600 dark:text-pink-400 ml-1" />}
                </button>
              </div>
            </div>

            {/* Extra Sync Notice */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/60 flex items-start gap-2.5">
              <Sparkles size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                修改後將立即同步至<span className="font-bold text-slate-700 dark:text-slate-200">上場名單</span>、<span className="font-bold text-slate-700 dark:text-slate-200">即時場地賽程</span>與<span className="font-bold text-slate-700 dark:text-slate-200">球團歷史名單</span>，不會中斷當前輪替排點。
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-all"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-md shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Check size={16} strokeWidth={3} />
                儲存修改
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditPlayerModal;
