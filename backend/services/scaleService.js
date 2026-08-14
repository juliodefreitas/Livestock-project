/**
 * Scale Service
 * Gerencia conexão com balança via USB/Serial
 * Suporta comunicação com sensores de peso via portas seriais
 */

// TODO: npm install serialport
// const SerialPort = require('serialport');
// const { ReadlineParser } = require('@serialport/parser-readline');

class ScaleService {
  constructor() {
    this.port = null;
    this.isConnected = false;
    this.portName = 'COM3'; // Windows padrão (Unix: '/dev/ttyUSB0')
    this.baudRate = 9600; // Taxa padrão para balança
    this.lastWeight = null;
    this.lastWeightTime = null;
    this.weightHistoryLimit = 10;
    this.weightHistory = [];
    this.parser = null;
    
    // Callbacks para eventos
    this.onWeightReceived = null;
    this.onError = null;
  }

  /**
   * Conecta à balança via porta serial
   * @param {string} portName - Nome da porta (ex: COM3, /dev/ttyUSB0)
   * @param {number} baudRate - Taxa de transmissão
   * @returns {Promise<boolean>} - True se conectado com sucesso
   */
  async connect(portName = 'COM3', baudRate = 9600) {
    try {
      console.log(`[ScaleService] Conectando na porta ${portName} (${baudRate} baud)`);
      
      // TODO: Implementar conexão real quando serialport estiver instalado
      // this.portName = portName;
      // this.baudRate = baudRate;
      // 
      // this.port = new SerialPort({
      //   path: portName,
      //   baudRate: baudRate,
      //   autoOpen: false
      // });
      // 
      // this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
      // 
      // this.port.on('error', (err) => this.handleError(err));
      // this.parser.on('data', (data) => this.handleWeightData(data));
      // 
      // await new Promise((resolve, reject) => {
      //   this.port.open((err) => {
      //     if (err) reject(err);
      //     else resolve();
      //   });
      // });
      
      this.isConnected = true;
      console.log('[ScaleService] Balança conectada com sucesso');
      
      return true;
    } catch (error) {
      console.error('[ScaleService] Erro ao conectar:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Processa dados de peso recebidos da balança
   * @param {string} data - Dados brutos da balança
   */
  handleWeightData(data) {
    try {
      const weight = this.parseWeightData(data);
      
      if (weight !== null && weight > 0) {
        this.lastWeight = weight;
        this.lastWeightTime = new Date();
        
        // Adicionar ao histórico
        this.weightHistory.unshift({
          weight: weight,
          timestamp: this.lastWeightTime,
          rawData: data
        });
        
        // Manter limite do histórico
        if (this.weightHistory.length > this.weightHistoryLimit) {
          this.weightHistory.pop();
        }
        
        console.log(`[ScaleService] Peso recebido: ${weight} kg`);
        
        // Chamar callback se definido
        if (this.onWeightReceived && typeof this.onWeightReceived === 'function') {
          this.onWeightReceived({
            weight: weight,
            timestamp: this.lastWeightTime,
            unit: 'kg'
          });
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Extrai peso dos dados da balança
   * Formato esperado: "0000.00 kg\r\n" ou similar
   * @param {string} data - Dados brutos
   * @returns {number|null} - Peso em kg ou null
   */
  parseWeightData(data) {
    if (!data) return null;

    try {
      // Remover espaços em branco
      const cleanData = data.trim();
      
      // Procurar por número decimal (ex: 123.45)
      const match = cleanData.match(/(\d+\.?\d*)/);
      
      if (!match) return null;
      
      const weight = parseFloat(match[1]);
      
      // Validar se é um peso razoável (entre 50 kg e 2000 kg)
      if (weight >= 50 && weight <= 2000) {
        return weight;
      }
      
      return null;
    } catch (error) {
      console.error('[ScaleService] Erro ao processar peso:', error.message);
      return null;
    }
  }

  /**
   * Trata erros da porta serial
   * @param {Error} error - Erro ocorrido
   */
  handleError(error) {
    console.error('[ScaleService] Erro na conexão:', error.message);
    this.isConnected = false;
    
    if (this.onError && typeof this.onError === 'function') {
      this.onError(error);
    }
  }

  /**
   * Retorna peso atual
   * @returns {Object|null} - {weight: number, timestamp: Date} ou null
   */
  getCurrentWeight() {
    if (this.lastWeight === null) return null;
    
    return {
      weight: this.lastWeight,
      timestamp: this.lastWeightTime
    };
  }

  /**
   * Retorna peso médio dos últimos N valores
   * @param {number} samples - Número de amostras para média
   * @returns {number|null}
   */
  getAverageWeight(samples = 5) {
    if (this.weightHistory.length === 0) return null;
    
    const samplesToUse = Math.min(samples, this.weightHistory.length);
    const total = this.weightHistory
      .slice(0, samplesToUse)
      .reduce((sum, item) => sum + item.weight, 0);
    
    return total / samplesToUse;
  }

  /**
   * Retorna histórico de peso
   * @returns {Array} - Histórico de pesos
   */
  getWeightHistory() {
    return [...this.weightHistory];
  }

  /**
   * Limpa o histórico de pesos
   */
  clearHistory() {
    this.weightHistory = [];
    this.lastWeight = null;
    this.lastWeightTime = null;
  }

  /**
   * Define callback para quando peso é recebido
   * @param {Function} callback - Função(weightData)
   */
  onWeight(callback) {
    this.onWeightReceived = callback;
  }

  /**
   * Define callback para erros
   * @param {Function} callback - Função(error)
   */
  onErrorCallback(callback) {
    this.onError = callback;
  }

  /**
   * Retorna status da conexão
   * @returns {Object}
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      portName: this.portName,
      baudRate: this.baudRate,
      lastWeight: this.lastWeight,
      lastWeightTime: this.lastWeightTime,
      historySize: this.weightHistory.length
    };
  }

  /**
   * Desconecta da balança
   * @returns {Promise<boolean>}
   */
  async disconnect() {
    try {
      // TODO: Implementar desconexão real
      // if (this.port && this.port.isOpen) {
      //   await new Promise((resolve, reject) => {
      //     this.port.close((err) => {
      //       if (err) reject(err);
      //       else resolve();
      //     });
      //   });
      // }
      
      this.isConnected = false;
      this.clearHistory();
      console.log('[ScaleService] Desconectado da balança');
      
      return true;
    } catch (error) {
      console.error('[ScaleService] Erro ao desconectar:', error.message);
      return false;
    }
  }

  /**
   * Lista portas seriais disponíveis
   * @returns {Promise<Array>} - Array de portas disponíveis
   */
  static async listAvailablePorts() {
    try {
      // TODO: Implementar listagem real
      // const ports = await SerialPort.list();
      // return ports;
      
      // Por enquanto, retornar mockado
      console.log('[ScaleService] Listando portas seriais...');
      return [
        { path: 'COM3', manufacturer: 'Balança Digital' },
        { path: 'COM4', manufacturer: 'Arduino' }
      ];
    } catch (error) {
      console.error('[ScaleService] Erro ao listar portas:', error.message);
      return [];
    }
  }
}

// Singleton
let scaleServiceInstance = null;

function getScaleService() {
  if (!scaleServiceInstance) {
    scaleServiceInstance = new ScaleService();
  }
  return scaleServiceInstance;
}

module.exports = { ScaleService, getScaleService };
