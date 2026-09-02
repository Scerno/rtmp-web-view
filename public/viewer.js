const mediaHost = window.location.hostname;
const webRtcBase = `http://${mediaHost}:8889`;

// Approved MediaMTX paths currently shown by the viewer.
// These are intentionally explicit rather than dynamically discovered.
const sources = ['atem', 'drone'];
let currentSource = 'atem';
let currentMode = 'live';
let currentRecordingName = null;
let liveLoadArmed = false;

const viewerTitle = document.getElementById('viewer-title');
const liveViewer = document.getElementById('live-viewer');
const recordingViewer = document.getElementById('recording-viewer');
const goLiveButton = document.getElementById('go-live');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const recordingsList = document.getElementById('recordings-list');
const refreshButton = document.getElementById('refresh-recordings');
const sourceButtons = [...document.querySelectorAll('.source-button')];

function setStatus(state, text) {
	statusDot.className = `status-dot ${state}`;
	statusText.textContent = text;
}

function setViewerTitle(text) {
	viewerTitle.textContent = text;
	document.title = text;
}

function formatDuration(seconds) {
	const total = Math.max(0, Math.round(Number(seconds) || 0));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const secs = total % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m ${secs}s`;
	}

	if (minutes > 0) {
		return `${minutes}m ${secs}s`;
	}

	return `${secs}s`;
}

function formatFileSize(bytes) {
	const size = Number(bytes) || 0;

	if (size >= 1024 ** 3) {
		return `${(size / 1024 ** 3).toFixed(2)} GB`;
	}

	if (size >= 1024 ** 2) {
		return `${(size / 1024 ** 2).toFixed(1)} MB`;
	}

	if (size >= 1024) {
		return `${(size / 1024).toFixed(1)} KB`;
	}

	return `${size} B`;
}

function formatDate(value) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat('en-GB', {
		dateStyle: 'medium',
		timeStyle: 'medium'
	}).format(date);
}

function formatTitleDate(value) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).format(date).replace(',', '');
}

function buildRecordingUrl(recording, source = currentSource) {
	const url = `/recordings/${encodeURIComponent(source)}/${encodeURIComponent(recording.name)}`;

	// An active file is continually changing. Give each explicit reload a unique
	// URL so the browser always asks Node for the current file size/metadata.
	if (recording.active) {
		return `${url}?v=${encodeURIComponent(recording.modified || Date.now())}`;
	}

	return url;
}

function loadLiveViewer() {
	currentMode = 'live';
	currentRecordingName = null;

	recordingViewer.pause();
	recordingViewer.removeAttribute('src');
	recordingViewer.load();
	recordingViewer.hidden = true;

	liveViewer.hidden = false;
	goLiveButton.hidden = true;

	setViewerTitle(`Video Streams - ${currentSource.toUpperCase()} Live View`);
	setStatus('', `Connecting to ${currentSource.toUpperCase()} live stream...`);

	// Remove any selected-recording highlight immediately.
	document.querySelectorAll('.recording-row.active').forEach(row => {
		row.classList.remove('active');
	});

	// Force the iframe to create a completely fresh MediaMTX WebRTC session.
	// Merely assigning the same URL again can leave a failed/stale iframe untouched.
	liveLoadArmed = false;
	liveViewer.src = 'about:blank';

	setTimeout(() => {
		if (currentMode !== 'live') {
			return;
		}

		liveLoadArmed = true;
		liveViewer.src = `${webRtcBase}/${encodeURIComponent(currentSource)}?controls=true&muted=false`;
	}, 50);
}

async function playRecording(recording) {
	const source = currentSource;
	const recordingUrl = buildRecordingUrl(recording, source);

	currentMode = 'recording';
	currentRecordingName = recording.name;
	liveLoadArmed = false;
	liveViewer.src = 'about:blank';
	liveViewer.hidden = true;

	recordingViewer.hidden = false;
	goLiveButton.hidden = false;

	recordingViewer.src = recordingUrl;
	recordingViewer.load();

	setViewerTitle(`Video Streams - ${source.toUpperCase()} Recording: ${formatTitleDate(recording.start)}`);

	if (recording.active) {
		setStatus('recorded', `${source.toUpperCase()} recording in progress - ${formatDate(recording.start)}`);
	} else {
		setStatus('recorded', `${source.toUpperCase()} recording - ${formatDate(recording.start)}`);
	}

	// Apply the highlight immediately without waiting for the next list refresh.
	document.querySelectorAll('.recording-row').forEach(row => {
		row.classList.toggle('active', row.dataset.recordingName === currentRecordingName);
	});

	try {
		await recordingViewer.play();
	} catch (error) {
		// The recording is loaded and can be started with the player's Play control.
	}
}

async function loadRecordings() {
	try {
		const response = await fetch(`/api/recordings?source=${encodeURIComponent(currentSource)}`, {
			cache: 'no-store'
		});

		if (!response.ok) {
			throw new Error(`Recording API returned ${response.status}`);
		}

		const recordings = await response.json();

		if (!Array.isArray(recordings) || recordings.length === 0) {
			recordingsList.innerHTML = '<p class="empty-state">No recordings are available for this source.</p>';
			return;
		}

		recordingsList.innerHTML = '';

		recordings.forEach(recording => {
			const row = document.createElement('div');
			row.className = 'recording-row';
			row.dataset.recordingName = recording.name;

			if (currentMode === 'recording' && recording.name === currentRecordingName) {
				row.classList.add('active');
			}

			const meta = document.createElement('div');
			meta.className = 'recording-meta';

			const time = document.createElement('span');
			time.className = 'recording-time';
			time.textContent = formatDate(recording.start);

			const detail = document.createElement('span');
			detail.className = 'recording-duration';

			const playButton = document.createElement('button');
			playButton.className = 'recording-link';
			playButton.type = 'button';

			if (recording.active) {
				detail.textContent = `Recording now · ${formatFileSize(recording.size)}`;
				playButton.textContent = recording.name === currentRecordingName ? 'Reload Recording' : 'Review Recording';
				playButton.addEventListener('click', () => playRecording(recording));
			} else {
				detail.textContent = `${formatDuration(recording.duration)} · ${formatFileSize(recording.size)}`;
				playButton.textContent = recording.name === currentRecordingName ? 'Playing' : 'Play';
				playButton.addEventListener('click', () => playRecording(recording));
			}

			meta.append(time, detail);
			row.append(meta, playButton);
			recordingsList.append(row);
		});
	} catch (error) {
		recordingsList.innerHTML = `<p class="empty-state">Could not load recordings: ${error.message}</p>`;
	}
}

function selectSource(source) {
	if (!sources.includes(source)) {
		return;
	}

	currentSource = source;

	sourceButtons.forEach(button => {
		button.classList.toggle('active', button.dataset.source === currentSource);
	});

	loadLiveViewer();
	loadRecordings();
}

sourceButtons.forEach(button => {
	button.addEventListener('click', () => selectSource(button.dataset.source));
});

refreshButton.addEventListener('click', () => {
	recordingsList.innerHTML = '<p class="empty-state">Loading recordings...</p>';
	loadRecordings();
});

goLiveButton.addEventListener('click', loadLiveViewer);

liveViewer.addEventListener('load', () => {
	if (!liveLoadArmed || currentMode !== 'live') {
		return;
	}

	setStatus('online', `${currentSource.toUpperCase()} live viewer loaded`);
});

recordingViewer.addEventListener('error', () => {
	if (currentMode === 'recording') {
		setStatus('offline', `Could not play ${currentSource.toUpperCase()} recording`);
	}
});

// Keep file sizes and newly completed recording segments reasonably current.
setInterval(loadRecordings, 5000);

selectSource(currentSource);
