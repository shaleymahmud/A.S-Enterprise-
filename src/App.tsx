import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Calculator as CalcIcon, 
  History as HistoryIcon, 
  FileText, 
  Settings, 
  LayoutDashboard, 
  UserCog, 
  Save, 
  Trash2, 
  Download, 
  Plus,
  Clock,
  User,
  Scale,
  Receipt as ReceiptIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type MonType = 40 | 41 | 42 | 43;

interface Calculation {
  id: string;
  timestamp: number;
  sellerName: string;
  totalKg: number;
  monType: MonType;
  ratePerMon: number;
  totalMon: number;
  totalPrice: number;
}

interface Note {
  id: string;
  timestamp: number;
  title: string;
  content: string;
}

type Tab = 'home' | 'calculator' | 'history' | 'note' | 'management' | 'settings';
type DateFilter = 'today' | 'yesterday' | '7days' | '1month';

// --- Main Application ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // Persistence
  useEffect(() => {
    const savedCalcs = localStorage.getItem('as_enterprise_calcs');
    const savedNotes = localStorage.getItem('as_enterprise_notes');
    if (savedCalcs) setCalculations(JSON.parse(savedCalcs));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
  }, []);

  useEffect(() => {
    localStorage.setItem('as_enterprise_calcs', JSON.stringify(calculations));
  }, [calculations]);

  useEffect(() => {
    localStorage.setItem('as_enterprise_notes', JSON.stringify(notes));
  }, [notes]);

  // --- Handlers ---

  const addCalculation = (calc: Calculation) => {
    setCalculations([calc, ...calculations]);
  };

  const deleteCalculation = (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      setCalculations(calculations.filter(c => c.id !== id));
    }
  };

  const addNote = (note: Note) => {
    setNotes([note, ...notes]);
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  // --- Analytical Computations ---

  const filteredCalculations = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return calculations.filter(calc => {
      const diff = now - calc.timestamp;
      if (dateFilter === 'today') {
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        return calc.timestamp >= startOfDay;
      }
      if (dateFilter === 'yesterday') {
        const startOfYesterday = new Date().setHours(0, 0, 0, 0) - oneDay;
        const endOfYesterday = new Date().setHours(0, 0, 0, 0) - 1;
        return calc.timestamp >= startOfYesterday && calc.timestamp <= endOfYesterday;
      }
      if (dateFilter === '7days') return diff <= 7 * oneDay;
      if (dateFilter === '1month') return diff <= 30 * oneDay;
      return true;
    });
  }, [calculations, dateFilter]);

  const stats = useMemo(() => {
    return filteredCalculations.reduce((acc, curr) => ({
      totalKg: acc.totalKg + curr.totalKg,
      totalMon: acc.totalMon + curr.totalMon,
      totalPrice: acc.totalPrice + curr.totalPrice
    }), { totalKg: 0, totalMon: 0, totalPrice: 0 });
  }, [filteredCalculations]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 selection:bg-yellow-200">
      {/* Compact Header */}
      <header className="bg-yellow-400 text-black shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              <h1 className="text-base font-black tracking-tight uppercase">A. S Enterprise</h1>
            </div>
            
            <nav className="hidden md:flex items-center h-full">
              <NavButton label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavButton label="Note" active={activeTab === 'note'} onClick={() => setActiveTab('note')} />
              <NavButton label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
              <NavButton label="Management" active={activeTab === 'management'} onClick={() => setActiveTab('management')} />
              <NavButton label="Calculator" active={activeTab === 'calculator'} onClick={() => setActiveTab('calculator')} />
              <NavButton label="Setting" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
            </nav>

            <div className="md:hidden">
              <select 
                value={activeTab} 
                onChange={(e) => setActiveTab(e.target.value as Tab)}
                className="bg-black text-white text-[10px] font-bold border-none rounded px-2 py-1 outline-none"
              >
                <option value="home">Home</option>
                <option value="note">Note</option>
                <option value="history">History</option>
                <option value="management">Management</option>
                <option value="calculator">Calculator</option>
                <option value="settings">Setting</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HomeSection stats={stats} dateFilter={dateFilter} setDateFilter={setDateFilter} />
            </motion.div>
          )}
          {activeTab === 'calculator' && (
            <motion.div key="calculator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CalculatorSection onSave={addCalculation} />
            </motion.div>
          )}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HistorySection calculations={calculations} onDelete={deleteCalculation} />
            </motion.div>
          )}
          {activeTab === 'note' && (
            <motion.div key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <NoteSection notes={notes} onAdd={addNote} onDelete={deleteNote} />
            </motion.div>
          )}
          {activeTab === 'management' && (
            <motion.div key="mgmt" className="bg-white p-12 rounded-xl shadow-sm text-center border border-slate-200">
              <UserCog className="w-16 h-16 mx-auto text-yellow-500 mb-4 opacity-50" />
              <h2 className="text-xl font-black text-slate-800">Operational Management</h2>
              <p className="text-slate-500 mt-2 text-sm">Vendor records and detailed enterprise analytics module.</p>
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-black text-slate-800 mb-6">App Configuration</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Proprietor</p>
                  <p className="font-bold">Abu Saleh</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Contact</p>
                  <p className="font-bold">01766761877</p>
                </div>
              </div>
              <button 
                onClick={() => { if(confirm('Clear all business data?')) { localStorage.clear(); window.location.reload(); } }}
                className="px-6 py-2 bg-red-600 text-white text-xs font-bold rounded uppercase tracking-wider"
              >
                Reset System Data
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Disclaimer */}
      <footer className="mt-12 border-t border-slate-200 mb-8 pt-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-slate-600 leading-relaxed bg-white p-4 rounded-lg shadow-sm border border-slate-100 italic">
            <span className="text-red-600 font-black not-italic mr-1">বিশেষ দ্রষ্টব্য:</span>
             এখানে কোনো চিকন খড়ি নেওয়া হয় না। খড়ির সাইজ সর্বনিম্ন বের ৬" ইঞ্চি থেকে সর্বোচ্চ ৬৫ ইঞ্চি পর্যন্ত ও লম্বায় সর্বনিম্ন ৩০ ইঞ্চি থেকে ৬০ ইঞ্চি পর্যন্ত খড়ি নেওয়া হয়।
          </p>
        </div>
      </footer>
    </div>
  );
}

// --- Navigation ---

function NavButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-full px-6 text-[11px] font-black uppercase tracking-widest transition-all ${
        active 
          ? 'bg-black text-yellow-400' 
          : 'text-black hover:bg-yellow-500'
      }`}
    >
      {label}
    </button>
  );
}

// --- Home ---

function HomeSection({ stats, dateFilter, setDateFilter }: { 
  stats: any, 
  dateFilter: DateFilter, 
  setDateFilter: (f: DateFilter) => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Summary Dashboard</h2>
        <div className="flex bg-white p-1 rounded shadow-sm border border-slate-200">
          {(['today', 'yesterday', '7days', '1month'] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${
                dateFilter === f ? 'bg-yellow-400 text-black shadow-sm' : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              {f === 'today' ? 'Today' : f === 'yesterday' ? 'Yesterday' : f === '7days' ? '7 Days' : '1 Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CompactStatCard label="Total KG" value={stats.totalKg.toLocaleString()} unit="KG" bg="bg-white" />
        <CompactStatCard label="Total Mon" value={stats.totalMon.toFixed(2)} unit="MON" bg="bg-white" />
        <CompactStatCard label="Total Price" value={`৳${stats.totalPrice.toLocaleString()}`} unit="BDT" bg="bg-yellow-400" text="text-black" />
      </div>
    </div>
  );
}

function CompactStatCard({ label, value, unit, bg, text = 'text-slate-800' }: { label: string, value: string, unit: string, bg: string, text?: string }) {
  return (
    <div className={`${bg} p-6 rounded-xl shadow-sm border border-slate-200`}>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-black ${text}`}>{value}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase">{unit}</p>
      </div>
    </div>
  );
}

// --- Calculator ---

function CalculatorSection({ onSave }: { onSave: (calc: Calculation) => void }) {
  const [formData, setFormData] = useState({
    sellerName: '',
    totalKg: '',
    ratePerMon: '',
    monType: 40 as MonType
  });

  const calcResult = useMemo(() => {
    const kg = parseFloat(formData.totalKg) || 0;
    const rate = parseFloat(formData.ratePerMon) || 0;
    
    // Break down into Mon and remaining KG
    const monCount = Math.floor(kg / formData.monType);
    const extraKg = kg % formData.monType;
    
    // Total Mon (decimal) for price calculation
    const totalMonDecimal = kg / formData.monType;
    const price = totalMonDecimal * rate;
    
    return { monCount, extraKg, totalMonDecimal, price };
  }, [formData]);

  const handleCalculate = () => {
    if (!formData.sellerName || !formData.totalKg || !formData.ratePerMon) {
      alert('Error: Please provide Seller Name, KG, and Rate.');
      return;
    }

    onSave({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      sellerName: formData.sellerName,
      totalKg: parseFloat(formData.totalKg),
      ratePerMon: parseFloat(formData.ratePerMon),
      monType: formData.monType,
      totalMon: calcResult.totalMonDecimal,
      totalPrice: calcResult.price
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Firewood Calculator</h3>
        
        {/* Horizontal Input Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6">
          <div className="md:col-span-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Seller Name</label>
            <input 
              type="text" 
              placeholder="Enter name"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded text-sm font-bold focus:ring-2 focus:ring-yellow-400 outline-none"
              value={formData.sellerName}
              onChange={e => setFormData({ ...formData, sellerName: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Total Weight (KG)</label>
            <input 
              type="number" 
              placeholder="0"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded text-sm font-black focus:ring-2 focus:ring-yellow-400 outline-none"
              value={formData.totalKg}
              onChange={e => setFormData({ ...formData, totalKg: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Mon System</label>
            <div className="flex gap-1 h-[42px]">
              {[40, 41].map(type => (
                <button
                  key={type}
                  onClick={() => setFormData({ ...formData, monType: type as MonType })}
                  className={`flex-1 rounded text-[11px] font-black transition-all border-2 ${
                    formData.monType === type 
                      ? 'bg-green-600 text-white border-green-600 shadow-sm' 
                      : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {type} KG
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Rate / Mon</label>
            <input 
              type="number" 
              placeholder="0"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded text-sm font-black focus:ring-2 focus:ring-yellow-400 outline-none"
              value={formData.ratePerMon}
              onChange={e => setFormData({ ...formData, ratePerMon: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <button 
              onClick={handleCalculate}
              className="w-full h-[42px] bg-yellow-400 text-black font-black uppercase text-[10px] tracking-widest rounded shadow hover:bg-yellow-500 transition-all active:scale-95"
            >
              Calculate
            </button>
          </div>
        </div>

        {/* Display Conversion Breakdown */}
        {formData.totalKg && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-100 mb-6">
            <Scale size={14} />
            <p className="text-xs font-bold">
              Conversion result: <span className="font-black text-sm">{calcResult.monCount} Mon {calcResult.extraKg} KG</span>
            </p>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto">
        <CompactReceipt formData={formData} result={calcResult} />
      </div>
    </div>
  );
}

function CompactReceipt({ formData, result }: { formData: any, result: any }) {
  return (
    <div className="bg-white border-4 border-yellow-400 rounded-lg p-6 shadow-xl font-mono text-xs">
      <div className="text-center border-b-2 border-slate-100 pb-4 mb-4">
        <h4 className="text-lg font-black uppercase text-black">A. S Enterprise</h4>
        <p className="font-bold text-slate-500">Abu Saleh | 01766761877</p>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between">
          <span>Seller:</span>
          <span className="font-black">{formData.sellerName || '---'}</span>
        </div>
        <div className="flex justify-between">
          <span>Weight:</span>
          <span className="font-black">{formData.totalKg || '0'} KG</span>
        </div>
        <div className="flex justify-between">
          <span>System:</span>
          <span className="font-black">{formData.monType} KG/Mon</span>
        </div>
        <div className="flex justify-between py-2 border-y border-dashed border-slate-200 mt-2">
          <span className="font-bold">Total Result:</span>
          <span className="font-black text-base">{result.monCount} Mon {result.extraKg} KG</span>
        </div>
        <div className="flex justify-between">
          <span>Rate:</span>
          <span className="font-black">৳{formData.ratePerMon || '0'}</span>
        </div>
      </div>

      <div className="bg-black text-yellow-400 p-4 rounded text-center mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Total Payable</p>
        <p className="text-2xl font-black">৳{result.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-400 italic">
        Size Warnings Apply. Authorized Signature Required.
      </p>
    </div>
  );
}

// --- History ---

function HistorySection({ calculations, onDelete }: { calculations: Calculation[], onDelete: (id: string) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Calculation Logs</h3>
        <p className="text-[10px] font-bold text-slate-400 uppercase">{calculations.length} Records</p>
      </div>
      
      {calculations.length === 0 ? (
        <div className="p-12 text-center text-slate-300 font-bold uppercase text-[10px]">No entries found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Mass (KG)</th>
                <th className="px-4 py-3">Mon</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {calculations.map((calc) => (
                <tr key={calc.id} className="text-[11px] hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-400">{new Date(calc.timestamp).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-black">{calc.sellerName}</td>
                  <td className="px-4 py-3">{calc.totalKg}</td>
                  <td className="px-4 py-3 font-bold text-green-600">{calc.totalMon.toFixed(2)}</td>
                  <td className="px-4 py-3 font-black">৳{calc.totalPrice.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => onDelete(calc.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Note ---

function NoteSection({ notes, onAdd, onDelete }: { notes: Note[], onAdd: (n: Note) => void, onDelete: (id: string) => void }) {
  const [note, setNote] = useState({ title: '', content: '' });

  const handleAdd = () => {
    if (!note.title || !note.content) return;
    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      title: note.title,
      content: note.content
    });
    setNote({ title: '', content: '' });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xs font-black uppercase mb-4">Add Memo</h3>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Title"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none"
              value={note.title}
              onChange={e => setNote({ ...note, title: e.target.value })}
            />
            <textarea 
              placeholder="Note content..."
              rows={6}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium outline-none resize-none"
              value={note.content}
              onChange={e => setNote({ ...note, content: e.target.value })}
            />
            <button 
              onClick={handleAdd}
              disabled={!note.title || !note.content}
              className="w-full h-10 bg-yellow-400 text-black font-black uppercase text-[10px] rounded"
            >
              Save Note
            </button>
          </div>
        </div>
      </div>
      
      <div className="md:col-span-2 space-y-4">
        {notes.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-300 font-bold uppercase text-[10px]">Notebook Empty</div>
        ) : (
          notes.map(n => (
            <div key={n.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-black text-base">{n.title}</h4>
                <button onClick={() => onDelete(n.id)} className="text-slate-300 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-500 whitespace-pre-wrap">{n.content}</p>
              <p className="text-[9px] font-bold text-slate-300 uppercase mt-4">{new Date(n.timestamp).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
