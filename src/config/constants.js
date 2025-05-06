// src/config/constants.js
/**
 * Configuración de la API
 * Contiene la información de conexión al servidor de licencias
 */
const API_CONFIG = {
  BASE_URL: 'https://ike-license-manager-9b796c40a448.herokuapp.com',
  ENDPOINTS: {
    VALIDATE_TOKEN: '/api/validate',
    CHECK_VALIDITY: '/api/check-validity',
    REDEEM_TOKEN: '/api/redeem' // Endpoint para redimir tokens
  },
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

/**
 * Estados posibles para un token de licencia
 */
const TOKEN_STATUS = {
  VALID: 'valid',          // Token válido y activo
  EXPIRED: 'expired',      // Token expirado
  INVALID: 'invalid',      // Token inválido o desconocido
  PENDING: 'pending',      // Token en proceso de validación
  RENEWABLE: 'renewable'   // Token expirado pero renovable
};

/**
 * Mensajes de error para diferentes situaciones
 */
const ERROR_MESSAGES = {
  INVALID_TOKEN: 'Token inválido. Por favor, ingresa un token válido.',
  EXPIRED_TOKEN: 'Su licencia ha expirado. Por favor, renuévela en la aplicación IKE Licencias.',
  RENEWABLE_TOKEN: 'Su licencia ha expirado pero puede renovarla en la aplicación IKE Licencias.',
  NETWORK_ERROR: 'Error de conexión. Por favor, verifica tu conexión a internet.',
  SERVER_ERROR: 'Error en el servidor. Por favor, intenta más tarde.',
  VALIDATION_ERROR: 'Error durante la validación del token. Inténtelo nuevamente.',
  TOKEN_IN_USE: 'Este token ya está en uso en otro dispositivo.',
  EMPTY_TOKEN: 'El token no puede estar vacío.',
  CONNECTION_TIMEOUT: 'Tiempo de espera agotado. Verifique su conexión e intente nuevamente.',
  REDEMPTION_ERROR: 'Error al redimir el token. Por favor, inténtelo nuevamente.',
  ALREADY_REDEEMED: 'Este token ya ha sido redimido. Por favor, utilice un token nuevo.'
};

/**
 * Configuración para actualizaciones automáticas
 */
const UPDATE_CONFIG = {
  CHECK_INTERVAL: 4 * 60 * 60 * 1000, // Cada 4 horas
  AUTO_DOWNLOAD: true,
  AUTO_INSTALL_ON_QUIT: true,
  PROVIDER: 'github',
  OWNER: 'Fechomap',
  REPO: 'expedientes-ike',
  RELEASE_TYPE: 'draft'
};

/**
 * Exportar constantes
 */
module.exports = {
  API_CONFIG,
  TOKEN_STATUS,
  ERROR_MESSAGES,
  UPDATE_CONFIG
};