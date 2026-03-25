/* ═══════════════════════════════════════════════════════════
   db.js  —  RAT Test App
   Responsabilidad:
     · Leer el CSV de base de datos desde GitHub (raw URL)
     · Parsear las filas
     · Seleccionar aleatoriamente N preguntas
     · Exportar getQuestions()
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────
   ⚙️  CONFIGURACIÓN DE LA BASE DE DATOS
   Modifica SOLO estas variables para
   apuntar a tu repositorio de GitHub
───────────────────────────────────────── */
const DB_CONFIG = {
  // URL raw de tu CSV en GitHub
  // Formato: https://raw.githubusercontent.com/{usuario}/{repo}/{rama}/{ruta}
  csvUrl: 'https://raw.githubusercontent.com/cesarl131481/RAT/main/data/rat_db.csv',

  // Número de preguntas a seleccionar por sesión
  numPreguntas: 5,

  // Separador del CSV (coma por defecto)
  separador: ',',

  // Índices de columnas (base 0):
  // 0: id | 1: palabra1 | 2: palabra2 | 3: palabra3 | 4: respuesta_correcta
  colId:      0,
  colPal1:    1,
  colPal2:    2,
  colPal3:    3,
  colRespuesta: 4,
};

/* ─────────────────────────────────────────
   CACHE en memoria (evita re-fetch en
   la misma sesión del navegador)
───────────────────────────────────────── */
let _cachedPreguntas = null;

/* ─────────────────────────────────────────
   parsearCSV(texto)
   Convierte el texto crudo del CSV en un
   array de objetos {id, palabra1, palabra2,
   palabra3, respuesta}
   Ignora líneas vacías y la cabecera
───────────────────────────────────────── */
function parsearCSV(texto) {
  const lineas = texto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lineas.length === 0) {
    throw new Error('El CSV está vacío.');
  }

  // Detectar si la primera fila es encabezado
  // (si la columna "id" no es numérica, la omitimos)
  const primeraFila = lineas[0].split(DB_CONFIG.separador);
  const inicioIndex = isNaN(Number(primeraFila[DB_CONFIG.colId].trim())) ? 1 : 0;

  const preguntas = [];

  for (let i = inicioIndex; i < lineas.length; i++) {
    const cols = lineas[i].split(DB_CONFIG.separador).map(c => c.trim());

    // Saltar filas incompletas
    if (cols.length < 5) continue;

    const id = Number(cols[DB_CONFIG.colId]);
    if (isNaN(id)) continue;

    preguntas.push({
      id:         id,
      palabra1:   cols[DB_CONFIG.colPal1].toUpperCase(),
      palabra2:   cols[DB_CONFIG.colPal2].toUpperCase(),
      palabra3:   cols[DB_CONFIG.colPal3].toUpperCase(),
      respuesta:  cols[DB_CONFIG.colRespuesta].toUpperCase(),
    });
  }

  if (preguntas.length === 0) {
    throw new Error('No se encontraron preguntas válidas en el CSV.');
  }

  return preguntas;
}

/* ─────────────────────────────────────────
   seleccionAleatoria(array, n)
   Fisher-Yates shuffle → toma los primeros n
───────────────────────────────────────── */
function seleccionAleatoria(array, n) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, Math.min(n, copia.length));
}

/* ─────────────────────────────────────────
   cargarTodasLasPreguntas()
   Fetch + parse + cacheo
   Retorna Promise<Array>
───────────────────────────────────────── */
async function cargarTodasLasPreguntas() {
  if (_cachedPreguntas) return _cachedPreguntas;

  const response = await fetch(DB_CONFIG.csvUrl, {
    cache: 'no-store', // Siempre trae la versión más reciente
  });

  if (!response.ok) {
    throw new Error(`No se pudo cargar el CSV (HTTP ${response.status}). Verifica la URL en DB_CONFIG.csvUrl`);
  }

  const texto = await response.text();
  _cachedPreguntas = parsearCSV(texto);
  return _cachedPreguntas;
}

/* ─────────────────────────────────────────
   getQuestions()  ← API PÚBLICA
   Retorna Promise<Array> con N preguntas
   seleccionadas aleatoriamente
   Cada elemento: {id, palabra1, palabra2,
   palabra3, respuesta}
───────────────────────────────────────── */
async function getQuestions() {
  const todas = await cargarTodasLasPreguntas();
  return seleccionAleatoria(todas, DB_CONFIG.numPreguntas);
}

/* ─────────────────────────────────────────
   getTotalPreguntas()
   Retorna el número de preguntas por sesión
   (útil para mostrar "X de Y" en la UI)
───────────────────────────────────────── */
function getTotalPreguntas() {
  return DB_CONFIG.numPreguntas;
}

/* ─────────────────────────────────────────
   Exponer para uso en app.js y storage.js
───────────────────────────────────────── */
window.RatDB = {
  getQuestions,
  getTotalPreguntas,
  DB_CONFIG,
};
