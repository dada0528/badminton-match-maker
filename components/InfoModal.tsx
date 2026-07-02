import React from 'react';
import { X, Star, BookOpen, CheckCircle2, Users, Monitor, Share2, PlayCircle } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'features' | 'guide';
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  const features = [
    {
      title: '智慧分隊邏輯',
      icon: <Star className="text-amber-500" size={20} />,
      items: ['多種對戰模式：支援隨機、混雙、純男雙、純女雙', '公平性演算法：自動平衡上場次數，盡量交換隊友', '性別平衡：可開啟避免男男 vs 女女功能']
    },
    {
      title: '強大的名單管理',
      icon: <Users className="text-blue-500" size={20} />,
      items: ['批次匯入：自動過濾 Line 訊息雜訊，精準提取人名', '加人邏輯 (+N)：支援「阿正+2」自動拆解為多人', '歷史名單：自動記憶球友，下次點擊快速加入']
    },
    {
      title: '專業場地顯示',
      icon: <Monitor className="text-emerald-500" size={20} />,
      items: ['多場地支援：同時管理多個球場進度', '全螢幕看板：支援橫屏投放，現場一目了然', '語音播報：一鍵廣播對戰名單，提醒球員上場']
    },
    {
      title: '記錄與分享',
      icon: <Share2 className="text-purple-500" size={20} />,
      items: ['計分功能：自由選擇是否開啟比分輸入', '圖片匯出：將賽程表轉為圖片，輕鬆分享群組']
    }
  ];

  const guideSteps = [
    {
      step: '1',
      title: '準備名單',
      content: '在「球員名單管理」手動輸入或點擊「批次匯入」。貼上報名訊息後系統會自動過濾雜訊。'
    },
    {
      step: '2',
      title: '設定賽程',
      content: '設定球場數量，勾選「盡量交換隊友」或「避免男男 vs 女女」。可指定首場球員。'
    },
    {
      step: '3',
      title: '開始排程',
      content: '點擊對戰模式（如：一般隨機）產生組合。進入全螢幕模式可點擊喇叭進行語音廣播。'
    },
    {
      step: '4',
      title: '接續比賽',
      content: '比賽結束點擊「結束比賽並安排下一組」。系統會自動從休息區挑選最合適的人選。'
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${type === 'features' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
              {type === 'features' ? <Star size={22} /> : <BookOpen size={22} />}
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
              {type === 'features' ? '🌟 功能介紹' : '📖 使用方法'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all active:scale-90"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {type === 'features' ? (
            <div className="grid gap-6">
              {features.map((f, i) => (
                <div key={i} className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-3 mb-3">
                    {f.icon}
                    <h4 className="font-black text-slate-800 dark:text-slate-200">{f.title}</h4>
                  </div>
                  <ul className="space-y-2">
                    {f.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {guideSteps.map((s, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shrink-0 shadow-lg shadow-blue-200 dark:shadow-none">
                      {s.step}
                    </div>
                    {i !== guideSteps.length - 1 && <div className="w-0.5 flex-1 bg-blue-100 dark:bg-slate-700 my-1"></div>}
                  </div>
                  <div className="pb-6">
                    <h4 className="font-black text-slate-800 dark:text-slate-200 mb-1.5 text-lg">{s.title}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {s.content}
                    </p>
                  </div>
                </div>
              ))}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-3">
                <PlayCircle className="text-emerald-600 shrink-0" size={24} />
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">
                  準備好了嗎？現在就開始安排您的第一場精彩對戰吧！
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-center">
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-10 py-3 rounded-2xl font-black bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-all active:scale-95 shadow-xl"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
