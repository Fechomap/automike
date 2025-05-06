// src/utils/error-handler.js
const { dialog } = require('electron');
const logger = require('./logger').scope('ErrorHandler');

/**
 * Manejador centralizado de errores de la aplicación
 */
class ErrorHandler {
  /**
   * Maneja un error genérico
   * @param {Error} error - Error a manejar
   * @param {string} context - Contexto donde ocurrió el error
   * @param {boolean} showDialog - Si se debe mostrar un diálogo al usuario
   * @returns {Object} - Objeto con detalles del error procesado
   */
  static handleError(error, context = 'general', showDialog = false) {
    // Registrar el error
    logger.error(`[${context}] Error:`, error.message);
    logger.error(`Stack trace:`, error.stack || 'No stack trace disponible');
    
    // Objeto de respuesta estándar
    const errorResponse = {
      success: false,
      message: this.getReadableErrorMessage(error),
      error: error.message,
      context
    };
    
    // Mostrar diálogo si es necesario
    if (showDialog) {
      this.showErrorDialog(errorResponse.message, context);
    }
    
    return errorResponse;
  }
  
  /**
   * Muestra un diálogo de error al usuario
   * @param {string} message - Mensaje a mostrar
   * @param {string} context - Contexto donde ocurrió el error
   */
  static showErrorDialog(message, context = 'general') {
    dialog.showMessageBox({
      type: 'error',
      title: 'Error',
      message: `Error en ${context}`,
      detail: message,
      buttons: ['OK']
    });
  }
  
  /**
   * Convierte un error técnico en un mensaje legible para el usuario
   * @param {Error} error - Error a procesar
   * @returns {string} - Mensaje legible
   */
  static getReadableErrorMessage(error) {
    if (!error) return 'Se produjo un error desconocido';
    
    // Mapeo de errores comunes a mensajes amigables
    const errorMap = {
      'ECONNREFUSED': 'No se pudo conectar al servidor. Verifique su conexión a internet.',
      'ETIMEDOUT': 'La conexión ha expirado. Verifique su conexión a internet.',
      'ENOTFOUND': 'No se pudo encontrar el servidor. Verifique su conexión a internet.',
      'ENOENT': 'No se pudo encontrar el archivo o directorio especificado.',
      'EACCES': 'Permiso denegado para acceder al recurso solicitado.',
      'EPERM': 'No tiene permisos suficientes para realizar esta acción.',
      'SyntaxError': 'Error en el formato de datos recibidos del servidor.'
    };
    
    // Verificar si es un error conocido
    const errorCode = error.code || error.name;
    if (errorCode && errorMap[errorCode]) {
      return errorMap[errorCode];
    }
    
    // Para errores de axios (API)
    if (error.isAxiosError) {
      if (error.response) {
        // Error con respuesta del servidor
        const status = error.response.status;
        switch (status) {
          case 400:
            return 'La solicitud enviada es incorrecta. Verifique los datos.';
          case 401:
            return 'No está autorizado para realizar esta acción. Verifique sus credenciales.';
          case 403:
            return 'No tiene permisos para acceder a este recurso.';
          case 404:
            return 'El recurso solicitado no fue encontrado.';
          case 500:
            return 'Error en el servidor. Intente nuevamente más tarde.';
          default:
            return `Error en la solicitud (${status}): ${error.response.data?.message || error.message}`;
        }
      } else if (error.request) {
        // Error sin respuesta del servidor
        return 'No se recibió respuesta del servidor. Verifique su conexión.';
      }
    }
    
    // Error genérico
    return error.message || 'Se produjo un error desconocido';
  }
  
  /**
   * Envuelve una función asíncrona con manejo de errores
   * @param {Function} fn - Función a envolver
   * @param {string} context - Contexto para el registro de errores
   * @param {boolean} showDialog - Si se debe mostrar un diálogo en caso de error
   * @returns {Function} - Función envuelta con manejo de errores
   */
  static async wrapAsync(fn, context = 'general', showDialog = false) {
    try {
      return await fn();
    } catch (error) {
      return this.handleError(error, context, showDialog);
    }
  }
}

module.exports = ErrorHandler;