// js/actualizar-password.js
const formActualizar = document.getElementById('form-actualizar'); // O el selector de tu formulario
const inputNuevaPassword = document.getElementById('nueva-password'); // El input de la nueva pass

formActualizar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevaPassword = inputNuevaPassword.value;

    try {
        const { data, error } = await supabaseClient.auth.updateUser({
            password: nuevaPassword
        });

        if (error) throw error;

        alert('¡Contraseña actualizada con éxito! Redirigiendo al login...');
        window.location.href = 'login.html';

    } catch (error) {
        console.error("Error al actualizar la contraseña:", error.message);
        alert("Hubo un error al actualizar la contraseña: " + error.message);
    }
});