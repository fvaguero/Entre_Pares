// ==========================================
// LÓGICA DEL OJO (MOSTRAR/OCULTAR CONTRASEÑA)
// ==========================================
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password'); // Asegúrate de que tu input tenga id="password"
const iconoOjo = document.getElementById('iconoOjo');

if (togglePassword && passwordInput && iconoOjo) {
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        if (type === 'text') {
            // Ojo abierto
            iconoOjo.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        } else {
            // Ojo tachado
            iconoOjo.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        }
    });
}

// ==========================================
// LÓGICA DE REGISTRO EN EL SERVIDOR
// ==========================================
const form = document.getElementById('registerForm');
const mensaje = document.getElementById('mensaje');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombre = document.getElementById('nombre').value;
        const dni = document.getElementById('dni').value;
        const fecha_nacimiento = document.getElementById('fecha_nacimiento').value;
        const ciudad = document.getElementById('ciudad').value;
        const email = document.getElementById('email').value;
        // Aquí toma el valor del password, ya sea que esté visible u oculto
        const password = passwordInput ? passwordInput.value : document.getElementById('password').value;
        const rol = document.getElementById('rol').value;

        mensaje.textContent = "Registrando usuario a través del servidor...";
        mensaje.style.color = "var(--primary-blue)";

        try {
            const respuesta = await fetch('/api/auth/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, nombre, dni, fecha_nacimiento, ciudad, rol })
            });

            const resultado = await respuesta.json();

            if (!resultado.success) {
                mensaje.textContent = "Error: " + resultado.error;
                mensaje.style.color = "red"; 
                return;
            }

            mensaje.textContent = "¡Registro exitoso! Redirigiendo a tu panel...";
            mensaje.style.color = "green"; 

            localStorage.setItem('usuarioRol', rol);

            setTimeout(() => {
                if (rol === 'Tutor') {
                    window.location.href = 'dashboard-tutor.html';
                } else if (rol === 'Ambos') {
                    window.location.href = 'dashboard-ambos.html'; 
                } else {
                    window.location.href = 'dashboard-estudiante.html';
                }
            }, 1000);

        } catch (err) {
            console.error("Error en la petición:", err);
            mensaje.textContent = "Error de conexión con el servidor.";
            mensaje.style.color = "red";
        }
    });
}