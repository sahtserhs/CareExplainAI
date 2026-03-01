// HACKATHON-READY
export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  distanceMiles: number;
  website: string;
  services: string[];
  isFQHC: boolean;
  slidingScale: boolean;
}

const MOCK_DATA: Clinic[] = [
  {
    id: "mock-1",
    name: "Community Health First",
    address: "123 Main St, Springfield",
    phone: "555-0101",
    distanceMiles: 1.2,
    website: "https://example.com/clinic1",
    services: ["Primary Care", "Dental", "Pharmacy"],
    isFQHC: true,
    slidingScale: true,
  },
  {
    id: "mock-2",
    name: "Downtown Family Clinic",
    address: "456 Oak Ave, Springfield",
    phone: "555-0102",
    distanceMiles: 3.5,
    website: "https://example.com/clinic2",
    services: ["Primary Care", "Pediatrics"],
    isFQHC: false,
    slidingScale: true,
  },
  {
    id: "mock-3",
    name: "Westside Wellness Center",
    address: "789 Pine Rd, Springfield",
    phone: "555-0103",
    distanceMiles: 5.0,
    website: "https://example.com/clinic3",
    services: ["Primary Care", "Mental Health", "Pharmacy"],
    isFQHC: true,
    slidingScale: true,
  },
  {
    id: "mock-4",
    name: "Northside Urgent Care",
    address: "321 Elm St, Springfield",
    phone: "555-0104",
    distanceMiles: 8.1,
    website: "https://example.com/clinic4",
    services: ["Urgent Care", "X-Ray"],
    isFQHC: false,
    slidingScale: false,
  }
];

const cache = new Map<string, any>();

export async function findClinics({
  zip,
  radius,
  uninsuredOnly,
  lat,
  lng
}: {
  zip: string;
  radius: number;
  uninsuredOnly: boolean;
  lat?: number;
  lng?: number;
}): Promise<{ data: Clinic[]; isMock: boolean; error?: string }> {
  const cacheKey = `${zip}-${radius}-${uninsuredOnly}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    // HRSA API doesn't always have CORS enabled for direct browser calls, but we will try.
    // The prompt asks to call https://findahealthcenter.hrsa.gov/api/v1/findahealthcenter?zip={zip}&radius={radius}
    const response = await fetch(`https://findahealthcenter.hrsa.gov/api/v1/findahealthcenter?zip=${zip}&radius=${radius}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const json = await response.json();
    
    // Normalize response
    // Assuming HRSA returns an array of centers in json or json.data
    const centers = Array.isArray(json) ? json : (json.data || []);
    
    let data: Clinic[] = centers.map((c: any) => ({
      id: c.Site_Id || Math.random().toString(),
      name: c.Site_Name || "Unknown Clinic",
      address: `${c.Site_Address || ''}, ${c.Site_City || ''}, ${c.Site_State_Abbr || ''} ${c.Site_Postal_Code || ''}`.trim(),
      phone: c.Site_Telephone_Number || "",
      distanceMiles: parseFloat(c.Distance) || 0,
      website: c.Site_Web_Address || "",
      services: [], // HRSA API doesn't always return detailed services in this endpoint, mock it or leave empty
      isFQHC: true, // HRSA centers are generally FQHCs
      slidingScale: true, // FQHCs offer sliding scale
    }));

    if (uninsuredOnly) {
      data = data.filter(c => c.slidingScale || c.isFQHC);
    }

    // Sort by distance
    data.sort((a, b) => a.distanceMiles - b.distanceMiles);

    const result = { data, isMock: false };
    cache.set(cacheKey, result);
    return result;

  } catch (error: any) {
    console.warn("HRSA API failed, falling back to mock data:", error);
    const result = { data: MOCK_DATA, isMock: true, error: error.message };
    cache.set(cacheKey, result);
    return result;
  }
}
