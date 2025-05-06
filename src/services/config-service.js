const Store = require('electron-store');
const { BrowserWindow } = require('electron');
const path = require('path');
const logger = require('../utils/logger').scope('ConfigService');
const fileUtils = require('../utils/file-utils');

/**
 * Servicio para gestión de configuración de la aplicación
 */
class ConfigService {
  constructor() {
    try {
      this.store = new Store({
        name: 'config',
        defaults: {
          isConfigured: false,
          credentials: null,
          firstRun: true,
          theme: 'light',
          language: 'es',
          updateSettings: {
            autoCheck: true,
            autoDownload: true,
            checkInterval: 4 * 60 * 60 * 1000 // 4 horas
          }
        }
      });
      
      logger.info('ConfigService inicializado correctamente');
    } catch (error) {
      logger.error('Error al inicializar ConfigService:', error);
      
      // Intentar crear una configuración de respaldo si falla
      try {
        this.store = new Store({
          name: 'config-backup',
          clearInvalidConfig: true,
          defaults: {
            isConfigured: false,
            credentials: null
          }
        });
        
        logger.info('ConfigService inicializado con configuración de respaldo');
      } catch (backupError) {
        logger.error('Error crítico al inicializar configuración:', backupError);
        throw new Error('No se pudo inicializar la configuración de la aplicación');
      }
    }
    
    this.configWindow = null;
  }

  /**
   * Obtiene las credenciales almacenadas
   * @returns {Object|null} - Credenciales o null si no existen
   */
  getCredentials() {
    try {
      return this.store.get('credentials');
    } catch (error) {
      logger.error('Error al obtener credenciales:', error);
      return null;
    }
  }

  /**
   * Guarda credenciales en la configuración
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña
   * @returns {boolean} - true si se guardó correctamente
   */
  saveCredentials(username, password) {
    try {
      if (!username || !password) {
        throw new Error('Usuario y contraseña son requeridos');
      }
      
      this.store.set('credentials', { username, password });
      this.store.set('isConfigured', true);
      
      // Opcional: asignar a variables de entorno
      process.env.IKE_USERNAME = username;
      process.env.IKE_PASSWORD = password;
      
      logger.info('Credenciales guardadas correctamente');
      return true;
    } catch (error) {
      logger.error('Error al guardar credenciales:', error);
      
      // Intentar guardar en un archivo de respaldo
      try {
        const backupPath = fileUtils.getUserDataPath('credentials_backup.json');
        fileUtils.writeJsonFile(backupPath, { 
          username, 
          password,
          timestamp: new Date().toISOString()
        });
        
        logger.info('Credenciales guardadas en archivo de respaldo');
      } catch (backupError) {
        logger.error('Error al guardar respaldo de credenciales:', backupError);
      }
      
      throw error;
    }
  }

  /**
   * Verifica si la aplicación está configurada
   * @returns {boolean} - true si está configurada
   */
  isConfigured() {
    return this.store.get('isConfigured') === true && !!this.getCredentials();
  }

  /**
   * Obtiene una configuración específica
   * @param {string} key - Clave de configuración
   * @param {any} defaultValue - Valor por defecto
   * @returns {any} - Valor de configuración
   */
  get(key, defaultValue = null) {
    try {
      return this.store.get(key, defaultValue);
    } catch (error) {
      logger.error(`Error al obtener configuración '${key}':`, error);
      return defaultValue;
    }
  }

  /**
   * Establece una configuración específica
   * @param {string} key - Clave de configuración
   * @param {any} value - Valor de configuración
   * @returns {boolean} - true si se guardó correctamente
   */
  set(key, value) {
    try {
      this.store.set(key, value);
      return true;
    } catch (error) {
      logger.error(`Error al establecer configuración '${key}':`, error);
      return false;
    }
  }

  /**
   * Elimina una configuración específica
   * @param {string} key - Clave de configuración
   * @returns {boolean} - true si se eliminó correctamente
   */
  delete(key) {
    try {
      this.store.delete(key);
      return true;
    } catch (error) {
      logger.error(`Error al eliminar configuración '${key}':`, error);
      return false;
    }
  }

  /**
   * Restablece la configuración a valores por defecto
   * @returns {boolean} - true si se restableció correctamente
   */
  reset() {
    try {
      // Hacer copia de seguridad primero
      const backup = {
        credentials: this.getCredentials(),
        config: this.store.store
      };
      
      const backupPath = fileUtils.getUserDataPath('config_backup.json');
      fileUtils.writeJsonFile(backupPath, backup);
      
      // Restablecer
      this.store.clear();
      
      logger.info('Configuración restablecida a valores por defecto');
      return true;
    } catch (error) {
      logger.error('Error al restablecer configuración:', error);
      return false;
    }
  }

  /**
   * Muestra la ventana de configuración
   * @returns {Promise<boolean>} - true si se configuró correctamente
   */
  async showConfigWindow() {
    if (this.configWindow) {
      this.configWindow.focus();
      return;
    }

    // Creamos la ventana de configuración con preload para exponer window.electronAPI
    this.configWindow = new BrowserWindow({
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js')
      },
      resizable: false,
      modal: true
    });

    try {
      await this.configWindow.loadFile(path.join(__dirname, '../../ui/config.html'));
      
      return new Promise((resolve) => {
        this.configWindow.on('closed', () => {
          this.configWindow = null;
          resolve(this.isConfigured());
        });
      });
    } catch (error) {
      logger.error('Error al cargar ventana de configuración:', error);
      return false;
    }
  }
}

// Exportar instancia única
module.exports = new ConfigService();