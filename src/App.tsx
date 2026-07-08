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
  Search,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AssistantSection from './components/AssistantSection';
import BillingSection from './components/BillingSection';
import LoginScreen from './components/LoginScreen';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  orderBy, 
  onSnapshot,
  runTransaction
} from 'firebase/firestore';

// Helper to strip undefined values so Firestore doesn't crash on saving/updating
const cleanUndefined = (obj: any): any => {
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        newObj[key] = cleanUndefined(obj[key]);
      } else {
        newObj[key] = obj[key];
      }
    }
  });
  return newObj;
};

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
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: number;
}

interface Expense {
  id: string;
  timestamp: number;
  amount: number;
  category: string; // 'Labor Bill' | 'Transport/Van Rent' | 'Electricity' | 'Other'
  description: string;
  createdBy: string;
}

interface Note {
  id: string;
  timestamp: number;
  title: string;
  content: string;
}

type Tab = 'home' | 'calculator' | 'history' | 'expenses' | 'note' | 'assistant' | 'settings' | 'billing';
type DateFilter = 'today' | 'yesterday' | '7days' | '1month' | 'custom';

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

interface CopyConfig {
  sellerName: boolean;
  challanNo: boolean;
  getEntryNo: boolean;
  totalWeight: boolean;
  deduction: boolean;
  netWeight: boolean;
  rate: boolean;
  totalPrice: boolean;
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
  const [activeTab, setActiveTab] = useState<Tab>('calculator');
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [defaultChallan, setDefaultChallan] = useState<number>(601);
  const [masterChallanNo, setMasterChallanNo] = useState<number | null>(null);
  const [adminStartingChallanInput, setAdminStartingChallanInput] = useState<string>('');
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [cashBoxBalance, setCashBoxBalance] = useState<number>(0);
  const [cashLedger, setCashLedger] = useState<any[]>([]);

  // Firebase Authentication & Role state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'guest' | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('Guest');
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const lastSpokenId = useRef<string | null>(null);

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

  // Copy Option On/Off Settings
  const [copyConfig, setCopyConfig] = useState<CopyConfig>({
    sellerName: true,
    challanNo: true,
    getEntryNo: true,
    totalWeight: true,
    deduction: true,
    netWeight: true,
    rate: true,
    totalPrice: true
  });

  // State-driven safe browser-free confirmation modal (to support iframe-sandboxed environments)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    isDanger: false,
    onConfirm: () => {},
  });

  // Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthLoading(true);
        console.log("User UID:", user.uid);
        setCurrentUserEmail(user.email);
        try {
          // Fetch role from Firestore "users" collection
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          let role: 'admin' | 'guest' = 'guest';
          let displayName = user.email ? user.email.split('@')[0] : 'Operator';
          
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            role = data.role === 'admin' ? 'admin' : 'guest';
            if (data.name) displayName = data.name;
          } else {
            // Seed a default document in case of manual account setups
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              name: displayName,
              role: 'guest',
              createdAt: Date.now()
            });
          }
          
          console.log("Fetched Role:", role);
          
          setUserRole(role);
          setCurrentUser(displayName);
          
          // Role-Based Routing
          if (role === 'admin') {
            setActiveTab('home'); // Admin Dashboard
          } else {
            setActiveTab('calculator'); // Daily Calculation Entry screen
          }
          
          // ONLY set firebaseUser after the document is fully read and tab is routed!
          setFirebaseUser(user);
        } catch (err) {
          console.error("Error fetching user role document: ", err);
          const fallbackRole = 'guest';
          console.log("Fetched Role:", fallbackRole);
          setUserRole(fallbackRole);
          setCurrentUser(user.email ? user.email.split('@')[0] : 'Guest');
          setActiveTab('calculator');
          setFirebaseUser(user);
        } finally {
          setAuthLoading(false);
        }
      } else {
        setUserRole(null);
        setCurrentUser('Guest');
        setCurrentUserEmail(null);
        setActiveTab('calculator');
        setFirebaseUser(null);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to calculations collection in Firestore in real-time
  useEffect(() => {
    if (!firebaseUser) {
      setCalculations([]);
      return;
    }

    const q = query(collection(db, 'calculations'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Calculation[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...docSnap.data(), id: docSnap.id } as Calculation);
      });
      const sorted = recalculateDailySequences(list);
      setCalculations(sorted);

      // Trigger Bengali TTS speech for the newest calculated entry safely
      if (sorted.length > 0) {
        const latest = sorted[0];
        const isRecent = (Date.now() - latest.timestamp) < 10000; // within 10 seconds
        if (isRecent && latest.id !== lastSpokenId.current && latest.getEntryNo) {
          lastSpokenId.current = latest.id;
          speakGetEntryBengali(latest.getEntryNo);
        }
      }
    }, (error) => {
      console.error("Firestore calculations sub error: ", error);
    });

    return () => unsubscribe();
  }, [firebaseUser, userRole]);

  // Subscribe to expenses collection in Firestore in real-time
  useEffect(() => {
    if (!firebaseUser) {
      setExpenses([]);
      return;
    }

    const q = query(collection(db, 'expenses'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Expense[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...docSnap.data(), id: docSnap.id } as Expense);
      });
      setExpenses(list);
    }, (error) => {
      console.error("Firestore expenses sub error: ", error);
    });

    return () => unsubscribe();
  }, [firebaseUser, userRole]);

  // Subscribe to Cash Box balance in Firestore in real-time
  useEffect(() => {
    if (!firebaseUser) {
      setCashBoxBalance(0);
      return;
    }

    const docRef = doc(db, 'settings', 'cashbox');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setCashBoxBalance(docSnap.data().balance || 0);
      } else {
        setCashBoxBalance(0);
      }
    }, (error) => {
      console.error("Firestore cashbox sub error: ", error);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Subscribe to Master Counter (Challan No) in Firestore in real-time
  useEffect(() => {
    if (!firebaseUser) {
      setMasterChallanNo(null);
      return;
    }

    const docRef = doc(db, 'settings', 'master_counters');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const val = docSnap.data().currentChallanNo;
        setMasterChallanNo(val !== undefined ? val : null);
      } else {
        setMasterChallanNo(null);
      }
    }, (error) => {
      console.error("Firestore master_counters sub error: ", error);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Subscribe to cash transactions ledger in Firestore in real-time
  useEffect(() => {
    if (!firebaseUser) {
      setCashLedger([]);
      return;
    }

    const q = query(collection(db, 'cash_ledger'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...docSnap.data(), id: docSnap.id });
      });
      setCashLedger(list);
    }, (error) => {
      console.error("Firestore cash_ledger sub error: ", error);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Load Persisted Data
  useEffect(() => {
    const savedNotes = localStorage.getItem('as_enterprise_notes');
    const savedChallan = localStorage.getItem('as_enterprise_default_challan');
    const savedLang = localStorage.getItem('as_enterprise_lang');
    const savedVisibility = localStorage.getItem('as_enterprise_receipt_visibility');
    const savedCopyConfig = localStorage.getItem('as_enterprise_copy_config');
    const savedTheme = localStorage.getItem('as_enterprise_theme');

    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedChallan) setDefaultChallan(parseInt(savedChallan) || 601);
    if (savedLang) setLanguage(savedLang as 'bn' | 'en');
    if (savedVisibility) setReceiptVisibility(JSON.parse(savedVisibility));
    if (savedCopyConfig) setCopyConfig(JSON.parse(savedCopyConfig));

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

  useEffect(() => {
    localStorage.setItem('as_enterprise_notes', JSON.stringify(notes));
  }, [notes]);

  const expectedNextChallan = useMemo(() => {
    if (masterChallanNo !== null && masterChallanNo !== undefined) {
      return masterChallanNo + 1;
    }
    const active = calculations.filter(c => c.isDeleted !== true);
    if (active.length === 0) {
      return defaultChallan;
    }
    const latest = active[0];
    return (latest.challanNo !== undefined ? latest.challanNo : defaultChallan) + 1;
  }, [masterChallanNo, calculations, defaultChallan]);

  // --- Handlers ---

  const addCalculation = async (calc: Omit<Calculation, 'createdBy'>): Promise<number | false> => {
    try {
      const newCalc = cleanUndefined({
        ...calc,
        createdBy: currentUserEmail || currentUser || 'Guest',
        createdByName: currentUser || 'Operator'
      });
      
      const deductAmount = parseFloat(newCalc.totalPrice.toFixed(2));
      let assignedChallanNo = expectedNextChallan;
      
      // Perform atomic transaction
      await runTransaction(db, async (transaction) => {
        // READ 1: cashbox balance
        const cashboxDocRef = doc(db, 'settings', 'cashbox');
        const cashboxSnap = await transaction.get(cashboxDocRef);
        
        // READ 2: master counters
        const masterCounterDocRef = doc(db, 'settings', 'master_counters');
        const masterCounterSnap = await transaction.get(masterCounterDocRef);
        
        // Computations
        let currentBalance = 0;
        if (cashboxSnap.exists()) {
          currentBalance = cashboxSnap.data().balance || 0;
        }

        if (deductAmount > currentBalance) {
          throw new Error("INSUFFICIENT_CASHBOX_BALANCE");
        }

        const nextBalance = parseFloat((currentBalance - deductAmount).toFixed(2));
        
        // Dynamically increment or initialize currentChallanNo
        let assigned = expectedNextChallan;
        if (masterCounterSnap.exists() && masterCounterSnap.data().currentChallanNo !== undefined) {
          assigned = (masterCounterSnap.data().currentChallanNo || 0) + 1;
        } else {
          // If not initialized, fallback to current expected next
          assigned = expectedNextChallan;
        }
        assignedChallanNo = assigned;

        // NOW perform all writes safely:
        
        // 1. Update the cashbox balance
        transaction.set(cashboxDocRef, {
          balance: nextBalance,
          lastUpdated: Date.now(),
          lastUpdatedBy: currentUserEmail || currentUser || 'Guest'
        }, { merge: true });

        // 2. Update the master counter document
        transaction.set(masterCounterDocRef, {
          currentChallanNo: assignedChallanNo,
          lastUpdated: Date.now(),
          lastUpdatedBy: currentUserEmail || currentUser || 'Guest'
        }, { merge: true });

        // 3. Add the calculation to Firestore with the final atomic challanNo
        const newCalcId = calc.id || Math.random().toString(36).substr(2, 9);
        const calcDocRef = doc(collection(db, 'calculations'), newCalcId);
        transaction.set(calcDocRef, {
          ...newCalc,
          id: newCalcId,
          challanNo: assignedChallanNo
        });

        // 4. Add to the cash ledger
        const ledgerId = Math.random().toString(36).substr(2, 9);
        const ledgerDocRef = doc(collection(db, 'cash_ledger'), ledgerId);
        transaction.set(ledgerDocRef, {
          id: ledgerId,
          timestamp: Date.now(),
          type: 'debit',
          amount: deductAmount,
          balanceAfter: nextBalance,
          description: language === 'bn' 
            ? `চালান নং #${assignedChallanNo} তৈরি - অপারেটর: ${newCalc.createdByName}`
            : `Challan #${assignedChallanNo} Created - Operator: ${newCalc.createdByName}`,
          challanNo: assignedChallanNo,
          operatorName: newCalc.createdByName,
          createdBy: currentUserEmail || currentUser || 'Guest'
        });
      });

      return assignedChallanNo;
    } catch (err: any) {
      console.error("Error adding calculation document: ", err);
      if (err.message === "INSUFFICIENT_CASHBOX_BALANCE") {
        alert(language === 'bn' 
          ? 'সীমাবদ্ধ ক্যাশ ব্যালেন্স! হিসাবটি সেভ করা ব্লক করা হয়েছে। অনুগ্রহ করে এডমিনকে ক্যাশ বক্স রিফিল করতে বলুন।' 
          : 'Insufficient Cash Balance! Entry blocked. Ask Admin to refill the Cash Box.');
      } else {
        alert(language === 'bn' ? 'ডাটাবেজে সেভ করতে ত্রুটি হয়েছে!' : 'Error saving to database: ' + err.message);
      }
      return false;
    }
  };

  const deleteCalculation = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'bn' ? 'মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Deletion',
      message: language === 'bn' ? 'আপনি কি এই হিসাবের রেকর্ডটি মুছে ফেলতে চান (ট্র্যাশ বক্সে যাবে)?' : 'Are you sure you want to delete this record (it will move to Trash Box)?',
      confirmText: language === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete',
      cancelText: language === 'bn' ? 'বাতিল' : 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        try {
          const deletedByVal = currentUserEmail || (firebaseUser ? firebaseUser.uid : 'Guest');
          const deletedByNameVal = currentUser || 'Operator';
          
          await runTransaction(db, async (transaction) => {
            const calcDocRef = doc(db, 'calculations', id);
            const calcSnap = await transaction.get(calcDocRef);
            
            if (!calcSnap.exists()) {
              throw new Error("CALCULATION_NOT_FOUND");
            }
            
            const calcData = calcSnap.data() as Calculation;
            
            // Read cashbox data BEFORE performing any writes!
            const cashboxDocRef = doc(db, 'settings', 'cashbox');
            const cashboxSnap = await transaction.get(cashboxDocRef);
            
            // NOW perform all writes safely:
            
            // 1. Soft delete the calculation
            transaction.update(calcDocRef, {
              isDeleted: true,
              deletedBy: deletedByVal,
              deletedAt: Date.now()
            });

            // 2. If it wasn't already deleted, refund the amount
            if (!calcData.isDeleted) {
              const refundAmount = parseFloat((calcData.totalPrice || 0).toFixed(2));
              
              let currentBalance = 0;
              if (cashboxSnap.exists()) {
                currentBalance = cashboxSnap.data().balance || 0;
              }
              
              const nextBalance = parseFloat((currentBalance + refundAmount).toFixed(2));
              
              transaction.set(cashboxDocRef, {
                balance: nextBalance,
                lastUpdated: Date.now(),
                lastUpdatedBy: deletedByVal
              }, { merge: true });

              // 3. Add log in the ledger
              const ledgerId = Math.random().toString(36).substr(2, 9);
              const ledgerDocRef = doc(collection(db, 'cash_ledger'), ledgerId);
              transaction.set(ledgerDocRef, {
                id: ledgerId,
                timestamp: Date.now(),
                type: 'credit',
                amount: refundAmount,
                balanceAfter: nextBalance,
                description: language === 'bn'
                  ? `চালান নং #${calcData.challanNo} ডিলিট (রিফান্ড) - ডিলিট করেছেন: ${deletedByNameVal}`
                  : `Challan #${calcData.challanNo} Deleted (Refunded) - Deleted by: ${deletedByNameVal}`,
                challanNo: calcData.challanNo,
                operatorName: deletedByNameVal,
                createdBy: deletedByVal
              });
            }
          });
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          console.error("Error deleting doc: ", err);
          alert(language === 'bn' ? 'রেকর্ডটি ডিলিট করতে সমস্যা হয়েছে!' : 'Error deleting record: ' + err.message);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const restoreCalculation = async (id: string) => {
    try {
      const restoredByVal = currentUserEmail || (firebaseUser ? firebaseUser.uid : 'Guest');
      const restoredByNameVal = currentUser || 'Operator';

      await runTransaction(db, async (transaction) => {
        const calcDocRef = doc(db, 'calculations', id);
        const calcSnap = await transaction.get(calcDocRef);
        
        if (!calcSnap.exists()) {
          throw new Error("CALCULATION_NOT_FOUND");
        }
        
        const calcData = calcSnap.data() as Calculation;
        
        // Read cashbox data BEFORE performing any writes!
        const cashboxDocRef = doc(db, 'settings', 'cashbox');
        const cashboxSnap = await transaction.get(cashboxDocRef);
        
        // NOW perform all writes safely:
        
        // 1. Restore the calculation
        transaction.update(calcDocRef, {
          isDeleted: false,
          deletedBy: null,
          deletedAt: null
        });

        // 2. If it was indeed deleted, deduct the amount again
        if (calcData.isDeleted) {
          const deductAmount = parseFloat((calcData.totalPrice || 0).toFixed(2));
          
          let currentBalance = 0;
          if (cashboxSnap.exists()) {
            currentBalance = cashboxSnap.data().balance || 0;
          }

          if (deductAmount > currentBalance) {
            throw new Error("INSUFFICIENT_CASHBOX_BALANCE");
          }
          
          const nextBalance = parseFloat((currentBalance - deductAmount).toFixed(2));
          
          transaction.set(cashboxDocRef, {
            balance: nextBalance,
            lastUpdated: Date.now(),
            lastUpdatedBy: restoredByVal
          }, { merge: true });

          // 3. Add log in the ledger
          const ledgerId = Math.random().toString(36).substr(2, 9);
          const ledgerDocRef = doc(collection(db, 'cash_ledger'), ledgerId);
          transaction.set(ledgerDocRef, {
            id: ledgerId,
            timestamp: Date.now(),
            type: 'debit',
            amount: deductAmount,
            balanceAfter: nextBalance,
            description: language === 'bn'
              ? `চালান নং #${calcData.challanNo} পুনরুদ্ধার (পুনরায় কাটা হল) - অপারেটর: ${restoredByNameVal}`
              : `Challan #${calcData.challanNo} Restored (Re-deducted) - Operator: ${restoredByNameVal}`,
            challanNo: calcData.challanNo,
            operatorName: restoredByNameVal,
            createdBy: restoredByVal
          });
        }
      });
    } catch (err: any) {
      console.error("Error restoring doc: ", err);
      if (err.message === "INSUFFICIENT_CASHBOX_BALANCE") {
        alert(language === 'bn' 
          ? 'সীমাবদ্ধ ক্যাশ ব্যালেন্স! রেকর্ডটি পুনরুদ্ধার করা ব্লক করা হয়েছে।' 
          : 'Insufficient Cash Balance! Restoring this record was blocked due to low cash box.');
      } else {
        alert(language === 'bn' ? 'রেকর্ডটি পুনরুদ্ধার করতে সমস্যা হয়েছে!' : 'Error restoring record: ' + err.message);
      }
    }
  };

  const permanentDeleteCalculation = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'bn' ? 'চিরতরে মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Permanent Deletion',
      message: language === 'bn' ? 'আপনি কি চিরতরে এই রেকর্ডটি ডিলিট করতে চান? এটি আর কোনোভাবেই পুনরুদ্ধার করা যাবে না!' : 'Are you sure you want to PERMANENTLY delete this record? This action is IRREVERSIBLE!',
      confirmText: language === 'bn' ? 'হ্যাঁ, চিরতরে মুছুন' : 'Yes, Delete Permanently',
      cancelText: language === 'bn' ? 'বাতিল' : 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'calculations', id));
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          alert(language === 'bn' ? 'হিসাবটি সফলভাবে চিরতরে ডিলিট করা হয়েছে!' : 'Record permanently deleted successfully!');
        } catch (err: any) {
          console.error("Error permanently deleting doc: ", err);
          alert(language === 'bn' ? 'চিরতরে ডিলিট করতে সমস্যা হয়েছে!' : 'Error permanently deleting record: ' + err.message);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const topUpCashBox = async (amount: number): Promise<boolean> => {
    try {
      const topUpByVal = currentUserEmail || (firebaseUser ? firebaseUser.uid : 'Guest');
      const topUpByNameVal = currentUser || 'Admin';

      await runTransaction(db, async (transaction) => {
        const cashboxDocRef = doc(db, 'settings', 'cashbox');
        const cashboxSnap = await transaction.get(cashboxDocRef);
        
        let currentBalance = 0;
        if (cashboxSnap.exists()) {
          currentBalance = cashboxSnap.data().balance || 0;
        }
        
        const nextBalance = parseFloat((currentBalance + amount).toFixed(2));
        
        transaction.set(cashboxDocRef, {
          balance: nextBalance,
          lastUpdated: Date.now(),
          lastUpdatedBy: topUpByVal
        }, { merge: true });

        // Add credit log in the ledger
        const ledgerId = Math.random().toString(36).substr(2, 9);
        const ledgerDocRef = doc(collection(db, 'cash_ledger'), ledgerId);
        transaction.set(ledgerDocRef, {
          id: ledgerId,
          timestamp: Date.now(),
          type: 'credit',
          amount: amount,
          balanceAfter: nextBalance,
          description: language === 'bn'
            ? `এডমিন কর্তৃক ব্যালেন্স রিফিল (${amount.toLocaleString()} TK)`
            : `Balance Refilled by Admin (${amount.toLocaleString()} TK)`,
          createdBy: topUpByVal,
          operatorName: topUpByNameVal
        });
      });
      return true;
    } catch (err: any) {
      console.error("Error topping up cash box: ", err);
      alert(language === 'bn' ? 'ব্যালেন্স টপ-আপ করতে সমস্যা হয়েছে!' : 'Error topping up cash box: ' + err.message);
      return false;
    }
  };

  const editCalculation = async (updated: Calculation) => {
    try {
      const { id, ...dataToUpdate } = updated;
      const cleanedData = cleanUndefined(dataToUpdate);
      await updateDoc(doc(db, 'calculations', id), cleanedData);
    } catch (err: any) {
      console.error("Error editing doc: ", err);
      alert(language === 'bn' ? 'রেকর্ডটি এডিট করতে সমস্যা হয়েছে!' : 'Error editing record: ' + err.message);
    }
  };

  const addExpense = async (exp: Omit<Expense, 'id' | 'timestamp' | 'createdBy'>): Promise<boolean> => {
    try {
      const newExp = cleanUndefined({
        ...exp,
        timestamp: Date.now(),
        createdBy: currentUserEmail || currentUser || 'Guest'
      });
      await addDoc(collection(db, 'expenses'), newExp);
      return true;
    } catch (err: any) {
      console.error("Error adding expense: ", err);
      alert(language === 'bn' ? 'খরচ সংরক্ষণ করতে সমস্যা হয়েছে!' : 'Error adding expense: ' + err.message);
      return false;
    }
  };

  const deleteExpense = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'bn' ? 'খরচ মুছে ফেলার নিশ্চিতকরণ' : 'Confirm Expense Deletion',
      message: language === 'bn' ? 'আপনি কি এই খরচের রেকর্ডটি চিরতরে মুছে ফেলতে চান?' : 'Are you sure you want to PERMANENTLY delete this expense?',
      confirmText: language === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete',
      cancelText: language === 'bn' ? 'বাতিল' : 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'expenses', id));
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          console.error("Error deleting expense: ", err);
          alert(language === 'bn' ? 'খরচ মুছতে সমস্যা হয়েছে!' : 'Error deleting expense: ' + err.message);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const addNote = (note: Note) => {
    setNotes([note, ...notes]);
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error("Sign out error: ", err);
    }
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

  // Copy config toggle handler
  const handleToggleCopyConfig = (key: keyof CopyConfig) => {
    const updated = { ...copyConfig, [key]: !copyConfig[key] };
    setCopyConfig(updated);
    localStorage.setItem('as_enterprise_copy_config', JSON.stringify(updated));
  };

  // --- Calculations Filter & Scope ---
  // If user role is "admin", they see all records. Otherwise they only see records they created!
  const scopedCalculations = useMemo(() => {
    const isUserAdmin = userRole === 'admin';
    const active = calculations.filter(c => c.isDeleted !== true);
    if (isUserAdmin) {
      return active;
    }
    // standard user only sees their own calculations
    return active.filter(c => c.createdBy === currentUserEmail || c.createdBy === currentUser);
  }, [calculations, userRole, currentUserEmail, currentUser]);

  const deletedCalculations = useMemo(() => {
    return calculations.filter(c => c.isDeleted === true);
  }, [calculations]);

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
      if (dateFilter === 'custom') {
        if (!customStartDate && !customEndDate) return true;
        const calcDate = new Date(calc.timestamp);
        const calcDateStr = calcDate.toISOString().split('T')[0];
        if (customStartDate && calcDateStr < customStartDate) return false;
        if (customEndDate && calcDateStr > customEndDate) return false;
        return true;
      }
      return true;
    });
  }, [scopedCalculations, dateFilter, customStartDate, customEndDate]);

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
    return filteredCalculations.reduce((acc, curr) => {
      const netKg = curr.isMinusCalculated && curr.deductedWeight !== undefined 
        ? Math.max(0, curr.totalKg - curr.deductedWeight) 
        : curr.totalKg;
      const actualBilledMon = netKg / curr.monType;
      const businessMon = netKg / 41; // 41 KG = 1 Mon business standard
      const gainMon = businessMon - actualBilledMon;
      const gainProfit = gainMon * curr.ratePerMon;

      return {
        totalKg: acc.totalKg + curr.totalKg,
        totalMon: acc.totalMon + curr.totalMon,
        totalPrice: acc.totalPrice + curr.totalPrice,
        totalBusinessMon: acc.totalBusinessMon + businessMon,
        weightGainProfit: acc.weightGainProfit + gainProfit
      };
    }, { totalKg: 0, totalMon: 0, totalPrice: 0, totalBusinessMon: 0, weightGainProfit: 0 });
  }, [filteredCalculations]);

  const filteredExpenses = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return expenses.filter(exp => {
      const diff = now - exp.timestamp;
      if (dateFilter === 'today') {
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        return exp.timestamp >= startOfDay;
      }
      if (dateFilter === 'yesterday') {
        const startOfYesterday = new Date().setHours(0, 0, 0, 0) - oneDay;
        const endOfYesterday = new Date().setHours(0, 0, 0, 0) - 1;
        return exp.timestamp >= startOfYesterday && exp.timestamp <= endOfYesterday;
      }
      if (dateFilter === '7days') return diff <= 7 * oneDay;
      if (dateFilter === '1month') return diff <= 30 * oneDay;
      if (dateFilter === 'custom') {
        if (!customStartDate && !customEndDate) return true;
        const expDate = new Date(exp.timestamp);
        const expDateStr = expDate.toISOString().split('T')[0];
        if (customStartDate && expDateStr < customStartDate) return false;
        if (customEndDate && expDateStr > customEndDate) return false;
        return true;
      }
      return true;
    });
  }, [expenses, dateFilter, customStartDate, customEndDate]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, curr) => sum + curr.amount, 0);
  }, [filteredExpenses]);

  const todayCalculationsCount = useMemo(() => {
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    return calculations.filter(c => c.timestamp >= startOfDay && c.isDeleted !== true).length;
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-yellow-400 font-black text-xs uppercase tracking-widest animate-pulse">
          {language === 'bn' ? 'অপেক্ষা করুন...' : 'Loading Session...'}
        </p>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <LoginScreen 
        language={language} 
        setLanguage={setLanguage} 
        onLoginSuccess={() => {}} 
      />
    );
  }

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
              {userRole === 'admin' && (
                <>
                  <NavButton label={t.home} active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
                  <NavButton label={language === 'bn' ? 'ডিপো খরচ' : 'Depot Expenses'} active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} />
                  <NavButton label={language === 'bn' ? 'বিলিং হিসাব' : 'Billing Ledger'} active={activeTab === 'billing'} onClick={() => setActiveTab('billing')} />
                </>
              )}
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
                  {userRole === 'admin' && (
                    <>
                      <option value="home">{t.home}</option>
                      <option value="expenses">{language === 'bn' ? 'ডিপো খরচ' : 'Depot Expenses'}</option>
                      <option value="billing">{language === 'bn' ? 'বিলিং হিসাব' : 'Billing Ledger'}</option>
                    </>
                  )}
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
              <HomeSection 
                stats={stats} 
                dateFilter={dateFilter} 
                setDateFilter={setDateFilter} 
                customStartDate={customStartDate}
                setCustomStartDate={setCustomStartDate}
                customEndDate={customEndDate}
                setCustomEndDate={setCustomEndDate}
                t={t} 
                todayCount={todayCalculationsCount} 
                language={language} 
                calculations={searchedCalculations}
                allCalculations={scopedCalculations}
                deletedCalculations={deletedCalculations}
                onDelete={deleteCalculation}
                onEdit={editCalculation}
                onRestore={restoreCalculation}
                onPermanentDelete={permanentDeleteCalculation}
                userRole={userRole}
                totalExpenses={totalExpenses}
                handleExportCSV={handleExportCSV}
                cashBoxBalance={cashBoxBalance}
                cashLedger={cashLedger}
                onTopUp={topUpCashBox}
              />
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
                copyConfig={copyConfig}
                cashBoxBalance={cashBoxBalance}
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
          {activeTab === 'billing' && (
            <motion.div key="billing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BillingSection 
                calculations={calculations}
                language={language}
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

                  <div className="space-y-4 bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-850">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">
                      {language === 'bn' ? 'কপি অপশন কন্টেন্ট সেটিংস (Copy Options)' : 'Copy Text Visibility Controls'}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <VisibilityToggle 
                        label={language === 'bn' ? 'বিক্রেতার নাম (Seller Name)' : 'Seller Name'} 
                        value={copyConfig.sellerName} 
                        onChange={() => handleToggleCopyConfig('sellerName')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'চালান নম্বর (Challan No)' : 'Challan No'} 
                        value={copyConfig.challanNo} 
                        onChange={() => handleToggleCopyConfig('challanNo')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'গেট এন্ট্রি নম্বর (Get Entry No)' : 'Get Entry No'} 
                        value={copyConfig.getEntryNo} 
                        onChange={() => handleToggleCopyConfig('getEntryNo')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'মোট ওজন (Total Weight)' : 'Total Weight'} 
                        value={copyConfig.totalWeight} 
                        onChange={() => handleToggleCopyConfig('totalWeight')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'ওজন কর্তন (Deducted Weight)' : 'Deducted Weight'} 
                        value={copyConfig.deduction} 
                        onChange={() => handleToggleCopyConfig('deduction')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'নিট ওজন (Net Weight)' : 'Net Weight'} 
                        value={copyConfig.netWeight} 
                        onChange={() => handleToggleCopyConfig('netWeight')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'দর প্রতি মণ (Rate / Mon)' : 'Rate / Mon'} 
                        value={copyConfig.rate} 
                        onChange={() => handleToggleCopyConfig('rate')} 
                      />
                      <VisibilityToggle 
                        label={language === 'bn' ? 'মোট মূল্য (Total Price)' : 'Total Price'} 
                        value={copyConfig.totalPrice} 
                        onChange={() => handleToggleCopyConfig('totalPrice')} 
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

                  {/* Centralized Master Counter Setting for Admin Only */}
                  {userRole === 'admin' && (
                    <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30 max-w-xl space-y-4">
                      <h3 className="text-sm font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-wider mb-2">
                         {language === 'bn' ? 'সেন্ট্রাল অটো-ইনক্রিমেন্ট চালান নাম্বার (শুধুমাত্র এডমিন)' : 'Centralized Master Counter Setup (Admin Only)'}
                      </h3>
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                        {language === 'bn' 
                          ? 'ডাটাবেজের প্রধান সিরিয়াল কাউন্টারটি এখান থেকে শুরু বা পরিবর্তন করতে পারবেন। যেমন: ১০০০ বা ১০০০০ নির্ধারণ করলে পরবর্তী চালান সিরিয়াল ক্রমান্বয়ে বৃদ্ধি পাবে।' 
                          : 'Set or bootstrap the centralized sequence counter in Firestore. New saves atomically increment this Master Challan.'}
                      </p>
                      
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-md border border-indigo-100 dark:border-indigo-950 flex items-center justify-between text-xs font-black">
                        <span className="text-slate-500">{language === 'bn' ? 'ডাটাবেজে বর্তমান সর্বশেষ চালান নং:' : 'Current Master Counter in DB:'}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 text-sm">
                          {masterChallanNo !== null ? `#${masterChallanNo}` : (language === 'bn' ? 'অনির্ধারিত' : 'Not Initialized')}
                        </span>
                      </div>

                      <div className="flex gap-2 max-w-md items-end">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 mb-1 block">
                            {language === 'bn' ? 'নতুন মাস্টার চালান নং শুরু' : 'New Starting Master Challan'}
                          </label>
                          <input 
                            type="number" 
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-sm font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                            value={adminStartingChallanInput}
                            placeholder={masterChallanNo !== null ? masterChallanNo.toString() : "e.g. 1000"}
                            onChange={e => setAdminStartingChallanInput(e.target.value)}
                          />
                        </div>
                        <button
                          onClick={async () => {
                            const val = parseInt(adminStartingChallanInput);
                            if (isNaN(val) || val < 0) {
                              alert(language === 'bn' ? 'অনুগ্রহ করে একটি সঠিক সংখ্যা দিন!' : 'Please enter a valid positive number!');
                              return;
                            }
                            if (confirm(language === 'bn' ? `আপনি কি প্রধান চালান নম্বরটি পরিবর্তন করে ${val} করতে চান?` : `Are you sure you want to set the Master Counter to ${val}?`)) {
                              try {
                                const docRef = doc(db, 'settings', 'master_counters');
                                await setDoc(docRef, {
                                  currentChallanNo: val,
                                  lastUpdated: Date.now(),
                                  lastUpdatedBy: currentUserEmail || currentUser || 'Admin'
                                }, { merge: true });
                                alert(language === 'bn' ? 'মাস্টার চালান নাম্বারটি সফলভাবে আপডেট করা হয়েছে!' : 'Master counter successfully updated in Firestore!');
                                setAdminStartingChallanInput('');
                              } catch (err: any) {
                                console.error("Error setting master counter: ", err);
                                alert(language === 'bn' ? 'আপডেট করতে সমস্যা হয়েছে: ' + err.message : 'Error updating master counter: ' + err.message);
                              }
                            }
                          }}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded uppercase tracking-wider transition-all"
                        >
                          {language === 'bn' ? 'সেট করুন' : 'Set Master'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-4">
                    <button 
                      onClick={() => { if(confirm('Clear all stored business calculations, credentials and logs?')) { localStorage.clear(); window.location.reload(); } }}
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded uppercase tracking-wider transition-all"
                    >
                      {language === 'bn' ? 'সমগ্র সফটওয়্যার রিসেট করুন' : 'Reset System Database'}
                    </button>
                  </div>
                </div>

                {/* Operator Session Info Panel */}
                <div className="w-full lg:w-96 bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-850 space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="text-yellow-600 dark:text-yellow-500" size={20} />
                    <h3 className="text-md font-black text-slate-800 dark:text-slate-100">
                      {language === 'bn' ? 'ইউজার সেশন প্রোফাইল' : 'User Session Profile'}
                    </h3>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                    <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider">
                      {language === 'bn' ? 'লগইনকৃত ইউজার:' : 'Authenticated Operator:'}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-yellow-400 flex items-center justify-center text-white font-black text-base">
                        {currentUser.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-sm text-slate-800 dark:text-slate-100">{currentUser}</p>
                        <p className="text-[10px] text-slate-500 font-bold max-w-[150px] truncate">{currentUserEmail}</p>
                        <p className="text-[9px] text-yellow-600 dark:text-yellow-400 font-black uppercase tracking-widest bg-yellow-50 dark:bg-yellow-950/40 px-2 py-0.5 rounded border border-yellow-100 dark:border-yellow-900/30 inline-block mt-1">
                          {userRole === 'admin' ? (language === 'bn' ? 'এডমিন (ADMIN)' : 'ADMIN ROLE') : (language === 'bn' ? 'অপারেটর (GUEST)' : 'GUEST ROLE')}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                        {language === 'bn' ? 'সকল চালানের হিসাব ক্লাউডে সংরক্ষিত' : 'Logs secured on cloud'}
                      </p>
                      <button 
                        onClick={handleLogout}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900 text-red-700 text-[10px] font-black uppercase rounded tracking-wider transition-all"
                      >
                        {language === 'bn' ? 'লগআউট' : 'Sign Out'}
                      </button>
                    </div>
                  </div>
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

      {/* Custom Confirmation Modal Overlay */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans no-print animate-fade-in">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full shrink-0 ${confirmDialog.isDanger ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400'}`}>
                <Trash2 size={20} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold font-sans">
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 text-white rounded text-xs font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95 shadow-md ${
                  confirmDialog.isDanger 
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/10' 
                    : 'bg-yellow-500 hover:bg-yellow-600 text-slate-950 shadow-yellow-500/10'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
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

// --- Home ---

interface HomeSectionProps {
  stats: any;
  dateFilter: DateFilter;
  setDateFilter: (f: DateFilter) => void;
  customStartDate: string;
  setCustomStartDate: (v: string) => void;
  customEndDate: string;
  setCustomEndDate: (v: string) => void;
  t: any;
  todayCount: number;
  language: 'bn' | 'en';
  calculations: Calculation[];
  allCalculations: Calculation[];
  deletedCalculations: Calculation[];
  onDelete: (id: string) => void;
  onEdit: (updated: Calculation) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  userRole: 'admin' | 'guest' | null;
  totalExpenses: number;
  handleExportCSV: () => void;
  cashBoxBalance: number;
  cashLedger: any[];
  onTopUp: (amount: number) => Promise<boolean>;
}

function HomeSection({ 
  stats, 
  dateFilter, 
  setDateFilter, 
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  t, 
  todayCount, 
  language,
  calculations = [],
  allCalculations = [],
  deletedCalculations = [],
  onDelete,
  onEdit,
  onRestore,
  onPermanentDelete,
  userRole,
  totalExpenses,
  handleExportCSV,
  cashBoxBalance,
  cashLedger = [],
  onTopUp
}: HomeSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'trash' | 'cashLedger'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCalc, setEditingCalc] = useState<Calculation | null>(null);
  const [memoCalc, setMemoCalc] = useState<Calculation | null>(null);
  const [buyerName, setBuyerName] = useState<string>('');
  const [operatorFilter, setOperatorFilter] = useState('ALL');

  // Compute unique operators
  const operators = useMemo(() => {
    const list = new Set<string>();
    allCalculations.forEach(c => {
      if (c.createdBy) list.add(c.createdBy);
      else list.add('Guest');
    });
    return Array.from(list);
  }, [allCalculations]);

  // Filter calculations based on local search query & operator filter
  const filteredList = useMemo(() => {
    return calculations.filter(calc => {
      const createdByVal = calc.createdBy || 'Guest';
      const matchesOperator = operatorFilter === 'ALL' || createdByVal.toLowerCase() === operatorFilter.toLowerCase();
      
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        calc.sellerName.toLowerCase().includes(query) || 
        (calc.challanNo !== undefined && calc.challanNo.toString().includes(query));
        
      return matchesOperator && matchesSearch;
    });
  }, [calculations, searchQuery, operatorFilter]);

  // Filter deleted calculations based on search query
  const filteredDeletedList = useMemo(() => {
    return deletedCalculations.filter(calc => {
      const query = searchQuery.toLowerCase().trim();
      return !query || 
        calc.sellerName.toLowerCase().includes(query) || 
        (calc.challanNo !== undefined && calc.challanNo.toString().includes(query));
    });
  }, [deletedCalculations, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Prominent Visual Header Banner for Admin Panel */}
      {userRole === 'admin' ? (
        <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-6 shadow-xl relative overflow-hidden">
          {/* Background brand accent lines */}
          <div className="absolute top-0 right-0 w-32 h-full bg-yellow-400 skew-x-12 opacity-10 translate-x-12"></div>
          <div className="absolute top-0 right-12 w-8 h-full bg-yellow-400 skew-x-12 opacity-5 translate-x-12"></div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 bg-yellow-400 text-slate-950 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded border border-yellow-300">
                <span>🛡️ SECURE ADMIN CONSOLE</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-yellow-400 tracking-tight font-sans">
                {language === 'bn' ? "এ. এস. এন্টারপ্রাইজ - এডমিন প্যানেল" : "A. S. Enterprise - Admin Panel"}
              </h1>
              <p className="text-xs text-slate-400 font-medium max-w-2xl leading-relaxed">
                {language === 'bn' 
                  ? "রিয়েল-টাইম অপারেশন লেজার, দৈনিক মোট গেট এন্ট্রি রূপান্তর, এবং অপারেটরদের কার্যক্রম পর্যবেক্ষণের সম্পূর্ণ নিয়ন্ত্রণ।"
                  : "Complete command of real-time operation ledgers, daily gate entry conversion volume, and authenticated operator activity tracker."}
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-lg shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
              <p className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                DATABASE: ACTIVE (FIREBASE)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">
            {t.summary}
          </h2>
        </div>
      )}

      {/* Date Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {language === 'bn' ? "লেজার ফিল্টারিং সময়কাল" : "LEGER DURATION FILTER"}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
            {language === 'bn' ? "সংক্ষিপ্ত ড্যাশবোর্ড পরিসংখ্যান" : "Real-time summary statistics"}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {userRole === 'admin' && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
              title={language === 'bn' ? 'এক্সেল ফাইল ডাউনলোড করুন' : 'Export current filtered data to Excel'}
            >
              <FileSpreadsheet size={12} />
              <span>{language === 'bn' ? 'এক্সপোর্ট এক্সেল' : 'Export Excel'}</span>
            </button>
          )}

          <div className="flex bg-white dark:bg-slate-900 p-1 rounded shadow-sm border border-slate-200 dark:border-slate-800">
            {(['today', 'yesterday', '7days', '1month', 'custom'] as DateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  dateFilter === f ? 'bg-yellow-400 text-black shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {f === 'today' ? (language === 'bn' ? 'আজ' : 'Today') 
                 : f === 'yesterday' ? (language === 'bn' ? 'গতকাল' : 'Yesterday') 
                 : f === '7days' ? (language === 'bn' ? '৭ দিন' : '7 Days') 
                 : f === '1month' ? (language === 'bn' ? '১ মাস' : '1 Month')
                 : (language === 'bn' ? 'কাস্টম মেয়াদ' : 'Custom Range')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Date Range Picker Inputs */}
      {dateFilter === 'custom' && (
        <div className="flex items-center flex-wrap gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 animate-fadeIn text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-500 dark:text-slate-400">{language === 'bn' ? 'শুরুর তারিখ:' : 'Start Date:'}</span>
            <input 
              type="date" 
              value={customStartDate} 
              onChange={(e) => setCustomStartDate(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-yellow-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-500 dark:text-slate-400">{language === 'bn' ? 'শেষের তারিখ:' : 'End Date:'}</span>
            <input 
              type="date" 
              value={customEndDate} 
              onChange={(e) => setCustomEndDate(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-bold px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 focus:ring-1 focus:ring-yellow-400 focus:outline-none"
            />
          </div>
          {(customStartDate || customEndDate) && (
            <button 
              onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
              className="px-3 py-1.5 text-[10px] font-black uppercase bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 transition-all cursor-pointer"
            >
              {language === 'bn' ? 'মুছে ফেলুন' : 'Clear Dates'}
            </button>
          )}
        </div>
      )}

      {/* Compact Stat Cards / ERP Stats Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <CompactStatCard label={t.totalKgLabel} value={stats.totalKg.toLocaleString()} unit="KG" bg="bg-white" />
        <CompactStatCard label={t.totalMonLabel} value={stats.totalMon.toFixed(2)} unit="MON" bg="bg-white" />
        <CompactStatCard label={t.totalPriceLabel} value={`৳${Math.round(stats.totalPrice).toLocaleString()}`} unit="BDT" bg="bg-yellow-400" text="text-black" />
        <CompactStatCard 
          label={language === 'bn' ? "আজকের মোট গেট এন্ট্রি" : "Today's Get Entries"} 
          value={language === 'bn' ? toBengaliDigits(todayCount) : todayCount.toString()} 
          unit={language === 'bn' ? "টি" : "ENTRIES"} 
          bg="bg-slate-900 text-yellow-400 dark:bg-slate-950 border-slate-800" 
          text="text-yellow-400" 
        />
        {userRole === 'admin' && (
          <>
            <CompactStatCard 
              label={language === 'bn' ? "ওজন রূপান্তর লাভ (৪১ কেজি/মন)" : "Weight Gain Profit (41 KG/Mon)"} 
              value={`৳${Math.round(stats.weightGainProfit).toLocaleString()}`} 
              unit="BDT" 
              bg="bg-emerald-600 border-emerald-500" 
              text="text-white" 
            />
            <CompactStatCard 
              label={language === 'bn' ? "মোট ডিপো খরচ" : "Total Depot Expenses"} 
              value={`৳${Math.round(totalExpenses).toLocaleString()}`} 
              unit="BDT" 
              bg="bg-rose-600 border-rose-500" 
              text="text-white" 
            />
            <CompactStatCard 
              label={language === 'bn' ? "নিট লাভ (বিক্রয় - খরচ)" : "Net Profit (Sales - Expenses)"} 
              value={`৳${Math.round(stats.totalPrice - totalExpenses).toLocaleString()}`} 
              unit="BDT" 
              bg="bg-indigo-600 border-indigo-500" 
              text="text-white" 
            />
          </>
        )}
      </div>

      {/* Admin Specific Operations Logs Table */}
      {userRole === 'admin' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mt-6 animate-fadeIn">
          {/* Sub Tab Switcher */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 gap-2">
            <button
              onClick={() => setActiveSubTab('active')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'active'
                  ? 'bg-yellow-400 text-black shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{language === 'bn' ? 'সক্রিয় হিসাবপত্র' : 'Active Calculations'}</span>
            </button>
            <button
              onClick={() => setActiveSubTab('trash')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'trash'
                  ? 'bg-rose-600 text-white shadow-sm font-black'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Trash2 size={13} />
              <span>{language === 'bn' ? 'ট্র্যাশ বক্স' : 'Trash Box'}</span>
              {deletedCalculations.length > 0 && (
                <span className="bg-white text-rose-600 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-rose-200 leading-none">
                  {deletedCalculations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubTab('cashLedger')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'cashLedger'
                  ? 'bg-slate-900 text-yellow-400 shadow-sm border border-slate-850 dark:bg-slate-950 dark:text-yellow-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>💵 {language === 'bn' ? 'ক্যাশ লেজার (অডিট)' : 'Cash Ledger (Audit)'}</span>
            </button>
          </div>

          {activeSubTab !== 'cashLedger' ? (
            <>
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
                    {activeSubTab === 'active' 
                      ? (language === 'bn' ? "দৈনিক চালান বিবরণ খাতা" : "Daily Calculations Table")
                      : (language === 'bn' ? "ট্র্যাশ বিন (মুছে ফেলা হিসাবসমূহ)" : "Trash Bin (Deleted Calculations)")}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                    {activeSubTab === 'active' 
                      ? `${filteredList.length} ${language === 'bn' ? 'টি রেকর্ড খুঁজে পাওয়া গেছে' : 'records found matching criteria'}`
                      : `${filteredDeletedList.length} ${language === 'bn' ? 'টি মুছে ফেলা রেকর্ড পাওয়া গেছে' : 'deleted records found'}`
                    }
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
                  placeholder={language === 'bn' ? "বিক্রেতা বা চালান নং" : "Search seller or challan..."}
                  className="w-full sm:w-44 bg-transparent border-none text-[10px] font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none p-0 h-full"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-black focus:outline-none"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Operator select filter (only for active calculations) */}
              {activeSubTab === 'active' && operators.length > 0 && (
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 h-8">
                  <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">{language === 'bn' ? 'অপারেটর' : 'Operator'}:</span>
                  <select
                    value={operatorFilter}
                    onChange={e => setOperatorFilter(e.target.value)}
                    className="text-[10px] font-black border-none bg-transparent dark:text-white outline-none cursor-pointer"
                  >
                    <option value="ALL">🌟 {language === 'bn' ? 'সব অপারেটর' : 'All Users'}</option>
                    {operators.map(op => (
                      <option key={op} value={op}>👤 {op}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {((activeSubTab === 'active' && filteredList.length === 0) || (activeSubTab === 'trash' && filteredDeletedList.length === 0)) ? (
            <div className="p-12 text-center text-slate-300 font-bold uppercase text-[10px]">
              {activeSubTab === 'active'
                ? (language === 'bn' ? "কোনো চালান পাওয়া যায়নি" : "No entries found matching criteria")
                : (language === 'bn' ? "ট্র্যাশ বক্স খালি!" : "Trash Box is empty!")
              }
            </div>
          ) : (
            <>
              {/* Mobile Card List View */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {activeSubTab === 'active' ? (
                  filteredList.map((calc) => {
                    const netKg = calc.isMinusCalculated && calc.deductedWeight !== undefined 
                      ? Math.max(0, calc.totalKg - calc.deductedWeight) 
                      : calc.totalKg;
                    const monCount = Math.floor(netKg / calc.monType);
                    const extraKg = parseFloat((netKg % calc.monType).toFixed(2));
                    return (
                      <div key={calc.id} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400">
                            📅 {new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded px-1.5 py-0.5 text-[10px]">
                              #{calc.challanNo !== undefined ? calc.challanNo : '---'}
                            </span>
                            {calc.getEntryNo !== undefined && (
                              <span className="font-black text-indigo-600 dark:text-indigo-450 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded px-1.5 py-0.5 text-[9px]">
                                {language === 'bn' ? `গেট এন্ট্রি ${toBengaliDigits(calc.getEntryNo)}` : `Get Entry ${calc.getEntryNo}`}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/50">
                          <div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'বিক্রেতার নাম' : 'Seller Name'}</div>
                            <div className="font-black text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-1 mt-0.5">
                              {calc.sellerName}
                              {calc.isMinusCalculated && (
                                <span className="inline-block text-[8px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded px-1 font-extrabold uppercase scale-90 origin-left">
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
                            <div className="font-bold text-slate-600 dark:text-slate-400 mt-0.5 text-xs">
                              {calc.totalKg} KG
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'রূপান্তরিত ওজন' : 'Converted Weight'}</div>
                            <div className="font-bold text-green-700 dark:text-green-400 mt-0.5 text-xs">
                              {monCount} M {extraKg} KG
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[9px] font-black uppercase text-slate-400">
                            👤 BY: {calc.createdBy || 'Guest'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => { setMemoCalc(calc); setBuyerName(''); }}
                              className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 border border-yellow-200 dark:border-yellow-900/30 px-3.5 py-1.5 rounded-lg font-black text-xs transition-all active:scale-95 cursor-pointer"
                              title={language === 'bn' ? 'মেমো তৈরি করুন' : 'Generate dispatch memo'}
                            >
                              <Printer size={12} />
                              <span>{language === 'bn' ? 'মেমো' : 'Memo'}</span>
                            </button>
                            <button 
                              onClick={() => setEditingCalc(calc)}
                              className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-900/30 px-3.5 py-1.5 rounded-lg font-black text-xs transition-all active:scale-95 cursor-pointer"
                            >
                              <Edit size={12} />
                              <span>{language === 'bn' ? 'সম্পাদনা' : 'Edit'}</span>
                            </button>
                            <button 
                              onClick={() => onDelete(calc.id)} 
                              className="flex items-center gap-1 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-900/30 px-3.5 py-1.5 rounded-lg font-black text-xs transition-all active:scale-95 cursor-pointer"
                            >
                              <Trash2 size={12} />
                              <span>{language === 'bn' ? 'মুছুন' : 'Delete'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  filteredDeletedList.map((calc) => {
                    const netKg = calc.isMinusCalculated && calc.deductedWeight !== undefined 
                      ? Math.max(0, calc.totalKg - calc.deductedWeight) 
                      : calc.totalKg;
                    const monCount = Math.floor(netKg / calc.monType);
                    const extraKg = parseFloat((netKg % calc.monType).toFixed(2));
                    return (
                      <div key={calc.id} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 bg-rose-50/10 dark:bg-rose-950/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400">
                            📅 {new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
                          </span>
                          <span className="font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded px-1.5 py-0.5 text-[10px] line-through">
                            #{calc.challanNo !== undefined ? calc.challanNo : '---'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/50">
                          <div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'বিক্রেতার নাম' : 'Seller Name'}</div>
                            <div className="font-black text-slate-400 line-through mt-0.5">{calc.sellerName}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'মোট মূল্য' : 'Total Price'}</div>
                            <div className="font-black text-slate-400 line-through mt-0.5 text-sm">৳{Math.round(calc.totalPrice).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{language === 'bn' ? 'মোট ওজন' : 'Total Weight'}</div>
                            <div className="font-bold text-slate-400 line-through mt-0.5 text-xs">{calc.totalKg} KG</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-rose-500 font-black uppercase tracking-wider">{language === 'bn' ? 'ডিলেট করেছেন' : 'Deleted By'}</div>
                            <div className="font-bold text-rose-600 dark:text-rose-400 mt-0.5 text-[10px] truncate">{calc.deletedBy || calc.createdBy || 'Unknown'}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button 
                            onClick={() => onRestore(calc.id)}
                            className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer active:scale-95"
                          >
                            <RotateCcw size={11} />
                            <span>{language === 'bn' ? 'পুনরুদ্ধার' : 'Restore'}</span>
                          </button>
                          <button 
                            onClick={() => onPermanentDelete(calc.id)} 
                            className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer active:scale-95"
                          >
                            <Trash2 size={11} />
                            <span>{language === 'bn' ? 'চিরতরে মুছুন' : 'Permanent'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Challan</th>
                      <th className="px-3 py-3">Seller</th>
                      <th className="px-3 py-3">Weight (KG)</th>
                      <th className="px-3 py-3">Mon</th>
                      <th className="px-3 py-3">Rate</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-3 py-3">{activeSubTab === 'active' ? 'Operator' : 'Deleted By'}</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeSubTab === 'active' ? (
                      filteredList.map((calc) => {
                        const netKg = calc.isMinusCalculated && calc.deductedWeight !== undefined 
                          ? Math.max(0, calc.totalKg - calc.deductedWeight) 
                          : calc.totalKg;
                        const monCount = Math.floor(netKg / calc.monType);
                        const extraKg = parseFloat((netKg % calc.monType).toFixed(2));
                        return (
                          <tr key={calc.id} className="text-[11px] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-800 dark:text-slate-200">
                            <td className="px-4 py-3 font-bold text-slate-400 whitespace-nowrap">
                              {new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
                            </td>
                            <td className="px-4 py-3 font-black text-rose-500 whitespace-nowrap">
                              <div>#{calc.challanNo !== undefined ? calc.challanNo : '---'}</div>
                              {calc.getEntryNo !== undefined && (
                                <div className="text-[9px] text-indigo-600 dark:text-indigo-450 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded px-1.5 py-0.5 inline-block font-black mt-1">
                                  {language === 'bn' ? `গেট এন্ট্রি ${toBengaliDigits(calc.getEntryNo)}` : `Get Entry ${calc.getEntryNo}`}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 font-black">
                              {calc.sellerName}
                              {calc.isMinusCalculated && (
                                <span className="ml-1.5 inline-block text-[9px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded px-1 font-extrabold uppercase">
                                  {language === 'bn' ? 'মাইনাস' : 'Minus'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-bold whitespace-nowrap">
                              <div>{calc.totalKg} KG</div>
                              {calc.isMinusCalculated && calc.deductedWeight !== undefined && (
                                <div className="text-[9px] bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-1.5 rounded mt-1 text-slate-500 dark:text-slate-450 font-semibold space-y-0.5 min-w-[130px]">
                                  <div>{language === 'bn' ? `মোট: ${toBengaliDigits(calc.totalKg)} কেজি` : `Total: ${calc.totalKg} KG`}</div>
                                  <div>{language === 'bn' ? `নিট ওজন: ${toBengaliDigits((calc.totalKg - calc.deductedWeight).toFixed(1))} কেজি` : `Net Wt: ${(calc.totalKg - calc.deductedWeight).toFixed(1)} KG`}</div>
                                  <div className="text-red-600 dark:text-red-400 font-black border-t border-rose-100 dark:border-rose-900/20 pt-0.5">{language === 'bn' ? `ব্যবধান: ${toBengaliDigits(calc.deductedWeight.toFixed(1))} কেজি` : `Difference: ${calc.deductedWeight.toFixed(1)} KG`}</div>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                              <div>{monCount} M {extraKg} KG</div>
                              {calc.isMinusCalculated && (
                                <div className="text-[9px] text-slate-455 font-bold">
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
                            <td className="px-4 py-3 font-black text-slate-900 dark:text-white">৳{Math.round(calc.totalPrice).toLocaleString()}</td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {calc.createdBy || 'Guest'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <button 
                                  onClick={() => { setMemoCalc(calc); setBuyerName(''); }}
                                  className="text-slate-400 hover:text-yellow-600 p-1.5 rounded hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                  title={language === 'bn' ? 'মেমো তৈরি করুন' : 'Generate dispatch memo'}
                                >
                                  <Printer size={13} />
                                </button>
                                <button 
                                  onClick={() => setEditingCalc(calc)}
                                  className="text-slate-400 hover:text-blue-600 p-1.5 rounded hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                  title={language === 'bn' ? 'সম্পাদনা করুন' : 'Edit record'}
                                >
                                  <Edit size={13} />
                                </button>
                                <button 
                                  onClick={() => onDelete(calc.id)} 
                                  className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50/80 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                  title={language === 'bn' ? 'মুছে ফেলুন' : 'Delete record'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      filteredDeletedList.map((calc) => {
                        const netKg = calc.isMinusCalculated && calc.deductedWeight !== undefined 
                          ? Math.max(0, calc.totalKg - calc.deductedWeight) 
                          : calc.totalKg;
                        const monCount = Math.floor(netKg / calc.monType);
                        const extraKg = parseFloat((netKg % calc.monType).toFixed(2));
                        return (
                          <tr key={calc.id} className="text-[11px] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-800 dark:text-slate-200">
                            <td className="px-4 py-3 font-bold text-slate-400 whitespace-nowrap">
                              {new Date(calc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
                            </td>
                            <td className="px-4 py-3 font-black text-rose-500 whitespace-nowrap">
                              <div>#{calc.challanNo !== undefined ? calc.challanNo : '---'}</div>
                              {calc.getEntryNo !== undefined && (
                                <div className="text-[9px] text-indigo-600 dark:text-indigo-450 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded px-1.5 py-0.5 inline-block font-black mt-1">
                                  {language === 'bn' ? `গেট এন্ট্রি ${toBengaliDigits(calc.getEntryNo)}` : `Get Entry ${calc.getEntryNo}`}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 font-black text-slate-450 line-through">
                              {calc.sellerName}
                              {calc.isMinusCalculated && (
                                <span className="ml-1.5 inline-block text-[9px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded px-1 font-extrabold uppercase">
                                  {language === 'bn' ? 'মাইনাস' : 'Minus'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-bold whitespace-nowrap text-slate-450 line-through">
                              <div>{calc.totalKg} KG</div>
                            </td>
                            <td className="px-3 py-3 font-bold text-slate-455 whitespace-nowrap line-through">
                              <div>{monCount} M {extraKg} KG</div>
                            </td>
                            <td className="px-3 py-3 text-slate-450 font-bold whitespace-nowrap line-through">
                              <div>৳{calc.ratePerMon}</div>
                            </td>
                            <td className="px-4 py-3 font-black text-slate-400 line-through">৳{Math.round(calc.totalPrice).toLocaleString()}</td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                                🗑️ {calc.deletedBy || calc.createdBy || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => onRestore(calc.id)}
                                  className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded text-[10px] font-black transition-all cursor-pointer shadow-sm active:scale-95"
                                  title={language === 'bn' ? 'পুনরুদ্ধার করুন' : 'Restore Record'}
                                >
                                  <RotateCcw size={10} />
                                  <span>{language === 'bn' ? 'পুনরুদ্ধার' : 'Restore'}</span>
                                </button>
                                <button 
                                  onClick={() => onPermanentDelete(calc.id)} 
                                  className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded text-[10px] font-black transition-all cursor-pointer shadow-sm active:scale-95"
                                  title={language === 'bn' ? 'চিরতরে মুছুন' : 'Delete Permanently'}
                                >
                                  <Trash2 size={10} />
                                  <span>{language === 'bn' ? 'চিরতরে' : 'Permanent'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="p-6 space-y-6">
              {/* Cash Box Controls Card */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="lg:col-span-5 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {language === 'bn' ? 'সেন্ট্রাল ক্যাশ বক্স বিবরণ' : 'CENTRAL CASH BOX OVERVIEW'}
                  </h4>
                  <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    ৳{cashBoxBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    {language === 'bn' ? 'রিয়েল-টাইম অটোমেটেড ক্যাশ বুক ব্যালেন্স' : 'Real-time automated cash book balance'}
                  </p>
                </div>

                <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 block">
                      {language === 'bn' ? 'ক্যাশ বক্স রিফিল / টাকা যোগ করুন (টাকা)' : 'REFILL CASH BOX / ADD FUNDS (TK)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                      <input
                        type="number"
                        placeholder="e.g. 20000"
                        className="w-full h-10 pl-7 pr-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none"
                        id="top-up-amount-input"
                      />
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const inputEl = document.getElementById('top-up-amount-input') as HTMLInputElement;
                      const amount = parseFloat(inputEl?.value || '0');
                      if (isNaN(amount) || amount <= 0) {
                        alert(language === 'bn' ? 'অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন!' : 'Please enter a valid positive amount!');
                        return;
                      }
                      const success = await onTopUp(amount);
                      if (success) {
                        if (inputEl) inputEl.value = '';
                        alert(language === 'bn' ? 'সফলভাবে ক্যাশ বক্সে টাকা যোগ করা হয়েছে!' : 'Successfully added funds to Cash Box!');
                      }
                    }}
                    className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>{language === 'bn' ? 'ফান্ড রিফিল করুন' : 'Add Funds / Top-Up'}</span>
                  </button>
                </div>
              </div>

              {/* Transaction Ledger Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
                  {language === 'bn' ? "ক্যাশ লেনদেন অডিট খাতা" : "CASH TRANSACTION AUDIT LEDGER"}
                </h3>
                
                {cashLedger.length === 0 ? (
                  <div className="text-center py-12 text-slate-300 font-bold uppercase text-[10px]">
                    {language === 'bn' ? 'কোনো লেনদেন রেকর্ড পাওয়া যায়নি!' : 'No transactions recorded yet!'}
                  </div>
                ) : (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                    {/* Mobile Ledger List View */}
                    <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                      {cashLedger.map((entry) => (
                        <div key={entry.id} className="p-4 space-y-2 hover:bg-slate-50/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-400">
                              {new Date(entry.timestamp).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              entry.type === 'credit'
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
                                : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600'
                            }`}>
                              {entry.type === 'credit' ? (language === 'bn' ? 'ক্রেডিট (+)' : 'CREDIT (+)') : (language === 'bn' ? 'ডেবিট (-)' : 'DEBIT (-)')}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {entry.description}
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                            <span>Amount: <strong className={entry.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}>৳{entry.amount.toFixed(2)}</strong></span>
                            <span>Balance After: <strong className="text-slate-700 dark:text-slate-300">৳{entry.balanceAfter.toFixed(2)}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Ledger Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                            <th className="px-4 py-3">Date & Time</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3 text-right">Balance After</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Initiated By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {cashLedger.map((entry) => (
                            <tr key={entry.id} className="text-[11px] hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-slate-800 dark:text-slate-200">
                              <td className="px-4 py-3 font-bold text-slate-400 whitespace-nowrap">
                                {new Date(entry.timestamp).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                  entry.type === 'credit'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
                                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600'
                                }`}>
                                  {entry.type === 'credit' ? (language === 'bn' ? 'ক্রেডিট (+)' : 'CREDIT (+)') : (language === 'bn' ? 'ডেবিট (-)' : 'DEBIT (-)')}
                                </span>
                              </td>
                              <td className={`px-4 py-3 font-black text-right whitespace-nowrap ${
                                entry.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {entry.type === 'credit' ? '+' : '-'}৳{entry.amount.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 font-black text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">
                                ৳{entry.balanceAfter.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                                {entry.description}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">
                                {entry.createdBy}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Local Edit Modal Overlay inside HomeSection for Admins */}
      {editingCalc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full overflow-hidden">
            <div className="bg-yellow-400 p-4 font-black flex justify-between items-center text-slate-950">
              <span className="text-xs uppercase tracking-wider">
                {language === 'bn' ? 'চালান সংশোধন করুন (অ্যাডমিন)' : 'Edit Challan Record (Admin)'}
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
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400 text-slate-900 dark:text-white"
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
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-medium outline-none focus:ring-1 focus:ring-yellow-400 text-slate-900 dark:text-white"
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
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400 text-slate-900 dark:text-white"
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
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400 text-slate-900 dark:text-white"
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
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400 cursor-pointer text-slate-900 dark:text-white"
                >
                  <option value={40}>40 KG</option>
                  <option value={41}>41 KG</option>
                  <option value={42}>42 KG</option>
                  <option value={43}>43 KG</option>
                </select>
              </div>

              {editingCalc.isMinusCalculated && (
                <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-100 dark:border-rose-900/30 space-y-3">
                  <span className="text-[9px] font-black uppercase text-rose-800 dark:text-rose-400 tracking-wider">
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
                        className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded text-xs font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:ring-1 focus:ring-yellow-400"
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
                        className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded text-xs font-bold text-rose-600 dark:text-rose-400 outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setEditingCalc(null)} 
                className="px-4.5 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
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
                      const targetMonPrice = editingCalc.targetMonPrice;
                      if (rate > 0) {
                        const ratio = targetMonPrice / rate;
                        netWeight = kg * ratio;
                        deductedWeight = Math.max(0, kg - netWeight);
                        deductionPercentage = (deductedWeight / kg) * 100;
                      }
                    } else {
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

      {/* Digital Dispatch Memo / Print-Ready Invoice Modal Overlay */}
      {memoCalc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans overflow-y-auto no-print">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full overflow-hidden flex flex-col my-8">
            
            {/* Header controls (No print) */}
            <div className="bg-slate-950 p-4 font-black flex justify-between items-center text-white no-print">
              <span className="text-xs uppercase tracking-widest flex items-center gap-1.5 text-yellow-400">
                <Printer size={13} />
                {language === 'bn' ? 'অফিসিয়াল ডিসপ্যাচ মেমো তৈরি' : 'Corporate Dispatch Memo Generator'}
              </span>
              <button 
                onClick={() => setMemoCalc(null)} 
                className="hover:bg-white/10 w-7 h-7 rounded-full flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Config inputs (No print) */}
            <div className="p-4 bg-slate-55 border-b border-slate-200 no-print space-y-3">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                  {language === 'bn' ? 'কর্পোরেট ক্লায়েন্ট / ফ্যাক্টরির নাম' : 'Corporate Client / Factory Name'}
                </label>
                <input 
                  type="text"
                  placeholder={language === 'bn' ? 'উদা: আকিজ ফুড অ্যান্ড বেভারেজ লিমিটেড' : 'e.g. Akij Food & Beverage Ltd.'}
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-yellow-400 text-slate-800"
                />
              </div>
            </div>

            {/* Print-Ready Invoice Document Sheet */}
            <div id="print-memo-area" className="p-8 bg-white flex-1 text-slate-900 font-sans text-xs">
              
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-slate-950 text-yellow-400 flex items-center justify-center font-black text-lg">
                      AS
                    </div>
                    <div>
                      <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">A. S. Enterprise</h1>
                      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">{language === 'bn' ? 'উন্নত মানের খড়ি ও ফায়ারউড সরবরাহকারী' : 'Premium Firewood Supplier & Manufacturer'}</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-3 space-y-0.5">
                    <p>{language === 'bn' ? 'ডিপো কার্যালয়: কালিয়াকৈর, গাজীপুর, ঢাকা' : 'Depot Office: Kaliakair, Gazipur, Dhaka'}</p>
                    <p>{language === 'bn' ? 'মোবাইল: +৮৮০১৭১২-৩৪৫৬৭৮' : 'Mobile: +8801712-345678'}</p>
                    <p>Email: asenterprise.firewood@gmail.com</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="inline-block bg-slate-100 text-slate-900 border border-slate-200 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-3">
                    {language === 'bn' ? 'অফিসিয়াল চালান মেমো' : 'OFFICIAL DISPATCH MEMO'}
                  </div>
                  <div className="text-[10px] space-y-1 text-slate-700">
                    <p><span className="font-extrabold text-slate-950">{language === 'bn' ? 'তারিখ:' : 'Date:'}</span> {new Date(memoCalc.timestamp).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}</p>
                    <p><span className="font-extrabold text-slate-950">{language === 'bn' ? 'চালান নম্বর:' : 'Challan No:'}</span> #{memoCalc.challanNo !== undefined ? memoCalc.challanNo : '---'}</p>
                    {memoCalc.getEntryNo !== undefined && (
                      <p><span className="font-extrabold text-slate-950">{language === 'bn' ? 'গেট এন্ট্রি নং:' : 'Gate Entry No:'}</span> {memoCalc.getEntryNo}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bill To & Dispatch Details */}
              <div className="grid grid-cols-2 gap-4 py-5 border-b border-slate-200">
                <div>
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{language === 'bn' ? 'কর্পোরেট ক্রেতা / বিল টু:' : 'BILL TO CLIENT:'}</h4>
                  <div className="text-sm font-black text-slate-950">
                    {buyerName || (language === 'bn' ? 'অনির্ধারিত কর্পোরেট ক্লায়েন্ট' : 'UNSPECIFIED CORPORATE CLIENT')}
                  </div>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">{language === 'bn' ? 'ডিসপ্যাচ ডেলিভারি ঠিকানা: ফিজিক্যাল ফ্যাক্টরি ইয়ার্ড' : 'Dispatch Delivery Yard: Factory Premises'}</p>
                </div>
                <div>
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{language === 'bn' ? 'সরবরাহকারী উৎস:' : 'SUPPLIER SOURCE:'}</h4>
                  <div className="text-xs font-extrabold text-slate-800">A. S. Enterprise Depot</div>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1"><span className="font-bold">{language === 'bn' ? 'বিক্রেতা চালান রেফারেন্স:' : 'Seller Reference:'}</span> {memoCalc.sellerName}</p>
                </div>
              </div>

              {/* Line items table */}
              <div className="py-5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 text-[10px] font-black uppercase text-slate-500">
                      <th className="py-2">{language === 'bn' ? 'বিবরণ' : 'Description'}</th>
                      <th className="py-2 text-right">{language === 'bn' ? 'ওজন (কেজি)' : 'Weight (KG)'}</th>
                      <th className="py-2 text-right">{language === 'bn' ? 'মন ধরণ' : 'Mon Size'}</th>
                      <th className="py-2 text-right">{language === 'bn' ? 'রূপান্তরিত মন' : 'Qty (Mon)'}</th>
                      <th className="py-2 text-right">{language === 'bn' ? 'দর প্রতি মন' : 'Rate (BDT)'}</th>
                      <th className="py-2 text-right">{language === 'bn' ? 'সর্বমোট মূল্য' : 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
                    <tr className="py-3">
                      <td className="py-3">
                        <p className="font-black text-slate-950">{language === 'bn' ? 'ফায়ারউড (জ্বালানি কাঠ) ডিসপ্যাচ' : 'Firewood Cargo Dispatch Log'}</p>
                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{language === 'bn' ? 'ফ্যাক্টরি বয়লার ফার্নেস গ্রেড' : 'Industrial Boiler Furnace Grade'}</p>
                      </td>
                      <td className="py-3 text-right font-bold">{memoCalc.totalKg.toLocaleString()} KG</td>
                      <td className="py-3 text-right">{memoCalc.monType} KG</td>
                      <td className="py-3 text-right font-black text-slate-950">
                        {Math.floor((memoCalc.isMinusCalculated && memoCalc.deductedWeight !== undefined ? Math.max(0, memoCalc.totalKg - memoCalc.deductedWeight) : memoCalc.totalKg) / memoCalc.monType)} Mon {(parseFloat(((memoCalc.isMinusCalculated && memoCalc.deductedWeight !== undefined ? Math.max(0, memoCalc.totalKg - memoCalc.deductedWeight) : memoCalc.totalKg) % memoCalc.monType).toFixed(2)))} KG
                      </td>
                      <td className="py-3 text-right font-bold">৳{memoCalc.ratePerMon}</td>
                      <td className="py-3 text-right font-black text-slate-950 text-sm">৳{Math.round(memoCalc.totalPrice).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Extra Minus Info breakdown if exists */}
              {memoCalc.isMinusCalculated && memoCalc.deductedWeight !== undefined && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-[10px] text-slate-600 mb-5 font-semibold space-y-1">
                  <div className="font-black text-slate-950 uppercase tracking-wider text-[8px] mb-1">{language === 'bn' ? 'মাইনাস ওজন হিসাব বিবরণী:' : 'MINUS DEDUCTION STATEMENT:'}</div>
                  <p>{language === 'bn' ? `মূল ক্রয় ওজন: ${memoCalc.totalKg.toLocaleString()} কেজি` : `Gross Purchased Weight: ${memoCalc.totalKg.toLocaleString()} KG`}</p>
                  <p>{language === 'bn' ? `কর্তনকৃত ওজন (ধূলি/আর্দ্রতা): ${memoCalc.deductedWeight.toFixed(1)} কেজি` : `Deducted Weight (Dust/Moisture): ${memoCalc.deductedWeight.toFixed(1)} KG`}</p>
                  <p className="text-rose-600 font-bold">{language === 'bn' ? `নিট বিলিং ওজন: ${(memoCalc.totalKg - memoCalc.deductedWeight).toFixed(1)} কেজি` : `Net Billing Weight: ${(memoCalc.totalKg - memoCalc.deductedWeight).toFixed(1)} KG`}</p>
                </div>
              )}

              {/* Summary blocks */}
              <div className="flex justify-between items-start py-6 border-t-2 border-slate-900 mt-4">
                <div className="max-w-xs">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{language === 'bn' ? 'কথায় সর্বমোট বিল:' : 'IN WORDS (BDT):'}</p>
                  <p className="text-[11px] font-black text-slate-800 capitalize mt-1">
                    {language === 'bn' ? 'হিসাবকৃত সর্বমোট টাকা পরিশোধযোগ্য' : 'Only total calculated payable amount'}
                  </p>
                </div>
                
                <div className="w-64 space-y-2 text-right">
                  <div className="flex justify-between text-slate-600">
                    <span className="font-bold">{language === 'bn' ? 'উপ-মোট:' : 'Subtotal:'}</span>
                    <span className="font-bold">৳{Math.round(memoCalc.totalPrice).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-bold">{language === 'bn' ? 'ভ্যাট/ট্যাক্স (০%):' : 'VAT / Tax (0%):'}</span>
                    <span className="font-bold">৳০</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-950 text-base font-black">
                    <span>{language === 'bn' ? 'সর্বমোট প্রদেয়:' : 'Total Payable:'}</span>
                    <span className="text-indigo-600">৳{Math.round(memoCalc.totalPrice).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Signatures block */}
              <div className="grid grid-cols-2 gap-8 pt-16 mt-8 border-t border-slate-100">
                <div className="text-center">
                  <div className="w-48 mx-auto border-t-2 border-slate-900 pt-1.5 font-black text-[10px] uppercase text-slate-900 tracking-wider">
                    {language === 'bn' ? 'গ্রহীতার স্বাক্ষর' : 'Received By Signature'}
                  </div>
                  <p className="text-[8px] text-slate-400 mt-1">{language === 'bn' ? 'ফ্যাক্টরি গেট রিসিভার স্ট্যাম্প' : 'Factory Gate Receiver Seal'}</p>
                </div>
                <div className="text-center">
                  <div className="w-48 mx-auto border-t-2 border-slate-900 pt-1.5 font-black text-[10px] uppercase text-slate-900 tracking-wider">
                    {language === 'bn' ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Authorized Signatory'}
                  </div>
                  <p className="text-[8px] text-slate-400 mt-1">A. S. Enterprise Depot Manager</p>
                </div>
              </div>

              {/* Official Stamp Overlay */}
              <div className="text-center text-[9px] text-slate-350 tracking-widest uppercase font-mono mt-16 select-none">
                *** THANK YOU FOR YOUR VALUED BUSINESS ***
              </div>

            </div>

            {/* Footer controls (No print) */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 no-print">
              <button 
                type="button" 
                onClick={() => setMemoCalc(null)} 
                className="px-4.5 py-2 border border-slate-200 text-slate-500 rounded text-xs font-bold hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
              >
                {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
              <button 
                type="button" 
                onClick={() => window.print()} 
                className="px-5 py-2 bg-yellow-400 text-black font-black uppercase text-[10px] tracking-widest rounded shadow-md hover:bg-yellow-500 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={12} />
                {language === 'bn' ? 'মেমো প্রিন্ট করুন' : 'Print Invoice'}
              </button>
            </div>

          </div>
        </div>
      )}
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
  onSave: (calc: Omit<Calculation, 'createdBy'>) => Promise<number | false>;
  expectedNextChallan: number;
  language: 'bn' | 'en';
  t: any;
  calculations: Calculation[];
  receiptVisibility: ReceiptVisibility;
  copyConfig: CopyConfig;
  cashBoxBalance: number;
}

function CalculatorSection({ onSave, expectedNextChallan, language, t, calculations, receiptVisibility, copyConfig, cashBoxBalance }: CalculatorProps) {
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
  const [isSaved, setIsSaved] = useState(false);

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

  // On Calculate (হিসাব করুন): Computes the preview representation of the firewood invoice but does NOT save yet.
  const handleCalculate = () => {
    if (!formData.challanNo) {
      alert(t.alertChallanMust);
      return;
    }

    if (!formData.sellerName || !formData.totalKg || !formData.ratePerMon) {
      alert(t.alertInputsMust);
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

    setPreviewResult(calculated);
    setIsSaved(false);
  };

  const handleSaveCalculation = async () => {
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

    // Hard Blocker: Insufficient central cashbox balance
    const roundedPrice = Math.round(calculated.price);
    if (roundedPrice > cashBoxBalance) {
      const errMsg = language === 'bn'
        ? `Error (পর্যাপ্ত ক্যাশ নেই): সেন্ট্রাল ক্যাশ বক্সে পর্যাপ্ত টাকা নেই! হিসাবের মূল্য: ৳${roundedPrice.toLocaleString()}, ক্যাশ ব্যালেন্স: ৳${cashBoxBalance.toLocaleString()}। দয়া করে অ্যাডমিনকে ক্যাশ বক্স রিফিল করতে বলুন।`
        : `Hard Blocker: Insufficient Central Cash Box balance! Payable: ৳${roundedPrice.toLocaleString()}, Cash Box Balance: ৳${cashBoxBalance.toLocaleString()}. Please ask Admin to Top-Up.`;
      alert(errMsg);
      return;
    }

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

    // Save to DB!
    const savedChallanNo = await onSave({
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

    if (savedChallanNo === false) {
      return; // Stop execution on failure
    }

    const finalizedResult = {
      ...calculated,
      challanNo: savedChallanNo
    };

    setPreviewResult(finalizedResult);
    setIsSaved(true);

    const successMsg = language === 'bn' 
      ? 'হিসাবটি সফলভাবে সফটওয়্যারে সেভ হয়ে খাতা লিস্টে যোগ হয়েছে!' 
      : 'Calculation finalized and successfully saved to database!';
    alert(successMsg);

    // Increment challan for next row & reset form
    setFormData({
      sellerName: '',
      totalKg: '',
      ratePerMon: '',
      monType: formData.monType,
      challanNo: (savedChallanNo + 1).toString()
    });
    setAllowSerialBypass(false);
  };

  const handleClear = () => {
    setFormData({
      sellerName: '',
      totalKg: '',
      ratePerMon: '',
      monType: formData.monType,
      challanNo: expectedNextChallan.toString()
    });
    setPreviewResult(null);
    setIsSaved(false);
    setAllowSerialBypass(false);
  };

  const handleClearMinus = () => {
    setMinusFormData({
      sellerName: '',
      totalKg: '',
      minusWeight: '',
      targetMonPrice: '',
      monType: minusFormData.monType,
      ratePerMon: '',
      challanNo: expectedNextChallan.toString(),
      activeInput: 'weight'
    });
    setPreviewResult(null);
    setIsSaved(false);
  };

  const handleCalculateMinus = () => {
    if (!minusFormData.challanNo) {
      alert(t.alertChallanMust);
      return;
    }

    if (!minusFormData.sellerName || !minusFormData.totalKg || !minusFormData.ratePerMon) {
      alert(t.alertInputsMust);
      return;
    }

    const enteredChallanNum = parseInt(minusFormData.challanNo) || 0;
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

    setPreviewResult(calculated);
    setIsSaved(false);
  };

  const handleSaveMinusCalculation = async () => {
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

    // Hard Blocker: Insufficient central cashbox balance
    const roundedPrice = Math.round(calculated.price);
    if (roundedPrice > cashBoxBalance) {
      const errMsg = language === 'bn'
        ? `Error (পর্যাপ্ত ক্যাশ নেই): সেন্ট্রাল ক্যাশ বক্সে পর্যাপ্ত টাকা নেই! হিসাবের মূল্য: ৳${roundedPrice.toLocaleString()}, ক্যাশ ব্যালেন্স: ৳${cashBoxBalance.toLocaleString()}। দয়া করে অ্যাডমিনকে ক্যাশ বক্স রিফিল করতে বলুন।`
        : `Hard Blocker: Insufficient Central Cash Box balance! Payable: ৳${roundedPrice.toLocaleString()}, Cash Box Balance: ৳${cashBoxBalance.toLocaleString()}. Please ask Admin to Top-Up.`;
      alert(errMsg);
      return;
    }

    // Save to DB!
    const savedChallanNo = await onSave({
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

    if (savedChallanNo === false) {
      return; // Stop execution on failure
    }

    const finalizedResult = {
      ...calculated,
      challanNo: savedChallanNo
    };

    setPreviewResult(finalizedResult);
    setIsSaved(true);

    const successMsg = language === 'bn' 
      ? 'মাইনাস হিসাবটি সফলভাবে সফটওয়্যারে সেভ হয়ে খাতা লিস্টে যোগ হয়েছে!' 
      : 'Minus calculation finalized and successfully saved to database!';
    alert(successMsg);

    // Increment challan for next row & reset form
    setMinusFormData({
      sellerName: '',
      totalKg: '',
      minusWeight: '',
      targetMonPrice: '',
      monType: minusFormData.monType,
      ratePerMon: '',
      challanNo: (savedChallanNo + 1).toString(),
      activeInput: 'weight'
    });
  };

  const handleCopy = () => {
    if (!previewResult) {
      alert(language === 'bn' ? 'কপি করার জন্য প্রথমে হিসাব সম্পন্ন করুন!' : 'Perform calculation first to copy text!');
      return;
    }

    const formattedPrice = Math.round(previewResult.price);
    const lines: string[] = [];

    if (copyConfig.sellerName && previewResult.sellerName) {
      lines.push(`${language === 'bn' ? 'বিক্রেতার নাম:' : 'Seller Name:'} ${previewResult.sellerName}`);
    }

    if (copyConfig.challanNo && previewResult.challanNo !== undefined) {
      const challanVal = language === 'bn' ? toBengaliDigits(previewResult.challanNo) : previewResult.challanNo;
      lines.push(`${language === 'bn' ? 'চালান নং:' : 'Challan No:'} #${challanVal}`);
    }

    if (copyConfig.getEntryNo && previewResult.getEntryNo !== undefined) {
      const getEntryVal = language === 'bn' ? toBengaliDigits(previewResult.getEntryNo) : previewResult.getEntryNo;
      lines.push(`${language === 'bn' ? 'গেট এন্ট্রি নং:' : 'Get Entry No:'} #${getEntryVal}`);
    }

    if (copyConfig.totalWeight && previewResult.totalKg !== undefined) {
      const weightVal = language === 'bn' ? `${toBengaliDigits(previewResult.totalKg)} কেজি` : `${previewResult.totalKg} KG`;
      lines.push(`${language === 'bn' ? 'মোট ওজন:' : 'Total Weight:'} ${weightVal}`);
    }

    if (previewResult.isMinusCalculated && previewResult.deductedWeight !== undefined) {
      if (copyConfig.deduction) {
        const dedWeightVal = language === 'bn' ? `${toBengaliDigits(previewResult.deductedWeight.toFixed(1))} কেজি` : `${previewResult.deductedWeight.toFixed(1)} KG`;
        const dedPctVal = language === 'bn' ? `${toBengaliDigits(previewResult.deductionPercentage.toFixed(1))}%` : `${previewResult.deductionPercentage.toFixed(1)}%`;
        lines.push(`${language === 'bn' ? 'ওজন কর্তন:' : 'Deducted Weight:'} -${dedWeightVal} (${dedPctVal})`);
      }
    }

    if (copyConfig.netWeight) {
      const netMon = language === 'bn' 
        ? `${toBengaliDigits(previewResult.monCount)} মণ ${toBengaliDigits(previewResult.extraKg)} কেজি` 
        : `${previewResult.monCount} Mon ${previewResult.extraKg} KG`;
      lines.push(`${language === 'bn' ? 'নিট ওজন:' : 'Net Weight:'} ${netMon}`);
    }

    if (copyConfig.rate && previewResult.ratePerMon !== undefined) {
      const rateVal = language === 'bn' ? `${toBengaliDigits(previewResult.ratePerMon)} টাকা` : `৳${previewResult.ratePerMon}`;
      lines.push(`${language === 'bn' ? 'রেট (দর):' : 'Rate/Mon:'} ${rateVal}`);
    }

    if (copyConfig.totalPrice) {
      const priceVal = language === 'bn' ? `${toBengaliDigits(formattedPrice)} টাকা` : `৳${formattedPrice}`;
      lines.push(`${language === 'bn' ? 'মোট মূল্য:' : 'Total Price:'} ${priceVal}`);
    }

    const textToCopy = lines.join('\n\n');

    if (!textToCopy.trim()) {
      alert(language === 'bn' ? 'কপি করার মতো কোনো কন্টেন্ট সিলেক্ট করা নেই!' : 'No copy items selected in Settings!');
      return;
    }

    navigator.clipboard.writeText(textToCopy);
    alert(language === 'bn' ? 'হিসাবটি সফলভাবে কপি করা হয়েছে!' : 'The calculated elements have been copied successfully!');
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

        {/* Real-time Cash Box Balance Widget */}
        <div className="mb-6 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
              {language === 'bn' ? 'চলতি ক্যাশ ব্যালেন্স (রিয়েল-টাইম)' : 'CURRENT AVAILABLE CASH BALANCE (REAL-TIME)'}
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-yellow-500">💵</span>
              <span>৳{cashBoxBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {cashBoxBalance < 2000 && (
            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wide flex items-center gap-2 animate-pulse">
              <span>⚠️</span>
              <span>
                {language === 'bn' 
                  ? 'ক্যাশ বক্স ব্যালেন্স কম: দয়া করে অ্যাডমিনকে রিফিল করতে বলুন!' 
                  : 'Low Balance: Please ask Admin to Top-Up!'}
              </span>
            </div>
          )}
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
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 mb-1 block">
                  {t.challanNum} {language === 'bn' ? '(স্বয়ংক্রিয়)' : '(Automated)'}
                </label>
                <input 
                  type="text" 
                  className="w-full h-11 px-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-rose-600 dark:text-rose-400 outline-none cursor-not-allowed opacity-80"
                  value={formData.challanNo ? `#${formData.challanNo}` : '---'}
                  disabled
                  readOnly
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

            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-1">
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

              <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
                <button 
                  type="button"
                  onClick={handleClear}
                  className="h-11 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black uppercase text-[11px] tracking-wider rounded border border-slate-200 dark:border-slate-750 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>{language === 'bn' ? "ক্লিয়ার" : "Clear"}</span>
                </button>

                <button 
                  type="button"
                  onClick={handleCalculate}
                  className="h-11 px-4 bg-yellow-400 hover:bg-yellow-500 text-black font-black uppercase text-[11px] tracking-wider rounded shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>{t.calculate}</span>
                </button>

                <button 
                  type="button"
                  onClick={handleSaveCalculation}
                  className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider rounded shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>{language === 'bn' ? "সেভ করুন" : "Save"}</span>
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
                    {language === 'bn' ? "চালান নং (স্বয়ংক্রিয়)" : "Challan No (Automated)"}
                  </label>
                  <input 
                    type="text" 
                    className="w-full h-10 px-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-black text-rose-600 dark:text-rose-400 outline-none cursor-not-allowed opacity-80"
                    value={minusFormData.challanNo ? `#${minusFormData.challanNo}` : '---'}
                    disabled
                    readOnly
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
            <div className="bg-rose-50/50 dark:bg-rose-950/10 p-5 rounded-xl border border-rose-200/60 dark:border-rose-900/30 shadow-xs space-y-4">
              <h4 className="text-[11px] font-black text-rose-800 dark:text-rose-400 uppercase tracking-widest border-b border-rose-200/50 dark:border-rose-900/40 pb-1">
                {language === 'bn' ? "মাইনাস হিসাবের লাইভ ফলাফল" : "Live Minus Calculation Result"}
              </h4>

              {/* Highlighted Weight Difference Comparison section */}
              <div className="bg-rose-100/40 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-200/50 dark:border-rose-900/30 text-xs space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
                  <span>{language === 'bn' ? 'মোট ওজন:' : 'Total Weight:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{parseFloat(minusFormData.totalKg) || 0} KG</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
                  <span>{language === 'bn' ? 'কর্তন বাদে নিট ওজন:' : 'Net Weight After Deduction:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{minusCalcResult.netWeight.toFixed(1)} KG</span>
                </div>
                <div className="flex justify-between text-rose-700 dark:text-rose-400 font-extrabold border-t border-rose-200/30 dark:border-rose-900/40 pt-1 mt-1 text-sm">
                  <span>{language === 'bn' ? 'ওজন কর্তন বা ব্যবধান (লাল রঙের):' : 'Weight Gap / Difference (Red color):'}</span>
                  <span className="font-black text-red-600 dark:text-red-400">{minusCalcResult.minusWeight.toFixed(1)} KG</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-slate-500 dark:text-slate-400">
                      {language === 'bn' ? "ওজন কর্তনের হার: " : "Deduction Rate: "}
                    </span>
                    <span className="font-black text-rose-600 dark:text-rose-400">
                      {minusCalcResult.deductionPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-slate-500 dark:text-slate-400">
                      {language === 'bn' ? "কর্তন বাদে নিট ওজন: " : "Net Weight after deduction: "}
                    </span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {minusCalcResult.netWeight.toFixed(1)} কেজি (KG)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-slate-500 dark:text-slate-400">
                      {language === 'bn' ? "কর্তনকৃত হিসাবে প্রতি মনের মূল্য: " : "Effective Price per Mon: "}
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      ৳{Math.round(minusCalcResult.effectivePrice)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-slate-500 dark:text-slate-400">
                      {language === 'bn' ? "এত কেজি কর্তনে মোট মণ: " : "Total Mon after deduction: "}
                    </span>
                    <span className="font-black text-green-700 dark:text-green-400 text-sm">
                      {minusCalcResult.monCount} মন {minusCalcResult.extraKg} কেজি
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button 
                type="button"
                onClick={handleClearMinus}
                className="h-11 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider rounded border border-slate-200 dark:border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                <span>{language === 'bn' ? "ক্লিয়ার" : "Clear"}</span>
              </button>
              <button 
                type="button"
                onClick={handleCalculateMinus}
                className="h-11 px-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black uppercase text-[10px] tracking-wider rounded shadow transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                <span>{language === 'bn' ? "হিসাব করুন" : "Calculate"}</span>
              </button>
              <button 
                type="button"
                onClick={handleSaveMinusCalculation}
                className="h-11 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded shadow transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                <span>{language === 'bn' ? "সেভ করুন" : "Save"}</span>
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
          isSaved={isSaved}
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
  isSaved: boolean;
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
  isSaved,
  t, 
  language,
  receiptVisibility,
  rateRaw
}: CompactReceiptProps) {
  return (
    <div className={`bg-white dark:bg-slate-900 border-4 border-yellow-400 dark:border-yellow-500 rounded-xl p-6 shadow-xl font-mono text-xs transition-all relative overflow-hidden text-slate-900 dark:text-slate-100 ${!isCalculated ? 'opacity-70' : ''}`}>
      
      {/* Decorative Stamp badge */}
      <div className={`absolute top-10 right-4 transform rotate-12 border-2 border-dashed text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest select-none bg-white/80 dark:bg-slate-800/80 ${
        isCalculated 
          ? isSaved 
            ? 'border-green-600 text-green-600' 
            : 'border-amber-500 text-amber-500 animate-pulse'
          : 'border-red-500 text-red-500'
      }`}>
        {isCalculated 
          ? isSaved 
            ? (language === 'bn' ? 'সেভ করা হয়েছে' : 'SAVED') 
            : (language === 'bn' ? 'সেভ করা হয়নি' : 'UNSAVED DRAFT')
          : (language === 'bn' ? 'হিসাব করুন' : 'NOT CALCULATED')}
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
        isSaved ? (
          <div className="space-y-2 mb-4">
            <div className="w-full py-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400 font-extrabold rounded text-center text-xs flex items-center justify-center gap-2 shadow-sm">
              <span>✔ {language === 'bn' ? 'খতিয়ানে সফলভাবে সেভ করা হয়েছে!' : 'Saved to Ledger database successfully!'}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            <div className="w-full py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 font-extrabold rounded text-center text-xs flex items-center justify-center gap-2 shadow-sm animate-pulse">
              <span>⚠️ {language === 'bn' ? 'খসড়া হিসাব (সেভ বাটন চেপে সেভ করুন)' : 'Draft (Click Save Button to save to ledger)'}</span>
            </div>
          </div>
        )
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
                          <div className="text-[9px] bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-1 rounded mt-1 text-slate-500 dark:text-slate-400 font-semibold space-y-0.5">
                            <div>{language === 'bn' ? `মোট: ${toBengaliDigits(calc.totalKg)} কেজি` : `Total: ${calc.totalKg} KG`}</div>
                            <div>{language === 'bn' ? `নিট ওজন: ${toBengaliDigits((calc.totalKg - calc.deductedWeight).toFixed(1))} কেজি` : `Net Wt: ${(calc.totalKg - calc.deductedWeight).toFixed(1)} KG`}</div>
                            <div className="text-red-600 dark:text-red-400 font-black border-t border-rose-100 dark:border-rose-900/20 pt-0.5">{language === 'bn' ? `ব্যবধান: ${toBengaliDigits(calc.deductedWeight.toFixed(1))} কেজি` : `Difference: ${calc.deductedWeight.toFixed(1)} KG`}</div>
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
                          <div className="text-[9px] bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-1.5 rounded mt-1 text-slate-500 dark:text-slate-400 font-semibold space-y-0.5 min-w-[130px]">
                            <div>{language === 'bn' ? `মোট: ${toBengaliDigits(calc.totalKg)} কেজি` : `Total: ${calc.totalKg} KG`}</div>
                            <div>{language === 'bn' ? `নিট ওজন: ${toBengaliDigits((calc.totalKg - calc.deductedWeight).toFixed(1))} কেজি` : `Net Wt: ${(calc.totalKg - calc.deductedWeight).toFixed(1)} KG`}</div>
                            <div className="text-red-600 dark:text-red-400 font-black border-t border-rose-100 dark:border-rose-900/20 pt-0.5">{language === 'bn' ? `ব্যবধান: ${toBengaliDigits(calc.deductedWeight.toFixed(1))} কেজি` : `Difference: ${calc.deductedWeight.toFixed(1)} KG`}</div>
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
