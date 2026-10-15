# Finger Force App

Measure the force of your grip in real time and perform tests 
of finger strength and endurance.

## Technical description

### Hardware

 - Load cell taken from a hanging scale - pulling on the attachment points modifies electrict current
 - HX711 - converts the analog signal to digital
 - ESP32 (S3) - system on a chip (SoC) with a basic firmware processing data from the load cell and forwarding it over USB, Bluetooth or WiFi (implemented USB)

### Firmware

In C++, flashed on the ESP32 chip. Listens for commands for calibrating, taring and resetting max weight. Streams real time data over the serial port.

### Server backend

Listens on the serial port for incoming data from the chip and communicates commands. Provides REST API and WebSocket connection for live data streaming, to control the load cell (tare, calibrate, rest max weight) and to manage finger tests (browse, create, delete) and to log test events (test start, pull, rest, test end, abort).

Data analysis part is being developed at the moment.

Written in python with FastAPI and SQLAlchemy ORM. Tests with pytest.

### Frontend

Written in TypeScript / React.js. An application to see the live force and perform strength and endurance tests.