"""Synthetic HTTP/data endpoint. No external dependencies or business behavior."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

data = Path('/data') if Path('/data').is_dir() else Path('/tmp')
marker = data / 'marker'
if not marker.exists():
    marker.write_text('bsk-es2-synthetic-persistent-marker\n')


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = marker.read_bytes()
        self.send_response(200)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
