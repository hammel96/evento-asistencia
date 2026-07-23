'use client';
import { db } from '@/lib/firebase';
import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, addDoc, doc, getDoc, query, orderBy, where, Timestamp } from 'firebase/firestore';

// Componente Registro
function RegistroView({ eventos }) {
  const [selectedEvento, setSelectedEvento] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [registroExitoso, setRegistroExitoso] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [personas, setPersonas] = useState([]);
  const [registrando, setRegistrando] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Cargar todas las personas al montar
  useEffect(() => {
    loadPersonas();
  }, []);

  // Limpiar escáner al desmontar
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(err => console.log(err));
      }
    };
  }, []);

  async function loadPersonas() {
    try {
      const personasSnap = await getDocs(collection(db, 'personas'));
      setPersonas(personasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error cargando personas:', error);
    }
  }

  // Personas asignadas al evento seleccionado (eventos sin personasAsignadas
  // -legacy, o creados antes de este campo- se tratan como "todas las personas",
  // que era el comportamiento de siempre).
  // useMemo es necesario aquí: sin él, .filter() crea un array nuevo en cada
  // render, y como personasDelEvento es dependencia del useEffect de búsqueda
  // más abajo, eso dispara el efecto en cada render -> setSearchResults ->
  // nuevo render -> nuevo array -> loop infinito ("Maximum update depth exceeded").
  const eventoSel = eventos.find(e => e.id === selectedEvento);
  const personasDelEvento = useMemo(() => {
    return eventoSel?.personasAsignadas
      ? personas.filter(p => eventoSel.personasAsignadas.includes(p.id))
      : personas;
  }, [personas, eventoSel]);

  // Buscar mientras escribe
  useEffect(() => {
    if (searchInput.trim() === '') {
      setSearchResults([]);
      return;
    }

    const term = searchInput.toLowerCase();
    const results = personasDelEvento.filter(p =>
      p.nombres?.toLowerCase().includes(term) ||
      p.apellidos?.toLowerCase().includes(term) ||
      p.codigo_empleado?.toString().includes(term) ||
      `${p.nombres} ${p.apellidos}`.toLowerCase().includes(term)
    ).slice(0, 5); // Máximo 5 resultados

    setSearchResults(results);
  }, [searchInput, personasDelEvento]);

  async function iniciarEscaner() {
    if (!selectedEvento) {
      alert('Selecciona un evento primero');
      return;
    }

    setShowScanner(true);

    // Esperar a que el div se renderice
    setTimeout(async () => {
      try {
        const Html5Qrcode = (await import('html5-qrcode')).Html5Qrcode;
        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            // QR escaneado exitosamente
            const qrCode = parseInt(decodedText);
            const persona = personasDelEvento.find(p => p.qr_code === qrCode);

            if (persona) {
              html5QrCode.stop();
              setShowScanner(false);
              setSelectedPersona(persona);
            } else {
              alert('Código QR no encontrado en la base de datos');
            }
          },
          (error) => {
            // Error silencioso mientras escanea
          }
        );
      } catch (err) {
        console.error('Error iniciando escáner:', err);
        alert('No se pudo acceder a la cámara');
        setShowScanner(false);
      }
    }, 100);
  }

  function cerrarEscaner() {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        setShowScanner(false);
      }).catch(err => console.log(err));
    } else {
      setShowScanner(false);
    }
  }

  async function registrarAsistencia() {
    if (!selectedPersona || !selectedEvento || registrando) return;

    setRegistrando(true);

    try {
      // Leer el evento para saber si está cerrado
      let eventoCerrado = false;
      const eventoSnap = await getDoc(doc(db, 'eventos', selectedEvento));
      if (eventoSnap.exists()) {
        eventoCerrado = !!eventoSnap.data().cerrado;
      }

      // Verificar si ya está registrado
      const asistenciasSnap = await getDocs(
        query(
          collection(db, 'asistencias'),
          where('persona_id', '==', selectedPersona.id),
          where('evento_id', '==', selectedEvento)
        )
      );

      if (!asistenciasSnap.empty) {
        alert('Esta persona ya registró asistencia a este evento');
        setSelectedPersona(null);
        setRegistrando(false);
        return;
      }

      // Registrar asistencia
      await addDoc(collection(db, 'asistencias'), {
        persona_id: selectedPersona.id,
        evento_id: selectedEvento,
        timestamp: Timestamp.now(),
        metodo_registro: showScanner ? 'qr' : 'texto',
        fueraDeFecha: eventoCerrado
      });

      // Mostrar éxito
      setRegistroExitoso({ persona: selectedPersona, fueraDeFecha: eventoCerrado });
      setSelectedPersona(null);
      setSearchInput('');
      setSearchResults([]);

      setTimeout(() => setRegistroExitoso(null), 3000);
    } catch (error) {
      console.error('Error al registrar:', error);
      alert('Error al registrar asistencia');
    }

    setRegistrando(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-[#004370]">Registro de Asistencia</h1>
          <p className="text-gray-500 mt-1">Escanea QR o busca por nombre/código</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-8">
        {/* Selector de Evento */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-t-4 border-[#4997d0]">
          <label className="block text-sm font-semibold text-[#004370] mb-3">Seleccionar Evento *</label>
          <select
            value={selectedEvento}
            onChange={(e) => setSelectedEvento(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900 font-medium"
          >
            <option value="">-- Selecciona un evento --</option>
            {eventos.map(e => (
              <option key={e.id} value={e.id} className="text-gray-900">
                {e.nombre} - {e.fecha}
              </option>
            ))}
          </select>
        </div>

        {selectedEvento && (
          <>
            {/* Búsqueda por Texto */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6 relative">
              <h2 className="text-xl font-bold text-[#004370] mb-4 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Buscar por Nombre o Código
              </h2>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Escribe nombre o código del empleado..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900 text-lg"
              />

              {/* Resultados de búsqueda */}
              {searchResults.length > 0 && (
                <div className="absolute left-6 right-6 mt-2 bg-white border-2 border-[#4997d0] rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                  {searchResults.map(persona => (
                    <button
                      key={persona.id}
                      onClick={() => {
                        setSelectedPersona(persona);
                        setSearchInput('');
                        setSearchResults([]);
                      }}
                      className="w-full p-4 hover:bg-[#4997d0] hover:bg-opacity-10 transition-colors border-b border-gray-100 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#4997d0] bg-opacity-20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#004370] font-bold">
                            {persona.nombres?.charAt(0)}{persona.apellidos?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-[#004370]">
                            {persona.nombres} {persona.apellidos}
                          </p>
                          <p className="text-sm text-gray-600">
                            Código: {persona.codigo_empleado} | {persona.department || 'Sin departamento'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Escaneo QR */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-[#004370] mb-4 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Escanear Código QR
              </h2>

              {!showScanner ? (
                <button
                  onClick={iniciarEscaner}
                  className="w-full bg-gradient-to-r from-[#004370] to-[#4997d0] text-white px-6 py-4 rounded-lg font-bold text-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  Abrir Escáner
                </button>
              ) : (
                <div className="space-y-4">
                  <div id="qr-reader" className="rounded-lg overflow-hidden"></div>
                  <button
                    onClick={cerrarEscaner}
                    className="w-full bg-[#d8222d] text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
                  >
                    Cerrar Escáner
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal de Confirmación */}
        {selectedPersona && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl transform scale-100 animate-pulse-once">
              <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6 rounded-t-2xl">
                <h3 className="text-2xl font-bold text-white text-center">Confirmar Asistencia</h3>
              </div>

              <div className="p-8">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-24 h-24 rounded-full bg-[#4997d0] bg-opacity-20 flex items-center justify-center mb-4">
                    <span className="text-[#004370] font-bold text-3xl">
                      {selectedPersona.nombres?.charAt(0)}{selectedPersona.apellidos?.charAt(0)}
                    </span>
                  </div>
                  <h4 className="text-2xl font-bold text-[#004370] text-center mb-2">
                    {selectedPersona.nombres} {selectedPersona.apellidos}
                  </h4>
                  <div className="space-y-1 text-center">
                    <p className="text-gray-600">
                      <span className="font-semibold">Código:</span> {selectedPersona.codigo_empleado}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Email:</span> {selectedPersona.correo_electronico}
                    </p>
                    {selectedPersona.department && (
                      <p className="text-gray-600">
                        <span className="font-semibold">Departamento:</span> {selectedPersona.department}
                      </p>
                    )}
                    {selectedPersona.manager && (
                      <p className="text-gray-600">
                        <span className="font-semibold">Manager:</span> {selectedPersona.manager}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedPersona(null)}
                    disabled={registrando}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={registrarAsistencia}
                    disabled={registrando}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#004370] to-[#4997d0] text-white rounded-lg font-bold hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                  >
                    {registrando ? 'Registrando...' : 'Registrar Asistencia'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mensaje de Éxito */}
        {registroExitoso && (
          <div className={`fixed bottom-8 right-8 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 z-50 ${registroExitoso.fueraDeFecha ? 'bg-[#4997d0]' : 'bg-green-500'}`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-bold text-lg">
                {registroExitoso.fueraDeFecha ? 'Registrado (fuera de fecha)' : '¡Asistencia registrada!'}
              </p>
              <p className="text-sm">{registroExitoso.persona.nombres} {registroExitoso.persona.apellidos}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Página Registro
export default function RegistroPage() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEventos();
  }, []);

  async function loadEventos() {
    try {
      const eventosSnap = await getDocs(query(collection(db, 'eventos'), orderBy('fecha', 'desc')));
      setEventos(eventosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
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

  return <RegistroView eventos={eventos} />;
}
