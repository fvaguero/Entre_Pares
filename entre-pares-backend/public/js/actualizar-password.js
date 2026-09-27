document.addEventListener('DOMContentLoaded', () => {
    const formActualizar = document.getElementById('updatePasswordForm');
    const inputNuevaPassword = document.getElementById('nuevaPassword');
    const mensaje = document.getElementById('mensaje');

    if (formActualizar) {
        formActualizar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nuevaPassword = inputNuevaPassword.value;

            if (mensaje) {
                mensaje.textContent = "Actualizando contraseña...";
                mensaje.style.color = "#2563eb";
            }

            try {
                const { data, error } = await supabaseClient.auth.updateUser({
                    password: nuevaPassword
                });

                if (error) throw error;

                if (mensaje) {
                    mensaje.textContent = "¡Contraseña actualizada con éxito! Redirigiendo al login...";
                    mensaje.style.color = "green";
                }

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);

            } catch (error) {
                console.error("Error al actualizar la contraseña:", error.message);
                if (mensaje) {
                    mensaje.textContent = "Error: " + error.message;
                    mensaje.style.color = "red";
                }
            }
        });
    }
});