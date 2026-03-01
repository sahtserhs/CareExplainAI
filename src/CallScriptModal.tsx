// HACKATHON-READY
import React, { useState, useEffect } from 'react';
import { Clinic } from './hrsaLocatorService';
import { X, Volume2, Copy, Check, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface CallScriptModalProps {
  clinic: Clinic;
  needs: { activeChips: string[] };
  lang: 'en' | 'es' | 'zh' | 'fr' | 'ar';
  onClose: () => void;
}

const STRINGS = {
  en: { title: "Phone Call Script", copy: "Copy", copied: "Copied!", close: "Close" },
  es: { title: "Guion de llamada telefónica", copy: "Copiar", copied: "¡Copiado!", close: "Cerrar" },
  zh: { title: "电话脚本", copy: "复制", copied: "已复制！", close: "关闭" },
  fr: { title: "Script d'appel téléphonique", copy: "Copier", copied: "Copié !", close: "Fermer" },
  ar: { title: "نص المكالمة الهاتفية", copy: "نسخ", copied: "تم النسخ!", close: "إغلاق" }
};

export function CallScriptModal({ clinic, needs, lang, onClose }: CallScriptModalProps) {
  const t = STRINGS[lang] || STRINGS.en;
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    async function generateScript() {
      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          setScript("Error: Gemini API key not found in environment variables.");
          setLoading(false);
          return;
        }

        const ai = new GoogleGenAI({ apiKey });
        
        const conditionsStr = needs.activeChips.filter(c => !['primary care', 'pharmacy'].includes(c)).join(', ') || 'general care';
        const followUpStr = needs.activeChips.filter(c => ['primary care', 'cardiology', 'endocrinology'].includes(c)).join(', ') || 'a checkup';

        const prompt = \`
Generate a short phone call script in \${lang} for a patient who:
- Has no insurance
- Needs follow-up for: \${followUpStr}
- Has conditions: \${conditionsStr}
- Is calling: \${clinic.name}
Include: ask about sliding-scale fees, appointment for condition, what documents to bring.
Format: numbered steps, plain language, under 150 words. Then provide English translation if lang != en.
        \`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });

        setScript(response.text || "Could not generate script.");
      } catch (error: any) {
        console.error("Gemini API error:", error);
        setScript("Error generating script. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    generateScript();
  }, [clinic, needs, lang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel(); // Stop any playing audio
    
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(script);
    
    // Try to set appropriate language voice
    const langMap: Record<string, string> = { en: 'en-US', es: 'es-ES', zh: 'zh-CN', fr: 'fr-FR', ar: 'ar-SA' };
    utterance.lang = langMap[lang] || 'en-US';
    
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-sm text-gray-500">Generating personalized script...</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {script}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <button 
            onClick={handleSpeak}
            disabled={loading}
            className={\`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors \${
              isPlaying ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            } disabled:opacity-50\`}
          >
            <Volume2 size={18} className={isPlaying ? 'animate-pulse' : ''} />
            {isPlaying ? 'Stop' : 'Listen'}
          </button>
          
          <div className="flex gap-3">
            <button 
              onClick={handleCopy}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
              {copied ? t.copied : t.copy}
            </button>
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              {t.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
