import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

const RAZONES_VALIDAS = ['estudios', 'medico', 'vacaciones', 'trabajo_sabado', 'otro'];

export async function POST(request) {
  try {
    const body = await request.json();
    const eventoId = body?.evento_id;
    const codigoEmpleadoRaw = body?.codigo_empleado;
    const razon = body?.razon;
    const explicacion = body?.explicacion || '';
    const filePathRaw = body?.filePath;

    if (!eventoId || !codigoEmpleadoRaw || !razon || !filePathRaw) {
      return Response.json({ error: 'Faltan campos requeridos.' }, { status: 400 });
    }
    if (!RAZONES_VALIDAS.includes(razon)) {
      return Response.json({ error: 'Razón inválida.' }, { status: 400 });
    }
    const codigoEmpleado = parseInt(codigoEmpleadoRaw, 10);
    if (Number.isNaN(codigoEmpleado)) {
      return Response.json({ error: 'Código de empleado inválido.' }, { status: 400 });
    }

    // 1. Evento: existe y sigue abierto (re-chequeo atómico en el propio submit,
    // reemplaza el viejo re-check del cliente antes de subir el archivo).
    const eventoSnap = await adminDb.collection('eventos').doc(eventoId).get();
    if (!eventoSnap.exists) {
      return Response.json({ error: 'Evento no encontrado.' }, { status: 404 });
    }
    if (eventoSnap.data().formularioExcusasAbierto === false) {
      return Response.json(
        {
          error: 'Este formulario ya no está disponible para este evento. Contacta a Recursos Humanos si necesitas enviar tu excusa.',
          code: 'FORM_CLOSED',
        },
        { status: 403 }
      );
    }

    // 2. Persona: consulta directa a personas (server-side, sin riesgo de exponer PII
    // al cliente ya que solo se usa aquí, no se devuelve el documento completo).
    const personasSnap = await adminDb
      .collection('personas')
      .where('codigo_empleado', '==', codigoEmpleado)
      .limit(1)
      .get();
    if (personasSnap.empty) {
      return Response.json({ error: 'Código no encontrado.' }, { status: 404 });
    }
    const personaDoc = personasSnap.docs[0];
    const persona = personaDoc.data();

    // 3. El archivo ya se subió directo a Storage vía la URL firmada de
    // /api/excusas/upload-url (así se evita el límite de ~4.5MB de Vercel
    // Functions). Nunca se confía en filePath tal cual: se exige que
    // corresponda exactamente a este evento/código, se extrae el nombre
    // real del archivo de la ruta misma (nunca de otro campo del body) y se
    // confirma que el archivo exista de verdad en Storage — así nadie puede
    // crear un documento de excusa sin haber subido nada primero.
    const filePath = String(filePathRaw);
    const prefijoEsperado = `excusas/${eventoId}/${codigoEmpleado}_`;
    if (!filePath.startsWith(prefijoEsperado)) {
      return Response.json({ error: 'Archivo inválido.' }, { status: 400 });
    }
    const resto = filePath.slice(prefijoEsperado.length); // "{timestamp}_{nombreArchivo}"
    const underscoreIdx = resto.indexOf('_');
    const nombreArchivo = underscoreIdx >= 0 ? resto.slice(underscoreIdx + 1) : '';
    if (!nombreArchivo) {
      return Response.json({ error: 'Archivo inválido.' }, { status: 400 });
    }

    const bucket = adminStorage.bucket();
    const file = bucket.file(filePath);
    const [existe] = await file.exists();
    if (!existe) {
      return Response.json({ error: 'El archivo no se subió correctamente. Intenta de nuevo.' }, { status: 400 });
    }

    // 4. URL de descarga: se usa el patrón de token (firebaseStorageDownloadTokens),
    // el mismo mecanismo que getDownloadURL() del SDK cliente, en vez de una URL
    // firmada (getSignedUrl) porque las URLs firmadas V4 tienen un tope duro de
    // 7 días de expiración al firmarse con una clave de service account explícita
    // — inaceptable para un archivo que Reportes debe poder mostrar indefinidamente.
    // Esta URL con token NO depende de Storage Rules (se valida por posesión del
    // token, no por evaluación de reglas), así que storage.rules puede quedar
    // completamente cerrado sin romper la visualización en Reportes. El token se
    // agrega recién ahora (post-subida) porque la subida en sí ocurrió por PUT
    // directo a la URL firmada, que no setea metadata custom de Firebase.
    const downloadToken = randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: downloadToken } });
    const archivoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

    // 5. Crear el documento excusas (mismos campos que antes).
    const docRef = await adminDb.collection('excusas').add({
      evento_id: eventoId,
      codigo_empleado: codigoEmpleado,
      persona_id: personaDoc.id,
      nombre_completo: `${persona.nombres || ''} ${persona.apellidos || ''}`.trim(),
      correo_laboral: persona.correo_electronico || '',
      razon,
      archivo_url: archivoUrl,
      archivo_nombre: nombreArchivo,
      explicacion: String(explicacion).trim(),
      timestamp: FieldValue.serverTimestamp(),
    });

    return Response.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error('Error en POST /api/excusas:', err);
    return Response.json({ error: 'Ocurrió un error al procesar tu excusa. Intenta de nuevo.' }, { status: 500 });
  }
}
