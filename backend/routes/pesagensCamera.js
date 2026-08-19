/**
 * Routes: Pesagem com Câmera (Integrated Weighing)
 * Fluxo completo de pesagem com identificação automática via câmera
 * 
 * Fluxo:
 * 1. Animal sobe na balança
 * 2. Câmera captura imagem do brinco
 * 3. OCR identifica número do brinco
 * 4. Sistema busca animal no BD
 * 5. Balança fornece peso
 * 6. Pesagem é registrada
 */

const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { getCameraService } = require('../services/cameraService');
const { getBrincoOCRService } = require('../services/brincoOCRService');
const { getScaleService } = require('../services/scaleService');
const { kgParaArrobas } = require('../services/calculationService');
const { ValidationError, validatePesoKg, validateDateField } = require('../utils/validation');

const cameraService = getCameraService();
const ocrService = getBrincoOCRService();
const scaleService = getScaleService();

function requireHardware() {
  const cameraStatus = cameraService.getStatus();
  const ocrStatus = ocrService.getStatus();
  const scaleStatus = scaleService.getStatus();

  if (!cameraStatus.isInitialized || !ocrStatus.isInitialized || !scaleStatus.isConnected) {
    const error = new Error('Hardware não disponível. Configure câmera, OCR e balança antes de usar este endpoint.');
    error.statusCode = 503;
    throw error;
  }
}

/**
 * POST /api/pesagens/camera
 * Pesagem via câmera e balança integradas
 * 
 * Fluxo automático:
 * 1. Captura imagem da câmera
 * 2. Identifica brinco via OCR
 * 3. Aguarda peso da balança (ou aceita peso no body)
 * 4. Registra pesagem
 * 
 * Body: { 
 *   peso_kg?: number,          // Se não especificado, usa peso da balança
 *   data_pesagem?: string,     // YYYY-MM-DD
 *   useBurst?: boolean,        // Usar múltiplas capturas
 *   minConfidence?: number     // Confiança mínima (0-1)
 * }
 */
router.post('/camera', async (req, res, next) => {
  try {
    requireHardware();

    const {
      peso_kg,
      data_pesagem = new Date().toISOString().split('T')[0],
      useBurst = false,
      minConfidence
    } = req.body;

    console.log('[Pesagem Camera] Iniciando fluxo integrado...');

    // Definir confiança mínima se fornecida
    if (minConfidence !== undefined) {
      ocrService.setMinimumConfidence(minConfidence);
    }

    // ETAPA 1: Capturar imagem(ns) da câmera
    console.log('[Pesagem Camera] Etapa 1: Capturando imagem...');
    let images = [];
    if (useBurst) {
      images = await cameraService.captureBurst(3, 500);
    } else {
      images = [await cameraService.captureImage()];
    }

    // ETAPA 2: Identificar brinco via OCR
    console.log('[Pesagem Camera] Etapa 2: Identificando brinco via OCR...');
    let animal = null;
    let bestIdentification = null;
    const identificationAttempts = [];

    for (const image of images) {
      try {
        const identification = await ocrService.identifyAndValidate(db, image.path);
        identificationAttempts.push({
          success: true,
          brincoId: identification.brincoId,
          confidence: identification.confidence,
          animalId: identification.animal.id,
          imagePath: image.filename
        });

        // Manter o melhor resultado
        if (!bestIdentification || identification.confidence > bestIdentification.confidence) {
          bestIdentification = identification;
          animal = identification.animal;
        }
      } catch (error) {
        identificationAttempts.push({
          success: false,
          error: error.message,
          imagePath: image.filename
        });
      }
    }

    if (!animal) {
      return res.status(400).json({
        success: false,
        error: 'Não foi possível identificar o brinco',
        attempts: identificationAttempts
      });
    }

    // ETAPA 3: Obter peso (da balança ou do body)
    console.log('[Pesagem Camera] Etapa 3: Obtendo peso...');
    let pesoFinal = peso_kg;

    if (!pesoFinal) {
      // Tentar obter da balança
      const pesoAtual = scaleService.getCurrentWeight();
      if (pesoAtual) {
        pesoFinal = pesoAtual.weight;
        console.log(`[Pesagem Camera] Peso obtido da balança: ${pesoFinal} kg`);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Peso não fornecido e balança não conectada',
          animal: animal
        });
      }
    }

    // Validar peso
    try {
      validatePesoKg(pesoFinal);
      validateDateField(data_pesagem, 'data_pesagem');
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
        animal: animal
      });
    }

    // ETAPA 4: Registrar pesagem no BD
    console.log('[Pesagem Camera] Etapa 4: Registrando pesagem...');
    const pesagemResult = db
      .prepare(
        'INSERT INTO pesagem (animal_id, peso_kg, data_pesagem, origem) VALUES (?, ?, ?, ?)'
      )
      .run(animal.id, pesoFinal, data_pesagem, 'camera');

    const pesagem = db
      .prepare('SELECT * FROM pesagem WHERE id = ?')
      .get(pesagemResult.lastInsertRowid);

    console.log(`[Pesagem Camera] Pesagem registrada com sucesso: ID ${pesagem.id}`);

    // RESPOSTA FINAL
    res.status(201).json({
      success: true,
      message: 'Pesagem registrada via câmera com sucesso',
      pesagem: {
        id: pesagem.id,
        animal_id: pesagem.animal_id,
        peso_kg: pesagem.peso_kg,
        peso_arrobas: kgParaArrobas(pesagem.peso_kg),
        data_pesagem: pesagem.data_pesagem,
        origem: pesagem.origem,
        created_at: pesagem.created_at
      },
      animal: {
        id: animal.id,
        id_brinco: animal.id_brinco,
        raca: animal.raca,
        sexo: animal.sexo
      },
      identificacao: {
        brincoId: bestIdentification.brincoId,
        confidence: bestIdentification.confidence,
        tentativas: identificationAttempts.length,
        sucesso: identificationAttempts.filter(a => a.success).length
      },
      imagens: images.map(img => ({
        filename: img.filename,
        timestamp: img.timestamp
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pesagens/camera/validate
 * Valida se câmera e balança estão funcionando
 * Sem registrar pesagem
 */
router.post('/camera/validate', async (req, res, next) => {
  try {
    requireHardware();
    console.log('[Pesagem Camera] Executando validação...');

    const results = {
      camera: null,
      ocr: null,
      scale: null,
      timestamp: new Date().toISOString()
    };

    // Testar câmera
    try {
      const cameraStatus = cameraService.getStatus();
      results.camera = {
        ok: cameraStatus.isInitialized,
        status: cameraStatus
      };
      
      if (cameraStatus.isInitialized) {
        console.log('[Pesagem Camera] ✓ Câmera OK');
      } else {
        console.log('[Pesagem Camera] ✗ Câmera não inicializada');
      }
    } catch (error) {
      results.camera = { ok: false, error: error.message };
      console.error('[Pesagem Camera] ✗ Erro na câmera:', error.message);
    }

    // Testar OCR
    try {
      const ocrStatus = ocrService.getStatus();
      results.ocr = {
        ok: ocrStatus.isInitialized,
        status: ocrStatus
      };
      
      if (ocrStatus.isInitialized) {
        console.log('[Pesagem Camera] ✓ OCR OK');
      } else {
        console.log('[Pesagem Camera] ✗ OCR não inicializado');
      }
    } catch (error) {
      results.ocr = { ok: false, error: error.message };
      console.error('[Pesagem Camera] ✗ Erro no OCR:', error.message);
    }

    // Testar balança
    try {
      const scaleStatus = scaleService.getStatus();
      results.scale = {
        ok: scaleStatus.isConnected,
        status: scaleStatus
      };
      
      if (scaleStatus.isConnected) {
        console.log('[Pesagem Camera] ✓ Balança OK');
      } else {
        console.log('[Pesagem Camera] ✗ Balança não conectada');
      }
    } catch (error) {
      results.scale = { ok: false, error: error.message };
      console.error('[Pesagem Camera] ✗ Erro na balança:', error.message);
    }

    const allOk = results.camera.ok && results.ocr.ok && results.scale.ok;

    res.json({
      success: allOk,
      allSystemsReady: allOk,
      systems: results
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pesagens/camera/setup
 * Setup automático: inicializa câmera, OCR e balança
 * 
 * Body: {
 *   cameraDeviceId?: number,
 *   scalePortName?: string,
 *   scaleBaudRate?: number
 * }
 */
router.post('/camera/setup', async (req, res, next) => {
  try {
    const {
      cameraDeviceId = process.env.CAMERA_DEVICE_ID || 0,
      scalePortName = process.env.SCALE_PORT || 'COM3',
      scaleBaudRate = process.env.SCALE_BAUD_RATE || 9600
    } = req.body;

    console.log('[Pesagem Camera] Iniciando setup...');

    const results = {
      camera: null,
      ocr: null,
      scale: null
    };

    // Inicializar câmera
    console.log('[Pesagem Camera] Inicializando câmera...');
    results.camera = await cameraService.initialize(cameraDeviceId);

    // Inicializar OCR
    console.log('[Pesagem Camera] Inicializando OCR...');
    results.ocr = await ocrService.initialize();

    // Conectar balança
    console.log('[Pesagem Camera] Conectando balança...');
    results.scale = await scaleService.connect(scalePortName, scaleBaudRate);

    const allOk = results.camera && results.ocr && results.scale;

    if (allOk) {
      res.json({
        success: true,
        message: 'Sistema de pesagem com câmera configurado com sucesso',
        results: {
          camera: cameraService.getStatus(),
          ocr: ocrService.getStatus(),
          scale: scaleService.getStatus()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erro na configuração do sistema',
        results: {
          camera: results.camera ? cameraService.getStatus() : null,
          ocr: results.ocr ? ocrService.getStatus() : null,
          scale: results.scale ? scaleService.getStatus() : null
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pesagens/camera/disconnect
 * Desconecta todos os dispositivos
 */
router.post('/camera/disconnect', async (req, res, next) => {
  try {
    await cameraService.dispose();
    await ocrService.dispose();
    await scaleService.disconnect();

    res.json({
      success: true,
      message: 'Todos os dispositivos desconectados'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
