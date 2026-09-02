const mediaHost = window.location.hostname;
const webRtcBase = `http://${mediaHost}:8889`;

// Approved MediaMTX paths currently shown by the viewer.
// These are intentionally explicit rather than dynamically discovered.
const sources = ['atem', 'drone'];
let currentSource = 'atem';

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

function buildRecordingUrl(recording, source = currentSource) {
	return `/recordings/${encodeURIComponent(source)}/${encodeURIComponent(recording.name)}`;
}

function loadLiveViewer() {
	recordingViewer.pause();
	recordingViewer.removeAttribute('src');
	recordingViewer.load();
	recordingViewer.hidden = true;

	liveViewer.hidden = false;
	goLiveButton.hidden = true;

	setStatus('', `Loading ${currentSource.toUpperCase()} live stream...`);
	liveViewer.src = `${webRtcBase}/${encodeURIComponent(currentSource)}?controls=true&muted=false`;
}

async function playRecording(recording) {
	const source = currentSource;
	const recordingUrl = buildRecordingUrl(recording, source);

	liveViewer.hidden = true;
	recordingViewer.hidden = false;
	goLiveButton.hidden = false;

	recordingViewer.src = recordingUrl;
	recordingViewer.load();

	setStatus('recorded', `${source.toUpperCase()} recording - ${formatDate(recording.start)}`);

	try {
		await recordingViewer.play();
	} catch (error) {
		// The recording is loaded and can be started with the player's Play control.
	}
}

async function loadRecordings() {
	recordingsList.innerHTML = '<p class="empty-state">Loading recordings...</p>';

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

			const meta = document.createElement('div');
			meta.className = 'recording-meta';

			const time = document.createElement('span');
			time.className = 'recording-time';
			time.textContent = formatDate(recording.start);

			const detail = document.createElement('span');
			detail.className = 'recording-duration';

			if (recording.active) {
				detail.textContent = `Recording now · ${formatFileSize(recording.size)}`;
			} else {
				detail.textContent = `${formatDuration(recording.duration)} · ${formatFileSize(recording.size)}`;
			}

			const playButton = document.createElement('button');
			playButton.className = 'recording-link';
			playButton.type = 'button';

			if (recording.active) {
				playButton.textContent = 'Recording…';
				playButton.disabled = true;
			} else {
				playButton.textContent = 'Play';
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

refreshButton.addEventListener('click', loadRecordings);
goLiveButton.addEventListener('click', loadLiveViewer);

liveViewer.addEventListener('load', () => {
	setStatus('online', `${currentSource.toUpperCase()} live viewer loaded`);
});

recordingViewer.addEventListener('error', () => {
	setStatus('offline', `Could not play ${currentSource.toUpperCase()} recording`);
});

selectSource(currentSource);
