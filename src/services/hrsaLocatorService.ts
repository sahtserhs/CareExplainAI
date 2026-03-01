export type Clinic = {
  id: string;
  name: string;
  address: string;
  phone: string;
  distanceMiles: number;
  website: string | null;
  services: string[];
  isFQHC: boolean;
};

// Simple in-memory cache
const cache: Record<string, { data: Clinic[]; timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Haversine formula to calculate distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const findClinics = async (zipOrCity: string, radius: number, uninsuredOnly: boolean): Promise<Clinic[]> => {
  const cacheKey = `${zipOrCity.toLowerCase().trim()}_${radius}_${uninsuredOnly}`;
  
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  try {
    // 1. Geocode the zip code or city
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zipOrCity)}&country=US&format=json&limit=1`;
    const geocodeRes = await fetch(geocodeUrl, {
      headers: { 'User-Agent': 'CareExplain-Hackathon-App/1.0' }
    });
    
    if (!geocodeRes.ok) throw new Error('Geocoding failed');
    const geocodeData = await geocodeRes.json();
    
    if (!geocodeData || geocodeData.length === 0) {
      throw new Error('Location not found');
    }

    const lat = parseFloat(geocodeData[0].lat);
    const lon = parseFloat(geocodeData[0].lon);
    const radiusMeters = radius * 1609.34;

    // 2. Query Overpass API for clinics
    const overpassQuery = `
      [out:json];
      (
        node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
        way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
        node["healthcare"="centre"](around:${radiusMeters},${lat},${lon});
        way["healthcare"="centre"](around:${radiusMeters},${lat},${lon});
        node["healthcare"="clinic"](around:${radiusMeters},${lat},${lon});
        way["healthcare"="clinic"](around:${radiusMeters},${lat},${lon});
      );
      out center;
    `;

    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery
    });

    if (!overpassRes.ok) throw new Error('Overpass API failed');
    const overpassData = await overpassRes.json();

    const results: Clinic[] = [];

    for (const element of overpassData.elements) {
      const tags = element.tags || {};
      const name = tags.name;
      if (!name) continue;

      const elementLat = element.lat || element.center?.lat;
      const elementLon = element.lon || element.center?.lon;
      
      if (!elementLat || !elementLon) continue;

      const distanceMiles = calculateDistance(lat, lon, elementLat, elementLon);
      
      // Filter by radius (just to be safe)
      if (distanceMiles > radius) continue;

      // Determine if it might be an FQHC or community clinic based on name
      const nameLower = name.toLowerCase();
      const isFQHC = nameLower.includes('community') || 
                     nameLower.includes('family') || 
                     nameLower.includes('public') ||
                     nameLower.includes('health center');

      // If uninsured only is checked, we only want FQHCs or community clinics
      if (uninsuredOnly && !isFQHC) continue;

      // Build address
      const addressParts = [];
      if (tags['addr:housenumber'] && tags['addr:street']) {
        addressParts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
      }
      if (tags['addr:city']) addressParts.push(tags['addr:city']);
      if (tags['addr:state']) addressParts.push(tags['addr:state']);
      if (tags['addr:postcode']) addressParts.push(tags['addr:postcode']);
      
      const address = addressParts.length > 0 ? addressParts.join(', ') : 'Address not available';

      // Infer services
      const services = ['Primary Care'];
      if (nameLower.includes('dental') || tags['healthcare:speciality'] === 'dental') services.push('Dental');
      if (nameLower.includes('women') || tags['healthcare:speciality'] === 'gynaecology') services.push("Women's Health");
      if (nameLower.includes('behavioral') || nameLower.includes('mental')) services.push('Behavioral Health');
      if (tags.pharmacy === 'yes' || nameLower.includes('pharmacy')) services.push('Pharmacy');

      results.push({
        id: element.id.toString(),
        name,
        address,
        phone: tags.phone || 'Phone not available',
        distanceMiles: parseFloat(distanceMiles.toFixed(1)),
        website: tags.website || null,
        services,
        isFQHC
      });
    }

    // Sort by distance
    results.sort((a, b) => a.distanceMiles - b.distanceMiles);

    // Cache the results
    cache[cacheKey] = {
      data: results,
      timestamp: Date.now()
    };

    return results;
  } catch (error) {
    console.error('Error fetching clinics:', error);
    throw error;
  }
};
