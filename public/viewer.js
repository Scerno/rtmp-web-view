const mediaHost = window.location.hostname;
const webRtcBase = `http://${mediaHost}:8889`;
const playbackBase = `http://${mediaHost}:9996`;

const sources = ['atem', 'drone'];
let currentSource = 'atem';

const viewer = document.getElementById('live-viewer');
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

function loadLiveViewer() {
	setStatus('', 'Loading live stream...');
	viewer.src = `${webRtcBase}/${encodeURIComponent(currentSource)}?controls=true&muted=false`;
}

async function loadRecordings() {
	recordingsList.innerHTML = '<p class="empty-state">Loading recordings...</p>';

	try {
		const response = await fetch(`${playbackBase}/list?path=${encodeURIComponent(currentSource)}`, {
			cache: 'no-store'
		});

		if (!response.ok) {
			throw new Error(`Playback API returned ${response.status}`);
		}

		const recordings = await response.json();

		if (!Array.isArray(recordings) || recordings.length === 0) {
			recordingsList.innerHTML = '<p class="empty-state">No recordings are available for this source.</p>';
			return;
		}

		recordingsList.innerHTML = '';

		[...recordings].reverse().forEach(recording => {
			const row = document.createElement('div');
			row.className = 'recording-row';

			const meta = document.createElement('div');
			meta.className = 'recording-meta';

			const time = document.createElement('span');
			time.className = 'recording-time';
			time.textContent = formatDate(recording.start);

			const duration = document.createElement('span');
			duration.className = 'recording-duration';
			duration.textContent = formatDuration(recording.duration);

			const download = document.createElement('a');
			download.className = 'recording-link';
			download.textContent = 'Open MP4';
			download.target = '_blank';
			download.rel = 'noopener';

			const params = new URLSearchParams({
				path: currentSource,
				start: recording.start,
				duration: String(recording.duration),
				format: 'mp4'
			});

			download.href = `${playbackBase}/get?${params.toString()}`;

			meta.append(time, duration);
			row.append(meta, download);
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

viewer.addEventListener('load', () => {
	setStatus('online', `${currentSource.toUpperCase()} viewer loaded`);
});

selectSource(currentSource);
