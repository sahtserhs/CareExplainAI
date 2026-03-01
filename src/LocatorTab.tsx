// HACKATHON-READY
import React, { useState, useEffect } from 'react';
import { extractNeeds, ExtractedNeeds } from './needsExtractor';
import { findClinics, Clinic } from './hrsaLocatorService';
import { ClinicResultCard } from './ClinicResultCard';
import { MapPin, Search, X, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

interface LocatorTabProps {
  documentText: string;
  lang: 'en' | 'es' | 'zh' | 'fr' | 'ar';
  addToCarePlan: (item: string) => void;
}

const STRINGS = {
  en: {
    zipPlaceholder: "ZIP code",
    cityStatePlaceholder: "City, State (optional)",
    useLocation: "Use My Location",
    radius: "Radius",
    uninsuredToggle: "Uninsured/Low-cost only",
    findBtn: "Find Clinics Near Me",
    detectedNeeds: "Detected Needs",
    specialistBanner: "If you can't access a specialist directly, start with a community health center. They can treat you and refer you to low-cost specialists.",
    mockBanner: "Showing sample results — HRSA API unavailable",
    retry: "Retry",
    openHrsa: "Open HRSA search",
    disclaimer: "This helps locate services; it is not medical advice. Seek emergency care if severe symptoms.",
    miles: "miles",
    noResults: "No clinics found. Try expanding your search.",
    loading: "Searching for clinics..."
  },
  es: {
    zipPlaceholder: "Código postal",
    cityStatePlaceholder: "Ciudad, Estado (opcional)",
    useLocation: "Usar mi ubicación",
    radius: "Radio",
    uninsuredToggle: "Solo sin seguro/Bajo costo",
    findBtn: "Buscar clínicas cerca de mí",
    detectedNeeds: "Necesidades detectadas",
    specialistBanner: "Si no puede acceder a un especialista directamente, comience con un centro de salud comunitario. Pueden tratarlo y derivarlo a especialistas de bajo costo.",
    mockBanner: "Mostrando resultados de muestra — API de HRSA no disponible",
    retry: "Reintentar",
    openHrsa: "Abrir búsqueda de HRSA",
    disclaimer: "Esto ayuda a localizar servicios; no es un consejo médico. Busque atención de emergencia si tiene síntomas graves.",
    miles: "millas",
    noResults: "No se encontraron clínicas. Intente ampliar su búsqueda.",
    loading: "Buscando clínicas..."
  },
  zh: {
    zipPlaceholder: "邮政编码",
    cityStatePlaceholder: "城市，州（可选）",
    useLocation: "使用我的位置",
    radius: "半径",
    uninsuredToggle: "仅限无保险/低成本",
    findBtn: "查找我附近的诊所",
    detectedNeeds: "检测到的需求",
    specialistBanner: "如果您无法直接看专科医生，请从社区卫生中心开始。他们可以为您治疗并将您转诊给低成本的专科医生。",
    mockBanner: "显示示例结果 — HRSA API 不可用",
    retry: "重试",
    openHrsa: "打开 HRSA 搜索",
    disclaimer: "这有助于定位服务；这不是医疗建议。如果症状严重，请寻求紧急护理。",
    miles: "英里",
    noResults: "未找到诊所。请尝试扩大搜索范围。",
    loading: "正在搜索诊所..."
  },
  fr: {
    zipPlaceholder: "Code postal",
    cityStatePlaceholder: "Ville, État (facultatif)",
    useLocation: "Utiliser ma position",
    radius: "Rayon",
    uninsuredToggle: "Sans assurance/Faible coût uniquement",
    findBtn: "Trouver des cliniques près de chez moi",
    detectedNeeds: "Besoins détectés",
    specialistBanner: "Si vous ne pouvez pas consulter directement un spécialiste, commencez par un centre de santé communautaire. Ils peuvent vous traiter et vous orienter vers des spécialistes à faible coût.",
    mockBanner: "Affichage d'exemples de résultats — API HRSA indisponible",
    retry: "Réessayer",
    openHrsa: "Ouvrir la recherche HRSA",
    disclaimer: "Ceci aide à localiser des services ; ce n'est pas un avis médical. Consultez les urgences en cas de symptômes graves.",
    miles: "miles",
    noResults: "Aucune clinique trouvée. Essayez d'élargir votre recherche.",
    loading: "Recherche de cliniques..."
  },
  ar: {
    zipPlaceholder: "الرمز البريدي",
    cityStatePlaceholder: "المدينة، الولاية (اختياري)",
    useLocation: "استخدم موقعي",
    radius: "نصف القطر",
    uninsuredToggle: "بدون تأمين/تكلفة منخفضة فقط",
    findBtn: "ابحث عن عيادات بالقرب مني",
    detectedNeeds: "الاحتياجات المكتشفة",
    specialistBanner: "إذا لم تتمكن من الوصول إلى أخصائي مباشرة، فابدأ بمركز صحي مجتمعي. يمكنهم علاجك وإحالتك إلى أخصائيين بتكلفة منخفضة.",
    mockBanner: "عرض نتائج نموذجية — واجهة برمجة تطبيقات HRSA غير متوفرة",
    retry: "إعادة المحاولة",
    openHrsa: "افتح بحث HRSA",
    disclaimer: "هذا يساعد في تحديد موقع الخدمات؛ إنها ليست نصيحة طبية. اطلب رعاية الطوارئ إذا كانت الأعراض شديدة.",
    miles: "أميال",
    noResults: "لم يتم العثور على عيادات. حاول توسيع نطاق البحث.",
    loading: "جاري البحث عن عيادات..."
  }
};

export function LocatorTab({ documentText, lang, addToCarePlan }: LocatorTabProps) {
  const t = STRINGS[lang] || STRINGS.en;
  
  const [zip, setZip] = useState("");
  const [cityState, setCityState] = useState("");
  const [radius, setRadius] = useState<number>(10);
  const [uninsuredOnly, setUninsuredOnly] = useState(true);
  
  const [needs, setNeeds] = useState<ExtractedNeeds>({ conditions: [], medications: [], followUp: [], pharmacyNeeded: false });
  const [activeChips, setActiveChips] = useState<string[]>([]);
  
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const extracted = extractNeeds(documentText);
    setNeeds(extracted);
    
    const chips = [
      ...extracted.conditions,
      ...extracted.medications,
      ...extracted.followUp,
      ...(extracted.pharmacyNeeded ? ["pharmacy"] : [])
    ];
    setActiveChips(chips);
  }, [documentText]);

  const removeChip = (chipToRemove: string) => {
    setActiveChips(prev => prev.filter(c => c !== chipToRemove));
  };

  const handleUseLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In a real app, we might reverse geocode to get ZIP.
          // For now, we just set a placeholder or use coords directly if API supported it.
          setZip("Location Acquired");
        },
        (error) => console.error("Geolocation error:", error)
      );
    }
  };

  const handleSearch = async () => {
    if (!zip) return;
    setLoading(true);
    setSearched(true);
    
    const result = await findClinics({ zip, radius, uninsuredOnly });
    
    // Rank FQHCs first
    const sortedClinics = [...result.data].sort((a, b) => {
      if (a.isFQHC && !b.isFQHC) return -1;
      if (!a.isFQHC && b.isFQHC) return 1;
      return a.distanceMiles - b.distanceMiles;
    });

    setClinics(sortedClinics);
    setIsMock(result.isMock);
    setLoading(false);
  };

  const showSpecialistBanner = needs.followUp.length > 0 && uninsuredOnly;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Search Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder={t.zipPlaceholder}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
              <button 
                onClick={handleUseLocation}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                title={t.useLocation}
              >
                <MapPin size={20} />
              </button>
            </div>
            <input 
              type="text" 
              placeholder={t.cityStatePlaceholder}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={cityState}
              onChange={(e) => setCityState(e.target.value)}
            />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">{t.radius}:</label>
              <select 
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              >
                <option value={5}>5 {t.miles}</option>
                <option value={10}>10 {t.miles}</option>
                <option value={25}>25 {t.miles}</option>
              </select>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                checked={uninsuredOnly}
                onChange={(e) => setUninsuredOnly(e.target.checked)}
              />
              <span className="text-gray-700 font-medium">{t.uninsuredToggle}</span>
            </label>
          </div>
        </div>
        
        <button 
          onClick={handleSearch}
          disabled={!zip || loading}
          className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <RefreshCw className="animate-spin" size={20} /> : <Search size={20} />}
          {loading ? t.loading : t.findBtn}
        </button>
      </div>

      {/* Detected Needs Chips */}
      {activeChips.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">{t.detectedNeeds}</h3>
          <div className="flex flex-wrap gap-2">
            {activeChips.map(chip => (
              <span key={chip} className="inline-flex items-center gap-1 px-3 py-1 bg-white text-blue-700 text-sm font-medium rounded-full border border-blue-200 shadow-sm">
                {chip}
                <button onClick={() => removeChip(chip)} className="hover:text-blue-900 focus:outline-none">
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Specialist Banner */}
      {showSpecialistBanner && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg flex items-start gap-3">
          <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-yellow-800">{t.specialistBanner}</p>
        </div>
      )}

      {/* Mock Data Banner */}
      {isMock && searched && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-orange-800">
            <AlertTriangle size={20} className="shrink-0" />
            <span className="text-sm font-medium">{t.mockBanner}</span>
          </div>
          <div className="flex gap-3 shrink-0">
            <button onClick={handleSearch} className="text-sm font-medium text-orange-700 hover:text-orange-900 bg-orange-100 px-3 py-1.5 rounded-md transition-colors">
              {t.retry}
            </button>
            <a href="https://findahealthcenter.hrsa.gov/" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1">
              {t.openHrsa} <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Results */}
      {searched && !loading && clinics.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          {t.noResults}
        </div>
      )}

      {searched && !loading && clinics.length > 0 && (
        <div className="space-y-4">
          {clinics.map((clinic, idx) => (
            <ClinicResultCard 
              key={clinic.id} 
              clinic={clinic} 
              needs={{ ...needs, activeChips }}
              lang={lang}
              onSaveToCare={addToCarePlan}
            />
          ))}
        </div>
      )}

      {/* Footer Disclaimer */}
      <div className="text-center text-xs text-gray-500 mt-8 pb-4">
        {t.disclaimer}
      </div>
    </div>
  );
}
