import React, { useState, useRef } from 'react';
import { X, CheckCircle2, Circle, Upload, Trash2, DollarSign, Wallet, Users, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../store/useStore';

interface PaymentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PaymentManagerModal: React.FC<PaymentManagerModalProps> = ({ isOpen, onClose }) => {
  const { players, paymentInfo, setPaymentInfo, paidPlayerIds, togglePlayerPaid, clearAllPayments } = useStore();
  const [activeTab, setActiveTab] = useState<'status' | 'settings'>('status');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB to keep localStorage happy)
    if (file.size > 2 * 1024 * 1024) {
      alert('圖片太大，請上傳小於 2MB 的圖片');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      // Compress image
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPaymentInfo({ ...paymentInfo, qrCode: compressedDataUrl });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveQR = () => {
    setPaymentInfo({ ...paymentInfo, qrCode: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const unpaidPlayers = players.filter(p => !paidPlayerIds.includes(p.id));
  const paidPlayers = players.filter(p => paidPlayerIds.includes(p.id));

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-amber-500 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Wallet size={20} />
            <span>臨打收費管理</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold text-sm transition-colors relative ${
              activeTab === 'status' 
                ? 'text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-800' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            <Users size={16} />
            繳費狀態 ({paidPlayers.length}/{players.length})
            {activeTab === 'status' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold text-sm transition-colors relative ${
              activeTab === 'settings' 
                ? 'text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-800' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            <DollarSign size={16} />
            收費資訊設定
            {activeTab === 'settings' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"></div>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6 bg-white dark:bg-slate-800">
          
          {activeTab === 'status' && (
            <div className="space-y-6">
              
              {/* Info Bar */}
              {(paymentInfo.amount || paymentInfo.account || paymentInfo.qrCode) && (
                <div className="bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 p-3 rounded-xl text-sm space-y-1">
                  {paymentInfo.amount && <div><span className="font-bold">收費金額：</span>{paymentInfo.amount}</div>}
                  {paymentInfo.account && <div><span className="font-bold">匯款帳號：</span><span className="font-mono">{paymentInfo.account}</span></div>}
                  {paymentInfo.qrCode && <div className="font-bold text-amber-600 flex items-center gap-1"><CheckCircle2 size={14}/> 已設定收款 QR Code</div>}
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-700 dark:text-slate-200">還沒付錢的 (${unpaidPlayers.length} 人)</h3>
                {paidPlayers.length > 0 && (
                  <button 
                    onClick={() => {
                        const confirmBox = window.confirm('確定要清除所有人的繳費紀錄嗎？');
                        if (confirmBox) clearAllPayments();
                    }}
                    className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-md transition-colors"
                  >
                    重置所有人為未繳
                  </button>
                )}
              </div>

              {unpaidPlayers.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  <p className="text-emerald-500 font-bold flex items-center justify-center gap-2">
                    <CheckCircle2 /> {players.length > 0 ? '太棒了！大家都付錢了！' : '目前沒有選手'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {unpaidPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePlayerPaid(p.id)}
                      className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors text-left"
                    >
                      <Circle className="text-slate-300 dark:text-slate-500" size={18} />
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {paidPlayers.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
                  <h3 className="font-bold text-emerald-600 dark:text-emerald-500 mb-3 flex items-center gap-2">
                    <CheckCircle2 size={16} /> 已繳費 (${paidPlayers.length} 人)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {paidPlayers.map(p => (
                      <button
                        key={p.id}
                        onClick={() => togglePlayerPaid(p.id)}
                        className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:hover:bg-emerald-900/40 transition-colors text-left"
                      >
                        <CheckCircle2 className="text-emerald-500 dark:text-emerald-400" size={18} />
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 truncate">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  每人應繳金額 (例: 150)
                </label>
                <input 
                  type="text" 
                  value={paymentInfo.amount}
                  onChange={(e) => setPaymentInfo({ ...paymentInfo, amount: e.target.value })}
                  placeholder="輸入金額"
                  className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  匯款帳號 (銀行代碼 / 帳號)
                </label>
                <input 
                  type="text" 
                  value={paymentInfo.account}
                  onChange={(e) => setPaymentInfo({ ...paymentInfo, account: e.target.value })}
                  placeholder="例如: 822 (中國信託) 123456789"
                  className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all font-mono placeholder:font-sans"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  收款 QR Code (LINE Pay / 街口 / 網銀)
                </label>
                
                {paymentInfo.qrCode ? (
                  <div className="mt-2 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center gap-3">
                    <img src={paymentInfo.qrCode} alt="Payment QR Code" className="w-48 h-48 object-contain rounded-lg shadow-sm bg-white" />
                    <button 
                      onClick={handleRemoveQR}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                    >
                      <Trash2 size={16} /> 移除 QR Code
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 relative">
                    <input 
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
                      <ImageIcon size={32} className="text-slate-400 dark:text-slate-500" />
                      <span className="font-bold">點擊上傳或是拍照</span>
                      <span className="text-xs">支援 JPG, PNG</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PaymentManagerModal;
