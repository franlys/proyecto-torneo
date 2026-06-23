import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface StaffRemovalEmailParams {
  email: string
  streamerName: string
  role: string
}

interface StaffInviteEmailParams {
  email: string
  streamerName: string
  role: string
  inviteUrl: string
  isNewUser: boolean
}

export async function sendStaffInviteEmail({
  email,
  streamerName,
  role,
  inviteUrl,
  isNewUser,
}: StaffInviteEmailParams) {
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

    const subject = isNewUser
      ? `Has sido invitado por ${streamerName} a formar parte de su staff`
      : `Invitación de staff recibida de ${streamerName}`

    const invitationText = isNewUser
      ? `Has sido invitado por el streamer <strong>${streamerName}</strong> a formar parte de su staff con el rol de <strong>${roleLabel}</strong> en la plataforma de torneos <strong>Kronix E-sports</strong>.<br/><br/>Haz clic en el siguiente botón para aceptar la invitación y configurar tu contraseña de acceso:`
      : `El streamer <strong>${streamerName}</strong> te ha invitado a formar parte de su staff con el rol de <strong>${roleLabel}</strong> en la plataforma de torneos <strong>Kronix E-sports</strong>.<br/><br/>Como ya cuentas con un usuario registrado, haz clic en el siguiente botón para ingresar a tu panel y responder a la invitación:`

    const buttonLabel = isNewUser ? 'ACEPTAR INVITACIÓN' : 'VER INVITACIÓN'

    const { data, error } = await resend.emails.send({
      from: 'Kronix E-sports <no-reply@kronix.do>',
      to: [email],
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
            <span style="font-size: 10px; letter-spacing: 0.15em; color: rgba(255,255,255,0.3); text-transform: uppercase; display: block; margin-top: 4px;">by GonzalezLabs</span>
          </div>
          
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">¡Hola!</h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            ${invitationText}
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteUrl}" style="background: linear-gradient(90deg, #00f5ff 0%, #b026ff 100%); color: #ffffff; text-decoration: none; padding: 12px 36px; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 15px rgba(0, 245, 255, 0.2);">
              ${buttonLabel}
            </a>
          </div>
          
          <p style="color: rgba(255,255,255,0.4); font-size: 11px; line-height: 1.6; word-break: break-all;">
            Si el botón no funciona, copia y pega la siguiente URL en tu navegador:<br/>
            <a href="${inviteUrl}" style="color: #00f5ff; text-decoration: none;">${inviteUrl}</a>
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
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
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

interface RegistrationRequestEmailParams {
  email: string
  streamerName: string
  tournamentName: string
  teamName: string
  portalUrl: string
}

interface RegistrationApprovedEmailParams {
  email: string
  captainName: string
  tournamentName: string
  portalUrl: string
}

interface RegistrationConfirmedEmailParams {
  email: string
  captainName: string
  tournamentName: string
  teamName: string
  discordUrl?: string | null
}

export async function sendRegistrationRequestEmail({
  email,
  streamerName,
  tournamentName,
  teamName,
  portalUrl,
}: RegistrationRequestEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado.')
    return { success: false }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Kronix E-sports <no-reply@kronix.do>',
      to: [email],
      subject: `Nueva solicitud de inscripción para ${tournamentName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
          </div>
          
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">¡Hola ${streamerName}!</h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            El equipo <strong>${teamName}</strong> ha solicitado inscribirse en tu torneo <strong>${tournamentName}</strong>.
          </p>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            Para revisar la solicitud, habilitar el pago de inscripción o rechazarla, ingresa a tu panel de administración:
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" style="background: linear-gradient(90deg, #00f5ff 0%, #b026ff 100%); color: #ffffff; text-decoration: none; padding: 12px 36px; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 15px rgba(0, 245, 255, 0.2);">
              GESTIONAR INSCRIPCIÓN
            </a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 24px 0;" />
          <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-align: center;">
            Este es un correo automático de Kronix E-sports.
          </p>
        </div>
      `,
    })

    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    console.error('Error al enviar correo de solicitud:', err)
    return { success: false, error: err.message }
  }
}

export async function sendRegistrationApprovedEmail({
  email,
  captainName,
  tournamentName,
  portalUrl,
}: RegistrationApprovedEmailParams) {
  if (!process.env.RESEND_API_KEY) return { success: false }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Kronix E-sports <no-reply@kronix.do>',
      to: [email],
      subject: `Solicitud aprobada: Procede al pago del torneo ${tournamentName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
          </div>
          
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">¡Hola ${captainName}!</h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            Tu solicitud de inscripción para el torneo <strong>${tournamentName}</strong> ha sido <strong>APROBADA</strong> por el organizador.
          </p>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            Para completar tu registro, por favor ingresa al enlace del torneo, realiza la transferencia y sube la foto del comprobante de pago:
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" style="background: linear-gradient(90deg, #00f5ff 0%, #b026ff 100%); color: #ffffff; text-decoration: none; padding: 12px 36px; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 15px rgba(0, 245, 255, 0.2);">
              SUBIR COMPROBANTE
            </a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 24px 0;" />
          <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-align: center;">
            Este es un correo automático de Kronix E-sports.
          </p>
        </div>
      `,
    })

    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    console.error('Error al enviar correo de aprobación:', err)
    return { success: false, error: err.message }
  }
}

export async function sendRegistrationConfirmedEmail({
  email,
  captainName,
  tournamentName,
  teamName,
  discordUrl,
}: RegistrationConfirmedEmailParams) {
  if (!process.env.RESEND_API_KEY) return { success: false }

  try {
    const discordSection = discordUrl
      ? `<p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; margin-top: 16px;">
          Como participante oficial, puedes unirte al Discord exclusivo para coordinar las partidas:<br/>
          <a href="${discordUrl}" style="color: #00f5ff; text-decoration: none; font-weight: bold;">${discordUrl}</a>
         </p>`
      : ''

    const { data, error } = await resend.emails.send({
      from: 'Kronix E-sports <no-reply@kronix.do>',
      to: [email],
      subject: `¡Confirmado! Inscripción completada para ${tournamentName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
          </div>
          
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">¡Felicidades ${captainName}!</h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            El organizador ha verificado tu pago y tu equipo <strong>${teamName}</strong> ha sido <strong>CONFIRMADO</strong> oficialmente para participar en el torneo <strong>${tournamentName}</strong>.
          </p>
          ${discordSection}
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            ¡Prepárate y buena suerte en la arena!
          </p>
          
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 24px 0;" />
          <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-align: center;">
            Este es un correo automático de Kronix E-sports.
          </p>
        </div>
      `,
    })

    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    console.error('Error al enviar correo de confirmación:', err)
    return { success: false, error: err.message }
  }
}
