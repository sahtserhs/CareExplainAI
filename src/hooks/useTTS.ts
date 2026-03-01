import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export function useTTS() {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    activeIdRef.current = null;
    window.speechSynthesis.cancel();
    
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop(); } catch (e) {}
      try { currentAudioSourceRef.current.disconnect(); } catch (e) {}
      currentAudioSourceRef.current = null;
    }
    setIsPlaying(null);
    setIsGenerating(null);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const speak = useCallback(async (
    text: string, 
    id: string, 
    language: string, 
    voiceStyle: string, 
    speechRate: number, 
    speechPitch: number
  ) => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in your browser.");
      return;
    }

    if (activeIdRef.current === id) {
      stop();
      return;
    }

    stop(); // Stop anything currently playing
    activeIdRef.current = id;
    
    const langCode = LANG_CODES[language] || 'en-US';
    const voices = window.speechSynthesis.getVoices();
    const hasNativeVoice = voices.some(v => v.lang.startsWith(langCode.split('-')[0]));

    let useGemini = false;
    if (!hasNativeVoice || voiceStyle !== 'Auto/Native') {
      useGemini = true;
    }

    if (useGemini) {
      setIsGenerating(id);
      try {
        const voiceMap: Record<string, string> = {
          'Girl voice': 'Kore',
          'Deep voice': 'Charon',
          'Manly voice': 'Fenrir',
          'Neutral': 'Puck',
          'Auto/Native': 'Kore'
        };
        const voiceName = voiceMap[voiceStyle] || 'Kore';
        
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        if (activeIdRef.current !== id) return; // Abort if stopped or changed during fetch

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          audioContextRef.current = audioCtx;
          
          const binaryString = window.atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const buffer = bytes.buffer;
          const audioBuffer = audioCtx.createBuffer(1, buffer.byteLength / 2, 24000);
          const channelData = audioBuffer.getChannelData(0);
          const dataView = new DataView(buffer);
          for (let i = 0; i < channelData.length; i++) {
            channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
          }
          
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = speechRate;
          
          source.connect(audioCtx.destination);
          source.start();
          
          source.onended = () => {
            if (activeIdRef.current === id) {
              setIsPlaying(null);
              activeIdRef.current = null;
            }
          };
          
          currentAudioSourceRef.current = source;
          setIsGenerating(null);
          setIsPlaying(id);
        } else {
          if (activeIdRef.current === id) {
            setIsGenerating(null);
            activeIdRef.current = null;
          }
        }
      } catch (err) {
        console.error("TTS Error:", err);
        if (activeIdRef.current === id) {
          setIsGenerating(null);
          activeIdRef.current = null;
        }
      }
    } else {
      setIsPlaying(id);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;
      
      utterance.onend = () => {
        if (activeIdRef.current === id) {
          setIsPlaying(null);
          activeIdRef.current = null;
        }
      };
      utterance.onerror = () => {
        if (activeIdRef.current === id) {
          setIsPlaying(null);
          activeIdRef.current = null;
        }
      };
      
      window.speechSynthesis.speak(utterance);
    }
  }, [stop]);

  return { isPlaying, isGenerating, speak, stop };
}
