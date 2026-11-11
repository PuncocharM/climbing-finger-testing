import logging
import sys
import threading
import time
import webbrowser

from config import Config
from server import app


def open_browser(port: int):
    time.sleep(1)
    webbrowser.open_new(f'http://localhost:{port}')

if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print('Error: port has to be an integer')
            exit(1)
    else:
        port = Config.DEFAULT_PORT


    threading.Thread(target=open_browser, args=(port,)).start()
    uvicorn.run(app, host="0.0.0.0", port=port)
