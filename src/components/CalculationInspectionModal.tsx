import React, { useState } from 'react';
import { Calculation, getCalculationSteps } from '../utils/calculationNormalizer';
import { X, CheckCircle, Calculator, Smartphone, Globe, Printer, Edit, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

interface CalculationInspectionModalProps {
  calc: Calculation | null;
  onClose: () => void;
  onEdit?: (calc: Calculation) => void;
  onOpenMemo?: (calc: Calculation) => void;
  language: 'bn' | 'en';
  toBengaliDigits: (num: number | string) => string;
}

export function CalculationInspectionModal({
  calc,
  onClose,
  onEdit,
  onOpenMemo,
  language,
  toBengaliDigits
}: CalculationInspectionModalProps) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  if (!calc) return null;

  const steps = getCalculationSteps(calc);
  const isBn = language === 'bn';

  const handleCopyRaw = () => {
    const rawData = calc.rawSnapshot || calc;
    navigator.clipboard.writeText(JSON.stringify(rawData, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const formattedDate = (calc.timestamp && !isNaN(new Date(calc.timestamp).getTime()))
    ? new Date(calc.timestamp).toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : (calc.date || steps.formattedDate || '—');

  const formattedTime = (calc.timestamp && !isNaN(new Date(calc.timestamp).getTime()))
    ? new Date(calc.timestamp).toLocaleTimeString(isBn ? 'bn-BD' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : (steps.formattedTime !== '—' ? steps.formattedTime : '');

  const isAndroid = steps.sourceDevice === 'android';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs font-sans overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full overflow-hidden flex flex-col my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header with Origin Badge */}
        <div className="bg-slate-950 p-4 sm:p-5 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isAndroid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
              {isAndroid ? <Smartphone size={20} /> : <Globe size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  {isBn ? 'হিসাব যাচাই ও সম্পূর্ণ হিসাব বিবরণী' : 'Calculation Body & Audit Verification'}
                </h3>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isAndroid 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                }`}>
                  {isAndroid ? (isBn ? '📱 অ্যান্ড্রয়েড অ্যাপ' : '📱 Android App') : (isBn ? '💻 ওয়েব অ্যাপ' : '💻 Web App')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                ID: {calc.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title={isBn ? 'বন্ধ করুন' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-slate-800 dark:text-slate-100">
          
          {/* Top Quick Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">{isBn ? 'চালান নং' : 'Challan No'}</span>
              <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                #{calc.challanNo !== undefined ? (isBn ? toBengaliDigits(calc.challanNo) : calc.challanNo) : '---'}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">{isBn ? 'গেট এন্ট্রি নং' : 'Gate Entry'}</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                {calc.getEntryNo !== undefined ? (isBn ? toBengaliDigits(calc.getEntryNo) : calc.getEntryNo) : '---'}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">{isBn ? 'তারিখ' : 'Date'}</span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate">
                {formattedDate}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">{isBn ? 'অপারেটর' : 'Operator'}</span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate" title={calc.createdBy || calc.operatorEmail || 'Guest'}>
                {calc.createdByName || calc.operatorEmail || calc.createdBy || 'Guest'}
              </span>
            </div>
          </div>

          {/* Seller Profile Bar */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-yellow-800 dark:text-yellow-400">
                {isBn ? 'বিক্রেতা বিবরণ' : 'Seller Profile'}
              </span>
              <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                {calc.sellerName || (isBn ? 'অজ্ঞাত বিক্রেতা' : 'Unknown Seller')}
              </div>
            </div>
            {calc.sellerPhone && (
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                📞 {calc.sellerPhone}
              </span>
            )}
          </div>

          {/* MAIN CALCULATION BODY: Mathematical Steps & Formula */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-900 dark:text-white">
                <Calculator size={15} className="text-yellow-500" />
                <span>{isBn ? 'সম্পূর্ণ গাণিতিক হিসাব বিবরণী (Calculation Body)' : 'Complete Calculation Body'}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {steps.monType} KG = 1 Mon
              </span>
            </div>

            {/* Step-by-step breakdown */}
            <div className="space-y-2.5 text-xs">
              
              {/* Step 1: Weight Input & Deduction */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold mb-1">
                  <span>{isBn ? 'ধাপ ১: পরিমাপ ও ওজন' : 'Step 1: Gross Weight & Deductions'}</span>
                  <span>{isBn ? 'কেজি এককে' : 'In Kilograms'}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {isBn ? 'মোট সংগৃহীত ওজন:' : 'Total Gross Weight:'}
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    {isBn ? `${toBengaliDigits(steps.grossKg)} কেজি` : `${steps.grossKg} KG`}
                  </span>
                </div>

                {steps.isMinus && steps.deductedKg > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[11px]">
                    <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                      <span>{isBn ? 'কর্তনকৃত ওজন (ধূলি/ব্যবধান):' : 'Deducted Weight (Dust/Moisture):'}</span>
                      <span>-{isBn ? `${toBengaliDigits(steps.deductedKg)} কেজি` : `${steps.deductedKg} KG`} ({steps.deductionPct.toFixed(1)}%)</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-black">
                      <span>{isBn ? 'নিট কার্যকর বিলিং ওজন:' : 'Net Billed Weight:'}</span>
                      <span>{isBn ? `${toBengaliDigits(steps.netKg)} কেজি` : `${steps.netKg} KG`}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Mon Conversion */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold mb-1">
                  <span>{isBn ? 'ধাপ ২: মণে রূপান্তর' : 'Step 2: Conversion to Mon System'}</span>
                  <span>{steps.monType} KG/Mon</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {isBn ? 'রূপান্তরিত ওজন:' : 'Converted Weight:'}
                  </span>
                  <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                    {isBn ? `${toBengaliDigits(steps.monCount)} মণ ${toBengaliDigits(steps.extraKg)} কেজি` : `${steps.monCount} Mon ${steps.extraKg} KG`}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>{isBn ? 'দশমিক সমতুল্য:' : 'Decimal Equivalent:'}</span>
                  <span>{steps.totalMon.toFixed(4)} Mon ({isBn ? `${steps.netKg} ÷ ${steps.monType}` : `${steps.netKg} / ${steps.monType}`})</span>
                </div>
              </div>

              {/* Step 3: Rate & Total Multiplication */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold mb-1">
                  <span>{isBn ? 'ধাপ ৩: দর ও সর্বমোট হিসাব' : 'Step 3: Rate & Payable Calculation'}</span>
                  <span>Rate Multiplier</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {isBn ? 'নির্ধারিত দর (প্রতি মণ):' : 'Rate per Mon:'}
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    ৳{isBn ? toBengaliDigits(steps.ratePerMon) : steps.ratePerMon}
                  </span>
                </div>
                {calc.isMinusCalculated && calc.targetMonPrice !== undefined && (
                  <div className="flex justify-between text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                    <span>{isBn ? 'কাঙ্ক্ষিত কার্যকর দর:' : 'Target Mon Price:'}</span>
                    <span>৳{calc.targetMonPrice}</span>
                  </div>
                )}
                
                {/* Full Mathematical Equation */}
                <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">{isBn ? 'পূর্ণাঙ্গ হিসাব সূত্র:' : 'Mathematical Expression:'}</span>
                  {steps.formulaString}
                </div>
              </div>

            </div>

            {/* Final Grand Total Banner */}
            <div className="bg-slate-900 text-yellow-400 p-4 rounded-xl flex items-center justify-between border border-slate-800 shadow-md">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  {isBn ? 'সর্বমোট প্রদেয় বিল' : 'TOTAL PAYABLE AMOUNT'}
                </span>
                <span className="text-2xl font-black">
                  ৳{Math.round(steps.totalPrice).toLocaleString()}
                </span>
              </div>
              <div className="text-right text-[10px] text-slate-400 font-mono">
                {isAndroid ? 'Android Stored: ' + (calc.totalAmount ? `৳${Math.round(calc.totalAmount).toLocaleString()}` : 'N/A') : 'Web Stored: ' + (calc.totalPrice ? `৳${Math.round(calc.totalPrice).toLocaleString()}` : 'N/A')}
              </div>
            </div>
          </div>

          {/* Transparent Raw Firestore Fields Inspector */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>{isBn ? '🔍 ফায়ারবেস সংরক্ষিত ডাটা ফিল্ড যাচাই (Stored Firestore Fields)' : '🔍 Inspect Stored Firestore Fields'}</span>
              {showRawJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showRawJson && (
              <div className="p-4 bg-slate-950 text-slate-200 text-xs font-mono space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Raw Document Payload</span>
                  <button
                    onClick={handleCopyRaw}
                    className="flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 transition-all cursor-pointer"
                  >
                    {copiedRaw ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedRaw ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'JSON কপি' : 'Copy JSON')}</span>
                  </button>
                </div>
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-emerald-400 max-h-52">
                  {JSON.stringify(calc.rawSnapshot || calc, null, 2)}
                </pre>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg text-xs transition-colors cursor-pointer"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>

          <div className="flex items-center gap-2">
            {onOpenMemo && (
              <button
                onClick={() => {
                  onClose();
                  onOpenMemo(calc);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-lg text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Printer size={13} />
                <span>{isBn ? 'মেমো ভিউ' : 'Memo View'}</span>
              </button>
            )}

            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(calc);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Edit size={13} />
                <span>{isBn ? 'সম্পাদনা' : 'Edit'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
