/**
 * Weather Service
 * Fetches current weather and forecast from Tomorrow.io API
 */

class WeatherService {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://api.tomorrow.io/v4';
        this.cache = null;
        this.cacheTime = 0;
        this.cacheDuration = 10 * 60 * 1000; // 10 minutes
    }

    /**
     * Set API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.cache = null; // Clear cache when API key changes
    }

    /**
     * Check if service is configured
     */
    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Get weather icon emoji from Tomorrow.io weather code
     */
    getWeatherEmoji(weatherCode) {
        // Tomorrow.io weather codes: https://docs.tomorrow.io/reference/data-layers-weather-codes
        const iconMap = {
            1000: '☀️',  // Clear, Sunny
            1100: '🌤️',  // Mostly Clear
            1101: '⛅',  // Partly Cloudy
            1102: '🌥️',  // Mostly Cloudy
            1001: '☁️',  // Cloudy
            2000: '🌫️',  // Fog
            2100: '🌫️',  // Light Fog
            4000: '🌧️',  // Drizzle
            4001: '🌧️',  // Rain
            4200: '🌧️',  // Light Rain
            4201: '🌧️',  // Heavy Rain
            5000: '🌨️',  // Snow
            5001: '🌨️',  // Flurries
            5100: '🌨️',  // Light Snow
            5101: '❄️',  // Heavy Snow
            6000: '🌧️',  // Freezing Drizzle
            6001: '🌧️',  // Freezing Rain
            6200: '🌧️',  // Light Freezing Rain
            6201: '🌧️',  // Heavy Freezing Rain
            7000: '🌨️',  // Ice Pellets
            7101: '🌨️',  // Heavy Ice Pellets
            7102: '🌨️',  // Light Ice Pellets
            8000: '⛈️',  // Thunderstorm
        };
        return iconMap[weatherCode] || '🌡️';
    }

    /**
     * Get condition name from Tomorrow.io weather code
     */
    getConditionName(weatherCode) {
        const conditions = {
            1000: 'Clear',
            1100: 'Mostly Clear',
            1101: 'Partly Cloudy',
            1102: 'Mostly Cloudy',
            1001: 'Cloudy',
            2000: 'Fog',
            2100: 'Light Fog',
            4000: 'Drizzle',
            4001: 'Rain',
            4200: 'Light Rain',
            4201: 'Heavy Rain',
            5000: 'Snow',
            5001: 'Flurries',
            5100: 'Light Snow',
            5101: 'Heavy Snow',
            6000: 'Freezing Drizzle',
            6001: 'Freezing Rain',
            6200: 'Light Freezing Rain',
            6201: 'Heavy Freezing Rain',
            7000: 'Ice Pellets',
            7101: 'Heavy Ice Pellets',
            7102: 'Light Ice Pellets',
            8000: 'Thunderstorm',
        };
        return conditions[weatherCode] || 'Unknown';
    }

    /**
     * Get current weather by coordinates
     */
    async getCurrentWeather(lat, lon, units = 'imperial') {
        if (!this.apiKey) {
            throw new Error('Weather API key not configured');
        }

        const unitSystem = units === 'metric' ? 'metric' : 'imperial';
        const url = `${this.baseUrl}/weather/realtime?location=${lat},${lon}&units=${unitSystem}&apikey=${this.apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch weather data');
        }

        const data = await response.json();
        const values = data.data.values;

        return {
            temp: Math.round(values.temperature),
            feelsLike: Math.round(values.temperatureApparent),
            humidity: Math.round(values.humidity),
            condition: this.getConditionName(values.weatherCode),
            description: this.getConditionName(values.weatherCode),
            icon: this.getWeatherEmoji(values.weatherCode),
            windSpeed: Math.round(values.windSpeed),
            windDirection: values.windDirection,
            visibility: values.visibility,
            uvIndex: values.uvIndex,
            location: `${lat.toFixed(2)}, ${lon.toFixed(2)}`
        };
    }

    /**
     * Get forecast by coordinates
     */
    async getForecast(lat, lon, units = 'imperial') {
        if (!this.apiKey) {
            throw new Error('Weather API key not configured');
        }

        const unitSystem = units === 'metric' ? 'metric' : 'imperial';
        const url = `${this.baseUrl}/weather/forecast?location=${lat},${lon}&units=${unitSystem}&timesteps=1d&apikey=${this.apiKey}`;

        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch forecast data');
        }

        const data = await response.json();
        const dailyTimelines = data.timelines?.daily || [];

        const forecast = dailyTimelines.slice(0, 5).map(day => {
            const date = new Date(day.time);
            const values = day.values;

            return {
                day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                date: date,
                high: Math.round(values.temperatureMax),
                low: Math.round(values.temperatureMin),
                icon: this.getWeatherEmoji(values.weatherCodeMax || values.weatherCodeMin),
                condition: this.getConditionName(values.weatherCodeMax || values.weatherCodeMin)
            };
        });

        return forecast;
    }

    /**
     * Get weather data (current + forecast) with caching
     */
    async getWeatherData(lat, lon, units = 'imperial') {
        // Check cache
        const now = Date.now();
        if (this.cache && (now - this.cacheTime) < this.cacheDuration) {
            return this.cache;
        }

        const [current, forecast] = await Promise.all([
            this.getCurrentWeather(lat, lon, units),
            this.getForecast(lat, lon, units)
        ]);

        const data = { current, forecast };

        // Update cache
        this.cache = data;
        this.cacheTime = now;

        return data;
    }

    /**
     * Get weather by location name using geocoding
     */
    async getWeatherByLocation(location, units = 'imperial') {
        if (!this.apiKey) {
            throw new Error('Weather API key not configured');
        }

        // Use Tomorrow.io's location parameter which accepts place names
        const unitSystem = units === 'metric' ? 'metric' : 'imperial';

        // First get realtime to find the resolved location
        const realtimeUrl = `${this.baseUrl}/weather/realtime?location=${encodeURIComponent(location)}&units=${unitSystem}&apikey=${this.apiKey}`;
        const realtimeResponse = await fetch(realtimeUrl);

        if (!realtimeResponse.ok) {
            const errorData = await realtimeResponse.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch weather data');
        }

        const realtimeData = await realtimeResponse.json();
        const resolvedLocation = realtimeData.location;

        // Now get forecast for the same location
        const forecastUrl = `${this.baseUrl}/weather/forecast?location=${encodeURIComponent(location)}&units=${unitSystem}&timesteps=1d&apikey=${this.apiKey}`;
        const forecastResponse = await fetch(forecastUrl);

        if (!forecastResponse.ok) {
            const errorData = await forecastResponse.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch forecast data');
        }

        const forecastData = await forecastResponse.json();

        const values = realtimeData.data.values;
        const current = {
            temp: Math.round(values.temperature),
            feelsLike: Math.round(values.temperatureApparent),
            humidity: Math.round(values.humidity),
            condition: this.getConditionName(values.weatherCode),
            description: this.getConditionName(values.weatherCode),
            icon: this.getWeatherEmoji(values.weatherCode),
            windSpeed: Math.round(values.windSpeed),
            windDirection: values.windDirection,
            visibility: values.visibility,
            uvIndex: values.uvIndex,
            location: resolvedLocation?.name || location
        };

        const dailyTimelines = forecastData.timelines?.daily || [];
        const forecast = dailyTimelines.slice(0, 5).map(day => {
            const date = new Date(day.time);
            const dayValues = day.values;

            return {
                day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                date: date,
                high: Math.round(dayValues.temperatureMax),
                low: Math.round(dayValues.temperatureMin),
                icon: this.getWeatherEmoji(dayValues.weatherCodeMax || dayValues.weatherCodeMin),
                condition: this.getConditionName(dayValues.weatherCodeMax || dayValues.weatherCodeMin)
            };
        });

        const data = { current, forecast };

        // Update cache
        this.cache = data;
        this.cacheTime = Date.now();

        return data;
    }

    /**
     * Get weather by current GPS position
     */
    async getWeatherByCurrentLocation(units = 'imperial') {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const data = await this.getWeatherData(
                            position.coords.latitude,
                            position.coords.longitude,
                            units
                        );
                        resolve(data);
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
}

// Create global instance
const weatherService = new WeatherService();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WeatherService, weatherService };
}
