const BrowserService = require('../../../src/services/browser-service');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const configService = require('../../../src/services/config-service');
const logger = require('../../../src/utils/logger');

// Mock de puppeteer-core
jest.mock('puppeteer-core', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      goto: jest.fn().mockResolvedValue({}),
      waitForSelector: jest.fn().mockResolvedValue({}),
      waitForNavigation: jest.fn().mockResolvedValue({}),
      type: jest.fn().mockResolvedValue({}),
      click: jest.fn().mockResolvedValue({}),
      keyboard: {
        type: jest.fn().mockResolvedValue({}),
        press: jest.fn().mockResolvedValue({})
      },
      $: jest.fn().mockResolvedValue({
        click: jest.fn().mockResolvedValue({}),
        evaluate: jest.fn().mockResolvedValue({})
      }),
      evaluate: jest.fn().mockResolvedValue(true),
      url: jest.fn().mockReturnValue('https://portalproveedores.ikeasistencia.com')
    }),
    close: jest.fn().mockResolvedValue({})
  })
}));

// Mock de fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn()
}));

// Mock de os
jest.mock('os', () => ({
  platform: jest.fn().mockReturnValue('darwin'),
  homedir: jest.fn().mockReturnValue('/Users/testuser'),
  arch: jest.fn().mockReturnValue('x64'),
  cpus: jest.fn().mockReturnValue([{}, {}, {}, {}]),
  totalmem: jest.fn().mockReturnValue(16000000000),
  type: jest.fn().mockReturnValue('Darwin'),
  release: jest.fn().mockReturnValue('20.0.0')
}));

// Mock de configService
jest.mock('../../../src/services/config-service', () => ({
  getCredentials: jest.fn().mockReturnValue({
    username: 'testuser',
    password: 'testpassword'
  })
}));

// Mock de logger
jest.mock('../../../src/utils/logger', () => ({
  scope: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('BrowserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'setTimeout').mockImplementation(fn => fn());
  });
  
  describe('getBrowserPath', () => {
    test('debe devolver ruta para macOS cuando la plataforma es darwin', async () => {
      // Arrange
      fs.existsSync.mockReturnValue(true);
      os.platform.mockReturnValue('darwin');
      
      // Act
      const result = await BrowserService.getBrowserPath();
      
      // Assert
      expect(result).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
      expect(fs.existsSync).toHaveBeenCalled();
    });
    
    test('debe buscar rutas para Windows cuando la plataforma es win32', async () => {
      // Arrange
      os.platform.mockReturnValue('win32');
      fs.existsSync.mockImplementation(path => {
        return path.includes('Chrome.exe');
      });
      
      process.env.PROGRAMFILES = 'C:\\Program Files';
      process.env['PROGRAMFILES(X86)'] = 'C:\\Program Files (x86)';
      
      // Act
      const result = await BrowserService.getBrowserPath();
      
      // Assert
      expect(result).toContain('Chrome.exe');
      expect(fs.existsSync).toHaveBeenCalled();
    });
    
    test('debe lanzar error si no encuentra navegador compatible', async () => {
      // Arrange
      os.platform.mockReturnValue('darwin');
      fs.existsSync.mockReturnValue(false);
      
      // Act & Assert
      await expect(BrowserService.getBrowserPath()).rejects.toThrow('Chrome no encontrado');
    });
  });
  
  describe('initialize', () => {
    test('debe inicializar el navegador correctamente', async () => {
      // Arrange
      const browserPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      jest.spyOn(BrowserService, 'getBrowserPath').mockResolvedValue(browserPath);
      
      // Act
      const result = await BrowserService.initialize();
      
      // Assert
      expect(result).toBe(true);
      expect(puppeteer.launch).toHaveBeenCalledWith(expect.objectContaining({
        headless: false,
        executablePath: browserPath
      }));
    });
    
    test('debe manejar errores al inicializar', async () => {
      // Arrange
      jest.spyOn(BrowserService, 'getBrowserPath').mockRejectedValue(new Error('Test error'));
      
      // Act & Assert
      await expect(BrowserService.initialize()).rejects.toThrow();
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('login', () => {
    beforeEach(() => {
      // Configurar una página mock para el test
      BrowserService.page = {
        goto: jest.fn().mockResolvedValue({}),
        waitForSelector: jest.fn().mockResolvedValue({}),
        waitForNavigation: jest.fn().mockResolvedValue({}),
        type: jest.fn().mockResolvedValue({}),
        click: jest.fn().mockResolvedValue({}),
        evaluate: jest.fn().mockResolvedValue(true)
      };
    });
    
    test('debe realizar login correctamente', async () => {
      // Arrange
      configService.getCredentials.mockReturnValue({
        username: 'testuser',
        password: 'testpassword'
      });
      
      // Act
      const result = await BrowserService.login();
      
      // Assert
      expect(result).toBe(true);
      expect(BrowserService.page.goto).toHaveBeenCalledWith(
        'https://portalproveedores.ikeasistencia.com',
        expect.any(Object)
      );
      expect(BrowserService.page.type).toHaveBeenCalledTimes(2);
      expect(BrowserService.page.evaluate).toHaveBeenCalled();
    });
    
    test('debe lanzar error si no hay credenciales', async () => {
      // Arrange
      configService.getCredentials.mockReturnValue(null);
      
      // Act & Assert
      await expect(BrowserService.login()).rejects.toThrow('No se encontraron credenciales');
    });
    
    test('debe lanzar error si el login falla', async () => {
      // Arrange
      BrowserService.page.evaluate.mockResolvedValue(false);
      
      // Act & Assert
      await expect(BrowserService.login()).rejects.toThrow('Login fallido');
    });
  });
  
  describe('searchExpediente', () => {
    beforeEach(() => {
      // Configurar una página mock para el test
      BrowserService.page = {
        setDefaultTimeout: jest.fn(),
        setDefaultNavigationTimeout: jest.fn(),
        url: jest.fn().mockReturnValue('https://portalproveedores.ikeasistencia.com'),
        goto: jest.fn().mockResolvedValue({}),
        $: jest.fn().mockResolvedValue({
          click: jest.fn().mockResolvedValue({})
        }),
        waitForSelector: jest.fn().mockResolvedValue({}),
        keyboard: {
          type: jest.fn().mockResolvedValue({}),
          press: jest.fn().mockResolvedValue({})
        },
        evaluate: jest.fn().mockResolvedValue({
          hayDatos: true,
          costosCoinciden: true,
          costo: '$1,000.00',
          estatus: 'Activo',
          notas: 'Test',
          fechaRegistro: '01/01/2023',
          servicio: 'Servicio Test',
          subservicio: 'Subservicio Test',
          validacion: 'Aceptado'
        })
      };
      
      // Espiar el método delay para que no demore los tests
      jest.spyOn(BrowserService, 'delay').mockResolvedValue();
    });
    
    test('debe buscar expediente correctamente', async () => {
      // Act
      const result = await BrowserService.searchExpediente('123456', 1000);
      
      // Assert
      expect(result.validacion).toBe('Aceptado');
      expect(result.costo).toBe('$1,000.00');
      expect(BrowserService.stats.totalRevisados).toBe(1);
      expect(BrowserService.stats.totalConCosto).toBe(1);
      expect(BrowserService.stats.totalAceptados).toBe(1);
    });
    
    test('debe navegar a la página de búsqueda si no está en ella', async () => {
      // Arrange
      BrowserService.page.url.mockReturnValue('https://example.com');
      
      // Act
      await BrowserService.searchExpediente('123456', 1000);
      
      // Assert
      expect(BrowserService.page.goto).toHaveBeenCalledWith(
        'https://portalproveedores.ikeasistencia.com/admin/services/pendientes',
        expect.any(Object)
      );
    });
    
    test('debe manejar errores y devolver resultado vacío', async () => {
      // Arrange
      BrowserService.page.$.mockRejectedValue(new Error('Test error'));
      
      // Act
      const result = await BrowserService.searchExpediente('123456', 1000);
      
      // Assert
      expect(result.validacion).toBe('Error en consulta');
      expect(logger.scope().error).toHaveBeenCalled();
    });
    
    test('debe reintentar búsqueda en caso de error', async () => {
      // Arrange
      const searchSpy = jest.spyOn(BrowserService, 'searchExpediente');
      BrowserService.page.$.mockRejectedValueOnce(new Error('Test error'));
      
      // Act
      await BrowserService.searchExpediente('123456', 1000);
      
      // Assert
      expect(searchSpy).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('aceptarExpediente', () => {
    beforeEach(() => {
      // Configurar una página mock para el test
      BrowserService.page = {
        evaluate: jest.fn().mockImplementation(fn => {
          // Simular comportamiento del evaluate
          return fn ? true : true;
        })
      };
      
      // Espiar el método delay para que no demore los tests
      jest.spyOn(BrowserService, 'delay').mockResolvedValue();
    });
    
    test('debe aceptar expediente correctamente', async () => {
      // Arrange
      const expedienteData = {
        costosCoinciden: true,
        validacion: 'Aceptado'
      };
      
      // Act
      const result = await BrowserService.aceptarExpediente(expedienteData);
      
      // Assert
      expect(result).toBe(true);
      expect(BrowserService.page.evaluate).toHaveBeenCalledTimes(2);
    });
    
    test('debe manejar errores durante la aceptación', async () => {
      // Arrange
      const expedienteData = {
        costosCoinciden: true,
        validacion: 'Aceptado'
      };
      
      BrowserService.page.evaluate.mockRejectedValue(new Error('Test error'));
      
      // Act
      const result = await BrowserService.aceptarExpediente(expedienteData);
      
      // Assert
      expect(result).toBe(false);
      expect(expedienteData.validacion).toBe('Error en aceptación');
      expect(logger.scope().error).toHaveBeenCalled();
    });
  });
  
  describe('close', () => {
    test('debe cerrar el navegador correctamente', async () => {
      // Arrange
      BrowserService.browser = {
        close: jest.fn().mockResolvedValue({})
      };
      
      // Espiar el método delay para que no demore los tests
      jest.spyOn(BrowserService, 'delay').mockResolvedValue();
      
      // Act
      await BrowserService.close();
      
      // Assert
      expect(BrowserService.browser.close).toHaveBeenCalled();
      expect(BrowserService.browser).toBeNull();
      expect(BrowserService.page).toBeNull();
    });
    
    test('no debe hacer nada si el navegador ya está cerrado', async () => {
      // Arrange
      BrowserService.browser = null;
      
      // Act
      await BrowserService.close();
      
      // Assert - no debe lanzar error
      expect(logger.scope().error).not.toHaveBeenCalled();
    });
  });
  
  describe('resetStats', () => {
    test('debe restablecer estadísticas correctamente', () => {
      // Arrange
      BrowserService.stats = {
        totalRevisados: 10,
        totalConCosto: 5,
        totalAceptados: 3
      };
      
      // Act
      BrowserService.resetStats();
      
      // Assert
      expect(BrowserService.stats).toEqual({
        totalRevisados: 0,
        totalConCosto: 0,
        totalAceptados: 0
      });
    });
  });
});