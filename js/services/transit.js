/**
 * Transit Service
 * Fetches real-time transit arrivals from 511.org SF Bay API
 */

class TransitService {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://api.511.org/transit';
        this.agency = 'SF'; // Default to SF Muni
        this.cache = {};
        this.cacheDuration = 30 * 1000; // 30 seconds
    }

    /**
     * Set API configuration
     */
    configure(apiKey, agency = 'SF') {
        this.apiKey = apiKey;
        this.agency = agency;
        this.cache = {};
    }

    /**
     * Check if service is configured
     */
    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Get line color based on route name
     */
    getLineColor(routeName) {
        // SF Muni line colors
        const colors = {
            'N': '#1E90FF',   // N Judah - Blue
            'J': '#FFA500',   // J Church - Orange
            'K': '#1E90FF',   // K Ingleside - Blue
            'L': '#800080',   // L Taraval - Purple
            'M': '#008000',   // M Ocean View - Green
            'T': '#FF0000',   // T Third - Red
            'F': '#228B22',   // F Market - Green (historic)
            'E': '#808080',   // E Embarcadero - Grey
            // Bus lines are typically numbered
        };
        return colors[routeName] || '#FFD700';
    }

    /**
     * Get all stops for the agency
     */
    async getStops() {
        if (!this.apiKey) {
            throw new Error('Transit API key not configured');
        }

        const cacheKey = `stops_${this.agency}`;
        const cached = this.getCached(cacheKey, 60 * 60 * 1000); // 1 hour cache
        if (cached) return cached;

        const url = `${this.baseUrl}/stops?api_key=${this.apiKey}&operator_id=${this.agency}&format=json`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            // 511.org returns data with BOM, need to handle that
            const text = await response.text();
            const cleanText = text.replace(/^\uFEFF/, '');
            const data = JSON.parse(cleanText);

            const stops = data.Contents?.dataObjects?.ScheduledStopPoint || [];
            const processedStops = stops.map(stop => ({
                id: stop.id,
                name: stop.Name,
                lat: parseFloat(stop.Location?.Latitude || 0),
                lon: parseFloat(stop.Location?.Longitude || 0)
            }));

            this.setCache(cacheKey, processedStops);
            return processedStops;
        } catch (error) {
            console.error('Failed to fetch stops:', error);
            throw error;
        }
    }

    /**
     * Get real-time departures for a specific stop
     */
    async getStopDepartures(stopCode) {
        if (!this.apiKey) {
            throw new Error('Transit API key not configured');
        }

        const cacheKey = `departures_${this.agency}_${stopCode}`;
        const cached = this.getCached(cacheKey, this.cacheDuration);
        if (cached) return cached;

        const url = `${this.baseUrl}/StopMonitoring?api_key=${this.apiKey}&agency=${this.agency}&stopCode=${stopCode}&format=json`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const text = await response.text();
            const cleanText = text.replace(/^\uFEFF/, '');
            const data = JSON.parse(cleanText);

            const visits = data.ServiceDelivery?.StopMonitoringDelivery?.MonitoredStopVisit || [];

            const departures = visits.map(visit => {
                const journey = visit.MonitoredVehicleJourney;
                const call = journey.MonitoredCall;

                // Calculate minutes until arrival
                const expectedTime = call.ExpectedArrivalTime || call.ExpectedDepartureTime;
                const aimedTime = call.AimedArrivalTime || call.AimedDepartureTime;
                const arrivalTime = new Date(expectedTime || aimedTime);
                const now = new Date();
                const minutesAway = Math.round((arrivalTime - now) / 60000);

                return {
                    line: journey.PublishedLineName || journey.LineRef,
                    destination: journey.DestinationName,
                    stopName: call.StopPointName,
                    minutesAway: Math.max(0, minutesAway),
                    arrivalTime: arrivalTime,
                    isRealTime: !!expectedTime,
                    vehicleRef: journey.VehicleRef,
                    occupancy: journey.Occupancy,
                    color: this.getLineColor(journey.PublishedLineName)
                };
            });

            // Sort by arrival time
            departures.sort((a, b) => a.minutesAway - b.minutesAway);

            this.setCache(cacheKey, departures);
            return departures;
        } catch (error) {
            console.error('Failed to fetch departures:', error);
            throw error;
        }
    }

    /**
     * Find nearby stops based on coordinates
     */
    async getNearbyStops(lat, lon, maxDistance = 0.5) {
        const stops = await this.getStops();

        // Calculate distance and filter
        const nearbyStops = stops
            .map(stop => ({
                ...stop,
                distance: this.calculateDistance(lat, lon, stop.lat, stop.lon)
            }))
            .filter(stop => stop.distance <= maxDistance)
            .sort((a, b) => a.distance - b.distance);

        return nearbyStops;
    }

    /**
     * Get departures for nearby stops
     */
    async getNearbyDepartures(lat, lon, maxStops = 5) {
        const nearbyStops = await this.getNearbyStops(lat, lon);
        const topStops = nearbyStops.slice(0, maxStops);

        const allDepartures = [];

        for (const stop of topStops) {
            try {
                const departures = await this.getStopDepartures(stop.id);
                departures.forEach(dep => {
                    allDepartures.push({
                        ...dep,
                        stopId: stop.id,
                        stopDistance: stop.distance
                    });
                });
            } catch (error) {
                console.warn(`Failed to get departures for stop ${stop.id}:`, error);
            }
        }

        // Sort by arrival time
        allDepartures.sort((a, b) => a.minutesAway - b.minutesAway);

        return allDepartures;
    }

    /**
     * Get departures for specific stop IDs
     */
    async getDeparturesForStops(stopIds) {
        const allDepartures = [];

        for (const stopId of stopIds) {
            try {
                const departures = await this.getStopDepartures(stopId);
                allDepartures.push(...departures);
            } catch (error) {
                console.warn(`Failed to get departures for stop ${stopId}:`, error);
            }
        }

        // Sort by arrival time
        allDepartures.sort((a, b) => a.minutesAway - b.minutesAway);

        return allDepartures;
    }

    /**
     * Get current location and fetch nearby departures
     */
    async getDeparturesByCurrentLocation(maxStops = 5) {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const departures = await this.getNearbyDepartures(
                            position.coords.latitude,
                            position.coords.longitude,
                            maxStops
                        );
                        resolve(departures);
                    } catch (error) {
                        reject(error);
                    }
                },
                (error) => {
                    reject(new Error(`Geolocation error: ${error.message}`));
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    /**
     * Calculate distance between two coordinates (in miles)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    /**
     * Cache helpers
     */
    getCached(key, maxAge) {
        const cached = this.cache[key];
        if (cached && (Date.now() - cached.time) < maxAge) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache[key] = { data, time: Date.now() };
    }

    /**
     * Format minutes for display
     */
    static formatMinutes(minutes) {
        if (minutes === 0) return 'NOW';
        if (minutes === 1) return '1 min';
        return `${minutes} min`;
    }
}

// Create global instance
const transitService = new TransitService();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TransitService, transitService };
}
