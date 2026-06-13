import React, { useState, useEffect } from 'react';
import { X, Calculator, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';

interface Provider {
  id: string;
  name: string;
  quantity: number;
}

interface FeeCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeeCalculatorModal: React.FC<FeeCalculatorModalProps> = ({ isOpen, onClose }) => {
  const { players } = useStore();
  
  const [peopleCount, setPeopleCount] = useState<number>(players.length || 1);
  const [courtFee, setCourtFee] = useState<number>(0);
  const [shuttlecockPrice, setShuttlecockPrice] = useState<number>(0);
  const [shuttlecockUsed, setShuttlecockUsed] = useState<number>(0);
  
  const [enableProviders, setEnableProviders] = useState<boolean>(false);
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPeopleCount(players.length || 1);
    }
  }, [isOpen, players.length]);

  if (!isOpen) return null;

  const totalShuttlecockCost = shuttlecockPrice * shuttlecockUsed;
  const totalCost = courtFee + totalShuttlecockCost;
  const averageFee = peopleCount > 0 ? Math.ceil(totalCost / peopleCount) : 0;

  const addProvider = () => {
    setProviders([...providers, { id: Date.now().toString(), name: '', quantity: 1 }]);
  };

  const updateProvider = (id: string, field: keyof Provider, value: string | number) => {
    setProviders(providers.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProvider = (id: string) => {
    setProviders(providers.filter(p => p.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-emerald-500 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Calculator size={20} />
            <span>臨打費計算機</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          
          {/* Basic Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">總人數</label>
              <input 
                type="number" 
                min="1"
                value={peopleCount || ''} 
                onChange={(e) => setPeopleCount(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-100 border-none rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">場地費總計</label>
              <input 
                type="number" 
                min="0"
                value={courtFee || ''} 
                onChange={(e) => setCourtFee(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-100 border-none rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">球單價</label>
                <input 
                  type="number" 
                  min="0"
                  value={shuttlecockPrice || ''} 
                  onChange={(e) => setShuttlecockPrice(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-100 border-none rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">使用球數</label>
                <input 
                  type="number" 
                  min="0"
                  value={shuttlecockUsed || ''} 
                  onChange={(e) => setShuttlecockUsed(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-100 border-none rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Providers Toggle */}
          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={enableProviders}
                onChange={(e) => setEnableProviders(e.target.checked)}
                className="w-5 h-5 text-emerald-500 rounded focus:ring-emerald-500 border-slate-300"
              />
              <span className="font-bold text-slate-700">有人幫忙出球嗎？</span>
            </label>

            {enableProviders && (
              <div className="mt-3 space-y-3">
                {providers.map((provider, index) => (
                  <div key={provider.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input 
                      type="text" 
                      placeholder="名字"
                      value={provider.name}
                      onChange={(e) => updateProvider(provider.id, 'name', e.target.value)}
                      className="flex-1 bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        min="1"
                        placeholder="顆數"
                        value={provider.quantity || ''}
                        onChange={(e) => updateProvider(provider.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-16 bg-white border-none rounded-lg px-2 py-2 text-sm font-bold text-slate-700 text-center focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-500 font-bold">顆</span>
                    </div>
                    <button 
                      onClick={() => removeProvider(provider.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={addProvider}
                  className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-xl hover:border-emerald-400 hover:text-emerald-500 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={16} /> 新增出球人
                </button>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
            <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
              <Calculator size={18} />
              計算結果
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>總費用 (場地 {courtFee} + 球 {totalShuttlecockCost})</span>
                <span className="font-bold text-slate-800">${totalCost}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>一般人應繳 (平均每人)</span>
                <span className="font-bold text-emerald-600 text-lg">${averageFee}</span>
              </div>
              
              {enableProviders && providers.length > 0 && (
                <div className="pt-3 mt-3 border-t border-emerald-200/50 space-y-2">
                  <div className="font-bold text-emerald-800 text-xs mb-2">出球人應繳 (已扣除球錢)：</div>
                  {providers.map(p => {
                    const providedValue = p.quantity * shuttlecockPrice;
                    const finalFee = averageFee - providedValue;
                    return (
                      <div key={p.id} className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                        <span className="font-bold text-slate-700">{p.name || '未命名'} <span className="text-xs text-slate-400 font-normal">({p.quantity}顆 = ${providedValue})</span></span>
                        <span className={`font-bold ${finalFee < 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                          {finalFee < 0 ? `退 $${Math.abs(finalFee)}` : `$${finalFee}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const { paymentInfo, setPaymentInfo } = useStore.getState();
                setPaymentInfo({ ...paymentInfo, amount: averageFee.toString() });
                alert(`已將金額設定為 $${averageFee}`);
              }}
              className="mt-4 w-full py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              設定為收費金額
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FeeCalculatorModal;
