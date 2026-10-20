import asyncio
import logging
import sys
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware

from config import Config, log
from data_analysis import process_test_analytics
from esp import ESP32, serial_reader_worker
from persistence.database import init_db, get_all_test_entries, get_test_entry_by_id, delete_test_entry, save_test_entry, \
    DuplicateTestEntryError, save_test_event
from persistence.model import TestEntryEntity, TestEventEntity
from schemas import TestEntrySchema, TestEventSchema, Commands, TestEventType


@asynccontextmanager
async def lifespan(app: FastAPI):
    esp32 = ESP32()
    connected_clients: set[WebSocket] = set()

    init_db(f"sqlite:///{Config.DB_FILE}")

    thread = threading.Thread(target=serial_reader_worker, args=[esp32], daemon=True)
    thread.start()

    asyncio.create_task(broadcast_data_stream(esp32, connected_clients))

    yield {'esp32': esp32, 'connected_clients': connected_clients}

app = FastAPI(lifespan=lifespan, title="ESP32 Load Cell Telemetry Server")
app.frontend('/', directory=Config.STATIC_DIRECTORY, fallback="index.html")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def broadcast_data_stream(esp32: ESP32, connected_clients: set[WebSocket]):
    time.sleep(1)  # wait a bit on server startup

    while True:
        if connected_clients:
            payload = {
                "current_weight": esp32.get_current_weight(),
                "max_weight": esp32.get_max_weight(),
                "status": esp32.get_connection_status()
            }

            await asyncio.gather(
                *[client.send_json(payload) for client in connected_clients],
                return_exceptions=True
            )
        await asyncio.sleep(Config.BROADCAST_FREQUENCY)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    connected_clients: set[WebSocket] = websocket.state.connected_clients

    await websocket.accept()
    connected_clients.add(websocket)
    log.info(f"Client connected. Active connections: {len(connected_clients)}")

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        log.info(f"Client disconnected. Active connections: {len(connected_clients)}")


@app.post("/api/test/new")
def create_new_test(new_test_request: TestEntrySchema):
    try:
        te = TestEntryEntity(**new_test_request.model_dump())
    except Exception as e:
        log.error(f"Cannot convert test request to entity: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Cannot create a test {new_test_request.test_id}")

    try:
        save_test_entry(te)
    except DuplicateTestEntryError as e:
        log.error(f"Cannot save test with already existing test_it {new_test_request.test_id}")
        raise HTTPException(status_code=400, detail=f"Cannot create a test with already existing id {new_test_request.test_id}")
    except Exception as e:
        log.error(f"Cannot save test {new_test_request.test_id}")
        raise HTTPException(status_code=500, detail=f"Cannot save the test")

    log.info(f"[{new_test_request.timestamp}] Recorded new test: {new_test_request.test_id}")
    return {"status": "success"}


@app.post("/api/test/event")
async def log_test_event(test_event: TestEventSchema, background_tasks: BackgroundTasks):
    try:
        te = TestEventEntity(**test_event.model_dump())
    except Exception as e:
        log.error(f"Cannot convert test event request to entity: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Cannot create a test event {test_event}")

    try:
        save_test_event(te)
    except Exception as e:
        log.error(f"Cannot save test event: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cannot save the test")

    if test_event.event_type == TestEventType.TEST_END:
        background_tasks.add_task(process_test_analytics, test_event.test_id)

    log.info(f"[{test_event.timestamp}] Recorded frontend event: {test_event.event_type}")
    return {"status": "success"}

@app.get("/api/history")
def fetch_history_index():
    return get_all_test_entries()


@app.get("/api/history/{test_id}", response_model=TestEntrySchema)
def fetch_single_test_details(test_id: str):
    test_entry_entity = get_test_entry_by_id(test_id)
    if not test_entry_entity:
        raise HTTPException(status_code=404, detail="Record not found.")

    return test_entry_entity


def _send_command(command: str, esp32: ESP32):
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
def calibrate(request: Request, weight: float):
    return _send_command(f"calibrate {weight}", request.state.esp32)


@app.post("/api/command/{cmd}")
def send_command(request: Request, cmd: Commands):
    return _send_command(cmd, request.state.esp32)



@app.delete("/api/history/{test_id}")
def delete_test(test_id: str):
    success = delete_test_entry(test_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="The requested evaluation entry could not be found or was already removed."
        )
    log.info(f"[{test_id}] Test removed from database.")
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