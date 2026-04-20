async function getGraphToken() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  const res = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
  return data.access_token;
}

async function generateQRBase64(value) {
  const QRCode = (await import('qrcode')).default;
  const buffer = await QRCode.toBuffer(value.toString(), {
    width: 400,
    margin: 2,
    color: { dark: '#004370', light: '#FFFFFF' },
  });
  return buffer.toString('base64');
}

async function sendEmailWithQR(token, senderEmail, persona, qrBase64) {
  const nombre = `${persona.nombres} ${persona.apellidos}`;
  const message = {
    subject: 'Tu código QR de asistencia - Icon BPO',
    body: {
      contentType: 'HTML',
      content: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(to right,#004370,#4997d0);padding:30px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:28px;">Icon BPO</h1>
            <p style="color:rgba(255,255,255,0.8);margin-top:8px;">Sistema de Control de Asistencia</p>
          </div>
          <div style="padding:30px;background:#f9fafb;">
            <h2 style="color:#004370;">Hola, ${nombre}</h2>
            <p style="color:#4b5563;">Te adjuntamos tu código QR personal para el registro de asistencia en eventos corporativos.</p>
            <table style="margin:8px 0;border-collapse:collapse;">
              <tr><td style="color:#6b7280;padding:4px 0;"><strong style="color:#004370;">Código de empleado:</strong></td><td style="padding:4px 8px;">${persona.codigo_empleado}</td></tr>
            </table>
            <p style="color:#4b5563;">Presenta este código al momento de registrar tu asistencia en cada evento.</p>
            <div style="text-align:center;margin:30px 0;">
              <img src="cid:qrcode@iconbpo" alt="Tu código QR" style="width:200px;height:200px;border:4px solid #004370;border-radius:8px;" />
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center;">Correo automático — no responder.</p>
          </div>
          <div style="background:#004370;padding:16px;text-align:center;">
            <div style="display:inline-flex;gap:8px;align-items:center;">
              <span style="width:8px;height:8px;border-radius:50%;background:#d8222d;display:inline-block;"></span>
              <span style="width:8px;height:8px;border-radius:50%;background:#4997d0;display:inline-block;"></span>
              <span style="width:8px;height:8px;border-radius:50%;background:white;display:inline-block;"></span>
            </div>
          </div>
        </div>
      `,
    },
    toRecipients: [
      { emailAddress: { address: persona.correo_electronico, name: nombre } },
    ],
    attachments: [
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: `QR_${persona.codigo_empleado}.png`,
        contentType: 'image/png',
        contentBytes: qrBase64,
        contentId: 'qrcode@iconbpo',
        isInline: true,
      },
    ],
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API ${res.status}: ${err}`);
  }
}

export async function POST(request) {
  try {
    const { personas } = await request.json();
    if (!personas?.length) {
      return Response.json({ error: 'No personas provided' }, { status: 400 });
    }

    const senderEmail = process.env.AZURE_SENDER_EMAIL;
    if (!senderEmail) {
      return Response.json({ error: 'AZURE_SENDER_EMAIL not configured' }, { status: 500 });
    }

    const token = await getGraphToken();
    const results = [];

    for (const persona of personas) {
      try {
        const qrValue = persona.qr_code || persona.codigo_empleado;
        const qrBase64 = await generateQRBase64(qrValue);
        await sendEmailWithQR(token, senderEmail, persona, qrBase64);
        results.push({ id: persona.id, success: true });
      } catch (err) {
        results.push({ id: persona.id, success: false, error: err.message });
      }
    }

    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
