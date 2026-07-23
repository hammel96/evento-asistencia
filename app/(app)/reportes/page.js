'use client';
import { db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, addDoc, updateDoc, query, orderBy, where } from 'firebase/firestore';

const RAZONES_LABEL = {
  estudios: 'Estudios / universidad',
  medico: 'Motivo médico / enfermedad',
  vacaciones: 'Vacaciones',
  trabajo_sabado: 'Trabajo asignado / agendado el sábado',
  otro: 'Otro',
};

// Componente Reportes
function ReportesView({ eventos, todasPersonas }) {
  const [selectedEvento, setSelectedEvento] = useState('');
  const [asistencias, setAsistencias] = useState([]);
  const [excusas, setExcusas] = useState([]);
  const [validaciones, setValidaciones] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState('asistentes');
  const [filtroDept, setFiltroDept] = useState('');
  const [filtroManager, setFiltroManager] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [excusaModal, setExcusaModal] = useState(null);

  useEffect(() => {
    if (!selectedEvento) { setAsistencias([]); setExcusas([]); setValidaciones([]); return; }
    setLoadingData(true);
    Promise.all([
      getDocs(query(collection(db, 'asistencias'), where('evento_id', '==', selectedEvento))),
      getDocs(query(collection(db, 'excusas'), where('evento_id', '==', selectedEvento))),
      getDocs(query(collection(db, 'validaciones'), where('evento_id', '==', selectedEvento))),
    ])
      .then(([asistSnap, excusasSnap, validacionesSnap]) => {
        setAsistencias(asistSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setExcusas(excusasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setValidaciones(validacionesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingData(false);
      })
      .catch((error) => {
        console.error('Error:', error);
        setLoadingData(false);
      });
  }, [selectedEvento]);

  const eventoSel = eventos.find(e => e.id === selectedEvento);
  const eventoCerrado = !!eventoSel?.cerrado;

  // Personas asignadas al evento seleccionado (eventos sin personasAsignadas
  // -legacy, o creados antes de este campo- se tratan como "todas las
  // personas", que era el comportamiento de siempre).
  const personasDelEvento = eventoSel?.personasAsignadas
    ? todasPersonas.filter(p => eventoSel.personasAsignadas.includes(p.id))
    : todasPersonas;

  const asistentesMap = new Map(asistencias.map(a => [a.persona_id, a]));

  const departamentos = [...new Set(personasDelEvento.map(p => p.department).filter(Boolean))].sort();
  const managers = [...new Set(personasDelEvento.map(p => p.manager).filter(Boolean))].sort();

  const personasFiltradas = personasDelEvento.filter(p => {
    if (filtroDept && p.department !== filtroDept) return false;
    if (filtroManager && p.manager !== filtroManager) return false;
    if (filtroCiudad && (p.ciudad || 'Guatemala') !== filtroCiudad) return false;
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

  // "Fuera de fecha": personas sin registro normal (a tiempo) para este evento cerrado.
  // Puede incluir personas que ya se registraron después del cierre (fueraDeFecha: true).
  const asistenciaATiempoMap = new Map(asistencias.filter(a => !a.fueraDeFecha).map(a => [a.persona_id, a]));
  const asistenciaFueraDeFechaMap = new Map(asistencias.filter(a => a.fueraDeFecha).map(a => [a.persona_id, a]));
  const excusaMap = new Map(excusas.map(ex => [ex.persona_id, ex]));
  const validacionMap = new Map(validaciones.map(v => [v.persona_id, v]));
  const fueraDeFechaLista = eventoCerrado
    ? personasFiltradas.filter(p => !asistenciaATiempoMap.has(p.id)).map(p => {
        const excusa = excusaMap.get(p.id) || null;
        return {
          ...p,
          // "Asistencia" depende únicamente de que exista un documento real en
          // asistencias con fueraDeFecha: true (es decir, que la persona haya
          // escaneado/registrado en /registro) — nunca del valor de validación.
          registradoFueraDeFecha: asistenciaFueraDeFechaMap.has(p.id),
          validacion: excusa?.validacion ?? validacionMap.get(p.id)?.validacion ?? null,
          excusa,
        };
      })
    : [];

  function razonLabel(excusa) {
    if (!excusa) return '—';
    return RAZONES_LABEL[excusa.razon] || excusa.razon;
  }

  async function handleValidacionChange(persona, nuevoValor) {
    // La validación (Válida/No válida) es un concepto independiente de la
    // asistencia real: se guarda en el documento de excusas de la persona
    // si existe, o si no, en una colección separada ("validaciones"). Nunca
    // se escribe en "asistencias" para no afectar la columna Asistencia.
    const excusaExistente = excusas.find(ex => ex.persona_id === persona.id);
    const validacionExistente = validaciones.find(v => v.persona_id === persona.id);
    const valorAnterior = excusaExistente?.validacion ?? validacionExistente?.validacion ?? null;

    // Optimistic UI
    if (excusaExistente) {
      setExcusas(prev => prev.map(ex => ex.persona_id === persona.id ? { ...ex, validacion: nuevoValor } : ex));
    } else if (validacionExistente) {
      setValidaciones(prev => prev.map(v => v.persona_id === persona.id ? { ...v, validacion: nuevoValor } : v));
    } else {
      setValidaciones(prev => [...prev, {
        id: null,
        persona_id: persona.id,
        evento_id: selectedEvento,
        validacion: nuevoValor,
      }]);
    }

    try {
      if (excusaExistente) {
        await updateDoc(doc(db, 'excusas', excusaExistente.id), { validacion: nuevoValor });
      } else if (validacionExistente && validacionExistente.id) {
        await updateDoc(doc(db, 'validaciones', validacionExistente.id), { validacion: nuevoValor });
      } else {
        const docRef = await addDoc(collection(db, 'validaciones'), {
          persona_id: persona.id,
          evento_id: selectedEvento,
          validacion: nuevoValor,
        });
        setValidaciones(prev => prev.map(v => (v.persona_id === persona.id && !v.id) ? { ...v, id: docRef.id } : v));
      }
    } catch (error) {
      console.error('Error guardando validación:', error);
      alert('Error al guardar la validación');
      if (excusaExistente) {
        setExcusas(prev => prev.map(ex => ex.persona_id === persona.id ? { ...ex, validacion: valorAnterior } : ex));
      } else if (validacionExistente) {
        setValidaciones(prev => prev.map(v => v.persona_id === persona.id ? { ...v, validacion: valorAnterior } : v));
      } else {
        setValidaciones(prev => prev.filter(v => !(v.persona_id === persona.id && !v.id)));
      }
    }
  }

  const totalPersonas = personasDelEvento.length;
  const totalAsistentes = asistencias.length;
  const totalAusentes = totalPersonas - totalAsistentes;
  const porcentaje = totalPersonas > 0 ? ((totalAsistentes / totalPersonas) * 100).toFixed(1) : 0;

  function formatTimestamp(ts) {
    if (!ts) return '-';
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    const fecha = date.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = date.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
    return `${fecha} ${hora}`;
  }

  function exportarCSV() {
    const eventoNombre = eventos.find(e => e.id === selectedEvento)?.nombre || 'Evento';
    const BOM = '﻿';
    let csv, filename;

    if (activeTab === 'asistentes') {
      const rows = asistentesLista.map(p => [
        p.codigo_empleado,
        `"${p.nombres} ${p.apellidos}"`,
        `"${p.department || ''}"`,
        `"${p.manager || ''}"`,
        p.ciudad || 'Guatemala',
        formatTimestamp(p.asistencia?.timestamp),
        p.asistencia?.metodo_registro === 'qr' ? 'QR' : 'Texto'
      ]);
      csv = BOM + ['Código,Nombre,Departamento,Manager,Ciudad,Fecha y Hora de Registro,Método', ...rows.map(r => r.join(','))].join('\n');
      filename = `Asistentes_${eventoNombre}.csv`;
    } else if (eventoCerrado) {
      const rows = fueraDeFechaLista.map(p => [
        p.codigo_empleado,
        `"${p.nombres} ${p.apellidos}"`,
        `"${p.department || ''}"`,
        `"${p.manager || ''}"`,
        p.ciudad || 'Guatemala',
        p.validacion === 'valida' ? 'Válida' : p.validacion === 'no_valida' ? 'No válida' : '',
        `"${razonLabel(p.excusa)}"`,
        p.registradoFueraDeFecha ? 'Sí' : 'No'
      ]);
      csv = BOM + ['Código,Nombre,Departamento,Manager,Ciudad,Validación,Razón,Asistencia', ...rows.map(r => r.join(','))].join('\n');
      filename = `FueraDeFecha_${eventoNombre}.csv`;
    } else {
      const rows = ausentesLista.map(p => [
        p.codigo_empleado,
        `"${p.nombres} ${p.apellidos}"`,
        `"${p.department || ''}"`,
        `"${p.manager || ''}"`,
        p.ciudad || 'Guatemala'
      ]);
      csv = BOM + ['Código,Nombre,Departamento,Manager,Ciudad', ...rows.map(r => r.join(','))].join('\n');
      filename = `Ausentes_${eventoNombre}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  return (
    <>
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <label className="block text-xs text-gray-500 mb-1">Ciudad</label>
                      <select
                        value={filtroCiudad}
                        onChange={e => setFiltroCiudad(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4997d0] focus:border-transparent text-gray-900"
                      >
                        <option value="">Todas</option>
                        <option value="Guatemala">Guatemala</option>
                        <option value="Xela">Xela</option>
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
                      {eventoCerrado ? `Fuera de fecha (${fueraDeFechaLista.length})` : `Ausentes (${ausentesLista.length})`}
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
                            <th className="px-4 py-3 text-left">Ciudad</th>
                            <th className="px-4 py-3 text-left">Fecha y Hora</th>
                            <th className="px-4 py-3 text-left">Método</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {asistentesLista.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-12 text-gray-400">Sin resultados para los filtros aplicados</td>
                            </tr>
                          ) : asistentesLista.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-mono text-gray-500 text-xs">{p.codigo_empleado}</td>
                              <td className="px-4 py-3 font-medium text-[#004370]">{p.nombres} {p.apellidos}</td>
                              <td className="px-4 py-3 text-gray-600">{p.department || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.manager || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.ciudad || 'Guatemala'}</td>
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
                    ) : eventoCerrado ? (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-3 text-left">Código</th>
                            <th className="px-4 py-3 text-left">Nombre</th>
                            <th className="px-4 py-3 text-left">Departamento</th>
                            <th className="px-4 py-3 text-left">Manager</th>
                            <th className="px-4 py-3 text-left">Ciudad</th>
                            <th className="px-4 py-3 text-left">Validación</th>
                            <th className="px-4 py-3 text-left">Excusa</th>
                            <th className="px-4 py-3 text-left">Razón</th>
                            <th className="px-4 py-3 text-left">Asistencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {fueraDeFechaLista.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="text-center py-12 text-gray-400">Sin resultados para los filtros aplicados</td>
                            </tr>
                          ) : fueraDeFechaLista.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-mono text-gray-500 text-xs">{p.codigo_empleado}</td>
                              <td className="px-4 py-3 font-medium text-[#004370]">{p.nombres} {p.apellidos}</td>
                              <td className="px-4 py-3 text-gray-600">{p.department || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.manager || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.ciudad || 'Guatemala'}</td>
                              <td className="px-4 py-3">
                                <select
                                  value={p.validacion || ''}
                                  onChange={(e) => handleValidacionChange(p, e.target.value || null)}
                                  className="px-2 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 focus:ring-2 focus:ring-[#4997d0] focus:border-transparent"
                                >
                                  <option value="">Seleccionar...</option>
                                  <option value="valida">Válida</option>
                                  <option value="no_valida">No válida</option>
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                {p.excusa ? (
                                  <button
                                    onClick={() => setExcusaModal(p.excusa)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-[#4997d0] bg-opacity-10 text-[#004370] hover:bg-opacity-20 transition-colors"
                                    title="Ver excusa"
                                  >
                                    📎 Ver
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">Sin excusa</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{razonLabel(p.excusa)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  p.registradoFueraDeFecha
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-50 text-[#d8222d]'
                                }`}>
                                  {p.registradoFueraDeFecha ? 'Sí' : 'No'}
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
                            <th className="px-4 py-3 text-left">Ciudad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {ausentesLista.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-12 text-gray-400">Sin ausentes para los filtros aplicados</td>
                            </tr>
                          ) : ausentesLista.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-mono text-gray-500 text-xs">{p.codigo_empleado}</td>
                              <td className="px-4 py-3 font-medium text-[#004370]">{p.nombres} {p.apellidos}</td>
                              <td className="px-4 py-3 text-gray-600">{p.department || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.manager || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{p.ciudad || 'Guatemala'}</td>
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

    {excusaModal && (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={() => setExcusaModal(null)}
      >
        <div
          className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-[#004370] to-[#4997d0] p-6 rounded-t-xl flex items-center justify-between flex-shrink-0">
            <h3 className="text-xl font-bold text-white">Excusa — {excusaModal.nombre_completo}</h3>
            <button onClick={() => setExcusaModal(null)} className="text-white hover:text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Razón</p>
              <p className="text-[#004370] font-medium">{RAZONES_LABEL[excusaModal.razon] || excusaModal.razon}</p>
            </div>

            {excusaModal.explicacion && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Explicación</p>
                <p className="text-gray-700 whitespace-pre-wrap">{excusaModal.explicacion}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Archivo adjunto</p>
              {excusaModal.archivo_nombre?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={excusaModal.archivo_url}
                  title="Comprobante de excusa"
                  className="w-full h-[60vh] border border-gray-200 rounded-lg"
                />
              ) : (
                <img
                  src={excusaModal.archivo_url}
                  alt="Comprobante de excusa"
                  className="max-w-full max-h-[60vh] rounded-lg border border-gray-200 mx-auto"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// Página Reportes
export default function ReportesPage() {
  const [eventos, setEventos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return <ReportesView eventos={eventos} todasPersonas={personas} />;
}
