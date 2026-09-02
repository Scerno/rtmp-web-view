# RTMP Web View

A lightweight internal web viewer for MediaMTX streams.

The viewer is designed to run on the same Windows machine as MediaMTX and provides a simple browser interface for approved stream paths such as `atem` and `drone`.

## Current features

- Live WebRTC viewing through MediaMTX
- ATEM / Drone source selector
- Live/offline status handling
- Dynamic page title showing the selected live source or recording
- Recording discovery from the local MediaMTX recording folders
- Playback of completed MP4 recording files in the main viewer
- Review of the currently active recording file
- Normal browser video controls and seeking for recording playback
- Selected-recording highlighting in the recordings list
- HTTP byte-range support for efficient seeking
- Browser-friendly cache headers for completed recordings
- No database or external Node packages required

## Expected MediaMTX services

The defaults used by this project are:

- WebRTC: port `8889`
- Web viewer: port `8080`

The viewer automatically uses the hostname that was used to open the page, so no server IP is hard-coded into the repository.

MediaMTX recordings are expected in a `Streams` directory, typically alongside the `web` folder:

```text
C:\rtmp\
├── Streams\
│   ├── atem\
│   └── drone\
└── web\
```

The Node server searches upwards from the repository location for the nearest `Streams` folder. You can also explicitly set the recording location with the `STREAMS_DIR` environment variable.

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

If `server.js` has changed, restart the Node process afterwards.

## MediaMTX paths

The current interface expects these approved stream paths:

- `atem`
- `drone`

These are currently explicit in the project and can be changed later if required.

## Recording playback

Completed MediaMTX MP4 files are served directly by the Node server rather than being regenerated through the MediaMTX playback `/get` endpoint. This allows the browser to use normal video seeking, HTTP byte-range requests and caching.

The current recording file can also be reviewed while MediaMTX is still writing to it. Reopening that recording refreshes the file metadata so the latest available footage can be reviewed. For the lowest-latency current view, use the live WebRTC feed.

## Security

This project does not add its own authentication layer. Access should therefore be controlled at the network and MediaMTX level as appropriate.

No server IP address, credentials or recording content should be committed to the repository. The included `.gitignore` excludes MP4 files, `Streams/`, environment files and common Node build/runtime files.
