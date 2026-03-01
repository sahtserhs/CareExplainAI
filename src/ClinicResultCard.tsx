// HACKATHON-READY
import React, { useState } from 'react';
import { Clinic } from './hrsaLocatorService';
import { MapPin, Phone, ExternalLink, Plus, Check, FileText } from 'lucide-react';
import { CallScriptModal } from './CallScriptModal';

interface ClinicResultCardProps {
  clinic: Clinic;
  needs: { activeChips: string[], pharmacyNeeded: boolean };
  lang: 'en' | 'es' | 'zh' | 'fr' | 'ar';
  onSaveToCare: (item: string) => void;
}

const STRINGS = {
  en: {
    fqhcBadge: "Best first step for referrals",
    slidingScale: "Sliding Scale",
    openInMaps: "Open in Maps",
    saveToCare: "Save to Care Plan",
    saved: "Saved!",
    callScript: "Call Script",
    bestPrimary: "Best for primary care",
    pharmacyAvail: "Pharmacy available",
  },
  es: {
    fqhcBadge: "Mejor primer paso para derivaciones",
    slidingScale: "Escala móvil",
    openInMaps: "Abrir en Maps",
    saveToCare: "Guardar en plan",
    saved: "¡Guardado!",
    callScript: "Guion de llamada",
    bestPrimary: "Mejor para atención primaria",
    pharmacyAvail: "Farmacia disponible",
  },
  zh: {
    fqhcBadge: "转诊的最佳第一步",
    slidingScale: "滑动收费标准",
    openInMaps: "在地图中打开",
    saveToCare: "保存到护理计划",
    saved: "已保存！",
    callScript: "通话脚本",
    bestPrimary: "最佳初级保健",
    pharmacyAvail: "提供药房",
  },
  fr: {
    fqhcBadge: "Meilleure première étape pour les références",
    slidingScale: "Échelle mobile",
    openInMaps: "Ouvrir dans Maps",
    saveToCare: "Enregistrer au plan",
    saved: "Enregistré !",
    callScript: "Script d'appel",
    bestPrimary: "Idéal pour les soins primaires",
    pharmacyAvail: "Pharmacie disponible",
  },
  ar: {
    fqhcBadge: "أفضل خطوة أولى للإحالات",
    slidingScale: "مقياس متدرج",
    openInMaps: "افتح في الخرائط",
    saveToCare: "حفظ في خطة الرعاية",
    saved: "تم الحفظ!",
    callScript: "نص المكالمة",
    bestPrimary: "الأفضل للرعاية الأولية",
    pharmacyAvail: "صيدلية متاحة",
  }
};

export function ClinicResultCard({ clinic, needs, lang, onSaveToCare }: ClinicResultCardProps) {
  const t = STRINGS[lang] || STRINGS.en;
  const [saved, setSaved] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);

  const handleSave = () => {
    onSaveToCare(`Visit ${clinic.name} at ${clinic.address} (Phone: ${clinic.phone})`);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.name + ' ' + clinic.address)}`;

  const isPrimaryCareMatch = needs.activeChips.some(c => ['diabetes', 'hypertension', 'primary care'].includes(c));
  const isPharmacyMatch = needs.activeChips.includes('pharmacy') || needs.pharmacyNeeded;

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-gray-900">{clinic.name}</h3>
              <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {clinic.distanceMiles.toFixed(1)} mi
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2">
              {clinic.isFQHC && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  {t.fqhcBadge}
                </span>
              )}
              {clinic.slidingScale && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                  {t.slidingScale}
                </span>
              )}
              {isPrimaryCareMatch && clinic.services.some(s => s.toLowerCase().includes('primary')) && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                  {t.bestPrimary}
                </span>
              )}
              {isPharmacyMatch && clinic.services.some(s => s.toLowerCase().includes('pharmacy')) && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 border border-teal-200">
                  {t.pharmacyAvail}
                </span>
              )}
            </div>

            <div className="text-sm text-gray-600 space-y-1 mt-3">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <span>{clinic.address}</span>
              </div>
              {clinic.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={16} className="shrink-0 text-gray-400" />
                  <a href={`tel:${clinic.phone}`} className="text-blue-600 hover:underline font-medium">
                    {clinic.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto shrink-0">
            <a 
              href={mapsUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink size={16} />
              {t.openInMaps}
            </a>
            <button 
              onClick={handleSave}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                saved ? 'bg-green-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {saved ? <Check size={16} /> : <Plus size={16} />}
              {saved ? t.saved : t.saveToCare}
            </button>
            <button 
              onClick={() => setShowScriptModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <FileText size={16} />
              {t.callScript}
            </button>
          </div>
        </div>
      </div>

      {showScriptModal && (
        <CallScriptModal 
          clinic={clinic} 
          needs={needs} 
          lang={lang} 
          onClose={() => setShowScriptModal(false)} 
        />
      )}
    </>
  );
}
