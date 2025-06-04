// mayoristapro/backend/src/utils/geoUtils.js

/**
 * Calculates the distance between two geographical coordinates.
 * Placeholder function for MVP.
 * In a real application, this would use a library like Haversine or an external API.
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} The calculated distance in kilometers (mocked for now).
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Mock implementation for MVP
  console.warn(
    'geoUtils.calculateDistance is using a mock implementation. Replace with actual calculation for production.'
  );
  // Simulate a distance calculation, not geographically accurate
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // For MVP, let's return a somewhat predictable but varying value based on inputs
  // to simulate some difference without being always fixed.
  if (lat1 && lon1 && lat2 && lon2) {
      // A very rough approximation that will vary with input to some degree
      const mockDistance = Math.abs(lat1 - lat2) * 111 + Math.abs(lon1 - lon2) * 111; // Very rough
      return parseFloat(mockDistance.toFixed(2));
  }
  return 5.0; // Default mock distance in km
};

/**
 * Gets coordinates for a given address.
 * Placeholder function for MVP.
 * In a real application, this would use a geocoding service (e.g., Google Geocoding API).
 * @param {object} address - Address object (e.g., { street, city, state, zip })
 * @returns {object|null} An object with { latitude, longitude } or null if not found (mocked).
 */
const getCoordinatesForAddress = (address) => {
  // Mock implementation for MVP
  console.warn(
    'geoUtils.getCoordinatesForAddress is using a mock implementation. Replace with actual geocoding for production.'
  );
  if (address && address.street && address.city) {
    // Simulate some coordinates based on address length or hash for variability
    const hash = (s) => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
    const lat = parseFloat((34.0522 + (hash(address.street) % 1000) / 10000).toFixed(7)); // Example: Los Angeles area
    const lon = parseFloat((-118.2437 + (hash(address.city) % 1000) / 10000).toFixed(7));
    return { latitude: lat, longitude: lon };
  }
  return { latitude: 34.052235, longitude: -118.243683 }; // Default mock coordinates (e.g., Los Angeles)
};

module.exports = {
  calculateDistance,
  getCoordinatesForAddress,
};
