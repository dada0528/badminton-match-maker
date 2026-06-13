import React, { useState, useEffect } from 'react';
import { X, Upload, Check, AlertCircle, ArrowRight, Trash2 } from 'lucide-react';
import { Gender } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (players: { name: string; gender: Gender }[]) => void;
  existingNames: Set<string>;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, existingNames }) => {
  const [text, setText] = useState('');
  const [parsedPlayers, setParsedPlayers] = useState<{ name: string; gender: Gender; isDuplicate: boolean }[]>([]);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setParsedPlayers([]);
    }
  }, [isOpen]);

  useEffect(() => {
    parseText(text);
  }, [text]);

  const parseText = (input: string) => {
    // Split by newline or comma
    const rawItems = input.split(/[\n,，]/);
    const results: { name: string; gender: Gender; isDuplicate: boolean }[] = [];

    const numberedRegex = /^\s*\d+[.、．)\]\-]\s*(.+)$/;
    // Match Name+N, allowing for extra info after the number
    const plusNRegex = /^(.+?)\+(\d+)/;
    const hasNumberedFormat = rawItems.some(item => numberedRegex.test(item));

    rawItems.forEach(item => {
      let rawName = item.trim();
      if (!rawName) return;

      // Filter out metadata, headers, emojis, and long lines
      if (
        /[:：📍💰👉－]/.test(rawName) || 
        /^(時間|地點|日期|說明|人數|費用|備註|主揪|程度|固定報名|臨打報名)/.test(rawName) ||
        rawName.length > 20 || // Names are usually short
        /^\d+[:：]\d+/.test(rawName) || // Time format like 22:00
        rawName.includes('場') ||
        rawName.includes('$')
      ) {
        return;
      }

      let nameToProcess = '';

      if (hasNumberedFormat) {
        // Strict mode: only extract numbered items
        const match = rawName.match(numberedRegex);
        if (match) {
          nameToProcess = match[1].trim();
        }
      } else {
        nameToProcess = rawName;
      }

      if (nameToProcess) {
        const plusMatch = nameToProcess.match(plusNRegex);
        if (plusMatch) {
          const baseName = plusMatch[1].trim();
          const count = parseInt(plusMatch[2], 10);
          
          if (count <= 1) {
            results.push({
              name: baseName,
              gender: Gender.MALE,
              isDuplicate: existingNames.has(baseName)
            });
          } else {
            for (let i = 1; i <= count; i++) {
              const finalName = `${baseName} ${i}`;
              results.push({
                name: finalName,
                gender: Gender.MALE,
                isDuplicate: existingNames.has(finalName)
              });
            }
          }
        } else {
          // Only add if it doesn't look like a header or garbage
          if (nameToProcess.length <= 10 && !/^[0-9.-]+$/.test(nameToProcess)) {
            results.push({
              name: nameToProcess,
              gender: Gender.MALE,
              isDuplicate: existingNames.has(nameToProcess)
            });
          }
        }
      }
    });

    setParsedPlayers(results);
  };

  const toggleGender = (index: number) => {
    setParsedPlayers(prev => 
      prev.map((p, i) => 
        i === index 
          ? { ...p, gender: p.gender === Gender.MALE ? Gender.FEMALE : Gender.MALE }
          : p
      )
    );
  };

  const removePlayer = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setParsedPlayers(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    const validPlayers = parsedPlayers
      .filter(p => !p.isDuplicate)
      .map(p => ({ name: p.name, gender: p.gender }));
    
    onImport(validPlayers);
    onClose();
  };

  if (!isOpen) return null;

  const validCount = parsedPlayers.filter(p => !p.isDuplicate).length;
  const duplicateCount = parsedPlayers.filter(p => p.isDuplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
              <Upload size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">批次匯入名單</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Input Area */}
          <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col">
            <label className="text-sm font-bold text-slate-500 mb-2 block">
              貼上名單文字 (自動辨識 "數字.名字")
            </label>
            <textarea
              className="flex-1 w-full p-4 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-0 outline-none resize-none text-sm font-mono bg-slate-50 placeholder:text-slate-300"
              placeholder={`範例：\n1.大雄\n2.阿正+2\n3.坤+3\n...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {/* Preview Area */}
          <div className="flex-1 p-6 bg-slate-50/30 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-bold text-slate-500">
                預覽 ({validCount} 人)
              </label>
              <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">
                點擊名字切換性別
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {parsedPlayers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-sm">
                  <ArrowRight className="mb-2 opacity-50" />
                  <p>請在左側貼上名單</p>
                </div>
              ) : (
                parsedPlayers.map((player, idx) => (
                  <div 
                    key={idx}
                    onClick={() => !player.isDuplicate && toggleGender(idx)}
                    className={`
                      flex items-center justify-between p-3 rounded-xl border transition-all select-none
                      ${player.isDuplicate 
                        ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed' 
                        : 'bg-white cursor-pointer hover:shadow-md active:scale-98'
                      }
                      ${!player.isDuplicate && (player.gender === Gender.MALE ? 'border-blue-100 hover:border-blue-300' : 'border-pink-100 hover:border-pink-300')}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                        ${player.gender === Gender.MALE ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}
                      `}>
                        {player.gender === Gender.MALE ? '男' : '女'}
                      </div>
                      <span className={`font-bold ${player.isDuplicate ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {player.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {player.isDuplicate && (
                        <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                          <AlertCircle size={12} /> 已存在
                        </span>
                      )}
                      <button
                        onClick={(e) => removePlayer(idx, e)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="移除此名單"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {duplicateCount > 0 && (
              <div className="mt-2 text-xs text-center text-slate-400">
                已自動略過 {duplicateCount} 位重複球員
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleImport}
            disabled={validCount === 0}
            className="px-6 py-2.5 rounded-xl font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 active:scale-95"
          >
            <Check size={18} />
            匯入 {validCount} 位球員
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
