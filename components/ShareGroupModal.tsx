import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Clock, Award, DollarSign, Layers, Users, Copy, Check, FileText } from 'lucide-react';
import { Player, Gender } from '../types';
import { useStore } from '../store/useStore';

interface ShareGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getTodayISOString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateToChinese = (isoString: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayName = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${month}/${date} ${dayName}`;
};

export const ShareGroupModal: React.FC<ShareGroupModalProps> = ({ isOpen, onClose }) => {
  const { players } = useStore();

  // Local config states with localStorage persistence
  const [selectedDate, setSelectedDate] = useState(() => localStorage.getItem('badminton_share_iso_date') || getTodayISOString());
  const [venue, setVenue] = useState(() => localStorage.getItem('badminton_share_venue') || '冠羽');
  const [startTime, setStartTime] = useState(() => localStorage.getItem('badminton_share_start_time') || '10:00');
  const [endTime, setEndTime] = useState(() => localStorage.getItem('badminton_share_end_time') || '12:00');
  const [level, setLevel] = useState(() => localStorage.getItem('badminton_share_level') || '3-6');
  const [fee, setFee] = useState(() => localStorage.getItem('badminton_share_fee') || '場地球均分');
  const [courts, setCourts] = useState<number>(() => {
    const saved = localStorage.getItem('badminton_share_courts');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [maxPlayers, setMaxPlayers] = useState<number>(() => {
    const saved = localStorage.getItem('badminton_share_max_players');
    return saved ? parseInt(saved, 10) : 8;
  });
  const [includeSuspended, setIncludeSuspended] = useState<boolean>(() => {
    const saved = localStorage.getItem('badminton_share_include_suspended');
    return saved === 'true';
  });

  const [generatedText, setGeneratedText] = useState('');
  const [copied, setCopied] = useState(false);

  // Save config values to localStorage when they change
  useEffect(() => {
    localStorage.setItem('badminton_share_iso_date', selectedDate);
    localStorage.setItem('badminton_share_venue', venue);
    localStorage.setItem('badminton_share_start_time', startTime);
    localStorage.setItem('badminton_share_end_time', endTime);
    localStorage.setItem('badminton_share_level', level);
    localStorage.setItem('badminton_share_fee', fee);
    localStorage.setItem('badminton_share_courts', courts.toString());
    localStorage.setItem('badminton_share_max_players', maxPlayers.toString());
    localStorage.setItem('badminton_share_include_suspended', includeSuspended.toString());
  }, [selectedDate, venue, startTime, endTime, level, fee, courts, maxPlayers, includeSuspended]);

  // Generate text whenever inputs or players change
  useEffect(() => {
    // Filter players based on includeSuspended toggle
    const filteredPlayers = players.filter(p => includeSuspended || p.status !== 'SUSPENDED');
    const formattedDate = formatDateToChinese(selectedDate);
    const formattedTime = `${startTime}-${endTime}`;

    let result = `${formattedDate} ，${venue}\n`;
    result += `時間:${formattedTime}\n`;
    result += `等級:${level}\n`;
    result += `費用:${fee}\n`;

    const totalSlots = Math.max(filteredPlayers.length, courts * maxPlayers);
    for (let i = 1; i <= totalSlots; i++) {
      const p = filteredPlayers[i - 1];
      const name = p ? p.name : '';
      result += `${i}.${name}\n`;
    }

    result += `\n記得要穿羽球鞋，臨時不能來請提前告知，謝謝！`;

    setGeneratedText(result);
  }, [selectedDate, venue, startTime, endTime, level, fee, courts, maxPlayers, includeSuspended, players, isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(generatedText);
      } else {
        // Fallback for older or restricted environments (like iframes without clipboard permissions)
        const textarea = document.createElement('textarea');
        textarea.value = generatedText;
        textarea.style.position = 'fixed'; // Avoid scrolling to bottom
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 dark:bg-emerald-950/50 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
              <FileText size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white italic tracking-tight">分享揪團訊息</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row">
          
          {/* Left: Inputs configuration */}
          <div className="w-full md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 flex flex-col gap-4 overflow-y-auto">
            <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">揪團資訊設定</h4>
            
            {/* Date Input */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                活動日期 (直接點選日曆)
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all cursor-pointer"
              />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1 block">
                自動同步格式：{formatDateToChinese(selectedDate)}
              </span>
            </div>

            {/* Venue Input */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <MapPin size={14} className="text-slate-400" />
                球場名稱
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="例如：冠羽"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all"
              />
            </div>

            {/* Time Input */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                活動時間 (選擇開始與結束時間)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">自</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">至</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all cursor-pointer"
                  />
                </div>
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1 block">
                自動同步格式：{startTime}-{endTime}
              </span>
            </div>

            {/* Level Input */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <Award size={14} className="text-slate-400" />
                球員等級 (程度)
              </label>
              <input
                type="text"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="例如：3-6"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all"
              />
            </div>

            {/* Fee Input */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <DollarSign size={14} className="text-slate-400" />
                費用說明
              </label>
              <input
                type="text"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="例如：場地球均分 或 150元"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Courts Count */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Layers size={14} className="text-slate-400" />
                  球場數量 (幾面)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={courts}
                  onChange={(e) => setCourts(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all"
                />
              </div>

              {/* Max Players per Court */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  每場上限人數
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Math.max(1, parseInt(e.target.value, 10) || 8))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all"
                />
              </div>
            </div>

            {/* Toggle Include Suspended */}
            <div className="mt-2 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block">包含暫停 (臨下場) 的球員</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">開啟時，會將標記為臨時休息的球員也排入報名清單中</span>
              </div>
              <label className="relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={includeSuspended}
                  onChange={(e) => setIncludeSuspended(e.target.checked)}
                />
                <div className={`w-9 h-5 rounded-full transition-colors duration-200 ${includeSuspended ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                <span className={`absolute left-[2px] h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${includeSuspended ? 'translate-x-4' : 'translate-x-[2px]'} shadow-sm`} />
              </label>
            </div>
          </div>

          {/* Right: Preview & Editable textarea */}
          <div className="w-full md:w-1/2 p-6 bg-slate-50 dark:bg-slate-900/30 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                訊息預覽與手動編輯
              </label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-2 py-1 rounded-full shadow-sm">
                可在此直接修改文字
              </span>
            </div>

            <textarea
              className="flex-1 w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-emerald-400 focus:ring-0 outline-none resize-none text-sm font-mono bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 leading-relaxed shadow-inner"
              style={{ minHeight: '260px' }}
              value={generatedText}
              onChange={(e) => setGeneratedText(e.target.value)}
              placeholder="揪團訊息生成中..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm"
          >
            取消
          </button>
          <button 
            onClick={handleCopy}
            className={`px-6 py-2.5 rounded-xl font-bold text-white transition-all flex items-center gap-2 active:scale-95 shadow-lg text-sm ${
              copied 
                ? 'bg-emerald-600 shadow-emerald-200 dark:shadow-none' 
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200 dark:shadow-none'
            }`}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? '已複製揪團訊息！' : '複製揪團訊息'}
          </button>
        </div>
      </div>
    </div>
  );
};
