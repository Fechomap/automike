const FileUtils = require('../../../src/utils/file-utils');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const logger = require('../../../src/utils/logger');

// Mock del logger
jest.mock('../../../src/utils/logger', () => ({
  scope: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn()
  })
}));

describe('FileUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('fileExists', () => {
    test('debe devolver true si el archivo existe', () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      
      // Act
      const result = FileUtils.fileExists('/fake/path/file.txt');
      
      // Assert
      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith('/fake/path/file.txt');
    });
    
    test('debe devolver false si el archivo no existe', () => {
      // Arrange
      fs.existsSync.mockReturnValue(false);
      
      // Act
      const result = FileUtils.fileExists('/fake/path/file.txt');
      
      // Assert
      expect(result).toBe(false);
    });
    
    test('debe manejar errores', () => {
      // Arrange
      fs.existsSync.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Act
      const result = FileUtils.fileExists('/fake/path/file.txt');
      
      // Assert
      expect(result).toBe(false);
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('readJsonFile', () => {
    test('debe leer y parsear correctamente un archivo JSON', () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{"name":"test","value":123}');
      
      // Act
      const result = FileUtils.readJsonFile('/fake/path/file.json');
      
      // Assert
      expect(result).toEqual({ name: 'test', value: 123 });
      expect(fs.readFileSync).toHaveBeenCalledWith('/fake/path/file.json', 'utf8');
    });
    
    test('debe devolver el valor por defecto si el archivo no existe', () => {
      // Arrange
      fs.existsSync.mockReturnValue(false);
      const defaultValue = { default: true };
      
      // Act
      const result = FileUtils.readJsonFile('/fake/path/file.json', defaultValue);
      
      // Assert
      expect(result).toEqual(defaultValue);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
    
    test('debe manejar errores de parsing y crear backup', () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');
      
      // Act
      const result = FileUtils.readJsonFile('/fake/path/file.json');
      
      // Assert
      expect(result).toEqual({});
      expect(fs.copyFileSync).toHaveBeenCalled();
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('writeJsonFile', () => {
    test('debe escribir correctamente un objeto como JSON', () => {
      // Arrange
      const testData = { name: 'test', value: 123 };
      fs.existsSync.mockReturnValue(true);
      
      // Act
      const result = FileUtils.writeJsonFile('/fake/path/file.json', testData);
      
      // Assert
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/fake/path/file.json',
        JSON.stringify(testData, null, 2),
        'utf8'
      );
    });
    
    test('debe crear el directorio si no existe', () => {
      // Arrange
      const dirPath = '/fake/path';
      fs.existsSync.mockImplementation((path) => {
        return path !== dirPath;
      });
      
      // Act
      const result = FileUtils.writeJsonFile('/fake/path/file.json', {});
      
      // Assert
      expect(result).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalledWith(dirPath, { recursive: true });
    });
    
    test('debe manejar errores', () => {
      // Arrange
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Act
      const result = FileUtils.writeJsonFile('/fake/path/file.json', {});
      
      // Assert
      expect(result).toBe(false);
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('getUserDataPath', () => {
    test('debe devolver la ruta correcta', () => {
      // Arrange
      app.getPath.mockReturnValue('/fake/user/data');
      
      // Act
      const result = FileUtils.getUserDataPath('config.json');
      
      // Assert
      expect(result).toBe('/fake/user/data/config.json');
      expect(app.getPath).toHaveBeenCalledWith('userData');
    });
  });
});