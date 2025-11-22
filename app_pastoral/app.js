// ---------- CONFIG: reemplaza por tus URLs ----------
const API_URL_DATOS = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhjAiLE1P0NRHTGOLa5Bn7q9IrB9xIb8nXpegpMggvpGXoWGkO3CFMAyoqzXWJXrU8rxQKhsd27tupqERomaOv-ZbI8AaWDo6ypDxM4cgHrKrdl6LLwydJuC_hrgQkIoSHA3fvskavKc40a2g6faxD6v8MS22XSQ7S0YS-lpcCHQzQbYnl93wNA29CirirxRupGxojka0UHYWB8u7URMdGRKkricVh0xuFHYI_LlVVK-kmiQSE5-2s-RSORKJMpWgk7TFX3S05P-M06N4XIHPmuAWCGfw&lib=MnAH8fqu9g11erGrSa4F4LaMmPaYUf86d";
const API_URL_ENVIO = "https://script.google.com/macros/s/AKfycbweAWKhZpfYFF-Od7UXegKPI8-vE5iIr7Z_rDH9HQ6fTsfdTo7usW5dUBadsJxxmrYJ/exec";
// ----------------------------------------------------

const $programa = document.getElementById("programa");
const $empleado = document.getElementById("empleado");
const $cedula = document.getElementById("cedula");
const $tipoSalida = document.getElementById("tipoSalida");
const $jornada = document.getElementById("jornada");
const $horaSalida = document.getElementById("horaSalida");
const $horaLlegada = document.getElementById("horaLlegada");
const $observaciones = document.getElementById("observaciones");
const $form = document.getElementById("registroForm");
const $btnEnviar = document.getElementById("btnEnviar");

let datos = {}; // guardamos lo que traemos del servidor

// helper para llenar selects a partir de un array de strings
function llenarSelectSimple(el, arr) {
  el.innerHTML = "<option value=''>Seleccione...</option>";
  if (!arr || !arr.length) return;
  arr.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    el.appendChild(o);
  });
}

// cargar catálogos (GET)
async function cargarDatos() {
  try {
    $btnEnviar.disabled = true;
    $btnEnviar.textContent = "Cargando...";

    const res = await fetch(API_URL_DATOS);
    const json = await res.json();
    console.log("👉 JSON catálogos:", json);
    datos = json;

    // programas
    $programa.innerHTML = "<option value=''>Seleccione...</option>";
    Object.keys(datos.programas || {}).forEach(p => {
      const o = document.createElement("option");
      o.value = p;
      o.textContent = p;
      $programa.appendChild(o);
    });

    // selects simples
    llenarSelectSimple($tipoSalida, datos.tiposSalida || []);
    llenarSelectSimple($jornada, datos.jornadas || []);
    llenarSelectSimple($horaSalida, datos.horasSalida || []);
    llenarSelectSimple($horaLlegada, datos.horasLlegada || []);

  } catch (err) {
    console.error("Error cargando catálogos:", err);
    Swal.fire("Error", "No se pudieron cargar los catálogos. Revisa la consola.", "error");
  } finally {
    $btnEnviar.disabled = false;
    $btnEnviar.textContent = "Enviar";
  }
}

// al elegir programa, cargar empleados
$programa.addEventListener("change", () => {
  const prog = $programa.value;
  const lista = (datos.programas && datos.programas[prog]) ? datos.programas[prog] : [];
  $empleado.innerHTML = "<option value=''>Seleccione...</option>";
  lista.forEach(emp => {
    const o = document.createElement("option");
    o.value = emp.cedula;      // usamos la cédula como value
    o.textContent = emp.nombre;
    $empleado.appendChild(o);
  });
  $cedula.value = "";
});

// al elegir empleado, autocompleta cédula
$empleado.addEventListener("change", () => {
  $cedula.value = $empleado.value || "";
});

/* ==========================
   VALIDACIÓN / COMPORTAMIENTO
   ========================== */

// detecta si la jornada es "completa" (case-insensitive, acepta variaciones)
function esJornadaCompleta(valor) {
  if (!valor) return false;
  return String(valor).toLowerCase().includes("compl"); // "Completa", "jornada completa", etc.
}

// convertir hora válida (hh:mm o hh:mm AM/PM) a minutos; devuelve NaN si no es hora válida
function horaToMinutos(hora) {
  if (!hora) return NaN;
  hora = String(hora).trim();

  // regex para hh:mm con opcional AM/PM
  const re = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i;
  const m = hora.match(re);
  if (!m) return NaN;

  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3] ? m[3].toUpperCase() : null;

  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;

  return h * 60 + min;
}

// Actualiza inputs al cambiar jornada: deshabilita o habilita y asigna valores por defecto si completa
function actualizarHorasSegunJornada() {
  const val = $jornada.value;
  if (esJornadaCompleta(val)) {
    // inhabilitar selects visualmente y quitar required
    $horaSalida.disabled = true;
    $horaLlegada.disabled = true;
    $horaSalida.required = false;
    $horaLlegada.required = false;

    // autollenar visualmente la hora de salida (puedes cambiarla)
    // dejamos horaLlegada vacía (en el payload la convertiremos a "No regresa")
    $horaSalida.value = "08:00";
    $horaLlegada.value = "";
  } else {
    // habilitar y exigir selección
    $horaSalida.disabled = false;
    $horaLlegada.disabled = false;
    $horaSalida.required = true;
    $horaLlegada.required = true;
  }
}

// validar que horaLlegada < horaSalida (se usa solo cuando jornada no es completa)
function validarHorasInputs() {
  if (esJornadaCompleta($jornada.value)) return true; // no validar en jornada completa

  const hs = $horaSalida.value;
  const hl = $horaLlegada.value;

  // deben existir ambas
  if (!hs || !hl) {
    Swal.fire("Atención", "Debe seleccionar hora de salida y hora de llegada.", "warning");
    return false;
  }

  const minsSalida = horaToMinutos(hs);
  const minsLlegada = horaToMinutos(hl);

  if (isNaN(minsSalida) || isNaN(minsLlegada)) {
    Swal.fire("Atención", "Formato de hora inválido.", "warning");
    return false;
  }

  // Nota: la regla pedida es "hora llegada no puede ser menor a la de salida"
  // Interpreto que horaLlegada debe ser posterior a horaSalida => minsLlegada > minsSalida
  if (minsLlegada <= minsSalida) {
    Swal.fire("Atención", "⏰ La hora de llegada debe ser posterior a la hora de salida.", "warning");
    return false;
  }

  return true;
}
///////////////////////////////
// listeners para aplicar comportamiento inmediatamente al cambiar jornada u horas
$jornada.addEventListener("change", actualizarHorasSegunJornada);

$horaSalida.addEventListener("change", () => {
  // solo validar si ambas horas ya tienen valor
  if (!esJornadaCompleta($jornada.value) && $horaSalida.value && $horaLlegada.value) {
    validarHorasInputs();
  }
});

$horaLlegada.addEventListener("change", () => {
  if (!esJornadaCompleta($jornada.value) && $horaSalida.value && $horaLlegada.value) {
    validarHorasInputs();
  }
});


/* ==========================
   ENVÍO FORMULARIO
   ========================== */

$form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // validación básica de campos obligatorios
  if (!$programa.value || !$empleado.value || !$tipoSalida.value || !$jornada.value) {
    Swal.fire("Atención", "Complete los campos obligatorios.", "warning");
    return;
  }

  // validar horas a menos que sea jornada completa
  if (!esJornadaCompleta($jornada.value)) {
    if (!validarHorasInputs()) return; // si falla, no enviar
  }

  // preparar valores finales para el payload
  let horaSalidaFinal = $horaSalida.value;
  let horaLlegadaFinal = $horaLlegada.value;

  if (esJornadaCompleta($jornada.value)) {
    // regla: cuando es completa definimos salida a las 08:00 y llegada = "No regresa"
    horaSalidaFinal = horaSalidaFinal || "08:00";
    horaLlegadaFinal = "No regresa";
  }

  const payload = {
    programa: $programa.value,
    empleado: $empleado.selectedOptions[0].textContent,
    cedula: $cedula.value,
    tipoSalida: $tipoSalida.value,
    jornada: $jornada.value,
    horaSalida: horaSalidaFinal,
    horaLlegada: horaLlegadaFinal,
    observaciones: $observaciones.value,
    fecha: new Date().toLocaleString()
  };

  try {
    $btnEnviar.disabled = true;
    $btnEnviar.textContent = "Enviando...";

    const res = await fetch(API_URL_ENVIO, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    let respuesta = null;
    try {
      respuesta = await res.json();
    } catch (err) {
      console.warn("No se pudo parsear JSON de respuesta:", err);
      respuesta = null;
    }
    console.log("Respuesta del servidor:", respuesta);

    if (respuesta && (respuesta.result === "success" || respuesta.status === "ok" || respuesta.ok === true)) {
      Swal.fire("Éxito", "Registro guardado correctamente.", "success");
      $form.reset();
      $cedula.value = "";
      // asegurar que selects de hora queden habilitados al reset si la jornada no lo determina
      actualizarHorasSegunJornada();
    } else {
      const msg = respuesta ? JSON.stringify(respuesta) : `HTTP ${res.status}`;
      Swal.fire("Error", "No se pudo guardar. " + msg, "error");
    }

  } catch (err) {
    console.error("Error enviando registro:", err);
    Swal.fire("Error", "No se pudo conectar con el servidor. Revisa la consola.", "error");
  } finally {
    $btnEnviar.disabled = false;
    $btnEnviar.textContent = "Enviar";
  }
});

// iniciar
cargarDatos();
// inicializamos estado de horas por si la jornada tiene valor por defecto
setTimeout(actualizarHorasSegunJornada, 250);


