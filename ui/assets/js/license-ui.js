document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando interfaz de licencia...');
    const tokenInput = document.getElementById('tokenInput');
    const validateButton = document.getElementById('validateToken');
    const tokenError = document.getElementById('tokenError');
    const tokenSuccess = document.getElementById('tokenSuccess');
    const validationLoader = document.getElementById('validationLoader');
    const licenseStatus = document.getElementById('licenseStatus');
    const renewalActions = document.getElementById('renewalActions');
    const renewButton = document.getElementById('renewLicense');

    /**
     * Limpia los mensajes de error y éxito
     */
    const clearMessages = () => {
        if (tokenError) tokenError.textContent = '';
        if (tokenSuccess) tokenSuccess.textContent = '';
    };

    /**
     * Muestra el indicador de carga durante la validación
     */
    const showLoader = () => {
        if (validationLoader) validationLoader.style.display = 'inline-block';
        if (validateButton) validateButton.disabled = true;
    };

    /**
     * Oculta el indicador de carga
     */
    const hideLoader = () => {
        if (validationLoader) validationLoader.style.display = 'none';
        if (validateButton) validateButton.disabled = false;
    };

    /**
     * Formatea una fecha para mostrarla
     * @param {string} dateString - Fecha en formato ISO
     * @returns {string} - Fecha formateada
     */
    const formatDate = (dateString) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        } catch (e) {
            return dateString || 'Desconocida';
        }
    };

    /**
     * Actualiza la UI con el estado de la licencia
     * @param {Object} status - Información del estado de la licencia
     */
    const updateLicenseStatus = (status) => {
        if (!licenseStatus) return;

        if (status.valid) {
            const expirationDate = formatDate(status.expiresAt);
            const warningClass = status.warning ? ' style="background-color: #fff3cd; color: #856404;"' : '';
            
            licenseStatus.innerHTML = `
                <div style="background-color: #d4edda; color: #155724; padding: 15px; border-radius: 5px;${warningClass}">
                    <p><strong>Estado:</strong> Activa</p>
                    <p><strong>Vence:</strong> ${expirationDate}</p>
                    ${status.daysUntilExpiration !== undefined ? 
                      `<p><strong>Días restantes:</strong> ${status.daysUntilExpiration}</p>` : ''}
                    ${status.redeemed ? 
                      `<p><strong>¡Token redimido exitosamente!</strong></p>` : ''}
                    ${status.warning ? 
                      `<p style="color: #856404;"><strong>Advertencia:</strong> Su licencia expirará pronto.</p>` : ''}
                    ${status.offlineMode ? 
                      `<p><strong>Nota:</strong> Funcionando en modo sin conexión.</p>` : ''}
                </div>
            `;

            // Mostrar opciones de renovación si está cerca de expirar
            if (status.warning && renewalActions) {
                renewalActions.style.display = 'block';
            } else if (renewalActions) {
                renewalActions.style.display = 'none';
            }
        } else {
            licenseStatus.innerHTML = `
                <div style="background-color: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px;">
                    <p><strong>Estado:</strong> ${status.expired ? 'Expirada' : 'Inactiva'}</p>
                    <p><strong>Mensaje:</strong> ${status.message}</p>
                    ${status.expiresAt ? 
                      `<p><strong>Expiró:</strong> ${formatDate(status.expiresAt)}</p>` : ''}
                    ${status.renewable ? 
                      `<p style="color: #0c5460;"><strong>Información:</strong> Su licencia puede ser renovada.</p>` : ''}
                </div>
            `;

            // Mostrar opciones de renovación si es renovable
            if (status.renewable && renewalActions) {
                renewalActions.style.display = 'block';
            } else if (renewalActions) {
                renewalActions.style.display = 'none';
            }
        }
    };

    /**
     * Verifica si ya existe un token almacenado
     */
    const checkExistingToken = async () => {
        try {
            if (licenseStatus) {
                licenseStatus.innerHTML = '<p style="padding: 10px; text-align: center;"><em>Verificando estado de licencia...</em></p>';
            }
            
            // Podríamos agregar una llamada para verificar el token existente
            // Por ahora simplemente mostramos instrucciones
            setTimeout(() => {
                if (licenseStatus) {
                    licenseStatus.innerHTML = '<p style="padding: 10px;">Ingrese un token para activar la licencia</p>';
                }
            }, 1000);
        } catch (error) {
            console.error('Error al verificar token existente:', error);
            if (licenseStatus) {
                licenseStatus.innerHTML = '<p style="color: #721c24; padding: 10px;">Error al verificar estado de licencia</p>';
            }
        }
    };

    // Ejecutar verificación inicial
    checkExistingToken();

    // Evento click en el botón de validación
    if (validateButton) {
        validateButton.addEventListener('click', async () => {
            clearMessages();
            const token = tokenInput.value.trim();

            if (!token) {
                tokenError.textContent = 'Por favor, ingrese un token válido';
                return;
            }

            showLoader();

            try {
                // Mostrar mensaje de intento de redención
                tokenSuccess.textContent = 'Intentando redimir token...';
                
                const result = await window.electronAPI.verifyToken(token);
                console.log('Resultado de validación/redención:', result);

                if (result.valid) {
                    // Mensaje específico si el token fue redimido
                    tokenSuccess.textContent = result.redeemed
                        ? 'Token redimido exitosamente. Redirigiendo...'
                        : 'Token validado correctamente. Redirigiendo...';
                        
                    updateLicenseStatus(result);
                    
                    // Redirección después de un breve delay
                    setTimeout(() => {
                        window.electronAPI.reloadApp();
                    }, 1500);
                } else {
                    tokenError.textContent = result.message || 'Error al validar el token';
                    updateLicenseStatus(result);
                }
            } catch (error) {
                console.error('Error:', error);
                tokenError.textContent = 'Error al validar el token. Inténtelo nuevamente.';
            } finally {
                hideLoader();
            }
        });
    }

    // Manejo para el botón de renovación
    if (renewButton) {
        renewButton.addEventListener('click', () => {
            // Aquí se podría abrir un enlace externo para renovar
            alert('Contacte a soporte@ike.com.mx para renovar su licencia.');
        });
    }

    // Validación en tiempo real del input
    if (tokenInput) {
        tokenInput.addEventListener('input', () => {
            clearMessages();
            if (validateButton) {
                validateButton.disabled = !tokenInput.value.trim();
            }
        });
        
        // Permitir validación al presionar Enter
        tokenInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && tokenInput.value.trim() && validateButton && !validateButton.disabled) {
                validateButton.click();
            }
        });
    }
});