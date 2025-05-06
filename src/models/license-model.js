/**
 * Modelo para la información de licencia y tokens
 */
class LicenseModel {
    /**
     * @param {string} token - Token de licencia
     * @param {string} machineId - Identificador único de la máquina
     * @param {string} deviceInfo - Información del dispositivo en formato JSON
     * @param {string} expiresAt - Fecha de expiración en formato ISO
     * @param {string} status - Estado del token (valid, expired, renewable, etc.)
     */
    constructor({
      token = '',
      machineId = '',
      deviceInfo = '{}',
      expiresAt = '',
      createdAt = new Date().toISOString(),
      lastValidation = new Date().toISOString(),
      status = 'pending',
      redeemed = false,
      verified = false,
      redemptionDate = null,
      lastServerValidation = null
    }) {
      this.token = token;
      this.machineId = machineId;
      this.deviceInfo = deviceInfo;
      this.expiresAt = expiresAt;
      this.createdAt = createdAt;
      this.lastValidation = lastValidation;
      this.status = status;
      this.redeemed = redeemed;
      this.verified = verified;
      this.redemptionDate = redemptionDate;
      this.lastServerValidation = lastServerValidation;
    }
  
    /**
     * Verifica si el token ha expirado
     * @param {Date} currentDate - Fecha actual para comparar
     * @returns {boolean} - true si ha expirado, false si no
     */
    isExpired(currentDate = new Date()) {
      if (!this.expiresAt) return true;
      
      try {
        const expirationDate = new Date(this.expiresAt);
        return currentDate > expirationDate;
      } catch (error) {
        return true; // Si hay error en el formato de fecha, asumimos expirado
      }
    }
  
    /**
     * Calcula los días restantes hasta la expiración
     * @param {Date} currentDate - Fecha actual para comparar
     * @returns {number} - Días restantes (negativo si ya expiró)
     */
    getDaysRemaining(currentDate = new Date()) {
      if (!this.expiresAt) return 0;
      
      try {
        const expirationDate = new Date(this.expiresAt);
        const diffTime = expirationDate.getTime() - currentDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      } catch (error) {
        return 0;
      }
    }
  
    /**
     * Verifica si el token está próximo a expirar
     * @param {number} warningDays - Días de advertencia
     * @param {Date} currentDate - Fecha actual para comparar
     * @returns {boolean} - true si está próximo a expirar
     */
    isExpirationWarning(warningDays = 3, currentDate = new Date()) {
      if (this.isExpired(currentDate)) return false;
      
      const daysRemaining = this.getDaysRemaining(currentDate);
      return daysRemaining >= 0 && daysRemaining <= warningDays;
    }
  
    /**
     * Actualiza el modelo con nueva información
     * @param {Object} data - Datos a actualizar
     * @returns {LicenseModel} - Instancia actualizada
     */
    update(data) {
      Object.assign(this, data);
      return this;
    }
  
    /**
     * Convierte a objeto plano para almacenamiento
     * @returns {Object} - Objeto plano
     */
    toJSON() {
      return {
        token: this.token,
        machineId: this.machineId,
        deviceInfo: this.deviceInfo,
        expiresAt: this.expiresAt,
        createdAt: this.createdAt,
        lastValidation: this.lastValidation,
        status: this.status,
        redeemed: this.redeemed,
        verified: this.verified,
        redemptionDate: this.redemptionDate,
        lastServerValidation: this.lastServerValidation
      };
    }
  
    /**
     * Crea una instancia del modelo a partir de un objeto
     * @param {Object} data - Datos del modelo
     * @returns {LicenseModel} - Nueva instancia
     */
    static fromJSON(data) {
      return new LicenseModel(data || {});
    }
  }
  
  module.exports = LicenseModel;