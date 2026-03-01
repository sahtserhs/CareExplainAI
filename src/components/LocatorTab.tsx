import React, { useState, useEffect } from 'react';
import { MapPin, Phone, ExternalLink, Navigation, CheckCircle2, AlertTriangle, RefreshCw, Volume2, Square, X, MessageSquare } from 'lucide-react';
import { Clinic, findClinics } from '../services/hrsaLocatorService';
import { useLanguage } from '../i18n/LanguageContext';
import { GoogleGenAI } from '@google/genai';
import { useTTS } from '../hooks/useTTS';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type LocatorTabProps = {
  needs: {
    conditions: string[];
    medications: string[];
    followUp: string[];
    pharmacyNeeded: boolean;
  };
};

export const LocatorTab: React.FC<LocatorTabProps> = ({ needs }) => {
  const { t, aiLanguage, appLanguage } = useLanguage();
  const { isPlaying, isGenerating, speak, stop } = useTTS();
  
  const [zipCode, setZipCode] = useState('');
  const [radius, setRadius] = useState(10);
  const [uninsuredOnly, setUninsuredOnly] = useState(true);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [callScript, setCallScript] = useState<{ english: string; translated: string } | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Editable needs
  const [activeNeeds, setActiveNeeds] = useState<string[]>([]);

  useEffect(() => {
    const allNeeds = [
      ...needs.conditions,
      ...needs.medications,
      ...needs.followUp,
      ...(needs.pharmacyNeeded ? ['Pharmacy'] : [])
    ];
    setActiveNeeds(Array.from(new Set(allNeeds)));
  }, [needs]);

  const removeNeed = (needToRemove: string) => {
    setActiveNeeds(prev => prev.filter(n => n !== needToRemove));
  };

  const handleSearch = async () => {
    if (!zipCode.trim()) {
      setError("Please enter a ZIP code or city.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await findClinics(zipCode, radius, uninsuredOnly);
      setClinics(results);
      if (results.length === 0) {
        setError("No clinics found. Try increasing the radius or turning off 'Uninsured only'.");
      }
    } catch (err) {
      setError("Failed to find clinics. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // For hackathon, we'll just mock reverse geocoding by setting a fake zip
          // In a real app, call a geocoding API here.
          setZipCode("Current Location");
        },
        () => {
          setError("Failed to get location. Please enter manually.");
        }
      );
    }
  };

  const generateCallScript = async (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setScriptModalOpen(true);
    setIsGeneratingScript(true);
    setCallScript(null);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a short call script for a patient calling a clinic.
        Patient needs: ${activeNeeds.join(', ')}.
        Uninsured: ${uninsuredOnly}.
        Clinic: ${clinic.name}.
        Provide the script in English and in ${aiLanguage}.
        Include questions like asking for sliding-scale fees (if uninsured), making an appointment for the specific needs, and what documents to bring.
        Return JSON: { "english": "...", "translated": "..." }`,
        config: {
          responseMimeType: "application/json"
        }
      });

      if (response.text) {
        setCallScript(JSON.parse(response.text));
      }
    } catch (err) {
      console.error("Failed to generate script:", err);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const hasSpecialistFollowUp = needs.followUp.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{t('locatorTitle')}</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('zipCode')}</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={zipCode}
                onChange={e => setZipCode(e.target.value)}
                placeholder="e.g. 90210"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-emerald-500"
              />
              <button 
                onClick={handleUseMyLocation}
                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                title={t('useMyLocation')}
              >
                <MapPin className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('radius')}</label>
            <select 
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value={5}>5 {t('miles')}</option>
              <option value={10}>10 {t('miles')}</option>
              <option value={25}>25 {t('miles')}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <input 
            type="checkbox" 
            id="uninsured" 
            checked={uninsuredOnly} 
            onChange={e => setUninsuredOnly(e.target.checked)} 
            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" 
          />
          <label htmlFor="uninsured" className="text-sm text-slate-700 cursor-pointer">{t('uninsuredOnly')}</label>
        </div>

        <button
          onClick={handleSearch}
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-xl text-white font-medium text-sm transition-all flex items-center justify-center gap-2
            ${isLoading ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow'}`}
        >
          {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          {isLoading ? t('loading') : t('findClinics')}
        </button>
      </div>

      {/* Detected Needs */}
      {activeNeeds.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">{t('detectedNeeds')}</h4>
          <div className="flex flex-wrap gap-2">
            {activeNeeds.map(need => (
              <span key={need} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-100">
                {need}
                <button onClick={() => removeNeed(need)} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Specialist Banner */}
      {hasSpecialistFollowUp && uninsuredOnly && clinics.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            {t('specialistBanner')}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      {/* Results */}
      {clinics.length > 0 && (
        <div className="space-y-4">
          {clinics.map(clinic => (
            <div key={clinic.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 relative overflow-hidden">
              {clinic.isFQHC && hasSpecialistFollowUp && uninsuredOnly && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                  {t('bestFirstStep')}
                </div>
              )}
              
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-lg font-bold text-slate-800 pr-24">{clinic.name}</h4>
                <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{clinic.distanceMiles} {t('miles')}</span>
              </div>
              
              <p className="text-slate-600 text-sm mb-3">{clinic.address}</p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {clinic.services.map(service => (
                  <span key={service} className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    {service}
                  </span>
                ))}
              </div>
              
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                <a href={`tel:${clinic.phone}`} className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                  <Phone className="w-4 h-4" /> {clinic.phone}
                </a>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(clinic.name + ' ' + clinic.address)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                  <Navigation className="w-4 h-4" /> {t('openInMaps')}
                </a>
                <button 
                  onClick={() => generateCallScript(clinic)}
                  className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                >
                  <MessageSquare className="w-4 h-4" /> {t('callScript')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-center mt-4">
        <p className="text-xs text-slate-400">{t('disclaimerLocator')}</p>
      </div>

      {/* Call Script Modal */}
      {scriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">{t('callScript')}</h2>
              <button 
                onClick={() => {
                  setScriptModalOpen(false);
                  stop();
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {isGeneratingScript ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin mb-4 text-purple-500" />
                  <p>{t('generating')}</p>
                </div>
              ) : callScript ? (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{aiLanguage}</h4>
                      <button 
                        onClick={() => speak(callScript.translated, 'script-translated', aiLanguage, 'Auto/Native', 1, 1)}
                        disabled={isGenerating === 'script-translated'}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        {isGenerating === 'script-translated' ? <RefreshCw className="w-4 h-4 animate-spin" /> : isPlaying === 'script-translated' ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed">{callScript.translated}</p>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">English</h4>
                      <button 
                        onClick={() => speak(callScript.english, 'script-english', 'English', 'Auto/Native', 1, 1)}
                        disabled={isGenerating === 'script-english'}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        {isGenerating === 'script-english' ? <RefreshCw className="w-4 h-4 animate-spin" /> : isPlaying === 'script-english' ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed">{callScript.english}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
