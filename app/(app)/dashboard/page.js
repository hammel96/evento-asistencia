'use client';
import { db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';

const CIUDADES_VALIDAS = ['Guatemala', 'Xela'];

// Componente Dashboard
function DashboardView({ personas, eventos, filteredPersonas, searchTerm, setSearchTerm, setShowEventModal, setShowPersonaModal, deleteEvento, generarYDescargarQR, generarQRTodos, sendQR, setShowImportModal, setShowUpdateEmailsModal, setShowUpdateCiudadModal, exportarBaseDatos, handleEditPersona, handleDeletePersona, onCerrarEvento, onReabrirEvento, onToggleFormularioExcusas }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sendingIds, setSendingIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [enlaceCopiadoId, setEnlaceCopiadoId] = useState(null);

  async function copiarEnlaceExcusas(evento) {
    const url = `${window.location.origin}/excusa/${evento.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setEnlaceCopiadoId(evento.id);
      setTimeout(() => setEnlaceCopiadoId(prev => (prev === evento.id ? null : prev)), 2000);
    } catch (error) {
      console.error('Error copiando enlace:', error);
      alert('No se pudo copiar el enlace. Cópialo manualmente:\n' + url);
    }
  }

  function handleSort(col) {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setCurrentPage(1);
  }

  const sortedPersonas = sortCol ? [...filteredPersonas].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'codigo') {
      cmp = (a.codigo_empleado ?? 0) - (b.codigo_empleado ?? 0);
    } else if (sortCol === 'nombre') {
      cmp = `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`, 'es');
    } else if (sortCol === 'email') {
      if (a.qr_enviado !== b.qr_enviado) cmp = a.qr_enviado ? -1 : 1;
      else cmp = (b.fecha_envio?.seconds ?? 0) - (a.fecha_envio?.seconds ?? 0);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  }) : filteredPersonas;

  const visible = sortedPersonas.slice((currentPage - 1) * 50, currentPage * 50);

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-[#004370] truncate">{e.nombre}</h3>
                            {e.cerrado && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-[#d8222d] flex-shrink-0">Cerrado</span>
                            )}
                            {e.formularioExcusasAbierto === false && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600 flex-shrink-0">Formulario cerrado</span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4997d0] bg-opacity-10 text-[#004370] flex-shrink-0">
                              🏙️ {(e.ciudades || ['Guatemala', 'Xela']).join(' + ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {e.fecha}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => e.cerrado ? onReabrirEvento(e) : onCerrarEvento(e)}
                              className={`mt-2 text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                                e.cerrado
                                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                  : 'bg-red-50 text-[#d8222d] hover:bg-red-100'
                              }`}
                            >
                              {e.cerrado ? 'Reabrir evento' : 'Cerrar evento'}
                            </button>
                            <button
                              onClick={() => onToggleFormularioExcusas(e)}
                              className={`mt-2 text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                                e.formularioExcusasAbierto === false
                                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {e.formularioExcusasAbierto === false ? 'Reabrir formulario de excusas' : 'Cerrar formulario de excusas'}
                            </button>
                            <button
                              onClick={() => copiarEnlaceExcusas(e)}
                              className="mt-2 text-xs font-medium px-2 py-1 rounded-md transition-colors bg-blue-50 text-[#004370] hover:bg-blue-100"
                            >
                              {enlaceCopiadoId === e.id ? '✅ Enlace copiado' : 'Copiar enlace de excusas'}
                            </button>
                          </div>
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
                  className="px-6 py-2 bg-white text-[#004370] border border-gray-100 rounded-lg hover:bg-gray-50 font-regular flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Importar CSV
                </button>
                <button
                  onClick={() => exportarBaseDatos()}
                  className="px-3 py-2 bg-white text-[#004370] border border-gray-100 rounded-lg hover:bg-gray-50 font-regular flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar Base de Datos
                </button>
                <button
                  onClick={() => setShowUpdateEmailsModal(true)}
                  className="px-3 py-2 bg-white text-[#004370] border border-gray-100 rounded-lg hover:bg-gray-50 font-regular flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Correos Personales
                </button>
                <button
                  onClick={() => setShowUpdateCiudadModal(true)}
                  className="px-3 py-2 bg-white text-[#004370] border border-gray-100 rounded-lg hover:bg-gray-50 font-regular flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Ciudad
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
                className="w-full px-4 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4997d0]"
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
                    {[['codigo', 'Código'], ['nombre', 'Nombre'], ['email', 'Estado Email']].map(([col, label]) => (
                      <th key={col} className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort(col)}
                          className="flex items-center gap-1 text-gray-500 text-xs uppercase tracking-wide font-semibold hover:text-[#004370] transition-colors select-none"
                        >
                          {label}
                          <span className="text-[10px] leading-none">
                            {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">⇅</span>}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-gray-500 text-xs uppercase tracking-wide font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map(p => (
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
                                                    <button
                            onClick={() => handleEditPersona(p)}
                            className="p-1.5 hover:bg-blue-100 rounded-md transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4 text-[#4997d0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePersona(p.id)}
                            className="p-1.5 hover:bg-red-100 rounded-md transition-colors"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4 text-[#d8222d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>

                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.activo ? 'bg-green-500' : 'bg-gray-300'}`} title={p.activo ? 'Activo' : 'Inactivo'} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Paginación */}
<div className="flex items-center justify-between px-6 py-4 border-t">
  <div className="text-sm text-gray-600">
    Mostrando {((currentPage - 1) * 50) + 1} - {Math.min(currentPage * 50, filteredPersonas.length)} de {filteredPersonas.length}
  </div>
  <div className="flex gap-2">
    <button
      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
      disabled={currentPage === 1}
      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
    >
      ← Anterior
    </button>
    <span className="px-4 py-2 text-gray-700">
      Página {currentPage} de {Math.ceil(filteredPersonas.length / 50)}
    </span>
    <button
      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPersonas.length / 50), p + 1))}
      disabled={currentPage >= Math.ceil(filteredPersonas.length / 50)}
      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
    >
      Siguiente →
    </button>
  </div>
</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal Actualización Masiva de Correos Personales
function UpdateEmailsModal({ show, onClose, onUpdate }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function parseCSVLine(line) {
    const res = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { res.push(cur); cur = ''; }
      else cur += ch;
    }
    res.push(cur);
    return res;
  }

  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').trim().replace(/"/g, '')]));
    }).filter(row => row.codigo_empleado);
  }

  function downloadPlantilla() {
    const BOM = '﻿';
    const csv = BOM + ['codigo_empleado,correo_personal', '12345,juan.perez@gmail.com'].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'plantilla_correos_personales.csv';
    link.click();
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = evt => {
      const rows = parseCSV(evt.target.result);
      if (rows.length === 0) { setError('No se encontraron datos en el archivo'); return; }
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(f, 'utf-8');
  }

  async function handleUpdate() {
    if (!file || updating) return;
    setUpdating(true);
    setError('');
    const reader = new FileReader();
    reader.onload = async evt => {
      const rows = parseCSV(evt.target.result);
      const res = await onUpdate(rows);
      setResult(res);
      setUpdating(false);
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleClose() {
    setFile(null);
    setPreview([]);
    setError('');
    setResult(null);
    onClose();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6 rounded-t-xl flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold text-white">Actualizar Correos Personales</h3>
          <button onClick={handleClose} className="text-white hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {result ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-[#004370] mb-2">¡Actualización completada!</h4>
              <p className="text-green-700 font-medium">{result.updated} actualizados</p>
              {result.notFound > 0 && <p className="text-yellow-600 mt-1">{result.notFound} códigos no encontrados</p>}
              <button onClick={handleClose} className="mt-6 px-6 py-2 bg-[#004370] text-white rounded-lg hover:bg-[#4997d0] transition-colors">
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div className="border-2 border-dashed border-[#4997d0] border-opacity-40 rounded-xl p-5 bg-blue-50 bg-opacity-30">
                <p className="font-semibold text-[#004370] text-sm mb-1">Formato requerido</p>
                <p className="text-gray-500 text-xs mb-3">CSV con columnas: <code className="bg-gray-100 px-1 rounded">codigo_empleado</code> y <code className="bg-gray-100 px-1 rounded">correo_personal</code></p>
                <button onClick={downloadPlantilla} className="flex items-center gap-2 bg-[#004370] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#4997d0] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar Plantilla
                </button>
              </div>

              <div>
                <label className="flex items-center gap-3 border-2 border-gray-300 rounded-xl p-4 cursor-pointer hover:border-[#4997d0] transition-colors">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    {file ? <p className="text-[#004370] font-medium truncate">{file.name}</p> : <p className="text-gray-400">Seleccionar archivo .csv</p>}
                  </div>
                  <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {preview.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase">codigo_empleado</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase">correo_personal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-700">{row.codigo_empleado}</td>
                          <td className="px-3 py-2 text-gray-700">{row.correo_personal || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && <p className="text-[#d8222d] text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={handleClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                  Cancelar
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={!file || preview.length === 0 || updating}
                  className="flex-1 px-4 py-2.5 bg-[#004370] text-white rounded-lg hover:bg-[#4997d0] transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {updating ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal Actualización Masiva de Ciudad
function UpdateCiudadModal({ show, onClose, onUpdate }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function parseCSVLine(line) {
    const res = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { res.push(cur); cur = ''; }
      else cur += ch;
    }
    res.push(cur);
    return res;
  }

  function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').trim().replace(/"/g, '')]));
    }).filter(row => row.codigo_empleado);
  }

  function downloadPlantilla() {
    const BOM = '﻿';
    const csv = BOM + ['codigo_empleado,ciudad', '12345,Guatemala'].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'plantilla_ciudad.csv';
    link.click();
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = evt => {
      const rows = parseCSV(evt.target.result);
      if (rows.length === 0) { setError('No se encontraron datos en el archivo'); return; }
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(f, 'utf-8');
  }

  async function handleUpdate() {
    if (!file || updating) return;
    setUpdating(true);
    setError('');
    const reader = new FileReader();
    reader.onload = async evt => {
      const rows = parseCSV(evt.target.result);
      const res = await onUpdate(rows);
      setResult(res);
      setUpdating(false);
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleClose() {
    setFile(null);
    setPreview([]);
    setError('');
    setResult(null);
    onClose();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6 rounded-t-xl flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold text-white">Actualizar Ciudad</h3>
          <button onClick={handleClose} className="text-white hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {result ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-[#004370] mb-2">¡Actualización completada!</h4>
              <p className="text-green-700 font-medium">{result.updated} actualizados</p>
              {result.erroresCiudad.length > 0 && (
                <p className="text-yellow-600 mt-1 text-sm">
                  {result.erroresCiudad.length} con ciudad inválida (debe ser "Guatemala" o "Xela"): {result.erroresCiudad.join(', ')}
                </p>
              )}
              {result.erroresCodigo.length > 0 && (
                <p className="text-yellow-600 mt-1 text-sm">
                  {result.erroresCodigo.length} códigos no encontrados: {result.erroresCodigo.join(', ')}
                </p>
              )}
              <button onClick={handleClose} className="mt-6 px-6 py-2 bg-[#004370] text-white rounded-lg hover:bg-[#4997d0] transition-colors">
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div className="border-2 border-dashed border-[#4997d0] border-opacity-40 rounded-xl p-5 bg-blue-50 bg-opacity-30">
                <p className="font-semibold text-[#004370] text-sm mb-1">Formato requerido</p>
                <p className="text-gray-500 text-xs mb-3">
                  CSV con columnas: <code className="bg-gray-100 px-1 rounded">codigo_empleado</code> y <code className="bg-gray-100 px-1 rounded">ciudad</code> (valores permitidos: "Guatemala" o "Xela", no distingue mayúsculas/minúsculas)
                </p>
                <button onClick={downloadPlantilla} className="flex items-center gap-2 bg-[#004370] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#4997d0] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar Plantilla
                </button>
              </div>

              <div>
                <label className="flex items-center gap-3 border-2 border-gray-300 rounded-xl p-4 cursor-pointer hover:border-[#4997d0] transition-colors">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    {file ? <p className="text-[#004370] font-medium truncate">{file.name}</p> : <p className="text-gray-400">Seleccionar archivo .csv</p>}
                  </div>
                  <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {preview.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase">codigo_empleado</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase">ciudad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-700">{row.codigo_empleado}</td>
                          <td className="px-3 py-2 text-gray-700">{row.ciudad || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && <p className="text-[#d8222d] text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={handleClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                  Cancelar
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={!file || preview.length === 0 || updating}
                  className="flex-1 px-4 py-2.5 bg-[#004370] text-white rounded-lg hover:bg-[#4997d0] transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {updating ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </>
          )}
        </div>
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
    const BOM = '﻿';
    const csv = BOM + [
      'codigo_empleado,nombres,apellidos,correo_electronico,correo_personal,department,manager,hiring_date,ciudad',
      '12345,Juan,Perez,juan.perez@empresa.com,juan.perez@gmail.com,Tecnología,Maria Garcia,2024-01-15,Guatemala',
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

  const PREVIEW_COLS = ['codigo_empleado', 'nombres', 'apellidos', 'correo_electronico', 'department', 'ciudad'];

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

// Página Dashboard
export default function DashboardPage() {
  const [personas, setPersonas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUpdateEmailsModal, setShowUpdateEmailsModal] = useState(false);
  const [showUpdateCiudadModal, setShowUpdateCiudadModal] = useState(false);
  const [eventoToClose, setEventoToClose] = useState(null);
  const [cerrando, setCerrando] = useState(false);

  const [eventoForm, setEventoForm] = useState({ nombre: '', fecha: '', ciudades: ['Guatemala', 'Xela'] });
  const [personaForm, setPersonaForm] = useState({
    codigo_empleado: '',
    nombres: '',
    apellidos: '',
    correo_electronico: '',
    correo_personal: '',
    qr_code: '',
    activo: true,
    department: '',
    manager: '',
    hiring_date: '',
    ciudad: 'Guatemala',
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
    if (eventoForm.ciudades.length === 0) {
      alert('Selecciona al menos una ciudad para el evento');
      return;
    }
    try {
      // Filtrado client-side (no where('ciudad','in',...) de Firestore): ese
      // operador solo compara el valor literal del campo y no puede aplicar
      // el fallback (personas legacy sin ciudad seteada = Guatemala), así que
      // excluiría incorrectamente a esas personas cuando Guatemala está
      // seleccionada. personas ya está cargado en este componente.
      const personasAsignadas = personas
        .filter(p => eventoForm.ciudades.includes(p.ciudad || 'Guatemala'))
        .map(p => p.id);

      await addDoc(collection(db, 'eventos'), {
        nombre: eventoForm.nombre,
        fecha: eventoForm.fecha,
        created_at: Timestamp.now(),
        cerrado: false,
        formularioExcusasAbierto: true,
        ciudades: eventoForm.ciudades,
        personasAsignadas,
      });
      setEventoForm({ nombre: '', fecha: '', ciudades: ['Guatemala', 'Xela'] });
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

  async function cerrarEvento(evento) {
    setCerrando(true);
    try {
      await updateDoc(doc(db, 'eventos', evento.id), { cerrado: true });
      setEventoToClose(null);
      await loadData();
    } catch (error) {
      console.error('Error cerrando evento:', error);
      alert('Error al cerrar el evento');
    }
    setCerrando(false);
  }

  async function reabrirEvento(evento) {
    if (!confirm('¿Reabrir este evento? Los nuevos registros volverán a guardarse en el evento original.')) return;
    try {
      await updateDoc(doc(db, 'eventos', evento.id), { cerrado: false });
      await loadData();
    } catch (error) {
      console.error('Error reabriendo evento:', error);
      alert('Error al reabrir el evento');
    }
  }

  async function toggleFormularioExcusas(evento) {
    const abrir = evento.formularioExcusasAbierto === false;
    const mensaje = abrir
      ? '¿Reabrir el formulario de excusas para este evento?'
      : '¿Cerrar el formulario de excusas para este evento? Nadie podrá enviar nuevas excusas hasta que lo reabras.';
    if (!confirm(mensaje)) return;
    try {
      await updateDoc(doc(db, 'eventos', evento.id), { formularioExcusasAbierto: abrir });
      await loadData();
    } catch (error) {
      console.error('Error actualizando formulario de excusas:', error);
      alert('Error al actualizar el formulario de excusas');
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
        const ciudad = CIUDADES_VALIDAS.find(c => c.toLowerCase() === (row.ciudad || '').trim().toLowerCase()) || 'Guatemala';
        const docRef = await addDoc(collection(db, 'personas'), {
          codigo_empleado: codigo,
          nombres: row.nombres || '',
          apellidos: row.apellidos || '',
          correo_electronico: row.correo_electronico || '',
          correo_personal: row.correo_personal || '',
          qr_code: codigo,
          activo: true,
          department: row.department || '',
          manager: row.manager || '',
          hiring_date: row.hiring_date || '',
          ciudad,
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
      const personaData = {
        codigo_empleado: codigo,
        nombres: personaForm.nombres,
        apellidos: personaForm.apellidos,
        correo_electronico: personaForm.correo_electronico,
        correo_personal: personaForm.correo_personal,
        qr_code: parseInt(personaForm.qr_code) || codigo,
        activo: personaForm.activo,
        department: personaForm.department,
        manager: personaForm.manager,
        hiring_date: personaForm.hiring_date,
        ciudad: personaForm.ciudad || 'Guatemala',
      };

      if (editingPersonaId) {
        // EDITAR persona existente
        await updateDoc(doc(db, 'personas', editingPersonaId), personaData);
        alert('✅ Persona actualizada exitosamente');
      } else {
        // CREAR nueva persona
        const docRef = await addDoc(collection(db, 'personas'), personaData);
        const enviarQR = personaForm.enviarQR;

        if (enviarQR) {
          await loadData();
          const nuevaPersona = personas.find(p => p.id === docRef.id) || {
            id: docRef.id,
            ...personaData,
          };
          await sendQR([nuevaPersona]);
        }
      }

      setPersonaForm({
        codigo_empleado: '',
        nombres: '',
        apellidos: '',
        correo_electronico: '',
        correo_personal: '',
        qr_code: '',
        activo: true,
        department: '',
        manager: '',
        hiring_date: '',
        ciudad: 'Guatemala',
        enviarQR: false,
      });
      setEditingPersonaId(null);
      setShowPersonaModal(false);
      await loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar persona');
    }
  }

  async function handleEditPersona(persona) {
    setPersonaForm({
      codigo_empleado: persona.codigo_empleado?.toString() || '',
      nombres: persona.nombres || '',
      apellidos: persona.apellidos || '',
      correo_electronico: persona.correo_electronico || '',
      correo_personal: persona.correo_personal || '',
      qr_code: persona.qr_code?.toString() || '',
      activo: persona.activo ?? true,
      department: persona.department || '',
      manager: persona.manager || '',
      hiring_date: persona.hiring_date || '',
      ciudad: persona.ciudad || 'Guatemala',
      enviarQR: false,
    });
    setEditingPersonaId(persona.id);
    setShowPersonaModal(true);
  }

  async function handleDeletePersona(id) {
    if (!confirm('¿Estás seguro de eliminar esta persona? Esta acción no se puede deshacer.')) return;
    try {
      await deleteDoc(doc(db, 'personas', id));
      await loadData();
      alert('✅ Persona eliminada exitosamente');
    } catch (error) {
      console.error('Error eliminando persona:', error);
      alert('❌ Error al eliminar persona');
    }
  }

  async function updatePersonalEmails(rows) {
    let updated = 0;
    let notFound = 0;
    for (const row of rows) {
      const codigo = parseInt(row.codigo_empleado);
      const persona = personas.find(p => p.codigo_empleado === codigo);
      if (!persona) { notFound++; continue; }
      try {
        await updateDoc(doc(db, 'personas', persona.id), { correo_personal: row.correo_personal || '' });
        updated++;
      } catch (err) {
        console.error('Error actualizando correo personal:', err);
        notFound++;
      }
    }
    await loadData();
    return { updated, notFound };
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

  function exportarBaseDatos() {
    const BOM = '﻿';
    const rows = personas.map(p => [
      p.codigo_empleado,
      `"${p.nombres} ${p.apellidos}"`,
      `"${p.department || ''}"`,
      `"${p.manager || ''}"`,
      p.ciudad || 'Guatemala',
    ]);
    const csv = BOM + ['Código,Nombre,Departamento,Manager,Ciudad', ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Base_Datos_Personas.csv';
    link.click();
  }

  async function updateCiudades(rows) {
    const erroresCiudad = [];
    const erroresCodigo = [];
    const validRows = [];

    for (const row of rows) {
      const codigo = parseInt(row.codigo_empleado);
      const ciudadNormalizada = CIUDADES_VALIDAS.find(c => c.toLowerCase() === (row.ciudad || '').trim().toLowerCase());
      if (!ciudadNormalizada) {
        erroresCiudad.push(row.codigo_empleado);
        continue;
      }
      const persona = personas.find(p => p.codigo_empleado === codigo);
      if (!persona) {
        erroresCodigo.push(row.codigo_empleado);
        continue;
      }
      validRows.push({ personaId: persona.id, ciudad: ciudadNormalizada });
    }

    let updated = 0;
    for (let i = 0; i < validRows.length; i += 500) {
      const chunk = validRows.slice(i, i + 500);
      try {
        const batch = writeBatch(db);
        chunk.forEach(({ personaId, ciudad }) => {
          batch.update(doc(db, 'personas', personaId), { ciudad });
        });
        await batch.commit();
        updated += chunk.length;
      } catch (error) {
        console.error('Error actualizando lote de ciudades:', error);
      }
    }

    await loadData();
    return { updated, erroresCiudad, erroresCodigo };
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
    <>
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
        setShowUpdateEmailsModal={setShowUpdateEmailsModal}
        setShowUpdateCiudadModal={setShowUpdateCiudadModal}
        exportarBaseDatos={exportarBaseDatos}
        handleEditPersona={handleEditPersona}
        handleDeletePersona={handleDeletePersona}
        onCerrarEvento={setEventoToClose}
        onReabrirEvento={reabrirEvento}
        onToggleFormularioExcusas={toggleFormularioExcusas}
      />

      <ImportCSVModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={importPersonas}
      />

      <UpdateEmailsModal
        show={showUpdateEmailsModal}
        onClose={() => setShowUpdateEmailsModal(false)}
        onUpdate={updatePersonalEmails}
      />

      <UpdateCiudadModal
        show={showUpdateCiudadModal}
        onClose={() => setShowUpdateCiudadModal(false)}
        onUpdate={updateCiudades}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ciudad(es) del Evento</label>
                <div className="flex gap-4">
                  {CIUDADES_VALIDAS.map(ciudad => (
                    <label key={ciudad} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={eventoForm.ciudades.includes(ciudad)}
                        onChange={(e) => {
                          const ciudades = e.target.checked
                            ? [...eventoForm.ciudades, ciudad]
                            : eventoForm.ciudades.filter(c => c !== ciudad);
                          setEventoForm({...eventoForm, ciudades});
                        }}
                        className="w-4 h-4 text-[#004370] border-gray-300 rounded focus:ring-[#4997d0]"
                      />
                      <span className="text-sm font-medium text-gray-700">{ciudad}</span>
                    </label>
                  ))}
                </div>
                {eventoForm.ciudades.length === 0 && (
                  <p className="text-[#d8222d] text-xs mt-1">Selecciona al menos una ciudad</p>
                )}
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
                  disabled={eventoForm.ciudades.length === 0}
                  className="flex-1 px-4 py-2 bg-[#004370] text-white rounded-lg hover:bg-[#4997d0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {eventoToClose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-[#004370] to-[#d8222d] p-6 rounded-t-xl">
              <h3 className="text-xl font-bold text-white">Cerrar Evento</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 text-sm leading-relaxed">
                El evento <span className="font-semibold text-[#004370]">{eventoToClose.nombre}</span> quedará marcado como cerrado. Los nuevos registros de asistencia se seguirán guardando en este mismo evento, pero marcados como "fuera de fecha".
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEventoToClose(null)}
                  disabled={cerrando}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => cerrarEvento(eventoToClose)}
                  disabled={cerrando}
                  className="flex-1 px-4 py-2 bg-[#d8222d] text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cerrando && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {cerrando ? 'Cerrando...' : 'Cerrar Evento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPersonaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl my-8">
            <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6 rounded-t-xl">
              <h3 className="text-xl font-bold text-white">{editingPersonaId ? 'Editar Persona' : 'Agregar Nueva Persona'}</h3>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Correo Electrónico*</label>
                  <input
                    type="email"
                    required
                    value={personaForm.correo_electronico}
                    onChange={(e) => setPersonaForm({...personaForm, correo_electronico: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Correo Personal</label>
                  <input
                    type="email"
                    value={personaForm.correo_personal}
                    onChange={(e) => setPersonaForm({...personaForm, correo_personal: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                    placeholder="gmail, hotmail, etc."
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ciudad</label>
                  <select
                    value={personaForm.ciudad}
                    onChange={(e) => setPersonaForm({...personaForm, ciudad: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                  >
                    {CIUDADES_VALIDAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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
                  {editingPersonaId ? 'Guardar Cambios' : 'Agregar Persona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
