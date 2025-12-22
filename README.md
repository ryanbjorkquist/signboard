# SF Transit Board

A retro split-flap display web application showing real-time San Francisco transit arrivals, weather, news, and your Google Calendar. Perfect for running on a Raspberry Pi with a connected display.

![Split-Flap Display](https://img.shields.io/badge/style-retro-yellow)
![Made for SF](https://img.shields.io/badge/made_for-SF-orange)

## Features

- **Split-Flap Animation**: Authentic mechanical flip-board aesthetic with CSS animations
- **Weather Display**: Current conditions and 5-day forecast via OpenWeatherMap
- **Muni Arrivals**: Real-time SF transit data from 511.org API
- **News Feed**: Headlines from local SF news sources (KQED, SF Chronicle, etc.)
- **Google Calendar**: Your upcoming events with OAuth integration
- **Multiple Themes**: Dark, Light, Amber CRT, Green CRT
- **Location-Based**: Uses GPS for nearby transit stops and local weather
- **Configurable**: All API keys and preferences saved locally

## Quick Start

1. **Clone and serve the files:**
   ```bash
   git clone <repo-url>
   cd signboard
   # Serve with any static file server
   python3 -m http.server 8000
   # or
   npx serve .
   ```

2. **Open in browser:**
   ```
   http://localhost:8000
   ```

3. **Configure API keys** (click ⚙ settings gear):
   - **Weather**: Get a free API key from [OpenWeatherMap](https://openweathermap.org/api)
   - **Transit**: Get a free API key from [511.org](https://511.org/open-data/token)
   - **Calendar**: Set up OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

## API Setup

### OpenWeatherMap (Weather)

1. Sign up at [openweathermap.org](https://openweathermap.org/)
2. Go to API Keys in your account
3. Copy your API key
4. Paste in Settings → Weather → API Key

### 511.org (Transit)

1. Sign up at [511.org/open-data/token](https://511.org/open-data/token)
2. Request an API token
3. Copy the token from your email
4. Paste in Settings → Transit → API Key

### Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials (Web application type)
5. Add your domain to authorized JavaScript origins
6. Create an API key
7. Enter both Client ID and API Key in Settings → Calendar
8. Click "Connect Google Calendar"

## Raspberry Pi Setup

### Hardware Requirements
- Raspberry Pi 3/4/5
- MicroSD card (8GB+)
- Display (HDMI or official touchscreen)
- Power supply

### Installation

1. **Install Raspberry Pi OS** (Lite or Desktop)

2. **Install a browser** (if using Lite):
   ```bash
   sudo apt update
   sudo apt install chromium-browser
   ```

3. **Clone the repository:**
   ```bash
   git clone <repo-url> ~/signboard
   ```

4. **Install a web server:**
   ```bash
   sudo apt install nginx
   sudo ln -s ~/signboard /var/www/html/signboard
   ```

5. **Auto-start in kiosk mode** (add to ~/.config/lxsession/LXDE-pi/autostart):
   ```
   @chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost/signboard
   ```

6. **Disable screen blanking:**
   ```bash
   sudo raspi-config
   # Navigate to Display Options → Screen Blanking → Disable
   ```

## Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| Refresh Interval | How often to fetch new data | 60 seconds |
| Theme | Display theme (dark/light/amber/green) | dark |
| Use Location | Use GPS for transit/weather | enabled |
| Weather Location | Fallback location if GPS unavailable | San Francisco, CA |
| Temperature Unit | Fahrenheit or Celsius | Fahrenheit |
| Transit Agency | SF Muni, BART, Caltrain, AC Transit | SF Muni |
| Max Stops | Number of nearby stops to query | 5 |
| Favorite Stops | Specific stop IDs to always show | (empty) |
| News Source | RSS feed to display | KQED |
| Calendar Days | Days ahead to show events | 3 |

## Keyboard Shortcuts

- `Ctrl/Cmd + S` - Open settings
- `Escape` - Close settings modal

## Customization

### Adding Custom News Sources

Edit `js/services/news.js` to add more RSS feeds:

```javascript
this.sources = {
    mynews: {
        name: 'My News Source',
        url: 'https://example.com/rss'
    },
    // ...
};
```

### Changing Colors

Edit CSS variables in `css/style.css`:

```css
:root {
    --accent: #ffcc00;        /* Main accent color */
    --flap-bg: #1a1a1a;       /* Split-flap background */
    --flap-text: #f5f5dc;     /* Split-flap text */
}
```

## Project Structure

```
signboard/
├── index.html              # Main HTML file
├── css/
│   └── style.css           # All styles including themes
├── js/
│   ├── app.js              # Main application logic
│   ├── splitflap.js        # Split-flap animation component
│   └── services/
│       ├── weather.js      # OpenWeatherMap integration
│       ├── transit.js      # 511.org transit integration
│       ├── news.js         # RSS feed integration
│       └── calendar.js     # Google Calendar integration
└── README.md
```

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting

### Transit data not loading
- Verify your 511.org API key is valid
- Check browser console for CORS errors
- Ensure location permissions are granted

### Calendar not connecting
- Verify both Client ID and API Key are entered
- Check that your domain is in authorized origins
- Try signing out and reconnecting

### Weather not updating
- Verify OpenWeatherMap API key
- Check that location permissions are granted
- Try entering a manual location

## License

MIT License - Feel free to modify and use for personal projects.

## Acknowledgments

- Split-flap display inspiration from classic train station boards
- Transit data from [511.org](https://511.org/)
- Weather data from [OpenWeatherMap](https://openweathermap.org/)
