import { adminDb, adminStorage } from '@/lib/firebase-admin';

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const EXTENSIONES_PERMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png'];
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10MB
const URL_EXPIRACION_MS = 10 * 60 * 1000; // 10 minutos

// Autoriza y prepara la subida directa del archivo a Storage (bypassa el
// límite de ~4.5MB de Vercel Functions que aplicaría si el archivo pasara
// por una API route). Repite aquí las mismas validaciones que antes se
// hacían en POST /api/excusas antes de aceptar el archivo, porque esta es
// ahora la única puerta antes de que el cliente pueda escribir en Storage.
export async function POST(request) {
  try {
    const body = await request.json();
    const eventoId = body?.evento_id;
    const codigoEmpleadoRaw = body?.codigo_empleado;
    const nombreArchivoRaw = body?.nombre_archivo;
    const tipoArchivo = body?.tipo_archivo;
    const tamanoArchivo = body?.tamano_archivo;

    if (!eventoId || !codigoEmpleadoRaw || !nombreArchivoRaw || !tipoArchivo || !tamanoArchivo) {
      return Response.json({ error: 'Faltan campos requeridos.' }, { status: 400 });
    }
    const codigoEmpleado = parseInt(codigoEmpleadoRaw, 10);
    if (Number.isNaN(codigoEmpleado)) {
      return Response.json({ error: 'Código de empleado inválido.' }, { status: 400 });
    }

    // 1. Evento: existe y sigue abierto.
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

    // 2. Persona: debe existir.
    const personasSnap = await adminDb
      .collection('personas')
      .where('codigo_empleado', '==', codigoEmpleado)
      .limit(1)
      .get();
    if (personasSnap.empty) {
      return Response.json({ error: 'Código no encontrado.' }, { status: 404 });
    }

    // 3. Validar archivo (tipo, extensión y tamaño) antes de autorizar nada.
    const nombreArchivo = String(nombreArchivoRaw);
    const puntoIdx = nombreArchivo.lastIndexOf('.');
    const extension = puntoIdx >= 0 ? nombreArchivo.slice(puntoIdx).toLowerCase() : '';
    if (!EXTENSIONES_PERMITIDAS.includes(extension) || !TIPOS_PERMITIDOS.includes(tipoArchivo)) {
      return Response.json({ error: 'Archivo inválido. Solo se permiten PDF, JPG o PNG.' }, { status: 400 });
    }
    const tamano = Number(tamanoArchivo);
    if (!Number.isFinite(tamano) || tamano > TAMANO_MAXIMO) {
      return Response.json({ error: 'El archivo supera el tamaño máximo de 10MB.' }, { status: 400 });
    }

    // 4. URL firmada de subida directa (PUT), de un solo uso conceptual:
    // fija el contentType exacto y expira en 10 minutos.
    const storagePath = `excusas/${eventoId}/${codigoEmpleado}_${Date.now()}_${nombreArchivo}`;
    const bucket = adminStorage.bucket();
    const file = bucket.file(storagePath);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + URL_EXPIRACION_MS,
      contentType: tipoArchivo,
    });

    return Response.json({ uploadUrl, filePath: storagePath });
  } catch (err) {
    console.error('Error en POST /api/excusas/upload-url:', err);
    return Response.json({ error: 'Ocurrió un error al preparar la subida. Intenta de nuevo.' }, { status: 500 });
  }
}
