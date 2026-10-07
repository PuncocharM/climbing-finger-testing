import asyncio
import logging
import sys
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import StrEnum

import pandas as pd
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import serial
import json
import csv
from pydantic import BaseModel

from config import Config
from data_analysis import process_test_analytics
from database import init_db, get_all_tests, get_test_by_id, delete_test_by_id


@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = threading.Thread(target=serial_reader_worker, daemon=True)
    thread.start()
    asyncio.create_task(broadcast_data_stream())
    yield


log = logging.getLogger()
# logger.setLevel(logging.DEBUG)
logging.basicConfig(stream=sys.stdout, level=logging.INFO)
app = FastAPI(lifespan=lifespan, title="ESP32 Load Cell Telemetry Server")
app.frontend('/', directory='static', fallback="index.html")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionStatus(StrEnum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"

class ESP32:
    _connection_status: ConnectionStatus = ConnectionStatus.DISCONNECTED
    _status: str
    _current_weight: float | None = None
    _max_weight: float | None = None
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


esp32 = ESP32()
def serial_reader_worker():
    time.sleep(1)  # wait a bit on server startup

    buffer = []

    while True:
        try:
            if esp32.get_ser() is None or not esp32.get_ser().is_open:
                esp32.set_connection_status(ConnectionStatus.CONNECTING)
                esp32.set_ser(serial.Serial(Config.SERIAL_PORT, Config.BAUD_RATE, timeout=1))
                time.sleep(2)
                continue
            elif esp32.get_connection_status() != ConnectionStatus.CONNECTED:
                esp32.set_connection_status(ConnectionStatus.CONNECTED)

            if esp32.get_ser().in_waiting > 0:
                line = esp32.get_ser().readline().decode('utf-8', errors='ignore').strip()
                if line.startswith("DATA:CURRENT_WEIGHT:"):
                    try:
                        current_weight = float(line.split(":")[2])
                        esp32.set_current_weight(current_weight)
                        timestamp = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                        buffer.append([timestamp, current_weight, esp32.get_connection_status()])

                        if len(buffer) >= Config.LOG_BUFFER_SIZE:
                            with open(Config.LOG_FILE_DATA, "a", newline="") as f:
                                writer = csv.writer(f)
                                writer.writerows(buffer)
                            buffer.clear()

                    except (ValueError, IndexError) as e:
                        log.error(f"Error reading current weight: {e}")
                elif line.startswith("DATA:MAX_WEIGHT:"):
                    try:
                        max_weight = float(line.split(":")[2])
                        esp32.set_max_weight(max_weight)
                    except (ValueError, IndexError) as e:
                        log.error(f"Error reading max weight: {e}")

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


connected_clients = set()
async def broadcast_data_stream():
    time.sleep(1)  # wait a bit on server startup

    while True:
        if connected_clients:
            payload = {
                "current_weight": esp32.get_current_weight(),
                "max_weight": esp32.get_max_weight(),
                "status": esp32.get_connection_status()
            }

            message = json.dumps(payload)
            await asyncio.gather(
                *[client.send_text(message) for client in connected_clients],
                return_exceptions=True
            )
        await asyncio.sleep(Config.BROADCAST_FREQUENCY)



@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    log.info(f"Client connected. Active connections: {len(connected_clients)}")

    try:
        while True:
            # Listen for incoming control commands from the browser front-end
            data = await websocket.receive_text()
            # try:
            #     command_data = json.loads(data)
            #     cmd = command_data.get("command", "").upper()
            #
            #     if cmd in ["TARE", "START", "STOP"] and esp32.get_ser() and esp32.get_ser().is_open:
            #         esp32.get_ser().write(f"{cmd}\n".encode('utf-8'))
            #         log.info(f"Forwarded command to ESP32: {cmd}")
            # except json.JSONDecodeError:
            #     pass
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        log.info(f"Client disconnected. Active connections: {len(connected_clients)}")


class NewTestRequest(BaseModel):
    timestamp: str
    test_id: str
    test_type: str

@app.post("/api/test/new")
def create_new_test(new_test_request: NewTestRequest):
    try:
        log_row = [
            new_test_request.timestamp,
            new_test_request.test_id,
            new_test_request.test_type,
        ]

        with open(Config.LOG_FILE_TESTS, "a", newline="") as f:
            csv.writer(f).writerow(log_row)


        log.info(f"[{new_test_request.timestamp}] Recorded new test: {new_test_request.test_id}")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record event marker: {str(e)}")


class TestEvent(BaseModel):
    test_id: str
    timestamp: str
    event_type: str

@app.post("/api/test/event")
async def log_test_event(test_event: TestEvent, background_tasks: BackgroundTasks):
    try:
        log_row = [
            test_event.timestamp,
            test_event.test_id,
            test_event.event_type,
        ]

        with open(Config.LOG_FILE_EVENTS, "a", newline="") as f:
            csv.writer(f).writerow(log_row)

        if test_event.event_type == "TEST_END":
            background_tasks.add_task(process_test_analytics, test_event.test_id)

        log.info(f"[{test_event.timestamp}] Recorded frontend event: {test_event.event_type}")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record event marker: {str(e)}")

@app.get("/api/history")
def fetch_history_index():
    return get_all_tests()


@app.get("/api/history/{test_id}")
def fetch_single_test_details(test_id: str):
    # 1. Fetch the baseline metrics summary from SQLite
    result = get_test_by_id(test_id)
    if not result:
        raise HTTPException(status_code=404, detail="Record not found.")
    result['set_peaks'] = json.loads(result['set_peaks_json'])

    try:
        # 2. Open our dual logs
        df_data = pd.read_csv(Config.LOG_FILE_DATA, names=["timestamp", "weight", "status"])
        df_events = pd.read_csv(Config.LOG_FILE_EVENTS, names=["timestamp", "event", "status", "test_id"])

        df_events['timestamp'] = pd.to_datetime(df_events['timestamp'])
        df_data['timestamp'] = pd.to_datetime(df_data['timestamp'])

        # 3. Find the exact boundary times for this specific TestID
        test_events = df_events[df_events['test_id'] == test_id]
        if test_events.empty:
            result['raw_timeline'] = []
            result['raw_forces'] = []
            result['phase_markers'] = []
            return result

        start_time = test_events.iloc[0]['timestamp']
        end_time = test_events.iloc[-1]['timestamp']

        # 4. Slice out ALL high-frequency points inside this window
        raw_slice = df_data[(df_data['timestamp'] >= start_time) & (df_data['timestamp'] <= end_time)].sort_values('timestamp')

        # 5. Calculate elapsed seconds for the chart X-axis (e.g. 0s, 0.0125s, 0.025s...)
        if not raw_slice.empty:
            elapsed_seconds = (raw_slice['timestamp'] - start_time).dt.total_seconds().round(3).tolist()
            forces = raw_slice['weight'].dropna().tolist()
        else:
            elapsed_seconds = []
            forces = []

        phase_markers = []
        for _, row in test_events.iterrows():
            marker_type = row['event']
            # We care about tracking the offsets for Pull, Rest, and the initial Countdown
            if marker_type in ['CRITICAL_FORCE_START', 'PULL_START', 'REST_START', 'TEST_END']:
                offset = (row['timestamp'] - start_time).total_seconds()
                phase_markers.append({
                    "offset_seconds": round(offset, 3),
                    "type": marker_type.replace("_START", "")
                })

        result['raw_timeline'] = elapsed_seconds  # X-Axis points
        result['raw_forces'] = forces            # Y-Axis points
        result['phase_markers'] = phase_markers  # Shading configuration array

        return result

    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Failed to compile raw timeseries: {str(e)}")


def _send_command(command: str):
    ser = esp32.get_ser()
    if ser is None or not ser.is_open:
        raise HTTPException(status_code=503, detail="Serial port to ESP32 is not open.")

    try:
        ser.write(f"{command}\n".encode("utf-8"))
        return {
            "success": True,
            "message": f"Command sent to ESP32.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to transmit command: {str(e)}")

@app.post("/api/command/calibrate")
def calibrate(weight: float):
    return _send_command(f"calibrate {weight}")


class Commands(StrEnum):
    TARE = "tare"
    START = "start"
    STOP = "stop"
    RESET_MAX_WEIGHT = "reset_max_weight"


@app.post("/api/command/{cmd}")
def send_command(cmd: Commands):
    return _send_command(cmd)



@app.delete("/api/history/{test_id}")
def delete_test(test_id: str):
    """Deletes a specific test result record from the historical database index."""
    success = delete_test_by_id(test_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="The requested evaluation entry could not be found or was already removed."
        )
    print(f"[{test_id}] Record successfully purged from SQLite cache database.")
    return {"status": "deleted", "test_id": test_id}


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


    uvicorn.run(app, host="0.0.0.0", port=port)