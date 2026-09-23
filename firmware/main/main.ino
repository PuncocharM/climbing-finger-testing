/*
  Rui Santos
  Complete project details at https://RandomNerdTutorials.com/esp32-load-cell-hx711/
  
  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files.
  
  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.
*/

// Calibrating the load cell
#include <Arduino.h>
#include "soc/rtc.h"
#include "HX711.h"
#include "esp32-hal-cpu.h"

// HX711 circuit wiring
const int LOADCELL_DOUT_PIN = 16;
const int LOADCELL_SCK_PIN = 4;

HX711 scale;

// --- Calibration Factor ---
// Change this value to calibrate your specific load cell setup
float calibration_factor = -20500.0; 

// --- Control Variables ---
bool is_streaming = true;
unsigned long last_transmission = 0;
const unsigned long transmission_interval = 1000/10; // Stream data every 100ms (10Hz)



void setup() {
  Serial.begin(115200);
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(calibration_factor);
  scale.tare(); 
  printf("setup done");


  // rtc_cpu_freq_config_t config;
  // rtc_clk_cpu_freq_get_config(&config);
  // rtc_clk_cpu_freq_mhz_to_config(40, &config); // RTC_XTAL_FREQ_40M
  // //rtc_clk_cpu_freq_to_config(RTC_CPU_FREQ_80M, &config);
  // rtc_clk_cpu_freq_set_config_fast(&config);
  // Serial.println("Initializing the scale");

  // scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);

  // Serial.println("Before setting up the scale:");
  // Serial.print("read: \t\t");
  // Serial.println(scale.read());      // print a raw reading from the ADC

  // Serial.print("read average: \t\t");
  // Serial.println(scale.read_average(20));   // print the average of 20 readings from the ADC

  // Serial.print("get value: \t\t");
  // Serial.println(scale.get_value(5));   // print the average of 5 readings from the ADC minus the tare weight (not set yet)

  // Serial.print("get units: \t\t");
  // Serial.println(scale.get_units(5), 1);  // print the average of 5 readings from the ADC minus tare weight (not set) divided
  //           // by the SCALE parameter (not set yet)
            
  // scale.set_scale(-20500);
  // //scale.set_scale(-471.497);                      // this value is obtained by calibrating the scale with known weights; see the README for details
  // scale.tare();               // reset the scale to 0

  // Serial.println("After setting up the scale:");

  // Serial.print("read: \t\t");
  // Serial.println(scale.read());                 // print a raw reading from the ADC

  // Serial.print("read average: \t\t");
  // Serial.println(scale.read_average(20));       // print the average of 20 readings from the ADC

  // Serial.print("get value: \t\t");
  // Serial.println(scale.get_value(5));   // print the average of 5 readings from the ADC minus the tare weight, set with tare()

  // Serial.print("get units: \t\t");
  // Serial.println(scale.get_units(5), 1);        // print the average of 5 readings from the ADC minus tare weight, divided
  //           // by the SCALE parameter set with set_scale

  // Serial.println("Readings:");
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command.equalsIgnoreCase("TARE")) {
      scale.tare();
      Serial.println("STATUS:TARED");
      delay(1000);
    } 
    else if (command.equalsIgnoreCase("START")) {
      is_streaming = true;
      Serial.println("STATUS:STREAMING_STARTED");
    } 
    else if (command.equalsIgnoreCase("STOP")) {
      is_streaming = false;
      Serial.println("STATUS:STREAMING_STOPPED");
    }
  }

  if (is_streaming && (millis() - last_transmission >= transmission_interval)) {
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

// void loop() {

//   // if (scale.is_ready()) {
//   //   // scale.set_scale();    
//   //   long reading = scale.get_units();
//   //   Serial.println(reading);
//   //   // Serial.println("Tare... remove any weights from the scale.");
//   //   // delay(5000);
//   //   // scale.tare();
//   //   // Serial.println("Tare done...");
//   //   // Serial.print("Place a known weight on the scale...");
//   //   // delay(5000);
//   //   // long reading = scale.get_units(10);
//   //   // Serial.print("Result: ");
//   //   // Serial.println(reading);
//   // } 
//   // else {
//   //   Serial.println("HX711 not found.");
//   // }
//   // delay(100);

//   // if (scale.is_ready()) {
//   //   scale.set_scale();    
//   //   // long reading = scale.get_units();
//   //   // Serial.println(reading);
//   //   Serial.println("Tare... remove any weights from the scale.");
//   //   delay(10000);
//   //   scale.tare();
//   //   Serial.println("Tare done...");
//   //   Serial.print("Place a known weight on the scale...");
//   //   delay(10000);
//   //   long reading = scale.get_units(10);
//   //   Serial.print("Result: ");
//   //   Serial.println(reading);
//   // } 
//   // else {
//   //   Serial.println("HX711 not found.");
//   // }
//   // delay(1000);

//   Serial.print("one reading:\t");
//   Serial.print(scale.get_units(), 1);
//   Serial.print("\t| average:\t");
//   Serial.println(scale.get_units(10), 5);


//   scale.power_down();             // put the ADC in sleep mode
//   delay(5000);
//   scale.power_up();

// }

//calibration factor will be the (reading)/(known weight)
