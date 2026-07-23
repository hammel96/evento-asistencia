import { adminDb } from '@/lib/firebase-admin';

// Solo lectura, solo los campos que la página pública de excusas necesita para
// decidir si mostrar el formulario. No expone el documento completo del evento.
// Necesario porque firestore.rules ya no tiene una regla pública de get() sobre
// eventos (se removió al migrar todo a esta API server-side con Admin SDK).
export async function GET(request, context) {
  try {
    const { eventoId } = await context.params;
    const snap = await adminDb.collection('eventos').doc(eventoId).get();

    if (!snap.exists) {
      return Response.json({ error: 'Evento no encontrado.' }, { status: 404 });
    }

    const data = snap.data();
    return Response.json({
      nombre: data.nombre || '',
      fecha: data.fecha || '',
      formularioExcusasAbierto: data.formularioExcusasAbierto !== false,
    });
  } catch (err) {
    console.error('Error en GET /api/eventos/[eventoId]:', err);
    return Response.json({ error: 'No se pudo cargar el evento.' }, { status: 500 });
  }
}
