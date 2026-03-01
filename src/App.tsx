import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertTriangle, Square, RefreshCw, Languages, Volume2, Send, Mic, MicOff, MessageSquare, User, Bot, Settings2, X, Copy, MapPin } from 'lucide-react';
import { GoogleGenAI, Type, Content, Modality } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { useTTS } from './hooks/useTTS';
import { useLanguage } from './i18n/LanguageContext';
import { LocatorTab } from './components/LocatorTab';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const LANGUAGES = [
  'English',
  'Nepali',
  'Spanish',
  'Chinese (Simplified)',
  'Arabic',
  'Burmese',
  'Vietnamese',
  'Tagalog',
  'French',
  'Korean',
  'Russian'
];

const LANG_CODES: Record<string, string> = {
  'English': 'en-US',
  'Nepali': 'ne-NP',
  'Spanish': 'es-ES',
  'Chinese (Simplified)': 'zh-CN',
  'Arabic': 'ar-SA',
  'Burmese': 'my-MM',
  'Vietnamese': 'vi-VN',
  'Tagalog': 'tl-PH',
  'French': 'fr-FR',
  'Korean': 'ko-KR',
  'Russian': 'ru-RU',
};

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
};

type TermExplanation = {
  term: string;
  simple_explanation: string;
  causes: string;
  symptoms: string;
  treatment: string;
  importance: string;
  lifestyle: string;
};

type DoctorQuestion = {
  category: string;
  question: string;
  why: string;
};

export default function App() {
  const { t, appLanguage, setAppLanguage, aiLanguage, setAiLanguage, sameAsApp, setSameAsApp } = useLanguage();
  
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  
  const [explanation, setExplanation] = useState<{
    simplified: string;
    warnings: string[];
    medicalTerms: string[];
    conditions: string[];
    medications: string[];
    followUp: string[];
    pharmacyNeeded: boolean;
  } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'summary' | 'learn' | 'ask-doctor' | 'locator'>('summary');
  const [termExplanation, setTermExplanation] = useState<TermExplanation | null>(null);
  const [isExplainingTerm, setIsExplainingTerm] = useState(false);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  
  // Ask Doctor State
  const [doctorQuestions, setDoctorQuestions] = useState<DoctorQuestion[] | null>(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionTone, setQuestionTone] = useState<'Short & direct' | 'Polite'>('Polite');
  const [showTop10, setShowTop10] = useState(false);
  const [mainConcern, setMainConcern] = useState('General');
  
  const [error, setError] = useState<string | null>(null);
  
  // Voice Settings State
  const [voiceStyle, setVoiceStyle] = useState('Auto/Native');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  
  const { isPlaying, isGenerating, speak, stop } = useTTS();
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setInputValue(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
    
    // Load voices
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update recognition language when language changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANG_CODES[appLanguage] || 'en-US';
    }
  }, [appLanguage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.type.startsWith('image/')) {
        processFile(droppedFile);
      } else {
        setError("Please upload a PDF or image file.");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      
      setFileData({ base64: base64Data, mimeType: selectedFile.type });
    } catch (err) {
      setError("Failed to read file.");
    }
  };

  const analyzeDocument = async () => {
    if (!fileData) return;
    
    setIsLoadingDoc(true);
    setError(null);
    setExplanation(null);
    setMessages([]);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: fileData.base64,
                mimeType: fileData.mimeType,
              }
            },
            {
              text: `You are a helpful medical assistant. The user has provided a medical discharge instruction or prescription document.
              Please extract the information and provide a response in ${aiLanguage} with the following:
              1. A simple, plain explanation of the instructions suitable for a non-medical person.
              2. A list of important warnings such as dosage limits, frequency, and safety precautions.
              3. A list of medical terms, conditions, and diagnoses found in the document.
              4. A list of conditions/diagnoses explicitly mentioned.
              5. A list of medications explicitly mentioned.
              6. A list of follow-up instructions or referrals (e.g., "Cardiology", "Primary Care").
              7. A boolean indicating if a pharmacy visit is needed (e.g., mentions pickup, refill, or new prescription).
              
              IMPORTANT: In your 'simplified' explanation, whenever you use one of the medical terms, format it as a markdown link like this: [term name](#term:term name).`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              simplified: {
                type: Type.STRING,
                description: `A simple, plain explanation of the instructions in ${aiLanguage}.`,
              },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `List of important warnings in ${aiLanguage}.`,
              },
              medicalTerms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `List of medical terms, conditions, and diagnoses found in the document, translated to ${aiLanguage}.`,
              },
              conditions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `List of conditions/diagnoses found.`,
              },
              medications: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `List of medications found.`,
              },
              followUp: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `List of follow-up instructions or referrals.`,
              },
              pharmacyNeeded: {
                type: Type.BOOLEAN,
                description: `True if a pharmacy visit is needed.`,
              }
            },
            required: ["simplified", "warnings", "medicalTerms", "conditions", "medications", "followUp", "pharmacyNeeded"],
          }
        }
      });

      if (response.text) {
        const parsedResult = JSON.parse(response.text);
        setExplanation(parsedResult);
        
        // Add initial greeting to chat
        setMessages([
          {
            id: Date.now().toString(),
            role: 'model',
            text: `Hello! I have reviewed your document. I've provided a summary on the left. You can ask me any questions about your medications, side effects, or instructions. I will respond in ${aiLanguage} or any language you use.`
          }
        ]);
      } else {
        throw new Error("No response from AI");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while analyzing the document.");
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setInputValue('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleTermClick = async (term: string) => {
    setIsTermModalOpen(true);
    setIsExplainingTerm(true);
    setTermExplanation(null);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Explain the medical term "${term}" in simple, plain language suitable for a patient. 
        Provide the response in ${aiLanguage}.
        Return a structured JSON with the following fields: term, simple_explanation, causes, symptoms, treatment, importance (why this matters for the patient), and lifestyle (general lifestyle recommendations).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              simple_explanation: { type: Type.STRING },
              causes: { type: Type.STRING },
              symptoms: { type: Type.STRING },
              treatment: { type: Type.STRING },
              importance: { type: Type.STRING },
              lifestyle: { type: Type.STRING }
            },
            required: ["term", "simple_explanation", "causes", "symptoms", "treatment", "importance", "lifestyle"]
          }
        }
      });

      if (response.text) {
        setTermExplanation(JSON.parse(response.text));
      }
    } catch (err) {
      console.error("Failed to explain term:", err);
    } finally {
      setIsExplainingTerm(false);
    }
  };

  const generateQuestions = async () => {
    if (!fileData) return;
    setIsGeneratingQuestions(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: fileData.base64, mimeType: fileData.mimeType } },
              { text: `Based strictly on this medical document, extract the diagnoses, medications, follow-up instructions, labs/tests, and warnings. 
              Then, generate simple English questions (6th-8th grade reading level) the patient should ask their doctor.
              Provide the questions in ${aiLanguage}.
              Tone: ${questionTone}.
              Main concern: ${mainConcern}.
              ${showTop10 ? 'Limit to the top 10 most important questions.' : ''}
              Group them into categories like: Diagnosis & meaning, Medications, Follow-up & appointments, Tests & lab results, Warning signs, Lifestyle / diet / activity, Cost / alternatives.
              Do not hallucinate. If info is missing, suggest questions to ask about it.` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    question: { type: Type.STRING },
                    why: { type: Type.STRING }
                  },
                  required: ["category", "question", "why"]
                }
              }
            },
            required: ["questions"]
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        setDoctorQuestions(parsed.questions);
      }
    } catch (err) {
      console.error("Failed to generate questions:", err);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const groupByCategory = (questions: DoctorQuestion[]) => {
    return questions.reduce((acc, q) => {
      if (!acc[q.category]) acc[q.category] = [];
      acc[q.category].push(q);
      return acc;
    }, {} as Record<string, DoctorQuestion[]>);
  };

  const handleSendMessage = async (text: string = inputValue) => {
    if (!text.trim() || !fileData || isChatLoading) return;
    
    const userMsgId = Date.now().toString();
    const newUserMsg: Message = { id: userMsgId, role: 'user', text: text.trim() };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsChatLoading(true);
    
    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', isStreaming: true }]);

    try {
      // Build history for context
      const history: Content[] = [
        {
          role: 'user',
          parts: [
            { inlineData: { data: fileData.base64, mimeType: fileData.mimeType } },
            { text: `Here is the medical document. Please act as a helpful medical assistant. The user's preferred language is ${aiLanguage}. Always respond in the same language the user asks their question in, defaulting to ${aiLanguage}. If the user asks about a medical term or condition, explain it simply. Always include a small disclaimer: "This is educational information and not a medical diagnosis." at the end of medical explanations.` }
          ]
        },
        {
          role: 'model',
          parts: [{ text: `I understand. I will help the user understand their medical document and answer questions in their preferred language.` }]
        }
      ];

      // Add previous chat messages
      messages.forEach(msg => {
        history.push({
          role: msg.role,
          parts: [{ text: msg.text }]
        });
      });

      // Add current user message
      history.push({
        role: 'user',
        parts: [{ text: text.trim() }]
      });

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: history,
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === modelMsgId ? { ...msg, text: fullText } : msg
            )
          );
        }
      }
      
      // Mark streaming as complete
      setMessages(prev => 
        prev.map(msg => 
          msg.id === modelMsgId ? { ...msg, isStreaming: false } : msg
        )
      );

    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === modelMsgId ? { ...msg, text: "Sorry, I encountered an error processing your request.", isStreaming: false } : msg
        )
      );
    } finally {
      setIsChatLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setFileData(null);
    setExplanation(null);
    setMessages([]);
    setError(null);
    setActiveTab('summary');
    setIsTermModalOpen(false);
    setDoctorQuestions(null);
    stop();
  };

  const examplePrompts = [
    "How often should I take this medicine?",
    "What are the side effects?",
    "Explain this simply."
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shrink-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">CareExplain AI</h1>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Languages className="w-4 h-4 text-slate-500" />
              <select 
                value={appLanguage}
                onChange={(e) => setAppLanguage(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            
            {(file || explanation) && (
              <button 
                onClick={reset}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 ml-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('startOver')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Split Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl w-full mx-auto">
        
        {/* Left Panel: Document & Explanation */}
        <div className="w-full md:w-1/2 flex flex-col border-r border-slate-200 bg-slate-50/50 overflow-y-auto">
          <div className="p-6 sm:p-8">
            {!explanation ? (
              <div className="max-w-md mx-auto mt-8 animate-fade-in">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">{t('uploadTitle')}</h2>
                  <p className="text-slate-600">{t('uploadSubtitle')}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div 
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                      ${file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="application/pdf,image/*" 
                      className="hidden" 
                    />
                    
                    {file ? (
                      <div className="flex flex-col items-center">
                        <div className="bg-emerald-100 p-3 rounded-full mb-3">
                          <FileText className="w-6 h-6 text-emerald-600" />
                        </div>
                        <p className="text-sm font-medium text-slate-900 truncate max-w-full px-4">{file.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setFile(null); setFileData(null); }}
                          className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="bg-slate-100 p-3 rounded-full mb-3">
                          <Upload className="w-6 h-6 text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-900 mb-1">{t('uploadButton')}</p>
                        <p className="text-xs text-slate-500">PDF, JPG, PNG (max. 10MB)</p>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>{error}</p>
                    </div>
                  )}

                  <button
                    onClick={analyzeDocument}
                    disabled={!file || isLoadingDoc}
                    className={`w-full mt-6 py-3 px-4 rounded-xl text-white font-medium text-sm transition-all flex items-center justify-center gap-2
                      ${!file || isLoadingDoc ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow'}`}
                  >
                    {isLoadingDoc ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {t('analyzing')}
                      </>
                    ) : (
                      t('analyzing').replace('...', '')
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in max-w-2xl mx-auto flex flex-col h-full">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 mb-4 shrink-0 overflow-x-auto hide-scrollbar">
                  <button 
                    onClick={() => setActiveTab('summary')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'summary' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    {t('summaryTab')}
                  </button>
                  <button 
                    onClick={() => setActiveTab('learn')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'learn' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    {t('learnTab')}
                    {explanation.medicalTerms && explanation.medicalTerms.length > 0 && (
                      <span className="bg-emerald-100 text-emerald-700 py-0.5 px-2 rounded-full text-xs font-bold">
                        {explanation.medicalTerms.length}
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => setActiveTab('ask-doctor')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'ask-doctor' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    {t('askDoctorTab')}
                  </button>
                  <button 
                    onClick={() => setActiveTab('locator')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'locator' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <MapPin className="w-4 h-4" /> {t('locatorTab')}
                  </button>
                </div>

                {activeTab === 'summary' && (
                  <div className="space-y-6 pb-6">
                    {/* Warnings Section */}
                    {explanation.warnings && explanation.warnings.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <h3 className="text-lg font-semibold text-red-900">{t('warnings')}</h3>
                        </div>
                        <ul className="space-y-2">
                          {explanation.warnings.map((warning, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-red-800 text-sm sm:text-base">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0"></span>
                              <span className="leading-relaxed">{warning}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-4 pt-3 border-t border-red-200 text-xs font-semibold text-red-900">
                          {t('seekEmergency')}
                        </div>
                      </div>
                    )}

                    {/* Simplified Explanation */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800">{t('documentSummary')}</h3>
                        <button 
                          onClick={() => speak(explanation.simplified, 'summary', aiLanguage, voiceStyle, speechRate, speechPitch)}
                          disabled={isGenerating === 'summary'}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                            ${isPlaying === 'summary' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          {isGenerating === 'summary' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : isPlaying === 'summary' ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                          {isGenerating === 'summary' ? t('loading') : isPlaying === 'summary' ? t('stop') : t('listen')}
                        </button>
                      </div>
                      <div className="p-5 sm:p-6">
                        <div className="prose prose-slate prose-sm sm:prose-base max-w-none">
                          <ReactMarkdown
                            components={{
                              a: ({node, href, children, ...props}) => {
                                if (href?.startsWith('#term:')) {
                                  const term = decodeURIComponent(href.replace('#term:', ''));
                                  return (
                                    <button 
                                      onClick={() => handleTermClick(term)} 
                                      className="text-emerald-700 font-medium underline decoration-emerald-300 decoration-2 hover:bg-emerald-50 rounded px-0.5 cursor-pointer transition-colors inline"
                                    >
                                      {children}
                                    </button>
                                  );
                                }
                                return <a href={href} {...props}>{children}</a>;
                              }
                            }}
                          >
                            {explanation.simplified}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'learn' && (
                  <div className="space-y-4 pb-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('detectedTerms')}</h3>
                      <p className="text-sm text-slate-600 mb-6">{t('detectedTermsDesc')}</p>
                      
                      <div className="flex flex-wrap gap-3">
                        {explanation.medicalTerms?.map((term, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleTermClick(term)}
                            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl shadow-sm text-emerald-700 font-medium hover:bg-emerald-50 hover:border-emerald-300 hover:shadow transition-all text-left flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4 text-emerald-500" />
                            {term}
                          </button>
                        ))}
                        {(!explanation.medicalTerms || explanation.medicalTerms.length === 0) && (
                          <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl w-full text-center">{t('noTerms')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ask-doctor' && (
                  <div className="space-y-6 pb-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">{t('customizeQuestions')}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{t('tone')}</label>
                          <select 
                            value={questionTone} 
                            onChange={e => setQuestionTone(e.target.value as any)} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-emerald-500"
                          >
                            <option value="Polite">Polite</option>
                            <option value="Short & direct">Short & direct</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{t('mainConcern')}</label>
                          <select 
                            value={mainConcern} 
                            onChange={e => setMainConcern(e.target.value)} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-emerald-500"
                          >
                            <option value="General">General</option>
                            <option value="Pain">Pain</option>
                            <option value="Medication">Medication</option>
                            <option value="Diagnosis">Diagnosis</option>
                            <option value="Follow-up">Follow-up</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="top10" 
                            checked={showTop10} 
                            onChange={e => setShowTop10(e.target.checked)} 
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" 
                          />
                          <label htmlFor="top10" className="text-sm text-slate-700 cursor-pointer">{t('showTop10')}</label>
                        </div>
                      </div>
                      <button
                        onClick={generateQuestions}
                        disabled={isGeneratingQuestions}
                        className={`w-full py-3 px-4 rounded-xl text-white font-medium text-sm transition-all flex items-center justify-center gap-2
                          ${isGeneratingQuestions ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow'}`}
                      >
                        {isGeneratingQuestions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                        {isGeneratingQuestions ? t('generating') : t('generateQuestions')}
                      </button>
                    </div>

                    {doctorQuestions && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-slate-800">{t('questionsToAsk')}</h3>
                          <button 
                            onClick={() => window.print()} 
                            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                          >
                            <FileText className="w-4 h-4" /> {t('exportChecklist')}
                          </button>
                        </div>
                        
                        {Object.entries(groupByCategory(doctorQuestions)).map(([category, questions]) => (
                          <div key={category} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 border-b border-slate-200 p-3 px-4">
                              <h4 className="font-semibold text-slate-800">{category}</h4>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {questions.map((q, idx) => (
                                <div key={idx} className="p-4 sm:p-5 hover:bg-slate-50 transition-colors">
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <p className="text-slate-900 font-medium mb-1">{q.question}</p>
                                      <p className="text-sm text-slate-500"><span className="font-medium text-slate-600">{t('whyAskThis')}</span> {q.why}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button 
                                        onClick={() => speak(q.question, `q-${idx}`, aiLanguage, voiceStyle, speechRate, speechPitch)}
                                        disabled={isGenerating === `q-${idx}`}
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Listen"
                                      >
                                        {isGenerating === `q-${idx}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : isPlaying === `q-${idx}` ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                      </button>
                                      <button 
                                        onClick={() => navigator.clipboard.writeText(q.question)}
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Copy"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        
                        <div className="mt-6 pt-4 border-t border-slate-200 flex items-start gap-2 text-slate-500 bg-slate-50 p-3 rounded-lg">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                          <p className="text-xs italic">
                            {t('disclaimerQuestions')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'locator' && (
                  <LocatorTab needs={{
                    conditions: explanation.conditions || [],
                    medications: explanation.medications || [],
                    followUp: explanation.followUp || [],
                    pharmacyNeeded: explanation.pharmacyNeeded || false
                  }} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Chat Interface */}
        <div className="w-full md:w-1/2 flex flex-col bg-white relative">
          {!explanation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">{t('appTitle')}</p>
              <p className="text-sm mt-1 max-w-xs">{t('uploadSubtitle')}</p>
            </div>
          ) : (
            <>
              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1
                      ${msg.role === 'user' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    
                    <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm sm:text-base shadow-sm
                        ${msg.role === 'user' 
                          ? 'bg-emerald-600 text-white rounded-tr-sm' 
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                        {msg.isStreaming && !msg.text ? (
                          <div className="flex gap-1 items-center h-5">
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        ) : (
                          <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                      
                      {msg.role === 'model' && msg.text && !msg.isStreaming && (
                        <button 
                          onClick={() => speak(msg.text, msg.id, aiLanguage, voiceStyle, speechRate, speechPitch)}
                          disabled={isGenerating === msg.id}
                          className="mt-1.5 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-emerald-600 transition-colors"
                        >
                          {isGenerating === msg.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : isPlaying === msg.id ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                          {isGenerating === msg.id ? t('loading') : isPlaying === msg.id ? t('stop') : t('listen')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Area */}
              <div className="p-4 bg-white border-t border-slate-200">
                {/* Voice Settings (Compact) */}
                <div className="flex flex-wrap items-center gap-3 px-2 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500">{t('voiceSettings')}:</span>
                  </div>
                  <select 
                    value={voiceStyle}
                    onChange={(e) => setVoiceStyle(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded p-1 outline-none focus:border-emerald-500 text-slate-700"
                  >
                    <option value="Auto/Native">Auto / Native</option>
                    <option value="Girl voice">Girl voice</option>
                    <option value="Deep voice">Deep voice</option>
                    <option value="Manly voice">Manly voice</option>
                    <option value="Neutral">Neutral</option>
                  </select>
                  
                  <div className="flex items-center gap-1.5 ml-1 sm:ml-2">
                    <span className="text-xs text-slate-500">{t('speed')}:</span>
                    <input 
                      type="range" min="0.8" max="1.2" step="0.1" 
                      value={speechRate} onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                      className="w-12 sm:w-16 accent-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 ml-1 sm:ml-2">
                    <span className="text-xs text-slate-500">{t('pitch')}:</span>
                    <input 
                      type="range" min="0.8" max="1.2" step="0.1" 
                      value={speechPitch} onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                      className="w-12 sm:w-16 accent-emerald-500"
                    />
                  </div>
                  
                  <div className="w-full flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-slate-500">{t('aiLanguage')}:</span>
                    <select 
                      value={aiLanguage}
                      onChange={(e) => {
                        setAiLanguage(e.target.value);
                        setSameAsApp(e.target.value === appLanguage);
                      }}
                      className="text-xs bg-slate-50 border border-slate-200 rounded p-1 outline-none focus:border-emerald-500 text-slate-700"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 ml-2 text-xs text-slate-500 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={sameAsApp} 
                        onChange={(e) => setSameAsApp(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-3 h-3"
                      />
                      {t('sameAsApp')}
                    </label>
                  </div>
                </div>

                {messages.length === 1 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {examplePrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(prompt)}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors border border-slate-200"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="flex items-end gap-2 bg-slate-50 border border-slate-300 rounded-2xl p-1 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-3 rounded-xl shrink-0 transition-colors
                      ${isListening ? 'bg-red-100 text-red-600' : 'text-slate-500 hover:bg-slate-200'}`}
                    title={isListening ? "Stop listening" : "Speak your question"}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={t('chatPlaceholder')}
                    className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-sm sm:text-base outline-none"
                    rows={1}
                  />
                  
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputValue.trim() || isChatLoading}
                    className={`p-3 rounded-xl shrink-0 transition-colors
                      ${!inputValue.trim() || isChatLoading 
                        ? 'text-slate-400 cursor-not-allowed' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <div className="text-center mt-2">
                  <span className="text-[10px] text-slate-400">{t('aiMistakes')}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Term Explainer Modal */}
      {isTermModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                {isExplainingTerm ? t('loading') : termExplanation?.term || t('medicalTerm')}
              </h2>
              <div className="flex items-center gap-2">
                {termExplanation && (
                  <button 
                    onClick={() => {
                      const textToRead = `${termExplanation.term}. ${termExplanation.simple_explanation}. Causes: ${termExplanation.causes}. Symptoms: ${termExplanation.symptoms}. Why it matters: ${termExplanation.importance}. Treatment: ${termExplanation.treatment}. Lifestyle recommendations: ${termExplanation.lifestyle}.`;
                      speak(textToRead, 'modal-term', aiLanguage, voiceStyle, speechRate, speechPitch);
                    }}
                    disabled={isGenerating === 'modal-term'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${isPlaying === 'modal-term' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {isGenerating === 'modal-term' ? <RefreshCw className="w-4 h-4 animate-spin" /> : isPlaying === 'modal-term' ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    {isGenerating === 'modal-term' ? t('loading') : isPlaying === 'modal-term' ? t('stop') : t('listen')}
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsTermModalOpen(false);
                    if (isPlaying === 'modal-term' || isGenerating === 'modal-term') stop();
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {isExplainingTerm ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin mb-4 text-emerald-500" />
                  <p>{t('analyzingKnowledge')}</p>
                </div>
              ) : termExplanation ? (
                <div className="space-y-6">
                  <section>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('whatItIs')}</h4>
                    <p className="text-slate-800 leading-relaxed">{termExplanation.simple_explanation}</p>
                  </section>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <section className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                      <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-2">{t('causes')}</h4>
                      <p className="text-orange-900 text-sm leading-relaxed">{termExplanation.causes}</p>
                    </section>
                    
                    <section className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-2">{t('symptoms')}</h4>
                      <p className="text-blue-900 text-sm leading-relaxed">{termExplanation.symptoms}</p>
                    </section>
                  </div>

                  <section>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('whyItMatters')}</h4>
                    <p className="text-slate-800 leading-relaxed">{termExplanation.importance}</p>
                  </section>

                  <section>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('treatment')}</h4>
                    <p className="text-slate-800 leading-relaxed">{termExplanation.treatment}</p>
                  </section>

                  <section className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-2">{t('lifestyle')}</h4>
                    <p className="text-emerald-900 text-sm leading-relaxed">{termExplanation.lifestyle}</p>
                  </section>
                  
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-slate-500 bg-slate-50 p-3 rounded-lg">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <p className="text-xs italic">
                      {t('disclaimerTerm')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-red-500 py-8">{t('failedToLoad')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

