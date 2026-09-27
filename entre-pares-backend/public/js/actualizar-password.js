// js/actualizar-password.js
const formActualizar = document.getElementById('form-actualizar'); // O el selector de tu formulario
const inputNuevaPassword = document.getElementById('nueva-password'); // El input de la nueva pass

formActualizar.addEventListener('submit async', async (e) => {
    e.preventDefault();
    const nuevaPassword = inputNuevaPassword.value;

    try {
        // Supabase detecta automáticamente el token de la URL y actualiza el usuario actual
        const { data, error } = await supabaseClient.auth.updateUser({
            password: nuevaPassword
        });

        if (error) throw error;

        alert('¡Contraseña actualizada con éxito! Redirigiendo al login...');
        window.location.href = 'login.html'; // O la página de inicio de sesión de tu app

    } catch (error) {
        console.error("Error al actualizar la contraseña:", error.message);
        alert("Hubo un error al actualizar la contraseña: " + error.message);
    }
});