#!/usr/bin/env python3
"""
Tiny SPA-aware static file server for the prebuilt Cafe AI web bundle.

Behaves like `python -m http.server` BUT: when a GET request hits a path
that doesn't resolve to a real file (e.g. /menu, /cart, /chat, /item/123),
it serves /index.html with 200 instead of returning 404. This lets
client-side routing (expo-router) handle the URL.

Usage:  python3 serve-web.py [port] [directory]
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Strip query string, decode percent-escapes, normalize.
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        fs_path = self.translate_path(path)

        # If the requested path is a real file, or maps to an existing dir
        # with an index.html, let the default handler serve it.
        if os.path.isfile(fs_path) or (
            os.path.isdir(fs_path) and os.path.isfile(os.path.join(fs_path, 'index.html'))
        ):
            return super().do_GET()

        # Otherwise it's a client-side route — fall back to index.html.
        self.path = '/index.html'
        return super().do_GET()

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    directory = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 'mobile', 'web-build'
    )
    if not os.path.isfile(os.path.join(directory, 'index.html')):
        print(f"error: no index.html in {directory}", file=sys.stderr)
        sys.exit(1)
    handler = partial(SPAHandler, directory=directory)
    # 0.0.0.0 binds to ALL interfaces, so phones on the same Wi-Fi can reach
    # the server at http://<mac-lan-ip>:<port>. The default for python's
    # http.server is 127.0.0.1, which would block phone access.
    httpd = ThreadingHTTPServer(('0.0.0.0', port), handler)
    print(f"serving {directory} on http://0.0.0.0:{port}  (SPA fallback enabled)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping.")
        httpd.shutdown()

if __name__ == '__main__':
    main()
