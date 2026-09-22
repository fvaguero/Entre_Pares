document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. CONFIGURACIÓN DE SUPABASE Y SESIÓN ---
    const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Validar si el usuario está logueado, si no, redirigir al login
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // --- 2. GESTIÓN DEL MENÚ DE ROL DUAL ("Ambos") ---
    const rolActual = localStorage.getItem('usuarioRol');
    const roleSwitcher = document.getElementById('roleSwitcher');
    const btnRoleDropdown = document.getElementById('btnRoleDropdown');
    const dropdownMenu = document.getElementById('dropdownMenu');

    if (rolActual === 'Ambos' && roleSwitcher) {
        roleSwitcher.style.display = 'inline-block';
    }

    if (btnRoleDropdown) {
        btnRoleDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
        });
    }

    document.addEventListener('click', (e) => {
        if (roleSwitcher && !roleSwitcher.contains(e.target)) {
            dropdownMenu.style.display = 'none';
        }
    });

    // --- 3. ENVÍO DEL PERFIL PROFESIONAL AL BACKEND DE NODE.JS ---
    const formMaterias = document.getElementById('formMaterias');
    const mensajeMaterias = document.getElementById('mensajeMaterias');

    if (formMaterias) {
        formMaterias.addEventListener('submit', async (e) => {
            e.preventDefault();

            const ciudad = document.getElementById('ciudadTutor').value;
            const materias = document.getElementById('materias').value;

            mensajeMaterias.textContent = "Guardando perfil en el servidor...";
            mensajeMaterias.style.color = "var(--primary-blue)";

            try {
                // Petición PUT a nuestro servidor Node.js (index.js)
                const respuesta = await fetch('/api/tutor/perfil', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        userId: user.id, 
                        ciudad: ciudad, 
                        materias: materias 
                    })
                });

                const resultado = await respuesta.json();

                if (!resultado.success) {
                    throw new Error(resultado.error || "No se pudo actualizar el perfil.");
                }

                mensajeMaterias.textContent = "¡Perfil actualizado con éxito! Ya aparecés en el mapa.";
                mensajeMaterias.style.color = "green";

            } catch (error) {
                console.error("Error al guardar perfil:", error);
                mensajeMaterias.textContent = "Error al guardar: " + error.message;
                mensajeMaterias.style.color = "red";
            }
        });
    }

    // --- 4. CERRAR SESIÓN ---
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            localStorage.removeItem('usuarioRol');
            window.location.href = 'login.html';
        });
    }
});