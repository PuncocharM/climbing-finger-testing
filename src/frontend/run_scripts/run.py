#!/usr/bin/env python3

from http.server import SimpleHTTPRequestHandler, HTTPServer
import webbrowser

PORT = 8080

class HTTPHandlerOne(SimpleHTTPRequestHandler):
  def translate_path(self, path):
      if path.startswith('/assets/') or path.startswith('/database/'):
          new_path = path
      else:
          new_path = '/index.html'

      print(f'translating {path} to {new_path}')
      return SimpleHTTPRequestHandler.translate_path(self, new_path)


def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, HTTPHandlerOne)

    webbrowser.open_new(f'http://localhost:{PORT}')
    httpd.serve_forever()

if __name__ == "__main__":
    run()
