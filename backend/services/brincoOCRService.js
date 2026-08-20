/**
 * Brinco OCR Service
 * Identifica o número do brinco usando OCR (Optical Character Recognition)
 * Usa Tesseract.js para processar imagens
 */

const fs = require('fs');

let Tesseract;

try {
  Tesseract = require('tesseract.js');
} catch (error) {
  console.warn('[BrincoOCRService] Tesseract.js não instalado:', error.message);
}

class BrincoOCRService {
  constructor() {
    this.isInitialized = false;
    this.workerPromise = null;
    this.confidence = 0.6; // Confiança mínima para aceitar resultado
    this.languages = 'eng'; // Idioma para OCR
  }

  /**
   * Inicializa o worker Tesseract
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      if (!Tesseract) {
        throw new Error('Instale tesseract.js para habilitar o reconhecimento do brinco');
      }

      console.log('[BrincoOCRService] Inicializando Tesseract OCR');
      this.workerPromise = Tesseract.createWorker(this.languages);
      await this.workerPromise;
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[BrincoOCRService] Erro ao inicializar:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Identifica brinco em uma imagem
   * @param {string} imagePath - Caminho da imagem
   * @returns {Promise<{brincoId: string, confidence: number, rawText: string}>}
   */
  async identifyBrinco(imagePath) {
    if (!this.isInitialized) {
      throw new Error('OCR não inicializado. Chame initialize() primeiro.');
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Arquivo não encontrado: ${imagePath}`);
    }

    try {
      console.log(`[BrincoOCRService] Processando imagem: ${imagePath}`);

      const worker = await this.workerPromise;
      const result = await worker.recognize(imagePath);
      const text = result.data.text;
      
      const brincoId = this.extractBrincoNumber(text);
      const confidence = Number(result.data.confidence || 0) / 100;

      return {
        brincoId: brincoId,
        confidence: parseFloat(confidence.toFixed(3)),
        rawText: text,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[BrincoOCRService] Erro ao processar imagem:', error.message);
      throw error;
    }
  }

  /**
   * Identifica múltiplos brincos (das imagens do burst)
   * @param {Array<string>} imagePaths - Array de caminhos de imagem
   * @returns {Promise<Array>} - Array de resultados
   */
  async identifyBrincoBurst(imagePaths) {
    const results = [];

    for (const imagePath of imagePaths) {
      try {
        const result = await this.identifyBrinco(imagePath);
        results.push(result);
      } catch (error) {
        console.error(`[BrincoOCRService] Erro ao processar ${imagePath}:`, error.message);
        results.push({
          brincoId: null,
          confidence: 0,
          error: error.message,
          imagePath: imagePath
        });
      }
    }

    return results;
  }

  /**
   * Extrai número do brinco do texto OCR
   * Assume que o brinco é um número de 4-8 dígitos
   * @param {string} text - Texto extraído por OCR
   * @returns {string|null} - Número do brinco ou null
   */
  extractBrincoNumber(text) {
    if (!text) return null;

    const cleanText = text.trim().toUpperCase();
    const matches = cleanText.match(/\b(?:[A-Z]{1,4}[- ]?)?\d{3,8}\b/g);
    
    if (!matches || matches.length === 0) {
      return null;
    }

    // Retornar o primeiro match (ou o mais frequente)
    return matches[0].replace(/\s+/g, '').replace(/([A-Z])-/g, '$1-');
  }

  /**
   * Valida se o brinco existe no banco de dados
   * @param {Object} db - Database instance
   * @param {string} brincoId - ID do brinco
   * @returns {Object|null} - Dados do animal ou null
   */
  validateBrinco(db, brincoId) {
    if (!brincoId) return null;

    try {
      const animal = db
        .prepare('SELECT * FROM animal WHERE id_brinco = ?')
        .get(brincoId);
      
      return animal || null;
    } catch (error) {
      console.error('[BrincoOCRService] Erro ao validar brinco:', error.message);
      return null;
    }
  }

  /**
   * Realiza OCR + Validação em um passo
   * @param {Object} db - Database instance
   * @param {string} imagePath - Caminho da imagem
   * @returns {Promise<{animal: Object, confidence: number, brincoId: string}>}
   */
  async identifyAndValidate(db, imagePath) {
    try {
      // 1. OCR da imagem
      const ocrResult = await this.identifyBrinco(imagePath);
      
      if (ocrResult.confidence < this.confidence) {
        throw new Error(
          `Confiança insuficiente: ${(ocrResult.confidence * 100).toFixed(1)}% < ${(this.confidence * 100).toFixed(1)}%`
        );
      }

      // 2. Validar brinco no BD
      const animal = this.validateBrinco(db, ocrResult.brincoId);
      
      if (!animal) {
        throw new Error(`Brinco não encontrado no banco de dados: ${ocrResult.brincoId}`);
      }

      return {
        animal: animal,
        confidence: ocrResult.confidence,
        brincoId: ocrResult.brincoId,
        imagePath: imagePath,
        timestamp: ocrResult.timestamp
      };
    } catch (error) {
      console.error('[BrincoOCRService] Erro no processo de identificação:', error.message);
      throw error;
    }
  }

  /**
   * Define confiança mínima
   * @param {number} confidence - Valor entre 0 e 1
   */
  setMinimumConfidence(confidence) {
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confiança deve estar entre 0 e 1');
    }
    this.confidence = confidence;
  }

  /**
   * Retorna status do serviço
   * @returns {Object}
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      minimumConfidence: this.confidence,
      languages: this.languages
    };
  }

  /**
   * Finaliza o worker
   */
  async dispose() {
    try {
      if (this.workerPromise) {
        const worker = await this.workerPromise;
        await worker.terminate();
      }
      this.workerPromise = null;
      this.isInitialized = false;
      console.log('[BrincoOCRService] Worker finalizado');
    } catch (error) {
      console.error('[BrincoOCRService] Erro ao finalizar:', error.message);
    }
  }
}

// Singleton
let ocrServiceInstance = null;

function getBrincoOCRService() {
  if (!ocrServiceInstance) {
    ocrServiceInstance = new BrincoOCRService();
  }
  return ocrServiceInstance;
}

module.exports = { BrincoOCRService, getBrincoOCRService };
