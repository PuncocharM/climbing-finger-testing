import asyncio
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pandas as pd
import scipy.stats as sps
import scipy.integrate as spi
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import serial
import json
import csv
from pydantic import BaseModel

from database import init_db, save_analytics, get_all_tests, get_test_by_id, delete_test_by_id

SERIAL_PORT = "COM6"
BAUD_RATE = 115200
PORT = 8000
BROADCAST_FREQUENCY = 1 / 10 # Broadcast every 100ms (matches ESP32 output rate 10Hz)
LOG_FILE_DATA = "../output_data/log-data.csv"
LOG_FILE_EVENTS = "../output_data/log-events.csv"
LOG_BUFFER_SIZE = 80

@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = threading.Thread(target=serial_reader_worker, daemon=True)
    thread.start()
    asyncio.create_task(broadcast_data_stream())
    yield

app = FastAPI(lifespan=lifespan, title="ESP32 Load Cell Telemetry Server")
init_db()
# Allow requests from your HTML/JS frontend

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- Global State Variables ---
latest_weight = 0.0
esp32_status = "UNKNOWN"
ser: serial.Serial | None = None

class FrontendEvent(BaseModel):
    test_id: str
    timestamp: str
    event_type: str


connected_clients = set()



def process_test_analytics(test_id: str):
    """Slices out the 80 Hz logging file chunks matching the active TestID to find CF and W'."""
    try:
        time.sleep(1.5) # Allow final logging buffers to flush to disk
        df_data = pd.read_csv(LOG_FILE_DATA, names=["timestamp", "weight", "status"])\
            .set_index("timestamp")
        df_events = pd.read_csv(LOG_FILE_EVENTS, names=["timestamp", "event", "status", "test_id"])\
            .set_index("timestamp")

        # Isolate rows captured under this specific TestID
        df_events_test = df_events.loc[df_events['test_id'] == test_id]
        if df_events_test.empty:
            print(f"Analytics failure: No data found matching {test_id}")
            return

        # Locate individual phase transition boundaries
        set_peaks = []
        cumulative_work = []
        cumulative_time = []

        total_work_done = 0.0
        total_time_seconds = 0.0

        pull_start = None
        for timestamp, event_row in df_events_test.iterrows():
            event = event_row["event"]
            if event == "PULL_START":
                pull_start = timestamp
            elif event == "REST_START" or event == "TEST_END":
                pull_data = df_data.loc[(df_data.index >= pull_start) & (df_data.index < timestamp), "weight"]

                if len(pull_data) > 0:
                    peak = float(pull_data.max())
                    set_peaks.append(peak)

                    # Compute Work (Impulse) via linear trapezoidal integration modeling
                    set_work = float(spi.trapezoid(pull_data.values, dx=(1.0 / 80.0)))
                    total_work_done += set_work
                    # TODO: make the timestamp difference
                    total_time_seconds += 7.0 # Standard work block time allocation

                    cumulative_work.append(total_work_done)
                    cumulative_time.append(total_time_seconds)
                else:
                    print(f"No data in the pull interval {pull_start}, {timestamp}")

        if len(cumulative_work) < 2:
            print("Not enough cumulative work")
            print(set_peaks, cumulative_work, cumulative_time)
            print(df_events_test)
            print(df_data)
            return # Insufficient data to execute reliable linear regressions

        # Execute Monod-Scherrer Linear Model Mapping
        # Cumulative Work = (Critical Force * Cumulative Time) + W'
        slope, intercept, r_value, p_value, std_err = sps.linregress(cumulative_time, cumulative_work)

        # Save metrics directly into SQLite
        save_analytics(
            test_id=test_id,
            test_type="CRITICAL_FORCE_7_3",
            cf=round(slope, 2),
            w_prime=round(intercept, 2),
            r_sq=round(r_value**2, 4),
            peaks_list=set_peaks
        )
        print(f"Successfully processed analytics for {test_id}. CF: {round(slope,2)}kg, W': {round(intercept,2)}J")
    except Exception as e:
        print(f"Error executing mathematical analytics engine processing: {str(e)}")




def serial_reader_worker():
    global latest_weight, esp32_status, ser
    print(f"Connecting to ESP32...")
    esp32_status = "CONNECTING"

    buffer = []

    while True:
        try:
            if ser is None or not ser.is_open:
                ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
                time.sleep(2)
                esp32_status = "CONNECTED"
                print("Connected to ESP32")

            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line.startswith("DATA:"):
                    try:
                        latest_weight = float(line.split(":")[1])
                        timestamp = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                        buffer.append([timestamp, latest_weight, esp32_status])

                        if len(buffer) >= LOG_BUFFER_SIZE:
                            with open(LOG_FILE_DATA, "a", newline="") as f:
                                writer = csv.writer(f)
                                writer.writerows(buffer)
                            buffer.clear()

                    except (ValueError, IndexError):
                        pass
                elif line.startswith("STATUS:"):
                    print("Status:", line)
                elif line.startswith("ERROR:"):
                    print("Scale error:", line)
                else:
                    print("Unrecognized message:", line)

        except (serial.SerialException, OSError):
            time.sleep(3)



async def broadcast_data_stream():
    """Continuously pushes data to all connected browser clients at 10Hz."""
    while True:
        if connected_clients:
            payload = {
                "weight": latest_weight,
                "status": esp32_status
            }

            message = json.dumps(payload)
            await asyncio.gather(
                *[client.send_text(message) for client in connected_clients],
                return_exceptions=True
            )
        await asyncio.sleep(BROADCAST_FREQUENCY)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    print(f"Client connected. Active connections: {len(connected_clients)}")

    try:
        while True:
            # Listen for incoming control commands from the browser front-end
            data = await websocket.receive_text()
            try:
                command_data = json.loads(data)
                cmd = command_data.get("command", "").upper()

                if cmd in ["TARE", "START", "STOP"] and ser and ser.is_open:
                    ser.write(f"{cmd}\n".encode('utf-8'))
                    print(f"Forwarded command to ESP32: {cmd}")
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        print(f"Client disconnected. Active connections: {len(connected_clients)}")


@app.get("/api/weight")
def get_weight():
    """Returns the latest read weight and current connection status."""
    return {"weight": latest_weight, "status": esp32_status}


@app.post("/api/test/sync")
async def log_phase_marker(frontend_event: FrontendEvent, background_tasks: BackgroundTasks):
    """
    Injects a runtime phase transition marker into the active CSV logging stream.
    """
    global esp32_status
    try:
        log_row = [frontend_event.timestamp, f"{frontend_event.event_type}", esp32_status, frontend_event.test_id]

        with open(LOG_FILE_EVENTS, "a", newline="") as f:
            csv.writer(f).writerow(log_row)

        if frontend_event.event_type == "TEST_END":
            background_tasks.add_task(process_test_analytics, frontend_event.test_id)

        print(f"[{frontend_event.timestamp}] Recorded frontend event: {frontend_event.event_type}")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record event marker: {str(e)}")

@app.get("/api/history")
def fetch_history_index():
    """Returns a list of all past climbing test metrics recorded."""
    return get_all_tests()

# Replace this endpoint in app.py

@app.get("/api/history/{test_id}")
def fetch_single_test_details(test_id: str):
    """
    Returns the comprehensive summary AND the entire continuous 80Hz data stream
    sliced between the test's start and end events.
    """
    # 1. Fetch the baseline metrics summary from SQLite
    result = get_test_by_id(test_id)
    if not result:
        raise HTTPException(status_code=404, detail="Record not found.")
    result['set_peaks'] = json.loads(result['set_peaks_json'])

    try:
        # 2. Open our dual logs
        df_data = pd.read_csv(LOG_FILE_DATA, names=["timestamp", "weight", "status"])
        df_events = pd.read_csv(LOG_FILE_EVENTS, names=["timestamp", "event", "status", "test_id"])

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




@app.post("/api/command/{cmd}")
def send_command(cmd: str):
    """Sends control commands (TARE, START, STOP) to the ESP32."""
    global ser
    valid_commands = ["TARE", "START", "STOP"]
    upper_cmd = cmd.upper()

    if upper_cmd not in valid_commands:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid command. Choose from: {valid_commands}",
        )

    if ser is None or not ser.is_open:
        raise HTTPException(
            status_code=503, detail="Serial port to ESP32 is not open."
        )

    try:
        # Send raw string command appended with a newline token
        ser.write(f"{upper_cmd}\n".encode("utf-8"))
        return {
            "success": True,
            "message": f"Command '{upper_cmd}' sent to ESP32.",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to transmit command: {str(e)}"
        )

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


# Run via command line: uvicorn app:app --reload --host 0.0.0.0 --port 8000
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)