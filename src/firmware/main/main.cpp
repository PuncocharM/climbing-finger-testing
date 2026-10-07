#include <Arduino.h>
#include "rtc.h"
#include "HX711.h"
#include "esp32-hal-cpu.h"

constexpr int BAUD = 115200;
constexpr int LOADCELL_DOUT_PIN = 16;
constexpr int LOADCELL_SCK_PIN = 4;
constexpr float DEFAULT_CALIBRATION_FACTOR = -20500.0;
constexpr unsigned long TRANSMISSION_INTERVAL = 1000 / 10; // Stream data every 100ms (10Hz)

static HX711 scale;
static bool is_streaming = true;
static unsigned long last_transmission = 0;


void setup() {
    Serial.begin(BAUD);
    scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
    scale.set_scale(DEFAULT_CALIBRATION_FACTOR);
    scale.tare();
    printf("setup done");
}

void loop() {
    if (Serial.available() > 0) {
        String command = Serial.readStringUntil('\n');
        command.trim();

        if (command.equals("tare")) {
            scale.tare();
            Serial.println("STATUS:TARED");
            delay(1000);
        } else if (command.equalsIgnoreCase("start")) {
            is_streaming = true;
            Serial.println("STATUS:STREAMING_STARTED");
        } else if (command.equalsIgnoreCase("stop")) {
            is_streaming = false;
            Serial.println("STATUS:STREAMING_STOPPED");
        } else if (command.startsWith("calibrate ")) {
            String calibrationWeightStr = command.substring(strlen("calibrate "));
            calibrationWeightStr.trim();
            const double calibrationWeight = calibrationWeightStr.toDouble();
            const long reading = scale.get_value(10);
            const double calibration_factor = reading / calibrationWeight;
            scale.set_scale(calibration_factor);
            Serial.printf("STATUS:CALIBRATED %f\n", calibration_factor);
        } else {
            Serial.println("ERROR:UNKNOWN COMMAND");
        }
    }

    if (is_streaming && (millis() - last_transmission >= TRANSMISSION_INTERVAL)) {
        last_transmission = millis();

        if (scale.is_ready()) {
            float weight = scale.get_units(1);

            Serial.print("DATA:");
            Serial.println(weight, 5);
        } else {
            Serial.println("ERROR:HX711_NOT_FOUND");
        }
    }
}
