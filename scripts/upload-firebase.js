const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyBi-Vov88w4i865GBXyWfpxcEYe4dCq0YE",
  authDomain: "evento-asistencia.firebaseapp.com",
  projectId: "evento-asistencia",
  storageBucket: "evento-asistencia.firebasestorage.app",
  messagingSenderId: "780785187524",
  appId: "1:780785187524:web:749976b418c83a799a2791"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadCSV() {
  const csv = fs.readFileSync('./personas_rows.csv', 'utf-8');
  const lines = csv.split('\n').filter(line => line.trim());
  
  console.log(`Total de líneas: ${lines.length}`);
  console.log(`Headers: ${lines[0]}`);
  console.log(`Subiendo ${lines.length - 1} registros a Firebase...\n`);
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    
    // id,codigo_empleado,nombres,apellidos,correo_electronico,qr_code,activo,department,manager,hiring_date
    const persona = {
      codigo_empleado: parseInt(values[1]) || 0,
      nombres: values[2] || '',
      apellidos: values[3] || '',
      correo_electronico: values[4] || '',
      qr_code: parseInt(values[5]) || 0,
      activo: values[6] === 'true',
      department: values[7] || null,
      manager: values[8] || null,
      hiring_date: values[9] || null
    };
    
    await addDoc(collection(db, 'personas'), persona);
    
    if (i % 50 === 0) {
      console.log(`✓ Subidos ${i} de ${lines.length - 1}...`);
    }
  }
  
  console.log('\n✅ ¡Completado! Todos los registros fueron subidos.');
  process.exit(0);
}

uploadCSV().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});