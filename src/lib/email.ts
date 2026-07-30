import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'fake-key-for-dev');
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Soporte Kronix <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.log('----------------------------------------------------');
    console.log(`[EMAIL SIMULADO] Para: ${to} | Asunto: ${subject}`);
    console.log(html);
    console.log('----------------------------------------------------');
    return { success: true, simulated: true };
  }

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

export async function sendRefundRequestedEmail(to: string, details: { raffleName: string, ticketsCount: number, reason: string }) {
  return sendEmail({
    to,
    subject: `Solicitud de Devolución Recibida - ${details.raffleName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
        <h2 style="color: #333;">Solicitud de Devolución Recibida</h2>
        <p>Hola,</p>
        <p>Hemos recibido tu solicitud de devolución para el sorteo <strong>${details.raffleName}</strong>.</p>
        <p><strong>Detalles:</strong></p>
        <ul>
          <li>Boletos a devolver: ${details.ticketsCount}</li>
          <li>Motivo: ${details.reason}</li>
        </ul>
        <p>Si la solicitud cumple con los requisitos automáticos, será procesada de inmediato. De lo contrario, nuestro equipo la revisará manualmente en breve.</p>
        <br/>
        <p>Gracias,</p>
        <p><strong>El equipo de Kronix</strong></p>
      </div>
    `
  });
}

export async function sendRefundProcessedEmail(to: string, details: { raffleName: string, ticketsCount: number, status: 'aprobada' | 'rechazada' }) {
  const color = details.status === 'aprobada' ? '#10b981' : '#ef4444';
  return sendEmail({
    to,
    subject: `Resolución de Devolución - ${details.raffleName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
        <h2 style="color: ${color};">Tu solicitud ha sido ${details.status.toUpperCase()}</h2>
        <p>Hola,</p>
        <p>Te informamos que tu solicitud de devolución para <strong>${details.ticketsCount} boleto(s)</strong> del sorteo <strong>${details.raffleName}</strong> ha sido <strong>${details.status}</strong>.</p>
        ${details.status === 'aprobada' ? '<p>El dinero ha sido reembolsado a tu método de pago original o billetera K-Coins.</p>' : '<p>Lamentablemente no pudimos procesar tu devolución porque no cumple con nuestras políticas.</p>'}
        <br/>
        <p>Gracias,</p>
        <p><strong>El equipo de Kronix</strong></p>
      </div>
    `
  });
}

export async function sendWalletRechargeEmail(to: string, amount: number) {
  return sendEmail({
    to,
    subject: `Recarga de K-Coins Exitosa`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
        <h2 style="color: #10b981;">¡Recarga Exitosa!</h2>
        <p>Hola,</p>
        <p>Tu recarga de <strong>${amount} K-Coins</strong> ha sido procesada exitosamente y acreditada a tu billetera.</p>
        <p>Ya puedes usar tus K-Coins para participar en torneos y sorteos.</p>
        <br/>
        <p>Gracias,</p>
        <p><strong>El equipo de Kronix</strong></p>
      </div>
    `
  });
}
