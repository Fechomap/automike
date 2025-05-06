// src/utils/file-utils.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const logger = require('./logger').scope('FileUtils');

/**
 * Utilidades para manejo de archivos
 */
class FileUtils {
  /**
   * Verifica si un archivo existe
   * @param {string} filePath - Ruta del archivo
   * @returns {boolean} - true si existe, false si no
   */
  static fileExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      logger.error(`Error verificando existencia de archivo ${filePath}:`, error);
      return false;
    }
  }
  
  /**
   * Lee un archivo JSON
   * @param {string} filePath - Ruta del archivo JSON
   * @param {Object} defaultValue - Valor por defecto si no se puede leer
   * @returns {Object} - Contenido del archivo JSON parseado
   */
  static readJsonFile(filePath, defaultValue = {}) {
    try {
      if (!this.fileExists(filePath)) {
        return defaultValue;
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      logger.error(`Error al leer archivo JSON ${filePath}:`, error);
      
      // Crear copia de respaldo si el archivo existe pero está corrupto
      if (this.fileExists(filePath)) {
        try {
          const backupPath = `${filePath}.backup.${Date.now()}`;
          fs.copyFileSync(filePath, backupPath);
          logger.info(`Copia de seguridad creada en: ${backupPath}`);
        } catch (backupError) {
          logger.error(`Error al crear copia de seguridad de ${filePath}:`, backupError);
        }
      }
      
      return defaultValue;
    }
  }
  
  /**
   * Escribe un objeto en un archivo JSON
   * @param {string} filePath - Ruta donde escribir el archivo
   * @param {Object} data - Datos a escribir
   * @returns {boolean} - true si se escribió correctamente, false si no
   */
  static writeJsonFile(filePath, data) {
    try {
      const dirPath = path.dirname(filePath);
      if (!this.fileExists(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      logger.error(`Error al escribir archivo JSON ${filePath}:`, error);
      return false;
    }
  }
  
  /**
   * Obtiene la ruta completa a un archivo dentro del directorio de datos del usuario
   * @param {string} fileName - Nombre del archivo
   * @returns {string} - Ruta completa
   */
  static getUserDataPath(fileName) {
    return path.join(app.getPath('userData'), fileName);
  }
  
  /**
   * Crea un directorio si no existe
   * @param {string} dirPath - Ruta del directorio
   * @returns {boolean} - true si se creó o ya existía, false si falló
   */
  static ensureDirectoryExists(dirPath) {
    try {
      if (!this.fileExists(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      logger.error(`Error al crear directorio ${dirPath}:`, error);
      return false;
    }
  }
  
  /**
   * Elimina un archivo si existe
   * @param {string} filePath - Ruta del archivo a eliminar
   * @returns {boolean} - true si se eliminó correctamente o no existía, false si falló
   */
  static removeFile(filePath) {
    try {
      if (this.fileExists(filePath)) {
        fs.rmSync(filePath);
      }
      return true;
    } catch (error) {
      logger.error(`Error al eliminar archivo ${filePath}:`, error);
      return false;
    }
  }
}

module.exports = FileUtils;