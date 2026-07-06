import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { 
  Lock, 
  Mail, 
  User, 
  Shield, 
  Languages, 
  Building2, 
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';

interface LoginScreenProps {
  language: 'bn' | 'en';
  setLanguage: (lang: 'bn' | 'en') => void;
  onLoginSuccess: () => void;
}

export default function LoginScreen({ language, setLanguage, onLoginSuccess }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const t = {
    bn: {
      brandName: "এ. এস. এন্টারপ্রাইজ",
      subtitle: "খড়ি সরবরাহকারী ও পাইকারি বিক্রেতা",
      proprietor: "প্রোপ্রাইটর: আবু সালেহ | মোবাইল: ০১৭৬৬৭৬১৮৭৭",
      loginTitle: "সফটওয়্যার লগইন",
      registerTitle: "নতুন অ্যাকাউন্ট তৈরি করুন",
      emailLabel: "ইমেইল এড্রেস",
      passwordLabel: "পাসওয়ার্ড",
      nameLabel: "অপারেটরের নাম",
      roleLabel: "ইউজার রোল (Role)",
      adminRole: "এডমিন (Admin - সম্পূর্ণ অ্যাক্সেস)",
      guestRole: "অপারেটর (Guest - দৈনিক হিসাব এন্ট্রি)",
      loginBtn: "লগইন করুন",
      registerBtn: "অ্যাকাউন্ট তৈরি করুন",
      noAccount: "নতুন অপারেটর? অ্যাকাউন্ট তৈরি করুন",
      hasAccount: "পূর্বের অ্যাকাউন্ট আছে? লগইন করুন",
      passwordRequirement: "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে",
      loginSuccess: "লগইন সফল হয়েছে!",
      registerSuccess: "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!",
      errorInvalid: "ইমেইল বা পাসওয়ার্ড ভুল হয়েছে!",
      errorWeakPassword: "পাসওয়ার্ড দুর্বল! অন্তত ৬ অক্ষর দিন।",
      errorEmailInUse: "এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হয়েছে!",
      errorGeneral: "কিছু একটা ভুল হয়েছে! দয়া করে আবার চেষ্টা করুন।"
    },
    en: {
      brandName: "A. S. Enterprise",
      subtitle: "Firewood Supplier & Wholesaler",
      proprietor: "Proprietor: Abu Saleh | Mobile: 01766761877",
      loginTitle: "Software Authentication",
      registerTitle: "Register New Operator",
      emailLabel: "Email Address",
      passwordLabel: "Password",
      nameLabel: "Operator Name",
      roleLabel: "User Role Selection",
      adminRole: "Admin (Full Ledger & Settings)",
      guestRole: "Guest / Operator (Daily Entries Only)",
      loginBtn: "Sign In",
      registerBtn: "Create Account",
      noAccount: "New Operator? Create Account",
      hasAccount: "Already have an account? Sign In",
      passwordRequirement: "Password must be at least 6 characters",
      loginSuccess: "Successfully logged in!",
      registerSuccess: "Account successfully registered!",
      errorInvalid: "Invalid email or password!",
      errorWeakPassword: "Weak password! Use at least 6 characters.",
      errorEmailInUse: "This email is already in use!",
      errorGeneral: "Something went wrong! Please try again."
    }
  };

  const currT = t[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        // Validation
        if (password.length < 6) {
          setError(currT.errorWeakPassword);
          setLoading(false);
          return;
        }

        // Register in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // Save Role & Details to users Firestore collection
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: name.trim() || email.split('@')[0],
          email: email.trim(),
          role: 'guest',
          createdAt: Date.now()
        });

        alert(currT.registerSuccess);
      } else {
        // Login in Firebase Auth
        await signInWithEmailAndPassword(auth, email.trim(), password);
        alert(currT.loginSuccess);
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError(currT.errorInvalid);
      } else if (err.code === 'auth/weak-password') {
        setError(currT.errorWeakPassword);
      } else if (err.code === 'auth/email-already-in-use') {
        setError(currT.errorEmailInUse);
      } else {
        setError(err.message || currT.errorGeneral);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 md:p-8 text-slate-100 font-sans relative overflow-hidden">
      {/* Background Decorative Accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Language Toggle Header */}
      <div className="flex justify-end max-w-4xl mx-auto w-full z-10">
        <button
          type="button"
          onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-black text-yellow-400 transition-all select-none active:scale-95 cursor-pointer"
        >
          <Languages size={14} />
          <span>{language === 'bn' ? 'ENGLISH' : 'বাংলা সংস্করণ'}</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center py-6 z-10">
        <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-800/80 shadow-2xl p-6 md:p-8 space-y-6">
          
          {/* Logo Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-yellow-400 text-slate-950 rounded-2xl shadow-lg shadow-yellow-400/10 mb-2">
              <Building2 size={28} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-yellow-400 tracking-tight">
              {currT.brandName}
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {currT.subtitle}
            </p>
            <p className="text-[10px] text-slate-500 italic">
              {currT.proprietor}
            </p>
          </div>

          {/* Form Card */}
          <div className="border-t border-slate-800/80 pt-5">
            <h2 className="text-sm font-black text-slate-200 uppercase tracking-wider mb-4 text-center">
              {isSignUp ? currT.registerTitle : currT.loginTitle}
            </h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg font-bold text-center mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">
                    {currT.nameLabel}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <User size={14} />
                    </span>
                    <input 
                      type="text"
                      required
                      placeholder={language === 'bn' ? 'উদা: আবু সালেহ' : 'e.g. Abu Saleh'}
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">
                  {currT.emailLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Mail size={14} />
                  </span>
                  <input 
                    type="email"
                    required
                    placeholder="e.g. sales@asenterprise.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">
                  {currT.passwordLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Lock size={14} />
                  </span>
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 outline-none transition-all placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-400"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {isSignUp && (
                  <p className="text-[9px] text-slate-500 mt-1 ml-1 font-medium">
                    * {currT.passwordRequirement}
                  </p>
                )}
              </div>



              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black uppercase text-xs tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-yellow-400/5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{loading ? (language === 'bn' ? 'অপেক্ষা করুন...' : 'Please wait...') : (isSignUp ? currT.registerBtn : currT.loginBtn)}</span>
                {!loading && <ArrowRight size={14} />}
              </button>
            </form>

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-[11px] font-bold text-yellow-400 hover:underline transition-all cursor-pointer"
              >
                {isSignUp ? currT.hasAccount : currT.noAccount}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <footer className="text-center py-2 border-t border-slate-900 max-w-4xl mx-auto w-full">
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          &copy; {new Date().getFullYear()} A. S. Enterprise. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
