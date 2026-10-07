import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { TrendingUp, Scale, DollarSign, Calendar, Layers, Activity } from 'lucide-react';

export interface Calculation {
  id: string;
  timestamp: number;
  sellerName: string;
  totalKg: number;
  monType: 40 | 41 | 42 | 43;
  ratePerMon: number;
  totalMon: number;
  totalPrice: number;
  challanNo: number;
  createdBy: string;
  createdByName?: string;
  deductedWeight?: number;
  deductionPercentage?: number;
  isMinusCalculated?: boolean;
  targetMonPrice?: number;
  getEntryNo?: number;
  gateEntry?: number;
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: number;
}

export type DateFilter = 'all' | 'today' | 'yesterday' | '7days' | '1month' | 'custom';

interface DailySupplyTrendChartProps {
  calculations: Calculation[];
  language: 'en' | 'bn';
  dateFilter: DateFilter;
  toBengaliDigits?: (num: number | string) => string;
}

const defaultToBengaliDigits = (num: number | string): string => {
  const map: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  };
  return num.toString().replace(/[0-9]/g, char => map[char] || char);
};

export const DailySupplyTrendChart: React.FC<DailySupplyTrendChartProps> = ({
  calculations,
  language,
  dateFilter,
  toBengaliDigits = defaultToBengaliDigits
}) => {
  type MetricView = 'kg' | 'mon' | 'price' | 'dual';
  const [metricView, setMetricView] = useState<MetricView>('dual');

  // Group calculations by date (YYYY-MM-DD)
  const chartData = useMemo(() => {
    // Exclude deleted records if any passed
    const active = calculations.filter(c => !c.isDeleted);
    if (active.length === 0) return [];

    const grouped: Record<string, {
      dateKey: string;
      timestamp: number;
      shortLabel: string;
      fullDate: string;
      totalKg: number;
      totalMon: number;
      totalPrice: number;
      entriesCount: number;
      sellers: Set<string>;
    }> = {};

    active.forEach(calc => {
      const d = new Date(calc.timestamp);
      // Key formatted YYYY-MM-DD
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;

      if (!grouped[key]) {
        // Date formatting
        const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthNamesBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

        const dayNum = d.getDate();
        const shortLabel = language === 'bn' 
          ? `${toBengaliDigits(dayNum)} ${monthNamesBn[d.getMonth()]}`
          : `${dayNum} ${monthNamesEn[d.getMonth()]}`;

        const fullDate = d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        grouped[key] = {
          dateKey: key,
          timestamp: new Date(y, d.getMonth(), dayNum).getTime(),
          shortLabel,
          fullDate,
          totalKg: 0,
          totalMon: 0,
          totalPrice: 0,
          entriesCount: 0,
          sellers: new Set<string>()
        };
      }

      grouped[key].totalKg += (Number(calc.totalKg) || 0);
      grouped[key].totalMon += (Number(calc.totalMon) || 0);
      grouped[key].totalPrice += (Number(calc.totalPrice) || 0);
      grouped[key].entriesCount += 1;
      if (calc.sellerName) {
        grouped[key].sellers.add(calc.sellerName.trim());
      }
    });

    // Convert to sorted array
    const sorted = Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp);

    return sorted.map(item => ({
      date: item.shortLabel,
      fullDate: item.fullDate,
      totalKg: Math.round(item.totalKg),
      totalMon: parseFloat(item.totalMon.toFixed(2)),
      totalPrice: Math.round(item.totalPrice),
      entriesCount: item.entriesCount,
      uniqueSellers: item.sellers.size
    }));
  }, [calculations, language, toBengaliDigits]);

  // Summary Metrics for the current trend
  const summary = useMemo(() => {
    if (chartData.length === 0) {
      return { totalKg: 0, totalMon: 0, totalPrice: 0, avgKgPerDay: 0, peakDay: null, totalDays: 0 };
    }

    let totalKg = 0;
    let totalMon = 0;
    let totalPrice = 0;
    let peakKg = -1;
    let peakDay: { date: string; kg: number; mon: number } | null = null;

    chartData.forEach(item => {
      totalKg += item.totalKg;
      totalMon += item.totalMon;
      totalPrice += item.totalPrice;
      if (item.totalKg > peakKg) {
        peakKg = item.totalKg;
        peakDay = { date: item.date, kg: item.totalKg, mon: item.totalMon };
      }
    });

    const totalDays = chartData.length;
    const avgKgPerDay = totalDays > 0 ? Math.round(totalKg / totalDays) : 0;

    return {
      totalKg,
      totalMon: parseFloat(totalMon.toFixed(2)),
      totalPrice,
      avgKgPerDay,
      peakDay,
      totalDays
    };
  }, [chartData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-2xl border border-slate-700/80 backdrop-blur-md text-xs min-w-[210px] space-y-2">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
            <span className="font-bold text-yellow-400 flex items-center gap-1.5">
              <Calendar size={13} />
              {data.fullDate || label}
            </span>
            <span className="bg-slate-800 text-[10px] px-1.5 py-0.5 rounded font-mono text-slate-300">
              {language === 'bn' ? `${toBengaliDigits(data.entriesCount)} চালান` : `${data.entriesCount} entries`}
            </span>
          </div>

          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                <span>{language === 'bn' ? 'মোট সরবরাহ (কেজি):' : 'Total Supply (KG):'}</span>
              </span>
              <span className="font-bold text-amber-400 font-mono">
                {language === 'bn' ? `${toBengaliDigits(data.totalKg.toLocaleString())} কেজি` : `${data.totalKg.toLocaleString()} KG`}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                <span>{language === 'bn' ? 'মোট সরবরাহ (মণ):' : 'Total Supply (Mon):'}</span>
              </span>
              <span className="font-bold text-emerald-400 font-mono">
                {language === 'bn' ? `${toBengaliDigits(data.totalMon.toLocaleString())} মণ` : `${data.totalMon.toLocaleString()} MON`}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block"></span>
                <span>{language === 'bn' ? 'মোট মূল্য বিল:' : 'Total Value:'}</span>
              </span>
              <span className="font-bold text-indigo-300 font-mono">
                {language === 'bn' ? `৳${toBengaliDigits(data.totalPrice.toLocaleString())}` : `৳${data.totalPrice.toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 mt-6 animate-fadeIn transition-all">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {language === 'bn' ? 'দৈনিক জ্বালানি কাঠ সরবরাহ প্রবণতা' : 'Daily Firewood Supply Trend'}
            </h3>
            <span className="text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-slate-950 px-2 py-0.5 rounded">
              {language === 'bn' ? 'লাইন চার্ট' : 'LINE CHART'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {language === 'bn'
              ? 'নির্বাচিত সময়সীমার মধ্যে প্রতিদিনের কাঠ সরবরাহ ও ওজনের পরিবর্তন ধারা বিশ্লেষণ।'
              : 'Daily trend analysis of firewood volume and weight changes across the selected range.'}
          </p>
        </div>

        {/* View Switcher Buttons */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setMetricView('dual')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              metricView === 'dual'
                ? 'bg-yellow-400 text-slate-950 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {language === 'bn' ? 'কেজি ও মণ' : 'KG & Mon'}
          </button>
          <button
            type="button"
            onClick={() => setMetricView('kg')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              metricView === 'kg'
                ? 'bg-yellow-400 text-slate-950 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {language === 'bn' ? 'শুধুমাত্র কেজি' : 'KG Only'}
          </button>
          <button
            type="button"
            onClick={() => setMetricView('mon')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              metricView === 'mon'
                ? 'bg-yellow-400 text-slate-950 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {language === 'bn' ? 'শুধুমাত্র মণ' : 'Mon Only'}
          </button>
          <button
            type="button"
            onClick={() => setMetricView('price')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              metricView === 'price'
                ? 'bg-yellow-400 text-slate-950 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {language === 'bn' ? 'মূল্য (টাকা)' : 'Value (BDT)'}
          </button>
        </div>
      </div>

      {/* KPI Trend Highlight Chips */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              {language === 'bn' ? 'মোট সরবরাহ (কেজি)' : 'Total Supply (KG)'}
            </span>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono mt-0.5">
              {language === 'bn' ? `${toBengaliDigits(summary.totalKg.toLocaleString())} কেজি` : `${summary.totalKg.toLocaleString()} KG`}
            </div>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
              {language === 'bn' ? `≈ ${toBengaliDigits(summary.totalMon.toLocaleString())} মণ` : `≈ ${summary.totalMon.toLocaleString()} Mon`}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              {language === 'bn' ? 'দৈনিক গড় সরবরাহ' : 'Daily Average Supply'}
            </span>
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {language === 'bn' ? `${toBengaliDigits(summary.avgKgPerDay.toLocaleString())} কেজি/দিন` : `${summary.avgKgPerDay.toLocaleString()} KG/day`}
            </div>
            <span className="text-[10px] font-medium text-slate-400">
              {language === 'bn' ? `${toBengaliDigits(summary.totalDays)} দিনের তথ্য` : `Across ${summary.totalDays} active days`}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              {language === 'bn' ? 'সর্বোচ্চ সরবরাহের দিন' : 'Peak Supply Day'}
            </span>
            <div className="text-base font-black text-yellow-600 dark:text-yellow-400 font-mono mt-0.5">
              {summary.peakDay
                ? (language === 'bn' ? `${toBengaliDigits(summary.peakDay.kg.toLocaleString())} কেজি` : `${summary.peakDay.kg.toLocaleString()} KG`)
                : '---'}
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate block">
              {summary.peakDay ? summary.peakDay.date : '---'}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              {language === 'bn' ? 'মোট পেমেন্ট/বিল' : 'Total Value (BDT)'}
            </span>
            <div className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
              {language === 'bn' ? `৳${toBengaliDigits(Math.round(summary.totalPrice).toLocaleString())}` : `৳${Math.round(summary.totalPrice).toLocaleString()}`}
            </div>
            <span className="text-[10px] font-medium text-slate-400">
              {language === 'bn' ? 'সকল চালানের মোট বিল' : 'All challans aggregate'}
            </span>
          </div>
        </div>
      )}

      {/* Main Chart Area */}
      {chartData.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
            <Activity size={28} />
          </div>
          <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">
            {language === 'bn' ? 'নির্বাচিত সময়ে কোনো তথ্য নেই' : 'No Data for Selected Date Range'}
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {language === 'bn'
              ? 'উপরের ফিল্টার থেকে "সব", "৭ দিন" অথবা "১ মাস" নির্বাচন করে কাঠ সরবরাহের ট্রেন্ড চার্ট দেখুন।'
              : 'Switch the date filter above to "7 Days", "1 Month", or "All" to analyze firewood supply trends.'}
          </p>
        </div>
      ) : (
        <div className="w-full h-72 sm:h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="kgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="monGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.15} vertical={false} />
              
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1', strokeOpacity: 0.3 }}
                dy={8}
              />

              {/* Primary Y Axis */}
              <YAxis
                yAxisId="left"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                  if (metricView === 'price') return `৳${(val / 1000).toFixed(0)}k`;
                  if (metricView === 'mon') return `${val}`;
                  return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val}`;
                }}
              />

              {/* Secondary Y Axis for Dual Mode (Mon on right) */}
              {metricView === 'dual' && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#10b981"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}মণ`}
                />
              )}

              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                formatter={(val) => {
                  if (val === 'totalKg') return language === 'bn' ? 'মোট সরবরাহ (কেজি)' : 'Total Supply (KG)';
                  if (val === 'totalMon') return language === 'bn' ? 'মোট সরবরাহ (মণ)' : 'Total Supply (Mon)';
                  if (val === 'totalPrice') return language === 'bn' ? 'মোট বিল (টাকা)' : 'Total Value (BDT)';
                  return val;
                }}
              />

              {/* Lines based on metricView */}
              {(metricView === 'dual' || metricView === 'kg') && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalKg"
                  name="totalKg"
                  stroke="#eab308"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#eab308', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 7, fill: '#eab308', strokeWidth: 3, stroke: '#ffffff' }}
                />
              )}

              {(metricView === 'dual' || metricView === 'mon') && (
                <Line
                  yAxisId={metricView === 'dual' ? 'right' : 'left'}
                  type="monotone"
                  dataKey="totalMon"
                  name="totalMon"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  strokeDasharray={metricView === 'dual' ? '4 4' : undefined}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 7, fill: '#10b981', strokeWidth: 3, stroke: '#ffffff' }}
                />
              )}

              {metricView === 'price' && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalPrice"
                  name="totalPrice"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 7, fill: '#6366f1', strokeWidth: 3, stroke: '#ffffff' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DailySupplyTrendChart;
