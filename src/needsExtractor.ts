// HACKATHON-READY

export interface ExtractedNeeds {
  conditions: string[];
  medications: string[];
  followUp: string[];
  pharmacyNeeded: boolean;
}

const CONDITIONS_LIST = [
  "diabetes", "asthma", "hypertension", "copd", "depression", 
  "anxiety", "arthritis", "cancer", "heart disease", "obesity"
];

const MEDICATIONS_LIST = [
  "insulin", "albuterol", "metformin", "lisinopril", "amoxicillin", 
  "omeprazole", "atorvastatin", "levothyroxine", "amlodipine", "sertraline"
];

const SPECIALTY_LIST = [
  "cardiology", "endocrinology", "primary care", "nephrology", 
  "pulmonology", "neurology", "psychiatry", "dermatology", "gastroenterology"
];

const PHARMACY_KEYWORDS = ["pickup", "refill", "pharmacy", "prescription", "medication"];

export function extractNeeds(documentText: string): ExtractedNeeds {
  const text = documentText.toLowerCase();
  
  const conditions = CONDITIONS_LIST.filter(c => text.includes(c));
  const medications = MEDICATIONS_LIST.filter(m => text.includes(m));
  const followUp = SPECIALTY_LIST.filter(s => text.includes(s));
  const pharmacyNeeded = PHARMACY_KEYWORDS.some(k => text.includes(k));

  return {
    conditions,
    medications,
    followUp,
    pharmacyNeeded
  };
}
