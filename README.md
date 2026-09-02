# RTMP Web View

A lightweight internal web viewer for MediaMTX streams.

The viewer is designed to run on the same Windows machine as MediaMTX and provides a simple browser interface for approved stream paths such as `atem` and `drone`.

## Current features

- Live WebRTC viewing through MediaMTX
- ATEM / Drone source selector
- Live/offline status handling
- Recording discovery through the MediaMTX playback API
- Direct MP4 download links for recorded periods
- No database or external Node packages required

## Expected MediaMTX services

The defaults used by this project are:

- WebRTC: port `8889`
- Playback API: port `9996`
- Web viewer: port `8080`

The viewer automatically uses the hostname that was used to open the page, so no server IP is hard-coded into the repository.

## Install on Windows

Clone the repository into your RTMP folder:

```powershell
cd C:\rtmp
git clone https://github.com/Scerno/rtmp-web-view.git web
cd web
```

Make sure Node.js is installed, then start the viewer:

```powershell
npm start
```

Open from the server itself:

```text
http://localhost:8080
```

Or from another device on the same network:

```text
http://<server-ip>:8080
```

## Updating

```powershell
cd C:\rtmp\web
git pull
```

Then restart the Node process if it is already running.

## MediaMTX paths

The current interface expects these approved stream paths:

- `atem`
- `drone`

These can be changed in `public/viewer.js` later if needed.

## Security

This project does not add its own authentication layer. Access should therefore be controlled at the network and MediaMTX level as appropriate.
