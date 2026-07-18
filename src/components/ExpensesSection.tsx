import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  Tag, 
  FileText, 
  DollarSign, 
  TrendingDown, 
  ChevronRight,
  Inbox,
  Filter
} from 'lucide-react';
import { motion } from 'motion/react';

interface Expense {
  id: string;
  timestamp: number;
  amount: number;
  category: string;
  description: string;
  createdBy: string;
}

interface ExpensesSectionProps {
  expenses: Expense[];
  onAddExpense: (exp: Omit<Expense, 'id' | 'timestamp' | 'createdBy'>) => Promise<boolean>;
  onDeleteExpense: (id: string) => Promise<void>;
  language: 'bn' | 'en';
}

const toBengaliDigits = (num: number | string): string => {
  const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, d => bnNums[parseInt(d)]);
};

export default function ExpensesSection({ 
  expenses, 
  onAddExpense, 
  onDeleteExpense, 
  language 
}: ExpensesSectionProps) {
  
  // Local states
  const [category, setCategory] = useState<string>('Labor Bill');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '1month' | 'all' | 'custom'>('7days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Static translations & mapping
  const categoryMap: Record<string, { bn: string, en: string, color: string }> = {
    'Labor Bill': { bn: 'লেবার বিল', en: 'Labor Bill', color: 'bg-indigo-500' },
    'Transport/Van Rent': { bn: 'গাড়ি ভাড়া / পরিবহন', en: 'Transport/Van Rent', color: 'bg-sky-500' },
    'Electricity': { bn: 'বিদ্যুৎ বিল', en: 'Electricity', color: 'bg-amber-500' },
    'Challan Book': { bn: 'চালান বই বাবদ খরচ', en: 'Challan Book Expense', color: 'bg-emerald-500' },
    'Extra Expense': { bn: 'অতিরিক্ত খরচ', en: 'Extra Expense', color: 'bg-rose-500' },
    'Incidental/Miscellaneous': { bn: 'আনুষঙ্গিক খরচ', en: 'Incidental/Miscellaneous', color: 'bg-violet-500' },
    'Other': { bn: 'অন্যান্য', en: 'Other', color: 'bg-slate-500' }
  };

  const getCategoryLabel = (cat: string) => {
    return categoryMap[cat]?.[language] || cat;
  };

  const getCategoryColor = (cat: string) => {
    return categoryMap[cat]?.color || 'bg-slate-400';
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      alert(language === 'bn' ? 'দয়া করে সঠিক টাকার পরিমাণ লিখুন!' : 'Please enter a valid amount!');
      return;
    }

    setIsSubmitting(true);
    const success = await onAddExpense({
      amount: parseFloat(amount),
      category,
      description: description.trim()
    });

    setIsSubmitting(false);
    if (success) {
      setAmount('');
      setDescription('');
      // Show mini feedback alert
      const msg = language === 'bn' ? 'খরচ সফলভাবে যুক্ত করা হয়েছে!' : 'Expense successfully added!';
      alert(msg);
    }
  };

  // Filter Expenses by date and category
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // 1. Category Filter
      if (categoryFilter !== 'ALL' && exp.category !== categoryFilter) {
        return false;
      }

      // 2. Date Filter
      const expDate = new Date(exp.timestamp);
      const startOfToday = new Date();
      startOfToday.setHours(0,0,0,0);
      const endOfToday = new Date();
      endOfToday.setHours(23,59,59,999);

      if (dateFilter === 'today') {
        return exp.timestamp >= startOfToday.getTime() && exp.timestamp <= endOfToday.getTime();
      }
      
      if (dateFilter === 'yesterday') {
        const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        const endOfYesterday = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000);
        return exp.timestamp >= startOfYesterday.getTime() && exp.timestamp <= endOfYesterday.getTime();
      }

      if (dateFilter === '7days') {
        const sevenDaysAgo = startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000;
        return exp.timestamp >= sevenDaysAgo;
      }

      if (dateFilter === '1month') {
        const oneMonthAgo = startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000;
        return exp.timestamp >= oneMonthAgo;
      }

      if (dateFilter === 'custom') {
        if (!customStartDate && !customEndDate) return true;
        let startBound = -Infinity;
        let endBound = Infinity;
        if (customStartDate) {
          const [sY, sM, sD] = customStartDate.split('-').map(Number);
          const sDate = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
          startBound = sDate.getTime();
        }
        if (customEndDate) {
          const [eY, eM, eD] = customEndDate.split('-').map(Number);
          const eDate = new Date(eY, eM - 1, eD, 23, 59, 59, 999);
          endBound = eDate.getTime();
        }
        return exp.timestamp >= startBound && exp.timestamp <= endBound;
      }

      return true; // dateFilter === 'all'
    });
  }, [expenses, dateFilter, customStartDate, customEndDate, categoryFilter]);

  // Total amount in selected filter
  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, curr) => sum + curr.amount, 0);
  }, [filteredExpenses]);

  // Statistics by category
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    Object.keys(categoryMap).forEach(key => {
      stats[key] = 0;
    });

    filteredExpenses.forEach(exp => {
      const cat = exp.category || 'Other';
      if (stats[cat] !== undefined) {
        stats[cat] += exp.amount;
      } else {
        stats['Other'] = (stats['Other'] || 0) + exp.amount;
      }
    });

    return Object.entries(stats)
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        percentage: totalAmount > 0 ? (amt / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, totalAmount]);

  return (
    <div className="space-y-6" id="depot-expenses-container">
      {/* Overview Cards & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Add Expense Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-rose-600 dark:bg-rose-700 p-4 flex items-center justify-between text-white">
            <h3 className="text-xs uppercase tracking-widest font-black flex items-center gap-2">
              <Plus size={14} />
              {language === 'bn' ? 'নতুন খরচ যুক্ত করুন' : 'Add New Expense'}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                {language === 'bn' ? 'খরচের ক্যাটাগরি' : 'Expense Category'}
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3 pr-8 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-bold rounded border border-slate-200 dark:border-slate-850 outline-none appearance-none cursor-pointer focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                >
                  {Object.keys(categoryMap).map(key => (
                    <option key={key} value={key}>
                      {categoryMap[key][language]}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-3 pointer-events-none text-slate-400">
                  <Tag size={14} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                {language === 'bn' ? 'টাকার পরিমাণ (৳)' : 'Amount (৳)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-10 pl-8 pr-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-bold rounded border border-slate-200 dark:border-slate-850 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                />
                <div className="absolute left-3 top-3 pointer-events-none text-slate-400 text-xs font-extrabold">
                  ৳
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                {language === 'bn' ? 'বিস্তারিত বিবরণ' : 'Description / Remarks'}
              </label>
              <div className="relative">
                <textarea
                  placeholder={language === 'bn' ? 'খরচের বিবরণ লিখুন...' : 'Enter details of the expense...'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full p-3 pl-8 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-bold rounded border border-slate-200 dark:border-slate-850 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all resize-none"
                />
                <div className="absolute left-3 top-3 pointer-events-none text-slate-400">
                  <FileText size={14} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-black text-xs uppercase tracking-wider rounded shadow transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              {isSubmitting 
                ? (language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') 
                : (language === 'bn' ? 'খরচ যোগ করুন' : 'Add Expense')}
            </button>
          </form>
        </div>

        {/* Right Col: Stats and Visual Breakdown */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Quick Summary Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-inner">
                <TrendingDown size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                  {language === 'bn' ? 'মোট খরচ (নির্বাচিত ফিল্টারে)' : 'Total Expenses (Selected Filter)'}
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 font-mono">
                  ৳{language === 'bn' ? toBengaliDigits(Math.round(totalAmount).toLocaleString()) : Math.round(totalAmount).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end text-right">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {language === 'bn' ? 'মোট খরচের এন্ট্রি সংখ্যা' : 'Total Expense Entries'}
              </span>
              <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300">
                {language === 'bn' ? toBengaliDigits(filteredExpenses.length) : filteredExpenses.length} {language === 'bn' ? 'টি' : 'items'}
              </span>
            </div>
          </div>

          {/* Category-wise Breakdown with Progress bars */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex-1">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              {language === 'bn' ? 'ক্যাটাগরি ভিত্তিক খরচের খতিয়ান' : 'Category-wise Expenditure Breakdown'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryStats.map(({ category, amount, percentage }) => (
                <div 
                  key={category} 
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${getCategoryColor(category)}`} />
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                        {getCategoryLabel(category)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                      ৳{language === 'bn' ? toBengaliDigits(Math.round(amount).toLocaleString()) : Math.round(amount).toLocaleString()}
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1">
                    <div 
                      className={`h-full ${getCategoryColor(category)} rounded-full`} 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 self-end">
                    {language === 'bn' ? toBengaliDigits(percentage.toFixed(1)) : percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Table Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Filter Toolbar */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          
          {/* Left: Quick Date Filters */}
          <div className="flex flex-wrap bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            {([
              { key: 'today', bn: 'আজ', en: 'Today' },
              { key: 'yesterday', bn: 'গতকাল', en: 'Yesterday' },
              { key: '7days', bn: '৭ দিন', en: '7 Days' },
              { key: '1month', bn: '১ মাস', en: '1 Month' },
              { key: 'all', bn: 'সব', en: 'All' },
              { key: 'custom', bn: 'কাস্টম', en: 'Custom' }
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => setDateFilter(item.key)}
                className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  dateFilter === item.key 
                    ? 'bg-rose-600 text-white shadow' 
                    : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {language === 'bn' ? item.bn : item.en}
              </button>
            ))}
          </div>

          {/* Right: Custom Date range & Category filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            
            {/* Custom Dates UI */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px]">
                <Calendar size={12} className="text-rose-500 ml-1" />
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-slate-700 dark:text-slate-300 font-extrabold border-none outline-none cursor-pointer"
                />
                <ChevronRight size={12} className="text-slate-400" />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-slate-700 dark:text-slate-300 font-extrabold border-none outline-none cursor-pointer"
                />
              </div>
            )}

            {/* Category Filter */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-black">
              <Filter size={12} className="text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-300 outline-none border-none cursor-pointer font-black"
              >
                <option value="ALL">
                  {language === 'bn' ? 'সব ক্যাটাগরি' : 'All Categories'}
                </option>
                {Object.keys(categoryMap).map(key => (
                  <option key={key} value={key}>
                    {categoryMap[key][language]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="overflow-x-auto">
          {filteredExpenses.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-950/40 flex items-center justify-center text-slate-400 mx-auto border border-slate-100 dark:border-slate-850 shadow-inner">
                <Inbox size={28} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'কোন খরচের এন্ট্রি পাওয়া যায়নি!' : 'No expenses found matching the criteria!'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
                  {language === 'bn' 
                    ? 'নতুন খরচ যোগ করতে বামদিকের ফর্মটি পূরণ করে সাবমিট করুন।' 
                    : 'To add an expense, please fill in and submit the creation form on the left.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop View: Table */}
              <table className="hidden md:table w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">
                    <th className="py-3.5 px-5 font-black">{language === 'bn' ? 'তারিখ ও সময়' : 'Date & Time'}</th>
                    <th className="py-3.5 px-5 font-black">{language === 'bn' ? 'ক্যাটাগরি' : 'Category'}</th>
                    <th className="py-3.5 px-5 font-black">{language === 'bn' ? 'বিবরণ' : 'Description / Remarks'}</th>
                    <th className="py-3.5 px-5 font-black">{language === 'bn' ? 'এন্ট্রি কারী' : 'Entered By'}</th>
                    <th className="py-3.5 px-5 text-right font-black">{language === 'bn' ? 'টাকা' : 'Amount'}</th>
                    <th className="py-3.5 px-5 text-center font-black">{language === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {filteredExpenses.map((exp) => (
                    <tr 
                      key={exp.id} 
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all font-bold text-slate-700 dark:text-slate-300"
                    >
                      <td className="py-3 px-5 font-mono text-[10px]">
                        {new Date(exp.timestamp).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        })}
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black text-white ${getCategoryColor(exp.category)} shadow-sm`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                          {getCategoryLabel(exp.category)}
                        </span>
                      </td>
                      <td className="py-3 px-5 max-w-xs truncate" title={exp.description}>
                        {exp.description || <span className="text-slate-400 italic font-medium">{language === 'bn' ? 'কোন বিবরণ নেই' : 'No description'}</span>}
                      </td>
                      <td className="py-3 px-5 text-[10px] font-mono text-slate-500">
                        {exp.createdBy}
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-slate-900 dark:text-slate-100 font-extrabold text-sm">
                        ৳{language === 'bn' ? toBengaliDigits(exp.amount.toLocaleString()) : exp.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-5 text-center">
                        <button
                          onClick={() => onDeleteExpense(exp.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all cursor-pointer"
                          title={language === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile View: Cards */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-850 p-4 space-y-4">
                {filteredExpenses.map((exp) => (
                  <div key={exp.id} className="pt-4 first:pt-0 space-y-2.5 font-bold text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black text-white ${getCategoryColor(exp.category)} shadow-sm`}>
                        {getCategoryLabel(exp.category)}
                      </span>
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                        ৳{language === 'bn' ? toBengaliDigits(exp.amount.toLocaleString()) : exp.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400 pl-1 font-medium">
                      {exp.description || <span className="text-slate-400 italic font-medium">{language === 'bn' ? 'কোন বিবরণ নেই' : 'No description'}</span>}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pl-1">
                      <span className="font-mono">
                        {new Date(exp.timestamp).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        })}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono max-w-[100px] truncate">{exp.createdBy}</span>
                        <button
                          onClick={() => onDeleteExpense(exp.id)}
                          className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
