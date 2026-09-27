document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const form = document.getElementById('recoverForm');
    const mensaje = document.getElementById('mensaje');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();

            mensaje.textContent = "Enviando correo de recuperación...";
            mensaje.style.color = "#2563eb";

            try {
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/entre-pares-backend/public/actualizar-password.html',
                });

                if (error) throw error;

                mensaje.textContent = "¡Correo enviado! Revisá tu bandeja de entrada.";
                mensaje.style.color = "green";
                form.reset();
            } catch (err) {
                console.error("Error:", err);
                mensaje.textContent = "Error: " + (err.message || "No se pudo enviar el correo.");
                mensaje.style.color = "red";
            }
        });
    }
});