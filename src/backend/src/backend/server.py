import asyncio
import logging
import sys
import threading
import time
from contextlib import asynccontextmanager
from typing import Sequence, List

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware

from config import Config, log
from data_analysis import process_workout_analytics, load_data
from esp import ESP32, serial_reader_worker
from persistence.database import init_db, DuplicateEntryError, WorkoutRepository, WorkoutEventRepository, \
    PeakForceResultRepository, CriticalForceResultRepository
from persistence.model import WorkoutEntity, WorkoutEventEntity, PeakForceTestResult, CriticalForceTestResult
from schemas import WorkoutSchema, WorkoutEventSchema, Commands, WorkoutEventType, PeakForceTestSchema, \
    CriticalForceTestSchema


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
                "timestamp": esp32.get_timestamp(),
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


@app.get("/api/workouts", response_model=List[WorkoutSchema])
def fetch_all_workouts() -> Sequence[WorkoutEntity]:
    return WorkoutRepository.get_all()


@app.get("/api/workouts/{workout_id}", response_model=WorkoutSchema)
def fetch_workout_by_id(workout_id: str) -> WorkoutEntity:
    workout_entity = WorkoutRepository.get_by_id(workout_id)
    if not workout_entity:
        raise HTTPException(status_code=404, detail=f"Workout not found {workout_id}.")

    return workout_entity

@app.post("/api/workouts/new")
def create_new_workout(new_workout_request: WorkoutSchema):
    try:
        we = WorkoutEntity(**new_workout_request.model_dump())
    except Exception as e:
        log.error(f"Cannot convert workout request to entity: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Cannot create a workout {new_workout_request.workout_id}")

    try:
        WorkoutRepository.save(we)
    except DuplicateEntryError as e:
        log.error(f"Cannot save workout with already existing workout_it {new_workout_request.workout_id}")
        raise HTTPException(status_code=400, detail=f"Cannot create a workout with already existing id {new_workout_request.workout_id}")
    except Exception as e:
        log.error(f"Cannot save workout {new_workout_request.workout_id}")
        raise HTTPException(status_code=500, detail=f"Cannot save the workout")

    log.info(f"[{new_workout_request.timestamp}] Recorded new workout: {new_workout_request.workout_id}")
    return {"status": "success"}


@app.delete("/api/workouts/{workout_id}")
def delete_workout(workout_id: str):
    success = WorkoutRepository.delete(workout_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="The requested workout could not be found or was already removed."
        )
    log.info(f"[{workout_id}] Workout removed from database.")
    return {"status": "deleted", "workout_id": workout_id}


@app.post("/api/workouts/{workout_id}/workout-events/new")
async def log_workout_event(workout_id: str, workout_event: WorkoutEventSchema, background_tasks: BackgroundTasks):
    try:
        te = WorkoutEventEntity(workout_id=workout_id, **workout_event.model_dump())
    except Exception as e:
        log.error(f"Cannot convert workout event request to entity: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Cannot create a workout event {workout_event}")

    try:
        WorkoutEventRepository.save(te)
    except Exception as e:
        log.error(f"Cannot save workout event: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cannot save the workout event")

    if workout_event.event_type == WorkoutEventType.WORKOUT_END:
        background_tasks.add_task(process_workout_analytics, workout_id)
    elif workout_event.event_type == WorkoutEventType.WORKOUT_ABORT:
        WorkoutRepository.delete(workout_id)

    log.info(f"[{workout_event.timestamp}] Recorded frontend event: {workout_event.event_type}")
    return {"status": "success"}


@app.get("/api/workouts/{workout_id}/workout-events", response_model=List[WorkoutEventSchema])
def fetch_workout_events(workout_id: str) -> Sequence[WorkoutEventEntity]:
    return WorkoutEventRepository.get_all_by_workout_id(workout_id)


@app.get("/api/workouts/{workout_id}/scale-data")
def fetch_scale_data(workout_id: str):
    workout_events = WorkoutEventRepository.get_all_by_workout_id(workout_id)
    if len(workout_events) == 0:
        log.error(f"No workout events for workout {workout_id}")
        raise HTTPException(status_code=400, detail=f"No workout events for workout {workout_id}")

    timestamps = [te.timestamp for te in workout_events]
    workout_start = min(timestamps)
    workout_end = max(timestamps)

    df_data = load_data()

    df_data_workout = df_data[workout_start:workout_end]

    return {
        "timestamps": df_data_workout.index.to_list(),
        "weights": df_data_workout["weight"].to_list(),
        "max_weights": df_data_workout["max_weight"].to_list(),
    }


@app.get("/api/workouts/{workout_id}/test-results-peak-force", response_model=PeakForceTestSchema)
def fetch_test_results_peak_force(workout_id: str) -> PeakForceTestResult:
    result = PeakForceResultRepository.get_by_id(workout_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Test results not found for workout {workout_id}")
    return result


@app.get("/api/workouts/{workout_id}/test-results-critical-force", response_model=CriticalForceTestSchema)
def fetch_test_results_critical_force(workout_id: str) -> CriticalForceTestResult:
    result = CriticalForceResultRepository.get_by_id(workout_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Test results not found for workout {workout_id}")
    return result



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
