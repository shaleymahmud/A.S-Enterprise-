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
  ShieldAlert,
  SlidersHorizontal,
  ChevronLeft,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react';
import { Calculation } from '../utils/calculationNormalizer';

interface HistoricalCleanupCenterProps {
  calculations: Calculation[];
  language: 'bn' | 'en';
  onClose?: () => void;
}

export type CleanupSection = 'standard' | 'minus' | 'manual';

export interface DocumentInfo {
  docId: string;
  challanNo: number;
  dateStr: string;
  timestamp: number;
  sellerName: string;
  weightKg: number;
  grossKg?: number;
  deductedWeight?: number;
  deductionPercentage?: number;
  netKg?: number;
  isMinusCalculated?: boolean;
  rate: number;
  totalAmount: number;
  monDetails?: string;
  totalMon?: number;
  gateEntryNo?: number;
  operator: string;
  createdByName?: string;
  isNumericId: boolean;
  isUUID: boolean;
  isRandom9Char: boolean;
  rawSnapshot?: Record<string, any>;
}

export interface CleanupGroup {
  challanNo: number;
  category: 'STANDARD_DUPLICATE' | 'MINUS_ADJUSTED' | 'MANUAL_REVIEW';
  docs: DocumentInfo[];
  date: string;
  sellerName: string;
  canonicalDoc?: DocumentInfo;
  duplicateCandidateDoc?: DocumentInfo;
  manualReviewReason?: string;
  // Specific Minus details
  grossKg?: number;
  deductedKg?: number;
  netKg?: number;
  rate?: number;
  netTotalAmount?: number;
}

export const HistoricalCleanupCenter: React.FC<HistoricalCleanupCenterProps> = ({
  calculations,
  language,
  onClose
}) => {
  const isBn = language === 'bn';

  // Navigation State
  const [activeSection, setActiveSection] = useState<CleanupSection>('standard');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedChallans, setExpandedChallans] = useState<Set<number>>(new Set());
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  // Exact Firestore Document ID Selection Set
  // CRITICAL: NEVER pre-select anything. Starts completely empty.
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Digit conversion helper
  const toBn = (num: number | string | undefined | null) => {
    if (num === undefined || num === null) return '---';
    if (!isBn) return num.toString();
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, d => bnDigits[parseInt(d, 10)]);
  };

  // Group and classify calculations into the exact 3 categories
  const { allGroups, standardGroups, minusGroups, manualGroups } = useMemo(() => {
    const byChallan = new Map<number, DocumentInfo[]>();

    calculations.forEach(c => {
      const ch = c.challanNo;
      if (ch === undefined || ch === null) return;

      const docId = c.id;
      const isNumericId = /^\d+$/.test(docId);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(docId);
      const isRandom9Char = !isNumericId && !isUUID;

      const raw = c.rawSnapshot || {};
      const dateStr = c.date || (c.timestamp ? new Date(c.timestamp).toLocaleDateString('en-GB') : '---');

      const docInfo: DocumentInfo = {
        docId,
        challanNo: ch,
        dateStr,
        timestamp: c.timestamp || 0,
        sellerName: (c.sellerName || raw.seller || 'N/A').trim(),
        weightKg: Number(c.weightKg ?? c.totalKg ?? raw.weightKg ?? raw.totalKg ?? 0),
        deductedWeight: Number(c.deductedWeight ?? raw.deductedWeight ?? 0),
        deductionPercentage: Number(c.deductionPercentage ?? raw.deductionPercentage ?? 0),
        isMinusCalculated: Boolean(c.isMinusCalculated || raw.isMinusCalculated),
        rate: Number(c.rate ?? c.ratePerMon ?? raw.rate ?? raw.ratePerMon ?? 0),
        totalAmount: Number(c.totalAmount ?? c.totalPrice ?? raw.totalAmount ?? raw.totalPrice ?? 0),
        monDetails: c.monDetails || raw.monDetails,
        totalMon: Number(c.totalMon ?? raw.totalMon ?? 0),
        gateEntryNo: c.gateEntryNo ?? c.getEntryNo ?? c.gateEntry ?? raw.gateEntryNo ?? raw.getEntryNo ?? raw.gateEntry,
        operator: c.operatorEmail || c.createdBy || raw.operatorEmail || raw.createdBy || 'Unknown',
        createdByName: c.createdByName || raw.createdByName,
        isNumericId,
        isUUID,
        isRandom9Char,
        rawSnapshot: raw
      };

      if (!byChallan.has(ch)) byChallan.set(ch, []);
      byChallan.get(ch)!.push(docInfo);
    });

    const standard: CleanupGroup[] = [];
    const minus: CleanupGroup[] = [];
    const manual: CleanupGroup[] = [];
    const all: CleanupGroup[] = [];

    // Filter to duplicate groups only (> 1 doc)
    byChallan.forEach((docs, challanNo) => {
      if (docs.length <= 1) return;

      const date = docs[0]?.dateStr || '---';
      const seller = docs[0]?.sellerName || 'N/A';

      // Check for Manual Review:
      // Condition 1: > 2 documents
      // Condition 2: Seller name mismatch
      if (docs.length > 2) {
        const group: CleanupGroup = {
          challanNo,
          category: 'MANUAL_REVIEW',
          docs,
          date,
          sellerName: seller,
          manualReviewReason: isBn ? `একাধিক (${docs.length}টি) ডকুমেন্ট রয়েছে` : `Multi-document group (${docs.length} docs)`
        };
        manual.push(group);
        all.push(group);
        return;
      }

      const s0 = docs[0].sellerName.toLowerCase().trim();
      const s1 = docs[1].sellerName.toLowerCase().trim();
      if (s0 && s1 && s0 !== s1) {
        const group: CleanupGroup = {
          challanNo,
          category: 'MANUAL_REVIEW',
          docs,
          date,
          sellerName: `${docs[0].sellerName} / ${docs[1].sellerName}`,
          manualReviewReason: isBn ? `বিক্রেতার নামে অমিল: "${docs[0].sellerName}" বনাম "${docs[1].sellerName}"` : `Seller mismatch: "${docs[0].sellerName}" vs "${docs[1].sellerName}"`
        };
        manual.push(group);
        all.push(group);
        return;
      }

      // Identify canonical and candidate docs
      const canonicalDoc = docs.find(d => d.isNumericId) || docs[0];
      const duplicateCandidateDoc = docs.find(d => !d.isNumericId) || docs[1];

      // Check for Minus Adjusted:
      const hasMinus = docs.some(d => d.isMinusCalculated === true);
      if (hasMinus) {
        const grossKg = canonicalDoc.weightKg || duplicateCandidateDoc.weightKg;
        const deductedKg = duplicateCandidateDoc.deductedWeight || canonicalDoc.deductedWeight || 0;
        const netKg = grossKg - deductedKg;
        const rate = canonicalDoc.rate || duplicateCandidateDoc.rate;
        const netTotalAmount = canonicalDoc.totalAmount || duplicateCandidateDoc.totalAmount;

        const group: CleanupGroup = {
          challanNo,
          category: 'MINUS_ADJUSTED',
          docs,
          date,
          sellerName: seller,
          canonicalDoc,
          duplicateCandidateDoc,
          grossKg,
          deductedKg,
          netKg,
          rate,
          netTotalAmount
        };
        minus.push(group);
        all.push(group);
        return;
      }

      // Otherwise: Standard Duplicate
      const group: CleanupGroup = {
        challanNo,
        category: 'STANDARD_DUPLICATE',
        docs,
        date,
        sellerName: seller,
        canonicalDoc,
        duplicateCandidateDoc
      };
      standard.push(group);
      all.push(group);
    });

    // Sort by challanNo ascending for easy sequential inspection
    standard.sort((a, b) => a.challanNo - b.challanNo);
    minus.sort((a, b) => a.challanNo - b.challanNo);
    manual.sort((a, b) => a.challanNo - b.challanNo);
    all.sort((a, b) => a.challanNo - b.challanNo);

    return { allGroups: all, standardGroups: standard, minusGroups: minus, manualGroups: manual };
  }, [calculations, isBn]);

  // Current active groups based on tab
  const currentCategoryGroups = useMemo(() => {
    switch (activeSection) {
      case 'standard': return standardGroups;
      case 'minus': return minusGroups;
      case 'manual': return manualGroups;
      default: return standardGroups;
    }
  }, [activeSection, standardGroups, minusGroups, manualGroups]);

  // Filter by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return currentCategoryGroups;
    const q = searchQuery.toLowerCase().trim();
    return currentCategoryGroups.filter(g => 
      g.challanNo.toString().includes(q) ||
      g.sellerName.toLowerCase().includes(q) ||
      g.docs.some(d => d.docId.toLowerCase().includes(q) || d.operator.toLowerCase().includes(q))
    );
  }, [currentCategoryGroups, searchQuery]);

  // Paginated groups
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage) || 1;
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredGroups.slice(start, start + itemsPerPage);
  }, [filteredGroups, currentPage, itemsPerPage]);

  // Toggle single document selection
  const handleToggleDocSelect = (docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  // Select all visible delete candidates on the current page
  const handleSelectVisibleCandidates = () => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      paginatedGroups.forEach(g => {
        if (g.category === 'STANDARD_DUPLICATE' && g.duplicateCandidateDoc) {
          next.add(g.duplicateCandidateDoc.docId);
        } else if (g.category === 'MINUS_ADJUSTED') {
          // For minus adjusted, do NOT auto-select anything!
        }
      });
      return next;
    });
  };

  // Clear all selections
  const handleClearAllSelections = () => {
    setSelectedDocIds(new Set());
  };

  // Toggle expand challan
  const toggleExpand = (ch: number) => {
    setExpandedChallans(prev => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  // Expand / collapse all on current page
  const handleExpandAllVisible = () => {
    setExpandedChallans(new Set(paginatedGroups.map(g => g.challanNo)));
  };

  const handleCollapseAllVisible = () => {
    setExpandedChallans(new Set());
  };

  // Build metadata map for previewing selected docs
  const selectedDocsMetadata = useMemo(() => {
    const list: { doc: DocumentInfo; group: CleanupGroup }[] = [];
    allGroups.forEach(g => {
      g.docs.forEach(d => {
        if (selectedDocIds.has(d.docId)) {
          list.push({ doc: d, group: g });
        }
      });
    });
    return list;
  }, [allGroups, selectedDocIds]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4 pb-32">
      {/* Top Header Card */}
      <div className="bg-slate-900/90 dark:bg-slate-900 border border-slate-700/60 rounded-xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>{isBn ? 'ঐতিহাসিক ডুপ্লিকেট ক্লিনআপ সেন্টার' : 'Historical Cleanup Center'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    PHASE 1: REVIEW ONLY
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isBn 
                    ? 'ম্যানুয়াল স্ক্রুটিনি ও নিরাপদ স্টেজ সিলেকশন সেন্টার — এই পর্বে কোনো ডকুমেন্ট ডিলিট বা পরিবর্তন হবে না।' 
                    : 'Manual scrutiny & safe staging center — Zero deletions or modifications will occur in this phase.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selected Counter & Preview Trigger */}
            <button
              onClick={() => setIsPreviewOpen(true)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                selectedDocIds.size > 0 
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30 ring-2 ring-rose-500/20' 
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <CheckSquare size={15} />
              <span>{isBn ? 'বাছাইকৃত ডকুমেন্ট:' : 'Selected Documents:'}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                selectedDocIds.size > 0 ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-300'
              }`}>
                {toBn(selectedDocIds.size)}
              </span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            )}
          </div>
        </div>

        {/* Phase 1 Safety Banner */}
        <div className="mt-4 p-3 bg-blue-950/40 border border-blue-800/40 rounded-lg flex items-start gap-3 text-xs text-blue-200">
          <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold text-blue-300">
              {isBn ? '🛡️ ফেজ ১ কঠোর সুরক্ষা নীতি:' : '🛡️ Phase 1 Strict Safety Protocol:'}
            </span>
            <p className="text-slate-300 leading-relaxed">
              {isBn 
                ? '১. সিস্টেম কোনো ডকুমেন্ট স্বয়ংক্রিয়ভাবে ডিলিট করবে না। ২. কোনো ডকুমেন্ট স্বয়ংক্রিয়ভাবে বাছাই করা হবে না। ৩. সিলেকশন শুধুমাত্র নির্দিষ্ট Firestore Document ID-এর ওপর নির্ভর করবে (চালান নম্বর বা কোয়েরি দিয়ে ডিলিট নিষিদ্ধ)। ৪. এই মুহূর্তে কোনো Firestore Write/Delete কার্যকর হবে না।'
                : '1. Zero automatic deletions. 2. Zero automatic pre-selection. 3. Deletion staging is strictly by exact Firestore Document ID (never by challan or query). 4. Zero Firestore writes/deletes are performed.'}
            </p>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Section 1: Standard Duplicates */}
          <button
            onClick={() => { setActiveSection('standard'); setCurrentPage(1); }}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              activeSection === 'standard'
                ? 'bg-emerald-950/40 border-emerald-500/60 ring-2 ring-emerald-500/30'
                : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isBn ? 'সেকশন ১' : 'SECTION 1'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${
                activeSection === 'standard' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
              }`}>
                {toBn(standardGroups.length)} {isBn ? 'গ্রুপ' : 'groups'}
              </span>
            </div>
            <div className="text-sm font-black text-white mt-1">
              {isBn ? 'স্ট্যান্ডার্ড ডুপ্লিকেট' : 'Standard Duplicates'}
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5">
              {isBn ? 'ক্লিন জোড়া (একই ওজন ও দর, নো-মাইনাস)' : 'Clean pairs (Identical wt & rate, no minus)'}
            </div>
          </button>

          {/* Section 2: Minus Adjusted */}
          <button
            onClick={() => { setActiveSection('minus'); setCurrentPage(1); }}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              activeSection === 'minus'
                ? 'bg-amber-950/40 border-amber-500/60 ring-2 ring-amber-500/30'
                : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isBn ? 'সেকশন ২' : 'SECTION 2'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${
                activeSection === 'minus' ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'
              }`}>
                {toBn(minusGroups.length)} {isBn ? 'গ্রুপ' : 'groups'}
              </span>
            </div>
            <div className="text-sm font-black text-white mt-1">
              {isBn ? 'মাইনাস সমন্বয় ক্যান্ডিডেট' : 'Minus Adjusted Candidates'}
            </div>
            <div className="text-[11px] text-amber-400 mt-0.5">
              {isBn ? 'কর্তন ক্যালকুলেটরের হিসাব (ম্যানুয়াল সিদ্ধান্ত)' : 'Deduction calculations (Manual decision)'}
            </div>
          </button>

          {/* Section 3: Manual Review */}
          <button
            onClick={() => { setActiveSection('manual'); setCurrentPage(1); }}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              activeSection === 'manual'
                ? 'bg-rose-950/40 border-rose-500/60 ring-2 ring-rose-500/30'
                : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isBn ? 'সেকশন ৩' : 'SECTION 3'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${
                activeSection === 'manual' ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-300'
              }`}>
                {toBn(manualGroups.length)} {isBn ? 'গ্রুপ' : 'groups'}
              </span>
            </div>
            <div className="text-sm font-black text-white mt-1">
              {isBn ? 'ম্যানুয়াল রিভিউ গ্রুপ' : 'Manual Review Groups'}
            </div>
            <div className="text-[11px] text-rose-400 mt-0.5">
              {isBn ? '৩/৪ ডকুমেন্ট বা বিক্রেতার নামে অমিল' : '3/4 documents or seller mismatch'}
            </div>
          </button>
        </div>
      </div>

      {/* Action Bar: Search, Selection Controls, Pagination info */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder={isBn ? 'চালান নম্বর, বিক্রেতা বা Document ID দিয়ে খুঁজুন...' : 'Search by challan, seller, or doc ID...'}
            className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {activeSection === 'standard' && (
            <button
              onClick={handleSelectVisibleCandidates}
              className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              title={isBn ? 'বর্তমান পৃষ্ঠার দৃশ্যমান সম্ভাব্য ডিলিট ক্যান্ডিডেট বাছাই করুন' : 'Select visible random ID candidates on this page'}
            >
              <CheckSquare size={13} />
              <span>{isBn ? 'দৃশ্যমান ক্যান্ডিডেট বাছাই' : 'Select Visible Candidates'}</span>
            </button>
          )}

          {selectedDocIds.size > 0 && (
            <button
              onClick={handleClearAllSelections}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Square size={13} />
              <span>{isBn ? 'সিলেকশন মুছুন' : 'Clear All'}</span>
            </button>
          )}

          <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

          <button
            onClick={handleExpandAllVisible}
            className="px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-lg text-[11px] font-medium transition-colors"
          >
            {isBn ? 'সব খুলুন' : 'Expand All'}
          </button>
          <button
            onClick={handleCollapseAllVisible}
            className="px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-lg text-[11px] font-medium transition-colors"
          >
            {isBn ? 'সব বন্ধ করুন' : 'Collapse All'}
          </button>
        </div>
      </div>

      {/* Main Content Area: Groups List */}
      <div className="space-y-3">
        {filteredGroups.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
            <p className="font-semibold text-sm">
              {isBn ? 'কোনো রেকর্ড পাওয়া যায়নি।' : 'No duplicate groups found matching your search.'}
            </p>
          </div>
        ) : (
          paginatedGroups.map(group => {
            const isExpanded = expandedChallans.has(group.challanNo);

            return (
              <div 
                key={group.challanNo} 
                className="bg-slate-900/80 dark:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden shadow-lg transition-all"
              >
                {/* Collapsible Header */}
                <div 
                  onClick={() => toggleExpand(group.challanNo)}
                  className="p-4 cursor-pointer hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-amber-400 text-base">
                        #{toBn(group.challanNo)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {toBn(group.docs.length)} {isBn ? 'ডকুমেন্ট' : 'docs'}
                      </span>
                    </div>

                    <div className="h-4 w-px bg-slate-800 hidden sm:block" />

                    <div className="text-xs font-semibold text-white">
                      <span className="text-slate-400 font-normal mr-1">{isBn ? 'বিক্রেতা:' : 'Seller:'}</span>
                      {group.sellerName}
                    </div>

                    <div className="text-xs text-slate-400 font-mono hidden sm:inline">
                      📅 {toBn(group.date)}
                    </div>
                  </div>

                  {/* Header Metrics & Status Badges */}
                  <div className="flex items-center gap-2.5 text-xs">
                    {group.category === 'STANDARD_DUPLICATE' && (
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        STANDARD DUPLICATE
                      </span>
                    )}

                    {group.category === 'MINUS_ADJUSTED' && (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          MINUS ADJUSTED
                        </span>
                        {group.grossKg !== undefined && (
                          <span className="text-[11px] font-mono text-slate-400 hidden lg:inline">
                            (গ্রস: {toBn(group.grossKg)} - কর্তন: {toBn(group.deductedKg)} = নিট: {toBn(group.netKg)} KG)
                          </span>
                        )}
                      </div>
                    )}

                    {group.category === 'MANUAL_REVIEW' && (
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        MANUAL REVIEW
                      </span>
                    )}

                    {/* Number of selected docs in this group */}
                    {group.docs.some(d => selectedDocIds.has(d.docId)) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                        {toBn(group.docs.filter(d => selectedDocIds.has(d.docId)).length)} {isBn ? 'বাছাইকৃত' : 'selected'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Collapsible Body: Side-by-Side Document Inspection */}
                {isExpanded && (
                  <div className="p-4 space-y-4 bg-slate-950/40">
                    {/* Visual Suggestion Banner */}
                    {group.category === 'STANDARD_DUPLICATE' && (
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Info size={14} className="text-amber-400 shrink-0" />
                          <span>
                            {isBn 
                              ? 'ভিজ্যুয়াল প্রস্তাবনা: নিউমেরিক ডকুমেন্ট ID সংরক্ষণ করুন, র্যান্ডম ID ডকুমেন্ট ডিলিট ক্যান্ডিডেট হিসেবে বিবেচনা করুন।'
                              : 'Visual Suggestion: Keep canonical numeric ID document, consider random ID as delete candidate.'}
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-400/80 font-mono">
                          {isBn ? 'স্বয়ংক্রিয়ভাবে সিলেক্ট করা হয়নি' : 'Not automatically selected'}
                        </span>
                      </div>
                    )}

                    {group.category === 'MINUS_ADJUSTED' && (
                      <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs space-y-2">
                        <div className="flex items-center justify-between font-bold text-amber-300">
                          <span className="flex items-center gap-1.5">
                            <Scale size={14} />
                            {isBn ? 'মাইনাস / কর্তন হিসাব বিশ্লেষণ:' : 'Minus / Deduction Breakdown:'}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            MANUAL DECISION REQUIRED
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-slate-300 font-mono text-[11px]">
                          <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                            <div className="text-[10px] text-slate-500">{isBn ? 'গ্রস ওজন' : 'Gross Wt'}</div>
                            <div className="font-bold text-white">{toBn(group.grossKg)} KG</div>
                          </div>
                          <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                            <div className="text-[10px] text-slate-500">{isBn ? 'কর্তন ওজন' : 'Deducted Wt'}</div>
                            <div className="font-bold text-rose-400">-{toBn(group.deductedKg)} KG</div>
                          </div>
                          <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                            <div className="text-[10px] text-slate-500">{isBn ? 'নিট ওজন' : 'Net Wt'}</div>
                            <div className="font-bold text-emerald-400">{toBn(group.netKg)} KG</div>
                          </div>
                          <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                            <div className="text-[10px] text-slate-500">{isBn ? 'দর (প্রতি মণ)' : 'Rate/Mon'}</div>
                            <div className="font-bold text-white">৳{toBn(group.rate)}</div>
                          </div>
                          <div className="p-2 bg-slate-900/80 rounded border border-slate-800 col-span-2 sm:col-span-1">
                            <div className="text-[10px] text-slate-500">{isBn ? 'নিট মোট টাকা' : 'Net Total'}</div>
                            <div className="font-bold text-amber-300">৳{toBn(group.netTotalAmount?.toFixed(2))}</div>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {isBn 
                            ? 'উভয় ডকুমেন্টের মোট টাকা নিট ওজনের ভিত্তিতে হুবহু মিলে যায়। নিউমেরিক ডকুমেন্টে কর্তন ফিল্ড অনুপস্থিত কিন্তু ক্লাউড ডকুমেন্টে কর্তনের হিসাব পূর্ণাঙ্গ।'
                            : 'Both documents share the same Net Total Amount. The numeric document holds canonical ID but lacks deduction fields; the random ID document retains full deduction metadata.'}
                        </p>
                      </div>
                    )}

                    {group.category === 'MANUAL_REVIEW' && (
                      <div className="p-2.5 bg-rose-950/40 border border-rose-800/40 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                        <AlertTriangle size={15} className="shrink-0 text-rose-400" />
                        <span>
                          <strong>{isBn ? 'বিশেষ সতর্কতা:' : 'Notice:'}</strong> {group.manualReviewReason}
                        </span>
                      </div>
                    )}

                    {/* Document Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.docs.map((doc, idx) => {
                        const isSelected = selectedDocIds.has(doc.docId);
                        const isNumeric = doc.isNumericId;
                        const isSuggestedKeep = group.category === 'STANDARD_DUPLICATE' && isNumeric;
                        const isSuggestedDelete = group.category === 'STANDARD_DUPLICATE' && !isNumeric;

                        return (
                          <div 
                            key={doc.docId}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                              isSelected 
                                ? 'bg-rose-950/30 border-rose-500/80 shadow-md ring-1 ring-rose-500/40' 
                                : isSuggestedKeep 
                                  ? 'bg-slate-900/90 border-emerald-500/40' 
                                  : isSuggestedDelete 
                                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700' 
                                    : 'bg-slate-900/90 border-slate-800'
                            }`}
                          >
                            <div className="space-y-2.5">
                              {/* Document ID & Suggestion Tag */}
                              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-500 font-mono">Doc #{toBn(idx + 1)}:</span>
                                    <span className="font-mono text-xs font-bold text-white bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                      {doc.docId}
                                    </span>
                                    <button 
                                      onClick={() => copyToClipboard(doc.docId)}
                                      className="text-slate-400 hover:text-white p-0.5"
                                      title={isBn ? 'ID কপি করুন' : 'Copy ID'}
                                    >
                                      {copiedId === doc.docId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    </button>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    calculations/{doc.docId}
                                  </div>
                                </div>

                                {/* Suggestion Badges */}
                                {isSuggestedKeep && (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    KEEP (CANONICAL)
                                  </span>
                                )}
                                {isSuggestedDelete && (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    POSSIBLE DELETE
                                  </span>
                                )}
                                {group.category !== 'STANDARD_DUPLICATE' && (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    REVIEW
                                  </span>
                                )}
                              </div>

                              {/* Document Attributes */}
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-slate-300 font-mono">
                                <div>
                                  <span className="text-[10px] text-slate-500 block font-sans">{isBn ? 'ওজন:' : 'Weight:'}</span>
                                  <span className="font-bold text-white">{toBn(doc.weightKg)} KG</span>
                                  {doc.monDetails && (
                                    <span className="text-[10px] text-slate-400 block font-sans truncate">{doc.monDetails}</span>
                                  )}
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-500 block font-sans">{isBn ? 'মোট টাকা:' : 'Total Amount:'}</span>
                                  <span className="font-bold text-amber-400">৳{toBn(doc.totalAmount.toFixed(2))}</span>
                                  <span className="text-[10px] text-slate-400 block font-sans">@ ৳{toBn(doc.rate)}/মণ</span>
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-500 block font-sans">{isBn ? 'গেট এন্ট্রি:' : 'Gate Entry:'}</span>
                                  <span className="text-slate-300">{doc.gateEntryNo !== undefined ? `#${toBn(doc.gateEntryNo)}` : '---'}</span>
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-500 block font-sans">{isBn ? 'তারিখ:' : 'Date:'}</span>
                                  <span className="text-slate-300">{doc.dateStr}</span>
                                </div>

                                {doc.isMinusCalculated && (
                                  <div className="col-span-2 p-1.5 bg-amber-950/20 border border-amber-800/30 rounded text-[11px] text-amber-300">
                                    <span>✂️ কর্তন: {toBn(doc.deductedWeight)} KG ({toBn(doc.deductionPercentage?.toFixed(2))}%)</span>
                                  </div>
                                )}

                                <div className="col-span-2 pt-1 border-t border-slate-800/60">
                                  <span className="text-[10px] text-slate-500 block font-sans">{isBn ? 'অপারেটর:' : 'Operator:'}</span>
                                  <span className="text-[10px] text-slate-400 truncate block">
                                    {doc.operator} {doc.createdByName ? `(${doc.createdByName})` : ''}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* SELECTION CHECKBOX (CRITICAL REQUIREMENT) */}
                            <div className="mt-3 pt-2.5 border-t border-slate-800">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleDocSelect(doc.docId)}
                                  className="w-4 h-4 rounded text-rose-600 bg-slate-950 border-slate-700 focus:ring-rose-500 focus:ring-offset-slate-900 cursor-pointer"
                                />
                                <span className={`text-xs font-semibold ${isSelected ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}>
                                  {isBn ? 'ডিলিটের জন্য বাছাই করুন' : 'Select this document for deletion'}
                                </span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {filteredGroups.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              {isBn 
                ? `পৃষ্ঠা ${toBn(currentPage)} / ${toBn(totalPages)} (মোট ${toBn(filteredGroups.length)}টি গ্রুপ)`
                : `Page ${currentPage} of ${totalPages} (Total ${filteredGroups.length} groups)`}
            </span>
            <select
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs text-slate-300 font-semibold"
            >
              <ChevronLeft size={14} className="inline mr-1" />
              {isBn ? 'পূর্ববর্তী' : 'Previous'}
            </button>

            <span className="px-3 py-1 font-mono font-bold text-white bg-slate-950 border border-slate-800 rounded">
              {toBn(currentPage)}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs text-slate-300 font-semibold"
            >
              {isBn ? 'পরবর্তী' : 'Next'}
              <ChevronRight size={14} className="inline ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Bar: Selected Counter & Preview Button */}
      {selectedDocIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 border border-rose-500/50 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4 text-white">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span>{isBn ? 'বাছাইকৃত ডকুমেন্ট:' : 'Selected documents:'}</span>
            <span className="font-mono font-black text-rose-400 text-sm">
              {toBn(selectedDocIds.size)}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <button
            onClick={() => setIsPreviewOpen(true)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <span>{isBn ? 'প্রি-ডিলিট প্রিভিউ দেখুন' : 'View Pre-Delete Preview'}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* PRE-DELETE PREVIEW MODAL / PANEL (CRITICAL REQUIREMENT) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <span>{isBn ? 'প্রি-ডিলিট প্রিভিউ প্যানেল' : 'Pre-Delete Preview Panel'}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      PHASE 1 PREVIEW ONLY
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isBn 
                      ? `মোট ${toBn(selectedDocIds.size)}টি নির্দিষ্ট Firestore Document ID ডিলিটের জন্য স্টেজ করা হয়েছে।` 
                      : `Total ${selectedDocIds.size} specific Firestore Document IDs staged for deletion.`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Notice */}
            <div className="p-3 bg-amber-950/40 border-b border-amber-800/40 text-xs text-amber-200 flex items-center gap-2.5">
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
              <span>
                {isBn 
                  ? 'এটি শুধুমাত্র একটি স্টেজ প্রিভিউ। ফেজ ১-এর নিয়ম অনুযায়ী কোনো ডিলিট বাটন এখানে নেই এবং কোনো ডেটা মুছে ফেলা হবে না।'
                  : 'This is strictly a staging preview. Following Phase 1 rules, the actual Delete button is intentionally omitted.'}
              </span>
            </div>

            {/* Modal Body: Selected Documents List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {selectedDocsMetadata.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {isBn ? 'এখনো কোনো ডকুমেন্ট বাছাই করা হয়নি।' : 'No documents currently selected.'}
                </div>
              ) : (
                selectedDocsMetadata.map(({ doc, group }) => (
                  <div 
                    key={doc.docId}
                    className="p-3 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          #{toBn(doc.challanNo)}
                        </span>
                        <span className="font-mono text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          calculations/{doc.docId}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          ({group.category})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400 font-mono text-[11px]">
                        <span>👤 <strong className="text-slate-300">{doc.sellerName}</strong></span>
                        <span>⚖️ <strong className="text-slate-300">{toBn(doc.weightKg)} KG</strong></span>
                        <span>💰 <strong className="text-slate-300">৳{toBn(doc.totalAmount.toFixed(2))}</strong></span>
                        <span>📅 <strong className="text-slate-300">{doc.dateStr}</strong></span>
                        <span>⏰ <strong className="text-slate-300">{new Date(doc.timestamp).toLocaleTimeString()}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleDocSelect(doc.docId)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg text-[11px] font-semibold transition-colors shrink-0"
                    >
                      {isBn ? 'বাতিল করুন' : 'Remove'}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-400 font-mono">
                {isBn 
                  ? `বাছাইকৃত Document ID কাউন্ট: ${toBn(selectedDocIds.size)}`
                  : `Staged Document IDs: ${selectedDocIds.size}`}
              </div>

              <div className="flex items-center gap-2">
                {selectedDocIds.size > 0 && (
                  <button
                    onClick={handleClearAllSelections}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                  >
                    {isBn ? 'সব মুছুন' : 'Clear All'}
                  </button>
                )}
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {isBn ? 'প্রিভিউ বন্ধ করুন' : 'Close Preview'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
