const ExcelService = require('../../../src/services/excel-service');
const ExcelJS = require('exceljs');
const logger = require('../../../src/utils/logger');
const FileUtils = require('../../../src/utils/file-utils');
const ErrorHandler = require('../../../src/utils/error-handler');

// Mock del logger
jest.mock('../../../src/utils/logger', () => ({
  scope: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn()
  })
}));

// Mock de FileUtils
jest.mock('../../../src/utils/file-utils', () => ({
  fileExists: jest.fn().mockReturnValue(true)
}));

// Mock de ErrorHandler
jest.mock('../../../src/utils/error-handler', () => ({
  handleError: jest.fn().mockImplementation((error, context) => {
    return {
      success: false,
      message: error.message,
      error: error.message,
      context
    };
  })
}));

describe('ExcelService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar mock común para ExcelJS
    const mockRow = {
      getCell: jest.fn().mockImplementation(col => {
        if (col === 1) {
          return { value: '123456' };
        }
        return { value: 'test' };
      }),
      commit: jest.fn()
    };
    
    const mockWorksheet = {
      eachRow: jest.fn((options, callback) => {
        // Simular filas
        callback(mockRow, 1); // Encabezado
        callback(mockRow, 2); // Fila con expediente válido
      }),
      getRow: jest.fn().mockReturnValue(mockRow),
      columns: [],
      addRow: jest.fn(),
      getCell: jest.fn()
    };
    
    const mockWorkbook = {
      xlsx: {
        readFile: jest.fn().mockResolvedValue({}),
        writeFile: jest.fn().mockResolvedValue({})
      },
      csv: {
        writeFile: jest.fn().mockResolvedValue({})
      },
      getWorksheet: jest.fn().mockReturnValue(mockWorksheet),
      addWorksheet: jest.fn().mockReturnValue(mockWorksheet)
    };
    
    ExcelJS.Workbook.mockImplementation(() => mockWorkbook);
  });
  
  describe('readExpedientesAndRows', () => {
    test('debe leer y procesar el archivo Excel correctamente', async () => {
      // Act
      const result = await ExcelService.readExpedientesAndRows('/fake/path/file.xlsx');
      
      // Assert
      expect(result).toHaveProperty('workbook');
      expect(result).toHaveProperty('worksheet');
      expect(result).toHaveProperty('filas');
      expect(result.filas).toHaveLength(1); // Solo filas válidas
      expect(result.filas[0]).toEqual(expect.objectContaining({
        expediente: '123456'
      }));
      expect(ExcelJS.Workbook).toHaveBeenCalled();
    });
    
    test('debe manejar archivo inexistente', async () => {
      // Arrange
      FileUtils.fileExists.mockReturnValue(false);
      
      // Act
      const result = await ExcelService.readExpedientesAndRows('/fake/path/file.xlsx');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('no existe');
      expect(ErrorHandler.handleError).toHaveBeenCalled();
    });
    
    test('debe manejar error al leer archivo', async () => {
      // Arrange
      const mockWorkbook = new ExcelJS.Workbook();
      mockWorkbook.xlsx.readFile.mockRejectedValue(new Error('Test error'));
      
      // Act
      const result = await ExcelService.readExpedientesAndRows('/fake/path/file.xlsx');
      
      // Assert
      expect(result.success).toBe(false);
      expect(ErrorHandler.handleError).toHaveBeenCalled();
    });
    
    test('debe manejar falta de hoja de trabajo', async () => {
      // Arrange
      const mockWorkbook = new ExcelJS.Workbook();
      mockWorkbook.getWorksheet.mockReturnValue(null);
      
      // Act
      const result = await ExcelService.readExpedientesAndRows('/fake/path/file.xlsx');
      
      // Assert
      expect(result.success).toBe(false);
      expect(ErrorHandler.handleError).toHaveBeenCalled();
    });
  });
  
  describe('saveWorkbook', () => {
    test('debe guardar correctamente el archivo', async () => {
      // Arrange
      const mockWorkbook = new ExcelJS.Workbook();
      
      // Act
      const result = await ExcelService.saveWorkbook(mockWorkbook, '/fake/path/file.xlsx');
      
      // Assert
      expect(result).toBe(true);
      expect(mockWorkbook.xlsx.writeFile).toHaveBeenCalledWith('/fake/path/file.xlsx');
    });
    
    test('debe manejar errores al guardar', async () => {
      // Arrange
      const mockWorkbook = new ExcelJS.Workbook();
      mockWorkbook.xlsx.writeFile.mockRejectedValue(new Error('Test error'));
      
      // Act
      const result = await ExcelService.saveWorkbook(mockWorkbook, '/fake/path/file.xlsx');
      
      // Assert
      expect(result).toBe(false);
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('updateCell y updateRowCells', () => {
    test('updateCell debe actualizar una celda correctamente', () => {
      // Arrange
      const mockWorksheet = new ExcelJS.Workbook().getWorksheet(1);
      
      // Act
      const result = ExcelService.updateCell(mockWorksheet, 2, 3, 'New Value');
      
      // Assert
      expect(result).toBe(true);
      expect(mockWorksheet.getRow).toHaveBeenCalledWith(2);
      expect(mockWorksheet.getRow().getCell).toHaveBeenCalledWith(3);
      expect(mockWorksheet.getRow().commit).toHaveBeenCalled();
    });
    
    test('updateRowCells debe actualizar múltiples celdas', () => {
      // Arrange
      const mockWorksheet = new ExcelJS.Workbook().getWorksheet(1);
      const cellValues = {
        2: 'Value 2',
        3: 'Value 3',
        4: 'Value 4'
      };
      
      // Act
      const result = ExcelService.updateRowCells(mockWorksheet, 2, cellValues);
      
      // Assert
      expect(result).toBe(true);
      expect(mockWorksheet.getRow).toHaveBeenCalledWith(2);
      expect(mockWorksheet.getRow().commit).toHaveBeenCalled();
    });
  });
  
  describe('exportToCSV', () => {
    test('debe exportar resultados a CSV correctamente', async () => {
      // Arrange
      const resultados = [
        { expediente: '123456', costoGuardado: '$1000' },
        { expediente: '789012', costoGuardado: '$2000' }
      ];
      
      // Act
      const result = await ExcelService.exportToCSV(resultados, '/fake/path/output.csv');
      
      // Assert
      expect(result).toBe(true);
      expect(ExcelJS.Workbook).toHaveBeenCalled();
      expect(logger.scope().info).toHaveBeenCalled();
    });
    
    test('debe manejar errores de exportación', async () => {
      // Arrange
      const mockWorkbook = new ExcelJS.Workbook();
      mockWorkbook.csv.writeFile.mockRejectedValue(new Error('Test error'));
      
      // Act
      const result = await ExcelService.exportToCSV([], '/fake/path/output.csv');
      
      // Assert
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
});