'use client';
import { db } from '@/lib/firebase';
import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, Timestamp, where, updateDoc } from 'firebase/firestore';

// Componente Dashboard
function DashboardView({ personas, eventos, filteredPersonas, searchTerm, setSearchTerm, setShowEventModal, setShowPersonaModal, deleteEvento, generarYDescargarQR, generarQRTodos, sendQR, setShowImportModal }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sendingIds, setSendingIds] = useState(new Set());

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const visible = filteredPersonas.slice(0, 50);
    if (selectedIds.size === visible.length && visible.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map(p => p.id)));
    }
  }

  async function handleSendQR(ids) {
    setSendingIds(new Set(ids));
    await sendQR(personas.filter(p => ids.includes(p.id)));
    setSendingIds(new Set());
    setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
  }

  return (
    <div>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-[#004370]">Dashboard Admin</h1>
          <p className="text-gray-500 mt-1">Gestión de eventos y personal</p>
        </div>
      </header>

      <div className="p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#4997d0]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Personas</p>
                <p className="text-3xl font-bold text-[#004370] mt-1">{personas.length}</p>
              </div>
              <div className="w-12 h-12 bg-[#4997d0] bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[#4997d0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#d8222d]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Eventos Activos</p>
                <p className="text-3xl font-bold text-[#004370] mt-1">{eventos.length}</p>
              </div>
              <div className="w-12 h-12 bg-[#d8222d] bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[#d8222d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#004370]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Activos</p>
                <p className="text-3xl font-bold text-[#004370] mt-1">{personas.filter(p => p.activo).length}</p>
              </div>
              <div className="w-12 h-12 bg-[#004370] bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[#004370]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Eventos */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Eventos</h2>
                <button
                  onClick={() => setShowEventModal(true)}
                  className="bg-white text-[#004370] px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo Evento
                </button>
              </div>
            </div>
            <div className="p-6 max-h-64 overflow-y-auto">
              {eventos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>No hay eventos creados</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {eventos.map(e => (
                    <div key={e.id} className="p-4 border border-gray-200 rounded-lg hover:border-[#4997d0] transition-colors group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[#004370] truncate">{e.nombre}</h3>
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {e.fecha}
                          </p>
                        </div>
                        <button onClick={() => deleteEvento(e.id)} className="opacity-0 group-hover:opacity-100 text-[#d8222d] hover:bg-red-50 p-1.5 rounded transition-all ml-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Personas */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <h2 className="text-xl font-bold text-white flex-1 min-w-0">Personas ({filteredPersonas.length})</h2>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => handleSendQR([...selectedIds])}
                    disabled={sendingIds.size > 0}
                    className="bg-green-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-2 text-sm disabled:opacity-60"
                  >
                    {sendingIds.size > 0 ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                    Enviar QR ({selectedIds.size})
                  </button>
                )}
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-white bg-opacity-20 text-white px-3 py-2 rounded-lg font-medium hover:bg-opacity-30 transition-colors flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Importar CSV
                </button>
                <button onClick={() => generarQRTodos()} className="bg-white text-[#004370] px-3 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar Todos
                </button>
                <button onClick={() => setShowPersonaModal(true)} className="bg-white text-[#004370] px-3 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar
                </button>
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={filteredPersonas.slice(0, 50).length > 0 && selectedIds.size === filteredPersonas.slice(0, 50).length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded text-[#004370] border-gray-300 focus:ring-[#4997d0]"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-gray-500 text-xs uppercase tracking-wide font-semibold">Código</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-xs uppercase tracking-wide font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-xs uppercase tracking-wide font-semibold">Estado Email</th>
                    <th className="px-4 py-3 text-left text-gray-500 text-xs uppercase tracking-wide font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPersonas.slice(0, 50).map(p => (
                    <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(p.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 rounded text-[#004370] border-gray-300 focus:ring-[#4997d0]"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.codigo_empleado}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#4997d0] bg-opacity-20 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#004370] font-bold text-xs">{p.nombres?.charAt(0)}{p.apellidos?.charAt(0)}</span>
                          </div>
                          <span className="font-medium text-[#004370] truncate max-w-[200px]">{p.nombres} {p.apellidos}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.qr_enviado ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                            ✅ {p.fecha_envio ? new Date(p.fecha_envio.seconds * 1000).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'Enviado'}
                          </span>
                        ) : (
                          <span className="text-xs text-yellow-600 font-medium">⏳ Pendiente</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSendQR([p.id])}
                            disabled={sendingIds.has(p.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#004370] text-white hover:bg-[#4997d0] transition-colors disabled:opacity-50"
                          >
                            {sendingIds.has(p.id) ? (
                              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            )}
                            {p.qr_enviado ? 'Reenviar' : 'Enviar'}
                          </button>
                          <button
                            onClick={() => generarYDescargarQR(p)}
                            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                            title="Descargar QR"
                          >
                            <svg className="w-4 h-4 text-[#004370]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.activo ? 'bg-green-500' : 'bg-gray-300'}`} title={p.activo ? 'Activo' : 'Inactivo'} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPersonas.length > 50 && (
                <p className="text-center text-gray-400 text-sm p-4">Mostrando 50 de {filteredPersonas.length} resultados</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  // Buscar mientras escribe
  useEffect(() => {
    if (searchInput.trim() === '') {
      setSearchResults([]);
      return;
    }

    const term = searchInput.toLowerCase();
    const results = personas.filter(p => 
      p.nombres?.toLowerCase().includes(term) ||
      p.apellidos?.toLowerCase().includes(term) ||
      p.codigo_empleado?.toString().includes(term) ||
      `${p.nombres} ${p.apellidos}`.toLowerCase().includes(term)
    ).slice(0, 5); // Máximo 5 resultados

    setSearchResults(results);
  }, [searchInput, personas]);

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
            const persona = personas.find(p => p.qr_code === qrCode);
            
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
        metodo_registro: showScanner ? 'qr' : 'texto'
      });

      // Mostrar éxito
      setRegistroExitoso(selectedPersona);
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
          <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 z-50">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-bold text-lg">¡Asistencia registrada!</p>
              <p className="text-sm">{registroExitoso.nombres} {registroExitoso.apellidos}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente Reportes
function ReportesView({ eventos, todasPersonas }) {
  const [selectedEvento, setSelectedEvento] = useState('');
  const [asistencias, setAsistencias] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState('asistentes');
  const [filtroDept, setFiltroDept] = useState('');
  const [filtroManager, setFiltroManager] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!selectedEvento) { setAsistencias([]); return; }
    setLoadingData(true);
    getDocs(query(collection(db, 'asistencias'), where('evento_id', '==', selectedEvento)))
      .then(snap => {
        setAsistencias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingData(false);
      })
      .catch(() => setLoadingData(false));
  }, [selectedEvento]);

  const asistentesMap = new Map(asistencias.map(a => [a.persona_id, a]));

  const departamentos = [...new Set(todasPersonas.map(p => p.department).filter(Boolean))].sort();
  const managers = [...new Set(todasPersonas.map(p => p.manager).filter(Boolean))].sort();

  const personasFiltradas = todasPersonas.filter(p => {
    if (filtroDept && p.department !== filtroDept) return false;
    if (filtroManager && p.manager !== filtroManager) return false;
    if (busqueda) {
      const term = busqueda.toLowerCase();
      if (!`${p.nombres} ${p.apellidos}`.toLowerCase().includes(term) && !p.codigo_empleado?.toString().includes(term)) return false;
    }
    return true;
  });

  const asistentesLista = personasFiltradas
    .filter(p => asistentesMap.has(p.id))
    .map(p => ({ ...p, asistencia: asistentesMap.get(p.id) }));

  const ausentesLista = personasFiltradas.filter(p => !asistentesMap.has(p.id));

  const totalPersonas = todasPersonas.length;
  const totalAsistentes = asistencias.length;
  const totalAusentes = totalPersonas - totalAsistentes;
  const porcentaje = totalPersonas > 0 ? ((totalAsistentes / totalPersonas) * 100).toFixed(1) : 0;

  function formatTimestamp(ts) {
    if (!ts) return '-';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  function exportarCSV() {
    const eventoNombre = eventos.find(e => e.id === selectedEvento)?.nombre || 'Evento';
    const BOM = '\uFEFF';
    let csv, filename;

    if (activeTab === 'asistentes') {
      const rows = asistentesLista.map(p => [
        p.codigo_empleado,
        `"${p.nombres} ${p.apellidos}"`,
        `"${p.department || ''}"`,
        `"${p.manager || ''}"`,
        formatTimestamp(p.asistencia?.timestamp),
        p.asistencia?.metodo_registro === 'qr' ? 'QR' : 'Texto'
      ]);
      csv = BOM + ['Código,Nombre,Departamento,Manager,Hora de Registro,Método', ...rows.map(r => r.join(','))].join('\n');
      filename = `Asistentes_${eventoNombre}.csv`;
    } else {
      const rows = ausentesLista.map(p => [
        p.codigo_empleado,
        `"${p.nombres} ${p.apellidos}"`,
        `"${p.department || ''}"`,
        `"${p.manager || ''}"`
      ]);
      csv = BOM + ['Código,Nombre,Departamento,Manager', ...rows.map(r => r.join(','))].join('\n');
      filename = `Ausentes_${eventoNombre}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  return (
    <div>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-[#004370]">Reportes</h1>
          <p className="text-gray-500 mt-1">Análisis de asistencia por evento</p>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Selector de Evento */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <label className="block text-sm font-semibold text-[#004370] mb-3">Seleccionar Evento</label>
          <select
            value={selectedEvento}
            onChange={e => setSelectedEvento(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900 font-medium"
          >
            <option value="">-- Selecciona un evento --</option>
            {eventos.map(e => (
              <option key={e.id} value={e.id}>{e.nombre} - {e.fecha}</option>
            ))}
          </select>
        </div>

        {selectedEvento && (
          <>
            {loadingData ? (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-4 border-[#4997d0] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#004370]">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Total Empleados</p>
                    <p className="text-3xl font-bold text-[#004370] mt-1">{totalPersonas}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#4997d0]">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Asistentes</p>
                    <p className="text-3xl font-bold text-[#004370] mt-1">{totalAsistentes}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-[#d8222d]">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Ausentes</p>
                    <p className="text-3xl font-bold text-[#004370] mt-1">{totalAusentes}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">% Asistencia</p>
                    <p className="text-3xl font-bold text-[#004370] mt-1">{porcentaje}%</p>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-green-500 rounded-full transition-all duration-500" style={{ width: `${porcentaje}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Filtros */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-xs font-semibold text-[#004370] mb-4 uppercase tracking-wide">Filtros</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Departamento</label>
                      <select
                        value={filtroDept}
                        onChange={e => setFiltroDept(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                      >
                        <option value="">Todos</option>
                        {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Manager</label>
                      <select
                        value={filtroManager}
                        onChange={e => setFiltroManager(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                      >
                        <option value="">Todos</option>
                        {managers.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Buscar persona</label>
                      <input
                        type="text"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Nombre o código..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Tabs + Tabla */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="flex border-b border-gray-200">
                    <button
                      onClick={() => setActiveTab('asistentes')}
                      className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                        activeTab === 'asistentes'
                          ? 'bg-[#004370] text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Asistentes ({asistentesLista.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('ausentes')}
                      className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                        activeTab === 'ausentes'
                          ? 'bg-[#d8222d] text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Ausentes ({ausentesLista.length})
                    </button>
                  </div>

                  <div className="px-4 py-3 border-b border-gray-100 flex justify-end">
                    <button
                      onClick={exportarCSV}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Exportar Excel
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    {activeTab === 'asistentes' ? (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-3 text-left">Código</th>
                            <th className="px-4 py-3 text-left">Nombre</th>
                            <th className="px-4 py-3 text-left">Departamento</th>
                            <th className="px-4 py-3 text-left">Manager</th>
                            <th className="px-4 py-3 text-left">Hora</th>
                            <th className="px-4 py-3 text-left">Método</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {asistentesLista.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-gray-400">Sin resultados para los filtros aplicados</td>
                            </tr>
                          ) : asistentesLista.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-mono text-gray-500 text-xs">{p.codigo_empleado}</td>
                              <td className="px-4 py-3 font-medium text-[#004370]">{p.nombres} {p.apellidos}</td>
                              <td className="px-4 py-3 text-gray-600">{p.department || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.manager || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{formatTimestamp(p.asistencia?.timestamp)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  p.asistencia?.metodo_registro === 'qr'
                                    ? 'bg-[#4997d0] bg-opacity-10 text-[#004370]'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {p.asistencia?.metodo_registro === 'qr' ? 'QR' : 'Texto'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-3 text-left">Código</th>
                            <th className="px-4 py-3 text-left">Nombre</th>
                            <th className="px-4 py-3 text-left">Departamento</th>
                            <th className="px-4 py-3 text-left">Manager</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {ausentesLista.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-center py-12 text-gray-400">Sin ausentes para los filtros aplicados</td>
                            </tr>
                          ) : ausentesLista.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-mono text-gray-500 text-xs">{p.codigo_empleado}</td>
                              <td className="px-4 py-3 font-medium text-[#004370]">{p.nombres} {p.apellidos}</td>
                              <td className="px-4 py-3 text-gray-600">{p.department || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.manager || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Componente Importar CSV
function ImportCSVModal({ show, onClose, onImport }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [sendQRAfter, setSendQRAfter] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);

  function downloadPlantilla() {
    const BOM = '\uFEFF';
    const csv = BOM + [
      'codigo_empleado,nombres,apellidos,correo_electronico,department,manager,hiring_date',
      '12345,Juan,Perez,juan.perez@empresa.com,Tecnología,Maria Garcia,2024-01-15',
    ].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'plantilla_empleados.csv';
    link.click();
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
      else current += char;
    }
    result.push(current);
    return result;
  }

  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').trim().replace(/"/g, '')]));
    }).filter(row => row.codigo_empleado || row.nombres);
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const rows = parseCSV(evt.target.result);
        if (rows.length === 0) { setError('No se encontraron datos en el archivo'); return; }
        setPreview(rows.slice(0, 5));
      } catch {
        setError('Error al leer el archivo CSV');
      }
    };
    reader.readAsText(f, 'utf-8');
  }

  async function handleImport() {
    if (!file || importing) return;
    setImporting(true);
    setError('');
    try {
      const reader = new FileReader();
      reader.onload = async evt => {
        try {
          const allRows = parseCSV(evt.target.result);
          const result = await onImport(allRows, sendQRAfter);
          setImportResult(result);
        } catch (err) {
          setError('Error durante la importación: ' + err.message);
        }
        setImporting(false);
      };
      reader.readAsText(file, 'utf-8');
    } catch (err) {
      setError(err.message);
      setImporting(false);
    }
  }

  function handleClose() {
    setFile(null);
    setPreview([]);
    setSendQRAfter(false);
    setError('');
    setImportResult(null);
    onClose();
  }

  if (!show) return null;

  const PREVIEW_COLS = ['codigo_empleado', 'nombres', 'apellidos', 'correo_electronico', 'department'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6 rounded-t-xl flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold text-white">Importar Personas desde CSV</h3>
          <button onClick={handleClose} className="text-white hover:text-gray-300 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {importResult ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-[#004370] mb-2">¡Importación completada!</h4>
              <p className="text-gray-600">{importResult.created} personas importadas</p>
              {importResult.emailsSent > 0 && <p className="text-green-600 mt-1">{importResult.emailsSent} QRs enviados por correo</p>}
              {importResult.emailsFailed > 0 && <p className="text-red-500 mt-1">{importResult.emailsFailed} correos fallaron</p>}
              <button onClick={handleClose} className="mt-6 px-6 py-2 bg-[#004370] text-white rounded-lg hover:bg-[#4997d0] transition-colors">
                Cerrar
              </button>
            </div>
          ) : (
            <>
              {/* Descargar plantilla */}
              <div className="border-2 border-dashed border-[#4997d0] border-opacity-40 rounded-xl p-5 bg-blue-50 bg-opacity-30">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#004370] bg-opacity-10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#004370]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#004370] text-sm mb-1">¿Primera vez importando?</p>
                    <p className="text-gray-500 text-xs mb-3">Descarga la plantilla con los campos requeridos y rellénala con los datos.</p>
                    <button onClick={downloadPlantilla} className="flex items-center gap-2 bg-[#004370] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#4997d0] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Descargar Plantilla CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Subir archivo */}
              <div>
                <label className="block text-sm font-semibold text-[#004370] mb-2">Subir archivo CSV</label>
                <label className="flex items-center gap-3 border-2 border-gray-300 rounded-xl p-4 cursor-pointer hover:border-[#4997d0] transition-colors">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    {file ? (
                      <p className="text-[#004370] font-medium truncate">{file.name}</p>
                    ) : (
                      <p className="text-gray-400">Haz clic para seleccionar un archivo .csv</p>
                    )}
                  </div>
                  <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-[#004370] mb-2">Vista previa ({preview.length} de {file ? 'N' : '?'} filas)</p>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs min-w-[500px]">
                      <thead className="bg-gray-50">
                        <tr>
                          {PREVIEW_COLS.map(col => (
                            <th key={col} className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {PREVIEW_COLS.map(col => (
                              <td key={col} className="px-3 py-2 text-gray-700 max-w-[120px] truncate">{row[col] || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Opción enviar QR */}
              <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={sendQRAfter}
                  onChange={e => setSendQRAfter(e.target.checked)}
                  className="w-4 h-4 rounded text-[#004370] border-gray-300 focus:ring-[#4997d0]"
                />
                <div>
                  <p className="font-medium text-[#004370] text-sm">Enviar QR por correo después de importar</p>
                  <p className="text-gray-400 text-xs mt-0.5">Envía automáticamente el código QR a cada empleado importado</p>
                </div>
              </label>

              {error && <p className="text-[#d8222d] text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={handleClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || preview.length === 0 || importing}
                  className="flex-1 px-4 py-2.5 bg-[#004370] text-white rounded-lg hover:bg-[#4997d0] transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {importing ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente Principal
export default function AdminDashboard() {
  const [personas, setPersonas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [eventoForm, setEventoForm] = useState({ nombre: '', fecha: '' });
  const [personaForm, setPersonaForm] = useState({
    codigo_empleado: '',
    nombres: '',
    apellidos: '',
    correo_electronico: '',
    qr_code: '',
    activo: true,
    department: '',
    manager: '',
    hiring_date: '',
    enviarQR: false
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const personasSnap = await getDocs(query(collection(db, 'personas'), orderBy('nombres')));
      const eventosSnap = await getDocs(query(collection(db, 'eventos'), orderBy('fecha', 'desc')));
      
      setPersonas(personasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setEventos(eventosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  }

  async function createEvento(e) {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'eventos'), {
        nombre: eventoForm.nombre,
        fecha: eventoForm.fecha,
        created_at: Timestamp.now()
      });
      setEventoForm({ nombre: '', fecha: '' });
      setShowEventModal(false);
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear evento');
    }
  }

  async function deleteEvento(id) {
    if (!confirm('¿Eliminar este evento?')) return;
    try {
      await deleteDoc(doc(db, 'eventos', id));
      loadData();
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function sendQR(personasData) {
    try {
      const res = await fetch('/api/send-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personas: personasData }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const now = Timestamp.now();
      await Promise.all(
        data.results
          .filter(r => r.success)
          .map(r => updateDoc(doc(db, 'personas', r.id), { qr_enviado: true, fecha_envio: now }))
      );

      await loadData();

      const failed = data.results.filter(r => !r.success).length;
      const ok = data.results.filter(r => r.success).length;
      if (failed > 0) alert(`${ok} QR(s) enviados. ${failed} fallaron.`);
      else alert(`✅ ${ok} QR(s) enviados exitosamente`);
    } catch (err) {
      console.error('Error enviando QR:', err);
      alert('Error al enviar QRs: ' + err.message);
    }
  }

  async function importPersonas(rows, shouldSendQR) {
    const createdPersonas = [];
    for (const row of rows) {
      try {
        const codigo = parseInt(row.codigo_empleado) || 0;
        const docRef = await addDoc(collection(db, 'personas'), {
          codigo_empleado: codigo,
          nombres: row.nombres || '',
          apellidos: row.apellidos || '',
          correo_electronico: row.correo_electronico || '',
          qr_code: codigo,
          activo: true,
          department: row.department || '',
          manager: row.manager || '',
          hiring_date: row.hiring_date || '',
        });
        createdPersonas.push({
          id: docRef.id,
          codigo_empleado: codigo,
          nombres: row.nombres || '',
          apellidos: row.apellidos || '',
          correo_electronico: row.correo_electronico || '',
          qr_code: codigo,
        });
      } catch (err) {
        console.error('Error importando fila:', row, err);
      }
    }

    await loadData();

    let emailsSent = 0;
    let emailsFailed = 0;
    if (shouldSendQR && createdPersonas.length > 0) {
      try {
        const res = await fetch('/api/send-qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personas: createdPersonas }),
        });
        const data = await res.json();
        const now = Timestamp.now();
        const successIds = data.results?.filter(r => r.success).map(r => r.id) || [];
        emailsSent = successIds.length;
        emailsFailed = (data.results?.length || 0) - emailsSent;
        await Promise.all(
          successIds.map(id => updateDoc(doc(db, 'personas', id), { qr_enviado: true, fecha_envio: now }))
        );
        await loadData();
      } catch (err) {
        console.error('Error enviando QRs tras importar:', err);
      }
    }

    return { created: createdPersonas.length, emailsSent, emailsFailed };
  }

  async function createPersona(e) {
    e.preventDefault();
    try {
      const codigo = parseInt(personaForm.codigo_empleado);
      const docRef = await addDoc(collection(db, 'personas'), {
        codigo_empleado: codigo,
        nombres: personaForm.nombres,
        apellidos: personaForm.apellidos,
        correo_electronico: personaForm.correo_electronico,
        qr_code: parseInt(personaForm.qr_code) || codigo,
        activo: personaForm.activo,
        department: personaForm.department,
        manager: personaForm.manager,
        hiring_date: personaForm.hiring_date,
      });
      const enviarQR = personaForm.enviarQR;
      setPersonaForm({
        codigo_empleado: '',
        nombres: '',
        apellidos: '',
        correo_electronico: '',
        qr_code: '',
        activo: true,
        department: '',
        manager: '',
        hiring_date: '',
        enviarQR: false,
      });
      setShowPersonaModal(false);
      await loadData();
      if (enviarQR) {
        const nuevaPersona = personas.find(p => p.id === docRef.id) || {
          id: docRef.id,
          codigo_empleado: codigo,
          nombres: personaForm.nombres,
          apellidos: personaForm.apellidos,
          correo_electronico: personaForm.correo_electronico,
          qr_code: parseInt(personaForm.qr_code) || codigo,
        };
        await sendQR([nuevaPersona]);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear persona');
    }
  }

  const filteredPersonas = personas.filter(p => 
    `${p.nombres} ${p.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo_empleado?.toString().includes(searchTerm)
  );
async function generarYDescargarQR(persona) {
  try {
    const QRCode = (await import('qrcode')).default;
    
    const qrDataUrl = await QRCode.toDataURL(persona.qr_code.toString(), {
      width: 400,
      margin: 2,
      color: {
        dark: '#004370',
        light: '#FFFFFF'
      }
    });

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${persona.nombres}_${persona.apellidos}_${persona.codigo_empleado}.png`;
    link.click();
  } catch (error) {
    console.error('Error generando QR:', error);
    alert('Error al generar código QR');
  }
}

async function generarQRTodos() {
  if (!confirm(`¿Generar códigos QR para ${personas.length} personas? Esto puede tardar un momento.`)) {
    return;
  }

  const JSZip = (await import('jszip')).default;
  const QRCode = (await import('qrcode')).default;
  const zip = new JSZip();

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i];
    
    try {
      const qrBuffer = await QRCode.toBuffer(persona.qr_code.toString(), {
        width: 400,
        margin: 2,
        color: {
          dark: '#004370',
          light: '#FFFFFF'
        }
      });

      zip.file(`QR_${persona.codigo_empleado}_${persona.nombres}_${persona.apellidos}.png`, qrBuffer);
    } catch (error) {
      console.error(`Error con ${persona.nombres}:`, error);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = 'QR_Codes_Todos.zip';
  link.click();

  alert('¡Códigos QR generados exitosamente!');
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

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Botón hamburguesa (solo móvil) */}
      <button
        onClick={() => setSidebarOpen(true)}
        className={`fixed top-4 left-4 z-50 lg:hidden bg-[#004370] text-white p-2 rounded-lg shadow-lg transition-opacity duration-200 ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        aria-label="Abrir menú"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#004370] text-white flex-shrink-0 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex-1 flex flex-col items-center">
            <img src="/iconlogo2.svg" alt="Icon BPO" width={48} height={48} className="mb-4" />
            <h2 className="text-center font-bold text-lg">Sistema de Asistencia</h2>
          </div>
          {/* Botón cerrar (solo móvil) */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:text-gray-300 self-start"
            aria-label="Cerrar menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="mt-8">
          <button
            onClick={() => { setCurrentView('dashboard'); setSidebarOpen(false); }}
            className={`w-full px-6 py-3 flex items-center gap-3 transition-colors ${
              currentView === 'dashboard'
                ? 'bg-[#4997d0] border-l-4 border-[#d8222d]'
                : 'hover:bg-[#4997d0] hover:bg-opacity-20'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Dashboard
          </button>

          <button
            onClick={() => { setCurrentView('registro'); setSidebarOpen(false); }}
            className={`w-full px-6 py-3 flex items-center gap-3 transition-colors ${
              currentView === 'registro'
                ? 'bg-[#4997d0] border-l-4 border-[#d8222d]'
                : 'hover:bg-[#4997d0] hover:bg-opacity-20'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Registro Asistencia
          </button>

          <button
            onClick={() => { setCurrentView('reportes'); setSidebarOpen(false); }}
            className={`w-full px-6 py-3 flex items-center gap-3 transition-colors ${
              currentView === 'reportes'
                ? 'bg-[#4997d0] border-l-4 border-[#d8222d]'
                : 'hover:bg-[#4997d0] hover:bg-opacity-20'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Reportes
          </button>
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex gap-2 justify-center">
            <div className="w-2 h-2 rounded-full bg-[#d8222d]"></div>
            <div className="w-2 h-2 rounded-full bg-[#4997d0]"></div>
            <div className="w-2 h-2 rounded-full bg-white"></div>
          </div>
        </div>
      </aside>

      <div className="flex-1 overflow-auto">
        {currentView === 'dashboard' && (
          <DashboardView
            personas={personas}
            eventos={eventos}
            filteredPersonas={filteredPersonas}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            setShowEventModal={setShowEventModal}
            setShowPersonaModal={setShowPersonaModal}
            deleteEvento={deleteEvento}
            generarYDescargarQR={generarYDescargarQR}
            generarQRTodos={generarQRTodos}
            sendQR={sendQR}
            setShowImportModal={setShowImportModal}
          />
        )}
        {currentView === 'registro' && <RegistroView eventos={eventos} />}
        {currentView === 'reportes' && <ReportesView eventos={eventos} todasPersonas={personas} />}
      </div>

      <ImportCSVModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={importPersonas}
      />

      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6 rounded-t-xl">
              <h3 className="text-xl font-bold text-white">Crear Nuevo Evento</h3>
            </div>
            <form onSubmit={createEvento} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Evento</label>
                <input
                  type="text"
                  required
                  value={eventoForm.nombre}
                  onChange={(e) => setEventoForm({...eventoForm, nombre: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  placeholder="Ej: Capacitación Q2 2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
                <input
                  type="date"
                  required
                  value={eventoForm.fecha}
                  onChange={(e) => setEventoForm({...eventoForm, fecha: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#004370] text-white rounded-lg hover:bg-[#4997d0] transition-colors"
                >
                  Crear Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPersonaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl my-8">
            <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6 rounded-t-xl">
              <h3 className="text-xl font-bold text-white">Agregar Nueva Persona</h3>
            </div>
            <form onSubmit={createPersona} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Código Empleado*</label>
                  <input
                    type="number"
                    required
                    value={personaForm.codigo_empleado}
                    onChange={(e) => setPersonaForm({...personaForm, codigo_empleado: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">QR Code*</label>
                  <input
                    type="number"
                    required
                    value={personaForm.qr_code}
                    onChange={(e) => setPersonaForm({...personaForm, qr_code: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nombres*</label>
                  <input
                    type="text"
                    required
                    value={personaForm.nombres}
                    onChange={(e) => setPersonaForm({...personaForm, nombres: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Apellidos*</label>
                  <input
                    type="text"
                    required
                    value={personaForm.apellidos}
                    onChange={(e) => setPersonaForm({...personaForm, apellidos: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email*</label>
                  <input
                    type="email"
                    required
                    value={personaForm.correo_electronico}
                    onChange={(e) => setPersonaForm({...personaForm, correo_electronico: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                  <input
                    type="text"
                    value={personaForm.department}
                    onChange={(e) => setPersonaForm({...personaForm, department: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Manager</label>
                  <input
                    type="text"
                    value={personaForm.manager}
                    onChange={(e) => setPersonaForm({...personaForm, manager: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Contratación</label>
                  <input
                    type="date"
                    value={personaForm.hiring_date}
                    onChange={(e) => setPersonaForm({...personaForm, hiring_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={personaForm.activo}
                      onChange={(e) => setPersonaForm({...personaForm, activo: e.target.checked})}
                      className="w-4 h-4 text-[#004370] border-gray-300 rounded focus:ring-[#4997d0]"
                    />
                    <span className="text-sm font-medium text-gray-700">Activo</span>
                  </label>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={personaForm.enviarQR}
                      onChange={(e) => setPersonaForm({...personaForm, enviarQR: e.target.checked})}
                      className="w-4 h-4 text-[#004370] border-gray-300 rounded focus:ring-[#4997d0]"
                    />
                    <span className="text-sm font-medium text-gray-700">Enviar QR por correo</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPersonaModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#004370] text-white rounded-lg hover:bg-[#4997d0] transition-colors"
                >
                  Agregar Persona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}