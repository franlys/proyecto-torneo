import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface StaffRemovalEmailParams {
  email: string
  streamerName: string
  role: string
}

export async function sendStaffRemovalEmail({
  email,
  streamerName,
  role,
}: StaffRemovalEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado. Saltando envío de correo de staff.')
    return { success: false, error: 'RESEND_API_KEY no configurado' }
  }

  try {
    const roleLabels: Record<string, string> = {
      editor: 'Editor',
      referee: 'Árbitro',
      analyst: 'Analista',
    }
    const roleLabel = roleLabels[role] || role

    const { data, error } = await resend.emails.send({
      from: 'Kronix E-sports <no-reply@kronix.do>',
      to: [email],
      subject: `Has sido removido del staff de ${streamerName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
            <span style="font-size: 10px; letter-spacing: 0.15em; color: rgba(255,255,255,0.3); text-transform: uppercase; display: block; margin-top: 4px;">by GonzalezLabs</span>
          </div>
          
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Hola,</h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            Te notificamos que has sido removido de tu cargo de <strong>${roleLabel}</strong> en el equipo de staff del streamer <strong>${streamerName}</strong> en la plataforma Kronix.
          </p>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            A partir de este momento, ya no contarás con permisos de administración sobre sus torneos ni acceso a su panel privado.
          </p>
          
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 24px 0;" />
          
          <p style="color: rgba(255,255,255,0.4); font-size: 11px; line-height: 1.6; text-align: center;">
            Este es un correo automático de Kronix E-sports. Si tienes alguna duda, ponte en contacto directo con el streamer.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Error al enviar correo con Resend:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (err: any) {
    console.error('Error inesperado al enviar correo:', err)
    return { success: false, error: err?.message || String(err) }
  }
}
