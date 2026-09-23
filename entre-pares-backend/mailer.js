const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'fvaguero@institutosanmartin.edu.ar';
const SENDER_NAME = "Entre Pares - Red de Tutorías";
const SibApiV3Sdk = require('sib-api-v3-sdk');
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
if (process.env.SENDINBLUE_API_KEY) {
    apiKey.apiKey = process.env.SENDINBLUE_API_KEY;
}

async function enviarCorreoAprobacionReserva(estudianteEmail, estudianteNombre, materia, reservaId) {
    if (!estudianteEmail) {
        console.warn("No se pudo enviar el correo: El estudiante no tiene un email válido.");
        return false;
    }

    const enlaceMeet = `https://meet.jit.si/EntreParesTutoría-${reservaId}`;

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    name: SENDER_NAME,
                    email: SENDER_EMAIL
                },
                to: [
                    {
                        email: estudianteEmail,
                        name: estudianteNombre || 'Estudiante'
                    }
                ],
                subject: `¡Tu tutoría de ${materia} fue aprobada!`,
                htmlContent: `
                    <div style="font-family: 'Inter', Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #4f46e5; margin-top: 0;">¡Hola, ${estudianteNombre || 'Estudiante'}!</h2>
                        <p>Nos alegra informarte que tu solicitud de tutoría para la materia <b>${materia}</b> ha sido <b>aprobada</b> por el tutor.</p>
                        <p>Ya puedes coordinar los detalles y unirte a la sala de videollamada virtual haciendo clic en el siguiente botón:</p>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="${enlaceMeet}" target="_blank" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">📹 Entrar a la Videollamada</a>
                        </div>
                        <p style="font-size: 0.85rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 20px;">¡Mucho éxito en tu encuentro académico!<br><b>Equipo de Entre Pares</b></p>
                    </div>
                `
            })
        });

        const resultado = await response.json();

        if (!response.ok) {
            console.error("Error al enviar correo mediante Brevo:", resultado);
            return false;
        }

        console.log("Correo de aprobación enviado exitosamente a:", estudianteEmail);
        return true;

    } catch (err) {
        console.error("Excepción en el servicio de correo (Brevo):", err);
        return false;
    }
}

module.exports = {
    enviarCorreoAprobacionReserva
};