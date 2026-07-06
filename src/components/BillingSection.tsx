import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Printer, 
  FileSpreadsheet, 
  Calculator, 
  TrendingUp, 
  Users, 
  ChevronRight, 
  DollarSign,
  Briefcase
} from 'lucide-react';

interface Calculation {
  id: string;
  timestamp: number;
  sellerName: string;
  totalKg: number;
  monType: number;
  ratePerMon: number;
  totalMon: number;
  totalPrice: number;
  challanNo: number;
  createdBy: string;
  deductedWeight?: number;
  deductionPercentage?: number;
  isMinusCalculated?: boolean;
  targetMonPrice?: number;
  getEntryNo?: number;
  isDeleted?: boolean;
}

interface BillingSectionProps {
  calculations: Calculation[];
  language: 'bn' | 'en';
}

const toBengaliDigits = (num: number | string): string => {
  const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, d => bnNums[parseInt(d)]);
};

export default function BillingSection({ calculations, language }: BillingSectionProps) {
  // Setup default date range: past 7 days
  const todayStr = new Date().toISOString().split('T')[0];
  const lastWeekStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(lastWeekStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
  const [rateMode, setRateMode] = useState<'challan' | 'custom'>('challan');
  const [customRate, setCustomRate] = useState<string>('300');
  const [customMonType, setCustomMonType] = useState<number>(40);

  // Filter active (non-deleted) calculations in range
  const rangeCalculations = useMemo(() => {
    if (!startDate || !endDate) return [];
    
    const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
    const endTimestamp = new Date(endDate + 'T23:59:59').getTime();

    return calculations.filter(calc => {
      if (calc.isDeleted === true) return false;
      return calc.timestamp >= startTimestamp && calc.timestamp <= endTimestamp;
    });
  }, [calculations, startDate, endDate]);

  // List of unique sellers in selected date range
  const uniqueSellers = useMemo(() => {
    const sellers = new Set<string>();
    rangeCalculations.forEach(calc => {
      if (calc.sellerName) sellers.add(calc.sellerName.trim());
    });
    return Array.from(sellers);
  }, [rangeCalculations]);

  // Filter by seller if specified
  const filteredCalculations = useMemo(() => {
    if (selectedSeller === 'ALL') return rangeCalculations;
    return rangeCalculations.filter(calc => calc.sellerName.trim() === selectedSeller);
  }, [rangeCalculations, selectedSeller]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalKg = 0;
    let netKg = 0;
    let totalChallans = filteredCalculations.length;
    let totalMonDecimal = 0;
    let totalPriceByChallan = 0;

    filteredCalculations.forEach(calc => {
      totalKg += calc.totalKg;
      
      // Handle minus deduction weight if available
      const deduction = (calc.isMinusCalculated && calc.deductedWeight !== undefined) 
        ? calc.deductedWeight 
        : 0;
      const currentNetKg = Math.max(0, calc.totalKg - deduction);
      netKg += currentNetKg;

      // Use stored calculation mon type, default to 40
      const currentMonType = calc.monType || 40;
      totalMonDecimal += (currentNetKg / currentMonType);
      totalPriceByChallan += calc.totalPrice;
    });

    // Custom Rate Calculation: total mon decimal * custom rate per mon
    const finalRate = parseFloat(customRate) || 0;
    const totalPriceByCustomRate = totalMonDecimal * finalRate;

    return {
      totalKg,
      netKg,
      totalChallans,
      totalMonDecimal,
      totalPriceByChallan,
      totalPriceByCustomRate,
      grandTotal: rateMode === 'challan' ? totalPriceByChallan : totalPriceByCustomRate
    };
  }, [filteredCalculations, rateMode, customRate]);

  // Format date range display
  const dateRangeText = useMemo(() => {
    const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const locale = language === 'bn' ? 'bn-BD' : 'en-US';
    const sDate = new Date(startDate).toLocaleDateString(locale, opt);
    const eDate = new Date(endDate).toLocaleDateString(locale, opt);
    return language === 'bn' ? `${sDate} হতে ${eDate}` : `${sDate} to ${eDate}`;
  }, [startDate, endDate, language]);

  const statsMon = Math.floor(stats.netKg / customMonType);
  const statsKg = parseFloat((stats.netKg % customMonType).toFixed(2));

  return (
    <div className="space-y-6">
      {/* Prominent Header banner (Hidden on print) */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-6 shadow-xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-32 h-full bg-yellow-400 skew-x-12 opacity-10 translate-x-12"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-yellow-400 text-slate-950 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded border border-yellow-300">
              <span>🧾 BILL GENERATOR ENGINE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-yellow-400 tracking-tight font-sans">
              {language === 'bn' ? "সাপ্তাহিক ও কাস্টম বিলিং হিসাব" : "Weekly & Custom Billing Ledger"}
            </h1>
            <p className="text-xs text-slate-400 font-medium max-w-2xl leading-relaxed">
              {language === 'bn' 
                ? "নির্দিষ্ট সময়সীমার হিসাব অনুসারে মোট খড়ি ক্রয়ের কেজি, মন এবং প্রদেয় বিলের পরিমাণ অটো-সংশ্লেষণ করুন এবং সরাসরি প্রিন্টযোগ্য চালান মেমো তৈরি করুন।"
                : "Aggregate total wood cargo purchase in kilograms, converted mon unit, and estimated payout for custom durations. Instantly generate invoices."}
            </p>
          </div>
          
          <button
            onClick={() => window.print()}
            disabled={filteredCalculations.length === 0}
            className={`flex items-center gap-2 h-10 px-5 bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-800 text-slate-950 font-black text-xs uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95 cursor-pointer border border-yellow-300`}
          >
            <Printer size={14} />
            <span>{language === 'bn' ? 'বিল প্রিন্ট করুন' : 'Print Invoice'}</span>
          </button>
        </div>
      </div>

      {/* Control Filters Block (Hidden on print) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4 no-print">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-450 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          {language === 'bn' ? 'তারিখ ও হিসাব পরিসীমা নির্ধারণ' : 'Define Billing Duration & Parameters'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'শুরুর তারিখ (Start Date)' : 'Start Date'}
            </label>
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'শেষের তারিখ (End Date)' : 'End Date'}
            </label>
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-yellow-400"
              />
            </div>
          </div>

          {/* Seller Selection */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'বিক্রেতার ফিল্টার (Seller)' : 'Seller Filter'}
            </label>
            <div className="relative">
              <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-yellow-400 appearance-none"
              >
                <option value="ALL">{language === 'bn' ? 'সকল বিক্রেতা (All Sellers)' : 'All Sellers'}</option>
                {uniqueSellers.map(seller => (
                  <option key={seller} value={seller}>👤 {seller}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Weight Base Mon type */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'মন প্রতি কেজি (KG per Mon)' : 'KG per Mon'}
            </label>
            <div className="relative">
              <input 
                type="number"
                value={customMonType}
                onChange={(e) => setCustomMonType(parseInt(e.target.value) || 40)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                placeholder="40"
              />
            </div>
          </div>
        </div>

        {/* Pricing Strategy Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'মূল্য নির্ধারণের কৌশল (Pricing Method)' : 'Pricing Method'}
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRateMode('challan')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-extrabold transition-all cursor-pointer ${
                  rateMode === 'challan'
                    ? 'bg-yellow-400 border-yellow-400 text-slate-950 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <DollarSign size={14} />
                <span>{language === 'bn' ? 'চালানে সংরক্ষিত দরে হিসাব' : 'Use rates stored in challans'}</span>
              </button>

              <button
                type="button"
                onClick={() => setRateMode('custom')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-extrabold transition-all cursor-pointer ${
                  rateMode === 'custom'
                    ? 'bg-yellow-400 border-yellow-400 text-slate-950 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Calculator size={14} />
                <span>{language === 'bn' ? 'একটি নির্দিষ্ট দরে হিসাব' : 'Override with a custom rate'}</span>
              </button>
            </div>
          </div>

          {rateMode === 'custom' && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                {language === 'bn' ? 'নির্ধারিত কাস্টম দর (৳ প্রতি মন)' : 'Custom Rate (৳ per Mon)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 font-black text-xs">৳</span>
                <input 
                  type="number"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-black text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="300"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Aggregate Stats Cards (Hidden on print) */}
      {filteredCalculations.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print animate-fade-in">
          {/* Card 1: Total Wood Weight */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 shrink-0">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                {language === 'bn' ? 'মোট ওজন (Total Weight)' : 'Total Weight'}
              </p>
              <p className="text-sm font-black text-slate-850 dark:text-white font-mono mt-0.5">
                {language === 'bn' ? toBengaliDigits(stats.totalKg.toLocaleString()) : stats.totalKg.toLocaleString()} <span className="text-[10px] font-sans">KG</span>
              </p>
            </div>
          </div>

          {/* Card 2: Net Calculated weight */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 shrink-0">
              <Briefcase size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                {language === 'bn' ? 'রূপান্তরিত ওজন (Net Mon)' : 'Net Yield'}
              </p>
              <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                {language === 'bn' 
                  ? `${toBengaliDigits(statsMon)} মণ ${toBengaliDigits(statsKg)} কেজি` 
                  : `${statsMon} Mon ${statsKg} KG`}
              </p>
            </div>
          </div>

          {/* Card 3: Total Challans */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-green-600 shrink-0">
              <Users size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                {language === 'bn' ? 'মোট চালানের সংখ্যা' : 'Challan Volume'}
              </p>
              <p className="text-sm font-black text-green-600 dark:text-green-400 font-mono mt-0.5">
                {language === 'bn' ? `${toBengaliDigits(stats.totalChallans)} টি` : `${stats.totalChallans} Docs`}
              </p>
            </div>
          </div>

          {/* Card 4: Estimated Bill */}
          <div className="bg-yellow-400 border border-yellow-300 p-4 rounded-xl shadow-md flex items-center gap-4">
            <div className="p-3 rounded-lg bg-black/10 text-slate-900 shrink-0">
              <DollarSign size={18} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-900 tracking-wider opacity-70">
                {language === 'bn' ? 'সর্বমোট পরিশোধীয় বিল' : 'Estimated Payout'}
              </p>
              <p className="text-base font-black text-slate-950 font-mono mt-0.5">
                ৳{language === 'bn' ? toBengaliDigits(Math.round(stats.grandTotal).toLocaleString()) : Math.round(stats.grandTotal).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout / Table List & Preview Invoice */}
      {filteredCalculations.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 font-bold uppercase text-[10px]">
          {language === 'bn' 
            ? "নির্বাচিত সময়সীমার মধ্যে কোনো চালানের রেকর্ড পাওয়া যায়নি!" 
            : "No active calculation records found in specified date range!"}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Detailed table of calculations (Hidden on print) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm no-print">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {language === 'bn' ? 'চালানের বিস্তারিত বিবরণী' : 'Included Challan Specifications'}
              </h3>
              <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                {language === 'bn' ? `${toBengaliDigits(filteredCalculations.length)} টি রেকর্ড` : `${filteredCalculations.length} records`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-3 py-3">Challan</th>
                    <th className="px-3 py-3">Seller Name</th>
                    <th className="px-3 py-3">Weight (KG)</th>
                    <th className="px-3 py-3">Rate</th>
                    <th className="px-4 py-3 text-right">Total (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {filteredCalculations.map((calc) => {
                    const deduction = (calc.isMinusCalculated && calc.deductedWeight !== undefined) ? calc.deductedWeight : 0;
                    const netKg = Math.max(0, calc.totalKg - deduction);
                    const monType = calc.monType || 40;
                    const monVal = netKg / monType;
                    const displayPrice = rateMode === 'challan' 
                      ? calc.totalPrice 
                      : monVal * (parseFloat(customRate) || 0);

                    return (
                      <tr key={calc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {day: 'numeric', month: 'short'})}
                        </td>
                        <td className="px-3 py-3 font-bold text-rose-600">
                          #{calc.challanNo}
                        </td>
                        <td className="px-3 py-3 font-bold truncate max-w-[120px]">
                          {calc.sellerName}
                        </td>
                        <td className="px-3 py-3 font-semibold whitespace-nowrap">
                          <div>{calc.totalKg} KG</div>
                          {deduction > 0 && <div className="text-[9px] text-red-500">(-{deduction} KG)</div>}
                        </td>
                        <td className="px-3 py-3 font-semibold">
                          ৳{rateMode === 'challan' ? calc.ratePerMon : customRate}
                        </td>
                        <td className="px-4 py-3 font-black text-right text-slate-900 dark:text-white">
                          ৳{Math.round(displayPrice).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PRINTABLE BILL / INVOICE PREVIEW AREA */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden text-slate-900 print:border-none print:shadow-none print:p-0">
            {/* Action panel above invoice preview (Hidden on print) */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between no-print">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-650 flex items-center gap-1.5">
                <span>📄 {language === 'bn' ? 'চালান মেমো প্রিভিউ' : 'Invoice Live Preview'}</span>
              </h3>
              <button
                onClick={() => window.print()}
                className="px-3 py-1 bg-slate-900 hover:bg-black text-white rounded text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center gap-1"
              >
                <Printer size={11} />
                <span>{language === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
              </button>
            </div>

            {/* Print area */}
            <div className="p-8 space-y-6 bg-white font-sans text-slate-900 leading-relaxed max-w-[21cm] mx-auto print:p-0 print:mx-0">
              
              {/* Invoice Header */}
              <div className="text-center space-y-1.5 pb-4 border-b-2 border-slate-900">
                <h2 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
                  {language === 'bn' ? 'এ. এস. এন্টারপ্রাইজ' : 'A. S. Enterprise'}
                </h2>
                <p className="text-[10px] font-bold text-slate-600 tracking-widest uppercase">
                  {language === 'bn' ? 'খড়ি প্রক্রিয়াজাতকরণ এবং পাইকারি সরবরাহকারী' : 'Firewood Processor & Bulk Depot Supplier'}
                </p>
                <div className="text-[9px] text-slate-500 space-y-0.5">
                  <p>{language === 'bn' ? 'প্রোপ্রাইটর: আবু সালেহ | মোবাইল: +৮৮০১৭৬৬-৭৬১৮৭৭' : 'Proprietor: Abu Saleh | Mobile: +8801766-761877'}</p>
                  <p>{language === 'bn' ? 'মুন্সিগঞ্জ রোড, পঞ্চসার, মুন্সিগঞ্জ সদর' : 'Munshiganj Road, Panchasar, Munshiganj Sadar'}</p>
                </div>
              </div>

              {/* Memo Info Bar */}
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold bg-slate-50 p-3 rounded border border-slate-200">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-wider text-slate-450 font-black">
                    {language === 'bn' ? 'বিলের সময়সীমা / পরিসীমা' : 'Duration Covered'}
                  </p>
                  <p className="font-black text-slate-900 text-[11px]">{dateRangeText}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] uppercase tracking-wider text-slate-450 font-black">
                    {language === 'bn' ? 'তারিখ' : 'Date of Report'}
                  </p>
                  <p className="font-black text-slate-900 text-[11px]">
                    {new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {day: 'numeric', month: 'long', year: 'numeric'})}
                  </p>
                </div>
                {selectedSeller !== 'ALL' && (
                  <div className="col-span-2 border-t border-slate-200 pt-2 mt-1 space-y-0.5">
                    <p className="text-[9px] uppercase tracking-wider text-slate-450 font-black">
                      {language === 'bn' ? 'হিসাব গ্রহীতা / বিক্রেতা' : 'Supplier Account'}
                    </p>
                    <p className="font-black text-indigo-900 text-sm">{selectedSeller}</p>
                  </div>
                )}
              </div>

              {/* Invoice Main Table */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                  {language === 'bn' ? 'ক্রয়কৃত চালানের বিবরণী:' : 'CARGO SHIPMENT SUMMARY:'}
                </h4>
                
                <table className="w-full text-left border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-[10px] font-black uppercase border-b border-slate-300">
                      <th className="px-3 py-2 border-r border-slate-300 text-center w-8">SL</th>
                      <th className="px-3 py-2 border-r border-slate-300">Date</th>
                      <th className="px-3 py-2 border-r border-slate-300 text-center">Challan</th>
                      {selectedSeller === 'ALL' && <th className="px-3 py-2 border-r border-slate-300">Seller</th>}
                      <th className="px-3 py-2 border-r border-slate-300 text-right">Net KG</th>
                      <th className="px-3 py-2 border-r border-slate-300 text-right">Yield</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] font-semibold divide-y divide-slate-300">
                    {filteredCalculations.map((calc, idx) => {
                      const deduction = (calc.isMinusCalculated && calc.deductedWeight !== undefined) ? calc.deductedWeight : 0;
                      const netKg = Math.max(0, calc.totalKg - deduction);
                      const monType = calc.monType || 40;
                      const monCount = Math.floor(netKg / monType);
                      const extraKg = parseFloat((netKg % monType).toFixed(2));
                      
                      const monVal = netKg / monType;
                      const displayPrice = rateMode === 'challan' 
                        ? calc.totalPrice 
                        : monVal * (parseFloat(customRate) || 0);

                      return (
                        <tr key={calc.id} className="text-slate-800">
                          <td className="px-3 py-2 border-r border-slate-300 text-center font-bold">
                            {language === 'bn' ? toBengaliDigits(idx + 1) : idx + 1}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-300 whitespace-nowrap">
                            {new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {day: 'numeric', month: 'short'})}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-300 text-center font-bold">
                            #{calc.challanNo}
                          </td>
                          {selectedSeller === 'ALL' && (
                            <td className="px-3 py-2 border-r border-slate-300 truncate max-w-[80px]">
                              {calc.sellerName}
                            </td>
                          )}
                          <td className="px-3 py-2 border-r border-slate-300 text-right font-bold">
                            {language === 'bn' ? toBengaliDigits(netKg) : netKg}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-300 text-right whitespace-nowrap">
                            {language === 'bn' 
                              ? `${toBengaliDigits(monCount)} মণ ${toBengaliDigits(extraKg)} কেজি`
                              : `${monCount} M ${extraKg} K`}
                          </td>
                          <td className="px-3 py-2 text-right font-black">
                            ৳{language === 'bn' ? toBengaliDigits(Math.round(displayPrice)) : Math.round(displayPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Invoice Summary Block */}
              <div className="flex justify-end pt-2">
                <div className="w-80 border border-slate-300 bg-slate-50 rounded p-4 space-y-2.5 text-xs font-semibold">
                  <div className="flex justify-between text-slate-700">
                    <span>{language === 'bn' ? 'মোট চালানের ভলিউম:' : 'Total Shipment Count:'}</span>
                    <span className="font-bold text-slate-900">
                      {language === 'bn' ? `${toBengaliDigits(stats.totalChallans)} টি` : `${stats.totalChallans} Challans`}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>{language === 'bn' ? 'মোট নিট ওজন (KG):' : 'Total Net Weight (KG):'}</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {language === 'bn' ? `${toBengaliDigits(stats.netKg.toLocaleString())} কেজি` : `${stats.netKg.toLocaleString()} KG`}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>{language === 'bn' ? 'মোট রূপান্তরিত মন:' : 'Total Converted Yield:'}</span>
                    <span className="font-bold text-slate-900">
                      {language === 'bn' 
                        ? `${toBengaliDigits(statsMon)} মণ ${toBengaliDigits(statsKg)} কেজি` 
                        : `${statsMon} Mon ${statsKg} KG`}
                    </span>
                  </div>
                  {rateMode === 'custom' && (
                    <div className="flex justify-between text-slate-700">
                      <span>{language === 'bn' ? 'নির্ধারিত কাস্টম দর:' : 'Custom Flat Rate:'}</span>
                      <span className="font-bold text-slate-900">
                        ৳{language === 'bn' ? toBengaliDigits(customRate) : customRate} /মণ
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-300 pt-2.5 text-slate-950 text-sm font-black uppercase">
                    <span>{language === 'bn' ? 'সর্বমোট পরিশোধীয় বিল:' : 'Grand Total Due:'}</span>
                    <span className="text-slate-950 font-mono text-base">
                      ৳{language === 'bn' ? toBengaliDigits(Math.round(stats.grandTotal).toLocaleString()) : Math.round(stats.grandTotal).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verified signatures footer */}
              <div className="grid grid-cols-3 gap-6 pt-16 text-center">
                <div className="space-y-1">
                  <div className="border-t border-slate-400 pt-1.5 font-bold text-[9px] uppercase text-slate-600">
                    {language === 'bn' ? 'প্রস্তুতকারী (Operator)' : 'Prepared By Operator'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="border-t border-slate-400 pt-1.5 font-bold text-[9px] uppercase text-slate-600">
                    {language === 'bn' ? 'যাচাইকারী (Manager)' : 'Checked By Manager'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="border-t border-slate-400 pt-1.5 font-bold text-[9px] uppercase text-slate-600">
                    {language === 'bn' ? 'প্রোপ্রাইটর স্বাক্ষর' : 'Proprietor Authorized'}
                  </div>
                </div>
              </div>

              <div className="text-center text-[8px] text-slate-400 font-mono pt-8 uppercase tracking-wider select-none">
                *** Generated Securely by A.S. Enterprise Billing Ledger System ***
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
