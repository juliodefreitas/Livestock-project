#include "HX711.h"

#if defined(__AVR__)
#include <avr/wdt.h>
#endif

const byte LOADCELL_DOUT_PIN = 3;
const byte LOADCELL_SCK_PIN = 2;
const unsigned long SAMPLE_INTERVAL_MS = 250;
const byte READINGS_PER_SAMPLE = 3;
const byte STABLE_SAMPLES_REQUIRED = 4;
const float STABLE_TOLERANCE_KG = 0.5f;
const float ZERO_THRESHOLD_KG = 5.0f;

// Substitua pelo fator obtido durante a calibração com um peso conhecido.
float calibrationFactor = -7050.0f;
HX711 scale;
unsigned long lastSampleAt = 0;
float recentWeights[STABLE_SAMPLES_REQUIRED] = {0};
byte recentWeightCount = 0;
byte recentWeightIndex = 0;
bool scaleWasStable = false;
bool animalWasDetected = false;

void resetStability() {
  recentWeightCount = 0;
  recentWeightIndex = 0;
  scaleWasStable = false;
}

bool isStable(float weightKg) {
  recentWeights[recentWeightIndex] = weightKg;
  recentWeightIndex = (recentWeightIndex + 1) % STABLE_SAMPLES_REQUIRED;
  if (recentWeightCount < STABLE_SAMPLES_REQUIRED) recentWeightCount++;

  if (recentWeightCount < STABLE_SAMPLES_REQUIRED) return false;

  float minimum = recentWeights[0];
  float maximum = recentWeights[0];
  for (byte index = 1; index < STABLE_SAMPLES_REQUIRED; index++) {
    if (recentWeights[index] < minimum) minimum = recentWeights[index];
    if (recentWeights[index] > maximum) maximum = recentWeights[index];
  }

  return (maximum - minimum) <= STABLE_TOLERANCE_KG;
}

void setup() {
#if defined(__AVR__)
  wdt_enable(WDTO_2S);
#endif
  Serial.begin(9600);
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(calibrationFactor);
  scale.tare();
  Serial.println("SCALE_READY");
  Serial.println("SCALE_ZERO");
}

void loop() {
#if defined(__AVR__)
  wdt_reset();
#endif

  if (millis() - lastSampleAt < SAMPLE_INTERVAL_MS) return;
  lastSampleAt = millis();

  if (!scale.is_ready()) {
    Serial.println("SCALE_NOT_READY");
    resetStability();
    return;
  }

  float weightKg = scale.get_units(READINGS_PER_SAMPLE);
  if (weightKg < 0.0f) weightKg = 0.0f;

  // O backend usa estas linhas para atualizar o peso e ignora valores abaixo de 50 kg.
  Serial.print(weightKg, 2);
  Serial.println(" kg");

  if (weightKg <= ZERO_THRESHOLD_KG) {
    if (animalWasDetected) {
      Serial.println("SCALE_ZERO");
      animalWasDetected = false;
    }
    resetStability();
    return;
  }

  animalWasDetected = true;
  const bool stable = isStable(weightKg);
  if (stable && !scaleWasStable) {
    Serial.println("SCALE_STABLE");
  } else if (!stable && scaleWasStable) {
    Serial.println("SCALE_UNSTABLE");
  }
  scaleWasStable = stable;
}

// Calibracao: com a plataforma vazia, mantenha a tara; depois coloque
// um peso conhecido e ajuste calibrationFactor ate a leitura coincidir.
