 cmake_minimum_required(VERSION 4.4)
project(load_cell)

set(CMAKE_CXX_STANDARD 14)


 include_directories(/cygdrive/c/Users/micha/OneDrive/Documents/Arduino/libraries/HX711_Arduino_Library/src)
 include_directories(/cygdrive/c/Users/micha/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.11/cores/esp32)
 include_directories(/cygdrive/c/Users/micha/AppData/Local/Arduino15/packages/esp32/tools/esp32s3-libs/3.3.11/include/esp_hw_support/include/soc/esp32s3)
 include_directories(/cygdrive/c/Users/micha/OneDrive/Documents/Arduino/libraries/HX711_Arduino_Library/src)

add_executable(load_cell main/main.ino)
