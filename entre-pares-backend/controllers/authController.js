

const registrarUsuario = async (req, res) => {
    try {
        const { email, password, nombre, dni, fecha_nacimiento, ciudad, rol } = req.body;
        
        console.log("Datos recibidos para registro:", { email, nombre, rol });

        res.status(200).json({ 
            success: true, 
            message: "Usuario registrado correctamente" 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const loginUsuario = async (req, res) => {
    try {
        const { email, password } = req.body;

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