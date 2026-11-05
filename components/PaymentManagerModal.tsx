import React, { useState, useRef } from 'react';
import { X, CheckCircle2, Circle, Trash2, DollarSign, Wallet, Users, Image as ImageIcon, Crown, Copy, Check, Sparkles, ArrowRightLeft } from 'lucide-react';
import { useStore } from '../store/useStore';

interface PaymentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PaymentManagerModal: React.FC<PaymentManagerModalProps> = ({ isOpen, onClose }) => {
  const { 
    players, 
    paymentInfo, 
    setPaymentInfo, 
    paidPlayerIds, 
    togglePlayerPaid, 
    clearAllPayments,
    togglePlayerMember,
    setPlayerMember
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'status' | 'members' | 'settings'>('status');
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('圖片太大，請上傳小於 2MB 的圖片');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
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

  // Divide into Members vs Drop-ins
  const memberPlayers = players.filter(p => Boolean(p.isMember));
  const dropInPlayers = players.filter(p => !p.isMember);
  
  const unpaidDropIns = dropInPlayers.filter(p => !paidPlayerIds.includes(p.id));
  const paidDropIns = dropInPlayers.filter(p => paidPlayerIds.includes(p.id));

  const unitFee = parseFloat(paymentInfo.amount) || 0;
  const totalExpected = dropInPlayers.length * unitFee;
  const totalCollected = paidDropIns.length * unitFee;
  const totalOutstanding = unpaidDropIns.length * unitFee;

  const handleMarkAllDropInsPaid = () => {
    unpaidDropIns.forEach(p => {
      togglePlayerPaid(p.id);
    });
  };

  const handleCopyUnpaidList = () => {
    if (unpaidDropIns.length === 0) {
      setCopiedNotice('目前所有臨打球友皆已繳費！');
      setTimeout(() => setCopiedNotice(null), 2500);
      return;
    }

    const feeStr = unitFee > 0 ? `每人 $${unitFee} 元` : '';
    const names = unpaidDropIns.map(p => p.name).join('、');
    const text = `🏸【臨打費用提醒】${feeStr}\n尚有 ${unpaidDropIns.length} 位球友未繳費：${names}\n感謝大家的配合！`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotice('已複製未繳費名單到剪貼簿！');
      setTimeout(() => setCopiedNotice(null), 2500);
    }).catch(() => {
      setCopiedNotice('複製失敗，請手動複製');
      setTimeout(() => setCopiedNotice(null), 2500);
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 sm:p-5 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Wallet size={22} />
            </div>
            <div>
              <h2 className="font-black text-lg sm:text-xl tracking-tight leading-tight">
                收費記錄與管理
              </h2>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                臨打需收費 · 會員免當次收費並自動記憶
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white/90 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 font-bold text-xs sm:text-sm transition-all relative ${
              activeTab === 'status' 
                ? 'text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Wallet size={16} />
            <span>臨打收費 ({paidDropIns.length}/{dropInPlayers.length})</span>
            {activeTab === 'status' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"></div>
            )}
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 font-bold text-xs sm:text-sm transition-all relative ${
              activeTab === 'members' 
                ? 'text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-900' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Crown size={16} />
            <span>會員/臨打身分 ({memberPlayers.length}會員)</span>
            {activeTab === 'members' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"></div>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 font-bold text-xs sm:text-sm transition-all relative ${
              activeTab === 'settings' 
                ? 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <DollarSign size={16} />
            <span>收費設定</span>
            {activeTab === 'settings' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></div>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-5 bg-white dark:bg-slate-900">
          
          {/* TAB 1: Payment Status */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3 rounded-2xl text-center">
                  <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">臨打應收</div>
                  <div className="text-lg sm:text-xl font-black text-amber-900 dark:text-amber-200 mt-0.5">
                    ${totalExpected}
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    共 {dropInPlayers.length} 位臨打
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3 rounded-2xl text-center">
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">已收金額</div>
                  <div className="text-lg sm:text-xl font-black text-emerald-900 dark:text-emerald-200 mt-0.5">
                    ${totalCollected}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    已收 {paidDropIns.length} 人
                  </div>
                </div>

                <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 p-3 rounded-2xl text-center">
                  <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase">尚欠金額</div>
                  <div className="text-lg sm:text-xl font-black text-rose-900 dark:text-rose-200 mt-0.5">
                    ${totalOutstanding}
                  </div>
                  <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                    尚欠 {unpaidDropIns.length} 人
                  </div>
                </div>
              </div>

              {/* Toast Notice */}
              {copiedNotice && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Check size={14} /> {copiedNotice}</span>
                  <button onClick={() => setCopiedNotice(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                </div>
              )}

              {/* Info Bar with Account / Amount */}
              {(paymentInfo.amount || paymentInfo.account || paymentInfo.qrCode) && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-700 dark:text-slate-200">每人臨打費：</span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                        {paymentInfo.amount ? `$${paymentInfo.amount}` : '未設定'}
                      </span>
                    </div>
                    {paymentInfo.account && (
                      <div className="flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-300">
                        <span className="font-bold font-sans">帳號:</span> {paymentInfo.account}
                      </div>
                    )}
                  </div>
                  {paymentInfo.qrCode && (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 size={13} /> 已具備收款 QR Code
                    </div>
                  )}
                </div>
              )}

              {/* Unpaid Drop-in Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm">
                      待繳費臨打 ({unpaidDropIns.length} 人)
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    {unpaidDropIns.length > 0 && (
                      <>
                        <button 
                          onClick={handleCopyUnpaidList}
                          className="text-xs font-bold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center gap-1"
                          title="複製未繳名單至 LINE"
                        >
                          <Copy size={12} />
                          <span>複製未繳</span>
                        </button>
                        <button 
                          onClick={handleMarkAllDropInsPaid}
                          className="text-xs font-bold px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-300 rounded-lg transition-colors"
                        >
                          全部已繳
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {dropInPlayers.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      目前名單中沒有臨打球友（全體皆為正式會員）
                    </p>
                  </div>
                ) : unpaidDropIns.length === 0 ? (
                  <div className="text-center py-5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
                    <p className="text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={18} /> 所有臨打球友皆已繳費完畢！
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {unpaidDropIns.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition-all shadow-sm"
                      >
                        <button
                          onClick={() => togglePlayerPaid(p.id)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                          title="點擊標記為已繳費"
                        >
                          <Circle className="text-rose-400 dark:text-rose-500 shrink-0" size={18} />
                          <div className="min-w-0 truncate">
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate block">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-rose-500 font-extrabold">未繳費</span>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => togglePlayerPaid(p.id)}
                            className="text-xs font-bold px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-sm"
                          >
                            收費
                          </button>
                          <button
                            onClick={() => togglePlayerMember(p.id)}
                            className="text-[11px] font-bold px-2 py-1 bg-slate-100 hover:bg-purple-100 text-slate-500 hover:text-purple-700 dark:bg-slate-700 dark:hover:bg-purple-900/40 dark:text-slate-300 rounded-lg transition-colors"
                            title="轉為正式會員 (免收費)"
                          >
                            轉會員
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Paid Drop-in Section */}
              {paidDropIns.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <h3 className="font-black text-emerald-700 dark:text-emerald-400 text-sm">
                        已繳費臨打 ({paidDropIns.length} 人)
                      </h3>
                    </div>
                    <button 
                      onClick={() => {
                        if (window.confirm('確定要將所有人重置為未繳費狀態嗎？')) {
                          clearAllPayments();
                        }
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      重置為未繳
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {paidDropIns.map(p => (
                      <button
                        key={p.id}
                        onClick={() => togglePlayerPaid(p.id)}
                        className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:hover:bg-emerald-900/40 transition-colors text-left"
                        title="點擊切換為未繳費"
                      >
                        <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0" size={16} />
                        <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs truncate">
                          {p.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Member Exemption Section */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/60 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-black text-xs sm:text-sm">
                      <Crown size={16} className="text-purple-600 dark:text-purple-400" />
                      <span>正式會員名單 ({memberPlayers.length} 人 · 季繳免當次收費)</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('members')}
                      className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      管理身分
                    </button>
                  </div>
                  
                  {memberPlayers.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium">目前尚無指定會員，點擊上方分頁即可標記會員。</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {memberPlayers.map(p => (
                        <span
                          key={p.id}
                          className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800/80 rounded-lg text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1 shadow-2xs"
                        >
                          <span>{p.name}</span>
                          <span className="text-[10px] text-purple-500">免收</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Member / Drop-in Role Management */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-2xl border border-purple-200 dark:border-purple-800/60 flex items-start gap-2.5">
                <Sparkles size={18} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-900 dark:text-purple-300 leading-relaxed font-medium">
                  <span className="font-black">自動記憶功能：</span>
                  此處點選為<span className="font-bold text-purple-700 dark:text-purple-300">「會員」</span>的球員，系統會永久保存在目前球團記憶中。下次新開排點或批次加入時，將自動識別為會員，無須每次手動重新選擇！
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                <span>目前上場名單 ({players.length} 人)</span>
                <span>點擊切換身份</span>
              </div>

              {players.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 font-bold text-sm">
                  目前上場名單為空，請先加入球員
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                  {players.map(p => {
                    const isMem = Boolean(p.isMember);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                          isMem 
                            ? 'bg-purple-50/70 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800/70' 
                            : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/70'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">{isMem ? '👑' : '🏸'}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                            {p.name}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => togglePlayerMember(p.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs ${
                            isMem
                              ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-500/20'
                              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
                          }`}
                        >
                          <ArrowRightLeft size={11} />
                          <span>{isMem ? '會員 (免收)' : '臨打 (需收)'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  每位臨打應繳金額 (NT$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input 
                    type="number" 
                    min="0"
                    value={paymentInfo.amount}
                    onChange={(e) => setPaymentInfo({ ...paymentInfo, amount: e.target.value })}
                    placeholder="例: 150"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl pl-8 pr-4 py-2.5 font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  收款匯款帳號 (銀行代碼 / 帳號)
                </label>
                <input 
                  type="text" 
                  value={paymentInfo.account}
                  onChange={(e) => setPaymentInfo({ ...paymentInfo, account: e.target.value })}
                  placeholder="例如: 822 (中國信託) 123456789"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono placeholder:font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  收款 QR Code (LINE Pay / 街口 / 網銀收款碼)
                </label>
                
                {paymentInfo.qrCode ? (
                  <div className="mt-2 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col items-center gap-3">
                    <img src={paymentInfo.qrCode} alt="Payment QR Code" className="w-48 h-48 object-contain rounded-xl shadow-md bg-white p-2" />
                    <button 
                      onClick={handleRemoveQR}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors text-xs"
                    >
                      <Trash2 size={15} /> 移除 QR Code
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 relative">
                    <input 
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400">
                      <ImageIcon size={32} className="text-slate-400 dark:text-slate-500" />
                      <span className="font-bold text-sm">點擊上傳收款 QR Code 圖片</span>
                      <span className="text-[11px] text-slate-400">支援 JPG、PNG 格式</span>
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
