require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

app.post('/api/auth/registro', async (req, res) => {
    try {
        const { email, password, nombre, dni, fecha_nacimiento, ciudad, rol } = req.body;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nombre_completo: nombre,
                    dni,
                    fecha_nacimiento,
                    ciudad,
                    rol,
                    estado_verificacion: (rol === 'Tutor' || rol === 'Ambos') ? 'Pendiente' : 'Aprobado'
                }
            }
        });

        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }

        res.status(200).json({ 
            success: true, 
            message: "Usuario registrado con éxito", 
            data 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }

        res.status(200).json({ 
            success: true, 
            message: "Inicio de sesión exitoso", 
            data 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/auth/recuperar', async (req, res) => {
    try {
        const { email } = req.body;

        const { data, error } = await supabase.auth.resetPasswordForEmail(email);

        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }

        res.status(200).json({ 
            success: true, 
            message: "Correo de recuperación enviado con éxito", 
            data 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint para obtener la lista de tutores aprobados para el mapa
app.get('/api/tutores', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('perfiles')
            .select('*')
            .or('rol.eq.Tutor,rol.eq.Ambos')
            .eq('estado_verificacion', 'Aprobado');

        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }

        res.status(200).json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/tutor/perfil', async (req, res) => {
    try {
        const { userId, ciudad, materias } = req.body;

        const { data, error } = await supabase
            .from('perfiles')
            .update({ 
                sede_universitaria: ciudad,      
                materias_impartidas: materias,   
                estado_verificacion: 'Aprobado'
            })
            .eq('id', userId);

        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }

        res.status(200).json({ success: true, message: "Perfil actualizado con éxito", data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/reservas', async (req, res) => {
    try {
        const { tutor_id, estudiante_id, materia, fecha_hora } = req.body;

        const { data, error } = await supabaseAdmin
            .from('reservas')
            .insert([{ tutor_id, estudiante_id, materia, fecha_hora, estado: 'Pendiente' }]);

        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }

        res.status(200).json({ success: true, message: "Tutoría reservada con éxito", data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Actualizar el estado de una reserva
app.put('/api/reservas/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const { data, error } = await supabaseAdmin
            .from('reservas')
            .update({ estado })
            .eq('id', id);

        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }

        res.status(200).json({ success: true, message: `Tutoría actualizada con éxito`, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Obtener reservas de un usuario (Estudiante o Tutor) - Usando supabaseAdmin para evitar bloqueos de RLS
app.get('/api/reservas/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { rol } = req.query;

        let query = supabaseAdmin.from('reservas').select('*');
        if (rol === 'Tutor') {
            query = query.eq('tutor_id', userId);
        } else {
            query = query.eq('estudiante_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }

        res.status(200).json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Importar el servicio de correo
const { enviarCorreoAprobacionReserva } = require('./mailer');

// Endpoint para aprobar una reserva y disparar la notificación por mail
app.post('/api/reservas/:id/aprobar', async (req, res) => {
    try {
        const reservaId = req.params.id;

        const { data: reservaActualizada, error: errorUpdate } = await supabaseAdmin
            .from('reservas')
            .update({ estado: 'Aprobado' })
            .eq('id', reservaId)
            .select(`
                id,
                materia,
                fecha_hora,
                estudiante_id,
                perfiles:estudiante_id (email, nombre_completo)
            `)
            .single();

        if (errorUpdate || !reservaActualizada) {
            return res.status(400).json({ success: false, error: errorUpdate?.message || 'No se pudo actualizar la reserva' });
        }

        const estudianteEmail = reservaActualizada.perfiles?.email;
        const estudianteNombre = reservaActualizada.perfiles?.nombre_completo;
        const materia = reservaActualizada.materia;

        await enviarCorreoAprobacionReserva(estudianteEmail, estudianteNombre, materia, reservaId);

        res.json({ success: true, message: 'Reserva aprobada y notificación por correo enviada.' });

    } catch (err) {
        console.error("Error en la ruta de aprobación:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor backend de Entre Pares corriendo en el puerto ${PORT}`);
});