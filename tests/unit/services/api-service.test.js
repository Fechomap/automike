const ApiService = require('../../../src/services/api-service');
const axios = require('axios');
const logger = require('../../../src/utils/logger');

// Mock del logger
jest.mock('../../../src/utils/logger', () => ({
  scope: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn()
  })
}));

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Modificar la propiedad retryDelay para hacerlo más rápido en tests
    ApiService.retryDelay = 10;
  });
  
  describe('request', () => {
    test('debe realizar solicitud exitosa', async () => {
      // Arrange
      const mockResponse = { data: { success: true, message: 'OK' } };
      axios.mockResolvedValue(mockResponse);
      
      // Act
      const result = await ApiService.request({
        method: 'get',
        url: 'https://example.com/api'
      });
      
      // Assert
      expect(result).toEqual(mockResponse.data);
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        method: 'get',
        url: 'https://example.com/api'
      }));
    });
    
    test('debe manejar error de respuesta del servidor', async () => {
      // Arrange
      const errorResponse = {
        response: {
          status: 404,
          data: { message: 'Not found' }
        }
      };
      axios.mockRejectedValue(errorResponse);
      
      // Act
      const result = await ApiService.request({
        method: 'get',
        url: 'https://example.com/api/notfound'
      });
      
      // Assert
      expect(result).toEqual({
        success: false,
        status: 404,
        message: 'Not found'
      });
      expect(logger.scope().error).toHaveBeenCalled();
    });
    
    test('debe reintentar en caso de error de red', async () => {
      // Arrange
      const networkError = new Error('Network error');
      networkError.code = 'ECONNRESET';
      
      // Configurar axios para fallar una vez y luego tener éxito
      axios
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ data: { success: true } });
      
      // Espiar el método request
      const requestSpy = jest.spyOn(ApiService, 'request');
      
      // Act - establecer un timeout corto
      const result = await ApiService.request({
        method: 'get',
        url: 'https://example.com/api'
      });
      
      // Assert
      expect(result).toEqual({ success: true });
      expect(requestSpy).toHaveBeenCalledTimes(2);
      
      // Restaurar
      requestSpy.mockRestore();
    }, 1000); // Aumentar timeout
  });
  
  describe('métodos HTTP', () => {
    test('get debe llamar request con método correcto', async () => {
      // Arrange
      const requestSpy = jest.spyOn(ApiService, 'request')
        .mockResolvedValue({ success: true });
      
      // Act
      await ApiService.get('https://example.com/api', { id: 1 });
      
      // Assert
      expect(requestSpy).toHaveBeenCalledWith({
        method: 'get',
        url: 'https://example.com/api',
        params: { id: 1 }
      });
      
      // Restaurar
      requestSpy.mockRestore();
    });
    
    test('post debe llamar request con método correcto', async () => {
      // Arrange
      const requestSpy = jest.spyOn(ApiService, 'request')
        .mockResolvedValue({ success: true });
      
      // Act
      await ApiService.post('https://example.com/api', { name: 'test' });
      
      // Assert
      expect(requestSpy).toHaveBeenCalledWith({
        method: 'post',
        url: 'https://example.com/api',
        data: { name: 'test' }
      });
      
      // Restaurar
      requestSpy.mockRestore();
    });
    
    test('put debe llamar request con método correcto', async () => {
      // Arrange
      const requestSpy = jest.spyOn(ApiService, 'request')
        .mockResolvedValue({ success: true });
      
      // Act
      await ApiService.put('https://example.com/api', { id: 1, name: 'updated' });
      
      // Assert
      expect(requestSpy).toHaveBeenCalledWith({
        method: 'put',
        url: 'https://example.com/api',
        data: { id: 1, name: 'updated' }
      });
      
      // Restaurar
      requestSpy.mockRestore();
    });
    
    test('delete debe llamar request con método correcto', async () => {
      // Arrange
      const requestSpy = jest.spyOn(ApiService, 'request')
        .mockResolvedValue({ success: true });
      
      // Act
      await ApiService.delete('https://example.com/api/1');
      
      // Assert
      expect(requestSpy).toHaveBeenCalledWith({
        method: 'delete',
        url: 'https://example.com/api/1'
      });
      
      // Restaurar
      requestSpy.mockRestore();
    });
  });
});