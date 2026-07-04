import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart3, 
  Calculator as CalcIcon, 
  History as HistoryIcon, 
  FileText, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  UserCog, 
  Save, 
  Trash2, 
  Download, 
  Plus,
  Edit,
  Clock,
  User,
  Scale,
  Receipt as ReceiptIcon,
  Copy,
  Languages,
  UserCheck,
  Lock,
  Printer,
  FileSpreadsheet,
  Check,
  Building,
  Sun,
  Moon,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AssistantSection from './components/AssistantSection';

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
  challanNo: number;
  createdBy: string;
  deductedWeight?: number;
  deductionPercentage?: number;
  isMinusCalculated?: boolean;
  targetMonPrice?: number;
  getEntryNo?: number;
}

interface Note {
  id: string;
  timestamp: number;
  title: string;
  content: string;
}

type Tab = 'home' | 'calculator' | 'history' | 'note' | 'assistant' | 'settings';
type DateFilter = 'today' | 'yesterday' | '7days' | '1month';

interface ReceiptVisibility {
  sellerName: boolean;
  totalWeight: boolean;
  challanNo: boolean;
  monSystem: boolean;
  totalResult: boolean;
  rate: boolean;
  totalPayable: boolean;
  disclaimer: boolean;
  signatures: boolean;
}

// --- Bengali numeral and text utility ---
const toBengaliDigits = (num: number | string): string => {
  const englishToBengaliMap: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  };
  return num.toString().replace(/[0-9]/g, char => englishToBengaliMap[char] || char);
};

// --- Daily sequence (Get Entry) system with resetting ---
const recalculateDailySequences = (calcs: Calculation[]): Calculation[] => {
  const groups: { [dateStr: string]: Calculation[] } = {};
  
  const calcsWithDate = calcs.map(c => {
    const d = new Date(c.timestamp);
    const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return { ...c, dateStr };
  });

  calcsWithDate.forEach(c => {
    if (!groups[c.dateStr]) {
      groups[c.dateStr] = [];
    }
    groups[c.dateStr].push(c);
  });

  const updatedCalcsMap = new Map<string, number>();
  Object.keys(groups).forEach(dateStr => {
    const group = groups[dateStr];
    // Sort oldest first (chronological order)
    group.sort((a, b) => a.timestamp - b.timestamp);
    group.forEach((calc, index) => {
      updatedCalcsMap.set(calc.id, index + 1);
    });
  });

  return calcs.map(c => ({
    ...c,
    getEntryNo: updatedCalcsMap.get(c.id) || 1
  }));
};

const bidiNumberToWordBengali = (num: number): string => {
  const words = [
    'শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ',
    'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ'
  ];
  if (num >= 0 && num <= 20) {
    return words[num];
  }
  return num.toString();
};

const speakGetEntryBengali = (entryNo: number) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const entryWord = bidiNumberToWordBengali(entryNo);
    const text = `গেট এন্ট্রি ${entryWord} সেভ হয়েছে`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'bn-BD';
    utterance.rate = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const bnVoice = voices.find(v => v.lang.startsWith('bn'));
    if (bnVoice) {
      utterance.voice = bnVoice;
    }
    window.speechSynthesis.speak(utterance);
  }
};
const translations = {
  bn: {
    title: "এ. এস এন্টারপ্রাইজ",
    subtitle: "খড়ি সরবরাহকারী ও পাইকারি বিক্রেতা",
    proprietor: "প্রোপ্রাইটর: আবু সালেহ | মোবাইল: ০১৭৬৬৭৬১৮৭৭",
    home: "হোম",
    note: "নোট",
    history: "হিসাব খাতা",
    management: "ইউজার প্যানেল",
    calculator: "ক্যালকুলেটর",
    settings: "সেটিংস",
    summary: "হিসাবের সংক্ষিপ্ত সারসংক্ষেপ",
    totalKgLabel: "মোট পরিমাণ (কেজি)",
    totalMonLabel: "মোট রূপান্তরিত মন",
    totalPriceLabel: "সর্বমোট পরিশোধিত দাম",
    addNote: "নতুন মেমো নোট যুক্ত করুন",
    noNotes: "নোটবুক খালি",
    saveNote: "নোট সেভ করুন",
    saveSuccess: "সফলভাবে সেভ হয়েছে!",
    copyText: "Copy (কপি করুন)",
    saveImage: "Save Image (ছবি সেভ)",
    saveSoftware: "হিসাবটি সফটওয়্যারে সেভ করুন",
    duplicateWarning: "এগেইন সেইভ?",
    alertChallanMust: "চালান নং অবশ্যই ইনপুট দিতে হবে!",
    alertInputsMust: "দয়া করে বিক্রেতার নাম, ওজন (KG) এবং রেট পূরণ করুন!",
    alertChallanWrong: "চালান নম্বরটি ক্রমিক অনুসারী নয়! সম্ভাব্য সঠিক নম্বর: {suggested}। তবুও সেভ করতে চাইলে মিস্টেক টিক দিন।",
    notCalculated: "চালান হিসাব করতে প্রয়োজনীয় ইনপুট দিন",
    challanNum: "চালান নং",
    sellerName: "বিক্রেতার নাম",
    totalWeight: "মোট ওজন (কেজি)",
    monSystem: "মন সিস্টেম",
    ratePerMon: "নির্ধারিত দর",
    calculate: "হিসাব করুন",
    challanSuggested: "চালান নং মেলেনি! সঠিক ক্রম:",
    serialBypass: "সিরিয়াল মিস্টেক স্বীকার করে মেলান",
    conversionRes: "রূপান্তরিত হিসাব:",
    totalPayable: "সর্বমোট পরিশোধযোগ্য বিল",
    sizeWarning: "বিশেষ দ্রষ্টব্য: শিমুল, জিকা, আমরা, ডুমুর, শেওড়া, জিগনাই কম চলে এবং ১১০ টাকা রেট।",
    signatureAdmin: "হিসাব রক্ষক স্বাক্ষর",
    signatureProp: "প্রোপ্রাইটর স্বাক্ষর (আবু সালেহ)",
    excelExport: "এক্সেল শীট ডাউনলোড",
    pdfPrint: "রিপোর্ট প্রিন্ট ও পিডিএফ",
    calculatorSectionTitle: "খড়ির আধুনিক হিসাব ক্যালকুলেটর",
    calculationLogs: "হিসাবের খাতা রেকর্ডসমূহ",
    settingsTitle: "অ্যাপের সেটিংস ও প্রদর্শন অপশন",
    loginTitle: "অ্যাকাউন্ট লগইন / রেজিস্টার",
    loggedInAs: "সফল লগইন:",
    adminPanel: "এডমিন প্যানেল (সকল রেকর্ড)",
    duplicateToast: "একই নামের একই ওজনের হিসাব পূর্বেও তালিকায় সংরক্ষিত আছে। এগেইন সেইভ?",
    guestUser: "সাধারণ মেম্বার",
    loginText: "লগইন",
    registerText: "নতুন রেজিস্টার",
    usernameText: "ইউজারনেম দিন",
    passwordText: "পাসওয়ার্ড দিন",
    noLoginWarning: "অনুগ্রহ করে হিসাব সংরক্ষণের জন্য ইউজার প্যানেল থেকে নাম দিন!",
    allUsers: "সকল অপারেটর",
    recordCount: "টি রেকর্ড খুঁজে পাওয়া গেছে",
    filterByOperator: "অপারেটর অনুযায়ী ফিল্টার করুন",
    previewTitle: "বিল মেমোর প্রিভিউ মনিটর",
    searchPlaceholder: "বিক্রেতার নাম দিয়ে খুঁজুন...",
    searchLabel: "বিক্রেতার নাম ফিল্টার"
  },
  en: {
    title: "A.S Enterprise",
    subtitle: "Firewood Supplier & Wholesaler",
    proprietor: "Proprietor: Abu Saleh | Mobile: 01766761877",
    home: "Home",
    note: "Notebook",
    history: "Receipt Ledger",
    management: "User Console",
    calculator: "Calculator",
    settings: "Settings",
    summary: "Executive Summary",
    totalKgLabel: "Total Cargo Weight (KG)",
    totalMonLabel: "Total Computed Mon",
    totalPriceLabel: "Total Disbursed Balance",
    addNote: "Record Memorandum Note",
    noNotes: "Notebook empty",
    saveNote: "Save Note Record",
    saveSuccess: "Saved successfully!",
    copyText: "Copy Text Data",
    saveImage: "Download Receipt Image",
    saveSoftware: "Save to Software Database",
    duplicateWarning: "Duplicate entry detected. Save again?",
    alertChallanMust: "Challan number is required!",
    alertInputsMust: "Please provide Seller Name, Weight (KG) and Rate per Mon!",
    alertChallanWrong: "Challan number is not sequential! Expected: {suggested}. Tick the bypass option to save anyway.",
    notCalculated: "Provide input fields to view computed receipt preview",
    challanNum: "Challan No",
    sellerName: "Seller Name",
    totalWeight: "Cargo Total Weight (KG)",
    monSystem: "Mon System Selection",
    ratePerMon: "Rate per Mon (৳)",
    calculate: "Calculate Output",
    challanSuggested: "Challan sequence fault! Expected:",
    serialBypass: "Allow sequence variance & bypass error",
    conversionRes: "Calculated Breakdown:",
    totalPayable: "Total Payable Bill",
    sizeWarning: "WARNING: Thin firewood logs under 6\" circumference or length outside 30\"-60\" range are strictly rejected.",
    signatureAdmin: "Desk Assistant Signature",
    signatureProp: "Proprietor Signature (Abu Saleh)",
    excelExport: "Download Sheets (Excel CSV)",
    pdfPrint: "Print & Generate PDF Report",
    calculatorSectionTitle: "Smart Firewood Cargo Calculator",
    calculationLogs: "Persisted Ledger Entries",
    settingsTitle: "Configuration & Show/Hide Elements",
    loginTitle: "User Authentication & Database Registration",
    loggedInAs: "Connected Account:",
    adminPanel: "Enterprise Database (All Users)",
    duplicateToast: "An exact name and weight already exists! Save again?",
    guestUser: "Guest Operator",
    loginText: "Sign In",
    registerText: "Create Account",
    usernameText: "Enter Username",
    passwordText: "Enter Password",
    noLoginWarning: "Please enter your operator name in User Tab to save sessions!",
    allUsers: "All Operators",
    recordCount: "records indexed",
    filterByOperator: "Filter by User/Operator ID",
    previewTitle: "Receipt Preview Monitor",
    searchPlaceholder: "Search by seller name...",
    searchLabel: "Filter by Seller Name"
  }
};

// --- Main Application ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [defaultChallan, setDefaultChallan] = useState<number>(601);
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Multi User Authentication state
  const [currentUser, setCurrentUser] = useState<string>('Guest');
  const [authName, setAuthName] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [registeredUsers, setRegisteredUsers] = useState<Record<string, string>>({
    'admin': 'admin123'
  });

  // Receipt Content On/Off Settings from user specification
  const [receiptVisibility, setReceiptVisibility] = useState<ReceiptVisibility>({
    sellerName: true,
    totalWeight: true,
    challanNo: true,
    monSystem: true,
    totalResult: true,
    rate: true,
    totalPayable: true,
    disclaimer: true,
    signatures: true
  });

  // Load Persisted Data
  useEffect(() => {
    const savedCalcs = localStorage.getItem('as_enterprise_calcs');
    const savedNotes = localStorage.getItem('as_enterprise_notes');
    const savedChallan = localStorage.getItem('as_enterprise_default_challan');
    const savedLang = localStorage.getItem('as_enterprise_lang');
    const savedUser = localStorage.getItem('as_enterprise_current_user');
    const savedRegUsers = localStorage.getItem('as_enterprise_registered_users');
    const savedVisibility = localStorage.getItem('as_enterprise_receipt_visibility');
    const savedTheme = localStorage.getItem('as_enterprise_theme');

    if (savedCalcs) {
      const parsed = JSON.parse(savedCalcs);
      setCalculations(recalculateDailySequences(parsed));
    }
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedChallan) setDefaultChallan(parseInt(savedChallan) || 601);
    if (savedLang) setLanguage(savedLang as 'bn' | 'en');
    if (savedUser) setCurrentUser(savedUser);
    if (savedRegUsers) setRegisteredUsers(JSON.parse(savedRegUsers));
    if (savedVisibility) setReceiptVisibility(JSON.parse(savedVisibility));

    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const nextVal = !darkMode;
    setDarkMode(nextVal);
    if (nextVal) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('as_enterprise_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('as_enterprise_theme', 'light');
    }
  };

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('as_enterprise_calcs', JSON.stringify(calculations));
  }, [calculations]);

  useEffect(() => {
    localStorage.setItem('as_enterprise_notes', JSON.stringify(notes));
  }, [notes]);

  const expectedNextChallan = useMemo(() => {
    if (calculations.length === 0) {
      return defaultChallan;
    }
    // Latest calculation
    const latest = calculations[0];
    return (latest.challanNo !== undefined ? latest.challanNo : defaultChallan) + 1;
  }, [calculations, defaultChallan]);

  // --- Handlers ---

  const addCalculation = (calc: Omit<Calculation, 'createdBy'>) => {
    const newCalc: Calculation = {
      ...calc,
      createdBy: currentUser
    };
    const updated = recalculateDailySequences([newCalc, ...calculations]);
    setCalculations(updated);

    // Speak Bengali TTS for the new sequence Get Entry number
    const addedCalc = updated.find(c => c.id === newCalc.id);
    if (addedCalc && addedCalc.getEntryNo) {
      speakGetEntryBengali(addedCalc.getEntryNo);
    }
  };

  const deleteCalculation = (id: string) => {
    const confirmation = language === 'bn' ? 'আপনি কি এই রেকর্ডটি মুছে ফেলতে লজ্জিত?' : 'Are you sure you want to delete this record?';
    if (confirm(confirmation)) {
      const remaining = calculations.filter(c => c.id !== id);
      setCalculations(recalculateDailySequences(remaining));
    }
  };

  const editCalculation = (updated: Calculation) => {
    const nextList = calculations.map(c => c.id === updated.id ? updated : c);
    setCalculations(recalculateDailySequences(nextList));
  };

  const addNote = (note: Note) => {
    setNotes([note, ...notes]);
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authName || !authPassword) return;
    
    const lowerName = authName.trim().toLowerCase();
    
    // Auto registering if non-existing user as per spec ("কোন ভেরিফিকেশন থাকবে না")
    if (!registeredUsers[lowerName]) {
      const updated = { ...registeredUsers, [lowerName]: authPassword };
      setRegisteredUsers(updated);
      localStorage.setItem('as_enterprise_registered_users', JSON.stringify(updated));
    } else {
      // Check password
      if (registeredUsers[lowerName] !== authPassword) {
        alert(language === 'bn' ? 'ভুল পাসওয়ার্ড! দয়া করে সঠিক পাসওয়ার্ড দিন।' : 'Incorrect password for this existing operator ID.');
        return;
      }
    }

    setCurrentUser(authName.trim());
    localStorage.setItem('as_enterprise_current_user', authName.trim());
    setAuthName('');
    setAuthPassword('');
    alert(language === 'bn' ? `${authName} হিসেবে সফলভাবে লগইন সম্পন্ন হয়েছে!` : `Logged in as ${authName}!`);
  };

  const handleLogout = () => {
    setCurrentUser('Guest');
    localStorage.setItem('as_enterprise_current_user', 'Guest');
  };

  const toggleLanguage = () => {
    const nextLang = language === 'bn' ? 'en' : 'bn';
    setLanguage(nextLang);
    localStorage.setItem('as_enterprise_lang', nextLang);
  };

  // Visibility toggle handler
  const handleToggleVisibility = (key: keyof ReceiptVisibility) => {
    const updated = { ...receiptVisibility, [key]: !receiptVisibility[key] };
    setReceiptVisibility(updated);
    localStorage.setItem('as_enterprise_receipt_visibility', JSON.stringify(updated));
  };

  // --- Calculations Filter & Scope ---
  // If currentUser is "admin", we see all records. Otherwise we only see records created by logged-in user!
  const scopedCalculations = useMemo(() => {
    const isUserAdmin = currentUser.toLowerCase() === 'admin';
    if (isUserAdmin) {
      return calculations;
    }
    // standard user only sees their own calculations
    return calculations.filter(c => c.createdBy === currentUser || (!c.createdBy && currentUser === 'Guest'));
  }, [calculations, currentUser]);

  const filteredCalculations = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return scopedCalculations.filter(calc => {
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
  }, [scopedCalculations, dateFilter]);

  const searchedCalculations = useMemo(() => {
    if (!historySearchQuery.trim()) {
      return filteredCalculations;
    }
    const query = historySearchQuery.toLowerCase();
    return filteredCalculations.filter(calc => 
      calc.sellerName.toLowerCase().includes(query)
    );
  }, [filteredCalculations, historySearchQuery]);

  const stats = useMemo(() => {
    return filteredCalculations.reduce((acc, curr) => ({
      totalKg: acc.totalKg + curr.totalKg,
      totalMon: acc.totalMon + curr.totalMon,
      totalPrice: acc.totalPrice + curr.totalPrice
    }), { totalKg: 0, totalMon: 0, totalPrice: 0 });
  }, [filteredCalculations]);

  const todayCalculationsCount = useMemo(() => {
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    return calculations.filter(c => c.timestamp >= startOfDay).length;
  }, [calculations]);

  // Active translations
  const t = translations[language];

  // CSV Sheet Exporter (Excel support)
  const handleExportCSV = () => {
    if (searchedCalculations.length === 0) {
      alert(language === 'bn' ? 'কোনো হিসাবের রেকর্ড পাওয়া যায়নি রপ্তানি করতে!' : 'No records found to export!');
      return;
    }

    const headers = language === 'bn' 
      ? ['তারিখ', 'চালান নং', 'বিক্রেতা নাম', 'মোট ওজন (কেজি)', 'মন ধরণ', 'রূপান্তরিত ওজন', 'দর (টাকা)', 'সর্বমোট বিল (টাকা)', 'অপারেটর']
      : ['Date', 'Challan No', 'Seller Name', 'Total Weight (KG)', 'Mon Type', 'Converted Weight', 'Rate', 'Total Paid', 'Operator'];

    const rows = searchedCalculations.map(calc => {
      const monCount = Math.floor(calc.totalKg / calc.monType);
      const extraKg = calc.totalKg % calc.monType;
      const dateStr = new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US');
      const formattedConv = language === 'bn' 
        ? `${monCount} মন ${extraKg} কেজি` 
        : `${monCount} Mon ${extraKg} KG`;

      return [
        dateStr,
        `#${calc.challanNo}`,
        calc.sellerName,
        calc.totalKg,
        calc.monType,
        formattedConv,
        calc.ratePerMon,
        Math.round(calc.totalPrice),
        calc.createdBy || 'Guest'
      ];
    });

    const csvContent = [headers, ...rows]
      .map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AS_Enterprise_Report_${dateFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF / Direct Report Printing
  const handlePrintPDF = () => {
    if (searchedCalculations.length === 0) {
      alert(language === 'bn' ? 'প্রিন্ট করার জন্য কোনো হিসাবের রেকর্ড নেই!' : 'No records found to print!');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStrRange = language === 'bn'
      ? (dateFilter === 'today' ? 'আজকের' : dateFilter === 'yesterday' ? 'গতকালের' : dateFilter === '7days' ? 'গত ৭ দিনের' : 'গত ৩০ দিনের')
      : (dateFilter === 'today' ? 'Today\'s' : dateFilter === 'yesterday' ? 'Yesterday\'s' : dateFilter === '7days' ? 'Last 7 Days\'' : 'Last 30 Days\'');

    const tableRows = searchedCalculations.map(calc => {
      const monCount = Math.floor(calc.totalKg / calc.monType);
      const extraKg = calc.totalKg % calc.monType;
      return `
        <tr style="border-bottom: 1px solid #ddd; font-size: 11px;">
          <td style="padding: 8px;">${new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}</td>
          <td style="padding: 8px; font-weight: bold; color: #b91c1c;">#${calc.challanNo}</td>
          <td style="padding: 8px; font-weight: bold;">${calc.sellerName}</td>
          <td style="padding: 8px;">${calc.totalKg} KG</td>
          <td style="padding: 8px;">${calc.monType} KG</td>
          <td style="padding: 8px; font-weight: bold; color: #16a34a;">${monCount} মন ${extraKg} কেজি</td>
          <td style="padding: 8px;">৳${calc.ratePerMon}</td>
          <td style="padding: 8px; font-weight: bold;">৳${Math.round(calc.totalPrice).toLocaleString()}</td>
          <td style="padding: 8px; font-size: 10px; color: #555;">${calc.createdBy || 'Guest'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>A. S Enterprise Ledger Statement</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; text-align: left; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 12px; margin-bottom: 24px; }
            h1 { margin: 0; font-size: 24px; }
            h2 { margin: 5px 0 0 0; font-size: 14px; color: #555; }
            .summary-box { display: flex; justify-content: space-between; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #eee; }
            .summary-item { text-align: center; }
            .summary-item p { margin: 4px 0; font-size: 11px; text-transform: uppercase; color: #777; }
            .summary-item h3 { margin: 0; font-size: 18px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #ccc; }
            .footer-disclaimer { margin-top: 40px; font-size: 10px; font-style: italic; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${translations[language].title}</h1>
            <h2>${translations[language].subtitle}</h2>
            <p style="margin: 4px 0; font-size: 11px;">${translations[language].proprietor}</p>
            <h3 style="margin-top: 15px; font-size: 14px; text-decoration: underline; background: #fbfbf0; display: inline-block; padding: 3px 12px; border-radius: 4px;">
              ${dateStrRange} রিপোর্ট স্টেটমেন্ট (Statement)
            </h3>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <p>${translations[language].totalKgLabel}</p>
              <h3>${stats.totalKg.toLocaleString()} KG</h3>
            </div>
            <div class="summary-item">
              <p>${translations[language].totalMonLabel}</p>
              <h3>${stats.totalMon.toFixed(2)}</h3>
            </div>
            <div class="summary-item">
              <p>${translations[language].totalPriceLabel}</p>
              <h3 style="color: #b91c1c;">৳${Math.round(stats.totalPrice).toLocaleString()}</h3>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Challan No</th>
                <th>Seller Name</th>
                <th>Total Weight</th>
                <th>Mon System</th>
                <th>Converted Output</th>
                <th>Rate / Mon</th>
                <th>Net Payable</th>
                <th>Assigned User</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div style="margin-top: 80px; display: flex; justify-content: space-between;">
            <div style="text-align: center; width: 200px; border-top: 1.5px solid #000; padding-top: 5px; font-size: 11px;">
              ${translations[language].signatureAdmin}
            </div>
            <div style="text-align: center; width: 220px; border-top: 1.5px solid #000; padding-top: 5px; font-size: 11px;">
              ${translations[language].signatureProp}
            </div>
          </div>

          <p class="footer-disclaimer">
            ${translations[language].sizeWarning}
          </p>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-yellow-200 transition-colors duration-200">
      {/* Dynamic Header */}
      <header className="bg-yellow-400 dark:bg-slate-900 text-black dark:text-slate-100 dark:border-b dark:border-slate-800 shadow-md sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <Building className="w-6 h-6 text-slate-900 dark:text-yellow-400 animate-pulse" />
              <div>
                <h1 className="text-sm md:text-base font-black tracking-tight uppercase leading-none">{t.title}</h1>
                <p className="text-[9px] font-bold text-slate-800 dark:text-slate-400 tracking-wider uppercase hidden sm:block mt-0.5">{t.subtitle}</p>
              </div>
            </div>
            
            {/* Nav Links */}
            <nav className="hidden lg:flex items-center h-full">
              <NavButton label={t.home} active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavButton label={t.calculator} active={activeTab === 'calculator'} onClick={() => setActiveTab('calculator')} />
              <NavButton label={t.history} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
              <NavButton label={t.note} active={activeTab === 'note'} onClick={() => setActiveTab('note')} />
              <NavButton label={language === 'bn' ? 'এআই জিজ্ঞাসা' : 'AI Assistant'} active={activeTab === 'assistant'} onClick={() => setActiveTab('assistant')} />
              <NavButton label={t.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
            </nav>

            <div className="flex items-center gap-2">
              {/* Login Status badge */}
              <button 
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-1.5 px-3 py-1 bg-black text-white hover:bg-slate-800 text-[10px] font-black rounded shadow transition-all active:scale-95"
              >
                <UserCheck size={12} className="text-yellow-400" />
                <span className="max-w-[70px] truncate">{currentUser}</span>
              </button>

              {/* Theme Toggle */}
              <button
                id="theme-toggle"
                onClick={toggleDarkMode}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-extrabold text-slate-800 dark:text-slate-200 transition-all select-none active:scale-95"
                title={language === 'bn' ? 'থিম পরিবর্তন করুন' : 'Toggle Dark/Light Theme'}
              >
                {darkMode ? (
                  <>
                    <Sun size={12} className="text-amber-500" />
                    <span>{language === 'bn' ? 'লাইট' : 'Light'}</span>
                  </>
                ) : (
                  <>
                    <Moon size={12} className="text-indigo-600" />
                    <span>{language === 'bn' ? 'ডার্ক' : 'Dark'}</span>
                  </>
                )
                }
              </button>

              {/* Language Selector */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[10px] font-extrabold text-slate-800 dark:text-slate-200 transition-all select-none active:scale-95"
              >
                <Languages size={12} className="text-green-600" />
                <span>{language === 'bn' ? 'EN' : 'বাংলা'}</span>
              </button>

              {/* Mobile selector */}
              <div className="lg:hidden">
                <select 
                  value={activeTab} 
                  onChange={(e) => setActiveTab(e.target.value as Tab)}
                  className="bg-black text-white text-[10px] font-black border-none rounded px-2.5 py-1.5 outline-none cursor-pointer"
                >
                  <option value="home">{t.home}</option>
                  <option value="calculator">{t.calculator}</option>
                  <option value="history">{t.history}</option>
                  <option value="note">{t.note}</option>
                  <option value="assistant">{language === 'bn' ? 'এআই জিজ্ঞাসা' : 'AI Assistant'}</option>
                  <option value="settings">{t.settings}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HomeSection stats={stats} dateFilter={dateFilter} setDateFilter={setDateFilter} t={t} todayCount={todayCalculationsCount} language={language} />
            </motion.div>
          )}
          {activeTab === 'calculator' && (
            <motion.div key="calculator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CalculatorSection 
                onSave={addCalculation} 
                expectedNextChallan={expectedNextChallan} 
                language={language}
                t={t}
                calculations={calculations}
                receiptVisibility={receiptVisibility}
              />
            </motion.div>
          )}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div className="flex bg-white dark:bg-slate-900 p-1 rounded shadow-sm border border-slate-200 dark:border-slate-800">
                  {(['today', 'yesterday', '7days', '1month'] as DateFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setDateFilter(f)}
                      className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${
                        dateFilter === f ? 'bg-yellow-400 text-black shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {f === 'today' ? (language === 'bn' ? 'আজ' : 'Today') 
                       : f === 'yesterday' ? (language === 'bn' ? 'গতকাল' : 'Yesterday') 
                       : f === '7days' ? (language === 'bn' ? '৭ দিন' : '7 Days') 
                       : (language === 'bn' ? '১ মাস' : '1 Month')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-4 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] tracking-wide transition-all shadow-sm active:scale-95"
                  >
                    <FileSpreadsheet size={14} />
                    <span>{t.excelExport}</span>
                  </button>
                  <button
                    onClick={handlePrintPDF}
                    className="flex items-center gap-1.5 px-4 h-9 bg-slate-800 hover:bg-black text-white font-bold rounded text-[11px] tracking-wide transition-all shadow-sm active:scale-95"
                  >
                    <Printer size={14} />
                    <span>{t.pdfPrint}</span>
                  </button>
                </div>
              </div>

              {/* Calculations ledger */}
              <HistorySection 
                calculations={searchedCalculations} 
                onDelete={deleteCalculation} 
                onEdit={editCalculation}
                t={t}
                language={language}
                allCalculations={calculations} // to calculate list of users for filter
                currentUser={currentUser}
                searchQuery={historySearchQuery}
                setSearchQuery={setHistorySearchQuery}
              />
            </motion.div>
          )}
          {activeTab === 'note' && (
            <motion.div key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <NoteSection notes={notes} onAdd={addNote} onDelete={deleteNote} t={t} />
            </motion.div>
          )}
          {activeTab === 'assistant' && (
            <motion.div key="assistant" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AssistantSection 
                calculations={calculations}
                notes={notes}
                onAddCalculation={addCalculation}
                onDeleteCalculation={deleteCalculation}
                onEditCalculation={editCalculation}
                onAddNote={addNote}
                onDeleteNote={deleteNote}
                language={language}
                currentUser={currentUser}
              />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 font-sans transition-all">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Visual Visibility Setup Panel */}
                <div className="flex-1 space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{t.settingsTitle}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                      {language === 'bn' 
                        ? 'হিসাব মনিটর এবং মেমো ইমেজে (ডাউনলোডের সময়) কোন কোন উপাদানসমূহ দৃশ্যমান থাকবে তা এখান থেকে চালু বা বন্ধ করুন।' 
                        : 'Configure display items to show or hide in both real-time preview monitor monitor and generated PNG bills.'}
                    </p>
                  </div>

                  <div className="space-y-4 bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-850">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">
                      {language === 'bn' ? 'মেমো এবং ইমেজ কন্টেন্ট প্রদর্শন সেটিংস' : 'Memo & Image Visibility Controls'}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <VisibilityToggle 
                        label={language === 'bn' ? 'বিক্রেতার নাম (Seller)' : 'Seller Name'} 
                        value={receiptVisibility.sellerName} 
                        onChange={() => handleToggleVisibility('sellerName')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'চালান নম্বর (Challan No)' : 'Challan No'} 
                        value={receiptVisibility.challanNo} 
                        onChange={() => handleToggleVisibility('challanNo')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'মোট ওজন (Total Weight)' : 'Total Cargo Weight'} 
                        value={receiptVisibility.totalWeight} 
                        onChange={() => handleToggleVisibility('totalWeight')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'মন সিস্টেম ধরণ (Mon System)' : 'Mon Cargo System'} 
                        value={receiptVisibility.monSystem} 
                        onChange={() => handleToggleVisibility('monSystem')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'রূপান্তরিত ওজন (Total Result)' : 'Converted Output Yield'} 
                        value={receiptVisibility.totalResult} 
                        onChange={() => handleToggleVisibility('totalResult')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'নির্ধারিত দর (Rate / Mon)' : 'Rate / Mon'} 
                        value={receiptVisibility.rate} 
                        onChange={() => handleToggleVisibility('rate')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'সর্বমোট পরিশোধীয় মূল্য' : 'Total Payable Value'} 
                        value={receiptVisibility.totalPayable} 
                        onChange={() => handleToggleVisibility('totalPayable')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'বিশেষ দ্রষ্টব্য (Size Disclaimer)' : 'Warning Disclaimer'} 
                        value={receiptVisibility.disclaimer} 
                        onChange={() => handleToggleVisibility('disclaimer')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'নিচে সাক্ষরের স্থান (Signatures)' : 'Authorized Stamp/Signatures'} 
                        value={receiptVisibility.signatures} 
                        onChange={() => handleToggleVisibility('signatures')} 
                      />
                    </div>
                  </div>

                  {/* General settings default challan */}
                  <div className="p-6 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-100 dark:border-yellow-900/30 max-w-xl">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">
                       {language === 'bn' ? 'চালান নং ক্রমিক নির্ধারণ' : 'Challan Sequence Bootstrap'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                      {language === 'bn' 
                        ? 'ডিফল্ট চালানের নম্বরটি নির্ধারণ করুন। আপনার পূর্বের কোনো হিসাব না থাকলে অ্যাপ এখান থেকে আপনার সিরিয়াল গণনা শুরু করবে।' 
                        : 'Specify target startup serial. Automatic increment logic relies on this index if history is cleared.'}
                    </p>
                    <div className="max-w-xs">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 mb-1 block">
                        {language === 'bn' ? 'ডিফল্ট শুরু চালান নং' : 'Fallback Next Challan'}
                      </label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-sm font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
                        value={defaultChallan}
                        placeholder="e.g. 601"
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setDefaultChallan(val);
                          localStorage.setItem('as_enterprise_default_challan', val.toString());
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={() => { if(confirm('Clear all stored business calculations, credentials and logs?')) { localStorage.clear(); window.location.reload(); } }}
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded uppercase tracking-wider transition-all"
                    >
                      {language === 'bn' ? 'সমগ্র সফটওয়্যার রিসেট করুন' : 'Reset System Database'}
                    </button>
                  </div>
                </div>

                {/* Operator Login Panel */}
                <div className="w-full lg:w-96 bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-850">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="text-yellow-600 dark:text-yellow-500" size={20} />
                      <h3 className="text-md font-black text-slate-800 dark:text-slate-100">{t.loginTitle}</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {language === 'bn' 
                        ? 'কোনো কঠিন ভেরিফিকেশন বা সেশন ফি নেই। যেকোনো নাম দিয়ে সাথে সাথে অ্যাকাউন্ট খুলে প্রতিটি হিসাব সরাসরি আপনার নামে সেভ করতে পারেন।' 
                        : 'No heavy verification sequence. Simply logon as any username and calculations will be indexed under your identity.'}
                    </p>
                  </div>

                  {currentUser !== 'Guest' ? (
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider">{t.loggedInAs}</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-yellow-400 flex items-center justify-center text-white font-black text-base">
                          {currentUser.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-800 dark:text-slate-100">{currentUser}</p>
                          <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded border border-green-100 dark:border-green-900/30 inline-block mt-0.5">
                            {currentUser.toLowerCase() === 'admin' ? 'ADMIN / এডমিন' : 'ACTIVE SESSION'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                          {language === 'bn' ? 'সকল চালানের হিসাব সংরক্ষিত হচ্ছে' : 'Logs tracked under your name'}
                        </p>
                        <button 
                          onClick={handleLogout}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900 text-red-700 text-[10px] font-black uppercase rounded tracking-wider transition-all"
                        >
                          {language === 'bn' ? 'লগআউট' : 'Sign Out'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 block mb-1">{t.usernameText}</label>
                        <input 
                          type="text"
                          required
                          placeholder="e.g. Sales"
                          value={authName}
                          onChange={e => setAuthName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 block mb-1">{t.passwordText}</label>
                        <input 
                          type="password"
                          required
                          placeholder="••••••"
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                        />
                      </div>

                      <p className="text-[9px] leading-relaxed text-slate-400 dark:text-slate-500 italic">
                        * {language === 'bn' 
                          ? 'নতুন নাম দিলে স্বয়ংক্রিয়ভাবে একটি অ্যাকাউন্ট তৈরি হয়ে পরবর্তী কাজের জন্য পাসওয়ার্ড দিয়ে লক থাকবে।' 
                          : 'Entering a new username automatically registers you. Keep passwords remembered for return logins.'}
                      </p>

                      <button 
                        type="submit"
                        className="w-full py-2.5 bg-slate-900 hover:bg-black dark:bg-yellow-400 dark:hover:bg-yellow-500 dark:text-slate-950 text-yellow-400 font-extrabold uppercase text-[10px] tracking-widest rounded transition-all active:scale-95 shadow-sm"
                      >
                        {t.loginText} / {t.registerText}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Disclaimer */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 mb-8 pt-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 italic">
            <span className="text-red-600 font-black not-italic mr-1">বিশেষ দ্রষ্টব্য (AS Warning):</span>
             {t.sizeWarning}
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
          ? 'bg-black text-yellow-400 dark:bg-slate-800 dark:text-yellow-400' 
          : 'text-black hover:bg-yellow-500 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  );
}

// --- Dynamic Visibility Toggle ---

function VisibilityToggle({ label, value, onChange }: { label: string, value: boolean, onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center justify-between p-3 rounded-lg border text-xs font-bold transition-all select-none active:scale-98 ${
        value 
          ? 'bg-white dark:bg-slate-900 border-yellow-400 text-slate-800 dark:text-slate-100 shadow-sm' 
          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
      }`}
    >
      <span>{label}</span>
      <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
        value ? 'bg-yellow-400 text-black' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
      }`}>
        {value && <Check size={11} strokeWidth={3} />}
      </div>
    </button>
  );
}

// --- Home ---

function HomeSection({ stats, dateFilter, setDateFilter, t, todayCount, language }: { 
  stats: any, 
  dateFilter: DateFilter, 
  setDateFilter: (f: DateFilter) => void,
  t: any,
  todayCount: number,
  language: 'bn' | 'en'
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">{t.summary}</h2>
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded shadow-sm border border-slate-200 dark:border-slate-800">
          {(['today', 'yesterday', '7days', '1month'] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${
                dateFilter === f ? 'bg-yellow-400 text-black shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {f === 'today' ? (t.home === 'হোম' ? 'আজ' : 'Today') 
               : f === 'yesterday' ? (t.home === 'হোম' ? 'গতকাল' : 'Yesterday') 
               : f === '7days' ? (t.home === 'হোম' ? '৭ দিন' : '7 Days') 
               : (t.home === 'হোম' ? '১ মাস' : '1 Month')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CompactStatCard label={t.totalKgLabel} value={stats.totalKg.toLocaleString()} unit="KG" bg="bg-white" />
        <CompactStatCard label={t.totalMonLabel} value={stats.totalMon.toFixed(2)} unit="MON" bg="bg-white" />
        <CompactStatCard label={t.totalPriceLabel} value={`৳${Math.round(stats.totalPrice).toLocaleString()}`} unit="BDT" bg="bg-yellow-400" text="text-black" />
        <CompactStatCard 
          label={language === 'bn' ? "আজকের মোট গেট এন্ট্রি" : "Today's Get Entries"} 
          value={language === 'bn' ? toBengaliDigits(todayCount) : todayCount.toString()} 
          unit={language === 'bn' ? "টি" : "ENTRIES"} 
          bg="bg-indigo-600 dark:bg-indigo-950/40" 
          text="text-white" 
        />
      </div>
    </div>
  );
}

function CompactStatCard({ label, value, unit, bg, text = 'text-slate-800 dark:text-slate-100' }: { label: string, value: string, unit: string, bg: string, text?: string }) {
  const isDarkBg = bg.includes('bg-indigo') || bg.includes('bg-slate-900') || bg.includes('bg-black');
  const finalBg = bg === 'bg-white' ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : bg;
  const labelColor = isDarkBg ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500';
  const unitColor = isDarkBg ? 'text-indigo-200 font-bold' : 'text-slate-400 font-bold';

  return (
    <div className={`${finalBg} p-6 rounded-xl shadow-sm border`}>
      <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${labelColor}`}>{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-black ${text}`}>{value}</p>
        <p className={`text-[10px] uppercase ${unitColor}`}>{unit}</p>
      </div>
    </div>
  );
}

// --- Calculator ---

interface CalculatorProps {
  onSave: (calc: Omit<Calculation, 'createdBy'>) => void;
  expectedNextChallan: number;
  language: 'bn' | 'en';
  t: any;
  calculations: Calculation[];
  receiptVisibility: ReceiptVisibility;
}

function CalculatorSection({ onSave, expectedNextChallan, language, t, calculations, receiptVisibility }: CalculatorProps) {
  const [formData, setFormData] = useState({
    sellerName: '',
    totalKg: '',
    ratePerMon: '',
    monType: 41 as MonType,
    challanNo: expectedNextChallan.toString()
  });

  const [allowSerialBypass, setAllowSerialBypass] = useState(false);

  // Preview result is only filled out upon clicking "Calculate"
  const [previewResult, setPreviewResult] = useState<any | null>(null);

  // Minus Calculate states
  const [isMinusMode, setIsMinusMode] = useState(false);
  const [minusFormData, setMinusFormData] = useState({
    sellerName: '',
    totalKg: '',
    minusWeight: '',
    targetMonPrice: '',
    monType: 41 as MonType,
    ratePerMon: '',
    challanNo: expectedNextChallan.toString(),
    activeInput: 'weight' as 'weight' | 'targetPrice'
  });

  // Sync expected Challan number if input is currently empty
  useEffect(() => {
    setFormData(prev => {
      if (!prev.challanNo || prev.challanNo === '') {
        return { ...prev, challanNo: expectedNextChallan.toString() };
      }
      return prev;
    });
  }, [expectedNextChallan]);

  // Sync expected Challan number for minus calculate if input is currently empty
  useEffect(() => {
    setMinusFormData(prev => {
      if (!prev.challanNo || prev.challanNo === '') {
        return { ...prev, challanNo: expectedNextChallan.toString() };
      }
      return prev;
    });
  }, [expectedNextChallan]);

  // Real-time calculation logic for minus calculation
  const minusCalcResult = useMemo(() => {
    const totalKg = parseFloat(minusFormData.totalKg) || 0;
    const ratePerMon = parseFloat(minusFormData.ratePerMon) || 0;
    const monType = minusFormData.monType;
    
    let minusWeight = 0;
    let targetMonPrice = 0;
    let deductionPercentage = 0;
    let netWeight = totalKg;
    let netMon = 0;
    let effectivePrice = ratePerMon;
    let totalPrice = 0;

    if (minusFormData.activeInput === 'weight') {
      minusWeight = parseFloat(minusFormData.minusWeight) || 0;
      netWeight = Math.max(0, totalKg - minusWeight);
      if (totalKg > 0) {
        deductionPercentage = (minusWeight / totalKg) * 100;
      }
      netMon = netWeight / monType;
      totalPrice = netMon * ratePerMon;
      if (totalKg > 0) {
        effectivePrice = ratePerMon * (netWeight / totalKg);
      }
    } else {
      targetMonPrice = parseFloat(minusFormData.targetMonPrice) || 0;
      if (ratePerMon > 0) {
        const ratio = targetMonPrice / ratePerMon;
        netWeight = totalKg * ratio;
        minusWeight = Math.max(0, totalKg - netWeight);
        if (totalKg > 0) {
          deductionPercentage = (minusWeight / totalKg) * 100;
        }
        netMon = netWeight / monType;
        totalPrice = netMon * ratePerMon;
        effectivePrice = targetMonPrice;
      }
    }

    const monCount = Math.floor(netMon);
    const extraKg = parseFloat((netWeight % monType).toFixed(2));

    return {
      minusWeight,
      targetMonPrice,
      deductionPercentage,
      netWeight,
      netMon,
      effectivePrice,
      totalPrice,
      monCount,
      extraKg
    };
  }, [minusFormData]);

  // Live calculation based on raw inputs, used immediately on preview
  const currentCalcResult = useMemo(() => {
    const kg = parseFloat(formData.totalKg) || 0;
    const rate = parseFloat(formData.ratePerMon) || 0;
    
    const monCount = Math.floor(kg / formData.monType);
    const extraKg = kg % formData.monType;
    const totalMonDecimal = kg / formData.monType;
    const price = totalMonDecimal * rate;
    
    return { monCount, extraKg, totalMonDecimal, price };
  }, [formData]);

  const enteredChallanNum = parseInt(formData.challanNo) || 0;
  const showChallanWarning = formData.challanNo !== '' && enteredChallanNum !== expectedNextChallan;

  // On Calculate (হিসাব করুন): Calculate AND auto-save calculation immediately to the ledger!
  const handleCalculate = () => {
    if (!formData.challanNo) {
      alert(t.alertChallanMust);
      return;
    }

    if (!formData.sellerName || !formData.totalKg || !formData.ratePerMon) {
      alert(t.alertInputsMust);
      return;
    }

    if (showChallanWarning && !allowSerialBypass) {
      const errText = language === 'bn' 
        ? `Error (চালান ভুল): চালান নম্বরটি ক্রমিক অনুসারী নয়। সম্ভাব্য নম্বর: ${expectedNextChallan}। আপনি যদি এই নম্বরেই সাবমিট করতে চান তবে বিশেষ চেক-বক্সটি টিক করুন।`
        : `Challan Warning: The entered number is out-of-sequence. Correct sequential suggestion: ${expectedNextChallan}. If you intentionally want to bypass, tick the check-box to calculate.`;
      alert(errText);
      return;
    }

    const calculated = {
      sellerName: formData.sellerName,
      totalKg: parseFloat(formData.totalKg),
      challanNo: enteredChallanNum,
      monType: formData.monType,
      monCount: currentCalcResult.monCount,
      extraKg: currentCalcResult.extraKg,
      totalMonDecimal: currentCalcResult.totalMonDecimal,
      price: currentCalcResult.price,
      ratePerMon: parseFloat(formData.ratePerMon)
    };

    // Check duplicate saved today
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const isDuplicate = calculations.some(c => 
      c.timestamp >= startOfDay &&
      c.sellerName.trim().toLowerCase() === calculated.sellerName.trim().toLowerCase() && 
      c.totalKg === calculated.totalKg
    );

    if (isDuplicate) {
      const promptText = language === 'bn' 
        ? `একই নাম এবং ওজনের একটি হিসাব আজ ইতিমধ্যে সেভ করা হয়েছে। আপনি কি নিশ্চিত?` 
        : `An entry with the same name and weight has already been saved today. Are you sure?`;
      
      if (!confirm(promptText)) {
        return;
      }
    }

    // Auto-save to DB!
    onSave({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      sellerName: calculated.sellerName,
      totalKg: calculated.totalKg,
      ratePerMon: calculated.ratePerMon,
      monType: calculated.monType,
      totalMon: calculated.totalMonDecimal,
      totalPrice: calculated.price,
      challanNo: calculated.challanNo
    });

    setPreviewResult(calculated);

    const successMsg = language === 'bn' 
      ? 'হিসাবটি সফলভাবে সফটওয়্যারে সেভ হয়ে খাতা লিস্টে যোগ হয়েছে!' 
      : 'Calculation finalized and automatically saved to database!';
    alert(successMsg);

    // Increment challan for next row & reset form
    setFormData({
      sellerName: '',
      totalKg: '',
      ratePerMon: '',
      monType: formData.monType,
      challanNo: (calculated.challanNo + 1).toString()
    });
    setAllowSerialBypass(false);
  };

  const handleSaveMinusCalculation = () => {
    if (!minusFormData.challanNo) {
      alert(t.alertChallanMust);
      return;
    }

    if (!minusFormData.sellerName || !minusFormData.totalKg || !minusFormData.ratePerMon) {
      alert(t.alertInputsMust);
      return;
    }

    const enteredChallanNum = parseInt(minusFormData.challanNo) || 0;
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const isDuplicate = calculations.some(c => 
      c.timestamp >= startOfDay &&
      c.sellerName.trim().toLowerCase() === minusFormData.sellerName.trim().toLowerCase() && 
      c.totalKg === parseFloat(minusFormData.totalKg)
    );

    if (isDuplicate) {
      const promptText = language === 'bn' 
        ? `একই নাম এবং ওজনের একটি হিসাব আজ ইতিমধ্যে সেভ করা হয়েছে। আপনি কি নিশ্চিত?` 
        : `An entry with the same name and weight has already been saved today. Are you sure?`;
      
      if (!confirm(promptText)) {
        return;
      }
    }

    const calculated = {
      sellerName: minusFormData.sellerName,
      totalKg: parseFloat(minusFormData.totalKg),
      challanNo: enteredChallanNum,
      monType: minusFormData.monType,
      monCount: minusCalcResult.monCount,
      extraKg: minusCalcResult.extraKg,
      totalMonDecimal: minusCalcResult.netMon,
      price: minusCalcResult.totalPrice,
      ratePerMon: parseFloat(minusFormData.ratePerMon),
      deductedWeight: minusCalcResult.minusWeight,
      deductionPercentage: minusCalcResult.deductionPercentage,
      isMinusCalculated: true,
      targetMonPrice: minusFormData.activeInput === 'targetPrice' ? parseFloat(minusFormData.targetMonPrice) : undefined
    };

    // Auto-save to DB!
    onSave({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      sellerName: calculated.sellerName,
      totalKg: calculated.totalKg,
      ratePerMon: calculated.ratePerMon,
      monType: calculated.monType,
      totalMon: calculated.totalMonDecimal,
      totalPrice: calculated.price,
      challanNo: calculated.challanNo,
      deductedWeight: calculated.deductedWeight,
      deductionPercentage: calculated.deductionPercentage,
      isMinusCalculated: true,
      targetMonPrice: calculated.targetMonPrice
    });

    setPreviewResult(calculated);

    const successMsg = language === 'bn' 
      ? 'মাইনাস হিসাবটি সফলভাবে সফটওয়্যারে সেভ হয়ে খাতা লিস্টে যোগ হয়েছে!' 
      : 'Minus calculation finalized and automatically saved to database!';
    alert(successMsg);

    // Increment challan for next row & reset form
    setMinusFormData({
      sellerName: '',
      totalKg: '',
      minusWeight: '',
      targetMonPrice: '',
      monType: minusFormData.monType,
      ratePerMon: '',
      challanNo: (calculated.challanNo + 1).toString(),
      activeInput: 'weight'
    });
  };

  const handleCopy = () => {
    if (!previewResult) {
      alert(language === 'bn' ? 'কপি করার জন্য প্রথমে হিসাব সম্পন্ন করুন!' : 'Perform calculation first to copy text!');
      return;
    }

    const formattedPrice = Math.round(previewResult.price);
    let textToCopy = '';

    if (previewResult.isMinusCalculated) {
      textToCopy = `
বিক্রেতার নাম:  ${previewResult.sellerName}

মোট ওজন:  ${toBengaliDigits(previewResult.totalKg)} কেজী

ওজন কর্তন: -${toBengaliDigits(previewResult.deductedWeight.toFixed(1))} কেজী (${toBengaliDigits(previewResult.deductionPercentage.toFixed(1))}%)

নিট ওজন :  ${toBengaliDigits(previewResult.monCount)} মোন ${toBengaliDigits(previewResult.extraKg)} কেজী

রেট : ${toBengaliDigits(previewResult.ratePerMon)} টাকা

মোট মূল্য: ${toBengaliDigits(formattedPrice)} টাকা
`.trim();
    } else {
      textToCopy = `
বিক্রেতার নাম:  ${previewResult.sellerName}

ওজন :  ${toBengaliDigits(previewResult.monCount)} মোন ${toBengaliDigits(previewResult.extraKg)} কেজী

রেট : ${toBengaliDigits(previewResult.ratePerMon)} টাকা

মোট মূল্য: ${toBengaliDigits(formattedPrice)} টাকা
`.trim();
    }

    navigator.clipboard.writeText(textToCopy);
    alert(language === 'bn' ? 'হিসাবটি সফলভাবে বাংলায় কপি করা হয়েছে!' : 'The calculated elements have been copied successfully!');
  };

  const handleSaveImage = () => {
    if (!previewResult) return;

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isBn = language === 'bn';

    // Background color
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Yellow border
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, canvas.width, 22);

    ctx.lineWidth = 10;
    ctx.strokeStyle = '#facc15';
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // Thick black inner line
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    const fontStr = (size: number, weight: string = 'normal') => `${weight} ${size}px 'Courier New', 'Courier', Arial, sans-serif`;

    // Headers
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = fontStr(28, 'bold');
    ctx.fillText(isBn ? 'এ. এস এন্টারপ্রাইজ' : 'A. S Enterprise', canvas.width / 2, 65);

    ctx.font = fontStr(15, 'bold');
    ctx.fillStyle = '#4b5563';
    ctx.fillText(isBn ? 'খড়ি সরবরাহকারী ও পাইকারি বিক্রেতা' : 'Firewood Supplier & Wholesaler', canvas.width / 2, 90);

    ctx.fillStyle = '#0f172a';
    ctx.font = fontStr(15, 'bold');
    const mobileNumFormatted = isBn ? toBengaliDigits('01766761877') : '01766761877';
    ctx.fillText(isBn ? `প্রোপ্রাইটর: আবু সালেহ | মোবাইল: ${mobileNumFormatted}` : `Proprietor: Abu Saleh | Mobile: ${mobileNumFormatted}`, canvas.width / 2, 115);

    // Dividers
    ctx.beginPath();
    ctx.moveTo(30, 135);
    ctx.lineTo(canvas.width - 30, 135);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Memo serial detail row
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = fontStr(16, 'bold');
    if (receiptVisibility.challanNo) {
      const challanNoToShow = isBn ? toBengaliDigits(previewResult.challanNo) : previewResult.challanNo;
      ctx.fillText(isBn ? `চালান নং: ${challanNoToShow}` : `Challan No: ${challanNoToShow}`, 40, 175);
    }

    ctx.textAlign = 'right';
    const dateBD = new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
    const dateFormatted = isBn ? toBengaliDigits(dateBD) : new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.fillText(isBn ? `তারিখ: ${dateFormatted}` : `Date: ${dateFormatted}`, canvas.width - 40, 175);

    // Structured panel background
    ctx.fillStyle = '#fbfbfd';
    ctx.fillRect(40, 205, canvas.width - 80, 255);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 205, canvas.width - 80, 255);

    // Data rows according to visibility settings configured in App Settings
    const displayList = [];
    if (receiptVisibility.sellerName) {
      displayList.push({ 
        label: isBn ? 'বিক্রেতার নাম:' : 'Seller Name:', 
        value: previewResult.sellerName 
      });
    }
    if (receiptVisibility.totalWeight) {
      displayList.push({ 
        label: isBn ? 'মোট ওজন:' : 'Total Weight:', 
        value: isBn ? `${toBengaliDigits(previewResult.totalKg)} কেজি` : `${previewResult.totalKg} KG` 
      });
    }
    if (previewResult.isMinusCalculated && previewResult.deductedWeight !== undefined) {
      displayList.push({
        label: isBn ? 'ওজন কর্তন:' : 'Deducted Weight:',
        value: isBn 
          ? `-${toBengaliDigits(previewResult.deductedWeight.toFixed(1))} কেজি` 
          : `-${previewResult.deductedWeight.toFixed(1)} KG`,
        color: '#dc2626'
      });
    }
    if (receiptVisibility.monSystem) {
      displayList.push({ 
        label: isBn ? 'মন সিস্টেম:' : 'Mon System:', 
        value: isBn ? `${toBengaliDigits(previewResult.monType)} কেজি/মন` : `${previewResult.monType} KG/Mon` 
      });
    }
    if (receiptVisibility.totalResult) {
      displayList.push({ 
        label: isBn ? (previewResult.isMinusCalculated ? 'নিট রূপান্তরিত:' : 'রূপান্তরিত হিসাব:') : 'Converted Weight:', 
        value: isBn 
          ? `${toBengaliDigits(previewResult.monCount)} মন ${toBengaliDigits(previewResult.extraKg)} কেজি` 
          : `${previewResult.monCount} Mon ${previewResult.extraKg} KG`, 
        color: '#16a34a' 
      });
    }
    if (receiptVisibility.rate) {
      displayList.push({ 
        label: isBn ? 'নির্ধারিত দর:' : 'Rate per Mon:', 
        value: isBn ? `${toBengaliDigits(previewResult.ratePerMon)} টাকা` : `৳${previewResult.ratePerMon}` 
      });
    }

    let itemY = 250;
    displayList.forEach((r, index) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e293b';
      ctx.font = fontStr(17, 'bold');
      ctx.fillText(r.label, 55, itemY + index * 45);

      ctx.textAlign = 'right';
      ctx.fillStyle = r.color || '#000000';
      ctx.font = fontStr(18, 'bold');
      ctx.fillText(r.value, canvas.width - 55, itemY + index * 45);

      // Separator lines
      if (index < displayList.length - 1) {
        ctx.beginPath();
        ctx.moveTo(50, itemY + index * 45 + 18);
        ctx.lineTo(canvas.width - 50, itemY + index * 45 + 18);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // Net Payable Box Container
    if (receiptVisibility.totalPayable) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(40, 480, canvas.width - 80, 85);

      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'left';
      ctx.font = fontStr(18, 'bold');
      ctx.fillText(isBn ? 'সর্বমোট পরিশোধিত দাম:' : 'Total Payable Bill:', 60, 532);

      ctx.textAlign = 'right';
      ctx.font = fontStr(30, 'bold');
      const formattedPrice = Math.round(previewResult.price);
      const priceToShow = isBn ? `${toBengaliDigits(formattedPrice.toLocaleString())} টাকা` : `৳${formattedPrice.toLocaleString()}`;
      ctx.fillText(priceToShow, canvas.width - 60, 534);
    }

    // Footnote Warning
    if (receiptVisibility.disclaimer) {
      ctx.textAlign = 'center';
      ctx.font = fontStr(13, 'bold');
      ctx.fillStyle = '#dc2626';
      ctx.fillText(isBn ? 'विशेष দ্রষ্টব্য (Warning Disclaimer):' : 'Warning Disclaimer:', canvas.width / 2, 590);

      ctx.fillStyle = '#1e293b';
      ctx.font = fontStr(12, 'bold');
      if (isBn) {
        ctx.fillText('এখানে কোনো চিকন খড়ি নেওয়া হয় না। খড়ির সাইজ সর্বনিম্ন বের ৬" ইঞ্চি', canvas.width / 2, 615);
        ctx.fillText('থেকে সর্বোচ্চ ৬৫ ইঞ্চি পর্যন্ত ও লম্বায় সর্বনিম্ন ৩০ ইঞ্চি থেকে ৬০ ইঞ্চি পর্যন্ত খড়ি নেওয়া হয়।', canvas.width / 2, 635);
        ctx.fillText('শিমুল, জিকা, আমরা, ডুমুর, শেওড়া, জিগনাই কম চলে এবং ১১০ টাকা রেট।', canvas.width / 2, 655);
      } else {
        ctx.fillText('Thin firewood is strictly rejected. Circumference must be min 6" to max 65"', canvas.width / 2, 615);
        ctx.fillText('and length must be min 30" to max 60".', canvas.width / 2, 635);
        ctx.fillText('Shimul, Zika, Amra, Dumur, Sheora, Jignai are less in demand and rate is 110 TK.', canvas.width / 2, 655);
      }
    }

    // Signatures row
    if (receiptVisibility.signatures) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#000000';
      ctx.font = fontStr(14, 'bold');
      ctx.fillText('-------------------------', canvas.width - 45, 725);
      ctx.fillText(isBn ? 'প্রোপ্রাইটর স্বাক্ষর (আবু সালেহ)' : 'Proprietor Signature (Abu Saleh)', canvas.width - 45, 745);
    }

    const dataURI = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Challan_No_${previewResult.challanNo}.png`;
    link.href = dataURI;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CalcIcon className="text-yellow-500 w-5 h-5 animate-bounce" />
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">{t.calculatorSectionTitle}</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsMinusMode(!isMinusMode);
              setPreviewResult(null); // Clear preview when changing modes
            }}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 flex items-center gap-1.5 ${
              isMinusMode 
                ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-900/40' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span>{isMinusMode ? "✕ [সাধারণ হিসাব]" : "⚖ [মাইনস ক্যালকুলেট]"}</span>
          </button>
        </div>
        
        {!isMinusMode ? (
          <>
            {/* Horizontal Input Row aligned equally */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6">
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">{t.sellerName}</label>
                <input 
                  type="text" 
                  placeholder={language === 'bn' ? "বিক্রেতার নাম লিখুন" : "e.g. Monnaf"}
                  className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                  value={formData.sellerName}
                  onChange={e => setFormData({ ...formData, sellerName: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">{t.totalWeight}</label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                  value={formData.totalKg}
                  onChange={e => setFormData({ ...formData, totalKg: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">{t.challanNum}</label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-yellow-400 outline-none"
                  value={formData.challanNo}
                  onChange={e => setFormData({ ...formData, challanNo: e.target.value })}
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">{t.monSystem}</label>
                <div className="flex gap-1 h-11">
                  {[40, 41, 42, 43].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, monType: type as MonType })}
                      className={`flex-1 rounded text-[10px] font-black transition-all border-2 ${
                        formData.monType === type 
                          ? 'bg-green-600 text-white border-green-600 shadow-sm' 
                          : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                      }`}
                    >
                      {type} KG
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">{t.ratePerMon}</label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                  value={formData.ratePerMon}
                  onChange={e => setFormData({ ...formData, ratePerMon: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-1">
              {/* Allow manual custom sequential check or bypass */}
              <div className="flex items-center">
                {showChallanWarning ? (
                  <label className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 text-red-950 dark:text-red-400 px-3 py-1.5 rounded border border-red-200 dark:border-red-900/30 text-[10px] font-bold cursor-pointer select-none active:scale-95 shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={allowSerialBypass}
                      onChange={e => setAllowSerialBypass(e.target.checked)}
                      className="rounded border-red-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
                    />
                    <span className="leading-none text-red-700 dark:text-red-400 font-extrabold">{t.serialBypass}</span>
                  </label>
                ) : (
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    ✔ {language === 'bn' ? `পরবর্তী প্রত্যাশিত ওয়ান-ক্লিক চালান নম্বর হলো #${expectedNextChallan}` : `Correct sequence predicts Challan #${expectedNextChallan}`}
                  </p>
                )}
              </div>

              <div className="w-full sm:w-64">
                <button 
                  onClick={handleCalculate}
                  className="w-full h-11 bg-yellow-400 text-black font-black uppercase text-[11px] tracking-wider rounded shadow hover:bg-yellow-500 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>{t.calculate}</span>
                </button>
              </div>
            </div>

            {/* Live error/suggestion notification row */}
            {showChallanWarning && (
              <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-800 dark:text-rose-400 rounded-lg text-xs font-bold flex items-center gap-2 animate-pulse">
                <span>⚠️</span>
                <p>
                  {t.challanSuggested} <span className="font-extrabold text-rose-700 bg-white dark:bg-slate-900 px-2 py-0.5 rounded shadow-sm">#{expectedNextChallan}</span>
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            {/* Toggle bar inside for inputs of minus calculate */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-150 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">
                    {language === 'bn' ? "বিক্রেতার নাম" : "Seller Name"}
                  </label>
                  <input 
                    type="text" 
                    placeholder={language === 'bn' ? "বিক্রেতার নাম লিখুন" : "e.g. Monnaf"}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                    value={minusFormData.sellerName}
                    onChange={e => setMinusFormData({ ...minusFormData, sellerName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">
                    {language === 'bn' ? "মোট ওজন (কেজি)" : "Total Weight (KG)"}
                  </label>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                    value={minusFormData.totalKg}
                    onChange={e => setMinusFormData({ ...minusFormData, totalKg: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">
                    {language === 'bn' ? "চালান নং" : "Challan No"}
                  </label>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-yellow-400 outline-none"
                    value={minusFormData.challanNo}
                    onChange={e => setMinusFormData({ ...minusFormData, challanNo: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                {/* Switch between weight deduction and target price */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-2 block">
                    {language === 'bn' ? "কর্তন পদ্ধতি নির্বাচন করুন" : "Select Deduction Input Mode"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMinusFormData({ ...minusFormData, activeInput: 'weight' })}
                      className={`h-10 rounded text-xs font-bold transition-all border ${
                        minusFormData.activeInput === 'weight'
                          ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-750 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {language === 'bn' ? "কর্তন কেজি সরাসরি" : "Minus Weight (KG)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMinusFormData({ ...minusFormData, activeInput: 'targetPrice' })}
                      className={`h-10 rounded text-xs font-bold transition-all border ${
                        minusFormData.activeInput === 'targetPrice'
                          ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-750 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {language === 'bn' ? "কাঙ্ক্ষিত মনের দাম" : "Target Mon Price"}
                    </button>
                  </div>
                </div>

                <div>
                  {minusFormData.activeInput === 'weight' ? (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-2 block">
                        {language === 'bn' ? "কর্তন কেজি" : "Minus Weight (KG)"}
                      </label>
                      <input
                        type="number"
                        placeholder={language === 'bn' ? "কর্তনযোগ্য ওজন লিখুন" : "e.g. 20"}
                        className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900 dark:text-white"
                        value={minusFormData.minusWeight}
                        onChange={e => setMinusFormData({ ...minusFormData, minusWeight: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-2 block">
                        {language === 'bn' ? "কাঙ্ক্ষিত মনের দাম" : "Target Mon Price (৳)"}
                      </label>
                      <input
                        type="number"
                        placeholder={language === 'bn' ? "কাঙ্ক্ষিত মনের দাম লিখুন" : "e.g. 140"}
                        className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900 dark:text-white"
                        value={minusFormData.targetMonPrice}
                        onChange={e => setMinusFormData({ ...minusFormData, targetMonPrice: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">
                    {language === 'bn' ? "মন সিস্টেম নির্বাচন" : "Mon System Selection"}
                  </label>
                  <div className="flex gap-1 h-10">
                    {[40, 41, 42, 43].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setMinusFormData({ ...minusFormData, monType: type as MonType })}
                        className={`flex-1 rounded text-[10px] font-black transition-all border ${
                          minusFormData.monType === type 
                            ? 'bg-green-600 text-white border-green-600 shadow-sm' 
                            : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {type} KG
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">
                    {language === 'bn' ? "নির্ধারিত দর (প্রতি মণ)" : "Regular Price per Mon (৳)"}
                  </label>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-black focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900 dark:text-white"
                    value={minusFormData.ratePerMon}
                    onChange={e => setMinusFormData({ ...minusFormData, ratePerMon: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Results Card - updates real-time */}
            <div className="bg-rose-50/50 p-5 rounded-xl border border-rose-200/60 shadow-xs space-y-3">
              <h4 className="text-[11px] font-black text-rose-800 uppercase tracking-widest border-b border-rose-200/50 pb-1">
                {language === 'bn' ? "মাইনাস হিসাবের লাইভ ফলাফল" : "Live Minus Calculation Result"}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-slate-700">
                    <span className="font-bold text-slate-500">
                      {language === 'bn' ? "ওজন কর্তনের হার: " : "O वजन কর্তনের হার (Deduction Rate): "}
                    </span>
                    <span className="font-black text-rose-600">
                      {minusCalcResult.deductionPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-700">
                    <span className="font-bold text-slate-500">
                      {language === 'bn' ? "কর্তন বাদে নিট ওজন: " : "Net Weight after deduction: "}
                    </span>
                    <span className="font-black text-slate-900">
                      {minusCalcResult.netWeight.toFixed(1)} কেজি (KG)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-slate-700">
                    <span className="font-bold text-slate-500">
                      {language === 'bn' ? "কর্তনকৃত হিসাবে প্রতি মনের মূল্য: " : "Effective Price per Mon: "}
                    </span>
                    <span className="font-black text-emerald-600">
                      ৳{Math.round(minusCalcResult.effectivePrice)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700">
                    <span className="font-bold text-slate-500">
                      {language === 'bn' ? "এত কেজি কর্তনে মোট মণ: " : "Total Mon after deduction: "}
                    </span>
                    <span className="font-black text-green-700 text-sm">
                      {minusCalcResult.monCount} মন {minusCalcResult.extraKg} কেজি
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button 
                onClick={handleSaveMinusCalculation}
                className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[11px] tracking-wider rounded shadow transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>{language === 'bn' ? "হিসাবটি খতিয়ানে সেভ করুন" : "Save Calculation"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center mb-3">
          {t.previewTitle}
        </h3>
        
        <CompactReceipt 
          formData={previewResult ? previewResult : (isMinusMode ? {
            sellerName: minusFormData.sellerName,
            totalKg: minusFormData.totalKg,
            challanNo: minusFormData.challanNo,
            monType: minusFormData.monType
          } : {
            sellerName: formData.sellerName,
            totalKg: formData.totalKg,
            challanNo: formData.challanNo,
            monType: formData.monType
          })} 
          result={previewResult ? previewResult : (isMinusMode ? { ...minusCalcResult, isMinusCalculated: true, ratePerMon: parseFloat(minusFormData.ratePerMon) || 0 } : currentCalcResult)} 
          onCopy={handleCopy}
          onSaveImage={handleSaveImage}
          isCalculated={previewResult !== null}
          t={t}
          language={language}
          receiptVisibility={receiptVisibility}
          rateRaw={isMinusMode ? minusFormData.ratePerMon : formData.ratePerMon}
        />
      </div>
    </div>
  );
}

interface CompactReceiptProps {
  formData: any;
  result: any;
  onCopy: () => void;
  onSaveImage: () => void;
  isCalculated: boolean;
  t: any;
  language: 'bn' | 'en';
  receiptVisibility: ReceiptVisibility;
  rateRaw: string;
}

function CompactReceipt({ 
  formData, 
  result, 
  onCopy, 
  onSaveImage, 
  isCalculated, 
  t, 
  language,
  receiptVisibility,
  rateRaw
}: CompactReceiptProps) {
  return (
    <div className={`bg-white dark:bg-slate-900 border-4 border-yellow-400 dark:border-yellow-500 rounded-xl p-6 shadow-xl font-mono text-xs transition-all relative overflow-hidden text-slate-900 dark:text-slate-100 ${!isCalculated ? 'opacity-70' : ''}`}>
      
      {/* Decorative Stamp badge */}
      <div className="absolute top-10 right-4 transform rotate-12 border-2 border-dashed border-red-500 text-red-500 text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest select-none bg-white/80 dark:bg-slate-800/80">
        {isCalculated ? (language === 'bn' ? 'প্রিভিউ রেডি' : 'READY') : (language === 'bn' ? 'হিসাব করুন' : 'UNSAVED')}
      </div>

      <div className="text-center border-b-2 border-slate-100 dark:border-slate-800 pb-4 mb-4">
        <h4 className="text-lg font-black uppercase text-black dark:text-white">A. S Enterprise</h4>
        <p className="font-bold text-slate-500 dark:text-slate-400 text-[10px]">Abu Saleh | 01766761877</p>
      </div>

      <div className="space-y-2 mb-6">
        {receiptVisibility.challanNo && (
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-400 dark:text-slate-500">Challan / মেমো নং:</span>
            <span className="font-black text-rose-600 dark:text-rose-400">#{formData.challanNo || '---'}</span>
          </div>
        )}
        {receiptVisibility.sellerName && (
          <div className="flex justify-between">
            <span className="font-bold text-slate-400 dark:text-slate-500">Seller / বিক্রেতা:</span>
            <span className="font-black text-slate-900 dark:text-slate-100">{formData.sellerName || '---'}</span>
          </div>
        )}
        {receiptVisibility.totalWeight && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-400 dark:text-slate-500">Total KG / ওজন:</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{formData.totalKg || '0'} KG</span>
            </div>
            {result.isMinusCalculated && result.deductedWeight !== undefined && (
              <div className="flex justify-between text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50/70 dark:bg-rose-950/20 p-1.5 rounded border border-rose-100 dark:border-rose-900/30 text-[10px]">
                <span>Deduction / ওজন কর্তন:</span>
                <span>-{result.deductedWeight.toFixed(1)} KG ({result.deductionPercentage?.toFixed(1)}%)</span>
              </div>
            )}
          </div>
        )}
        {receiptVisibility.monSystem && (
          <div className="flex justify-between">
            <span className="font-bold text-slate-400 dark:text-slate-500">Mon Type / মন সাইজ:</span>
            <span className="font-black text-slate-900 dark:text-slate-100">{formData.monType} KG/Mon</span>
          </div>
        )}
        {receiptVisibility.totalResult && (
          <div className="flex justify-between py-2 border-y border-dashed border-slate-200 dark:border-slate-800 mt-2 bg-yellow-50/50 dark:bg-yellow-950/20 px-1">
            <span className="font-extrabold text-slate-800 dark:text-slate-200">
              {result.isMinusCalculated ? 'Net Weight / নিট ওজন:' : 'Converted / রূপান্তরিত:'}
            </span>
            <span className="font-black text-base text-green-600 dark:text-green-400">
              {result.monCount} মন {result.extraKg} কেজি
            </span>
          </div>
        )}
        {receiptVisibility.rate && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-400 dark:text-slate-500">{result.isMinusCalculated ? 'Regular Rate / নির্ধারিত দর:' : 'Rate / দর প্রতি মন:'}</span>
              <span className="font-black text-slate-900 dark:text-slate-100">৳{result.isMinusCalculated ? result.ratePerMon : (rateRaw || '0')}</span>
            </div>
            {result.isMinusCalculated && result.effectivePrice !== undefined && (
              <div className="flex justify-between text-rose-600 dark:text-rose-450 font-extrabold text-[10px]">
                <span>Effective Rate / কর্তনকৃত দর:</span>
                <span>৳{Math.round(result.effectivePrice)} /মন</span>
              </div>
            )}
          </div>
        )}
      </div>

      {receiptVisibility.totalPayable && (
        <div className="bg-slate-950 text-yellow-400 dark:text-yellow-500 p-4 rounded-lg text-center mb-4 border border-slate-800 shadow-inner">
          <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400 dark:text-slate-500">{t.totalPayable}</p>
          <p className="text-2xl font-black">৳{Math.round(result.price).toLocaleString()}</p>
        </div>
      )}

      {receiptVisibility.disclaimer && (
        <p className="text-[9px] leading-relaxed text-slate-400 dark:text-slate-500 italic text-center px-1 border-t border-slate-100 dark:border-slate-800 pt-2 mb-4">
          {language === 'bn' 
            ? 'খড়ির সাইজ সর্বনিম্ন বের ৬" ইঞ্চি থেকে সর্বোচ্চ ৬৫" ও লম্বা ৩০" থেকে ৬০" ইঞ্চি পর্যন্ত নেওয়া হয়।'
            : 'Firewood log diameter must be min 6" and length restricted between 30" to 60".'}
        </p>
      )}

      {/* Primary manual Action triggered to Save in ledger */}
      {isCalculated ? (
        <div className="space-y-2 mb-4">
          <div className="w-full py-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400 font-extrabold rounded text-center text-xs flex items-center justify-center gap-2 shadow-sm">
            <span>✔ {language === 'bn' ? 'সফটওয়্যারে অটো সেভ করা হয়েছে!' : 'Auto-Saved of calculation successful!'}</span>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded text-center text-slate-400 dark:text-slate-500 text-[10px] font-bold border border-slate-100 dark:border-slate-800 mb-4 uppercase">
          {t.notCalculated}
        </div>
      )}

      {/* Save Image & Copy Trigger rows dynamically enabled */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onCopy}
          disabled={!isCalculated}
          className="flex items-center justify-center gap-1.5 h-10 bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-bold rounded uppercase text-[10px] tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Copy size={13} />
          {t.copyText}
        </button>
        <button
          onClick={onSaveImage}
          disabled={!isCalculated}
          className="flex items-center justify-center gap-1.5 h-10 bg-yellow-400 hover:bg-yellow-500 text-slate-950 dark:text-slate-900 font-bold rounded uppercase text-[10px] tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={13} />
          {t.saveImage}
        </button>
      </div>
    </div>
  );
}

// --- Ledger History & Multi-user Filter Panel ---

interface HistorySectionProps {
  calculations: Calculation[];
  onDelete: (id: string) => void;
  onEdit: (updated: Calculation) => void;
  t: any;
  language: 'bn' | 'en';
  allCalculations: Calculation[];
  currentUser: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

function HistorySection({ 
  calculations, 
  onDelete, 
  onEdit, 
  t, 
  language, 
  allCalculations, 
  currentUser,
  searchQuery,
  setSearchQuery
}: HistorySectionProps) {
  const [operatorFilter, setOperatorFilter] = useState<string>('ALL');
  const [editingCalc, setEditingCalc] = useState<Calculation | null>(null);

  // Compute list of unique operators that have stored calculations
  const operators = useMemo(() => {
    const list = new Set<string>();
    allCalculations.forEach(c => {
      if (c.createdBy) list.add(c.createdBy);
      else list.add('Guest');
    });
    return Array.from(list);
  }, [allCalculations]);

  // Handle filtering
  const filteredList = useMemo(() => {
    if (operatorFilter === 'ALL') return calculations;
    return calculations.filter(c => {
      const createdByVal = c.createdBy || 'Guest';
      return createdByVal.toLowerCase() === operatorFilter.toLowerCase();
    });
  }, [calculations, operatorFilter]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">{t.calculationLogs}</h3>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
            {filteredList.length} {language === 'bn' ? 'টি রেকর্ড তালিকাভুক্ত' : 'records formatted'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Quick Search Bar */}
          <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 h-8">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full sm:w-44 bg-transparent border-none text-[10px] font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none p-0 h-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-black focus:outline-none"
                title={language === 'bn' ? 'মুছে ফেলুন' : 'Clear search'}
              >
                ✕
              </button>
            )}
          </div>

          {/* Admin or Operator filter logic panel */}
          {currentUser.toLowerCase() === 'admin' && operators.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 h-8">
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">{t.filterByOperator}:</span>
              <select
                value={operatorFilter}
                onChange={e => setOperatorFilter(e.target.value)}
                className="text-[10px] font-black border-none bg-transparent dark:text-white outline-none cursor-pointer"
              >
                <option value="ALL">🌟 {t.allUsers}</option>
                {operators.map(op => (
                  <option key={op} value={op}>👤 {op}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      
      {filteredList.length === 0 ? (
        <div className="p-12 text-center text-slate-300 font-bold uppercase text-[10px]">No entries found</div>
      ) : (
        <>
          {/* Mobile Card List View (Visible only on small screens) */}
          <div className="block md:hidden divide-y divide-slate-100 bg-white">
            {filteredList.map((calc) => {
              const netKg = calc.isMinusCalculated && calc.deductedWeight !== undefined 
                ? Math.max(0, calc.totalKg - calc.deductedWeight) 
                : calc.totalKg;
              const monCount = Math.floor(netKg / calc.monType);
              const extraKg = parseFloat((netKg % calc.monType).toFixed(2));
              return (
                <div key={calc.id} className="p-4 space-y-3 hover:bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400">
                      📅 {new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-rose-500 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 text-[10px]">
                        #{calc.challanNo !== undefined ? calc.challanNo : '---'}
                      </span>
                      {calc.getEntryNo !== undefined && (
                        <span className="font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 text-[9px]">
                          {language === 'bn' ? `গেট এন্ট্রি ${toBengaliDigits(calc.getEntryNo)}` : `Get Entry ${calc.getEntryNo}`}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'বিক্রেতার নাম' : 'Seller Name'}</div>
                      <div className="font-black text-slate-800 flex flex-wrap items-center gap-1 mt-0.5">
                        {calc.sellerName}
                        {calc.isMinusCalculated && (
                          <span className="inline-block text-[8px] bg-rose-50 text-rose-600 border border-rose-100 rounded px-1 font-extrabold uppercase scale-90 origin-left">
                            {language === 'bn' ? 'মাইনাস' : 'Minus'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'মোট মূল্য' : 'Total Price'}</div>
                      <div className="font-black text-emerald-600 text-sm mt-0.5">৳{Math.round(calc.totalPrice).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'মোট ওজন' : 'Total Weight'}</div>
                      <div className="font-bold text-slate-600 mt-0.5 text-xs">
                        {calc.totalKg} KG
                        {calc.isMinusCalculated && calc.deductedWeight !== undefined && (
                          <div className="text-[9px] text-rose-500 font-black">
                            -{calc.deductedWeight.toFixed(1)} KG ({calc.deductionPercentage?.toFixed(1)}%)
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'রূপান্তরিত ওজন' : 'Converted Weight'}</div>
                      <div className="font-bold text-green-700 mt-0.5 text-xs">
                        {monCount} M {extraKg} KG
                        {calc.isMinusCalculated && (
                          <div className="text-[9px] text-slate-400 font-medium">
                            {language === 'bn' ? 'নিট রূপান্তরিত' : 'Net Converted'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'দর প্রতি মণ' : 'Rate / Mon'}</div>
                      <div className="font-bold text-slate-600 mt-0.5 text-xs">
                        ৳{calc.ratePerMon}
                        {calc.isMinusCalculated && calc.targetMonPrice !== undefined && (
                          <div className="text-[9px] text-emerald-600 font-extrabold">
                            Target: ৳{calc.targetMonPrice}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">User / মন সাইজ</div>
                      <div className="font-bold text-slate-500 mt-0.5 text-[10px]">
                        {calc.monType} KG | {calc.createdBy || 'Guest'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => setEditingCalc(calc)}
                      className="flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-lg font-black text-xs transition-all active:scale-95"
                    >
                      <Edit size={13} />
                      <span>{language === 'bn' ? 'সংশোধন' : 'Edit'}</span>
                    </button>
                    <button 
                      onClick={() => onDelete(calc.id)} 
                      className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3.5 py-2 rounded-lg font-black text-xs transition-all active:scale-95"
                    >
                      <Trash2 size={13} />
                      <span>{language === 'bn' ? 'মুছে ফেলুন' : 'Delete'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (Visible only on medium screens and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Challan</th>
                  <th className="px-3 py-3">Seller</th>
                  <th className="px-3 py-3">Weight (KG)</th>
                  <th className="px-3 py-3">Mon</th>
                  <th className="px-3 py-3">Rate</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((calc) => {
                  const netKg = calc.isMinusCalculated && calc.deductedWeight !== undefined 
                    ? Math.max(0, calc.totalKg - calc.deductedWeight) 
                    : calc.totalKg;
                  const monCount = Math.floor(netKg / calc.monType);
                  const extraKg = parseFloat((netKg % calc.monType).toFixed(2));
                  return (
                    <tr key={calc.id} className="text-[11px] hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-bold text-slate-400 whitespace-nowrap">
                        {new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
                      </td>
                      <td className="px-4 py-3 font-black text-rose-500 whitespace-nowrap">
                        <div>#{calc.challanNo !== undefined ? calc.challanNo : '---'}</div>
                        {calc.getEntryNo !== undefined && (
                          <div className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 inline-block font-black mt-1">
                            {language === 'bn' ? `গেট এন্ট্রি ${toBengaliDigits(calc.getEntryNo)}` : `Get Entry ${calc.getEntryNo}`}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-black text-slate-800">
                        {calc.sellerName}
                        {calc.isMinusCalculated && (
                          <span className="ml-1.5 inline-block text-[9px] bg-rose-50 text-rose-600 border border-rose-100 rounded px-1 font-extrabold uppercase">
                            {language === 'bn' ? 'মাইনাস' : 'Minus'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600 font-bold whitespace-nowrap">
                        <div>{calc.totalKg} KG</div>
                        {calc.isMinusCalculated && calc.deductedWeight !== undefined && (
                          <div className="text-[10px] text-rose-500 font-black">
                            -{calc.deductedWeight.toFixed(1)} KG ({calc.deductionPercentage?.toFixed(1)}%)
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-bold text-green-700 whitespace-nowrap">
                        <div>{monCount} M {extraKg} KG</div>
                        {calc.isMinusCalculated && (
                          <div className="text-[9px] text-slate-400 font-bold">
                            {language === 'bn' ? 'নিট রূপান্তরিত' : 'Net Converted'}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-500 font-bold whitespace-nowrap">
                        <div>৳{calc.ratePerMon}</div>
                        {calc.isMinusCalculated && calc.targetMonPrice !== undefined && (
                          <div className="text-[9px] text-emerald-600 font-extrabold">
                            Target: ৳{calc.targetMonPrice}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">৳{Math.round(calc.totalPrice).toLocaleString()}</td>
                      <td className="px-3 py-3">
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {calc.createdBy || 'Guest'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setEditingCalc(calc)}
                            className="text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-slate-100/80 transition-all"
                            title={language === 'bn' ? 'সম্পাদনা করুন' : 'Edit record'}
                          >
                            <Edit size={13} />
                          </button>
                          <button 
                            onClick={() => onDelete(calc.id)} 
                            className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50/80 transition-all"
                            title={language === 'bn' ? 'মুছে ফেলুন' : 'Delete record'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit Modal Overlay */}
      {editingCalc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="bg-yellow-400 p-4 font-black flex justify-between items-center text-slate-950">
              <span className="text-xs uppercase tracking-wider">
                {language === 'bn' ? 'চালান সংশোধন করুন' : 'Edit Challan Record'}
              </span>
              <button 
                onClick={() => setEditingCalc(null)} 
                className="hover:bg-black/10 w-7 h-7 rounded-full flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-left">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                  {language === 'bn' ? 'চালান নম্বর' : 'Challan No'}
                </label>
                <input 
                  type="number" 
                  value={editingCalc.challanNo !== undefined ? editingCalc.challanNo : ''}
                  onChange={e => setEditingCalc({ ...editingCalc, challanNo: parseInt(e.target.value) || 0 })}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                  {language === 'bn' ? 'বিক্রেতার নাম' : 'Seller Name'}
                </label>
                <input 
                  type="text" 
                  value={editingCalc.sellerName}
                  onChange={e => setEditingCalc({ ...editingCalc, sellerName: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-medium outline-none focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                    {language === 'bn' ? 'ওজন (KG)' : 'Weight (KG)'}
                  </label>
                  <input 
                    type="number" 
                    value={editingCalc.totalKg}
                    onChange={e => setEditingCalc({ ...editingCalc, totalKg: parseFloat(e.target.value) || 0 })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                    {language === 'bn' ? 'দর প্রতি মন (৳)' : 'Rate / Mon (৳)'}
                  </label>
                  <input 
                    type="number" 
                    value={editingCalc.ratePerMon}
                    onChange={e => setEditingCalc({ ...editingCalc, ratePerMon: parseFloat(e.target.value) || 0 })}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                  {language === 'bn' ? 'মন সাইজ' : 'Mon System'}
                </label>
                <select 
                  value={editingCalc.monType}
                  onChange={e => setEditingCalc({ ...editingCalc, monType: parseInt(e.target.value) as MonType })}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400 cursor-pointer"
                >
                  <option value={40}>40 KG</option>
                  <option value={41}>41 KG</option>
                  <option value={42}>42 KG</option>
                  <option value={43}>43 KG</option>
                </select>
              </div>

              {editingCalc.isMinusCalculated && (
                <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100 space-y-3">
                  <span className="text-[9px] font-black uppercase text-rose-800 tracking-wider">
                    {language === 'bn' ? 'মাইনাস হিসাবের তথ্য' : 'Minus Calculation Attributes'}
                  </span>
                  {editingCalc.targetMonPrice !== undefined ? (
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                        {language === 'bn' ? 'কাঙ্ক্ষিত মনের দাম (৳)' : 'Target Mon Price (৳)'}
                      </label>
                      <input 
                        type="number" 
                        value={editingCalc.targetMonPrice}
                        onChange={e => setEditingCalc({ ...editingCalc, targetMonPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full h-10 px-3 bg-white border border-rose-200 rounded text-xs font-bold text-emerald-600 outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                        {language === 'bn' ? 'কর্তন ওজন (KG)' : 'Deducted Weight (KG)'}
                      </label>
                      <input 
                        type="number" 
                        value={editingCalc.deductedWeight || 0}
                        onChange={e => setEditingCalc({ ...editingCalc, deductedWeight: parseFloat(e.target.value) || 0 })}
                        className="w-full h-10 px-3 bg-white border border-rose-200 rounded text-xs font-bold text-rose-600 outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setEditingCalc(null)} 
                className="px-4.5 py-2 border border-slate-200 text-slate-500 rounded text-xs font-bold hover:bg-slate-100 transition-all active:scale-95"
              >
                {language === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const mType = editingCalc.monType || 40;
                  const kg = editingCalc.totalKg || 0;
                  const rate = editingCalc.ratePerMon || 0;
                  
                  let totalMon = kg / mType;
                  let totalPrice = totalMon * rate;

                  if (editingCalc.isMinusCalculated) {
                    let netWeight = kg;
                    let deductedWeight = editingCalc.deductedWeight || 0;
                    let deductionPercentage = editingCalc.deductionPercentage || 0;

                    if (editingCalc.targetMonPrice !== undefined) {
                      // Target Mon Price mode
                      const targetMonPrice = editingCalc.targetMonPrice;
                      if (rate > 0) {
                        const ratio = targetMonPrice / rate;
                        netWeight = kg * ratio;
                        deductedWeight = Math.max(0, kg - netWeight);
                        deductionPercentage = (deductedWeight / kg) * 100;
                      }
                    } else {
                      // Weight Deduction mode
                      netWeight = Math.max(0, kg - deductedWeight);
                      if (kg > 0) {
                        deductionPercentage = (deductedWeight / kg) * 100;
                      }
                    }

                    totalMon = netWeight / mType;
                    totalPrice = totalMon * rate;

                    onEdit({
                      ...editingCalc,
                      totalMon,
                      totalPrice,
                      deductedWeight,
                      deductionPercentage
                    });
                  } else {
                    onEdit({
                      ...editingCalc,
                      totalMon,
                      totalPrice
                    });
                  }
                  setEditingCalc(null);
                }} 
                className="px-5 py-2 bg-yellow-400 text-black font-black uppercase text-[10px] tracking-wider rounded shadow hover:bg-yellow-500 transition-all active:scale-95"
              >
                {language === 'bn' ? 'সেভ করুন' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Note Section ---

function NoteSection({ notes, onAdd, onDelete, t }: { notes: Note[], onAdd: (n: Note) => void, onDelete: (id: string) => void, t: any }) {
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
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all">
          <h3 className="text-xs font-black uppercase mb-4 text-slate-400 dark:text-slate-500 tracking-wider font-sans">{t.addNote}</h3>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder={t.home === 'হোম' ? "শিরোনাম লিখুন" : "Memo Title"}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-yellow-400"
              value={note.title}
              onChange={e => setNote({ ...note, title: e.target.value })}
            />
            <textarea 
              placeholder={t.home === 'হোম' ? "নোটের বিবরণ লিখুন..." : "Enter note details..."}
              rows={6}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-medium text-slate-900 dark:text-white outline-none resize-none focus:ring-1 focus:ring-yellow-400"
              value={note.content}
              onChange={e => setNote({ ...note, content: e.target.value })}
            />
            <button 
              onClick={handleAdd}
              disabled={!note.title || !note.content}
              className="w-full h-11 bg-yellow-400 text-black font-black uppercase text-[11px] tracking-wider rounded transition-all active:scale-95 disabled:opacity-50"
            >
              {t.saveNote}
            </button>
          </div>
        </div>
      </div>
      
      <div className="md:col-span-2 space-y-4">
        {notes.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-300 dark:text-slate-600 font-bold uppercase text-[10px]">{t.noNotes}</div>
        ) : (
          notes.map(n => (
            <div key={n.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-black text-base text-slate-800 dark:text-slate-100">{n.title}</h4>
                <button onClick={() => onDelete(n.id)} className="text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{n.content}</p>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-4 block">{new Date(n.timestamp).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
