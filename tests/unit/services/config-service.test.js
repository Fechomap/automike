const ConfigService = require('../../../src/services/config-service');
const Store = require('electron-store');
const { BrowserWindow } = require('electron');
const fileUtils = require('../../../src/utils/file-utils');
const logger = require('../../../src/utils/logger');

// Mock de electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => {
    const store = {};
    return {
      get: jest.fn((key, defaultValue) => store[key] !== undefined ? store[key] : defaultValue),
      set: jest.fn((key, value) => { store[key] = value; }),
      delete: jest.fn(key => { delete store[key]; }),
      clear: jest.fn(() => { Object.keys(store).forEach(key => delete store[key]); }),
      store
    };
  });
});

// Mock de fileUtils
jest.mock('../../../src/utils/file-utils', () => ({
  getUserDataPath: jest.fn(file => `/mock/path/${file}`),
  writeJsonFile: jest.fn().mockReturnValue(true)
}));

// Mock de logger
jest.mock('../../../src/utils/logger', () => ({
  scope: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn()
  })
}));

describe('ConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Restaurar configuración de prueba en cada test
    Store.mockClear();
  });
  
  describe('constructor', () => {
    test('debe inicializar Store correctamente', () => {
      // Assert
      expect(Store).toHaveBeenCalledWith(expect.objectContaining({
        name: 'config',
        defaults: expect.objectContaining({
          isConfigured: false,
          credentials: null
        })
      }));
    });
    
    test('debe manejar errores de inicialización', () => {
      // Arrange
      Store.mockImplementationOnce(() => {
        throw new Error('Test error');
      }).mockImplementationOnce(() => {
        return {
          get: jest.fn(),
          set: jest.fn(),
          delete: jest.fn(),
          clear: jest.fn(),
          store: {}
        };
      });
      
      // Act - forzar reinstanciación
      const configService = new ConfigService();
      
      // Assert
      expect(Store).toHaveBeenCalledTimes(2);
      expect(Store).toHaveBeenLastCalledWith(expect.objectContaining({
        name: 'config-backup'
      }));
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('getCredentials', () => {
    test('debe devolver credenciales almacenadas', () => {
      // Arrange
      const testCredentials = { username: 'test', password: 'password' };
      const configService = new ConfigService();
      configService.store.get.mockReturnValue(testCredentials);
      
      // Act
      const result = configService.getCredentials();
      
      // Assert
      expect(result).toEqual(testCredentials);
      expect(configService.store.get).toHaveBeenCalledWith('credentials');
    });
    
    test('debe manejar errores y devolver null', () => {
      // Arrange
      const configService = new ConfigService();
      configService.store.get.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Act
      const result = configService.getCredentials();
      
      // Assert
      expect(result).toBeNull();
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('saveCredentials', () => {
    test('debe guardar credenciales correctamente', () => {
      // Arrange
      const configService = new ConfigService();
      const username = 'testuser';
      const password = 'testpass';
      
      // Act
      const result = configService.saveCredentials(username, password);
      
      // Assert
      expect(result).toBe(true);
      expect(configService.store.set).toHaveBeenCalledWith('credentials', { username, password });
      expect(configService.store.set).toHaveBeenCalledWith('isConfigured', true);
    });
    
    test('debe lanzar error si username o password están vacíos', () => {
      // Arrange
      const configService = new ConfigService();
      
      // Act & Assert
      expect(() => configService.saveCredentials('', 'test')).toThrow();
      expect(() => configService.saveCredentials('test', '')).toThrow();
      expect(() => configService.saveCredentials('', '')).toThrow();
    });
    
    test('debe crear respaldo si falla al guardar', () => {
      // Arrange
      const configService = new ConfigService();
      configService.store.set.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Act & Assert
      expect(() => configService.saveCredentials('test', 'password')).toThrow();
      expect(fileUtils.writeJsonFile).toHaveBeenCalled();
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('isConfigured', () => {
    test('debe devolver true si está configurado y tiene credenciales', () => {
      // Arrange
      const configService = new ConfigService();
      configService.store.get.mockImplementation(key => {
        if (key === 'isConfigured') return true;
        if (key === 'credentials') return { username: 'test', password: 'test' };
        return null;
      });
      
      // Act
      const result = configService.isConfigured();
      
      // Assert
      expect(result).toBe(true);
    });
    
    test('debe devolver false si no está configurado o no tiene credenciales', () => {
      // Arrange
      const configService = new ConfigService();
      configService.store.get.mockImplementation(key => {
        if (key === 'isConfigured') return true;
        if (key === 'credentials') return null;
        return null;
      });
      
      // Act
      const result = configService.isConfigured();
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  describe('get, set, delete', () => {
    test('get debe obtener valor correctamente', () => {
      // Arrange
      const configService = new ConfigService();
      configService.store.get.mockReturnValue('test-value');
      
      // Act
      const result = configService.get('test-key', 'default');
      
      // Assert
      expect(result).toBe('test-value');
      expect(configService.store.get).toHaveBeenCalledWith('test-key', 'default');
    });
    
    test('get debe devolver valor por defecto en caso de error', () => {
      // Arrange
      const configService = new ConfigService();
      configService.store.get.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Act
      const result = configService.get('test-key', 'default');
      
      // Assert
      expect(result).toBe('default');
      expect(logger.scope().error).toHaveBeenCalled();
    });
    
    test('set debe establecer valor correctamente', () => {
      // Arrange
      const configService = new ConfigService();
      
      // Act
      const result = configService.set('test-key', 'test-value');
      
      // Assert
      expect(result).toBe(true);
      expect(configService.store.set).toHaveBeenCalledWith('test-key', 'test-value');
    });
    
    test('delete debe eliminar valor correctamente', () => {
      // Arrange
      const configService = new ConfigService();
      
      // Act
      const result = configService.delete('test-key');
      
      // Assert
      expect(result).toBe(true);
      expect(configService.store.delete).toHaveBeenCalledWith('test-key');
    });
  });
  
  describe('reset', () => {
    test('debe restablecer configuración correctamente', () => {
      // Arrange
      const configService = new ConfigService();
      
      // Act
      const result = configService.reset();
      
      // Assert
      expect(result).toBe(true);
      expect(fileUtils.writeJsonFile).toHaveBeenCalled();
      expect(configService.store.clear).toHaveBeenCalled();
    });
    
    test('debe manejar errores al restablecer', () => {
      // Arrange
      const configService = new ConfigService();
      configService.store.clear.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Act
      const result = configService.reset();
      
      // Assert
      expect(result).toBe(false);
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('showConfigWindow', () => {
    test('debe mostrar ventana de configuración', async () => {
      // Arrange
      const configService = new ConfigService();
      
      // Act
      const promise = configService.showConfigWindow();
      
      // Simular cierre de ventana
      configService.configWindow.emit('closed');
      
      // Assert
      await expect(promise).resolves.toBeDefined();
      expect(BrowserWindow).toHaveBeenCalled();
    });
    
    test('debe enfocar ventana existente', async () => {
      // Arrange
      const configService = new ConfigService();
      configService.configWindow = {
        focus: jest.fn()
      };
      
      // Act
      await configService.showConfigWindow();
      
      // Assert
      expect(configService.configWindow.focus).toHaveBeenCalled();
      expect(BrowserWindow).not.toHaveBeenCalled();
    });
  });
});