const LicenseModel = require('../../../src/models/license-model');

describe('LicenseModel', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 10);
  
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10);
  
  describe('constructor', () => {
    test('debe crear un modelo con valores por defecto', () => {
      // Arrange
      const model = new LicenseModel({});
      
      // Assert
      expect(model.token).toBe('');
      expect(model.machineId).toBe('');
      expect(model.deviceInfo).toBe('{}');
      expect(model.status).toBe('pending');
      expect(model.redeemed).toBe(false);
      expect(model.verified).toBe(false);
      expect(model.redemptionDate).toBeNull();
      expect(model.lastServerValidation).toBeNull();
    });
    
    test('debe crear un modelo con valores proporcionados', () => {
      // Arrange
      const data = {
        token: 'test-token',
        machineId: 'test-machine',
        deviceInfo: '{"platform":"test"}',
        expiresAt: futureDate.toISOString(),
        status: 'valid',
        redeemed: true
      };
      
      // Act
      const model = new LicenseModel(data);
      
      // Assert
      expect(model.token).toBe('test-token');
      expect(model.machineId).toBe('test-machine');
      expect(model.deviceInfo).toBe('{"platform":"test"}');
      expect(model.expiresAt).toBe(futureDate.toISOString());
      expect(model.status).toBe('valid');
      expect(model.redeemed).toBe(true);
    });
  });
  
  describe('isExpired', () => {
    test('debe devolver true para fecha expirada', () => {
      // Arrange
      const model = new LicenseModel({
        expiresAt: pastDate.toISOString()
      });
      
      // Act
      const result = model.isExpired();
      
      // Assert
      expect(result).toBe(true);
    });
    
    test('debe devolver false para fecha futura', () => {
      // Arrange
      const model = new LicenseModel({
        expiresAt: futureDate.toISOString()
      });
      
      // Act
      const result = model.isExpired();
      
      // Assert
      expect(result).toBe(false);
    });
    
    test('debe devolver true para fecha inválida', () => {
      // Arrange
      const model = new LicenseModel({
        expiresAt: 'invalid-date'
      });
      
      // Act
      const result = model.isExpired();
      
      // Assert
      expect(result).toBe(true);
    });
    
    test('debe devolver true si no hay fecha de expiración', () => {
      // Arrange
      const model = new LicenseModel({});
      
      // Act
      const result = model.isExpired();
      
      // Assert
      expect(result).toBe(true);
    });
  });
  
  describe('getDaysRemaining', () => {
    test('debe calcular días restantes correctamente', () => {
      // Arrange
      const daysToAdd = 5;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysToAdd);
      
      const model = new LicenseModel({
        expiresAt: expirationDate.toISOString()
      });
      
      // Act
      const result = model.getDaysRemaining();
      
      // Assert
      expect(result).toBe(daysToAdd);
    });
    
    test('debe devolver valor negativo para fecha pasada', () => {
      // Arrange
      const model = new LicenseModel({
        expiresAt: pastDate.toISOString()
      });
      
      // Act
      const result = model.getDaysRemaining();
      
      // Assert
      expect(result).toBeLessThan(0);
    });
    
    test('debe devolver 0 para fecha inválida', () => {
      // Arrange
      const model = new LicenseModel({
        expiresAt: 'invalid-date'
      });
      
      // Act
      const result = model.getDaysRemaining();
      
      // Assert
      expect(result).toBe(0);
    });
  });
  
  describe('isExpirationWarning', () => {
    test('debe devolver true para fecha próxima a expirar', () => {
      // Arrange
      const warningDays = 3;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 2); // Dentro del período de advertencia
      
      const model = new LicenseModel({
        expiresAt: expirationDate.toISOString()
      });
      
      // Act
      const result = model.isExpirationWarning(warningDays);
      
      // Assert
      expect(result).toBe(true);
    });
    
    test('debe devolver false para fecha lejana', () => {
      // Arrange
      const warningDays = 3;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 10); // Fuera del período de advertencia
      
      const model = new LicenseModel({
        expiresAt: expirationDate.toISOString()
      });
      
      // Act
      const result = model.isExpirationWarning(warningDays);
      
      // Assert
      expect(result).toBe(false);
    });
    
    test('debe devolver false para fecha expirada', () => {
      // Arrange
      const model = new LicenseModel({
        expiresAt: pastDate.toISOString()
      });
      
      // Act
      const result = model.isExpirationWarning();
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  describe('toJSON / fromJSON', () => {
    test('debe convertir modelo a JSON y viceversa', () => {
      // Arrange
      const originalData = {
        token: 'test-token',
        machineId: 'test-machine',
        expiresAt: futureDate.toISOString(),
        status: 'valid',
        redeemed: true
      };
      
      // Act
      const model = new LicenseModel(originalData);
      const json = model.toJSON();
      const reconstructed = LicenseModel.fromJSON(json);
      
      // Assert
      expect(json).toEqual(expect.objectContaining(originalData));
      expect(reconstructed.token).toBe(model.token);
      expect(reconstructed.expiresAt).toBe(model.expiresAt);
      expect(reconstructed.status).toBe(model.status);
    });
    
    test('debe crear modelo vacío desde null', () => {
      // Act
      const model = LicenseModel.fromJSON(null);
      
      // Assert
      expect(model).toBeInstanceOf(LicenseModel);
      expect(model.token).toBe('');
    });
  });
  
  describe('update', () => {
    test('debe actualizar el modelo correctamente', () => {
      // Arrange
      const model = new LicenseModel({
        token: 'old-token',
        status: 'pending'
      });
      
      // Act
      model.update({
        token: 'new-token',
        status: 'valid'
      });
      
      // Assert
      expect(model.token).toBe('new-token');
      expect(model.status).toBe('valid');
    });
    
    test('debe mantener propiedades no actualizadas', () => {
      // Arrange
      const model = new LicenseModel({
        token: 'test-token',
        machineId: 'test-machine',
        status: 'pending'
      });
      
      // Act
      model.update({
        status: 'valid'
      });
      
      // Assert
      expect(model.token).toBe('test-token');
      expect(model.machineId).toBe('test-machine');
      expect(model.status).toBe('valid');
    });
  });
});