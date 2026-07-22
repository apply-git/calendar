import http.server, socketserver
PORT = 8765
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), H) as httpd:
    print('Serving on http://0.0.0.0:%d (no-cache)' % PORT)
    httpd.serve_forever()
