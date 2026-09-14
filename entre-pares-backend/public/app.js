const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const inputCiudad = document.getElementById('ciudad');
    const listaSugerencias = document.getElementById('sugerencias');

    const map = L.map('map').setView([-34.6037, -58.3816], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    let marker = L.marker([-34.6037, -58.3816], { draggable: true }).addTo(map);

    function actualizarUbicacion(lat, lon, nombreLugar) {
        inputCiudad.value = nombreLugar;
        map.setView([lat, lon], 13);
        marker.setLatLng([lat, lon]);
    }

    marker.on('dragend', async (e) => {
        const { lat, lng } = e.target.getLatLng();
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name) {
            inputCiudad.value = data.display_name;
        }
    });

    map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name) {
            inputCiudad.value = data.display_name;
        }
    });

    let timeoutId;
    inputCiudad.addEventListener('input', () => {
        clearTimeout(timeoutId);
        const query = inputCiudad.value;
        if (query.length < 3) {
            listaSugerencias.classList.add('hidden');
            return;
        }

        timeoutId = setTimeout(async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ar`);
                const results = await res.json();

                listaSugerencias.innerHTML = '';
                if (results.length > 0) {
                    listaSugerencias.classList.remove('hidden');
                    results.forEach(place => {
                        const li = document.createElement('li');
                        li.textContent = place.display_name;
                        li.className = "px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-none";
                        li.addEventListener('click', () => {
                            actualizarUbicacion(place.lat, place.lon, place.display_name);
                            listaSugerencias.classList.add('hidden');
                        });
                        listaSugerencias.appendChild(li);
                    });
                } else {
                    listaSugerencias.classList.add('hidden');
                }
            } catch (err) {
                console.error("Error buscando sugerencias:", err);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!inputCiudad.contains(e.target) && !listaSugerencias.contains(e.target)) {
            listaSugerencias.classList.add('hidden');
        }
    });

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

            mensaje.textContent = "Registrando usuario...";
            mensaje.className = "text-center text-sm mt-4 text-blue-600 font-medium";

            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        nombre_completo: nombre,
                        dni: dni,
                        fecha_nacimiento: fecha_nacimiento,
                        ciudad: ciudad,
                        rol: rol
                    }
                }
            });

            if (error) {
                mensaje.textContent = "Error: " + error.message;
                mensaje.className = "text-center text-sm mt-4 text-red-600 font-medium";
                return;
            }

            const { error: loginError } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (loginError) {
                mensaje.textContent = "Registro exitoso, por favor iniciá sesión.";
                mensaje.className = "text-center text-sm mt-4 text-orange-600 font-medium";
                return;
            }

            mensaje.textContent = "¡Registro exitoso! Redirigiendo a tu panel...";
            mensaje.className = "text-center text-sm mt-4 text-green-600 font-medium";

            setTimeout(() => {
                if (rol === 'Tutor') {
                    window.location.href = 'dashboard-tutor.html';
                } else {
                    window.location.href = 'dashboard-estudiante.html';
                }
            }, 1000);
        });
    }
});