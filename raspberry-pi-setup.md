# SF Transit Board - Raspberry Pi Kiosk Setup

## Quick Start

1. Copy the entire `signboard` folder to your Raspberry Pi (e.g., to `/home/pi/signboard`)

2. Make the script executable:
   ```bash
   chmod +x /home/pi/signboard/start-kiosk.sh
   ```

3. Run manually to test:
   ```bash
   /home/pi/signboard/start-kiosk.sh
   ```

## Auto-Start on Boot

### Option 1: Autostart (Desktop)

Create autostart entry:
```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/signboard.desktop
```

Add this content:
```
[Desktop Entry]
Type=Application
Name=SF Transit Board
Exec=/home/pi/signboard/start-kiosk.sh
```

### Option 2: systemd Service (Headless with X)

Create service file:
```bash
sudo nano /etc/systemd/system/signboard.service
```

Add:
```
[Unit]
Description=SF Transit Board Kiosk
After=graphical.target

[Service]
Environment=DISPLAY=:0
ExecStart=/home/pi/signboard/start-kiosk.sh
Restart=on-failure
User=pi

[Install]
WantedBy=graphical.target
```

Enable:
```bash
sudo systemctl enable signboard
sudo systemctl start signboard
```

## Disable Screen Blanking

Edit `/etc/lightdm/lightdm.conf` and add under `[Seat:*]`:
```
xserver-command=X -s 0 -dpms
```

Or run:
```bash
xset s off
xset -dpms
xset s noblank
```

## Hide Mouse Cursor

Install unclutter:
```bash
sudo apt install unclutter
```

Add to autostart or run:
```bash
unclutter -idle 0.1 -root &
```

## Rotate Display (if needed)

Edit `/boot/config.txt`:
```
display_rotate=1  # 90 degrees
display_rotate=2  # 180 degrees
display_rotate=3  # 270 degrees
```

## Requirements

- Python 3 (pre-installed on Raspberry Pi OS)
- Chromium browser (pre-installed on Raspberry Pi OS)
- Internet connection for API calls
