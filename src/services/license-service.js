const { app, dialog } = require('electron');
const Store = require('electron-store');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');

const LicenseModel = require('../models/license-model');
const logger = require('../utils/logger').scope('LicenseService');
const apiService = require('./api-service');
const fileUtils = require('../utils/file-utils');
const { API_CONFIG, TOKEN_STATUS, ERROR_MESSAGES } = require('../config/constants');

/**
 * Servicio para gestión de licencias y tokens
 */
class LicenseService {
  constructor() {
    try {
      // Configurar electron-store con manejo de errores mejorado
      this.store = new Store({
        name: 'license',
        encryptionKey: 'ike-secure-key-2024',
        clearInvalidConfig: true
      });
    } catch (storeError) {
      logger.error('Error al inicializar electron-store:', storeError);
      // Si hay error, intentar crear con opciones mínimas
      this.store = new Store({
        name: 'license',
        clearInvalidConfig: true
      });
    }

    // Límites para las solicitudes a la API
    this.API_TIMEOUT = 15000; // 15 segundos
    this.EXPIRATION_WARNING_DAYS = 3;
    this.TRIAL_PERIOD_DAYS = 30;
    
    // Configurar verificación periódica de la licencia
    this.checkInterval = null;
  }

  /**
   * Obtiene información del dispositivo
   * @returns {Object} - Información del dispositivo
   */
  getDeviceInfo() {
    try {
      const info = {
        platform: process.platform,
        hostname: os.hostname(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        osType: os.type(),
        osRelease: os.release(),
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        userDataPath: app.getPath('userData'),
        date: new Date().toISOString()
      };

      return {
        ...info,
        totalMemory: `${Math.round(info.totalMemory / (1024 * 1024 * 1024))}GB`,
        cpus: `${info.cpus} cores`
      };
    } catch (error) {
      logger.error('Error al obtener información del dispositivo:', error);
      return {
        platform: 'unknown',
        hostname: 'unknown',
        appVersion: app.getVersion(),
        error: error.message
      };
    }
  }

  /**
   * Genera un ID único para esta máquina
   * @returns {string} - ID de la máquina
   */
  generateMachineId() {
    return `machine-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Guarda un token validado
   * @param {Object} tokenData - Datos del token
   * @returns {Promise<boolean>} - true si se guardó correctamente
   */
  async saveValidatedToken(tokenData) {
    try {
      // Agregar más metadatos
      const enrichedTokenData = {
        ...tokenData,
        validatedAt: new Date().toISOString(),
        appVersion: app.getVersion()
      };
      
      // Verificar si hay un token existente - obtener copia antes de modificar
      let existingToken = null;
      try {
        existingToken = this.store.get('validatedToken');
      } catch (readError) {
        logger.warn('No se pudo leer el token existente:', readError);
      }
      
      // Guardar nuevo token con manejo de errores
      try {
        this.store.set('validatedToken', enrichedTokenData);
        logger.info('Token guardado exitosamente:', tokenData.token);
      } catch (saveError) {
        logger.error('Error al guardar el token en electron-store:', saveError);
        
        // Intentar guardar una copia del token en formato JSON plano como respaldo
        try {
          const backupPath = path.join(app.getPath('userData'), `license_backup_${Date.now()}.json`);
          fs.writeFileSync(backupPath, JSON.stringify(enrichedTokenData, null, 2), 'utf8');
          logger.info(`Token guardado como respaldo en: ${backupPath}`);
        } catch (backupError) {
          logger.error('Error al crear respaldo del token:', backupError);
        }
        
        // Reintento con opciones mínimas
        try {
          this.store = new Store({
            name: 'license',
            clearInvalidConfig: true
          });
          this.store.set('validatedToken', enrichedTokenData);
          logger.info('Token guardado en segundo intento con opciones mínimas');
        } catch (retryError) {
          logger.error('Error en segundo intento de guardado:', retryError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error general al guardar el token:', error);
      return false;
    }
  }

  /**
   * Obtiene el token almacenado
   * @returns {LicenseModel|null} - Token almacenado o null si no existe
   */
  getStoredToken() {
    try {
      const tokenData = this.store.get('validatedToken');
      if (tokenData) {
        logger.info('Token almacenado encontrado, expira:', tokenData.expiresAt);
        return LicenseModel.fromJSON(tokenData);
      }
      
      logger.info('No se encontró token almacenado en electron-store');
      
      // Si no hay token en electron-store, intentar buscar en archivos de respaldo
      return this.attemptTokenRecovery();
    } catch (error) {
      logger.error('Error al obtener el token guardado:', error);
      
      // Intentar recuperar desde respaldo
      return this.attemptTokenRecovery();
    }
  }

  /**
   * Intenta recuperar el token desde archivos de respaldo
   * @returns {LicenseModel|null} - Token recuperado o null
   */
  attemptTokenRecovery() {
    try {
      logger.info('Intentando recuperar token desde archivos de respaldo...');
      const userData = app.getPath('userData');
      
      // Buscar archivos de respaldo
      const files = fs.readdirSync(userData)
        .filter(file => file.startsWith('license_backup_') && file.endsWith('.json'))
        .sort()
        .reverse(); // Más recientes primero
      
      if (files.length === 0) {
        logger.info('No se encontraron archivos de respaldo');
        return null;
      }
      
      // Intentar leer cada archivo hasta encontrar uno válido
      for (const file of files) {
        try {
          const filePath = path.join(userData, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const tokenData = JSON.parse(content);
          
          if (tokenData && tokenData.token) {
            logger.info(`Token recuperado desde respaldo: ${file}`);
            
            // Guardar el token recuperado en electron-store
            this.saveValidatedToken(tokenData)
              .then(success => {
                if (success) {
                  logger.info('Token recuperado guardado en electron-store');
                }
              })
              .catch(err => {
                logger.error('Error al guardar token recuperado:', err);
              });
            
            return LicenseModel.fromJSON(tokenData);
          }
        } catch (e) {
          logger.error(`Error al leer archivo de respaldo ${file}:`, e);
          // Continuar con el siguiente archivo
        }
      }
      
      logger.info('No se pudo recuperar token desde archivos de respaldo');
      return null;
    } catch (error) {
      logger.error('Error en proceso de recuperación de token:', error);
      return null;
    }
  }

  /**
   * Valida un token con el servidor
   * @param {string} token - Token a validar
   * @returns {Promise<Object>} - Resultado de la validación
   */
  async validateToken(token) {
    if (!token || token.trim() === '') {
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: ERROR_MESSAGES.EMPTY_TOKEN
      };
    }
    
    try {
      logger.info('Validando token:', token);
      
      // 1. Primero intentar redimir el token
      const redeemResult = await this.redeemToken(token);
      logger.info('Resultado de redención:', JSON.stringify(redeemResult));
      
      // Si la redención fue exitosa, retornamos el resultado
      if (redeemResult.valid) {
        return redeemResult;
      }
      
      // 2. Si la redención falla, intentar la validación estándar
      logger.info('Redención falló, intentando validación estándar...');
      
      const deviceInfo = this.getDeviceInfo();
      const machineId = this.generateMachineId();
      const deviceInfoString = JSON.stringify(deviceInfo);
      
      // Realizar solicitud POST al endpoint de validación
      const validateEndpoint = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VALIDATE_TOKEN}`;
      const response = await apiService.post(validateEndpoint, {
        token,
        machineId,
        deviceInfo: deviceInfoString
      });
      
      logger.info('Respuesta de validación de token:', JSON.stringify(response));
      
      if (response.success) {
        const tokenData = {
          token,
          machineId,
          deviceInfo: deviceInfoString,
          expiresAt: response.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          lastValidation: new Date().toISOString(),
          status: TOKEN_STATUS.VALID
        };
        
        // Crear modelo de licencia
        const licenseModel = LicenseModel.fromJSON(tokenData);
        
        // Guardar el token validado
        await this.saveValidatedToken(licenseModel.toJSON());
        
        return {
          valid: true,
          status: TOKEN_STATUS.VALID,
          expiresAt: licenseModel.expiresAt,
          message: 'Token validado correctamente'
        };
      }
      
      // Si la respuesta no es exitosa
      return {
        valid: false,
        status: response.status === 403 ? TOKEN_STATUS.EXPIRED : TOKEN_STATUS.INVALID,
        message: response.message || ERROR_MESSAGES.INVALID_TOKEN
      };
      
    } catch (error) {
      logger.error('Error inesperado al validar token:', error);
      
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: ERROR_MESSAGES.VALIDATION_ERROR
      };
    }
  }

  /**
   * Redime un token
   * @param {string} token - Token a redimir
   * @returns {Promise<Object>} - Resultado de la redención
   */
  async redeemToken(token) {
    try {
      if (!token || token.trim() === '') {
        return {
          valid: false,
          status: TOKEN_STATUS.INVALID,
          message: ERROR_MESSAGES.EMPTY_TOKEN
        };
      }
      
      logger.info('Intentando redimir token:', token);
      
      const deviceInfo = this.getDeviceInfo();
      const machineId = this.generateMachineId();
      const deviceInfoString = JSON.stringify(deviceInfo);
      
      // Crear la URL para la solicitud POST de redención
      const redeemEndpoint = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REDEEM_TOKEN}`;
      
      const response = await apiService.post(redeemEndpoint, {
        token,
        machineId,
        deviceInfo: deviceInfoString
      });
      
      logger.info('Respuesta de redención de token:', JSON.stringify(response));
      
      if (response.success) {
        // Si la redención es exitosa, guardamos el token validado
        const tokenData = {
          token,
          machineId,
          deviceInfo: deviceInfoString,
          expiresAt: response.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          lastValidation: new Date().toISOString(),
          redeemed: true,
          redemptionDate: new Date().toISOString(),
          status: TOKEN_STATUS.VALID
        };
        
        // Crear modelo de licencia
        const licenseModel = LicenseModel.fromJSON(tokenData);
        
        // Guardar el token redimido
        await this.saveValidatedToken(licenseModel.toJSON());
        
        return {
          valid: true,
          status: TOKEN_STATUS.VALID,
          expiresAt: licenseModel.expiresAt,
          message: 'Token redimido correctamente',
          redeemed: true
        };
      }
      
      // Si la respuesta no es exitosa
      return {
        valid: false,
        status: response.status === 403 ? TOKEN_STATUS.EXPIRED : TOKEN_STATUS.INVALID,
        message: response.message || ERROR_MESSAGES.INVALID_TOKEN
      };
      
    } catch (error) {
      logger.error('Error inesperado al redimir token:', error);
      
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: ERROR_MESSAGES.REDEMPTION_ERROR
      };
    }
  }

  /**
   * Verifica el estado del token con el servidor
   * @returns {Promise<Object>} - Resultado de la verificación
   */
  async validateWithServer() {
    try {
      const storedToken = this.getStoredToken();
      
      if (!storedToken || !storedToken.token) {
        logger.info('No hay token para validar con el servidor');
        return { valid: false, message: 'No hay token para validar' };
      }
    
      logger.info('Consultando si el token está activo en el servidor:', storedToken.token);
      
      // Usar el método apiRequest con reintentos
      const validityEndpoint = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHECK_VALIDITY}/${storedToken.token}`;
      const validityResponse = await apiService.get(validityEndpoint);
      
      logger.info('Respuesta de validez del servidor:', JSON.stringify(validityResponse));
      
      // Analizar la respuesta
      const isActive = validityResponse === true || validityResponse.success === true;
      
      if (isActive) {
        logger.info('El token está activo según el servidor');
        
        // Actualización del token para reflejar que está activo
        storedToken.lastServerValidation = new Date().toISOString();
        storedToken.verified = true;
        // Si el servidor proporciona una nueva fecha de expiración, la actualizamos
        if (validityResponse.expiresAt) {
          storedToken.expiresAt = validityResponse.expiresAt;
        }
        
        await this.saveValidatedToken(storedToken.toJSON());
        logger.info('Token actualizado con verificación del servidor');
        
        return {
          valid: true,
          message: 'Token activo en servidor',
          expiresAt: storedToken.expiresAt
        };
      } else {
        logger.info('El token no está activo según el servidor');
        
        // IMPORTANTE: No eliminamos el token, solo marcamos que no está activo
        return {
          valid: false,
          message: validityResponse.message || 'El token no está activo en el servidor',
          // Incluimos el token para referencia
          token: storedToken.token
        };
      }
    } catch (error) {
      logger.error('Error en validación con servidor:', error);
      
      if (error.response) {
        logger.error('Respuesta de error del servidor:', error.response.data);
        return { 
          valid: false, 
          message: `Error del servidor: ${error.response.status}` 
        };
      }
      
      // Si hay error de red/conexión
      if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        throw new Error('Error de conexión: No se pudo contactar con el servidor de licencias');
      }
      
      throw new Error(`Error de validación: ${error.message}`);
    }
  }

  /**
   * Verifica el estado actual del token almacenado
   * @returns {Promise<Object>} - Estado del token
   */
  async checkTokenStatus() {
    const storedToken = this.getStoredToken();

    if (!storedToken) {
      logger.info('No hay token almacenado');
      return {
        valid: false,
        status: TOKEN_STATUS.INVALID,
        message: 'No hay token almacenado',
        requiresToken: true
      };
    }

    // Verificar si el token ha expirado localmente
    const now = dayjs();
    const expirationDate = dayjs(storedToken.expiresAt);
    const daysUntilExpiration = expirationDate.diff(now, 'days');

    logger.info(`Días hasta expiración: ${daysUntilExpiration}`);

    if (now.isAfter(expirationDate)) {
      logger.info('Token expirado, se marca como renovable');
      return {
        valid: false,
        status: TOKEN_STATUS.RENEWABLE,
        message: ERROR_MESSAGES.RENEWABLE_TOKEN,
        token: storedToken.token,
        expiresAt: storedToken.expiresAt,
        expired: true,
        renewable: true
      };
    }

    // Si el token no ha expirado, verificar si está cerca de expirar
    if (daysUntilExpiration <= this.EXPIRATION_WARNING_DAYS) {
      logger.info('Token próximo a expirar');
      return {
        valid: true,
        status: TOKEN_STATUS.VALID,
        expiresAt: storedToken.expiresAt,
        message: `Token válido, expira en ${daysUntilExpiration} días`,
        warning: true,
        daysUntilExpiration
      };
    }

    // Token válido y no cerca de expirar
    return {
      valid: true,
      status: TOKEN_STATUS.VALID,
      expiresAt: storedToken.expiresAt,
      message: 'Token válido',
      daysUntilExpiration
    };
  }

  /**
   * Verificación inicial de licencia
   * @returns {Promise<Object>} - Resultado de la verificación
   */
  async checkInitialLicense() {
    try {
      const storedToken = this.getStoredToken();
      
      // Si no hay token almacenado, solicitar uno nuevo
      if (!storedToken || !storedToken.token) {
        return {
          valid: false,
          message: 'No hay token almacenado',
          requiresToken: true
        };
      }
    
      // Verificar con el servidor independientemente de la fecha local
      try {
        logger.info('Verificando token con el servidor independientemente de la fecha local...');
        const serverStatus = await this.validateWithServer();
        
        // Si el servidor indica que el token es válido
        if (serverStatus.valid) {
          logger.info('El servidor confirma que el token es válido');
          
          // Actualizar la fecha de expiración si viene en la respuesta
          if (serverStatus.expiresAt) {
            storedToken.expiresAt = serverStatus.expiresAt;
            storedToken.lastServerValidation = new Date().toISOString();
            
            await this.saveValidatedToken(storedToken.toJSON());
            logger.info('Token actualizado con nueva fecha de expiración');
          }
          
          return {
            valid: true,
            token: storedToken.token,
            expiresAt: serverStatus.expiresAt || storedToken.expiresAt
          };
        }
        
        // Si el servidor indica que el token ya no es válido
        logger.info('El servidor indica que el token no es válido');
        
        return {
          valid: false,
          message: 'La licencia no está activa. Por favor, renuévela en la aplicación IKE Licencias.',
          requiresToken: true,
          token: storedToken.token  // Mantenemos el token para referencia
        };
      } catch (serverError) {
        // Si no podemos conectar con el servidor
        logger.error('Error al verificar con servidor:', serverError.message);
        
        // En modo offline, verificamos la fecha local como respaldo
        const now = dayjs();
        const expirationDate = dayjs(storedToken.expiresAt);
        
        // Si el token ya está expirado localmente y no podemos verificar,
        // lo consideramos válido temporalmente para permitir el uso offline
        if (now.isAfter(expirationDate)) {
          logger.info('Token expirado localmente, pero permitiendo modo offline temporal');
          return {
            valid: true,  // Consideramos válido para modo offline
            token: storedToken.token,
            expiresAt: storedToken.expiresAt,
            offlineMode: true,
            message: 'Modo sin conexión: Usando licencia existente temporalmente. Se verificará cuando haya conexión a internet.'
          };
        }
        
        // Si no ha expirado localmente, lo consideramos válido en modo offline
        return {
          valid: true,
          token: storedToken.token,
          expiresAt: storedToken.expiresAt,
          offlineMode: true,
          message: 'Modo sin conexión: Usando token local temporalmente'
        };
      }
    } catch (error) {
      logger.error('Error en checkInitialLicense:', error);
      
      // Si ocurre algún error, intentamos usar el token local como último recurso
      const storedToken = this.getStoredToken();
      if (storedToken && storedToken.token) {
        logger.info('Usando token local como último recurso debido a error');
        return {
          valid: true,
          token: storedToken.token,
          expiresAt: storedToken.expiresAt,
          offlineMode: true,
          emergencyMode: true,
          message: 'Modo de emergencia: Usando token local'
        };
      }
      
      return {
        valid: false,
        message: error.message || 'Error al verificar la licencia',
        requiresToken: true
      };
    }
  }

  /**
   * Inicia un periodo de prueba
   * @returns {Promise<Object>} - Información del periodo de prueba
   */
  async startTrialPeriod() {
    const trialInfo = {
      type: 'trial',
      startDate: new Date().toISOString(),
      expiresAt: dayjs().add(this.TRIAL_PERIOD_DAYS, 'days').toISOString(),
      machineId: this.generateMachineId()
    };
    
    this.store.set('trial', trialInfo);
    return trialInfo;
  }

  /**
   * Verifica si el periodo de prueba es válido
   * @returns {Object} - Estado del periodo de prueba
   */
  isTrialValid() {
    try {
      const trial = this.store.get('trial');
      if (!trial) return { valid: false, message: 'No hay periodo de prueba' };

      const now = dayjs();
      const expirationDate = dayjs(trial.expiresAt);
      const daysRemaining = expirationDate.diff(now, 'days');

      return {
        valid: daysRemaining >= 0,
        daysRemaining,
        warning: daysRemaining <= this.EXPIRATION_WARNING_DAYS,
        expiresAt: trial.expiresAt,
        message: daysRemaining >= 0 
          ? `Periodo de prueba válido, expira en ${daysRemaining} días`
          : 'Periodo de prueba expirado'
      };
    } catch (error) {
      logger.error('Error al verificar periodo de prueba:', error);
      return { valid: false, message: 'Error al verificar periodo de prueba' };
    }
  }

  /**
   * Inicia verificación periódica de licencia
   * @param {number} interval - Intervalo en milisegundos
   */
  startPeriodicCheck(interval = 24 * 60 * 60 * 1000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkInitialLicense();
      } catch (error) {
        logger.error('Error en verificación periódica:', error);
      }
    }, interval);
    
    logger.info(`Verificación periódica iniciada, intervalo: ${interval}ms`);
  }

  /**
   * Detiene la verificación periódica
   */
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Verificación periódica detenida');
    }
  }

  /**
   * Muestra un diálogo de token inválido
   * @param {string} message - Mensaje de error
   * @returns {Object} - Resultado de la operación
   */
  handleInvalidToken(message) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Token Inválido',
      message: message,
      detail: 'Por favor, ingrese un nuevo token para continuar.',
      buttons: ['Ingresar Token', 'Salir'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        // Aquí se debe abrir la ventana de ingreso de token
        // TODO: Implementar apertura de ventana de token
      } else {
        app.quit();
      }
    });
    
    return { valid: false, message };
  }

  /**
   * Muestra un diálogo de licencia expirada
   * @param {string} message - Mensaje de error
   * @returns {Object} - Resultado de la operación
   */
  handleInvalidLicense(message) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Licencia Inválida',
      message: message,
      detail: 'La aplicación se cerrará.',
      buttons: ['OK']
    }).then(() => {
      app.quit();
    });
    
    return { valid: false, message };
  }

  /**
   * Muestra advertencia de expiración
   * @param {number} daysRemaining - Días restantes
   */
  showExpirationWarning(daysRemaining) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Licencia por Expirar',
      message: `Su licencia expirará en ${daysRemaining} días.`,
      detail: 'Por favor, renueve su licencia para continuar usando la aplicación.',
      buttons: ['OK']
    });
  }
}

// Exportar instancia única
module.exports = new LicenseService();