'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

const RAZONES = [
  { value: 'estudios', label: 'Estudios / universidad' },
  { value: 'medico', label: 'Motivo médico / enfermedad' },
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'trabajo_sabado', label: 'Trabajo asignado / agendado el sábado' },
  { value: 'otro', label: 'Otro (excusa válida respaldada por papelería)' },
];

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const EXTENSIONES_PERMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png'];
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10MB

function archivoEsValido(archivo) {
  if (!archivo) return false;
  const nombre = archivo.name.toLowerCase();
  const extensionValida = EXTENSIONES_PERMITIDAS.some(ext => nombre.endsWith(ext));
  const tipoValido = TIPOS_PERMITIDOS.includes(archivo.type);
  return extensionValida && tipoValido && archivo.size <= TAMANO_MAXIMO;
}

export default function ExcusaPage() {
  const params = useParams();
  const eventoId = params.eventoId;

  const [loading, setLoading] = useState(true);
  const [evento, setEvento] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');

  const [codigoEmpleado, setCodigoEmpleado] = useState('');
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [personaEncontrada, setPersonaEncontrada] = useState(null);
  const [codigoError, setCodigoError] = useState('');
  const debounceRef = useRef(null);

  const [razon, setRazon] = useState('');
  const [explicacion, setExplicacion] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [archivoError, setArchivoError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!eventoId) return;
    async function cargarEvento() {
      try {
        const res = await fetch(`/api/eventos/${eventoId}`);
        if (res.status === 404) {
          setEvento(null);
        } else if (res.ok) {
          const data = await res.json();
          setEvento(data);
          setFormularioAbierto(data.formularioExcusasAbierto !== false);
        } else {
          setErrorGeneral('No se pudo cargar la información del evento. Intenta de nuevo más tarde.');
        }
      } catch (err) {
        console.error('Error cargando evento:', err);
        setErrorGeneral('No se pudo cargar la información del evento. Intenta de nuevo más tarde.');
      }
      setLoading(false);
    }
    cargarEvento();
  }, [eventoId]);

  // Búsqueda de código de empleado con debounce, vía API server-side
  useEffect(() => {
    setPersonaEncontrada(null);
    setCodigoError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const codigo = codigoEmpleado.trim();
    if (!codigo) return;

    debounceRef.current = setTimeout(async () => {
      setBuscandoCodigo(true);
      try {
        const res = await fetch(`/api/personas/${codigo}`);
        if (res.ok) {
          const data = await res.json();
          setPersonaEncontrada({ codigo, ...data });
        } else {
          setCodigoError('Código no encontrado');
        }
      } catch (err) {
        console.error('Error buscando código:', err);
        setCodigoError('No se pudo verificar el código. Intenta de nuevo.');
      }
      setBuscandoCodigo(false);
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [codigoEmpleado]);

  function handleArchivoChange(e) {
    const file = e.target.files[0] || null;
    setArchivo(null);
    setArchivoError('');
    setPreviewUrl(null);
    if (!file) return;

    if (!archivoEsValido(file)) {
      setArchivoError('Archivo inválido. Solo se permiten PDF, JPG o PNG de hasta 10MB.');
      e.target.value = '';
      return;
    }

    setArchivo(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;

    setErrorGeneral('');

    if (!personaEncontrada) {
      setCodigoError('Código no encontrado');
      return;
    }
    if (!razon) {
      setErrorGeneral('Selecciona una razón de la falta.');
      return;
    }
    if (!archivo || !archivoEsValido(archivo)) {
      setArchivoError('Debes adjuntar un archivo válido (PDF, JPG o PNG, hasta 10MB).');
      return;
    }

    setEnviando(true);

    try {
      // 1. Pedir una URL firmada de subida (valida evento/código/archivo en el
      // servidor antes de autorizar nada). El archivo en sí todavía no viaja.
      const urlRes = await fetch('/api/excusas/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento_id: eventoId,
          codigo_empleado: personaEncontrada.codigo,
          nombre_archivo: archivo.name,
          tipo_archivo: archivo.type,
          tamano_archivo: archivo.size,
        }),
      });
      const urlData = await urlRes.json();

      if (!urlRes.ok) {
        if (urlData.code === 'FORM_CLOSED') {
          setFormularioAbierto(false);
        } else {
          setErrorGeneral(urlData.error || 'Ocurrió un error al enviar tu excusa. Intenta de nuevo.');
        }
        setEnviando(false);
        return;
      }

      // 2. Subir el archivo directo a Storage con la URL firmada — no pasa
      // por esta app, así que no hay límite de ~4.5MB.
      const subida = await fetch(urlData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': archivo.type },
        body: archivo,
      });
      if (!subida.ok) {
        setErrorGeneral('Ocurrió un error al subir el archivo. Intenta de nuevo.');
        setEnviando(false);
        return;
      }

      // 3. Con el archivo ya en Storage, crear el registro de la excusa.
      const res = await fetch('/api/excusas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento_id: eventoId,
          codigo_empleado: personaEncontrada.codigo,
          razon,
          explicacion: explicacion.trim(),
          filePath: urlData.filePath,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'FORM_CLOSED') {
          setFormularioAbierto(false);
        } else {
          setErrorGeneral(data.error || 'Ocurrió un error al enviar tu excusa. Intenta de nuevo.');
        }
        setEnviando(false);
        return;
      }

      setEnviado(true);
    } catch (err) {
      console.error('Error enviando excusa:', err);
      setErrorGeneral('Ocurrió un error al enviar tu excusa. Intenta de nuevo.');
    }
    setEnviando(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#4997d0] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#004370] font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#004370] to-[#4997d0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-[#004370] mb-2">Evento no encontrado</h1>
          <p className="text-gray-600">El enlace que abriste no corresponde a ningún evento válido.</p>
        </div>
      </div>
    );
  }

  if (!formularioAbierto) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#004370] to-[#4997d0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#004370] mb-2">Formulario no disponible</h1>
          <p className="text-gray-600">
            Este formulario ya no está disponible para este evento. Contacta a Recursos Humanos si necesitas enviar tu excusa.
          </p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#004370] to-[#4997d0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#004370] mb-2">¡Excusa enviada!</h1>
          <p className="text-gray-600">Tu justificación para <span className="font-semibold">{evento.nombre}</span> fue enviada correctamente. Recursos Humanos la revisará.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#004370] to-[#4997d0] flex items-center justify-center p-4 py-10">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/iconlogo.svg" alt="Icon BPO" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#004370]">Enviar Excusa</h1>
          <p className="text-gray-600 mt-2">{evento.nombre} · {evento.fecha}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Código de Empleado</label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={codigoEmpleado}
              onChange={(e) => setCodigoEmpleado(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent"
              placeholder="Ej: 12345"
            />
            {buscandoCodigo && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
            {codigoError && !buscandoCodigo && <p className="text-xs text-[#d8222d] mt-1">{codigoError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre completo</label>
            <input
              type="text"
              readOnly
              value={personaEncontrada?.nombre_completo || ''}
              className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-lg text-gray-600"
              placeholder="Se completa automáticamente"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Correo laboral</label>
            <input
              type="text"
              readOnly
              value={personaEncontrada?.correo_laboral || ''}
              className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-lg text-gray-600"
              placeholder="Se completa automáticamente"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Razón de la falta</label>
            <select
              required
              value={razon}
              onChange={(e) => setRazon(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
            >
              <option value="">-- Selecciona una razón --</option>
              {RAZONES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Papelería (PDF, JPG o PNG, máx. 10MB)</label>
            <input
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleArchivoChange}
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#004370] file:text-white hover:file:bg-[#4997d0]"
            />
            {archivoError && <p className="text-xs text-[#d8222d] mt-1">{archivoError}</p>}
            {previewUrl && (
              <img src={previewUrl} alt="Vista previa" className="mt-3 max-h-40 rounded-lg border border-gray-200" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Explica la situación (opcional)</label>
            <textarea
              rows={3}
              value={explicacion}
              onChange={(e) => setExplicacion(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent resize-none"
              placeholder="Detalles adicionales (opcional)..."
            />
          </div>

          {errorGeneral && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {errorGeneral}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando || !personaEncontrada}
            className="w-full bg-[#004370] text-white py-3 rounded-lg font-semibold hover:bg-[#003357] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {enviando && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {enviando ? 'Enviando...' : 'Enviar Excusa'}
          </button>
        </form>
      </div>
    </div>
  );
}
