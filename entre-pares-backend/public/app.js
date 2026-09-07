const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById('registerForm');
const mensaje = document.getElementById('mensaje');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombre = document.getElementById('nombre').value;
        const dni = document.getElementById('dni').value;
        const fecha_nacimiento = document.getElementById('fecha_nacimiento').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rol = document.getElementById('rol').value;

        mensaje.textContent = "Registrando usuario...";
        mensaje.className = "text-center text-sm mt-4 text-blue-600 font-medium";

        // Registramos al usuario pasando todos los datos en 'options.data'
        // para que el disparador de la base de datos los lea y guarde en 'perfiles'.
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    nombre_completo: nombre,
                    dni: dni,
                    fecha_nacimiento: fecha_nacimiento,
                    rol: rol
                }
            }
        });

        if (error) {
            mensaje.textContent = "Error: " + error.message;
            mensaje.className = "text-center text-sm mt-4 text-red-600 font-medium";
            return;
        }

        mensaje.textContent = "¡Registro exitoso! Revisa tu correo para verificar la cuenta.";
        mensaje.className = "text-center text-sm mt-4 text-green-600 font-medium";
        form.reset();
    });
}