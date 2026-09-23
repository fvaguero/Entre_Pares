document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('mapa').setView([-28.4695, -65.7852], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Pin de prueba para el mapa
    L.marker([-28.4650, -65.7800]).addTo(map).bindPopup('<b>María Gómez</b><br>Tutor de Análisis Matemático');

    window.cambiarPestana = function(modo) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        document.getElementById(`tab-${modo}`).classList.add('active');
        event.currentTarget.classList.add('active');

        if (modo === 'estudiante') {
            setTimeout(() => map.invalidateSize(), 100);
        }
    };

    const formTutor = document.getElementById('formPerfilTutor');
    if (formTutor) {
        formTutor.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ciudad = document.getElementById('ciudadTutor').value;
            const materias = document.getElementById('materiasTutor').value;
            const mensaje = document.getElementById('mensajeTutor');

            mensaje.textContent = "Guardando perfil...";
            mensaje.style.color = "var(--primary-blue)";

            const supabase = window.supabase.createClient('https://uecwotydamsjstpovbzz.supabase.co', 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                mensaje.textContent = "Error: Sesión expirada.";
                mensaje.style.color = "red";
                return;
            }

            try {
                const respuesta = await fetch('/api/tutor/perfil', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, ciudad, materias })
                });

                const resultado = await respuesta.json();
                if (!resultado.success) throw new Error(resultado.error);

                mensaje.textContent = "¡Perfil actualizado con éxito!";
                mensaje.style.color = "green";
            } catch (err) {
                mensaje.textContent = "Error al guardar: " + err.message;
                mensaje.style.color = "red";
            }
        });
    }
    const btnCerrar = document.getElementById('btnCerrar');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', async () => {
            const supabase = window.supabase.createClient('https://uecwotydamsjstpovbzz.supabase.co', 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2');
            await supabase.auth.signOut();
            localStorage.removeItem('usuarioRol');
            window.location.href = 'login.html';
        });
    }
});