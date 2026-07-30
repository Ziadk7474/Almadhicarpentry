"""Local preview server for testing this site with realistic caching behavior.

python -m http.server sends no Cache-Control headers and is single-threaded,
so every page navigation in this multi-page site re-downloads shared assets
(support.js, styles.css, images already seen on a previous page) from
scratch and serves requests one at a time. A real production host (Nginx,
Vercel, a CDN, etc.) would not behave this way — this script exists only to
make local testing match that reality instead of understating it.
"""
import http.server
import os

PORT = 8791

CACHEABLE_EXT = {
    '.jpg': 86400, '.jpeg': 86400, '.png': 86400, '.webp': 86400,
    '.svg': 86400, '.css': 3600, '.js': 3600,
}


class CachingHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        ext = os.path.splitext(self.path.split('?')[0])[1].lower()
        max_age = CACHEABLE_EXT.get(ext)
        if max_age:
            self.send_header('Cache-Control', f'public, max-age={max_age}')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # keep the console quiet during repeated testing


class ThreadingServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    server = ThreadingServer(('', PORT), CachingHandler)
    print(f'Serving on http://localhost:{PORT} (threaded, with cache headers)')
    server.serve_forever()
