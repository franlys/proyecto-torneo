import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

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
  if (!resend) {
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
  if (!resend) {
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
  if (!resend) {
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
  if (!resend) return { success: false }

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
  if (!resend) return { success: false }

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

interface TeammateRegisteredEmailParams {
  email: string
  teammateName: string
  captainName: string
  tournamentName: string
  gameLabel: string
  portalUrl: string
}

export async function sendTeammateRegisteredEmail({
  email,
  teammateName,
  captainName,
  tournamentName,
  gameLabel,
  portalUrl,
}: TeammateRegisteredEmailParams) {
  if (!resend) return { success: false }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Kronix E-sports <no-reply@kronix.do>',
      to: [email],
      subject: `Has sido inscrito en el torneo ${tournamentName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
          </div>
          
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">¡Hola ${teammateName}!</h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            Tu capitán <strong>${captainName}</strong> te ha inscrito como integrante de su equipo en el torneo <strong>${tournamentName}</strong>.
          </p>
          <p style="color: #00f5ff; font-size: 14px; line-height: 1.6; font-weight: bold; margin-top: 16px;">
            ⚠️ IMPORTANTE: Falta vincular tu cuenta de juego (${gameLabel})
          </p>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            Para que tus estadísticas e historial de partidas se computen de forma correcta en el torneo, debes guardar tu ID de cuenta. Ingresa a la plataforma de Kronix para completarlo:
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" style="background: linear-gradient(90deg, #00f5ff 0%, #b026ff 100%); color: #ffffff; text-decoration: none; padding: 12px 36px; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 15px rgba(0, 245, 255, 0.2);">
              CONFIGURAR MI CUENTA
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
    console.error('Error al enviar correo al compañero:', err)
    return { success: false, error: err.message }
  }
}

interface TeamRemovedEmailParams {
  email: string
  captainName: string
  teamName: string
  tournamentName: string
  reason: string
  creatorName: string
  creatorEmail: string
  whatsappLink?: string | null
  discordLink?: string | null
  isKronixOfficial: boolean
  isCollaboration: boolean
}

export async function sendTeamRemovedEmail({
  email,
  captainName,
  teamName,
  tournamentName,
  reason,
  creatorName,
  creatorEmail,
  whatsappLink,
  discordLink,
  isKronixOfficial,
  isCollaboration,
}: TeamRemovedEmailParams) {
  if (!resend) return { success: false }

  try {
    // Determinar la política de reembolso aplicable
    let refundPolicyHtml = ''
    if (isKronixOfficial) {
      refundPolicyHtml = `
        <div style="background-color: rgba(0, 245, 255, 0.05); border: 1px solid rgba(0, 245, 255, 0.2); padding: 16px; border-radius: 12px; margin-top: 20px;">
          <p style="color: #00f5ff; font-size: 14px; font-weight: bold; margin: 0 0 8px 0;">🛡️ REEMBOLSO GESTIONADO POR KRONIX</p>
          <p style="color: rgba(255,255,255,0.7); font-size: 13px; line-height: 1.6; margin: 0;">
            Al ser este un torneo oficial organizado en su totalidad por nuestra plataforma, el reembolso de la inscripción será procesado directamente por el equipo de soporte técnico de Kronix. Recibirás una notificación adicional una vez se procese.
          </p>
        </div>
      `
    } else if (isCollaboration) {
      refundPolicyHtml = `
        <div style="background-color: rgba(176, 38, 255, 0.05); border: 1px solid rgba(176, 38, 255, 0.2); padding: 16px; border-radius: 12px; margin-top: 20px;">
          <p style="color: #b026ff; font-size: 14px; font-weight: bold; margin: 0 0 8px 0;">🤝 TORNEO EN COLABORACIÓN (50/50)</p>
          <p style="color: rgba(255,255,255,0.7); font-size: 13px; line-height: 1.6; margin: 0;">
            Este torneo cuenta con el aval y coorganización de Kronix. La devolución de tu pago de inscripción se coordinará en un 50% por el streamer organizador y el otro 50% por el equipo de soporte de Kronix.
          </p>
        </div>
      `
    } else {
      refundPolicyHtml = `
        <div style="background-color: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 16px; border-radius: 12px; margin-top: 20px;">
          <p style="color: #ef4444; font-size: 14px; font-weight: bold; margin: 0 0 8px 0;">⚠️ DESLINDE DE RESPONSABILIDAD DE PAGOS</p>
          <p style="color: rgba(255,255,255,0.7); font-size: 13px; line-height: 1.6; margin: 0;">
            Te recordamos que <strong>Kronix no se hace responsable por los cobros, pagos ni devoluciones</strong> de las inscripciones correspondientes a torneos organizados de forma independiente por streamers de la comunidad. Debes ponerte en contacto directo con el organizador para coordinar la devolución de tu dinero.
          </p>
        </div>
      `
    }

    // Construir vías de contacto del organizador
    let contactInfoHtml = `
      <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; margin-top: 16px; margin-bottom: 8px;">
        Ponte en contacto directo con el organizador para coordinar detalles:
      </p>
      <ul style="color: rgba(255,255,255,0.7); font-size: 13px; line-height: 1.6; margin: 0; padding-left: 20px; space-y: 6px;">
        <li><strong>Organizador:</strong> ${creatorName}</li>
        <li><strong>Correo:</strong> <a href="mailto:${creatorEmail}" style="color: #00f5ff; text-decoration: none;">${creatorEmail}</a></li>
    `
    if (whatsappLink) {
      contactInfoHtml += `<li><strong>WhatsApp:</strong> <a href="${whatsappLink}" style="color: #00f5ff; text-decoration: none;">${whatsappLink}</a></li>`
    }
    if (discordLink) {
      contactInfoHtml += `<li><strong>Discord:</strong> <a href="${discordLink}" style="color: #00f5ff; text-decoration: none;">${discordLink}</a></li>`
    }
    contactInfoHtml += '</ul>'

    const { data, error } = await resend.emails.send({
      from: 'Kronix E-sports <no-reply@kronix.do>',
      to: [email],
      subject: `Remoción del torneo: ${tournamentName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
          </div>
          
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Hola ${captainName},</h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            Te notificamos que tu equipo <strong>${teamName}</strong> ha sido <strong>REMOVIDO</strong> del torneo <strong>${tournamentName}</strong> por decisión del organizador.
          </p>
          
          <div style="background-color: rgba(255, 255, 255, 0.02); border-left: 4px solid #ef4444; padding: 16px; border-radius: 4px; margin: 24px 0;">
            <p style="color: #ef4444; font-size: 12px; font-weight: bold; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em;">Razón de la expulsión:</p>
            <p style="color: rgba(255,255,255,0.8); font-size: 13px; line-height: 1.6; margin: 0; font-style: italic;">
              "${reason}"
            </p>
          </div>
          
          ${contactInfoHtml}
          
          ${refundPolicyHtml}
          
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 24px 0;" />
          <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-align: center;">
            Este es un correo automático de la plataforma Kronix E-sports.
          </p>
        </div>
      `,
    })

    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    console.error('Error al enviar correo de expulsión:', err)
    return { success: false, error: err.message }
  }
}

interface TournamentAnnouncementEmailParams {
  emails: string[]
  tournamentName: string
  creatorName: string
  slug: string
}

export async function sendTournamentAnnouncementEmail({
  emails,
  tournamentName,
  creatorName,
  slug,
}: TournamentAnnouncementEmailParams) {
  if (!resend) {
    console.warn('RESEND_API_KEY no configurado. Saltando envío de anuncio.')
    return { success: false, error: 'RESEND_API_KEY no configurado' }
  }

  try {
    const portalUrl = `https://www.kronix.do/t/${slug}`
    
    // Enviar en lotes de 50 para evitar límites de destinatarios por envío
    const batchSize = 50
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)
      const { error } = await resend.emails.send({
        from: 'Kronix E-sports <no-reply@kronix.do>',
        to: ['no-reply@kronix.do'],
        bcc: batch,
        subject: `📣 ¡Nuevo Torneo Anunciado: ${tournamentName}!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
              <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
            </div>
            
            <h2 style="color: #ffffff; font-size: 20px; margin-top: 0; text-align: center; font-weight: 800;">📣 ¡NUEVO TORNEO ANUNCIADO!</h2>
            <p style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.6; text-align: center;">
              El organizador <strong>${creatorName}</strong> ha anunciado el torneo <strong>${tournamentName}</strong> en la plataforma Kronix.
            </p>
            <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 28px;">
              Las inscripciones ya están abiertas. Haz clic en el siguiente botón para ver todos los detalles, reglas y registrar tu equipo:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${portalUrl}" style="background: linear-gradient(90deg, #00f5ff 0%, #b026ff 100%); color: #ffffff; text-decoration: none; padding: 12px 36px; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 15px rgba(0, 245, 255, 0.2);">
                VER DETALLES E INSCRIBIRSE
              </a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 24px 0;" />
            <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-align: center; line-height: 1.6;">
              Recibes esta notificación porque tienes una cuenta registrada en Kronix E-sports. Si no deseas recibir estos correos, puedes desvincular tu cuenta o cambiar tu configuración en tu perfil.
            </p>
          </div>
        `,
      })

      if (error) {
        console.error('Error al enviar lote de correos de anuncio:', error)
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error inesperado al enviar correos de anuncio:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

interface TicketEmailParams {
  email: string
  buyerName: string
  raffleName: string
  ticketNumbers: string[]
}

export async function sendTicketPendingEmail({
  email,
  buyerName,
  raffleName,
  ticketNumbers,
}: TicketEmailParams) {
  if (!resend) return { success: false }
  try {
    const listStr = ticketNumbers.map(n => `#${n}`).join(', ')
    const { data, error } = await resend.emails.send({
      from: 'Kronix Sorteos <no-reply@kronix.do>',
      to: [email],
      subject: `Reserva de boletos en revisión: ${raffleName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
          </div>
          
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0; text-align: center;">🎟️ RESERVA RECIBIDA</h2>
          <p style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.6;">
            Hola <strong>${buyerName}</strong>,
          </p>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            Hemos recibido tu comprobante de pago para el sorteo <strong>${raffleName}</strong>. 
            Tus boletos seleccionados son: <strong style="color: #00f5ff; font-size: 16px;">${listStr}</strong>.
          </p>
          <div style="background-color: rgba(255, 255, 255, 0.02); border-left: 4px solid #b026ff; padding: 16px; border-radius: 4px; margin: 24px 0;">
            <p style="color: #b026ff; font-size: 12px; font-weight: bold; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em;">ESTADO DE RESERVA:</p>
            <p style="color: rgba(255,255,255,0.8); font-size: 13px; line-height: 1.6; margin: 0;">
              En proceso de verificación. Nuestro equipo administrativo validará tu depósito en un plazo máximo de 24 horas y te notificará por este medio.
            </p>
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
    console.error('Error al enviar correo de boletos pendientes:', err)
    return { success: false, error: err.message }
  }
}

export async function sendTicketConfirmedEmail({
  email,
  buyerName,
  raffleName,
  ticketNumbers,
}: TicketEmailParams) {
  if (!resend) return { success: false }
  try {
    const listStr = ticketNumbers.map(n => `#${n}`).join(', ')
    const myTicketsUrl = `https://www.kronix.do/raffles/my-tickets`
    const { data, error } = await resend.emails.send({
      from: 'Kronix Sorteos <no-reply@kronix.do>',
      to: [email],
      subject: `¡Confirmado! Boletos oficiales para ${raffleName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
          </div>
          
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0; text-align: center; color: #00f5ff;">✅ PAGO VERIFICADO</h2>
          <p style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.6;">
            ¡Excelente noticia <strong>${buyerName}</strong>!
          </p>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            Hemos verificado tu transferencia. Tus números oficiales confirmados para el sorteo de <strong>${raffleName}</strong> son:
          </p>
          <div style="text-align: center; margin: 24px 0; background: rgba(0, 245, 255, 0.05); border: 1px solid rgba(0, 245, 255, 0.2); padding: 16px; border-radius: 12px;">
            <span style="font-size: 22px; font-weight: bold; color: #00f5ff; letter-spacing: 0.1em;">${listStr}</span>
          </div>
          
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; text-align: center;">
            Puedes consultar todos tus boletos en tu cuenta en cualquier momento:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${myTicketsUrl}" style="background: linear-gradient(90deg, #00f5ff 0%, #b026ff 100%); color: #ffffff; text-decoration: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 0.05em;">
              VER MIS BOLETOS
            </a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 24px 0;" />
          <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-align: center;">
            Este es un correo oficial de la plataforma Kronix E-sports.
          </p>
        </div>
      `,
    })
    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    console.error('Error al enviar correo de confirmación de boletos:', err)
    return { success: false, error: err.message }
  }
}

interface WinnerEmailParams {
  email: string
  winnerName: string
  raffleName: string
  ticketNumber: string
}

export async function sendRaffleWinnerEmail({
  email,
  winnerName,
  raffleName,
  ticketNumber,
}: WinnerEmailParams) {
  if (!resend) return { success: false }
  try {
    const { data, error } = await resend.emails.send({
      from: 'Kronix Sorteos <no-reply@kronix.do>',
      to: [email],
      subject: `🏆 ¡FELICIDADES! Has ganado el sorteo de ${raffleName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0c0c12; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://www.kronix.do/logo.png" alt="KRONIX Logo" style="width: 50px; height: auto; margin-bottom: 12px; display: inline-block;" />
            <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 0.2em; color: #00f5ff; margin: 0; text-transform: uppercase;">KRONIX</h1>
          </div>
          
          <h2 style="color: #ffffff; font-size: 22px; margin-top: 0; text-align: center; color: #ffd700; font-weight: 900;">🏆 ¡ERES EL GANADOR! 🏆</h2>
          <p style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.6;">
            ¡Hola <strong>${winnerName}</strong>!,
          </p>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6;">
            ¡Felicidades! Tu número de boleto <strong style="color: #ffd700; font-size: 18px;">#${ticketNumber}</strong> ha sido el ganador en el sorteo en vivo de: <strong>${raffleName}</strong>.
          </p>
          
          <div style="background-color: rgba(255, 215, 0, 0.05); border-left: 4px solid #ffd700; padding: 16px; border-radius: 4px; margin: 24px 0;">
            <p style="color: #ffd700; font-size: 12px; font-weight: bold; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em;">PRÓXIMOS PASOS:</p>
            <p style="color: rgba(255,255,255,0.8); font-size: 13px; line-height: 1.6; margin: 0;">
              Ponte en contacto directo con soporte al cliente de Kronix o el organizador para coordinar la entrega física o transferencia de tu premio de forma segura.
            </p>
          </div>
          
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 24px 0;" />
          <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-align: center;">
            Este es un correo oficial de la plataforma Kronix E-sports.
          </p>
        </div>
      `,
    })
    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    console.error('Error al enviar correo del ganador del sorteo:', err)
    return { success: false, error: err.message }
  }
}



