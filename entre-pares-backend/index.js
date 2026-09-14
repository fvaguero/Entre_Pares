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
const supabase = createClient(supabaseUrl, supabaseKey);

// Endpoint de Registro (HU-04, HU-06, HU-07, HU-09)
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
                    estado_verificacion: rol === 'Tutor' ? 'Pendiente' : 'Aprobado'
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

// Endpoint de Login (HU-04)
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

// Endpoint de Recuperación de Contraseña (HU-08)
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor backend de Entre Pares corriendo en http://localhost:${PORT}`);
});