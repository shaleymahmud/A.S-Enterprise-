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
  Building
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
  challanNo: number;
  createdBy: string;
}

interface Note {
  id: string;
  timestamp: number;
  title: string;
  content: string;
}

type Tab = 'home' | 'calculator' | 'history' | 'note' | 'admin' | 'settings';
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

// --- Multi-language Translation dictionary ---
const translations = {
  bn: {
    title: "এ. এস এন্টারপ্রাইজ",
    subtitle: "খড়ি সরবরাহকারী ও পাইকারি বিক্রেতা",
    proprietor: "প্রোপ্রাইটর: আবু সালেহ | মোবাইল: 01766761877",
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
    challanNum: "চালান নং (Challan)",
    sellerName: "বিক্রেতার নাম (Seller Name)",
    totalWeight: "মোট ওজন (Total Weight)",
    monSystem: "মন সিস্টেম (Mon System)",
    ratePerMon: "নির্ধারিত দর (Rate per Mon)",
    calculate: "হিসাব করুন (Calculate)",
    challanSuggested: "চালান নং মেলেনি! সঠিক ক্রম:",
    serialBypass: "সিরিয়াল মিস্টেক স্বীকার করে মেলান",
    conversionRes: "রূপান্তরিত হিসাব:",
    totalPayable: "সর্বমোট পরিশোধযোগ্য বিল",
    sizeWarning: "বিশেষ দ্রষ্টব্য (Warning Disclaimer): এখানে কোনো চিকন খড়ি নেওয়া হয় না। খড়ির সাইজ সর্বনিম্ন বের ৬\" ইঞ্চি থেকে সর্বোচ্চ ৬৫ ইঞ্চি পর্যন্ত ও লম্বায় সর্বনিম্ন ৩০ ইঞ্চি থেকে ৬০ ইঞ্চি পর্যন্ত খড়ি নেওয়া হয়।",
    signatureAdmin: "অফিস সহকারী সাক্ষর",
    signatureProp: "প্রোপ্রাইটর সাক্ষর (Abu Saleh)",
    excelExport: "এক্সেল শীট ডাউনলোড (Excel CSV)",
    pdfPrint: "রিপোর্ট প্রিন্ট ও পিডিএফ (PDF Report)",
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
    usernameText: "ইউজারনেম দিন (Username)",
    passwordText: "পাসওয়ার্ড দিন (Password)",
    noLoginWarning: "অনুগ্রহ করে হিসাব সংরক্ষণের জন্য ইউজার প্যানেল থেকে নাম দিন!",
    allUsers: "সকল অপারেটর",
    recordCount: "টি রেকর্ড খুঁজে পাওয়া গেছে",
    filterByOperator: "অপারেটর অনুযায়ী ফিল্টার করুন",
    previewTitle: "বিল মেমোর প্রিভিউ মনিটর"
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
    previewTitle: "Receipt Preview Monitor"
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

    if (savedCalcs) setCalculations(JSON.parse(savedCalcs));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedChallan) setDefaultChallan(parseInt(savedChallan) || 601);
    if (savedLang) setLanguage(savedLang as 'bn' | 'en');
    if (savedUser) setCurrentUser(savedUser);
    if (savedRegUsers) setRegisteredUsers(JSON.parse(savedRegUsers));
    if (savedVisibility) setReceiptVisibility(JSON.parse(savedVisibility));
  }, []);

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
    setCalculations([newCalc, ...calculations]);
  };

  const deleteCalculation = (id: string) => {
    const confirmation = language === 'bn' ? 'আপনি কি এই রেকর্ডটি মুছে ফেলতে লজ্জিত?' : 'Are you sure you want to delete this record?';
    if (confirm(confirmation)) {
      setCalculations(calculations.filter(c => c.id !== id));
    }
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

  const stats = useMemo(() => {
    return filteredCalculations.reduce((acc, curr) => ({
      totalKg: acc.totalKg + curr.totalKg,
      totalMon: acc.totalMon + curr.totalMon,
      totalPrice: acc.totalPrice + curr.totalPrice
    }), { totalKg: 0, totalMon: 0, totalPrice: 0 });
  }, [filteredCalculations]);

  // Active translations
  const t = translations[language];

  // CSV Sheet Exporter (Excel support)
  const handleExportCSV = () => {
    if (filteredCalculations.length === 0) {
      alert(language === 'bn' ? 'কোনো হিসাবের রেকর্ড পাওয়া যায়নি রপ্তানি করতে!' : 'No records found to export!');
      return;
    }

    const headers = language === 'bn' 
      ? ['তারিখ', 'চালান নং', 'বিক্রেতা নাম', 'মোট ওজন (কেজি)', 'মন ধরণ', 'রূপান্তরিত ওজন', 'দর (টাকা)', 'সর্বমোট বিল (টাকা)', 'অপারেটর']
      : ['Date', 'Challan No', 'Seller Name', 'Total Weight (KG)', 'Mon Type', 'Converted Weight', 'Rate', 'Total Paid', 'Operator'];

    const rows = filteredCalculations.map(calc => {
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
    if (filteredCalculations.length === 0) {
      alert(language === 'bn' ? 'প্রিন্ট করার জন্য কোনো হিসাবের রেকর্ড নেই!' : 'No records found to print!');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStrRange = language === 'bn'
      ? (dateFilter === 'today' ? 'আজকের' : dateFilter === 'yesterday' ? 'গতকালের' : dateFilter === '7days' ? 'গত ৭ দিনের' : 'গত ৩০ দিনের')
      : (dateFilter === 'today' ? 'Today\'s' : dateFilter === 'yesterday' ? 'Yesterday\'s' : dateFilter === '7days' ? 'Last 7 Days\'' : 'Last 30 Days\'');

    const tableRows = filteredCalculations.map(calc => {
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
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 selection:bg-yellow-200">
      {/* Dynamic Header */}
      <header className="bg-yellow-400 text-black shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <Building className="w-6 h-6 text-slate-900 animate-pulse" />
              <div>
                <h1 className="text-sm md:text-base font-black tracking-tight uppercase leading-none">{t.title}</h1>
                <p className="text-[9px] font-bold text-slate-800 tracking-wider uppercase hidden sm:block mt-0.5">{t.subtitle}</p>
              </div>
            </div>
            
            {/* Nav Links */}
            <nav className="hidden lg:flex items-center h-full">
              <NavButton label={t.home} active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavButton label={t.calculator} active={activeTab === 'calculator'} onClick={() => setActiveTab('calculator')} />
              <NavButton label={t.history} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
              <NavButton label={t.note} active={activeTab === 'note'} onClick={() => setActiveTab('note')} />
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

              {/* Language Selector */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-[10px] font-extrabold text-slate-800 transition-all select-none active:scale-95"
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
              <HomeSection stats={stats} dateFilter={dateFilter} setDateFilter={setDateFilter} t={t} />
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
                <div className="flex bg-white p-1 rounded shadow-sm border border-slate-200">
                  {(['today', 'yesterday', '7days', '1month'] as DateFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setDateFilter(f)}
                      className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${
                        dateFilter === f ? 'bg-yellow-400 text-black shadow-sm' : 'text-slate-400 hover:bg-slate-50'
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
                calculations={filteredCalculations} 
                onDelete={deleteCalculation} 
                t={t}
                language={language}
                allCalculations={calculations} // to calculate list of users for filter
                currentUser={currentUser}
              />
            </motion.div>
          )}
          {activeTab === 'note' && (
            <motion.div key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <NoteSection notes={notes} onAdd={addNote} onDelete={deleteNote} t={t} />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200 font-sans">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Visual Visibility Setup Panel */}
                <div className="flex-1 space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 mb-2">{t.settingsTitle}</h2>
                    <p className="text-xs text-slate-500 mb-6">
                      {language === 'bn' 
                        ? 'হিসাব মনিটর এবং মেমো ইমেজে (ডাউনলোডের সময়) কোন কোন উপাদানসমূহ দৃশ্যমান থাকবে তা এখান থেকে চালু বা বন্ধ করুন।' 
                        : 'Configure display items to show or hide in both real-time preview monitor monitor and generated PNG bills.'}
                    </p>
                  </div>

                  <div className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">
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
                  <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-100 max-w-xl">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">
                       {language === 'bn' ? 'চালান নং ক্রমিক নির্ধারণ' : 'Challan Sequence Bootstrap'}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      {language === 'bn' 
                        ? 'ডিফল্ট চালানের নম্বরটি নির্ধারণ করুন। আপনার পূর্বের কোনো হিসাব না থাকলে অ্যাপ এখান থেকে আপনার সিরিয়াল গণনা শুরু করবে।' 
                        : 'Specify target startup serial. Automatic increment logic relies on this index if history is cleared.'}
                    </p>
                    <div className="max-w-xs">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">
                        {language === 'bn' ? 'ডিফল্ট শুরু চালান নং' : 'Fallback Next Challan'}
                      </label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded text-sm font-black focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
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
                <div className="w-full lg:w-96 bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="text-yellow-600" size={20} />
                      <h3 className="text-md font-black text-slate-800">{t.loginTitle}</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {language === 'bn' 
                        ? 'কোনো কঠিন ভেরিফিকেশন বা সেশন ফি নেই। যেকোনো নাম দিয়ে সাথে সাথে অ্যাকাউন্ট খুলে প্রতিটি হিসাব সরাসরি আপনার নামে সেভ করতে পারেন।' 
                        : 'No heavy verification sequence. Simply logon as any username and calculations will be indexed under your identity.'}
                    </p>
                  </div>

                  {currentUser !== 'Guest' ? (
                    <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4 shadow-sm">
                      <p className="text-xs text-slate-400 uppercase font-black tracking-wider">{t.loggedInAs}</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-yellow-400 flex items-center justify-center text-white font-black text-base">
                          {currentUser.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-800">{currentUser}</p>
                          <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded border border-green-100 inline-block mt-0.5">
                            {currentUser.toLowerCase() === 'admin' ? 'ADMIN / এডমিন' : 'ACTIVE SESSION'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                        <p className="text-[10px] text-slate-400 italic">
                          {language === 'bn' ? 'সকল চালানের হিসাব সংরক্ষিত হচ্ছে' : 'Logs tracked under your name'}
                        </p>
                        <button 
                          onClick={handleLogout}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-black uppercase rounded tracking-wider transition-all"
                        >
                          {language === 'bn' ? 'লগআউট' : 'Sign Out'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">{t.usernameText}</label>
                        <input 
                          type="text"
                          required
                          placeholder="e.g. Sales"
                          value={authName}
                          onChange={e => setAuthName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded text-xs font-black focus:ring-2 focus:ring-yellow-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">{t.passwordText}</label>
                        <input 
                          type="password"
                          required
                          placeholder="••••••"
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded text-xs font-black focus:ring-2 focus:ring-yellow-400 outline-none"
                        />
                      </div>

                      <p className="text-[9px] leading-relaxed text-slate-400 italic">
                        * {language === 'bn' 
                          ? 'নতুন নাম দিলে স্বয়ংক্রিয়ভাবে একটি অ্যাকাউন্ট তৈরি হয়ে পরবর্তী কাজের জন্য পাসওয়ার্ড দিয়ে লক থাকবে।' 
                          : 'Entering a new username automatically registers you. Keep passwords remembered for return logins.'}
                      </p>

                      <button 
                        type="submit"
                        className="w-full py-2.5 bg-slate-900 hover:bg-black text-yellow-400 font-extrabold uppercase text-[10px] tracking-widest rounded transition-all active:scale-95 shadow-sm"
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
      <footer className="mt-12 border-t border-slate-200 mb-8 pt-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-slate-600 leading-relaxed bg-white p-4 rounded-lg shadow-sm border border-slate-100 italic">
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
          ? 'bg-black text-yellow-400' 
          : 'text-black hover:bg-yellow-500'
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
          ? 'bg-white border-yellow-400 text-slate-800 shadow-sm' 
          : 'bg-slate-100 border-slate-200 text-slate-400'
      }`}
    >
      <span>{label}</span>
      <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
        value ? 'bg-yellow-400 text-black' : 'bg-slate-200 text-slate-400'
      }`}>
        {value && <Check size={11} strokeWidth={3} />}
      </div>
    </button>
  );
}

// --- Home ---

function HomeSection({ stats, dateFilter, setDateFilter, t }: { 
  stats: any, 
  dateFilter: DateFilter, 
  setDateFilter: (f: DateFilter) => void,
  t: any
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">{t.summary}</h2>
        <div className="flex bg-white p-1 rounded shadow-sm border border-slate-200">
          {(['today', 'yesterday', '7days', '1month'] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${
                dateFilter === f ? 'bg-yellow-400 text-black shadow-sm' : 'text-slate-400 hover:bg-slate-50'
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CompactStatCard label={t.totalKgLabel} value={stats.totalKg.toLocaleString()} unit="KG" bg="bg-white" />
        <CompactStatCard label={t.totalMonLabel} value={stats.totalMon.toFixed(2)} unit="MON" bg="bg-white" />
        <CompactStatCard label={t.totalPriceLabel} value={`৳${Math.round(stats.totalPrice).toLocaleString()}`} unit="BDT" bg="bg-yellow-400" text="text-black" />
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
    monType: 40 as MonType,
    challanNo: expectedNextChallan.toString()
  });

  const [allowSerialBypass, setAllowSerialBypass] = useState(false);

  // Preview result is only filled out upon clicking "Calculate"
  const [previewResult, setPreviewResult] = useState<any | null>(null);

  // Sync expected Challan number if input is currently empty
  useEffect(() => {
    setFormData(prev => {
      if (!prev.challanNo || prev.challanNo === '') {
        return { ...prev, challanNo: expectedNextChallan.toString() };
      }
      return prev;
    });
  }, [expectedNextChallan]);

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

  // On Calculate: Populate the preview result state
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

    setPreviewResult({
      sellerName: formData.sellerName,
      totalKg: parseFloat(formData.totalKg),
      challanNo: enteredChallanNum,
      monType: formData.monType,
      monCount: currentCalcResult.monCount,
      extraKg: currentCalcResult.extraKg,
      totalMonDecimal: currentCalcResult.totalMonDecimal,
      price: currentCalcResult.price
    });
  };

  // Perform permanent save explicitly clicking "Save to Software" button
  const handleSaveToDatabase = () => {
    if (!previewResult) return;

    // Check for exact duplicates matching name & weight
    const isDuplicate = calculations.some(c => 
      c.sellerName.trim().toLowerCase() === previewResult.sellerName.trim().toLowerCase() && 
      c.totalKg === previewResult.totalKg
    );

    if (isDuplicate) {
      const promptText = language === 'bn' 
        ? `এগেইন সেইভ?\n\nএকই বিক্রেতার নাম ও পন্যের ওজন (${previewResult.totalKg} KG) বিশিষ্ট হিসাব ইতিমধ্যে সেভ করা হয়েছে!` 
        : `Save Duplicate Record?\n\nA calculation listing ${previewResult.sellerName} at ${previewResult.totalKg} KG already exists. Would you like to save this duplicate record?`;
      
      if (!confirm(promptText)) {
        return;
      }
    }

    onSave({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      sellerName: previewResult.sellerName,
      totalKg: previewResult.totalKg,
      ratePerMon: parseFloat(formData.ratePerMon),
      monType: previewResult.monType,
      totalMon: previewResult.totalMonDecimal,
      totalPrice: previewResult.price,
      challanNo: previewResult.challanNo
    });

    const successMsg = language === 'bn' ? 'হিসাবটি সফলভাবে সফটওয়্যারে সেভ করা হয়েছে!' : 'Calculation successfully persisted in ledger!';
    alert(successMsg);

    // Increment challan by 1 for next use and reset forms
    const userSavedChallan = previewResult.challanNo;
    setFormData({
      sellerName: '',
      totalKg: '',
      ratePerMon: '',
      monType: formData.monType,
      challanNo: (userSavedChallan + 1).toString()
    });
    setPreviewResult(null);
    setAllowSerialBypass(false);
  };

  // Strictly formatted Bengali copy layout according to user specifications:
  // "বিক্রেতার নাম: মোন্নাফ
  // ওজন : 12 মোন 8 কেজী
  // রেট : 157 টাকা
  // মোট মূল্য: 1915 টাকা"
  const handleCopy = () => {
    if (!previewResult) {
      alert(language === 'bn' ? 'কপি করার জন্য প্রথমে হিসাব সম্পন্ন করুন!' : 'Perform calculation first to copy text!');
      return;
    }

    // Always Bengali formatting for copied clipboard text according to strict request!
    // "কপি করলে অবশ্যই এই চারটি বিষয় কপি হবে বাংলায়।"
    const formattedPrice = Math.round(previewResult.price);
    const textToCopy = `
বিক্রেতার নাম: ${previewResult.sellerName}
ওজন : ${previewResult.monCount} মোন ${previewResult.extraKg} কেজী
রেট : ${parseFloat(formData.ratePerMon)} টাকা
মোট মূল্য: ${formattedPrice} টাকা
    `.trim();
    
    navigator.clipboard.writeText(textToCopy);
    alert(language === 'bn' ? '৪টি বিষয় সফলভাবে বাংলায় কপি করা হয়েছে!' : 'The specified 4 elements have been copied strictly in Bengali format!');
  };

  const handleSaveImage = () => {
    if (!previewResult) return;

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 760;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    ctx.font = fontStr(24, 'bold');
    ctx.fillText('A. S Enterprise (এ. এস এন্টারপ্রাইজ)', canvas.width / 2, 65);

    ctx.font = fontStr(12, 'bold');
    ctx.fillStyle = '#4b5563';
    ctx.fillText('খড়ি সরবরাহকারী ও পাইকারি বিক্রেতা', canvas.width / 2, 90);

    ctx.fillStyle = '#0f172a';
    ctx.font = fontStr(13, 'bold');
    ctx.fillText('প্রোপ্রাইটর: আবু সালেহ | মোবাইল: 01766761877', canvas.width / 2, 115);

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
    ctx.font = fontStr(13, 'bold');
    if (receiptVisibility.challanNo) {
      ctx.fillText(`চালান নং (Challan #): ${previewResult.challanNo}`, 40, 175);
    }

    ctx.textAlign = 'right';
    const dateFormatted = new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.fillText(`তারিখ: ${dateFormatted}`, canvas.width - 40, 175);

    // Structured panel background
    ctx.fillStyle = '#fbfbfd';
    ctx.fillRect(40, 205, canvas.width - 80, 245);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, 205, canvas.width - 80, 245);

    // Data rows according to visibility settings configured in App Settings
    const displayList = [];
    if (receiptVisibility.sellerName) {
      displayList.push({ label: 'বিক্রেতার নাম (Seller Name)', value: previewResult.sellerName });
    }
    if (receiptVisibility.totalWeight) {
      displayList.push({ label: 'মোট পরিমাণ (Weight in KG)', value: `${previewResult.totalKg} KG` });
    }
    if (receiptVisibility.monSystem) {
      displayList.push({ label: 'মন সিস্টেম (Mon System)', value: `${previewResult.monType} KG/Mon` });
    }
    if (receiptVisibility.totalResult) {
      displayList.push({ label: 'রূপান্তরিত হিসাব (Yield)', value: `${previewResult.monCount} মন ${previewResult.extraKg} কেজি`, color: '#16a34a' });
    }
    if (receiptVisibility.rate) {
      displayList.push({ label: 'নির্ধারিত দর (Rate / Mon)', value: `৳${parseFloat(formData.ratePerMon)}` });
    }

    let itemY = 245;
    displayList.forEach((r, index) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = fontStr(12.5, 'bold');
      ctx.fillText(r.label, 55, itemY + index * 38);

      ctx.textAlign = 'right';
      ctx.fillStyle = r.color || '#0f172a';
      ctx.font = fontStr(13, 'bold');
      ctx.fillText(r.value, canvas.width - 55, itemY + index * 38);

      // Separator lines
      if (index < displayList.length - 1) {
        ctx.beginPath();
        ctx.moveTo(50, itemY + index * 38 + 18);
        ctx.lineTo(canvas.width - 50, itemY + index * 38 + 18);
        ctx.strokeStyle = '#f1f5f9';
        ctx.stroke();
      }
    });

    // Net Payable Box Container
    if (receiptVisibility.totalPayable) {
      ctx.fillStyle = '#000055';
      ctx.fillRect(40, 480, canvas.width - 80, 75);

      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'left';
      ctx.font = fontStr(14, 'bold');
      ctx.fillText('সর্বমোট পরিশোধ্য বিল (Total Paid):', 60, 524);

      ctx.textAlign = 'right';
      ctx.font = fontStr(24, 'bold');
      ctx.fillText(`৳${Math.round(previewResult.price).toLocaleString()}`, canvas.width - 60, 526);
    }

    // Footnote Warning
    if (receiptVisibility.disclaimer) {
      ctx.textAlign = 'center';
      ctx.font = fontStr(10, 'bold');
      ctx.fillStyle = '#dc2626';
      ctx.fillText('বিশেষ দ্রষ্টব্য (Warning Size Disclaimer):', canvas.width / 2, 580);

      ctx.fillStyle = '#475569';
      ctx.font = fontStr(9.5, 'bold');
      ctx.fillText('এখানে কোনো চিকন খড়ি নেওয়া হয় না। খড়ির সাইজ সর্বনিম্ন বের ৬" ইঞ্চি', canvas.width / 2, 599);
      ctx.fillText('থেকে সর্বোচ্চ ৬৫ ইঞ্চি পর্যন্ত ও লম্বায় সর্বনিম্ন ৩০ ইঞ্চি থেকে ৬০ ইঞ্চি পর্যন্ত খড়ি নেওয়া হয়।', canvas.width / 2, 614);
    }

    // Signatures row
    if (receiptVisibility.signatures) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#000000';
      ctx.font = fontStr(11, 'bold');
      ctx.fillText('অফিস সহকারী সাক্ষর', 45, 690);
      ctx.fillText('Checked & Signed', 45, 706);

      ctx.textAlign = 'right';
      ctx.fillText('-------------------------', canvas.width - 45, 675);
      ctx.fillText('প্রোপ্রাইটর সাক্ষর (Abu Saleh)', canvas.width - 45, 690);
      ctx.fillText('Authorized Signature', canvas.width - 45, 706);
    }

    const dataURI = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Challan_No_${previewResult.challanNo}.png`;
    link.href = dataURI;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
          <CalcIcon className="text-yellow-500 w-5 h-5 animate-bounce" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{t.calculatorSectionTitle}</h3>
        </div>
        
        {/* Horizontal Input Row aligned equally */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6">
          <div className="md:col-span-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">{t.sellerName}</label>
            <input 
              type="text" 
              placeholder={language === 'bn' ? "বিক্রেতার নাম লিখুন" : "e.g. Monnaf"}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-bold focus:ring-2 focus:ring-yellow-400 outline-none"
              value={formData.sellerName}
              onChange={e => setFormData({ ...formData, sellerName: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">{t.totalWeight}</label>
            <input 
              type="number" 
              placeholder="0"
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-black focus:ring-2 focus:ring-yellow-400 outline-none"
              value={formData.totalKg}
              onChange={e => setFormData({ ...formData, totalKg: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">{t.challanNum}</label>
            <input 
              type="number" 
              placeholder="0"
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-black focus:ring-2 focus:ring-yellow-400 text-rose-600 outline-none"
              value={formData.challanNo}
              onChange={e => setFormData({ ...formData, challanNo: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">{t.monSystem}</label>
            <div className="flex gap-1 h-11">
              {[40, 41, 42, 43].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, monType: type as MonType })}
                  className={`flex-1 rounded text-[10px] font-black transition-all border-2 ${
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
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">{t.ratePerMon}</label>
            <input 
              type="number" 
              placeholder="0"
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-black focus:ring-2 focus:ring-yellow-400 outline-none"
              value={formData.ratePerMon}
              onChange={e => setFormData({ ...formData, ratePerMon: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-1">
          {/* Allow manual custom sequential check or bypass */}
          <div className="flex items-center">
            {showChallanWarning ? (
              <label className="flex items-center gap-2 bg-red-50 text-red-950 px-3 py-1.5 rounded border border-red-200 text-[10px] font-bold cursor-pointer select-none active:scale-95 shadow-sm">
                <input 
                  type="checkbox" 
                  checked={allowSerialBypass}
                  onChange={e => setAllowSerialBypass(e.target.checked)}
                  className="rounded border-red-300 text-red-600 focus:ring-red-400 accent-red-600 cursor-pointer"
                />
                <span className="leading-none text-red-700 font-extrabold">{t.serialBypass}</span>
              </label>
            ) : (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
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
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold flex items-center gap-2 animate-pulse">
            <span>⚠️</span>
            <p>
              {t.challanSuggested} <span className="font-extrabold text-rose-700 bg-white px-2 py-0.5 rounded shadow-sm">#{expectedNextChallan}</span>
            </p>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center mb-3">
          {t.previewTitle}
        </h3>
        
        <CompactReceipt 
          formData={previewResult || {
            sellerName: formData.sellerName,
            totalKg: formData.totalKg,
            challanNo: formData.challanNo,
            monType: formData.monType
          }} 
          result={previewResult ? previewResult : currentCalcResult} 
          onCopy={handleCopy}
          onSaveImage={handleSaveImage}
          onSaveToDatabase={handleSaveToDatabase}
          isCalculated={previewResult !== null}
          t={t}
          language={language}
          receiptVisibility={receiptVisibility}
          rateRaw={formData.ratePerMon}
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
  onSaveToDatabase: () => void;
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
  onSaveToDatabase, 
  isCalculated, 
  t, 
  language,
  receiptVisibility,
  rateRaw
}: CompactReceiptProps) {
  return (
    <div className={`bg-white border-4 border-yellow-400 rounded-xl p-6 shadow-xl font-mono text-xs transition-all relative overflow-hidden ${!isCalculated ? 'opacity-70' : ''}`}>
      
      {/* Decorative Stamp badge */}
      <div className="absolute top-10 right-4 transform rotate-12 border-2 border-dashed border-red-500 text-red-500 text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest select-none bg-white/80">
        {isCalculated ? (language === 'bn' ? 'প্রিভিউ রেডি' : 'READY') : (language === 'bn' ? 'হিসাব করুন' : 'UNSAVED')}
      </div>

      <div className="text-center border-b-2 border-slate-100 pb-4 mb-4">
        <h4 className="text-lg font-black uppercase text-black">A. S Enterprise</h4>
        <p className="font-bold text-slate-500 text-[10px]">Abu Saleh | 01766761877</p>
      </div>

      <div className="space-y-2 mb-6">
        {receiptVisibility.challanNo && (
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-400">Challan / মেমো নং:</span>
            <span className="font-black text-rose-600">#{formData.challanNo || '---'}</span>
          </div>
        )}
        {receiptVisibility.sellerName && (
          <div className="flex justify-between">
            <span className="font-bold text-slate-400">Seller / বিক্রেতা:</span>
            <span className="font-black text-slate-900">{formData.sellerName || '---'}</span>
          </div>
        )}
        {receiptVisibility.totalWeight && (
          <div className="flex justify-between">
            <span className="font-bold text-slate-400">Total KG / ওজন:</span>
            <span className="font-black text-slate-900">{formData.totalKg || '0'} KG</span>
          </div>
        )}
        {receiptVisibility.monSystem && (
          <div className="flex justify-between">
            <span className="font-bold text-slate-400">Mon Type / মন সাইজ:</span>
            <span className="font-black text-slate-900">{formData.monType} KG/Mon</span>
          </div>
        )}
        {receiptVisibility.totalResult && (
          <div className="flex justify-between py-2 border-y border-dashed border-slate-200 mt-2 bg-yellow-50/50 px-1">
            <span className="font-extrabold text-slate-800">Converted / রূপান্তরিত:</span>
            <span className="font-black text-base text-green-600">
              {result.monCount} মন {result.extraKg} কেজি
            </span>
          </div>
        )}
        {receiptVisibility.rate && (
          <div className="flex justify-between">
            <span className="font-bold text-slate-400">Rate / দর প্রতি মন:</span>
            <span className="font-black text-slate-900">৳{rateRaw || '0'}</span>
          </div>
        )}
      </div>

      {receiptVisibility.totalPayable && (
        <div className="bg-slate-950 text-yellow-400 p-4 rounded-lg text-center mb-4 border border-slate-800 shadow-inner">
          <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">{t.totalPayable}</p>
          <p className="text-2xl font-black">৳{Math.round(result.price).toLocaleString()}</p>
        </div>
      )}

      {receiptVisibility.disclaimer && (
        <p className="text-[9px] leading-relaxed text-slate-400 italic text-center px-1 border-t border-slate-100 pt-2 mb-4">
          {language === 'bn' 
            ? 'খড়ির সাইজ সর্বনিম্ন বের ৬" ইঞ্চি থেকে সর্বোচ্চ ৬৫" ও লম্বা ৩০" থেকে ৬০" ইঞ্চি পর্যন্ত নেওয়া হয়।'
            : 'Firewood log diameter must be min 6" and length restricted between 30" to 60".'}
        </p>
      )}

      {/* Primary manual Action triggered to Save in ledger */}
      {isCalculated ? (
        <div className="space-y-2 mb-4">
          <button
            onClick={onSaveToDatabase}
            className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-black rounded uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow"
          >
            <Save size={14} />
            <span>{t.saveSoftware}</span>
          </button>
        </div>
      ) : (
        <div className="p-3 bg-slate-50 rounded text-center text-slate-400 text-[10px] font-bold border border-slate-100 mb-4 uppercase">
          {t.notCalculated}
        </div>
      )}

      {/* Save Image & Copy Trigger rows dynamically enabled */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
        <button
          onClick={onCopy}
          disabled={!isCalculated}
          className="flex items-center justify-center gap-1.5 h-10 bg-slate-900 hover:bg-black text-white font-bold rounded uppercase text-[10px] tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Copy size={13} />
          {t.copyText}
        </button>
        <button
          onClick={onSaveImage}
          disabled={!isCalculated}
          className="flex items-center justify-center gap-1.5 h-10 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-bold rounded uppercase text-[10px] tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
  t: any;
  language: 'bn' | 'en';
  allCalculations: Calculation[];
  currentUser: string;
}

function HistorySection({ calculations, onDelete, t, language, allCalculations, currentUser }: HistorySectionProps) {
  const [operatorFilter, setOperatorFilter] = useState<string>('ALL');

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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">{t.calculationLogs}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
            {filteredList.length} {language === 'bn' ? 'টি রেকর্ড তালিকাভুক্ত' : 'records formatted'}
          </p>
        </div>

        {/* Admin or Operator filter logic panel */}
        {currentUser.toLowerCase() === 'admin' && operators.length > 0 && (
          <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded border border-slate-200">
            <span className="text-[10px] font-extrabold text-slate-500">{t.filterByOperator}:</span>
            <select
              value={operatorFilter}
              onChange={e => setOperatorFilter(e.target.value)}
              className="text-[10px] font-black border-none bg-transparent outline-none cursor-pointer"
            >
              <option value="ALL">🌟 {t.allUsers}</option>
              {operators.map(op => (
                <option key={op} value={op}>👤 {op}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      {filteredList.length === 0 ? (
        <div className="p-12 text-center text-slate-300 font-bold uppercase text-[10px]">No entries found</div>
      ) : (
        <div className="overflow-x-auto">
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
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map((calc) => {
                const monCount = Math.floor(calc.totalKg / calc.monType);
                const extraKg = calc.totalKg % calc.monType;
                return (
                  <tr key={calc.id} className="text-[11px] hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-slate-400 whitespace-nowrap">
                      {new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
                    </td>
                    <td className="px-4 py-3 font-black text-rose-500">#{calc.challanNo !== undefined ? calc.challanNo : '---'}</td>
                    <td className="px-3 py-3 font-black text-slate-800">{calc.sellerName}</td>
                    <td className="px-3 py-3 text-slate-600 font-bold">{calc.totalKg} KG</td>
                    <td className="px-3 py-3 font-bold text-green-700 whitespace-nowrap">{monCount} M {extraKg} KG</td>
                    <td className="px-3 py-3 text-slate-500 font-bold">৳{calc.ratePerMon}</td>
                    <td className="px-4 py-3 font-black text-slate-900">৳{Math.round(calc.totalPrice).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {calc.createdBy || 'Guest'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => onDelete(calc.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xs font-black uppercase mb-4 text-slate-400 tracking-wider font-sans">{t.addNote}</h3>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder={t.home === 'হোম' ? "শিরোনাম লিখুন" : "Memo Title"}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400"
              value={note.title}
              onChange={e => setNote({ ...note, title: e.target.value })}
            />
            <textarea 
              placeholder={t.home === 'হোম' ? "নোটের বিবরণ লিখুন..." : "Enter note details..."}
              rows={6}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium outline-none resize-none focus:ring-1 focus:ring-yellow-400"
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
          <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-300 font-bold uppercase text-[10px]">{t.noNotes}</div>
        ) : (
          notes.map(n => (
            <div key={n.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-black text-base text-slate-800">{n.title}</h4>
                <button onClick={() => onDelete(n.id)} className="text-slate-300 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{n.content}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-4 block">{new Date(n.timestamp).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
