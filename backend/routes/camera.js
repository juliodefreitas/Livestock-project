/**
 * Routes: Camera & OCR Identification
 * Endpoints para integração de câmera e identificação de brinco
 */

const express = require('express');
const router = express.Router();
const { getCameraService } = require('../services/cameraService');
const { getBrincoOCRService } = require('../services/brincoOCRService');

const cameraService = getCameraService();
const ocrService = getBrincoOCRService();

/**
 * GET /api/camera/status
 * Retorna status atual da câmera
 */
router.get('/status', (req, res) => {
  try {
    const status = cameraService.getStatus();
    const ocrStatus = ocrService.getStatus();
    
    res.json({
      camera: status,
      ocr: ocrStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

/**
 * POST /api/camera/initialize
 * Inicializa a câmera
 * Body: { deviceId?: number }
 */
router.post('/initialize', async (req, res, next) => {
  try {
    const { deviceId = 0 } = req.body;
    
    const initialized = await cameraService.initialize(deviceId);
    const ocrInitialized = await ocrService.initialize();
    
    if (initialized && ocrInitialized) {
      res.json({
        success: true,
        message: 'Câmera e OCR inicializados com sucesso',
        status: {
          camera: cameraService.getStatus(),
          ocr: ocrService.getStatus()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erro ao inicializar câmera ou OCR',
        status: {
          camera: cameraService.getStatus(),
          ocr: ocrService.getStatus()
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/camera/capture
 * Captura uma imagem da câmera
 * Retorna a imagem em base64
 */
router.post('/capture', async (req, res, next) => {
  try {
    const image = await cameraService.captureImage();
    
    res.json({
      success: true,
      image: {
        filename: image.filename,
        timestamp: image.timestamp,
        relativePath: image.relativePath,
        base64: image.base64,
        path: image.path
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/camera/capture-burst
 * Captura múltiplas imagens em sequência
 * Body: { count?: number, interval?: number }
 */
router.post('/capture-burst', async (req, res, next) => {
  try {
    const { count = 3, interval = 500 } = req.body;
    
    const images = await cameraService.captureBurst(count, interval);
    
    res.json({
      success: true,
      captureCount: images.length,
      images: images.map(img => ({
        filename: img.filename,
        timestamp: img.timestamp,
        relativePath: img.relativePath
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/camera/images
 * Lista imagens capturadas
 * Query: { limit?: number }
 */
router.get('/images', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const images = cameraService.listCapturedImages().slice(0, limit);
    
    res.json({
      success: true,
      count: images.length,
      images: images
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

/**
 * POST /api/camera/cleanup
 * Remove imagens antigas
 * Body: { ageHours?: number }
 */
router.post('/cleanup', (req, res) => {
  try {
    const { ageHours = 24 } = req.body;
    const deleted = cameraService.cleanupOldImages(ageHours);
    
    res.json({
      success: true,
      message: `${deleted} imagens removidas`,
      deleted: deleted
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

/**
 * POST /api/camera/identify-brinco
 * Identifica brinco em uma imagem via OCR
 * Body: { imagePath: string }
 */
router.post('/identify-brinco', async (req, res, next) => {
  try {
    const { imagePath } = req.body;
    
    if (!imagePath) {
      return res.status(400).json({ erro: 'imagePath é obrigatório' });
    }
    
    const result = await ocrService.identifyBrinco(imagePath);
    
    res.json({
      success: true,
      identification: {
        brincoId: result.brincoId,
        confidence: result.confidence,
        rawText: result.rawText,
        timestamp: result.timestamp
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/camera/identify-brinco-burst
 * Identifica brinco em múltiplas imagens
 * Body: { imagePaths: Array<string> }
 */
router.post('/identify-brinco-burst', async (req, res, next) => {
  try {
    const { imagePaths } = req.body;
    
    if (!Array.isArray(imagePaths)) {
      return res.status(400).json({ erro: 'imagePaths deve ser um array' });
    }
    
    const results = await ocrService.identifyBrincoBurst(imagePaths);
    
    // Encontrar resultado com maior confiança
    const bestResult = results.reduce((best, current) => {
      return (current.confidence || 0) > (best.confidence || 0) ? current : best;
    });
    
    res.json({
      success: true,
      allResults: results,
      bestMatch: bestResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/camera/identify-and-validate
 * Captura imagem, identifica brinco e valida no BD
 * Fluxo completo: foto → OCR → buscar animal no BD
 * Query: { burst?: boolean }
 */
router.post('/identify-and-validate', async (req, res, next) => {
  try {
    const { burst = false } = req.query;
    const { db } = require('../db/database');
    
    let result = {};
    
    if (burst) {
      // Capturar múltiplas imagens
      console.log('[Camera] Iniciando captura em burst...');
      const images = await cameraService.captureBurst(3, 500);
      
      // Tentar identificar em cada imagem
      const validations = [];
      for (const image of images) {
        try {
          const validation = await ocrService.identifyAndValidate(db, image.path);
          validations.push({
            ...validation,
            imagePath: image.path,
            imageFilename: image.filename
          });
        } catch (error) {
          validations.push({
            success: false,
            error: error.message,
            imagePath: image.path,
            imageFilename: image.filename
          });
        }
      }
      
      // Retornar melhor resultado
      const successful = validations.filter(v => v.animal);
      if (successful.length > 0) {
        result = successful[0];
        result.allAttempts = validations;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Nenhuma identificação bem-sucedida',
          attempts: validations
        });
      }
    } else {
      // Capturar uma única imagem
      console.log('[Camera] Capturando imagem...');
      const image = await cameraService.captureImage();
      
      console.log('[Camera] Processando OCR...');
      result = await ocrService.identifyAndValidate(db, image.path);
      result.imagePath = image.path;
      result.imageFilename = image.filename;
    }
    
    res.json({
      success: true,
      animal: result.animal,
      animalId: result.animal.id,
      brincoId: result.brincoId,
      confidence: result.confidence,
      timestamp: result.timestamp,
      imageFilename: result.imageFilename
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
