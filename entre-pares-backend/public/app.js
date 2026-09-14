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
        const password = document.getElementById('password').value;
        const rol = document.getElementById('rol').value;

        mensaje.textContent = "Registrando usuario a través del servidor...";
        mensaje.className = "text-center text-sm mt-4 text-blue-600 font-medium";

        try {
            const respuesta = await fetch('/api/auth/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, nombre, dni, fecha_nacimiento, ciudad, rol })
            });

            const resultado = await respuesta.json();

            if (!resultado.success) {
                mensaje.textContent = "Error: " + resultado.error;
                mensaje.className = "text-center text-sm mt-4 text-red-600 font-medium";
                return;
            }

            mensaje.textContent = "¡Registro exitoso! Redirigiendo a tu panel...";
            mensaje.className = "text-center text-sm mt-4 text-green-600 font-medium";

            // Guardamos el rol en el navegador para activar el menú dual
            localStorage.setItem('usuarioRol', rol);

            setTimeout(() => {
                if (rol === 'Tutor') {
                    window.location.href = 'dashboard-tutor.html';
                } else if (rol === 'Ambos') {
                    // Si elige ambos, lo mandamos primero a la vista de estudiante
                    window.location.href = 'dashboard-estudiante.html';
                } else {
                    window.location.href = 'dashboard-estudiante.html';
                }
            }, 1000);

        } catch (err) {
            console.error("Error en la petición:", err);
            mensaje.textContent = "Error de conexión con el servidor.";
            mensaje.className = "text-center text-sm mt-4 text-red-600 font-medium";
        }
    });
}