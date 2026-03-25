/* ═══════════════════════════════════════════════════════════
   app.js  —  RAT Test App
   Responsabilidad:
     · Estado global de la aplicación
     · Flujo de pantallas
     · Temporizador por pregunta
     · Validación de respuestas
     · Orquestación de db.js y storage.js
     · Canvas de partículas de fondo
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────
   ⏱️  CONFIGURACIÓN DEL TEMPORIZADOR
   Modifica SOLO este bloque para cambiar
   el tiempo disponible por pregunta
───────────────────────────────────────── */
const CONFIG = {
  tiempoPorPregunta: 60,   // ← segundos por pregunta (ej: 30, 60, 90, 120)
  totalPreguntas:    5,    // ← cuántas preguntas se seleccionan del CSV
                           //   (debe coincidir con DB_CONFIG.numPreguntas)

  // Umbrales del timer (en segundos) para cambiar color
  umbralWarning: 20,       // ← por debajo de esto → naranja/ámbar
  umbralDanger:  10,       // ← por debajo de esto → rojo/coral

  // Tiempo (ms) que se muestra el feedback antes de avanzar
  feedbackDuration: 1500,
};

/* ─────────────────────────────────────────
   ESTADO GLOBAL
───────────────────────────────────────── */
const Estado = {
  usuario: {
    nombre:    '',
    idUsuario: '',
  },
  preguntas:        [],   // Array de {id, palabra1, palabra2, palabra3, respuesta}
  preguntaActual:   0,    // Índice actual (0 a totalPreguntas-1)
  respuestas:       [],   // Respuestas acumuladas del usuario
  timer:            null, // Referencia al setInterval del timer
  segundosRestantes: 0,
  timerCircumference: 125.66, // 2π × r(20)
  bloqueado:        false, // Evita doble submit
};

/* ─────────────────────────────────────────
   REFERENCIAS AL DOM
───────────────────────────────────────── */
const DOM = {
  // Pantallas
  screens: {
    login:        document.getElementById('screen-login'),
    instructions: document.getElementById('screen-instructions'),
    question:     document.getElementById('screen-question'),
    results:      document.getElementById('screen-results'),
  },
  // Login
  inputName:      document.getElementById('input-name'),
  inputId:        document.getElementById('input-id'),
  errName:        document.getElementById('err-name'),
  errId:          document.getElementById('err-id'),
  btnLogin:       document.getElementById('btn-login'),
  // Instrucciones
  btnStart:       document.getElementById('btn-start'),
  instTime:       document.getElementById('inst-time'),
  // Pregunta
  qCurrent:       document.getElementById('q-current'),
  qTotal:         document.getElementById('q-total'),
  qProgressFill:  document.getElementById('q-progress-fill'),
  ringFill:       document.getElementById('ring-fill'),
  timerNum:       document.getElementById('timer-num'),
  qTimer:         document.getElementById('q-timer'),
  word0:          document.getElementById('word-0'),
  word1:          document.getElementById('word-1'),
  word2:          document.getElementById('word-2'),
  answerInput:    document.getElementById('answer-input'),
  btnNext:        document.getElementById('btn-next'),
  btnNextText:    document.getElementById('btn-next-text'),
  qFeedback:      document.getElementById('q-feedback'),
  feedbackInner:  document.getElementById('feedback-inner'),
  feedbackIcon:   document.getElementById('feedback-icon'),
  feedbackMsg:    document.getElementById('feedback-msg'),
  feedbackCorrect:document.getElementById('feedback-correct'),
  // Resultados
  scoreNum:       document.getElementById('score-num'),
  srFill:         document.getElementById('sr-fill'),
  resultsTitle:   document.getElementById('results-title'),
  resultsSubtitle:document.getElementById('results-subtitle'),
  resultsTbody:   document.getElementById('results-tbody'),
  btnSave:        document.getElementById('btn-save'),
  btnRetry:       document.getElementById('btn-retry'),
  saveStatus:     document.getElementById('save-status'),
  // Overlay
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingMsg:     document.getElementById('loading-msg'),
};

/* ═══════════════════════════════════════
   NAVEGACIÓN ENTRE PANTALLAS
═══════════════════════════════════════ */
function irA(nombrePantalla) {
  // Ocultar todas
  Object.values(DOM.screens).forEach(screen => {
    if (screen.classList.contains('active')) {
      screen.classList.add('exit');
      screen.classList.remove('active');
      setTimeout(() => screen.classList.remove('exit'), 650);
    }
  });

  // Mostrar la destino
  setTimeout(() => {
    const destino = DOM.screens[nombrePantalla];
    if (destino) destino.classList.add('active');
  }, 150);
}

/* ═══════════════════════════════════════
   LOADING OVERLAY
═══════════════════════════════════════ */
function mostrarLoading(msg = 'Cargando preguntas...') {
  DOM.loadingMsg.textContent = msg;
  DOM.loadingOverlay.classList.remove('hidden');
}

function ocultarLoading() {
  DOM.loadingOverlay.classList.add('hidden');
}

/* ═══════════════════════════════════════
   PANTALLA 1 — LOGIN
═══════════════════════════════════════ */
function iniciarLogin() {
  // Quitar errores al escribir
  DOM.inputName.addEventListener('input', () => {
    DOM.inputName.classList.remove('error');
    DOM.errName.textContent = '';
  });
  DOM.inputId.addEventListener('input', () => {
    DOM.inputId.classList.remove('error');
    DOM.errId.textContent = '';
  });

  // Enter avanza al siguiente campo o envía
  DOM.inputName.addEventListener('keydown', e => {
    if (e.key === 'Enter') DOM.inputId.focus();
  });
  DOM.inputId.addEventListener('keydown', e => {
    if (e.key === 'Enter') DOM.btnLogin.click();
  });

  DOM.btnLogin.addEventListener('click', manejarLogin);
}

function manejarLogin() {
  const nombre    = DOM.inputName.value.trim();
  const idUsuario = DOM.inputId.value.trim();
  let hayError    = false;

  // Validar nombre
  if (nombre.length < 3) {
    DOM.inputName.classList.add('error', 'shake');
    DOM.errName.textContent = 'Ingresa tu nombre completo (mín. 3 caracteres).';
    setTimeout(() => DOM.inputName.classList.remove('shake'), 500);
    hayError = true;
  }

  // Validar ID
  if (idUsuario.length < 2) {
    DOM.inputId.classList.add('error', 'shake');
    DOM.errId.textContent = 'Ingresa tu código universitario.';
    setTimeout(() => DOM.inputId.classList.remove('shake'), 500);
    hayError = true;
  }

  if (hayError) return;

  // Guardar en estado
  Estado.usuario.nombre    = nombre;
  Estado.usuario.idUsuario = idUsuario;

  // Ir a instrucciones
  irA('instructions');
}

/* ═══════════════════════════════════════
   PANTALLA 2 — INSTRUCCIONES
═══════════════════════════════════════ */
function iniciarInstrucciones() {
  // Mostrar tiempo configurado
  DOM.instTime.textContent = `${CONFIG.tiempoPorPregunta} segundos`;

  DOM.btnStart.addEventListener('click', async () => {
    mostrarLoading('Cargando preguntas...');

    try {
      // Cargar preguntas desde GitHub
      const preguntas = await window.RatDB.getQuestions();
      Estado.preguntas      = preguntas;
      Estado.preguntaActual = 0;
      Estado.respuestas     = [];

      ocultarLoading();
      irA('question');

      // Pequeño delay para que la transición de pantalla se vea antes de cargar
      setTimeout(() => cargarPregunta(0), 200);

    } catch (error) {
      ocultarLoading();
      mostrarError(`No se pudieron cargar las preguntas: ${error.message}`);
    }
  });
}

/* ═══════════════════════════════════════
   PANTALLA 3 — PREGUNTA
═══════════════════════════════════════ */
function cargarPregunta(indice) {
  const pregunta = Estado.preguntas[indice];
  if (!pregunta) return;

  Estado.bloqueado = false;

  // Actualizar indicador de progreso
  DOM.qCurrent.textContent = indice + 1;
  DOM.qTotal.textContent   = CONFIG.totalPreguntas;

  const porcentaje = (indice / CONFIG.totalPreguntas) * 100;
  DOM.qProgressFill.style.width = `${porcentaje}%`;

  // Mostrar palabras — reset animación primero
  const cards = [document.getElementById('wc-0'), document.getElementById('wc-1'), document.getElementById('wc-2')];
  cards.forEach(c => {
    c.style.opacity   = '0';
    c.style.transform = 'translateY(15px) scale(0.95)';
  });

  DOM.word0.textContent = pregunta.palabra1;
  DOM.word1.textContent = pregunta.palabra2;
  DOM.word2.textContent = pregunta.palabra3;

  // Forzar re-render para que la animación se active
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cards.forEach(c => {
        c.style.opacity   = '';
        c.style.transform = '';
      });
    });
  });

  // Limpiar y enfocar input
  DOM.answerInput.value = '';
  DOM.answerInput.disabled = false;
  setTimeout(() => {
    // Solo enfocar en desktop (evitar teclado virtual molesto en móvil)
    if (window.innerWidth > 768) DOM.answerInput.focus();
  }, 500);

  // Texto del botón
  const esUltima = indice === CONFIG.totalPreguntas - 1;
  DOM.btnNextText.textContent = esUltima ? 'Finalizar' : 'Siguiente';

  // Ocultar feedback anterior
  DOM.qFeedback.classList.add('hidden');
  DOM.qFeedback.classList.remove('show');

  // Iniciar temporizador
  iniciarTimer();
}

/* ─── TEMPORIZADOR ─── */
function iniciarTimer() {
  detenerTimer();

  Estado.segundosRestantes = CONFIG.tiempoPorPregunta;
  actualizarUI_Timer(Estado.segundosRestantes);

  Estado.timer = setInterval(() => {
    Estado.segundosRestantes--;
    actualizarUI_Timer(Estado.segundosRestantes);

    if (Estado.segundosRestantes <= 0) {
      detenerTimer();
      if (!Estado.bloqueado) {
        // Tiempo agotado → registrar como sin respuesta y avanzar
        manejarRespuesta(true);
      }
    }
  }, 1000);
}

function detenerTimer() {
  if (Estado.timer) {
    clearInterval(Estado.timer);
    Estado.timer = null;
  }
}

function actualizarUI_Timer(segundos) {
  DOM.timerNum.textContent = segundos;

  // Calcular offset del arco
  const progreso = segundos / CONFIG.tiempoPorPregunta;
  const offset   = Estado.timerCircumference * (1 - progreso);
  DOM.ringFill.style.strokeDashoffset = offset;

  // Clases de color según umbral
  DOM.ringFill.classList.remove('warning', 'danger');
  DOM.timerNum.classList.remove('warning', 'danger');
  DOM.qTimer.classList.remove('danger-pulse');

  if (segundos <= CONFIG.umbralDanger) {
    DOM.ringFill.classList.add('danger');
    DOM.timerNum.classList.add('danger');
    DOM.qTimer.classList.add('danger-pulse');
  } else if (segundos <= CONFIG.umbralWarning) {
    DOM.ringFill.classList.add('warning');
    DOM.timerNum.classList.add('warning');
  }
}

/* ─── SUBMIT DE RESPUESTA ─── */
function manejarRespuesta(porTiempo = false) {
  if (Estado.bloqueado) return;
  Estado.bloqueado = true;
  detenerTimer();

  const pregunta          = Estado.preguntas[Estado.preguntaActual];
  const respuestaUsuario  = DOM.answerInput.value.trim().toUpperCase();
  const respuestaCorrecta = pregunta.respuesta.toUpperCase();
  const correcto          = respuestaUsuario === respuestaCorrecta && respuestaUsuario.length > 0;

  // Guardar en estado
  Estado.respuestas.push({
    preguntaId:         pregunta.id,
    palabra1:           pregunta.palabra1,
    palabra2:           pregunta.palabra2,
    palabra3:           pregunta.palabra3,
    respuestaUsuario:   respuestaUsuario || '(sin respuesta)',
    respuestaCorrecta:  respuestaCorrecta,
    correcto:           correcto,
  });

  // Deshabilitar input
  DOM.answerInput.disabled = true;

  // Avanzar inmediatamente (sin mostrar correcto/incorrecto)
   const siguiente = Estado.preguntaActual + 1;

   if (siguiente < CONFIG.totalPreguntas) {
     Estado.preguntaActual = siguiente;
     cargarPregunta(siguiente);
   } else {
     // Fin de la prueba
     mostrarResultados();
   }
}

function mostrarFeedback(correcto, respuestaCorrecta, porTiempo) {
  DOM.qFeedback.classList.remove('hidden');

  requestAnimationFrame(() => {
    DOM.qFeedback.classList.add('show');
    DOM.feedbackInner.className = `feedback-inner ${correcto ? 'correct' : 'incorrect'}`;

    if (porTiempo && !correcto) {
      DOM.feedbackIcon.textContent  = '⏰';
      DOM.feedbackMsg.textContent   = '¡Tiempo agotado!';
    } else if (correcto) {
      DOM.feedbackIcon.textContent  = '✓';
      DOM.feedbackMsg.textContent   = '¡Correcto!';
    } else {
      DOM.feedbackIcon.textContent  = '✗';
      DOM.feedbackMsg.textContent   = 'Incorrecto';
    }

    DOM.feedbackCorrect.textContent = correcto
      ? ''
      : `La respuesta era: ${respuestaCorrecta}`;
  });
}

function ocultarFeedback() {
  DOM.qFeedback.classList.remove('show');
  setTimeout(() => DOM.qFeedback.classList.add('hidden'), 300);
}

function iniciarPregunta() {
  // Enter en el input equivale a click en "Siguiente"
  DOM.answerInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !Estado.bloqueado) {
      DOM.btnNext.click();
    }
  });

  DOM.btnNext.addEventListener('click', () => {
    if (!Estado.bloqueado) manejarRespuesta(false);
  });
}

/* ═══════════════════════════════════════
   PANTALLA 4 — RESULTADOS
═══════════════════════════════════════ */
function mostrarResultados() {
  irA('results');

  const correctas = Estado.respuestas.filter(r => r.correcto).length;
  const total     = Estado.respuestas.length;

  // Puntuación numérica
  DOM.scoreNum.textContent = correctas;

  // Aro de puntuación animado
  const porcentaje = correctas / total;
  const offset     = 314.16 * (1 - porcentaje);
  setTimeout(() => {
    DOM.srFill.style.strokeDashoffset = offset;
    // Color según puntaje
    if (porcentaje >= 0.8) {
      DOM.srFill.style.stroke = 'var(--clr-lime)';
    } else if (porcentaje >= 0.5) {
      DOM.srFill.style.stroke = 'var(--clr-amber)';
    } else {
      DOM.srFill.style.stroke = 'var(--clr-coral)';
    }
  }, 300);

  // Mensaje de resultado
  const mensajes = [
    { min: 5, titulo: '¡Excepcional!',  sub: 'Pensamiento divergente sobresaliente.' },
    { min: 4, titulo: '¡Muy bien!',     sub: 'Excelente capacidad de asociación.' },
    { min: 3, titulo: 'Bien hecho',     sub: 'Buen resultado. ¡Sigue practicando!' },
    { min: 2, titulo: 'Puedes mejorar', sub: 'Continúa entrenando tu creatividad.' },
    { min: 0, titulo: 'Sigue intentando', sub: 'Cada intento fortalece tu mente.' },
  ];

  const m = mensajes.find(x => correctas >= x.min);
  DOM.resultsTitle.textContent   = m.titulo;
  DOM.resultsSubtitle.textContent = `${correctas} de ${total} correctas — ${m.sub}`;

  // Tabla de respuestas
  DOM.resultsTbody.innerHTML = '';
  Estado.respuestas.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="td-words">${r.palabra1} · ${r.palabra2} · ${r.palabra3}</td>
      <td class="td-user ${r.correcto ? 'correct' : 'incorrect'}">${r.respuestaUsuario}</td>
      <td class="td-correct">${r.respuestaCorrecta}</td>
      <td><span class="td-badge ${r.correcto ? 'ok' : 'no'}">${r.correcto ? '✓' : '✗'}</span></td>
    `;
    DOM.resultsTbody.appendChild(tr);
  });

  // Estado del botón guardar
  DOM.saveStatus.textContent = '';
  DOM.saveStatus.className   = 'save-status';
  DOM.btnSave.disabled       = false;
}

function iniciarResultados() {
  DOM.btnSave.addEventListener('click', async () => {
    DOM.btnSave.disabled     = true;
    DOM.btnSave.classList.add('loading');
    DOM.saveStatus.textContent = 'Guardando...';
    DOM.saveStatus.className   = 'save-status';

    try {
      await window.RatStorage.guardarRespuestas(
        Estado.usuario,
        Estado.respuestas
      );
      DOM.saveStatus.textContent = '✓ Respuestas guardadas correctamente.';
      DOM.saveStatus.className   = 'save-status success';
    } catch (error) {
      DOM.saveStatus.textContent = `✗ Error al guardar: ${error.message}`;
      DOM.saveStatus.className   = 'save-status error';
      DOM.btnSave.disabled       = false;
    }

    DOM.btnSave.classList.remove('loading');
  });

  DOM.btnRetry.addEventListener('click', () => {
    // Resetear estado
    Estado.preguntaActual  = 0;
    Estado.respuestas      = [];
    Estado.preguntas       = [];

    // Limpiar inputs
    DOM.inputName.value  = '';
    DOM.inputId.value    = '';
    DOM.answerInput.value = '';
    DOM.errName.textContent = '';
    DOM.errId.textContent   = '';
    DOM.inputName.classList.remove('error');
    DOM.inputId.classList.remove('error');

    irA('login');
  });
}

/* ═══════════════════════════════════════
   CANVAS — PARTÍCULAS DE FONDO
═══════════════════════════════════════ */
function iniciarCanvas() {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let w, h, particulas;

  const COLORES = ['#00e5ff', '#b8ff57', '#ffd166', '#a78bfa'];

  function resize() {
    w = canvas.width  = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function crearParticulas(n = 60) {
    return Array.from({ length: n }, () => ({
      x:     Math.random() * w,
      y:     Math.random() * h,
      r:     Math.random() * 1.5 + 0.3,
      vx:    (Math.random() - 0.5) * 0.3,
      vy:    (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.4 + 0.05,
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
    }));
  }

  function dibujar() {
    ctx.clearRect(0, 0, w, h);

    particulas.forEach(p => {
      // Mover
      p.x += p.vx;
      p.y += p.vy;

      // Rebotar en bordes
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      // Dibujar
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    });

    ctx.globalAlpha = 1;

    // Conexiones entre partículas cercanas
    for (let i = 0; i < particulas.length; i++) {
      for (let j = i + 1; j < particulas.length; j++) {
        const dx   = particulas[i].x - particulas[j].x;
        const dy   = particulas[i].y - particulas[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particulas[i].x, particulas[i].y);
          ctx.lineTo(particulas[j].x, particulas[j].y);
          ctx.strokeStyle = 'rgba(0,229,255,0.06)';
          ctx.lineWidth   = 0.5;
          ctx.globalAlpha = 1 - dist / 100;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    requestAnimationFrame(dibujar);
  }

  resize();
  particulas = crearParticulas();
  dibujar();

  window.addEventListener('resize', () => {
    resize();
    particulas = crearParticulas();
  });
}

/* ═══════════════════════════════════════
   UTILIDADES
═══════════════════════════════════════ */
function mostrarError(msg) {
  // Alerta estilizada en consola y UI básica
  console.error('[RAT App]', msg);
  alert(`Error: ${msg}`);
}

/* ═══════════════════════════════════════
   INICIALIZACIÓN
═══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Canvas de fondo
  iniciarCanvas();

  // Inicializar cada módulo de pantalla
  iniciarLogin();
  iniciarInstrucciones();
  iniciarPregunta();
  iniciarResultados();

  // Pantalla inicial
  irA('login');

  // Ocultar overlay de carga inicial
  setTimeout(ocultarLoading, 300);
});
