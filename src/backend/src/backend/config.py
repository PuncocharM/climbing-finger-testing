import logging
import pathlib
import sys

log = logging.getLogger()
# logger.setLevel(logging.DEBUG)
logging.basicConfig(stream=sys.stdout, level=logging.INFO)

class Config:
    # Server
    DEFAULT_PORT = 8000
    STATIC_DIRECTORY = '../../static'

    # ESP32 connection
    SERIAL_PORT = "COM6"
    BAUD_RATE = 115200

    # Data streaming, logging and storage
    BROADCAST_FREQUENCY = 1 / 10 # Broadcast every 100ms (matches ESP32 output rate 10Hz)
    CURRENT_DIR = pathlib.Path(__file__).parent.resolve()
    OUTPUT_DIR = CURRENT_DIR / "../../../../output_data"
    LOG_FILE_DATA = OUTPUT_DIR / "log-data.csv"
    LOG_BUFFER_SIZE = 80
    DB_FILE = OUTPUT_DIR / "climbing_analytics.db"
