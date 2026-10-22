import csv
import time
from datetime import datetime, timezone
from enum import StrEnum

import serial

from config import Config, log


class ConnectionStatus(StrEnum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"


class ESP32:
    _connection_status: ConnectionStatus = ConnectionStatus.DISCONNECTED
    _status: str
    _current_weight: float | None = None
    _max_weight: float | None = None
    _timestamp: str | None = None
    _ser: serial.Serial | None = None

    def set_connection_status(self, connection_status: ConnectionStatus):
        log.info(f"ESP32 connection status: {connection_status}")
        self._connection_status = connection_status

    def get_connection_status(self):
        return self._connection_status

    def set_status(self, status: str):
        log.info(f"ESP32 status: {status}")
        self._status = status

    def get_status(self):
        return self._status

    def set_current_weight(self, current_weight: float | None):
        log.debug(f"Registered current weight: {current_weight}")
        self._current_weight = current_weight

    def get_current_weight(self):
        return self._current_weight

    def set_ser(self, ser: serial.Serial | None):
        self._ser = ser

    def get_ser(self):
        return self._ser

    def set_max_weight(self, max_weight):
        self._max_weight = max_weight

    def get_max_weight(self):
        return self._max_weight

    def set_timestamp(self, timestamp):
        self._timestamp = timestamp

    def get_timestamp(self):
        return self._timestamp


def serial_reader_worker(esp32: ESP32):
    time.sleep(1)  # wait a bit on server startup

    buffer = []

    while True:
        try:
            ser = esp32.get_ser()
            if ser is None or not ser.is_open:
                esp32.set_connection_status(ConnectionStatus.CONNECTING)
                esp32.set_ser(serial.Serial(Config.SERIAL_PORT, Config.BAUD_RATE, timeout=1))
                time.sleep(2)
                continue
            elif esp32.get_connection_status() != ConnectionStatus.CONNECTED:
                esp32.set_connection_status(ConnectionStatus.CONNECTED)

            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line.startswith("DATA:CURRENT_WEIGHT_MAX_WEIGHT:"):
                    try:
                        timestamp = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                        current_weight, max_weight = map(float, line.split(":")[2:])
                        esp32.set_current_weight(current_weight)
                        esp32.set_max_weight(max_weight)
                        esp32.set_timestamp(timestamp)
                        buffer.append([timestamp, current_weight, max_weight, esp32.get_connection_status()])

                        # TODO: rethink this:
                        #  1. keep using CSV file, but
                        #   1a. change filename for each session
                        #   1b. check for some native buffering implementation
                        #  2. try some high frequency database
                        if len(buffer) >= Config.LOG_BUFFER_SIZE:
                            with open(Config.LOG_FILE_DATA, "a", newline="") as f:
                                writer = csv.writer(f)
                                writer.writerows(buffer)
                            buffer.clear()

                    except (ValueError, IndexError) as e:
                        log.error(f"Error reading current and max weight: {e}")

                elif line.startswith("STATUS:"):
                    status = line[len("STATUS:"):].strip()
                    if status.startswith("CALIBRATED "):
                        calibration_factor = float(status[len("CALIBRATED "):].strip())
                        log.info(f"Calibrated factor: {calibration_factor}")
                        status = "CALIBRATED"
                    esp32.set_status(status)
                elif line.startswith("ERROR:"):
                    log.error(f"Scale error: {line}")
                else:
                    log.error(f"Unrecognized message: {line}" )

        except serial.SerialException as e:
            log.error(f"ESP32 connection error: {e}")
            esp32.set_connection_status(ConnectionStatus.DISCONNECTED)
            esp32.set_current_weight(None)
            esp32.set_ser(None)
            time.sleep(3)
