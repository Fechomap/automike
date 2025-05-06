const logger = require('../../../src/utils/logger');
const electronLog = require('electron-log');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Asegúrate de que electronLog esté correctamente mockeado
jest.mock('electron-log', () => ({
  transports: {
    file: {
      resolvePath: jest.fn(),
      level: 'info',
      maxSize: 0,
      archiveLog: jest.fn()
    },
    console: {
      level: 'info'
    }
  },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Hacer que fs.existsSync devuelva false para el directorio de logs
    fs.existsSync.mockImplementation(filePath => {
      if (filePath.includes('logs')) {
        return false;
      }
      return true;
    });
  });
  
  test('debe registrar mensajes correctamente', () => {
    // Act
    logger.info('Test info message');
    logger.warn('Test warning message');
    logger.error('Test error message');
    
    // Assert
    expect(electronLog.info).toHaveBeenCalledWith('Test info message');
    expect(electronLog.warn).toHaveBeenCalledWith('Test warning message');
    expect(electronLog.error).toHaveBeenCalledWith('Test error message');
  });
  
  test('debe crear un logger con scope', () => {
    // Arrange
    const testScope = 'TestScope';
    
    // Act
    const scopedLogger = logger.scope(testScope);
    scopedLogger.info('Scoped message');
    
    // Assert
    expect(electronLog.info).toHaveBeenCalledWith(`[${testScope}]`, 'Scoped message');
  });
  
  test('debe registrar errores con stack trace', () => {
    // Arrange
    const testError = new Error('Test error');
    const testContext = 'TestContext';
    
    // Act
    logger.logError(testError, testContext);
    
    // Assert
    expect(electronLog.error).toHaveBeenCalledWith(
      `[${testContext}] Error: ${testError.message}`,
      '\nStack:',
      expect.any(String)
    );
  });
});