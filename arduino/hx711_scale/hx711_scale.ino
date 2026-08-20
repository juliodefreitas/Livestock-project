#include "HX711.h"

const byte LOADCELL_DOUT_PIN = 3;
const byte LOADCELL_SCK_PIN = 2;
const unsigned long SAMPLE_INTERVAL_MS = 250;

// Substitua pelo fator obtido durante a calibração com um peso conhecido.
float calibrationFactor = -7050.0f;
HX711 scale;
unsigned long lastSampleAt = 0;

void setup() {
  Serial.begin(9600);
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(calibrationFactor);
  scale.tare();
  Serial.println("SCALE_READY");
}

void loop() {
  if (millis() - lastSampleAt < SAMPLE_INTERVAL_MS) return;
  lastSampleAt = millis();

  if (!scale.is_ready()) {
    Serial.println("SCALE_NOT_READY");
    return;
  }

  const float weightKg = scale.get_units(3);
  if (weightKg >= 0.0f) {
    Serial.print(weightKg, 2);
    Serial.println(" kg");
  }
}

// Para calibrar: suba um peso conhecido, leia scale.get_units(10)
// e ajuste calibrationFactor até a leitura coincidir com o peso real.
