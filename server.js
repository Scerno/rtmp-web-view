const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const port = process.env.PORT || 8080;
const publicDir = path.join(__dirname, 'public');
const allowedSources = new Set(['atem', 'drone']);
const activeFileThresholdMs = 5000;

function findStreamsDirectory() {
	if (process.env.STREAMS_DIR) {
		return path.resolve(process.env.STREAMS_DIR);
	}

	let currentDir = __dirname;

	for (let i = 0; i < 6; i++) {
		const candidate = path.join(currentDir, 'Streams');

		try {
			if (fs.statSync(candidate).isDirectory()) {
				return path.resolve(candidate);
			}
		} catch (error) {
			// Keep walking up until a Streams directory is found.
		}

		const parentDir = path.dirname(currentDir);

		if (parentDir === currentDir) {
			break;
		}

		currentDir = parentDir;
	}

	// Preserve the original expected layout as a fallback.
	return path.resolve(__dirname, '..', 'Streams');
}

const streamsDir = findStreamsDirectory();

const mimeTypes = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.ico': 'image/x-icon',
	'.mp4': 'video/mp4'
};

function sendText(res, statusCode, text) {
	res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
	res.end(text);
}

function sendJson(res, statusCode, data) {
	res.writeHead(statusCode, {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-store'
	});
	res.end(JSON.stringify(data));
}

function parseRecordingStart(filename, fallbackDate) {
	const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d+)\.mp4$/i);

	if (!match) {
		return fallbackDate;
	}

	const [, year, month, day, hour, minute, second, fraction] = match;
	const milliseconds = Number(`0.${fraction}`) * 1000;

	return new Date(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
		Number(second),
		Math.floor(milliseconds)
	);
}

async function listRecordings(source) {
	if (!allowedSources.has(source)) {
		return null;
	}

	const sourceDir = path.join(streamsDir, source);
	let entries;

	try {
		entries = await fsp.readdir(sourceDir, { withFileTypes: true });
	} catch (error) {
		if (error.code === 'ENOENT') {
			return [];
		}

		throw error;
	}

	const recordings = await Promise.all(
		entries
			.filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.mp4')
			.map(async entry => {
				const filePath = path.join(sourceDir, entry.name);
				const stats = await fsp.stat(filePath);
				const start = parseRecordingStart(entry.name, stats.birthtime);
				const active = Date.now() - stats.mtimeMs < activeFileThresholdMs;
				const duration = Math.max(0, (stats.mtimeMs - start.getTime()) / 1000);

				return {
					name: entry.name,
					start: start.toISOString(),
					duration,
					size: stats.size,
					modified: stats.mtime.toISOString(),
					active
				};
			})
	);

	return recordings.sort((a, b) => new Date(b.start) - new Date(a.start));
}

async function serveRecording(req, res, source, filename) {
	if (!allowedSources.has(source)) {
		sendText(res, 404, 'Not found');
		return;
	}

	const safeFilename = path.basename(filename);

	if (safeFilename !== filename || path.extname(safeFilename).toLowerCase() !== '.mp4') {
		sendText(res, 400, 'Invalid recording');
		return;
	}

	const sourceDir = path.resolve(streamsDir, source);
	const filePath = path.resolve(sourceDir, safeFilename);

	if (!filePath.startsWith(`${sourceDir}${path.sep}`)) {
		sendText(res, 403, 'Forbidden');
		return;
	}

	let stats;

	try {
		stats = await fsp.stat(filePath);
	} catch (error) {
		sendText(res, 404, 'Not found');
		return;
	}

	if (!stats.isFile()) {
		sendText(res, 404, 'Not found');
		return;
	}

	const fileSize = stats.size;
	const isActive = Date.now() - stats.mtimeMs < activeFileThresholdMs;
	const etag = `"${fileSize.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
	const baseHeaders = {
		'Content-Type': 'video/mp4',
		'Accept-Ranges': 'bytes',
		'ETag': etag,
		'Last-Modified': stats.mtime.toUTCString(),
		'Cache-Control': isActive ? 'no-store' : 'private, max-age=86400'
	};

	const range = req.headers.range;

	if (!range && req.headers['if-none-match'] === etag) {
		res.writeHead(304, baseHeaders);
		res.end();
		return;
	}

	if (range) {
		const match = range.match(/^bytes=(\d*)-(\d*)$/);

		if (!match) {
			res.writeHead(416, {
				...baseHeaders,
				'Content-Range': `bytes */${fileSize}`
			});
			res.end();
			return;
		}

		let start;
		let end;

		if (match[1] === '' && match[2] !== '') {
			const suffixLength = Number(match[2]);
			start = Math.max(0, fileSize - suffixLength);
			end = fileSize - 1;
		} else {
			start = Number(match[1] || 0);
			end = match[2] ? Number(match[2]) : fileSize - 1;
		}

		if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= fileSize) {
			res.writeHead(416, {
				...baseHeaders,
				'Content-Range': `bytes */${fileSize}`
			});
			res.end();
			return;
		}

		end = Math.min(end, fileSize - 1);

		res.writeHead(206, {
			...baseHeaders,
			'Content-Range': `bytes ${start}-${end}/${fileSize}`,
			'Content-Length': end - start + 1
		});

		fs.createReadStream(filePath, { start, end }).pipe(res);
		return;
	}

	res.writeHead(200, {
		...baseHeaders,
		'Content-Length': fileSize
	});

	fs.createReadStream(filePath).pipe(res);
}

function serveStaticFile(req, res, requestPath) {
	const filePath = path.normalize(path.join(publicDir, requestPath));

	if (!filePath.startsWith(publicDir)) {
		sendText(res, 403, 'Forbidden');
		return;
	}

	fs.stat(filePath, (statError, stats) => {
		if (statError || !stats.isFile()) {
			sendText(res, 404, 'Not found');
			return;
		}

		const ext = path.extname(filePath).toLowerCase();
		res.writeHead(200, {
			'Content-Type': mimeTypes[ext] || 'application/octet-stream',
			'Cache-Control': 'no-cache'
		});

		fs.createReadStream(filePath).pipe(res);
	});
}

const server = http.createServer(async (req, res) => {
	try {
		const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
		let requestPath = decodeURIComponent(url.pathname);

		if (requestPath === '/api/recordings') {
			const source = (url.searchParams.get('source') || '').toLowerCase();
			const recordings = await listRecordings(source);

			if (recordings === null) {
				sendJson(res, 400, { error: 'Unknown source' });
				return;
			}

			sendJson(res, 200, recordings);
			return;
		}

		if (requestPath.startsWith('/recordings/')) {
			const parts = requestPath.split('/').filter(Boolean);

			if (parts.length !== 3) {
				sendText(res, 404, 'Not found');
				return;
			}

			const [, source, filename] = parts;
			await serveRecording(req, res, source.toLowerCase(), filename);
			return;
		}

		if (requestPath === '/') {
			requestPath = '/index.html';
		}

		serveStaticFile(req, res, requestPath);
	} catch (error) {
		console.error(error);
		sendText(res, 500, 'Internal server error');
	}
});

server.listen(port, '0.0.0.0', () => {
	console.log(`RTMP Web View running on http://0.0.0.0:${port}`);
	console.log(`Serving recordings from: ${streamsDir}`);

	if (!fs.existsSync(streamsDir)) {
		console.warn('WARNING: Streams directory does not currently exist at that path.');
	}
});
