// controllers/authController.js

const registrarUsuario = async (req, res) => {
    try {
        const { email, password, nombre, dni, fecha_nacimiento, ciudad, rol } = req.body;

        // Aquí puedes integrar la lógica con Supabase desde el backend 
        // usando el cliente de Node o simplemente procesar los datos.
        
        console.log("Datos recibidos en el backend para registro:", { email, nombre, rol });

        res.status(200).json({ 
            success: true, 
            message: "Usuario registrado correctamente en el backend" 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const loginUsuario = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Lógica de inicio de sesión
        res.status(200).json({ 
            success: true, 
            message: "Inicio de sesión exitoso" 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    registrarUsuario,
    loginUsuario
};