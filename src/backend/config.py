import pathlib

class Config:
    SERIAL_PORT = "COM6"
    BAUD_RATE = 115200
    DEFAULT_PORT = 8000
    BROADCAST_FREQUENCY = 1 / 10 # Broadcast every 100ms (matches ESP32 output rate 10Hz)
    LOG_FILE_DATA = pathlib.Path("./output_data/log-data.csv")
    LOG_FILE_EVENTS = pathlib.Path("./output_data/log-events.csv")
    LOG_FILE_TESTS = pathlib.Path("./output_data/log-tests.csv")
    LOG_BUFFER_SIZE = 80
    DB_FILE = pathlib.Path("./output_data/climbing_analytics.db")
