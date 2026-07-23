import { adminDb } from '@/lib/firebase-admin';

// Solo lectura, solo devuelve los campos mínimos necesarios para autocompletar
// el formulario público de excusas — nunca el documento completo de personas
// (sin department, manager, correo_personal, hiring_date, etc.).
export async function GET(request, context) {
  try {
    const { codigo } = await context.params;
    const codigoEmpleado = parseInt(codigo, 10);
    if (Number.isNaN(codigoEmpleado)) {
      return Response.json({ error: 'Código inválido.' }, { status: 400 });
    }

    const snap = await adminDb
      .collection('personas')
      .where('codigo_empleado', '==', codigoEmpleado)
      .limit(1)
      .get();

    if (snap.empty) {
      return Response.json({ error: 'Código no encontrado.' }, { status: 404 });
    }

    const persona = snap.docs[0].data();
    return Response.json({
      nombre_completo: `${persona.nombres || ''} ${persona.apellidos || ''}`.trim(),
      correo_laboral: persona.correo_electronico || '',
    });
  } catch (err) {
    console.error('Error en GET /api/personas/[codigo]:', err);
    return Response.json({ error: 'No se pudo verificar el código.' }, { status: 500 });
  }
}
