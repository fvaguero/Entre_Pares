require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || !supabaseServiceRoleKey) {
    throw new Error('Faltan SUPABASE_URL, SUPABASE_KEY (o SUPABASE_ANON_KEY) y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = ['Estudiante', 'Tutor', 'Administrador', 'Ambos'];
const ESTADOS_RESERVA = ['Pendiente', 'Aceptada', 'Aprobada', 'Rechazada', 'Cancelada', 'Completada', 'Finalizada'];

function respuestaError(res, status, message) {
    return res.status(status).json({ success: false, error: message });
}

/**
 * Valida el token Bearer contra Supabase Auth y recupera el rol desde la tabla
 * perfiles. Nunca se confía en userId, rol ni otros datos de identidad enviados
 * por el navegador.
 */
async function autenticar(req, res, next) {
    try {
        const authorization = req.headers.authorization || '';
        const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

        if (!token) return respuestaError(res, 401, 'Debés iniciar sesión para realizar esta operación.');

        const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !authData?.user) {
            return respuestaError(res, 401, 'La sesión no es válida o expiró. Iniciá sesión nuevamente.');
        }

        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from('perfiles')
            .select('id, rol, estado_verificacion')
            .eq('id', authData.user.id)
            .single();

        if (perfilError || !perfil) {
            return respuestaError(res, 403, 'No se encontró un perfil habilitado para esta cuenta.');
        }

        if (!ROLES.includes(perfil.rol)) {
            return respuestaError(res, 403, 'El rol de la cuenta no es válido.');
        }

        req.authUser = authData.user;
        req.perfil = perfil;
        next();
    } catch (error) {
        console.error('Error al autenticar solicitud:', error);
        return respuestaError(res, 500, 'No se pudo validar la sesión.');
    }
}

function permitirRoles(...roles) {
    return (req, res, next) => {
        if (!req.perfil || !roles.includes(req.perfil.rol)) {
            return respuestaError(res, 403, 'No tenés permisos para realizar esta operación.');
        }
        next();
    };
}

function esTutor(perfil) {
    return perfil?.rol === 'Tutor' || perfil?.rol === 'Ambos';
}

function esEstudiante(perfil) {
    return perfil?.rol === 'Estudiante' || perfil?.rol === 'Ambos';
}

// Registro: el rol se limita a las opciones permitidas. La aprobación de tutores
// queda pendiente y no puede ser establecida por el propio usuario.
app.post('/api/auth/registro', async (req, res) => {
    try {
        const { email, password, nombre, dni, fecha_nacimiento, ciudad, rol } = req.body || {};

        if (!email || !password || !nombre || !dni || !fecha_nacimiento || !ciudad || !ROLES.filter(r => r !== 'Administrador').includes(rol)) {
            return respuestaError(res, 400, 'Completá todos los campos obligatorios con un rol válido.');
        }
        if (String(password).length < 8) {
            return respuestaError(res, 400, 'La contraseña debe tener al menos 8 caracteres.');
        }

        const { data, error } = await supabase.auth.signUp({
            email: String(email).trim().toLowerCase(),
            password,
            options: {
                data: {
                    nombre_completo: String(nombre).trim(),
                    dni: String(dni).trim(),
                    fecha_nacimiento,
                    ciudad: String(ciudad).trim(),
                    rol,
                    estado_verificacion: (rol === 'Tutor' || rol === 'Ambos') ? 'Pendiente' : 'Aprobado'
                }
            }
        });

        if (error) return respuestaError(res, 400, error.message);
        return res.status(201).json({
            success: true,
            message: 'Usuario registrado. Si la confirmación por correo está habilitada, revisá tu bandeja de entrada.',
            data
        });
    } catch (error) {
        console.error('Error en registro:', error);
        return respuestaError(res, 500, 'No se pudo completar el registro.');
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return respuestaError(res, 400, 'Ingresá tu correo y contraseña.');

        const { data, error } = await supabase.auth.signInWithPassword({
            email: String(email).trim().toLowerCase(),
            password
        });

        if (error) return respuestaError(res, 401, 'Correo o contraseña incorrectos.');
        return res.status(200).json({ success: true, message: 'Inicio de sesión exitoso.', data });
    } catch (error) {
        console.error('Error en login:', error);
        return respuestaError(res, 500, 'No se pudo iniciar sesión.');
    }
});

app.post('/api/auth/recuperar', async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return respuestaError(res, 400, 'Ingresá tu correo electrónico.');

        const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), {
            redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL
        });

        if (error) return respuestaError(res, 400, error.message);
        return res.status(200).json({ success: true, message: 'Si el correo está registrado, recibirás las instrucciones para recuperar tu contraseña.' });
    } catch (error) {
        console.error('Error en recuperación:', error);
        return respuestaError(res, 500, 'No se pudo procesar la recuperación de contraseña.');
    }
});

// Listado público: solo devuelve campos académicos y públicos. Nunca expone DNI,
// fecha de nacimiento, correo privado, CBU ni CVU.
app.get('/api/tutores', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('perfiles')
            .select('id, nombre_completo, rol, carrera, anio_estudio, sede_universitaria, ubicacion, materias_impartidas, precio_hora, calificacion_promedio, total_resenas, puntos_gamificacion, estado_verificacion')
            .or('rol.eq.Tutor,rol.eq.Ambos')
            .eq('estado_verificacion', 'Aprobado');

        if (error) return respuestaError(res, 400, error.message);
        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error al listar tutores:', error);
        return respuestaError(res, 500, 'No se pudo cargar el listado de tutores.');
    }
});

// Un tutor solo puede editar su propio perfil. Esta ruta no puede aprobarlo:
// la validación de identidad y la aprobación siguen siendo responsabilidad del
// proceso administrativo de validación.
app.put('/api/tutor/perfil', autenticar, permitirRoles('Tutor', 'Ambos'), async (req, res) => {
    try {
        const { userId, ciudad, materias } = req.body || {};
        if (userId && userId !== req.authUser.id) {
            return respuestaError(res, 403, 'No podés modificar el perfil de otra persona.');
        }

        const actualizacion = {};
        if (ciudad !== undefined) actualizacion.sede_universitaria = String(ciudad).trim();
        if (materias !== undefined) actualizacion.materias_impartidas = materias;

        if (!Object.keys(actualizacion).length) {
            return respuestaError(res, 400, 'No se recibieron datos para actualizar.');
        }

        const { data, error } = await supabaseAdmin
            .from('perfiles')
            .update(actualizacion)
            .eq('id', req.authUser.id)
            .select('id, nombre_completo, rol, sede_universitaria, materias_impartidas, estado_verificacion')
            .single();

        if (error) return respuestaError(res, 400, error.message);
        return res.status(200).json({ success: true, message: 'Perfil actualizado. La aprobación del tutor no se modifica desde esta operación.', data });
    } catch (error) {
        console.error('Error al actualizar perfil de tutor:', error);
        return respuestaError(res, 500, 'No se pudo actualizar el perfil.');
    }
});

// Solo un estudiante autenticado puede crear una solicitud para sí mismo.
// El tutor debe existir, estar aprobado y no puede ser la misma persona.
app.post('/api/reservas', autenticar, permitirRoles('Estudiante', 'Ambos'), async (req, res) => {
    try {
        const { tutor_id, estudiante_id, materia, fecha_hora } = req.body || {};

        if (estudiante_id && estudiante_id !== req.authUser.id) {
            return respuestaError(res, 403, 'No podés crear una reserva a nombre de otra persona.');
        }
        if (!tutor_id || !UUID_REGEX.test(tutor_id) || !materia || String(materia).trim().length > 150) {
            return respuestaError(res, 400, 'Indicá un tutor válido y una materia.');
        }
        if (tutor_id === req.authUser.id) {
            return respuestaError(res, 400, 'No podés reservar una tutoría con tu propia cuenta.');
        }

        const { data: tutor, error: tutorError } = await supabaseAdmin
            .from('perfiles')
            .select('id, rol, estado_verificacion')
            .eq('id', tutor_id)
            .single();

        if (tutorError || !tutor || !esTutor(tutor) || tutor.estado_verificacion !== 'Aprobado') {
            return respuestaError(res, 404, 'El tutor no existe o todavía no está aprobado.');
        }

        const reserva = {
            tutor_id,
            estudiante_id: req.authUser.id,
            materia: String(materia).trim(),
            fecha_hora: fecha_hora || null,
            estado: 'Pendiente'
        };

        const { data, error } = await supabaseAdmin
            .from('reservas')
            .insert([reserva])
            .select('id, tutor_id, estudiante_id, materia, fecha_hora, estado, created_at')
            .single();

        if (error) return respuestaError(res, 400, error.message);
        return res.status(201).json({ success: true, message: 'Solicitud de tutoría creada.', data });
    } catch (error) {
        console.error('Error al crear reserva:', error);
        return respuestaError(res, 500, 'No se pudo crear la solicitud de tutoría.');
    }
});

// El usuario solo puede consultar sus propias reservas. El parámetro userId se
// conserva por compatibilidad, pero debe coincidir con la identidad autenticada.
app.get('/api/reservas/:userId', autenticar, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!UUID_REGEX.test(userId) || userId !== req.authUser.id) {
            return respuestaError(res, 403, 'Solo podés consultar tus propias reservas.');
        }

        let query = supabaseAdmin.from('reservas').select('*');
        if (esTutor(req.perfil)) {
            query = query.eq('tutor_id', req.authUser.id);
        } else if (esEstudiante(req.perfil)) {
            query = query.eq('estudiante_id', req.authUser.id);
        } else {
            return respuestaError(res, 403, 'El rol de administrador no utiliza esta consulta personal.');
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) return respuestaError(res, 400, error.message);
        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error al consultar reservas:', error);
        return respuestaError(res, 500, 'No se pudieron cargar las reservas.');
    }
});

// Actualización de estado: el tutor asignado puede aceptar/rechazar solicitudes;
// el estudiante asignado puede cancelar; el administrador puede intervenir.
app.put('/api/reservas/:id/estado', autenticar, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body || {};
        if (!UUID_REGEX.test(id)) return respuestaError(res, 400, 'El identificador de la reserva no es válido.');
        if (!ESTADOS_RESERVA.includes(estado)) return respuestaError(res, 400, 'El estado solicitado no es válido.');

        const { data: reserva, error: reservaError } = await supabaseAdmin
            .from('reservas')
            .select('id, tutor_id, estudiante_id, estado')
            .eq('id', id)
            .single();

        if (reservaError || !reserva) return respuestaError(res, 404, 'No se encontró la reserva.');

        const esAdmin = req.perfil.rol === 'Administrador';
        const esTutorAsignado = esTutor(req.perfil) && reserva.tutor_id === req.authUser.id;
        const esEstudianteAsignado = esEstudiante(req.perfil) && reserva.estudiante_id === req.authUser.id;

        if (!esAdmin && !esTutorAsignado && !esEstudianteAsignado) {
            return respuestaError(res, 403, 'No tenés permiso para modificar esta reserva.');
        }

        if (!esAdmin) {
            const transicionesTutor = ['Aceptada', 'Aprobada', 'Rechazada'];
            const transicionesEstudiante = ['Cancelada'];
            if (esTutorAsignado && !transicionesTutor.includes(estado)) {
                return respuestaError(res, 403, 'El tutor solo puede aceptar o rechazar solicitudes asignadas.');
            }
            if (esEstudianteAsignado && !transicionesEstudiante.includes(estado)) {
                return respuestaError(res, 403, 'El estudiante solo puede cancelar sus propias reservas.');
            }
            if (reserva.estado !== 'Pendiente' && estado !== 'Cancelada') {
                return respuestaError(res, 409, 'La reserva ya no está pendiente y no admite esta modificación.');
            }
        }

        const { data, error } = await supabaseAdmin
            .from('reservas')
            .update({ estado })
            .eq('id', id)
            .select('id, tutor_id, estudiante_id, materia, fecha_hora, estado')
            .single();

        if (error) return respuestaError(res, 400, error.message);
        return res.status(200).json({ success: true, message: 'Estado de la tutoría actualizado.', data });
    } catch (error) {
        console.error('Error al actualizar estado de reserva:', error);
        return respuestaError(res, 500, 'No se pudo actualizar la reserva.');
    }
});

// Compatibilidad con el endpoint de aprobación por correo: únicamente el tutor
// asignado puede aprobar una solicitud pendiente.
const { enviarCorreoAprobacionReserva } = require('./mailer');

app.post('/api/reservas/:id/aprobar', autenticar, permitirRoles('Tutor', 'Ambos'), async (req, res) => {
    try {
        const reservaId = req.params.id;
        if (!UUID_REGEX.test(reservaId)) return respuestaError(res, 400, 'El identificador de la reserva no es válido.');

        const { data: reserva, error: reservaError } = await supabaseAdmin
            .from('reservas')
            .select('id, tutor_id, estudiante_id, materia, fecha_hora, estado')
            .eq('id', reservaId)
            .single();

        if (reservaError || !reserva) return respuestaError(res, 404, 'No se encontró la reserva.');
        if (reserva.tutor_id !== req.authUser.id) return respuestaError(res, 403, 'Solo el tutor asignado puede aprobar esta solicitud.');
        if (reserva.estado !== 'Pendiente') return respuestaError(res, 409, 'La solicitud ya fue respondida.');

        const { data: reservaActualizada, error: errorUpdate } = await supabaseAdmin
            .from('reservas')
            .update({ estado: 'Aprobado' })
            .eq('id', reservaId)
            .eq('tutor_id', req.authUser.id)
            .eq('estado', 'Pendiente')
            .select('id, materia, fecha_hora, estudiante_id')
            .single();

        if (errorUpdate || !reservaActualizada) {
            return respuestaError(res, 409, errorUpdate?.message || 'La reserva cambió y no pudo aprobarse.');
        }

        const { data: estudiante } = await supabaseAdmin
            .from('perfiles')
            .select('email, nombre_completo')
            .eq('id', reservaActualizada.estudiante_id)
            .maybeSingle();

        if (estudiante?.email) {
            try {
                await enviarCorreoAprobacionReserva(estudiante.email, estudiante.nombre_completo, reservaActualizada.materia, reservaId);
            } catch (mailError) {
                console.error('La reserva se aprobó, pero no se pudo enviar el correo:', mailError);
                return res.status(200).json({
                    success: true,
                    message: 'La solicitud fue aprobada, pero no se pudo enviar el correo de aviso.',
                    data: reservaActualizada,
                    avisoCorreoEnviado: false
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Reserva aprobada.',
            data: reservaActualizada,
            avisoCorreoEnviado: Boolean(estudiante?.email)
        });
    } catch (error) {
        console.error('Error en la ruta de aprobación:', error);
        return respuestaError(res, 500, 'No se pudo aprobar la reserva.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor backend de Entre Pares corriendo en el puerto ${PORT}`);
});
