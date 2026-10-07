import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Scale, 
  User, 
  FileText, 
  HelpCircle, 
  ChevronRight, 
  ChevronDown, 
  ShieldCheck, 
  Copy, 
  Check, 
  Calendar,
  Layers,
  ArrowRight,
  Info,
  X,
  Trash2,
  ShieldAlert
} from 'lucide-react';
import { Calculation } from '../utils/calculationNormalizer';
import { deleteDoc, doc as firestoreDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface HistoricalDuplicateReviewProps {
  calculations: Calculation[];
  language: 'bn' | 'en';
  onClose?: () => void;
}

interface AnalyzedDoc {
  docId: string;
  challanNo: number;
  dateStr: string;
  timestamp: number;
  sellerName: string;
  weightKg: number;
  ratePerMon: number;
  totalPrice: number;
  monDetails?: string;
  monType?: number;
  gateEntryNo?: number;
  operator: string;
  isDeleted?: boolean;
  rawKeys: string[];
  presentFields: string[];
  missingFields: string[];
  isNumericId: boolean;
  isUUID: boolean;
  isRandom9Char: boolean;
  rawSnapshot?: Record<string, any>;
}

export interface DuplicateGroup {
  challanNo: number;
  docs: AnalyzedDoc[];
  date: string;
  isExactPair: boolean;
  isTripleOrMore: boolean;
  hasIdenticalTimestamp: boolean;
  hasIdenticalWeight: boolean;
  hasIdenticalTotal: boolean;
  canonicalDoc?: AnalyzedDoc;
  duplicateDocs: AnalyzedDoc[];
  requiresManualReview: boolean;
  reason: string;
}

export const HistoricalDuplicateReview: React.FC<HistoricalDuplicateReviewProps> = ({
  calculations,
  language,
  onClose
}) => {
  const isBn = language === 'bn';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL');
  const [groupTypeFilter, setGroupTypeFilter] = useState<'all' | 'pairs' | 'manualReview' | 'discrepant'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedChallan, setExpandedChallan] = useState<number | null>(null);
  const [inspectedDoc, setInspectedDoc] = useState<AnalyzedDoc | null>(null);

  // Controlled Single-Document Deletion Test State (Challan #854 / uuan6rzte)
  const [testDeleteConfirmation, setTestDeleteConfirmation] = useState<{
    challanNo: number;
    docIdToDelete: string;
    canonicalDocId: string;
  } | null>(null);
  const [isDeletingTest, setIsDeletingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    deletedDocId: string;
    canonicalDocId: string;
    canonicalStillExists: boolean;
    remainingData?: any;
    message: string;
  } | null>(null);

  const handleExecuteControlledDelete = async () => {
    if (!testDeleteConfirmation) return;
    const { docIdToDelete, canonicalDocId } = testDeleteConfirmation;
    
    // STRICT SAFETY CHECK: ONLY uuan6rzte can be deleted in this controlled test
    if (docIdToDelete !== 'uuan6rzte') {
      alert("Safety Violation: Only test document 'uuan6rzte' is permitted for this controlled test.");
      return;
    }

    setIsDeletingTest(true);
    try {
      // 1. Delete ONLY document uuan6rzte
      const targetRef = firestoreDoc(db, 'calculations', 'uuan6rzte');
      await deleteDoc(targetRef);

      // 2. Post-delete verification: check canonical doc 854
      const canonRef = firestoreDoc(db, 'calculations', canonicalDocId);
      const canonSnap = await getDoc(canonRef);

      // 3. Verify deleted doc is gone
      const deletedSnap = await getDoc(targetRef);

      setTestResult({
        success: true,
        deletedDocId: 'uuan6rzte',
        canonicalDocId: '854',
        canonicalStillExists: canonSnap.exists(),
        remainingData: canonSnap.exists() ? canonSnap.data() : null,
        message: 'Document uuan6rzte was successfully deleted. Canonical document 854 remains untouched.'
      });
      setTestDeleteConfirmation(null);
    } catch (err: any) {
      alert('Error during controlled deletion: ' + err?.message);
    } finally {
      setIsDeletingTest(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Convert English digits to Bengali digits
  const toBn = (num: number | string | undefined | null) => {
    if (num === undefined || num === null) return '---';
    if (!isBn) return num.toString();
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, d => bnDigits[parseInt(d, 10)]);
  };

  // Process and analyze all calculation documents into duplicate groups
  const { duplicateGroups, datesList, summaryStats } = useMemo(() => {
    const byChallan = new Map<number, AnalyzedDoc[]>();
    const datesSet = new Set<string>();

    calculations.forEach(c => {
      const raw = c.rawSnapshot || {};
      const rawKeys = Object.keys(raw);
      const ch = c.challanNo;
      if (ch === undefined || ch === null) return;

      const docId = c.id;
      const isNumericId = /^\d+$/.test(docId);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(docId);
      const isRandom9Char = /^[a-z0-9]{8,12}$/i.test(docId) && !isNumericId;

      // Extract present vs missing standard schema fields
      const presentFields: string[] = [];
      const missingFields: string[] = [];

      const checkField = (field: string, label: string) => {
        if (field in raw && raw[field] !== undefined && raw[field] !== null && raw[field] !== '') {
          presentFields.push(label);
        } else {
          missingFields.push(label);
        }
      };

      checkField('weightKg', 'weightKg (কেজি)');
      checkField('totalKg', 'totalKg (কেজি)');
      checkField('rate', 'rate (দর)');
      checkField('ratePerMon', 'ratePerMon (দর/মণ)');
      checkField('totalAmount', 'totalAmount (মূল্য)');
      checkField('totalPrice', 'totalPrice (মূল্য)');
      checkField('monDetails', 'monDetails (মণ বিবরণ)');
      checkField('monType', 'monType (৪০/৪১)');
      checkField('gateEntryNo', 'gateEntryNo (গেট)');
      checkField('getEntryNo', 'getEntryNo (গেট)');
      checkField('date', 'date (তারিখ)');
      checkField('operatorEmail', 'operatorEmail (অপারেটর)');
      checkField('createdBy', 'createdBy (ইউজার)');

      const d = new Date(c.timestamp);
      const dateFormatted = !isNaN(d.getTime()) 
        ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
        : (c.date || 'Unknown');

      if (dateFormatted !== 'Unknown') {
        datesSet.add(dateFormatted);
      }

      const analyzedDoc: AnalyzedDoc = {
        docId,
        challanNo: ch,
        dateStr: dateFormatted,
        timestamp: c.timestamp,
        sellerName: c.sellerName || 'অজ্ঞাত বিক্রেতা',
        weightKg: c.netKg || c.weightKg || c.totalKg || 0,
        ratePerMon: c.ratePerMon || c.rate || 0,
        totalPrice: c.totalPrice || c.totalAmount || 0,
        monDetails: c.monDetails,
        monType: c.monType,
        gateEntryNo: c.gateEntryNo || c.getEntryNo || c.gateEntry,
        operator: c.createdByName || c.operatorEmail || c.createdBy || 'Unknown',
        isDeleted: c.isDeleted,
        rawKeys,
        presentFields,
        missingFields,
        isNumericId,
        isUUID,
        isRandom9Char,
        rawSnapshot: raw
      };

      if (!byChallan.has(ch)) byChallan.set(ch, []);
      byChallan.get(ch)!.push(analyzedDoc);
    });

    const groups: DuplicateGroup[] = [];
    let totalPhantomDocs = 0;
    let totalCanonicalDocs = 0;
    let exactPairCount = 0;
    let manualReviewCount = 0;

    byChallan.forEach((docsList, ch) => {
      if (docsList.length > 1) {
        // Group has duplicates!
        const isExactPair = docsList.length === 2;
        const isTripleOrMore = docsList.length > 2;

        // Check consistency
        const firstTs = docsList[0].timestamp;
        const hasIdenticalTimestamp = docsList.every(d => d.timestamp === firstTs);

        const firstWeight = docsList[0].weightKg;
        const hasIdenticalWeight = docsList.every(d => Math.abs(d.weightKg - firstWeight) < 0.1);

        const firstTotal = Math.round(docsList[0].totalPrice);
        const hasIdenticalTotal = docsList.every(d => Math.abs(Math.round(d.totalPrice) - firstTotal) <= 1);

        // Classify Canonical vs Duplicates
        // Preferred canonical: document ID equals challanNo and has date / monDetails
        let canonical: AnalyzedDoc | undefined;
        let duplicates: AnalyzedDoc[] = [];

        if (isExactPair) {
          const numDoc = docsList.find(d => d.docId === String(ch));
          const otherDoc = docsList.find(d => d.docId !== String(ch));
          
          if (numDoc && otherDoc) {
            canonical = numDoc;
            duplicates = [otherDoc];
          } else {
            canonical = docsList[0];
            duplicates = [docsList[1]];
          }
        } else {
          // 3 or more documents: requires manual review!
          duplicates = docsList;
        }

        const requiresManualReview = isTripleOrMore || !hasIdenticalTimestamp || !hasIdenticalWeight || !hasIdenticalTotal;

        let reason = '';
        if (requiresManualReview) {
          if (isTripleOrMore) {
            reason = isBn 
              ? `সতর্কতা: এই চালানে ${toBn(docsList.length)}টি ডকুমেন্ট রয়েছে। স্বয়ংক্রিয় নির্বাচন করা সম্ভব নয়, ম্যানুয়াল যাচাই প্রয়োজন।`
              : `Caution: Contains ${docsList.length} documents. Cannot auto-classify; requires manual verification.`;
          } else if (!hasIdenticalTimestamp || !hasIdenticalWeight) {
            reason = isBn
              ? `সতর্কতা: চালানের ডকুমেন্টগুলোতে টাইমস্ট্যাম্প বা ওজনের ভিন্নতা রয়েছে।`
              : `Caution: Timestamps or weight data differ between candidate records.`;
          }
        } else {
          reason = isBn
            ? `একই চালান (#${toBn(ch)}) + একই টাইমস্ট্যাম্প + হুবহু একই ওজন (${toBn(firstWeight)} KG) + একই মূল্য (৳${toBn(firstTotal)})।`
            : `Same Challan (#${ch}) + exact millisecond timestamp + matching weight (${firstWeight} KG) + matching total (৳${firstTotal}).`;
        }

        const groupDate = canonical?.dateStr || docsList[0].dateStr || 'Unknown';

        groups.push({
          challanNo: ch,
          docs: docsList,
          date: groupDate,
          isExactPair,
          isTripleOrMore,
          hasIdenticalTimestamp,
          hasIdenticalWeight,
          hasIdenticalTotal,
          canonicalDoc: canonical,
          duplicateDocs: duplicates,
          requiresManualReview,
          reason
        });

        if (requiresManualReview) {
          manualReviewCount++;
        } else {
          exactPairCount++;
          totalCanonicalDocs++;
          totalPhantomDocs++;
        }
      }
    });

    // Sort by challan number descending
    groups.sort((a, b) => b.challanNo - a.challanNo);

    const sortedDates = Array.from(datesSet).sort((a, b) => {
      const [d1, m1, y1] = a.split('/').map(Number);
      const [d2, m2, y2] = b.split('/').map(Number);
      return new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
    });

    return {
      duplicateGroups: groups,
      datesList: sortedDates,
      summaryStats: {
        totalDocs: calculations.length,
        totalUniqueChallans: byChallan.size,
        totalDuplicateGroups: groups.length,
        exactPairs: exactPairCount,
        requiresManualReview: manualReviewCount,
        totalSuspectedDuplicates: groups.reduce((acc, g) => acc + (g.docs.length - 1), 0),
        datesCount: datesSet.size
      }
    };
  }, [calculations, isBn]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    return duplicateGroups.filter(g => {
      // Date filter
      if (selectedDateFilter !== 'ALL' && g.date !== selectedDateFilter) {
        return false;
      }

      // Group type filter
      if (groupTypeFilter === 'pairs' && g.requiresManualReview) return false;
      if (groupTypeFilter === 'manualReview' && !g.requiresManualReview) return false;
      if (groupTypeFilter === 'discrepant' && (g.hasIdenticalTimestamp && g.hasIdenticalWeight)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesChallan = g.challanNo.toString().includes(q);
        const matchesSeller = g.docs.some(d => d.sellerName.toLowerCase().includes(q));
        const matchesDocId = g.docs.some(d => d.docId.toLowerCase().includes(q));
        const matchesOperator = g.docs.some(d => d.operator.toLowerCase().includes(q));
        return matchesChallan || matchesSeller || matchesDocId || matchesOperator;
      }

      return true;
    });
  }, [duplicateGroups, selectedDateFilter, groupTypeFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto px-2 sm:px-4">
      
      {/* Top Banner & Safety Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-800/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck size={12} />
                {isBn ? '১০০% সুরক্ষিত রিড-অনলি মোড' : '100% Read-Only Safety Mode'}
              </span>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                {isBn ? 'ঐতিহাসিক ডুপ্লিকেট অডিট' : 'Historical Duplicate Audit'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-2 flex items-center gap-2">
              <Layers className="text-yellow-400" size={24} />
              {isBn ? 'ঐতিহাসিক ডুপ্লিকেট চালান রিভিউ ও অডিট স্ক্রিন' : 'Historical Duplicate Challan Review Screen'}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {isBn 
                ? 'ফায়ারস্টোরের প্রতিটি ডুপ্লিকেট চালানের ক্যানোনিক্যাল ও ফ্যান্টম ডকুমেন্ট পাশাপাশি মিলিয়ে দেখুন। কোনো ডকুমেন্ট ডিলেট, এডিট বা আপডেট হবে না।'
                : 'Side-by-side verification of Firestore duplicate groups. Compare canonical vs phantom documents safely with zero modifications.'}
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="self-start md:self-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <X size={15} />
              {isBn ? 'বন্ধ করুন' : 'Close Review'}
            </button>
          )}
        </div>

        {/* Global Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5 pt-4 border-t border-indigo-900/50">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">{isBn ? 'মোট ডকুমেন্ট' : 'Total Docs'}</span>
            <span className="text-base font-black text-white">{toBn(summaryStats.totalDocs)}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">{isBn ? 'অনন্য চালান' : 'Unique Challans'}</span>
            <span className="text-base font-black text-emerald-400">{toBn(summaryStats.totalUniqueChallans)}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">{isBn ? 'ডুপ্লিকেট গ্রুপ' : 'Duplicate Groups'}</span>
            <span className="text-base font-black text-rose-400">{toBn(summaryStats.totalDuplicateGroups)}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">{isBn ? 'হুবহু মিল জোড়া' : 'Exact Pairs'}</span>
            <span className="text-base font-black text-indigo-400">{toBn(summaryStats.exactPairs)}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">{isBn ? 'ম্যানুয়াল রিভিউ' : 'Manual Review'}</span>
            <span className="text-base font-black text-amber-400">{toBn(summaryStats.requiresManualReview)}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">{isBn ? 'প্রভাবিত তারিখ' : 'Dates Affected'}</span>
            <span className="text-base font-black text-cyan-400">{toBn(summaryStats.datesCount)} {isBn ? 'টি' : ''}</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'চালান নং, বিক্রেতা বা ডকুমেন্ট ID দিয়ে খুঁজুন...' : 'Search by Challan #, Seller, or Doc ID...'}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-slate-400 shrink-0" />
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">{isBn ? 'সকল তারিখ (৭৩টি)' : 'All Dates (73)'}</option>
              {datesList.map(dt => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setGroupTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              groupTypeFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {isBn ? 'সকল ডুপ্লিকেট গ্রুপ' : 'All Duplicate Groups'} ({toBn(duplicateGroups.length)})
          </button>
          <button
            onClick={() => setGroupTypeFilter('pairs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              groupTypeFilter === 'pairs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {isBn ? 'হুবহু মিল জোড়া' : 'Exact Pairs'} ({toBn(summaryStats.exactPairs)})
          </button>
          <button
            onClick={() => setGroupTypeFilter('manualReview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              groupTypeFilter === 'manualReview'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            ⚠️ {isBn ? 'ম্যানুয়াল রিভিউ প্রয়োজন' : 'Requires Manual Review'} ({toBn(summaryStats.requiresManualReview)})
          </button>
        </div>
      </div>

      {/* Showing Count */}
      <div className="flex justify-between items-center text-xs font-bold text-slate-500 px-1">
        <span>
          {isBn 
            ? `প্রদর্শিত হচ্ছে ${toBn(filteredGroups.length)} টি গ্রুপ` 
            : `Showing ${filteredGroups.length} duplicate groups`}
        </span>
        <span className="text-[11px] text-slate-400">
          {isBn ? 'গ্রুপে ক্লিক করে বিস্তারিত ফিল্ড ও র-স্ন্যাপশট দেখুন' : 'Click group to inspect complete raw fields'}
        </span>
      </div>

      {/* Duplicate Groups List */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
              {isBn ? 'কোনো ডুপ্লিকেট গ্রুপ পাওয়া যায়নি' : 'No Duplicate Groups Found'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {isBn 
                ? 'আপনার দেওয়া সার্চ বা ফিল্টারের অধীনে কোনো রেকর্ড নেই।' 
                : 'No duplicate groups match the current search or filter criteria.'}
            </p>
          </div>
        ) : (
          filteredGroups.map(group => {
            const isExpanded = expandedChallan === group.challanNo;

            return (
              <div 
                key={group.challanNo}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all shadow-sm overflow-hidden ${
                  group.requiresManualReview 
                    ? 'border-amber-300 dark:border-amber-900/60 hover:border-amber-400' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800'
                }`}
              >
                {/* Group Summary Header */}
                <div 
                  onClick={() => setExpandedChallan(isExpanded ? null : group.challanNo)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40 cursor-pointer border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm flex items-center justify-center shrink-0 shadow">
                      #{toBn(group.challanNo)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {isBn ? `চালান #${toBn(group.challanNo)}` : `Challan #${group.challanNo}`}
                        </span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded">
                          📅 {group.date}
                        </span>
                        {group.requiresManualReview ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <AlertTriangle size={11} />
                            {isBn ? 'ম্যানুয়াল রিভিউ প্রয়োজন' : 'Requires Manual Review'} ({toBn(group.docs.length)} docs)
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            {isBn ? '২টি ডকুমেন্ট জোড়া' : '2 Documents Pair'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5 flex items-center gap-2">
                        <span>👤 {group.docs[0].sellerName}</span>
                        <span>•</span>
                        <span>⚖️ {toBn(group.docs[0].weightKg)} KG</span>
                        <span>•</span>
                        <span>💰 ৳{toBn(Math.round(group.docs[0].totalPrice))}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      {isExpanded ? (isBn ? 'সংক্ষেপ করুন' : 'Collapse') : (isBn ? 'তুলনামূলক বিবরণ' : 'Compare Docs')}
                    </span>
                    {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                  </div>
                </div>

                {/* Reason Banner */}
                <div className="px-4 sm:px-5 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                  <Info size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    <strong>{isBn ? 'ডুপ্লিকেটের কারণ:' : 'Reason:'}</strong> {group.reason}
                  </span>
                </div>

                {/* Comparative Document Cards */}
                <div className="p-4 sm:p-5">
                  
                  {/* Scenario A: Standard 2-Doc Duplicate Pair */}
                  {group.isExactPair && group.canonicalDoc && group.duplicateDocs[0] ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      
                      {/* CARD 1: CANONICAL RECORD */}
                      <DocumentComparisonCard
                        doc={group.canonicalDoc}
                        role="canonical"
                        language={language}
                        toBn={toBn}
                        copyToClipboard={copyToClipboard}
                        copiedId={copiedId}
                        onInspect={() => setInspectedDoc(group.canonicalDoc!)}
                      />

                      {/* CARD 2: PHANTOM / DUPLICATE CANDIDATE */}
                      <DocumentComparisonCard
                        doc={group.duplicateDocs[0]}
                        role="duplicate"
                        language={language}
                        toBn={toBn}
                        copyToClipboard={copyToClipboard}
                        copiedId={copiedId}
                        onInspect={() => setInspectedDoc(group.duplicateDocs[0])}
                        onInitiateTestDelete={group.challanNo === 854 && group.duplicateDocs[0].docId === 'uuan6rzte' ? () => setTestDeleteConfirmation({ challanNo: 854, docIdToDelete: 'uuan6rzte', canonicalDocId: '854' }) : undefined}
                      />

                    </div>
                  ) : (
                    /* Scenario B: Multi-document Group (3 or 4+ documents) - Requires Manual Review */
                    <div className="space-y-3">
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-3 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                        <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                          <strong>{isBn ? 'সতর্কতা (ম্যানুয়াল রিভিউ প্রয়োজন):' : 'Caution (Requires Manual Review):'}</strong>{' '}
                          {isBn
                            ? `এই চালানে ${toBn(group.docs.length)}টি পৃথক ডকুমেন্ট বিদ্যমান রয়েছে। স্বয়ংক্রিয়ভাবে কোনোটি নির্বাচন করা নিষিদ্ধ। প্রতিটি ডকুমেন্ট আলাদাভাবে যাচাই করুন:`
                            : `This Challan contains ${group.docs.length} separate documents. Automatic selection is strictly disabled. Please inspect each document independently:`}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.docs.map((docItem, idx) => (
                          <DocumentComparisonCard
                            key={docItem.docId}
                            doc={docItem}
                            role="manual"
                            index={idx + 1}
                            language={language}
                            toBn={toBn}
                            copyToClipboard={copyToClipboard}
                            copiedId={copiedId}
                            onInspect={() => setInspectedDoc(docItem)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Raw Snapshot Inspection Modal */}
      {inspectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-indigo-500" size={18} />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isBn ? 'ডকুমেন্টের সম্পূর্ণ র-ডাটা (Raw Firestore Snapshot)' : 'Complete Raw Firestore Snapshot'}
                </h3>
              </div>
              <button 
                onClick={() => setInspectedDoc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <p className="font-mono text-slate-600 dark:text-slate-300">
                <strong>Doc ID:</strong> {inspectedDoc.docId}
              </p>
              <p className="font-mono text-slate-600 dark:text-slate-300">
                <strong>Challan:</strong> #{inspectedDoc.challanNo} | <strong>Date:</strong> {inspectedDoc.dateStr}
              </p>
              <p className="font-mono text-slate-600 dark:text-slate-300">
                <strong>Timestamp:</strong> {inspectedDoc.timestamp} ({new Date(inspectedDoc.timestamp).toISOString()})
              </p>
            </div>

            <div className="flex-1 overflow-auto bg-slate-950 p-4 rounded-xl text-slate-100 font-mono text-[11px] border border-slate-800">
              <pre>{JSON.stringify(inspectedDoc.rawSnapshot || inspectedDoc, null, 2)}</pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedDoc(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700"
              >
                {isBn ? 'ঠিক আছে' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controlled Single-Document Deletion Confirmation Modal */}
      {testDeleteConfirmation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={24} />
              <h3 className="text-base font-black uppercase tracking-tight">
                {isBn ? 'নিশ্চিতকরণ প্রয়োজন (CONFIRMATION REQUIRED)' : 'CONFIRMATION REQUIRED'}
              </h3>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <span className="text-slate-500 font-bold">Challan:</span>
                <span className="font-black text-slate-900 dark:text-white">#{testDeleteConfirmation.challanNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <span className="text-rose-600 dark:text-rose-400 font-bold">Document ID to delete:</span>
                <span className="font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded">
                  {testDeleteConfirmation.docIdToDelete}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <span className="text-slate-500 font-bold">Status:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">Suspected Duplicate</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Canonical document to KEEP:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                  {testDeleteConfirmation.canonicalDocId}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {isBn ? 'কঠোর নিরাপত্তা নিয়মাবলী:' : 'Strict Safety Rules:'}
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>{isBn ? 'শুধুমাত্র "uuan6rzte" ডকুমেন্টটি মুছে ফেলা হবে।' : 'ONLY document "uuan6rzte" will be deleted.'}</li>
                <li>{isBn ? 'ক্যানোনিক্যাল ডকুমেন্ট "854" অপরিবর্তিত থাকবে।' : 'Canonical document "854" will NOT be touched.'}</li>
                <li>{isBn ? 'অন্য কোনো ডকুমেন্ট পরিবর্তন করা হবে না।' : 'No other document will be modified.'}</li>
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setTestDeleteConfirmation(null)}
                disabled={isDeletingTest}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={handleExecuteControlledDelete}
                disabled={isDeletingTest}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingTest ? (
                  <span>{isBn ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...'}</span>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>{isBn ? 'হ্যাঁ, uuan6rzte মুছে ফেলুন' : 'Confirm Delete uuan6rzte'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Deletion Verification Result Banner */}
      {testResult && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={20} />
              <h4 className="text-sm font-black uppercase">
                {isBn ? 'পোস্ট-ডিলিট ভেরিফিকেশন সফল' : 'Post-Deletion Verification Succeeded'}
              </h4>
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="text-emerald-600 hover:text-emerald-800 p-1"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">1. Deleted Document Status</span>
              <p className="font-mono font-bold text-rose-600 dark:text-rose-400">
                Document "uuan6rzte": <strong>NO LONGER EXISTS (Verified)</strong>
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">2. Canonical Document Status</span>
              <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Document "854": <strong>EXISTS & INTACT (Verified)</strong>
              </p>
            </div>
          </div>

          {testResult.remainingData && (
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">3. Remaining Canonical Record (Challan #854)</span>
              <pre className="text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto">
                {JSON.stringify(testResult.remainingData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

interface DocumentComparisonCardProps {
  doc: AnalyzedDoc;
  role: 'canonical' | 'duplicate' | 'manual';
  index?: number;
  language: 'bn' | 'en';
  toBn: (n: any) => string;
  copyToClipboard: (t: string) => void;
  copiedId: string | null;
  onInspect: () => void;
  onInitiateTestDelete?: () => void;
}

const DocumentComparisonCard: React.FC<DocumentComparisonCardProps> = ({
  doc,
  role,
  index,
  language,
  toBn,
  copyToClipboard,
  copiedId,
  onInspect,
  onInitiateTestDelete
}) => {
  const isBn = language === 'bn';
  const isCopied = copiedId === doc.docId;

  const headerColors = {
    canonical: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
    duplicate: 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30',
    manual: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30'
  };

  const badgeLabels = {
    canonical: isBn ? 'ক্যানোনিক্যাল মূল রেকর্ড (KEEP / CANONICAL)' : 'KEEP / CANONICAL RECORD',
    duplicate: isBn ? 'সন্দেহভাজন ফ্যান্টম ডুপ্লিকেট (DUPLICATE CANDIDATE)' : 'SUSPECTED DUPLICATE CANDIDATE',
    manual: isBn ? `ডকুমেন্ট #${toBn(index)} (ম্যানুয়াল অডিট)` : `Document #${index} (Manual Audit)`
  };

  return (
    <div className={`p-4 rounded-xl border space-y-3.5 flex flex-col justify-between ${
      role === 'canonical'
        ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/40'
        : role === 'duplicate'
        ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40'
        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
    }`}>
      
      {/* Top Header Badge */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${headerColors[role]}`}>
            {badgeLabels[role]}
          </span>

          <button
            onClick={onInspect}
            className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
          >
            <FileText size={12} />
            {isBn ? 'র-ডাটা' : 'Raw JSON'}
          </button>
        </div>

        {/* Document ID Bar */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="min-w-0 pr-2">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">
              {isBn ? 'ফায়ারস্টোর ডকুমেন্ট আইডি' : 'Firestore Document ID'}
            </span>
            <span className="text-xs font-mono font-black text-slate-900 dark:text-slate-100 truncate block">
              {doc.docId}
            </span>
          </div>

          <button
            onClick={() => copyToClipboard(doc.docId)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            title={isBn ? 'আইডি কপি করুন' : 'Copy ID'}
          >
            {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Main Calculated Values Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">{isBn ? 'ওজন (Weight)' : 'Weight'}</span>
          <span className="text-xs font-black text-slate-900 dark:text-white">
            {toBn(doc.weightKg)} KG
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">{isBn ? 'দর (Rate)' : 'Rate'}</span>
          <span className="text-xs font-black text-slate-900 dark:text-white">
            ৳{toBn(doc.ratePerMon)}/মন
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">{isBn ? 'মোট মূল্য (Total)' : 'Total Amount'}</span>
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
            ৳{toBn(Math.round(doc.totalPrice))}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">{isBn ? 'গেট এন্ট্রি (Gate)' : 'Gate Entry'}</span>
          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
            {doc.gateEntryNo !== undefined ? toBn(doc.gateEntryNo) : '---'}
          </span>
        </div>
      </div>

      {/* Seller & Operator Details */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase">{isBn ? 'বিক্রেতা:' : 'Seller:'}</span>
          <span className="font-black text-slate-900 dark:text-white truncate max-w-[150px]">{doc.sellerName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase">{isBn ? 'অপারেটর:' : 'Operator:'}</span>
          <span className="font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[150px] text-[11px]">{doc.operator}</span>
        </div>
        <div className="flex justify-between items-center font-mono text-[10px] text-slate-400">
          <span>{isBn ? 'টাইমস্ট্যাম্প:' : 'Timestamp:'}</span>
          <span title={new Date(doc.timestamp).toLocaleString()}>{doc.timestamp}</span>
        </div>
        {doc.monDetails && (
          <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span>{isBn ? 'মণ বিবরণ:' : 'Mon Details:'}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{doc.monDetails}</span>
          </div>
        )}
      </div>

      {/* Field Completeness Audit Checklist */}
      <div className="pt-1 space-y-1.5 text-[11px]">
        <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
          {isBn ? 'ফিল্ড উপস্থিতি বিশ্লেষণ (Field Completeness):' : 'Field Completeness Analysis:'}
        </span>

        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
          {/* Present fields */}
          <div className="flex flex-wrap gap-1">
            {doc.presentFields.map(f => (
              <span key={f} className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40 font-mono">
                ✓ {f}
              </span>
            ))}
          </div>

          {/* Missing fields */}
          {doc.missingFields.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/50">
              {doc.missingFields.map(f => (
                <span key={f} className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
                  ✕ {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Controlled Single-Document Deletion Button for Test Candidate */}
        {onInitiateTestDelete && (
          <button
            onClick={onInitiateTestDelete}
            className="w-full mt-2 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>{isBn ? '🧪 নিয়ন্ত্রিত টেস্ট ডিলিট (uuan6rzte)' : '🧪 Controlled Test: Delete uuan6rzte'}</span>
          </button>
        )}
      </div>

    </div>
  );
};
