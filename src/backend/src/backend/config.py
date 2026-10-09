import pathlib

class Config:
    SERIAL_PORT = "COM6"
    BAUD_RATE = 115200
    DEFAULT_PORT = 8000
    BROADCAST_FREQUENCY = 1 / 10 # Broadcast every 100ms (matches ESP32 output rate 10Hz)
    OUTPUT_DIR = "../../output_data"
    LOG_FILE_DATA = pathlib.Path(f"{OUTPUT_DIR}/log-data.csv")
    DB_FILE = pathlib.Path(f"{OUTPUT_DIR}/climbing_analytics.db")
    LOG_BUFFER_SIZE = 80
