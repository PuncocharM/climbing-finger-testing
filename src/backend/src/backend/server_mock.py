import asyncio
import json
import logging
import sys
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import Config


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(broadcast_data_stream())
    yield


log = logging.getLogger()
# logger.setLevel(logging.DEBUG)
logging.basicConfig(stream=sys.stdout, level=logging.INFO)
app = FastAPI(lifespan=lifespan, title="ESP32 Load Cell Telemetry Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_clients = set()



async def broadcast_data_stream():
    """Continuously pushes data to all connected browser clients at 10Hz."""
    while True:
        payload = {
            "weight": np.random.random()*10,
            "status": "OK"
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
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        log.info(f"Client disconnected. Active connections: {len(connected_clients)}")



if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(level=logging.INFO)

    uvicorn.run(app, host="0.0.0.0", port=Config.DEFAULT_PORT)