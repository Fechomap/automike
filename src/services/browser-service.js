const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const logger = require('../utils/logger').scope('BrowserService');
const configService = require('./config-service');

/**
 * Servicio para automatización de navegador
 */
class BrowserService {
  constructor() {
    // Inicializar propiedades
    this.browser = null;
    this.page = null;
    
    // Estadísticas de procesamiento
    this.stats = {
      totalRevisados: 0,
      totalConCosto: 0,
      totalAceptados: 0
    };
    
    // Configuración de timeouts
    this.navigationTimeout = 60000;
    this.defaultTimeout = 30000;
    
    // Configuración de retries
    this.maxRetries = 3;
    this.retryDelay = 2000;
    
    logger.info('BrowserService inicializado');
  }

  /**
   * Obtiene la ruta del navegador en el sistema
   * @returns {Promise<string>} - Ruta al ejecutable del navegador
   */
  async getBrowserPath() {
    logger.info('Detectando navegador instalado...');
    
    if (os.platform() !== 'win32') {
      // Lógica para Mac (mantener tu versión anterior)
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ];
      
      for (const p of macPaths) {
        if (fs.existsSync(p)) {
          logger.info(`Navegador encontrado en: ${p}`);
          return p;
        }
      }
      
      throw new Error('Chrome no encontrado en macOS');
    }

    // ========== Lógica mejorada para Windows ==========
    // 1. Primera prioridad: Chrome
    const chromePaths = [
      process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
    ];

    for (const p of chromePaths) {
      if (fs.existsSync(p)) {
        logger.info(`Chrome encontrado en: ${p}`);
        return p;
      }
    }

    // 2. Segunda prioridad: Navegador predeterminado del sistema
    try {
      const defaultBrowser = await this.getDefaultBrowserWindows();
      if (defaultBrowser) {
        logger.info(`Navegador predeterminado encontrado: ${defaultBrowser}`);
        return defaultBrowser;
      }
    } catch (e) {
      logger.error('Error detectando navegador predeterminado:', e);
    }

    // 3. Último recurso: Buscar otros navegadores comunes
    const commonBrowsers = [
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(os.homedir(), 'AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe'),
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
    ];

    for (const p of commonBrowsers) {
      if (fs.existsSync(p)) {
        logger.info(`Navegador alternativo encontrado: ${p}`);
        return p;
      }
    }

    throw new Error('No se encontró ningún navegador compatible instalado');
  }

  /**
   * Detecta el navegador predeterminado en Windows
   * @returns {Promise<string|null>} - Ruta al navegador predeterminado
   */
  async getDefaultBrowserWindows() {
    const { execSync } = require('child_process');
    try {
      // Obtener navegador predeterminado desde el registro
      const regQuery = execSync(
        'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId'
      ).toString();
      
      const browserId = regQuery.split('REG_SZ')[1].trim();
      const association = execSync(
        `reg query "HKEY_CLASSES_ROOT\\${browserId}\\shell\\open\\command" /ve`
      ).toString();
      
      const fullPath = association.split('REG_SZ')[1].trim().replace(/"/g, '');
      return path.normalize(fullPath.split(' ')[0]); // Extraer solo la ruta
    } catch (e) {
      logger.error('No se pudo detectar el navegador predeterminado:', e.message);
      return null;
    }
  }

  /**
   * Inicializa el navegador y la página
   * @returns {Promise<boolean>} - true si se inicializó correctamente
   */
  async initialize() {
    try {
      logger.info('Inicializando navegador...');
      const browserPath = await this.getBrowserPath();
      
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
        executablePath: browserPath,
        timeout: this.navigationTimeout
      });

      this.page = await this.browser.newPage();
      await this.page.setDefaultNavigationTimeout(this.navigationTimeout);
      await this.page.setDefaultTimeout(this.defaultTimeout);
      
      logger.info('Navegador inicializado correctamente');
      
      // Iniciar sesión automáticamente
      const loginResult = await this.login();
      return loginResult;
    } catch (error) {
      logger.error('Error inicializando navegador:', error.message);
      throw new Error(`No se pudo iniciar ningún navegador. Instala Chrome o Edge para continuar.`);
    }
  }

  /**
   * Realiza el login en el portal
   * @returns {Promise<boolean>} - true si el login fue exitoso
   */
  async login() {
    try {
      const credentials = configService.getCredentials();
      if (!credentials) {
        throw new Error('No se encontraron credenciales configuradas');
      }

      logger.info('Iniciando proceso de login...');
      await this.page.goto('https://portalproveedores.ikeasistencia.com', {
        waitUntil: 'networkidle2',
        timeout: this.navigationTimeout
      });

      await this.page.waitForSelector('input[formcontrolname="username"]', { timeout: this.defaultTimeout });
      await this.page.waitForSelector('input[formcontrolname="password"]', { timeout: this.defaultTimeout });

      await this.page.type('input[formcontrolname="username"]', credentials.username, { delay: 30 });
      await this.page.type('input[formcontrolname="password"]', credentials.password, { delay: 30 });

      await this.page.click('button[type="submit"]');

      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: this.navigationTimeout
      });

      const isLoggedIn = await this.page.evaluate(() => {
        return !document.querySelector('input[formcontrolname="password"]');
      });

      if (!isLoggedIn) {
        throw new Error('Login fallido. Verifique sus credenciales.');
      }

      logger.info('Login exitoso');
      await this.delay(2000);
      return true;
    } catch (error) {
      logger.error('Error durante el login:', error);
      throw error;
    }
  }

  /**
   * Busca un expediente en el portal
   * @param {string} expediente - Número de expediente
   * @param {number} costoGuardado - Costo guardado
   * @param {number} retryCount - Contador de reintentos (uso interno)
   * @returns {Promise<Object>} - Resultado de la búsqueda
   */
  async searchExpediente(expediente, costoGuardado, retryCount = 0) {
    try {
      this.stats.totalRevisados++;
      logger.info(`Buscando expediente: "${expediente}" (Costo guardado: $${costoGuardado})`);

      // Establecer timeout para la búsqueda
      this.page.setDefaultTimeout(this.defaultTimeout);

      // Verificar si estamos en la página correcta
      if (!this.page.url().includes('portalproveedores.ikeasistencia.com')) {
        logger.info('Navegando a la página de búsqueda...');
        await this.page.goto(
          'https://portalproveedores.ikeasistencia.com/admin/services/pendientes',
          { waitUntil: 'networkidle2', timeout: this.navigationTimeout }
        );
        await this.delay(1500);
      }

      // Buscar campo de entrada usando diferentes selectores
      const inputSelectors = [
        'input[placeholder="No. Expediente:*"]',
        'input[formcontrolname="expediente"]',
        'input.mat-mdc-input-element',
        'input[type="text"]'
      ];

      let inputElement = null;
      for (const sel of inputSelectors) {
        try {
          const candidate = await this.page.$(sel);
          if (candidate) {
            inputElement = candidate;
            logger.info(`Campo de búsqueda encontrado con selector: ${sel}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!inputElement) {
        throw new Error('No se pudo encontrar el campo de búsqueda');
      }

      // Limpiar campo y escribir número de expediente
      await inputElement.click({ clickCount: 3 });
      await this.delay(300);
      await this.page.evaluate((el) => { el.value = ''; }, inputElement);

      for (const char of expediente.toString()) {
        await this.page.keyboard.type(char, { delay: 50 });
      }
      await this.delay(300);

      // Buscar botón "Buscar" o usar Enter
      try {
        const searchButton = await this.page.$('button:has-text("Buscar")');
        if (searchButton) {
          logger.info('Botón "Buscar" encontrado, haciendo clic...');
          await searchButton.click();
        } else {
          logger.info('No se encontró botón "Buscar"; usando Enter...');
          await this.page.keyboard.press('Enter');
        }
      } catch (error) {
        logger.warn('Error al buscar botón, usando Enter:', error.message);
        await this.page.keyboard.press('Enter');
      }
      
      // Esperar resultados
      try {
        await this.page.waitForSelector('table tbody tr, .no-results', { timeout: 5000 });
      } catch (err) {
        logger.info('No se encontró la tabla o no hay resultados');
      }

      await this.delay(1500);

      // Evaluar resultado de la búsqueda
      const searchResult = await this.page.evaluate((guardado) => {
        const row = document.querySelector('table tbody tr');
        if (!row) {
          return {
            hayDatos: false,
            costosCoinciden: false
          };
        }

        const cells = row.querySelectorAll('td');
        const tieneContenido = cells[2] && 
                             cells[2].textContent && 
                             cells[2].textContent.trim() !== '' && 
                             cells[2].textContent.trim() !== '$0.00' &&
                             cells[2].textContent.trim() !== '$0';
        
        if (!tieneContenido) {
          return {
            hayDatos: false,
            costosCoinciden: false
          };
        }

        // Quita '$' y ',' para poder comparar como número
        const costoSistema = cells[2] ? cells[2].textContent.trim().replace('$', '').replace(',', '') : '0';
        const costosCoinciden = parseFloat(costoSistema) === parseFloat(guardado);

        return {
          costo: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
            .format(parseFloat(costoSistema)),
          estatus: cells[3]?.textContent?.trim() || '',
          notas: cells[4]?.textContent?.trim() || '',
          fechaRegistro: cells[5]?.textContent?.trim() || '',
          servicio: cells[6]?.textContent?.trim() || '',
          subservicio: cells[7]?.textContent?.trim() || '',
          validacion: costosCoinciden ? 'Aceptado' : 'No aceptado',
          hayDatos: true,
          costosCoinciden
        };
      }, costoGuardado);

      // Actualización de estadísticas
      if (searchResult.hayDatos) {
        this.stats.totalConCosto++;

        // Si coinciden, incrementa aceptados Y haz la liberación (clic en botón)
        if (searchResult.costosCoinciden) {
          this.stats.totalAceptados++;

          // Aceptar el expediente
          await this.aceptarExpediente(searchResult);
        }
      }

      delete searchResult.hayDatos;

      logger.info(`Resultado para ${expediente}:`, {
        ...searchResult,
        stats: this.stats
      });

      return {
        ...searchResult,
        stats: this.stats
      };

    } catch (error) {
      logger.error(`Error buscando expediente ${expediente}:`, error);
      
      // Reintentar si no se excede el límite
      if (retryCount < this.maxRetries) {
        logger.info(`Reintentando búsqueda (${retryCount + 1}/${this.maxRetries})...`);
        await this.delay(this.retryDelay);
        return this.searchExpediente(expediente, costoGuardado, retryCount + 1);
      }
      
      return {
        costo: '',
        estatus: '',
        notas: '',
        fechaRegistro: '',
        servicio: '',
        subservicio: '',
        validacion: 'Error en consulta',
        stats: this.stats
      };
    }
  }

  /**
   * Acepta un expediente
   * @param {Object} expedienteData - Datos del expediente
   * @returns {Promise<boolean>} - true si se aceptó correctamente
   */
  async aceptarExpediente(expedienteData) {
    try {
      logger.info('Iniciando proceso de aceptación...');
      
      // === INICIO de la lógica para presionar el botón de aceptación ===
      console.log('Costos coinciden, iniciando proceso de aceptación...');
      try {
        const buttonClicked = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const acceptButton = buttons.find(button =>
            button.querySelector('.mat-mdc-button-touch-target') &&
            button.closest('td') &&
            button.closest('td').cellIndex === 0
          );
          if (acceptButton) {
            acceptButton.click();
            return true;
          }
          return false;
        });

        if (!buttonClicked) {
          throw new Error('No se encontró el botón de aceptar');
        }

        await this.delay(2000);

        const confirmed = await this.page.evaluate(() => {
          const modalButtons = Array.from(document.querySelectorAll('.cdk-overlay-container button'));
          const confirmButton = modalButtons.find(button =>
            button.textContent.trim().toLowerCase().includes('aceptar')
          );
          if (confirmButton) {
            confirmButton.click();
            return true;
          }
          return false;
        });

        if (confirmed) {
          logger.info('Confirmación de aceptación realizada');
          await this.delay(3000);
          return true;
        } else {
          throw new Error('No se pudo confirmar la aceptación');
        }
      } catch (acceptError) {
        logger.error('Error durante el proceso de aceptación:', acceptError);
        expedienteData.validacion = 'Error en aceptación';
        return false;
      }
    } catch (error) {
      logger.error('Error en aceptarExpediente:', error);
      return false;
    }
  }

  /**
   * Método de utilidad para esperar un tiempo específico
   * @param {number} ms - Milisegundos a esperar
   * @returns {Promise<void>}
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cierra el navegador
   * @returns {Promise<void>}
   */
  async close() {
    if (this.browser) {
      logger.info('Esperando antes de cerrar...');
      await this.delay(2000);
      logger.info('Cerrando navegador...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Restablece las estadísticas
   */
  resetStats() {
    this.stats = {
      totalRevisados: 0,
      totalConCosto: 0,
      totalAceptados: 0
    };
    logger.info('Estadísticas restablecidas');
  }
}

// Exportar instancia única para usar en toda la aplicación
module.exports = new BrowserService();