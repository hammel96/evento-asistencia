import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const EXTENSIONES_PERMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png'];
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10MB
const RAZONES_VALIDAS = ['estudios', 'medico', 'vacaciones', 'trabajo_sabado', 'otro'];

export async function POST(request) {
  try {
    const formData = await request.formData();
    const eventoId = formData.get('evento_id');
    const codigoEmpleadoRaw = formData.get('codigo_empleado');
    const razon = formData.get('razon');
    const explicacion = formData.get('explicacion') || '';
    const archivo = formData.get('archivo');

    if (!eventoId || !codigoEmpleadoRaw || !razon || !archivo) {
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

    // 3. Validar archivo en el servidor (no confiar en el accept del input).
    const nombreArchivo = archivo.name || 'archivo';
    const puntoIdx = nombreArchivo.lastIndexOf('.');
    const extension = puntoIdx >= 0 ? nombreArchivo.slice(puntoIdx).toLowerCase() : '';
    if (!EXTENSIONES_PERMITIDAS.includes(extension) || !TIPOS_PERMITIDOS.includes(archivo.type)) {
      return Response.json({ error: 'Archivo inválido. Solo se permiten PDF, JPG o PNG.' }, { status: 400 });
    }
    if (archivo.size > TAMANO_MAXIMO) {
      return Response.json({ error: 'El archivo supera el tamaño máximo de 10MB.' }, { status: 400 });
    }

    // 4. Subir a Storage con Admin SDK (ignora Storage Rules por completo).
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const storagePath = `excusas/${eventoId}/${codigoEmpleado}_${Date.now()}_${nombreArchivo}`;
    const bucket = adminStorage.bucket();
    const file = bucket.file(storagePath);

    // 5. URL de descarga: se usa el patrón de token (firebaseStorageDownloadTokens),
    // el mismo mecanismo que getDownloadURL() del SDK cliente, en vez de una URL
    // firmada (getSignedUrl) porque las URLs firmadas V4 tienen un tope duro de
    // 7 días de expiración al firmarse con una clave de service account explícita
    // — inaceptable para un archivo que Reportes debe poder mostrar indefinidamente.
    // Esta URL con token NO depende de Storage Rules (se valida por posesión del
    // token, no por evaluación de reglas), así que storage.rules puede quedar
    // completamente cerrado sin romper la visualización en Reportes.
    const downloadToken = randomUUID();
    await file.save(buffer, {
      metadata: {
        contentType: archivo.type,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });
    const archivoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;

    // 6. Crear el documento excusas (mismos campos que antes).
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
