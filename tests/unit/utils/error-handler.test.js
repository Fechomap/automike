// tests/unit/utils/error-handler.test.js
const ErrorHandler = require('../../../src/utils/error-handler');
const { dialog } = require('electron');
const logger = require('../../../src/utils/logger');

// Mock del logger
jest.mock('../../../src/utils/logger', () => ({
  scope: jest.fn().mockReturnValue({
    error: jest.fn()
  })
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('handleError', () => {
    test('debe registrar el error y devolver la respuesta correcta', () => {
      // Arrange
      const testError = new Error('Test error');
      const loggerScopeMock = logger.scope('ErrorHandler');
      
      // Act
      const result = ErrorHandler.handleError(testError, 'TestContext');
      
      // Assert
      expect(loggerScopeMock.error).toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        message: 'Test error',
        error: 'Test error',
        context: 'TestContext'
      });
    });
    
    test('debe mostrar diálogo si showDialog es true', () => {
      // Arrange
      const testError = new Error('Test error');
      
      // Act
      ErrorHandler.handleError(testError, 'TestContext', true);
      
      // Assert
      expect(dialog.showMessageBox).toHaveBeenCalled();
    });
  });
  
  describe('getReadableErrorMessage', () => {
    test('debe devolver mensaje para error de conexión', () => {
      // Arrange
      const testError = new Error('Connection error');
      testError.code = 'ECONNREFUSED';
      
      // Act
      const result = ErrorHandler.getReadableErrorMessage(testError);
      
      // Assert
      expect(result).toContain('No se pudo conectar');
    });
    
    test('debe devolver mensaje para error de axios', () => {
      // Arrange
      const testError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Resource not found' }
        },
        message: 'Request failed with status code 404'
      };
      
      // Act
      const result = ErrorHandler.getReadableErrorMessage(testError);
      
      // Assert
      expect(result).toContain('no fue encontrado');
    });
    
    test('debe devolver mensaje para error sin respuesta', () => {
      // Arrange
      const testError = {
        isAxiosError: true,
        request: {},
        message: 'No response'
      };
      
      // Act
      const result = ErrorHandler.getReadableErrorMessage(testError);
      
      // Assert
      expect(result).toContain('No se recibió respuesta');
    });
    
    test('debe manejar error undefined', () => {
      // Act
      const result = ErrorHandler.getReadableErrorMessage(undefined);
      
      // Assert
      expect(result).toContain('error desconocido');
    });
  });
  
  describe('wrapAsync', () => {
    test('debe devolver el resultado si la función tiene éxito', async () => {
      // Arrange
      const successFn = jest.fn().mockResolvedValue({ data: 'test' });
      
      // Act
      const result = await ErrorHandler.wrapAsync(successFn);
      
      // Assert
      expect(result).toEqual({ data: 'test' });
    });
    
    test('debe manejar errores si la función falla', async () => {
      // Arrange
      const errorFn = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // Act
      const result = await ErrorHandler.wrapAsync(errorFn, 'TestContext');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Test error');
      expect(result.context).toBe('TestContext');
    });
  });
});