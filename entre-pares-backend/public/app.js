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
        mensaje.style.color = "var(--primary-blue)"; // Aplicamos tu variable CSS

        try {
            const respuesta = await fetch('/api/auth/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, nombre, dni, fecha_nacimiento, ciudad, rol })
            });

            const resultado = await respuesta.json();

            if (!resultado.success) {
                mensaje.textContent = "Error: " + resultado.error;
                mensaje.style.color = "red"; // Estilo limpio en lugar de Tailwind
                return;
            }

            mensaje.textContent = "¡Registro exitoso! Redirigiendo a tu panel...";
            mensaje.style.color = "green"; 

            localStorage.setItem('usuarioRol', rol);

            setTimeout(() => {
                if (rol === 'Tutor') {
                    window.location.href = 'dashboard-tutor.html';
                } else if (rol === 'Ambos') {
                    // Ahora redirige a la vista con pestañas
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