const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8080;
const publicDir = path.join(__dirname, 'public');

const mimeTypes = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
	let requestPath = decodeURIComponent(req.url.split('?')[0]);

	if (requestPath === '/') {
		requestPath = '/index.html';
	}

	const filePath = path.normalize(path.join(publicDir, requestPath));

	if (!filePath.startsWith(publicDir)) {
		res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end('Forbidden');
		return;
	}

	fs.stat(filePath, (statError, stats) => {
		if (statError || !stats.isFile()) {
			res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
			res.end('Not found');
			return;
		}

		const ext = path.extname(filePath).toLowerCase();
		res.writeHead(200, {
			'Content-Type': mimeTypes[ext] || 'application/octet-stream',
			'Cache-Control': 'no-cache'
		});

		fs.createReadStream(filePath).pipe(res);
	});
});

server.listen(port, '0.0.0.0', () => {
	console.log(`RTMP Web View running on http://0.0.0.0:${port}`);
});
