#!/usr/bin/env python3
"""Local static server for site/ that mimics Vercel cleanUrls (/about -> about.html) and the redirects in site/vercel.json.
Usage: python3 tools/serve_site.py [port]   (default 8000)"""
import http.server, os, sys, functools, json
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
try:
    REDIRECTS = {r['source']: r['destination'] for r in json.load(open(os.path.join(ROOT, 'vercel.json'))).get('redirects', [])}
except Exception:
    REDIRECTS = {}

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?', 1)[0].rstrip('/') or '/'
        if path in REDIRECTS:
            self.send_response(308); self.send_header('Location', REDIRECTS[path]); self.end_headers(); return
        super().do_GET()
    def translate_path(self, path):
        p = super().translate_path(path)
        if not os.path.exists(p) and os.path.exists(p + '.html'):
            return p + '.html'
        return p
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, *a):
        pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=ROOT)).serve_forever()
