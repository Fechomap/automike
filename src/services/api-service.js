// src/services/api-service.js
const axios = require('axios');
const logger = require('../utils/logger').scope('ApiService');
const ErrorHandler = require('../utils/error-handler');

/**
 * Servicio para comunicación con APIs externas
 */
class ApiService {
  constructor() {
    // Configuración por defecto para axios
    this.defaultConfig = {
      timeout: 15000, // 15 segundos
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    // Número máximo de reintentos
    this.maxRetries = 3;
    
    // Tiempo de espera entre reintentos (ms)
    this.retryDelay = 2000;
  }
  
  /**
   * Realiza una solicitud HTTP con reintentos automáticos
   * @param {Object} config - Configuración de axios
   * @param {number} retryCount - Contador de reintentos (uso interno)
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async request(config, retryCount = 0) {
    try {
      logger.info(`Enviando solicitud ${config.method?.toUpperCase() || 'GET'} a: ${config.url}`);
      
      // Combinar configuración por defecto con la proporcionada
      const finalConfig = {
        ...this.defaultConfig,
        ...config
      };
      
      const response = await axios(finalConfig);
      return response.data;
    } catch (error) {
      // Registrar detalles del error
      logger.error(
        `Error en solicitud ${config.method?.toUpperCase() || 'GET'} a ${config.url}:`,
        error.message
      );
      
      if (error.response) {
        logger.error('Respuesta del servidor:', error.response.status, JSON.stringify(error.response.data));
        return {
          success: false,
          status: error.response.status,
          message: error.response.data?.message || 'Error en el servidor'
        };
      }
      
      // Reintentar en caso de errores de red si no se excede el límite
      const networkErrors = ['ECONNABORTED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'];
      if (retryCount < this.maxRetries && (networkErrors.includes(error.code) || error.message.includes('timeout'))) {
        logger.info(`Reintentando solicitud (${retryCount + 1}/${this.maxRetries})...`);
        
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        
        return this.request(config, retryCount + 1);
      }
      
      // Devolver error si se agotaron los reintentos
      return {
        success: false,
        error: error.message,
        message: ErrorHandler.getReadableErrorMessage(error)
      };
    }
  }
  
  /**
   * Realiza una solicitud GET
   * @param {string} url - URL de la API
   * @param {Object} params - Parámetros de consulta
   * @param {Object} config - Configuración adicional
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async get(url, params = {}, config = {}) {
    return this.request({
      method: 'get',
      url,
      params,
      ...config
    });
  }
  
  /**
   * Realiza una solicitud POST
   * @param {string} url - URL de la API
   * @param {Object} data - Datos a enviar
   * @param {Object} config - Configuración adicional
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async post(url, data = {}, config = {}) {
    return this.request({
      method: 'post',
      url,
      data,
      ...config
    });
  }
  
  /**
   * Realiza una solicitud PUT
   * @param {string} url - URL de la API
   * @param {Object} data - Datos a enviar
   * @param {Object} config - Configuración adicional
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async put(url, data = {}, config = {}) {
    return this.request({
      method: 'put',
      url,
      data,
      ...config
    });
  }
  
  /**
   * Realiza una solicitud DELETE
   * @param {string} url - URL de la API
   * @param {Object} config - Configuración adicional
   * @returns {Promise<Object>} - Respuesta de la API
   */
  async delete(url, config = {}) {
    return this.request({
      method: 'delete',
      url,
      ...config
    });
  }
}

// Exportar instancia única para usar en toda la aplicación
module.exports = new ApiService();