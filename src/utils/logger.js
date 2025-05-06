const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const electronLog = require('electron-log');

/**
 * Sistema centralizado de logging para la aplicación
 */
class Logger {
  constructor() {
    try {
      // Configurar directorio de logs
      this.logDir = path.join(app.getPath('userData'), 'logs');
      
      // Asegurar que el directorio de logs existe
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      
      // Configurar electron-log
      electronLog.transports.file.resolvePath = () => path.join(this.logDir, 'app.log');
      electronLog.transports.file.level = 'info';
      electronLog.transports.console.level = 'info';
      
      // Maxima cantidad de archivos de log a mantener
      electronLog.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
      electronLog.transports.file.archiveLog = file => {
        const date = new Date().toISOString().replace(/:/g, '-');
        return path.join(path.dirname(file), `${date}-${path.basename(file)}`);
      };
    } catch (error) {
      console.error('Error inicializando logger:', error);
    }
    
    this.logger = electronLog;
  }
  
  /**
   * Crea un logger con un prefijo específico para un componente
   * @param {string} scope - Nombre del componente o módulo
   * @returns {Object} - Logger específico para el componente
   */
  scope(scope) {
    const scopedLogger = {};
    const methods = ['info', 'warn', 'error', 'debug', 'verbose'];
    
    for (const method of methods) {
      scopedLogger[method] = (...args) => {
        this.logger[method](`[${scope}]`, ...args);
      };
    }
    
    return scopedLogger;
  }
  
  // Métodos principales de logging
  info(...args) {
    this.logger.info(...args);
  }
  
  warn(...args) {
    this.logger.warn(...args);
  }
  
  error(...args) {
    this.logger.error(...args);
  }
  
  debug(...args) {
    this.logger.debug(...args);
  }
  
  /**
   * Registra un error con su stack trace
   * @param {Error} error - Error a registrar
   * @param {string} context - Contexto donde ocurrió el error
   */
  logError(error, context = '') {
    this.logger.error(
      `[${context}] Error: ${error.message}`,
      '\nStack:',
      error.stack || 'No stack trace disponible'
    );
  }
}

// Exportar instancia única para usar en toda la aplicación
module.exports = new Logger();