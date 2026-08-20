/**
 * Camera Service
 * Gerencia a conexão com câmera (USB/Webcam) para captura de imagens
 * Preparado para usar com node-webcam ou opencv4nodejs
 */

const fs = require('fs');
const path = require('path');

class CameraService {
  constructor() {
    this.camera = null;
    this.isInitialized = false;
    this.cameraDeviceId = 0; // ID da câmera (0 = câmera padrão)
    this.captureTimeout = 5000; // Timeout de 5 segundos para captura
    this.imageQuality = 80; // Qualidade JPEG (0-100)
    this.imagesDir = path.join(__dirname, '..', '..', 'data', 'camera_images');
    
    // Criar diretório para armazenar imagens se não existir
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  /**
   * Inicializa a câmera
   * @param {number} deviceId - ID do dispositivo da câmera (padrão: 0)
   * @returns {Promise<boolean>} - True se inicializado com sucesso
   */
  async initialize(deviceId = 0) {
    try {
      console.log(`[CameraService] Iniciando câmera - Device ID: ${deviceId}`);
      
            let Webcam;
            try {
              Webcam = require('node-webcam');
            } catch (error) {
              throw new Error('Instale node-webcam para usar uma câmera USB: ' + error.message);
            }

      this.cameraDeviceId = deviceId;
            this.camera = Webcam.create({
              width: Number(process.env.CAMERA_WIDTH || 1280),
              height: Number(process.env.CAMERA_HEIGHT || 720),
              quality: Number(process.env.CAMERA_QUALITY || 85),
              delay: 0,
              saveImages: true,
              output: 'jpeg',
              device: this.cameraDeviceId,
              callbackReturn: 'location'
            });
      this.isInitialized = true;
      
      return true;
    } catch (error) {
      console.error('[CameraService] Erro ao inicializar câmera:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Captura uma imagem da câmera
   * @returns {Promise<{path: string, timestamp: string, base64?: string}>} - Caminho da imagem capturada
   */
  async captureImage() {
    if (!this.isInitialized) {
      throw new Error('Câmera não inicializada. Chame initialize() primeiro.');
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `capture_${timestamp}.jpg`;
      const imagePath = path.join(this.imagesDir, filename);

      console.log(`[CameraService] Capturando imagem: ${filename}`);

      if (!this.camera) {
        throw new Error('Câmera não inicializada');
      }

      const capturePath = imagePath.replace(/\.jpg$/i, '');
      await new Promise((resolve, reject) => {
        this.camera.capture(capturePath, (error, data) => {
          if (error) return reject(error);
          if (Buffer.isBuffer(data) && !fs.existsSync(imagePath)) {
            fs.writeFileSync(imagePath, data);
          }
          resolve();
        });
      });

      if (!fs.existsSync(imagePath)) {
        throw new Error(`A câmera não produziu o arquivo esperado: ${imagePath}`);
      }

      // Opcional: Converter para base64 para retornar inline
      const base64 = fs.readFileSync(imagePath).toString('base64');

      return {
        path: imagePath,
        filename: filename,
        timestamp: timestamp,
        base64: base64,
        relativePath: `camera_images/${filename}`
      };
    } catch (error) {
      console.error('[CameraService] Erro ao capturar imagem:', error.message);
      throw error;
    }
  }

  /**
   * Captura múltiplas imagens (burst mode)
   * @param {number} count - Número de imagens a capturar
   * @param {number} interval - Intervalo entre capturas em ms
   * @returns {Promise<Array>} - Array com caminhos das imagens capturadas
   */
  async captureBurst(count = 3, interval = 500) {
    const images = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const image = await this.captureImage();
        images.push(image);
        
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (error) {
        console.error(`[CameraService] Erro na captura ${i + 1}:`, error.message);
      }
    }
    
    return images;
  }

  /**
   * Retorna status da câmera
   * @returns {Object} - Status atual
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      cameraDeviceId: this.cameraDeviceId,
      imagesDir: this.imagesDir,
      captureTimeout: this.captureTimeout,
      imageQuality: this.imageQuality
    };
  }

  /**
   * Finaliza a câmera
   */
  async dispose() {
    try {
      // TODO: Implementar limpeza real
      this.isInitialized = false;
      console.log('[CameraService] Câmera finalizada');
    } catch (error) {
      console.error('[CameraService] Erro ao finalizar câmera:', error.message);
    }
  }

  /**
   * Lista imagens capturadas
   * @returns {Array<string>} - Lista de nomes de arquivo
   */
  listCapturedImages() {
    try {
      return fs.readdirSync(this.imagesDir)
        .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
        .sort()
        .reverse();
    } catch (error) {
      console.error('[CameraService] Erro ao listar imagens:', error.message);
      return [];
    }
  }

  /**
   * Remove imagem antiga (cleanup)
   * @param {number} ageHours - Remover imagens com mais de X horas
   */
  cleanupOldImages(ageHours = 24) {
    try {
      const now = Date.now();
      const maxAge = ageHours * 60 * 60 * 1000;
      
      const files = fs.readdirSync(this.imagesDir);
      let deleted = 0;
      
      files.forEach(file => {
        const filepath = path.join(this.imagesDir, file);
        const stat = fs.statSync(filepath);
        
        if (now - stat.mtime.getTime() > maxAge) {
          fs.unlinkSync(filepath);
          deleted++;
        }
      });
      
      console.log(`[CameraService] Removidas ${deleted} imagens antigas`);
      return deleted;
    } catch (error) {
      console.error('[CameraService] Erro ao limpar imagens:', error.message);
      return 0;
    }
  }
}

// Singleton
let cameraServiceInstance = null;

function getCameraService() {
  if (!cameraServiceInstance) {
    cameraServiceInstance = new CameraService();
  }
  return cameraServiceInstance;
}

module.exports = { CameraService, getCameraService };
