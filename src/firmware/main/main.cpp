#include <Arduino.h>
#include <limits>

#include "rtc.h"
#include "HX711.h"
#include "esp32-hal-cpu.h"

constexpr int BAUD = 115200;
constexpr int LOADCELL_DOUT_PIN = 16;
constexpr int LOADCELL_SCK_PIN = 4;
constexpr float DEFAULT_CALIBRATION_FACTOR = -21593.0;
constexpr unsigned long TRANSMISSION_INTERVAL = 1000 / 10; // Stream data every 100ms (10Hz)
constexpr int DELAY_AFTER_TARE = 500;
constexpr int CALIBRATE_VALUES_TO_AVERAGE = 10;
constexpr int OUTPUT_DECIMAL_PLACES = 5;

static HX711 scale;
static bool is_streaming = true;
static unsigned long last_transmission_time = 0;
static constexpr float MAX_WEIGHT_DEFAULT = std::numeric_limits<float>::lowest();
static float maxWeight = MAX_WEIGHT_DEFAULT;


void setup() {
    Serial.begin(BAUD);
    scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
    scale.set_scale(DEFAULT_CALIBRATION_FACTOR);
    scale.tare();
}

void loop() {
    if (Serial.available() > 0) {
        String command = Serial.readStringUntil('\n');
        command.trim();

        if (command.equalsIgnoreCase("tare")) {
            scale.tare();
            delay(DELAY_AFTER_TARE); // wait a bit to avoid error of HX711 not found
            Serial.println("STATUS:TARED");
        } else if (command.equalsIgnoreCase("start")) {
            is_streaming = true;
            Serial.println("STATUS:STREAMING_STARTED");
        } else if (command.equalsIgnoreCase("stop")) {
            is_streaming = false;
            Serial.println("STATUS:STREAMING_STOPPED");
        } else if (command.equalsIgnoreCase("reset_max_weight")) {
            maxWeight = MAX_WEIGHT_DEFAULT;
            Serial.println("STATUS:MAX_WEIGHT_RESET");
        } else if (command.startsWith("calibrate ")) {
            String calibrationWeightStr = command.substring(strlen("calibrate "));
            calibrationWeightStr.trim();
            const double calibrationWeight = calibrationWeightStr.toDouble();
            const long reading = scale.get_value(CALIBRATE_VALUES_TO_AVERAGE);
            const double calibration_factor = reading / calibrationWeight;
            scale.set_scale(calibration_factor);
            Serial.printf("STATUS:CALIBRATED %f\n", calibration_factor);
        } else {
            Serial.println("ERROR:UNKNOWN COMMAND");
        }
    }


    const unsigned long now = millis();
    if (is_streaming && (now - last_transmission_time >= TRANSMISSION_INTERVAL)) {
        last_transmission_time = now;

        if (scale.is_ready()) {
            const float weight = scale.get_units();

            if (weight > maxWeight) {
                maxWeight = weight;
            }

            Serial.print("DATA:CURRENT_WEIGHT_MAX_WEIGHT:");
            Serial.print(weight, OUTPUT_DECIMAL_PLACES);
            Serial.print(":");
            Serial.println(maxWeight, OUTPUT_DECIMAL_PLACES);
        } else {
            Serial.println("ERROR:SCALE_NOT_FOUND");
        }
    }
}
