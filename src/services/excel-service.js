// src/services/excel-service.js
const ExcelJS = require('exceljs');
const logger = require('../utils/logger').scope('ExcelService');
const ErrorHandler = require('../utils/error-handler');
const FileUtils = require('../utils/file-utils');

/**
 * Servicio para operaciones con archivos Excel
 */
class ExcelService {
  /**
   * Lee un archivo Excel y extrae expedientes y filas
   * @param {string} filePath - Ruta del archivo Excel
   * @returns {Promise<Object>} - Objeto con workbook, worksheet y filas
   */
  async readExpedientesAndRows(filePath) {
    try {
      logger.info(`Iniciando lectura del archivo Excel: ${filePath}`);
      
      if (!FileUtils.fileExists(filePath)) {
        throw new Error(`El archivo no existe: ${filePath}`);
      }
      
      const workbook = new ExcelJS.Workbook();
      
      try {
        await workbook.xlsx.readFile(filePath);
        logger.info('Archivo Excel leído correctamente');
      } catch (error) {
        logger.error(`Error al leer el archivo Excel: ${error.message}`);
        throw new Error(`No se puede abrir el archivo. Verifique que no esté abierto en otro programa.`);
      }
      
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        logger.error('No se encontró la hoja de trabajo');
        throw new Error('El archivo debe contener al menos una hoja.');
      }
      
      const filas = [];
      let rowCount = 0;
      
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Saltar encabezado
        
        const cellA = row.getCell(1).value;
        if (!cellA) {
          logger.info(`Fila ${rowNumber} vacía en columna A. Saltando...`);
          return;
        }
        
        const expediente = String(cellA).trim();
        if (/^\d+$/.test(expediente)) {
          filas.push({ expediente, rowNumber });
          rowCount++;
        } else {
          logger.info(`Expediente inválido en fila ${rowNumber}: ${expediente}`);
        }
      });
      
      logger.info(`Filas válidas encontradas: ${rowCount}`);
      
      return {
        workbook,
        worksheet, 
        filas
      };
    } catch (error) {
      return ErrorHandler.handleError(error, 'ExcelService.readExpedientesAndRows');
    }
  }
  
  /**
   * Guarda los resultados en el archivo Excel
   * @param {Object} workbook - Workbook de ExcelJS
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<boolean>} - true si se guardó correctamente
   */
  async saveWorkbook(workbook, filePath) {
    try {
      logger.info(`Guardando archivo Excel: ${filePath}`);
      await workbook.xlsx.writeFile(filePath);
      logger.info('Archivo Excel guardado correctamente');
      return true;
    } catch (error) {
      logger.error(`Error al guardar archivo Excel: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Actualiza una celda en una fila específica
   * @param {Object} worksheet - Worksheet de ExcelJS
   * @param {number} rowNumber - Número de fila
   * @param {number} colNumber - Número de columna
   * @param {any} value - Valor a establecer
   * @returns {boolean} - true si se actualizó correctamente
   */
  updateCell(worksheet, rowNumber, colNumber, value) {
    try {
      const row = worksheet.getRow(rowNumber);
      row.getCell(colNumber).value = value;
      row.commit();
      return true;
    } catch (error) {
      logger.error(`Error al actualizar celda (${rowNumber}, ${colNumber}): ${error.message}`);
      return false;
    }
  }
  
  /**
   * Actualiza múltiples celdas en una fila
   * @param {Object} worksheet - Worksheet de ExcelJS
   * @param {number} rowNumber - Número de fila
   * @param {Object} cellValues - Objeto con columnas y valores {colNumber: valor}
   * @returns {boolean} - true si se actualizaron correctamente
   */
  updateRowCells(worksheet, rowNumber, cellValues) {
    try {
      const row = worksheet.getRow(rowNumber);
      
      for (const [colNumber, value] of Object.entries(cellValues)) {
        row.getCell(Number(colNumber)).value = value;
      }
      
      row.commit();
      return true;
    } catch (error) {
      logger.error(`Error al actualizar celdas en fila ${rowNumber}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Exporta resultados a un nuevo archivo CSV
   * @param {Array} resultados - Array de resultados
   * @param {string} outputPath - Ruta de salida
   * @returns {Promise<boolean>} - true si se exportó correctamente
   */
  async exportToCSV(resultados, outputPath) {
    try {
      logger.info(`Exportando ${resultados.length} resultados a CSV: ${outputPath}`);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Resultados');
      
      // Definir encabezados
      worksheet.columns = [
        { header: 'Expediente', key: 'expediente', width: 15 },
        { header: 'Costo Guardado', key: 'costoGuardado', width: 15 },
        { header: 'Costo Sistema', key: 'costoSistema', width: 15 },
        { header: 'Estatus', key: 'estatus', width: 15 },
        { header: 'Notas', key: 'notas', width: 25 },
        { header: 'Fecha Registro', key: 'fechaRegistro', width: 20 },
        { header: 'Servicio', key: 'servicio', width: 20 },
        { header: 'Subservicio', key: 'subservicio', width: 20 },
        { header: 'Validación', key: 'validacion', width: 15 },
        { header: 'Fecha Consulta', key: 'fechaConsulta', width: 20 }
      ];
      
      // Agregar datos
      resultados.forEach(result => {
        worksheet.addRow(result);
      });
      
      // Aplicar estilos
      worksheet.getRow(1).font = { bold: true };
      
      // Guardar como CSV
      await workbook.csv.writeFile(outputPath);
      
      logger.info('Archivo CSV exportado correctamente');
      return true;
    } catch (error) {
      logger.error(`Error al exportar a CSV: ${error.message}`);
      return false;
    }
  }
}

// Exportar instancia única para usar en toda la aplicación
module.exports = new ExcelService();