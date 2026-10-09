#!/usr/bin/env python3
"""Local launcher for the static ZAIN.NET Article Studio; no third-party modules."""
import argparse
import functools
import http.server
from pathlib import Path
import threading
import webbrowser

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    root=Path(__file__).resolve().parent
    handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root))
    http.server.SimpleHTTPRequestHandler.extensions_map.update({'.mjs':'text/javascript','.wasm':'application/wasm'})
    server=None
    for port in range(args.port,args.port+15):
        try:
            server=http.server.ThreadingHTTPServer(('127.0.0.1',port),handler)
            break
        except OSError:
            pass
    if server is None:
        raise SystemExit('Port lokal tidak tersedia. Jalankan dengan --port 9000.')
    url=f'http://127.0.0.1:{server.server_port}/'
    print(f'ZAIN.NET Article Studio V2.0\nBuka: {url}\nBiarkan jendela ini terbuka. Ctrl+C untuk berhenti.',flush=True)
    if not args.no_browser:
        threading.Timer(0.7,lambda:webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__=='__main__':
    main()
