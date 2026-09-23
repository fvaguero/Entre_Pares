const SUPABASE_URL = 'https://uecwotydamsjstpovbzz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qLu0E5bBdmeplXPNfE2UhA_VOuGhyC2';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let tutoresGlobales = [];
let markersLayer = null;
let map = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            localStorage.removeItem('usuarioRol'); 
            window.location.href = 'login.html';
        });
    }

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
        if (roleSwitcher && !roleSwitcher.contains(e.target) && dropdownMenu) {
            dropdownMenu.style.display = 'none';
        }
    });

    map = L.map('mapa').setView([-28.4695, -65.7852], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    let contenedorSidebar = document.getElementById('listaTutoresSidebar');
    if (!contenedorSidebar) {
        const aside = document.querySelector('.panel-card.card-student');
        if (aside) {
            contenedorSidebar = document.createElement('div');
            contenedorSidebar.id = 'listaTutoresSidebar';
            contenedorSidebar.style.cssText = "margin-top: 1.5rem; border-top: 1px solid #e2e8f0; padding-top: 1rem; max-height: 400px; overflow-y: auto;";
            aside.appendChild(contenedorSidebar);
        }
    }

    if (contenedorSidebar) {
        contenedorSidebar.innerHTML = '<p style="font-size: 0.85rem; color: #64748b; text-align: center;">Aplicá un filtro para buscar tutores disponibles.</p>';
    }

    try {
        const response = await fetch('/api/tutores');
        const resultado = await response.json();

        if (resultado.success && resultado.data) {
            tutoresGlobales = resultado.data;
        }
    } catch (error) {
        console.error("Error al cargar tutores:", error);
    }

    const btnFiltrar = document.querySelector('.panel-card.card-student button');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', aplicarFiltros);
    }
});

function aplicarFiltros() {
    const materiaFiltro = document.getElementById('filtroMateria').value.toLowerCase().trim();
    const ciudadFiltro = document.getElementById('filtroCiudad').value.toLowerCase().trim();

    const tutoresFiltrados = tutoresGlobales.filter(tutor => {
        const materiasTutor = (tutor.materias_impartidas || '').toLowerCase();
        const sedeTutor = (tutor.sede_universitaria || '').toLowerCase();

        const coincideMateria = materiaFiltro === '' || materiasTutor.includes(materiaFiltro);
        const coincideCiudad = ciudadFiltro === '' || sedeTutor.includes(ciudadFiltro);

        return coincideMateria && coincideCiudad;
    });

    renderizarResultadosEnPantalla(tutoresFiltrados);
}

function renderizarResultadosEnPantalla(listaTutores) {
    if (!markersLayer) return;
    markersLayer.clearLayers();

    const contenedorSidebar = document.getElementById('listaTutoresSidebar');
    if (contenedorSidebar) {
        contenedorSidebar.innerHTML = '';
    }

    if (listaTutores.length === 0) {
        if (contenedorSidebar) {
            contenedorSidebar.innerHTML = '<p style="font-size: 0.85rem; color: #dc2626; text-align: center;">No se encontraron tutores con esos criterios.</p>';
        }
        return;
    }

    listaTutores.forEach(tutor => {
        const lat = -28.4695 + (Math.random() - 0.5) * 0.02;
        const lng = -65.7852 + (Math.random() - 0.5) * 0.02;

        const marker = L.marker([lat, lng]);
        
        const nombre = tutor.nombre_completo || 'Tutor Par';
        const materias = tutor.materias_impartidas || 'Sin materias especificadas';
        const sede = tutor.sede_universitaria || 'Catamarca';

        marker.bindPopup(`
            <div style="text-align: center; min-width: 160px;">
                <b style="color: #1e293b; font-size: 0.95rem;">${nombre}</b><br>
                <span style="font-size: 0.8rem; color: #475569;">📚 ${materias}</span><br>
                <span style="font-size: 0.75rem; color: #64748b;">📍 ${sede}</span><br>
                <button onclick="abrirModalReserva('${tutor.id}', '${nombre}')" style="margin-top: 8px; background: #fde047; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.8rem; color: #1e293b;">Agendar Tutoría</button>
            </div>
        `);

        markersLayer.addLayer(marker);

        if (contenedorSidebar) {
            const cardItem = document.createElement('div');
            cardItem.style.cssText = "background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;";
            cardItem.innerHTML = `
                <b style="font-size: 0.9rem; color: #0f172a; display: block; margin-bottom: 0.2rem;">${nombre}</b>
                <span style="font-size: 0.8rem; color: #475569; display: block;">📚 ${materias}</span>
                <span style="font-size: 0.75rem; color: #64748b; display: block; margin-bottom: 0.5rem;">📍 ${sede}</span>
                <button onclick="abrirModalReserva('${tutor.id}', '${nombre}')" class="btn" style="width: 100%; background: #0f172a; color: white; padding: 0.3rem; font-size: 0.75rem; border-radius: 4px; cursor: pointer;">Agendar Tutoría</button>
            `;
            contenedorSidebar.appendChild(cardItem);
        }
    });
}

// --- 6. GESTIÓN DEL MODAL Y RESERVA (HU-12 Y HU-13) ---
const modalReserva = document.getElementById('modalReserva');
const mensajeReserva = document.getElementById('mensajeReserva');

window.abrirModalReserva = function(tutorId, nombreTutor) {
    document.getElementById('tutorIdModal').value = tutorId;
    document.getElementById('tutorNombreModal').textContent = `Tutor: ${nombreTutor}`;
    modalReserva.style.display = 'flex';
};

const cerrarModalBtn = document.getElementById('cerrarModal');
if (cerrarModalBtn) {
    cerrarModalBtn.addEventListener('click', () => {
        modalReserva.style.display = 'none';
        mensajeReserva.textContent = '';
    });
}

const formReserva = document.getElementById('formReservaTutoria');
if (formReserva) {
    formReserva.addEventListener('submit', async (e) => {
        e.preventDefault();
        mensajeReserva.textContent = "Procesando reserva...";
        mensajeReserva.style.color = "#4f46e5";

        const tutorId = document.getElementById('tutorIdModal').value;
        const materia = document.getElementById('materiaReserva').value;
        const fecha = document.getElementById('fechaReserva').value;
        const hora = document.getElementById('horaReserva').value;

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            alert("Debes iniciar sesión nuevamente.");
            window.location.href = 'login.html';
            return;
        }

        const fechaHoraLocal = `${fecha}T${hora}:00-03:00`;

        try {
            const respuesta = await fetch('/api/reservas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tutor_id: tutorId,
                    estudiante_id: user.id,
                    materia: materia,
                    fecha_hora: fechaHoraLocal
                })
            });

            const resultado = await respuesta.json();

            if (!resultado.success) {
                mensajeReserva.textContent = "Error: " + resultado.error;
                mensajeReserva.style.color = "red";
                return;
            }

            mensajeReserva.textContent = "¡Tutoría reservada con éxito!";
            mensajeReserva.style.color = "green";

            setTimeout(() => {
                modalReserva.style.display = 'none';
                e.target.reset();
                mensajeReserva.textContent = '';
            }, 2000);

        } catch (err) {
            console.error("Error en la petición de reserva:", err);
            mensajeReserva.textContent = "Error de conexión con el servidor.";
            mensajeReserva.style.color = "red";
        }
    });
}