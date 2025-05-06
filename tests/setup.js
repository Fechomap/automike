// Mock de electron para pruebas
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(path => {
      if (path === 'userData') return '/mock/user/data';
      return '/mock/path';
    }),
    getVersion: jest.fn().mockReturnValue('1.0.0'),
    getName: jest.fn().mockReturnValue('test-app'), // Necesario para electron-log
    quit: jest.fn()
  },
  dialog: {
    showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
    showErrorBox: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn().mockResolvedValue({}),
    show: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn()
    },
    isDestroyed: jest.fn().mockReturnValue(false)
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  }
}));

// Mock de fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  rmSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([])
}));

// Mock de electron-log
jest.mock('electron-log', () => {
  const mockedLog = {
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
    debug: jest.fn(),
    verbose: jest.fn()
  };
  return mockedLog;
});

// Mock de ExcelJS
jest.mock('exceljs', () => {
  const mockWorksheet = {
    eachRow: jest.fn(),
    getRow: jest.fn().mockReturnValue({
      getCell: jest.fn().mockReturnValue({ value: 'test' }),
      commit: jest.fn()
    }),
    columns: [],
    addRow: jest.fn()
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

  return {
    Workbook: jest.fn().mockImplementation(() => mockWorkbook)
  };
});

// Mock de axios
jest.mock('axios', () => jest.fn().mockResolvedValue({ data: {} }));

// Silenciar console.log durante pruebas
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Limpiar todos los mocks después de cada prueba
afterEach(() => {
  jest.clearAllMocks();
});