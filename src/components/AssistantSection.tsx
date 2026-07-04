import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Bot, User, Sparkles, Check, X, 
  Trash2, AlertCircle, FileText, CheckCircle2, RefreshCw
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
}

interface Note {
  id: string;
  timestamp: number;
  title: string;
  content: string;
}

interface ActionPayload {
  type: 'ADD_CALCULATION' | 'DELETE_CALCULATION' | 'EDIT_CALCULATION' | 'ADD_NOTE' | 'DELETE_NOTE';
  description: string;
  data: any;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  action?: ActionPayload | null;
  actionExecuted?: boolean;
  actionCancelled?: boolean;
}

interface AssistantSectionProps {
  calculations: Calculation[];
  notes: Note[];
  onAddCalculation: (calc: Omit<Calculation, 'createdBy'>) => void;
  onDeleteCalculation: (id: string) => void;
  onEditCalculation: (calc: Calculation) => void;
  onAddNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  language: 'bn' | 'en';
  currentUser: string;
}

export default function AssistantSection({
  calculations,
  notes,
  onAddCalculation,
  onDeleteCalculation,
  onEditCalculation,
  onAddNote,
  onDeleteNote,
  language,
  currentUser
}: AssistantSectionProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: language === 'bn' 
        ? "আসসালামু আলাইকুম! আমি এ. এস এন্টারপ্রাইজের খড়ি ব্যবসার এআই সহকারী। আমি আপনাকে খতিয়ান বিশ্লেষণ, হিসাব যুক্ত করা বা মেমো খাতা পরিচালনায় সাহায্য করতে পারি। বলুন, আজ কীভাবে সাহায্য করতে পারি?"
        : "Welcome! I am the AI Assistant for A. S Enterprise. I can help you analyze ledger entries, add calculations, or manage notes. How can I help you today?",
      timestamp: Date.now()
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'bn' ? 'bn-BD' : 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    if (!textToSend) {
      setInputValue('');
    }

    // Add user message
    const userMsgId = Math.random().toString(36).substring(2, 9);
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // API call to Express proxy endpoint
      const response = await fetch('/api/gemini/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: text,
          calculations,
          notes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to connect to the assistant server');
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'assistant',
        text: data.text || (language === 'bn' ? "দুঃখিত, আমি বুঝতে পারছি না।" : "Sorry, I didn't understand that."),
        action: data.action || null,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      // Auto speech synthesis of assistant response
      speakText(assistantMsg.text);

    } catch (error) {
      console.error("AI Assistant error:", error);
      const errorMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'system',
        text: language === 'bn' 
          ? "অ্যাসিস্ট্যান্ট সার্ভারের সাথে যোগাযোগ করা যায়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ বা API সেটিংস চেক করুন।" 
          : "Could not connect to the Assistant server. Please verify server status or settings.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle the execution of confirmed actions
  const handleConfirmAction = (messageId: string, action: ActionPayload) => {
    try {
      let resultText = '';

      if (action.type === 'ADD_CALCULATION') {
        const payload = action.data;
        
        // Calculate derived fields
        const kg = parseFloat(payload.totalKg) || 0;
        const rate = parseFloat(payload.ratePerMon) || 0;
        const monType = parseInt(payload.monType) || 41;
        const totalMonDecimal = kg / monType;
        const price = totalMonDecimal * rate;

        const newCalcId = Math.random().toString(36).substr(2, 9);
        onAddCalculation({
          id: newCalcId,
          timestamp: Date.now(),
          sellerName: payload.sellerName,
          totalKg: kg,
          ratePerMon: rate,
          monType: monType as any,
          totalMon: totalMonDecimal,
          totalPrice: price,
          challanNo: parseInt(payload.challanNo) || 601
        });

        resultText = language === 'bn' 
          ? `সফলভাবে ${payload.sellerName} এর নামে ${payload.totalKg} KG হিসাব চালান নং #${payload.challanNo} হিসেবে খতিয়ানে সেভ করা হয়েছে!`
          : `Successfully saved ${payload.sellerName}'s entry with ${payload.totalKg} KG, Challan #${payload.challanNo} to the database!`;

      } else if (action.type === 'DELETE_CALCULATION') {
        const targetId = action.data.id;
        const calcToDelete = calculations.find(c => c.id === targetId);
        
        if (calcToDelete) {
          onDeleteCalculation(targetId);
          resultText = language === 'bn'
            ? `চালান নং #${calcToDelete.challanNo} এর হিসাবটি সফলভাবে ডিলিট করা হয়েছে!`
            : `Challan #${calcToDelete.challanNo} calculation deleted successfully!`;
        } else {
          throw new Error("Calculation record not found");
        }

      } else if (action.type === 'EDIT_CALCULATION') {
        onEditCalculation(action.data);
        resultText = language === 'bn'
          ? `হিসাবটি সফলভাবে সংশোধন করা হয়েছে!`
          : `Calculation updated successfully!`;

      } else if (action.type === 'ADD_NOTE') {
        const payload = action.data;
        onAddNote({
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          title: payload.title || (language === 'bn' ? 'এআই মেমো' : 'AI Memo'),
          content: payload.content || ''
        });

        resultText = language === 'bn'
          ? `নতুন নোট "${payload.title}" সফলভাবে মেমো খাতায় সেভ করা হয়েছে!`
          : `Note "${payload.title}" saved successfully to notebooks!`;

      } else if (action.type === 'DELETE_NOTE') {
        onDeleteNote(action.data.id);
        resultText = language === 'bn'
          ? `মেমো নোটটি ডিলিট করা হয়েছে!`
          : `Memo note deleted successfully!`;
      }

      // Mark action as executed
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return { ...msg, actionExecuted: true };
        }
        return msg;
      }));

      // Append success message from system
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'system',
        text: `✔ ${resultText}`,
        timestamp: Date.now()
      }]);

      speakText(resultText);

    } catch (err: any) {
      alert(language === 'bn' ? 'অ্যাকশন সম্পন্ন করতে ব্যর্থ হয়েছে।' : 'Failed to apply changes.');
    }
  };

  const handleCancelAction = (messageId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, actionCancelled: true };
      }
      return msg;
    }));

    const cancelText = language === 'bn' ? "পরিবর্তন বাতিল করা হয়েছে।" : "Action cancelled.";
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'system',
      text: `✕ ${cancelText}`,
      timestamp: Date.now()
    }]);

    speakText(cancelText);
  };

  // Quick prompt recommendations
  const bnSuggestions = [
    "আজকের মোট কয়টি গেট এন্ট্রি সেভ হয়েছে?",
    "আজকে আলিমের মোট ওজনের হিসাব ও দাম কত?",
    "নতুন হিসাব যুক্ত করো: বিক্রেতা আব্দুল, ওজন ৭৫০ কেজি, দর ১৪০ টাকা, চালান নং ৬১৫",
    "আজকের হিসাবের সংক্ষিপ্ত সারসংক্ষেপ দেখাও"
  ];

  const enSuggestions = [
    "How many entries were saved today?",
    "What is the total weight and price for Alim today?",
    "Add new calc: Seller Abdul, 750 KG, Rate 140, Challan 615",
    "Show me a summary of today's calculations"
  ];

  const suggestions = language === 'bn' ? bnSuggestions : enSuggestions;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-180px)] min-h-[500px]">
      
      {/* Left Column: Quick Insights & Suggestions */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {language === 'bn' ? "স্মার্ট নির্দেশনা" : "Smart Commands"}
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
            {language === 'bn' 
              ? "আমি আপনার আদেশ বুঝতে পারি এবং আপনার খতিয়ানে কাজ সম্পন্ন করতে পারি। নিচের উদাহরণগুলি চাপুন বা সরাসরি টাইপ করুন।"
              : "I understand complex Bengali or English commands. Try clicking on one of the quick suggestions below or type your custom instruction."}
          </p>

          <div className="space-y-2">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputValue(s);
                  handleSend(s);
                }}
                disabled={isLoading}
                className="w-full text-left p-2.5 bg-slate-50 hover:bg-yellow-50 dark:bg-slate-950 dark:hover:bg-slate-800 text-[11px] font-black rounded-lg border border-slate-100 dark:border-slate-800 hover:border-yellow-200 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 transition-all text-ellipsis overflow-hidden"
              >
                ⚡ {s}
              </button>
            ))}
          </div>
        </div>

        {/* Database Status Panel */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex-1 hidden lg:flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {language === 'bn' ? "খতিয়ান লাইভ স্ট্যাটাস" : "Ledger Live Status"}
            </h5>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          
          <div className="space-y-3 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">{language === 'bn' ? "মোট সংরক্ষিত হিসাব:" : "Total Saved Calcs:"}</span>
              <span className="text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {calculations.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">{language === 'bn' ? "সংরক্ষিত মেমো নোট:" : "Total Saved Memos:"}</span>
              <span className="text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {notes.length}
              </span>
            </div>
            
            {/* Quick calculations listing for assistant preview */}
            {calculations.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  {language === 'bn' ? "সাম্প্রতিক এন্ট্রি সমূহ:" : "Recent Entries:"}
                </span>
                {calculations.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex justify-between items-center text-[10px] bg-slate-50 dark:bg-slate-950 p-2 rounded">
                    <div>
                      <p className="font-extrabold text-slate-800 dark:text-slate-200">{c.sellerName}</p>
                      <p className="text-[9px] text-slate-400 font-bold">Challan #{c.challanNo}</p>
                    </div>
                    <span className="font-black text-green-600">{c.totalKg} KG</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Active AI Chatbot */}
      <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
        
        {/* Chat Header */}
        <div className="bg-yellow-400 dark:bg-slate-950 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-yellow-400 flex items-center justify-center text-yellow-400 dark:text-slate-950 font-black">
              <Bot size={18} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider leading-none">
                {language === 'bn' ? "জিজ্ঞাসা এআই অ্যাসিস্ট্যান্ট" : "Gemini Intelligence Assistant"}
              </h4>
              <p className="text-[9px] font-extrabold text-slate-700 dark:text-slate-400 tracking-wide mt-1">
                Powered by Gemini 3.5 Flash
              </p>
            </div>
          </div>
          
          <button
            onClick={() => {
              setMessages([
                {
                  id: 'welcome',
                  sender: 'assistant',
                  text: language === 'bn' 
                    ? "আসসালামু আলাইকুম! আমি এ. এস এন্টারপ্রাইজের খড়ি ব্যবসার এআই সহকারী। বলুন, আজ কীভাবে সাহায্য করতে পারি?"
                    : "Welcome! I am the AI Assistant for A. S Enterprise. How can I help you today?",
                  timestamp: Date.now()
                }
              ]);
            }}
            title={language === 'bn' ? "চ্যাট রিসেট করুন" : "Reset Conversation"}
            className="p-1.5 hover:bg-yellow-500 dark:hover:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-300 transition-all"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Message Panel list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isSystem = msg.sender === 'system';
              
              if (isSystem) {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center"
                  >
                    <span className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-xs">
                      {msg.text}
                    </span>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  {/* Icon */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                    isUser 
                      ? 'bg-yellow-400 text-black' 
                      : 'bg-slate-900 text-yellow-400 dark:bg-yellow-400 dark:text-slate-900'
                  }`}>
                    {isUser ? <User size={14} /> : <Bot size={14} />}
                  </div>

                  {/* Bubble content */}
                  <div className="space-y-2">
                    <div className={`px-4 py-3 rounded-2xl text-xs font-medium shadow-xs leading-relaxed ${
                      isUser 
                        ? 'bg-slate-900 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                    }`}>
                      {msg.text}
                      <span className="block text-[8px] mt-1 text-slate-400 font-bold text-right">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* ACTION CONFIRMATION CARD (Read-then-Action Safety Pattern) */}
                    {msg.action && (
                      <div className={`border-2 border-dashed bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm max-w-sm overflow-hidden ${
                        msg.actionExecuted 
                          ? 'border-emerald-500 dark:border-emerald-800' 
                          : msg.actionCancelled 
                            ? 'border-rose-400 dark:border-rose-950/40 opacity-70' 
                            : 'border-yellow-400 dark:border-yellow-500 animate-pulse'
                      }`}>
                        <div className="flex items-start gap-2.5">
                          {msg.actionExecuted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : msg.actionCancelled ? (
                            <X className="w-5 h-5 text-slate-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h5 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                              {msg.actionExecuted 
                                ? (language === 'bn' ? "অ্যাকশন সম্পন্ন" : "Action Executed") 
                                : msg.actionCancelled 
                                  ? (language === 'bn' ? "অ্যাকশন বাতিল" : "Action Cancelled") 
                                  : (language === 'bn' ? "অনুমতি প্রয়োজন" : "Permission Requested")}
                            </h5>
                            <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 leading-normal">
                              {msg.action.description}
                            </p>

                            {/* Details of action payload for maximum auditability */}
                            {!msg.actionExecuted && !msg.actionCancelled && (
                              <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-950 rounded text-[10px] font-mono border border-slate-100 dark:border-slate-800 space-y-1">
                                {msg.action.type === 'ADD_CALCULATION' && (
                                  <>
                                    <p><span className="text-slate-400">Seller:</span> <span className="font-black text-slate-800 dark:text-slate-200">{msg.action.data.sellerName}</span></p>
                                    <p><span className="text-slate-400">Weight:</span> <span className="font-black text-green-600">{msg.action.data.totalKg} KG</span></p>
                                    <p><span className="text-slate-400">Rate:</span> <span className="font-black">৳{msg.action.data.ratePerMon}</span></p>
                                    <p><span className="text-slate-400">Challan:</span> <span className="font-black text-rose-600">#{msg.action.data.challanNo}</span></p>
                                  </>
                                )}
                                {msg.action.type === 'DELETE_CALCULATION' && (
                                  <p><span className="text-slate-400">Target ID:</span> <span className="font-black text-rose-600">{msg.action.data.id}</span></p>
                                )}
                                {msg.action.type === 'ADD_NOTE' && (
                                  <>
                                    <p><span className="text-slate-400">Title:</span> <span className="font-black text-slate-800 dark:text-slate-200">{msg.action.data.title}</span></p>
                                    <p><span className="text-slate-400">Content:</span> <span className="font-black text-slate-500 line-clamp-1">{msg.action.data.content}</span></p>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Action Buttons */}
                            {!msg.actionExecuted && !msg.actionCancelled && (
                              <div className="flex gap-2 mt-3.5">
                                <button
                                  onClick={() => handleConfirmAction(msg.id, msg.action!)}
                                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white font-extrabold rounded text-[10px] tracking-wider uppercase transition-all select-none active:scale-95 flex items-center justify-center gap-1 shadow-xs"
                                >
                                  <Check size={11} strokeWidth={3} />
                                  <span>{language === 'bn' ? "নিশ্চিত" : "Confirm"}</span>
                                </button>
                                <button
                                  onClick={() => handleCancelAction(msg.id)}
                                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-extrabold rounded text-[10px] tracking-wider uppercase transition-all select-none active:scale-95 flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-750"
                                >
                                  <X size={11} strokeWidth={3} />
                                  <span>{language === 'bn' ? "বাতিল" : "Cancel"}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* AI Typing Loader indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 mr-auto"
              >
                <div className="w-7 h-7 rounded-full bg-slate-900 text-yellow-400 dark:bg-yellow-400 dark:text-slate-900 flex items-center justify-center text-xs font-black">
                  <Bot size={14} />
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl rounded-tl-none shadow-xs text-xs flex items-center gap-1.5 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="ml-1 font-bold text-[10px] uppercase tracking-wide">
                    {language === 'bn' ? "খতিয়ান বিশ্লেষণ করছে..." : "Analyzing ledger..."}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input box form panel */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="border-t border-slate-100 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 flex items-center gap-3"
        >
          <input
            type="text"
            required
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            placeholder={language === 'bn' ? "আদেশ বা প্রশ্ন টাইপ করুন... (যেমন: নতুন হিসাব যুক্ত করো)" : "Type your command... (e.g. Add calculation...)"}
            className="flex-1 h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="h-11 w-11 bg-slate-900 dark:bg-yellow-400 hover:bg-black dark:hover:bg-yellow-500 text-yellow-400 dark:text-slate-900 rounded-lg flex items-center justify-center transition-all shadow active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
