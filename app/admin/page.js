'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminDashboard() {
  const [personas, setPersonas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [personasRes, eventosRes] = await Promise.all([
      supabase.from('personas').select('*').order('nombres'),
      supabase.from('eventos').select('*').order('fecha', { ascending: false })
    ]);
    
    setPersonas(personasRes.data || []);
    setEventos(eventosRes.data || []);
    setLoading(false);
  }

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard Admin</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Eventos */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Eventos</h2>
          <div className="space-y-2">
            {eventos.map(e => (
              <div key={e.id} className="p-3 border rounded">
                <div className="font-medium">{e.nombre}</div>
                <div className="text-sm text-gray-600">{e.fecha}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Personas */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Personas ({personas.length})</h2>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {personas.slice(0, 10).map(p => (
              <div key={p.id} className="p-2 border-b text-sm">
                {p.nombres} {p.apellidos}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}