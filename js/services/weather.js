/**
 * Weather Service
 * Fetches current weather and forecast from OpenWeatherMap API
 */

class WeatherService {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
        this.geoUrl = 'https://api.openweathermap.org/geo/1.0';
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
     * Get weather icon emoji from OpenWeatherMap icon code
     */
    getWeatherEmoji(iconCode) {
        const iconMap = {
            '01d': '☀️', '01n': '🌙',
            '02d': '⛅', '02n': '☁️',
            '03d': '☁️', '03n': '☁️',
            '04d': '☁️', '04n': '☁️',
            '09d': '🌧️', '09n': '🌧️',
            '10d': '🌦️', '10n': '🌧️',
            '11d': '⛈️', '11n': '⛈️',
            '13d': '❄️', '13n': '❄️',
            '50d': '🌫️', '50n': '🌫️'
        };
        return iconMap[iconCode] || '🌡️';
    }

    /**
     * Get coordinates from location name
     */
    async geocode(location) {
        if (!this.apiKey) {
            throw new Error('Weather API key not configured');
        }

        const response = await fetch(
            `${this.geoUrl}/direct?q=${encodeURIComponent(location)}&limit=1&appid=${this.apiKey}`
        );

        if (!response.ok) {
            throw new Error('Failed to geocode location');
        }

        const data = await response.json();
        if (data.length === 0) {
            throw new Error('Location not found');
        }

        return {
            lat: data[0].lat,
            lon: data[0].lon,
            name: data[0].name,
            state: data[0].state,
            country: data[0].country
        };
    }

    /**
     * Get current weather by coordinates
     */
    async getCurrentWeather(lat, lon, units = 'imperial') {
        if (!this.apiKey) {
            throw new Error('Weather API key not configured');
        }

        const response = await fetch(
            `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${this.apiKey}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch weather data');
        }

        const data = await response.json();

        return {
            temp: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            humidity: data.main.humidity,
            condition: data.weather[0].main,
            description: data.weather[0].description,
            icon: this.getWeatherEmoji(data.weather[0].icon),
            windSpeed: Math.round(data.wind.speed),
            windDirection: data.wind.deg,
            visibility: data.visibility,
            sunrise: new Date(data.sys.sunrise * 1000),
            sunset: new Date(data.sys.sunset * 1000),
            location: data.name
        };
    }

    /**
     * Get 5-day forecast by coordinates
     */
    async getForecast(lat, lon, units = 'imperial') {
        if (!this.apiKey) {
            throw new Error('Weather API key not configured');
        }

        const response = await fetch(
            `${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${this.apiKey}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch forecast data');
        }

        const data = await response.json();

        // Group by day and get daily highs/lows
        const dailyData = {};
        data.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dayKey = date.toDateString();

            if (!dailyData[dayKey]) {
                dailyData[dayKey] = {
                    date: date,
                    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    temps: [],
                    icons: [],
                    conditions: []
                };
            }

            dailyData[dayKey].temps.push(item.main.temp);
            dailyData[dayKey].icons.push(item.weather[0].icon);
            dailyData[dayKey].conditions.push(item.weather[0].main);
        });

        // Process into forecast array
        const forecast = Object.values(dailyData).slice(0, 5).map(day => {
            // Get most common condition/icon for the day
            const iconCounts = {};
            day.icons.forEach(icon => {
                iconCounts[icon] = (iconCounts[icon] || 0) + 1;
            });
            const mostCommonIcon = Object.entries(iconCounts)
                .sort((a, b) => b[1] - a[1])[0][0];

            return {
                day: day.day,
                date: day.date,
                high: Math.round(Math.max(...day.temps)),
                low: Math.round(Math.min(...day.temps)),
                icon: this.getWeatherEmoji(mostCommonIcon),
                condition: day.conditions[0]
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
     * Get weather by location name
     */
    async getWeatherByLocation(location, units = 'imperial') {
        const coords = await this.geocode(location);
        return this.getWeatherData(coords.lat, coords.lon, units);
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
