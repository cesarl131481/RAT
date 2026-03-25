/* ============================================================
   storage.js — Escritura de respuestas vía Google Apps Script
   Concurrencia segura con LockService de Google
   RAT Test App · Universidad
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────────────────────
//  ⚙️  CONFIGURACIÓN — solo debes cambiar estos valores
//
//  SHEETS_ENDPOINT: URL de tu Web App de Google Apps Script
//  La obtienes en: Apps Script → Implementar → Nueva implementación
//  → Aplicación web → Copiar URL
//
//  Formato: https://script.google.com/macros/s/XXXXX.../exec
// ─────────────────────────────────────────────────────────────
const SHEETS_CONFIG = {
  endpoint: 'https://script.google.com/macros/s/TU_ID_DEL_SCRIPT/exec',

  // Reintentos ante error de red (no de concurrencia, eso lo maneja Google)
  maxReintentos:  3,
  esperaBaseMs:   500,   // ms entre reintentos de red
};

// ─────────────────────────────────────────────────────────────
//  Encabezados del CSV / columnas de la hoja
//  Deben coincidir exactamente con la fila 1 de tu Google Sheet
// ─────────────────────────────────────────────────────────────
const COLUMNAS = [
  'timestamp',
  'nombre',
  'id_usuario',
  'pregunta_id',
  'palabra1',
  'palabra2',
  'palabra3',
  'respuesta_usuario',
  'respuesta_correcta',
  'correcto',
  'tiempo_segundos',
];

// ─────────────────────────────────────────────────────────────
//  Construir una fila como array (orden = COLUMNAS)
// ─────────────────────────────────────────────────────────────
function buildRow(userData, question, userAnswer, isCorrect, tiempoSegundos) {
  return [
    new Date().toISOString(),                        // timestamp
    userData.nombre,                                 // nombre
    userData.idUsuario,                              // id_usuario
    question.id,                                     // pregunta_id
    question.palabra1,                               // palabra1
    question.palabra2,                               // palabra2
    question.palabra3,                               // palabra3
    userAnswer ? userAnswer.toUpperCase() : '',      // respuesta_usuario
    question.respuesta,                              // respuesta_correcta
    isCorrect ? 'CORRECTO' : 'INCORRECTO',           // correcto
    tiempoSegundos,                                  // tiempo_segundos
  ];
}

// ─────────────────────────────────────────────────────────────
//  Espera simple entre reintentos de red
// ─────────────────────────────────────────────────────────────
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
//  Enviar filas al Apps Script con reintento ante error de red
// ─────────────────────────────────────────────────────────────
async function enviarASheets(rows) {
  const payload = JSON.stringify({ rows });
  let ultimoError = null;

  for (let intento = 0; intento < SHEETS_CONFIG.maxReintentos; intento++) {

    if (intento > 0) {
      const espera = SHEETS_CONFIG.esperaBaseMs * intento;
      console.warn(`[storage.js] Reintento de red ${intento}/${SHEETS_CONFIG.maxReintentos - 1} en ${espera}ms...`);
      await esperar(espera);
    }

    try {
      // Google Apps Script requiere no-cors cuando se llama desde un dominio distinto.
      // Usamos mode: 'no-cors' lo que significa que no podemos leer la respuesta,
      // pero la escritura en Sheets sí ocurre correctamente.
      // Para verificar el éxito usamos el bloque catch: si no lanza error, fue exitoso.
      const response = await fetch(SHEETS_CONFIG.endpoint, {
        method:  'POST',
        mode:    'no-cors',       // requerido por Google Apps Script
        headers: { 'Content-Type': 'text/plain' },
        body:    payload,
      });

      // Con no-cors, response.type === 'opaque' y no podemos leer el cuerpo.
      // Si llegamos aquí sin excepción, la solicitud se envió correctamente.
      console.log(`[storage.js] ✅ Datos enviados a Google Sheets (intento ${intento + 1}).`);
      return { success: true };

    } catch (err) {
      ultimoError = err;
      console.error(`[storage.js] Error de red en intento ${intento + 1}:`, err.message);
    }
  }

  // Todos los reintentos fallaron
  throw new Error(`Error de red tras ${SHEETS_CONFIG.maxReintentos} intentos: ${ultimoError?.message}`);
}

// ─────────────────────────────────────────────────────────────
//  FUNCIÓN PRINCIPAL: guardar todas las respuestas de una sesión
// ─────────────────────────────────────────────────────────────
async function saveResponses(userData, responses) {
  console.log(`[storage.js] Guardando ${responses.length} respuestas para: ${userData.nombre}`);

  // Construir array de filas
  const rows = responses.map(r =>
    buildRow(userData, r.question, r.userAnswer, r.isCorrect, r.tiempoSegundos)
  );

  try {
    const resultado = await enviarASheets(rows);
    console.log('[storage.js] ✅ Respuestas guardadas en Google Sheets.');
    return { success: true };

  } catch (error) {
    console.error('[storage.js] ❌ Fallo definitivo al enviar a Sheets:', error.message);

    // Respaldo local si Google Sheets falla
    saveLocalBackup(userData, responses);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────
//  Respaldo local en localStorage (si Sheets falla totalmente)
// ─────────────────────────────────────────────────────────────
function saveLocalBackup(userData, responses) {
  try {
    const key = `rat_backup_${userData.idUsuario}_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify({
      timestamp: new Date().toISOString(),
      usuario:   userData,
      responses,
    }));
    console.warn('[storage.js] ⚠️  Respaldo guardado en localStorage:', key);
  } catch (e) {
    console.error('[storage.js] No se pudo guardar respaldo local:', e);
  }
}

// ─────────────────────────────────────────────────────────────
//  Descargar CSV localmente (botón de descarga manual)
// ─────────────────────────────────────────────────────────────
function downloadResponsesCSV(userData, responses) {
  const header = COLUMNAS.join(',') + '\n';

  const rows = responses.map(r => {
    const fila = buildRow(userData, r.question, r.userAnswer, r.isCorrect, r.tiempoSegundos);
    return fila.map(v => {
      const str = String(v ?? '');
      return (str.includes(',') || str.includes('"') || str.includes('\n'))
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',');
  }).join('\n');

  const content  = header + rows;
  const blob     = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const filename = `rat_${userData.idUsuario}_${new Date().toISOString().slice(0, 10)}.csv`;

  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('[storage.js] CSV descargado localmente:', filename);
}

// ─────────────────────────────────────────────────────────────
//  Exportar funciones públicas
// ─────────────────────────────────────────────────────────────
window.RATStorage = {
  saveResponses,
  downloadResponsesCSV,
};
