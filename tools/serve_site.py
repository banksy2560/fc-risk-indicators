#!/usr/bin/env python3
"""Local static server for site/ that mimics Vercel cleanUrls (/about -> about.html).
Usage: python3 tools/serve_site.py [port]   (default 8000)"""
import http.server, os, sys, functools
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')

class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = super().translate_path(path)
        if not os.path.exists(p) and os.path.exists(p + '.html'):
            return p + '.html'
        return p

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=ROOT)).serve_forever()
