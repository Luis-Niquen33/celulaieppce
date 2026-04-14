const defaultCelulas = [];

const defaultUsers = [
  {
    id: "u-admin",
    nombre: "Administrador",
    username: "admin",
    password: "admin123",
    rol: "admin",
    celulaId: null
  }
];

const defaultMiembros = [];

const APP_VERSION = "20260408-2";

const DB_PATH = "asistenciaCelula";

let firebaseApp = null;
let firebaseDb = null;
let firebaseInicializado = false;
let cargandoDesdeNube = false;
let guardadoNubePendiente = Promise.resolve();

function firebaseDisponible() {
  return !!(globalThis.firebase && globalThis.FIREBASE_CONFIG?.databaseURL);
}

function inicializarFirebase() {
  if (firebaseInicializado) return !!firebaseDb;
  firebaseInicializado = true;

  if (!firebaseDisponible()) {
    return false;
  }

  try {
    firebaseApp = globalThis.firebase.apps?.length
      ? globalThis.firebase.app()
      : globalThis.firebase.initializeApp(globalThis.FIREBASE_CONFIG);
    firebaseDb = globalThis.firebase.database(firebaseApp);
    return true;
  } catch (error) {
    console.error("No se pudo inicializar Firebase:", error);
    firebaseDb = null;
    return false;
  }
}

function loadJson(key, fallback) {
  return JSON.parse(localStorage.getItem(key)) || fallback;
}

function normalizarEstado(data) {
  if (!data || typeof data !== "object") return null;
  return {
    celulas: Array.isArray(data.celulas) && data.celulas.length ? data.celulas : defaultCelulas,
    users: Array.isArray(data.users) && data.users.length ? data.users : defaultUsers,
    miembros: Array.isArray(data.miembros) ? data.miembros : defaultMiembros,
    fechas: Array.isArray(data.fechas) ? data.fechas : [],
    asistencias: data.asistencias && typeof data.asistencias === "object" ? data.asistencias : {},
    sesion: data.sesion ?? null
  };
}

let celulas = loadJson("celulas", defaultCelulas);
let users = loadJson("users", defaultUsers);
let sesion = loadJson("sesion", null);

const _rawMiembros = loadJson("miembros", defaultMiembros);
let miembros = _rawMiembros.map((m) => ({
  nacimiento: "",
  celular: "",
  celulaId: celulas[0]?.id || "cel-1",
  ...m
}));

const _rawFechas = loadJson("fechas", []);
let fechas = _rawFechas.map((f) => {
  if (typeof f === "string") {
    return { celulaId: celulas[0]?.id ?? null, fecha: f, leccion: "", ofrenda: 0 };
  }

  return {
    celulaId: celulas[0]?.id ?? null,
    leccion: "",
    docente: "",
    ofrenda: 0,
    ...f
  };
});

let asistencias = loadJson("asistencias", {});

function eliminarCelulaCentralAntigua() {
  const centralId = "cel-1";
  const centralName = "Célula Central";
  const existeCentral = celulas.some((c) => c.id === centralId || c.nombre === centralName);
  if (!existeCentral) return;

  celulas = celulas.filter((c) => c.id !== centralId && c.nombre !== centralName);
  users = users.map((u) => (u.celulaId === centralId ? { ...u, celulaId: null } : u));
  miembros = miembros.map((m) => (m.celulaId === centralId ? { ...m, celulaId: null } : m));
  fechas = fechas.map((f) => (f.celulaId === centralId ? { ...f, celulaId: null } : f));
  Object.keys(asistencias).forEach((key) => {
    if (key.startsWith(`${centralId}-`)) delete asistencias[key];
  });
}

eliminarCelulaCentralAntigua();

function migrarAsistenciasAntiguas() {
  const celulaPorDefecto = celulas[0]?.id;
  const nuevo = {};
  Object.entries(asistencias).forEach(([key, value]) => {
    const partes = key.split("-");
    if (partes.length === 2 && celulaPorDefecto) {
      nuevo[`${celulaPorDefecto}-${key}`] = value;
    } else {
      nuevo[key] = value;
    }
  });
  asistencias = nuevo;
}

const vistaLogin = document.getElementById("vistaLogin");
const vistaInicio = document.getElementById("vistaInicio");
const vistaAsistencia = document.getElementById("vistaAsistencia");

const formLogin = document.getElementById("formLogin");
const loginUsuario = document.getElementById("loginUsuario");
const loginClave = document.getElementById("loginClave");
const loginError = document.getElementById("loginError");
const btnCerrarSesion = document.getElementById("btnCerrarSesion");
const textoSesion = document.getElementById("textoSesion");
const usuarioSuperior = document.getElementById("usuarioSuperior");

const btnNavDashboard = document.getElementById("btnNavDashboard");
const btnNavReportes = document.getElementById("btnNavReportes");
const btnNavIntegrantes = document.getElementById("btnNavIntegrantes");
const btnNavMiembros = document.getElementById("btnNavMiembros");
const btnNavFechas = document.getElementById("btnNavFechas");
const btnNavAsistencia = document.getElementById("btnNavAsistencia");
const btnNavAdmin = document.getElementById("btnNavAdmin");
const btnLimpiarTodo = document.getElementById("btnLimpiarTodo");

const filtroCelulaDashboard = document.getElementById("filtroCelulaDashboard");
const filtroLiderDashboard = document.getElementById("filtroLiderDashboard");
const filtroFechaDashboard = document.getElementById("filtroFechaDashboard");
const filtroMesDashboard = document.getElementById("filtroMesDashboard");
const dashResumen = document.getElementById("dashResumen");
const dashTarjetas = document.getElementById("dashTarjetas");
const resumenFiltrosReporte = document.getElementById("resumenFiltrosReporte");
const previewReporte = document.getElementById("previewReporte");
const btnExportarPdfReporte = document.getElementById("btnExportarPdfReporte");
const filtroCelulaReporte = document.getElementById("filtroCelulaReporte");
const filtroLiderReporte = document.getElementById("filtroLiderReporte");
const filtroMesReporte = document.getElementById("filtroMesReporte");
const filtroFechaReporte = document.getElementById("filtroFechaReporte");

const formIntegrante = document.getElementById("formIntegrante");
const nombreIntegrante = document.getElementById("nombreIntegrante");
const tipoIntegrante = document.getElementById("tipoIntegrante");
const nacimientoIntegrante = document.getElementById("nacimientoIntegrante");
const celularIntegrante = document.getElementById("celularIntegrante");
const ingresoIntegrante = document.getElementById("ingresoIntegrante");
const editandoId = document.getElementById("editandoId");
const btnGuardarIntegrante = document.getElementById("btnGuardarIntegrante");
const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
const bodyIntegrantes = document.getElementById("bodyIntegrantes");
const integranteCelulaActual = document.getElementById("integranteCelulaActual");

const filtroMiembrosCelula = document.getElementById("filtroMiembrosCelula");
const filtroMiembrosLider = document.getElementById("filtroMiembrosLider");
const bodyMiembros = document.getElementById("bodyMiembros");

const formFecha = document.getElementById("formFecha");
const fechaAsistencia = document.getElementById("fechaAsistencia");
const leccionFecha = document.getElementById("leccionFecha");
const docenteFecha = document.getElementById("docenteFecha");
const ofrendaFecha = document.getElementById("ofrendaFecha");
const listaFechas = document.getElementById("listaFechas");
const fechaCelulaActual = document.getElementById("fechaCelulaActual");

const mesAsistencia = document.getElementById("mesAsistencia");
const btnExportarCsv = document.getElementById("btnExportarCsv");
const btnExportarResumenCsv = document.getElementById("btnExportarResumenCsv");
const btnVolverInicio = document.getElementById("btnVolverInicio");
const headTabla = document.getElementById("headTabla");
const bodyTabla = document.getElementById("bodyTabla");

const formCelula = document.getElementById("formCelula");
const nombreCelula = document.getElementById("nombreCelula");
const editandoCelulaId = document.getElementById("editandoCelulaId");
const btnCancelarCelula = document.getElementById("btnCancelarCelula");
const listaCelulas = document.getElementById("listaCelulas");
const formUsuario = document.getElementById("formUsuario");
const nombreUsuario = document.getElementById("nombreUsuario");
const loginUsuarioNuevo = document.getElementById("loginUsuarioNuevo");
const claveUsuarioNuevo = document.getElementById("claveUsuarioNuevo");
const rolUsuarioNuevo = document.getElementById("rolUsuarioNuevo");
const celulaUsuarioNuevo = document.getElementById("celulaUsuarioNuevo");
const editandoUsuarioId = document.getElementById("editandoUsuarioId");
const btnGuardarUsuario = document.getElementById("btnGuardarUsuario");
const btnCancelarUsuario = document.getElementById("btnCancelarUsuario");
const bodyUsuarios = document.getElementById("bodyUsuarios");

function guardarDatos() {
  localStorage.setItem("celulas", JSON.stringify(celulas));
  localStorage.setItem("users", JSON.stringify(users));
  localStorage.setItem("miembros", JSON.stringify(miembros));
  localStorage.setItem("fechas", JSON.stringify(fechas));
  localStorage.setItem("asistencias", JSON.stringify(asistencias));
  localStorage.setItem("sesion", JSON.stringify(sesion));

  if (!firebaseDb || cargandoDesdeNube) return;

  const payload = { celulas, users, miembros, fechas, asistencias, sesion };
  guardadoNubePendiente = guardadoNubePendiente
    .catch(() => undefined)
    .then(() => firebaseDb.ref(DB_PATH).set(payload))
    .catch((error) => {
      console.error("No se pudo guardar en Firebase:", error);
    });
}

async function cargarDatosDesdeNube() {
  if (!inicializarFirebase() || !firebaseDb) return;

  try {
    cargandoDesdeNube = true;
    const snapshot = await firebaseDb.ref(DB_PATH).once("value");
    const data = snapshot.val();

    if (!data) {
      guardarDatos();
      return;
    }

    const estado = normalizarEstado(data);
    if (!estado) return;

    celulas = estado.celulas;
    users = estado.users;
    miembros = estado.miembros;
    fechas = estado.fechas;
    asistencias = estado.asistencias;
    sesion = estado.sesion;

    localStorage.setItem("celulas", JSON.stringify(celulas));
    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("miembros", JSON.stringify(miembros));
    localStorage.setItem("fechas", JSON.stringify(fechas));
    localStorage.setItem("asistencias", JSON.stringify(asistencias));
    localStorage.setItem("sesion", JSON.stringify(sesion));
  } catch (error) {
    console.error("No se pudo cargar desde Firebase:", error);
  } finally {
    cargandoDesdeNube = false;
  }
}

function esAdmin() {
  return sesion?.rol === "admin";
}

function puedeRegistrar() {
  return sesion?.rol === "lider";
}

function obtenerCelulasVisibles() {
  if (!sesion) return [];
  if (esAdmin()) return celulas;
  return celulas.filter((c) => c.id === sesion.celulaId);
}

function obtenerCelulaActivaId() {
  const visibles = obtenerCelulasVisibles();
  if (visibles.length === 0) return null;

  if (!esAdmin()) {
    return sesion.celulaId;
  }

  const existe = visibles.some((c) => c.id === filtroCelulaDashboard.value);
  if (existe) return filtroCelulaDashboard.value;
  return visibles[0].id;
}

function obtenerCelulaOperacionId() {
  if (!puedeRegistrar()) return null;
  return sesion.celulaId;
}

function obtenerNombreCelula(id) {
  return celulas.find((c) => c.id === id)?.nombre || "Sin célula";
}

function ordenarCelulasLista(lista) {
  return [...lista].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  );
}

function ordenarUsuariosLista(lista) {
  return [...lista].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  );
}

function formatearFecha(isoDate) {
  const [anio, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearMes(ym) {
  const [anio, mes] = ym.split("-");
  const fecha = new Date(Number(anio), Number(mes) - 1, 1);
  const texto = fecha.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function calcularEdad(nacimiento) {
  if (!nacimiento) return null;
  const hoy = new Date();
  const nac = new Date(nacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function keyAsistencia(celulaId, miembroId, fecha) {
  return `${celulaId}-${miembroId}-${fecha}`;
}

function activarSeccion(idSeccion, btnActivo) {
  document.querySelectorAll(".subseccion").forEach((s) => s.classList.add("oculto"));
  document.querySelectorAll(".btn-nav").forEach((b) => b.classList.remove("activo"));
  document.getElementById(idSeccion).classList.remove("oculto");
  btnActivo.classList.add("activo");
}

function mostrarLogin() {
  vistaLogin.classList.remove("oculto");
  vistaInicio.classList.add("oculto");
  vistaAsistencia.classList.add("oculto");
}

function mostrarInicio() {
  vistaLogin.classList.add("oculto");
  vistaInicio.classList.remove("oculto");
  vistaAsistencia.classList.add("oculto");
  activarSeccion("seccionDashboard", btnNavDashboard);
  renderDashboard();
}

function mostrarAsistencia() {
  vistaLogin.classList.add("oculto");
  vistaInicio.classList.add("oculto");
  vistaAsistencia.classList.remove("oculto");
}

function refrescarEstadoSesionUI() {
  if (!sesion) {
    usuarioSuperior.classList.add("oculto");
    return;
  }

  textoSesion.textContent = `${sesion.nombre} (${sesion.rol})`;
  usuarioSuperior.textContent = `Usuario: ${sesion.nombre} (${sesion.rol})`;
  usuarioSuperior.classList.remove("oculto");
  btnNavAdmin.classList.toggle("oculto", !esAdmin());
  btnNavMiembros.classList.toggle("oculto", !esAdmin());

  const mostrarRegistro = puedeRegistrar();
  btnNavReportes.classList.toggle("oculto", !sesion);
  btnNavIntegrantes.classList.toggle("oculto", !mostrarRegistro);
  btnNavFechas.classList.toggle("oculto", !mostrarRegistro);
  btnNavAsistencia.classList.toggle("oculto", !mostrarRegistro);
  btnLimpiarTodo.classList.toggle("oculto", !mostrarRegistro);
}

function actualizarFiltroCelulas() {
  const visibles = obtenerCelulasVisibles();
  const actual = obtenerCelulaActivaId();
  const previo = filtroCelulaDashboard.value;

  filtroCelulaDashboard.innerHTML = "";
  if (esAdmin()) {
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Todas las células";
    filtroCelulaDashboard.appendChild(optAll);
  }

  ordenarCelulasLista(visibles).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre;
    filtroCelulaDashboard.appendChild(opt);
  });

  if (esAdmin()) {
    const val = previo || "all";
    const existe = [...filtroCelulaDashboard.options].some((o) => o.value === val);
    filtroCelulaDashboard.value = existe ? val : "all";
  } else if (actual) {
    filtroCelulaDashboard.value = actual;
  }

  filtroCelulaDashboard.disabled = !esAdmin();

  actualizarFiltroLideresDashboard();

  celulaUsuarioNuevo.innerHTML = "";
  ordenarCelulasLista(celulas).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre;
    celulaUsuarioNuevo.appendChild(opt);
  });
  celulaUsuarioNuevo.disabled = rolUsuarioNuevo.value === "admin";
}

function obtenerCelulasDashboardIds() {
  if (!sesion) return [];

  let ids = obtenerCelulasVisibles().map((c) => c.id);

  if (esAdmin()) {
    const celulaSel = filtroCelulaDashboard.value;
    if (celulaSel && celulaSel !== "all") {
      ids = ids.filter((id) => id === celulaSel);
    }

    const liderSel = filtroLiderDashboard.value;
    if (liderSel && liderSel !== "all") {
      const lider = users.find((u) => u.id === liderSel && u.rol === "lider");
      const celulaLider = lider?.celulaId;
      ids = celulaLider ? ids.filter((id) => id === celulaLider) : [];
    }
  }

  return ids;
}

function obtenerLideresDashboardDisponibles() {
  let lideres = users.filter((u) => u.rol === "lider");

  if (esAdmin()) {
    const celulaSel = filtroCelulaDashboard.value;
    if (celulaSel && celulaSel !== "all") {
      lideres = lideres.filter((u) => u.celulaId === celulaSel);
    }
  } else if (sesion?.celulaId) {
    lideres = lideres.filter((u) => u.celulaId === sesion.celulaId);
  }

  return lideres;
}

function actualizarFiltroLideresDashboard() {
  const previo = filtroLiderDashboard.value;
  const lideresDisponibles = obtenerLideresDashboardDisponibles();

  filtroLiderDashboard.innerHTML = "";
  if (esAdmin()) {
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Todos los líderes";
    filtroLiderDashboard.appendChild(optAll);

    lideresDisponibles.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = `${u.nombre} (${obtenerNombreCelula(u.celulaId)})`;
        filtroLiderDashboard.appendChild(opt);
    });

    const existe = [...filtroLiderDashboard.options].some((o) => o.value === previo);
    filtroLiderDashboard.value = existe ? previo : "all";
    filtroLiderDashboard.disabled = false;
  } else {
    const opt = document.createElement("option");
    opt.value = "self";
    opt.textContent = "Mi liderazgo";
    filtroLiderDashboard.appendChild(opt);
    filtroLiderDashboard.value = "self";
    filtroLiderDashboard.disabled = true;
  }
}

function sincronizarFiltrosDashboard() {
  if (!esAdmin()) {
    return;
  }

  const liderSel = filtroLiderDashboard.value;
  if (!liderSel || liderSel === "all") {
    return;
  }

  const lider = users.find((u) => u.id === liderSel && u.rol === "lider");
  if (!lider) {
    filtroLiderDashboard.value = "all";
    return;
  }

  if (filtroCelulaDashboard.value === "all") {
    filtroCelulaDashboard.value = lider.celulaId;
    actualizarFiltroLideresDashboard();
    return;
  }

  if (filtroCelulaDashboard.value !== lider.celulaId) {
    filtroLiderDashboard.value = "all";
  }
}

function actualizarFiltroFechaDashboard() {
  const celulasIds = obtenerCelulasDashboardIds();
  const mesSel = filtroMesDashboard.value;

  let fechasDisponibles = fechas
    .filter((f) => celulasIds.includes(f.celulaId))
    .map((f) => f.fecha);

  if (mesSel) {
    fechasDisponibles = fechasDisponibles.filter((f) => f.startsWith(mesSel));
  }

  if (filtroFechaDashboard.value && !fechasDisponibles.includes(filtroFechaDashboard.value)) {
    filtroFechaDashboard.value = "";
  }
}

function actualizarFiltroMesDashboard() {
  const celulasIds = obtenerCelulasDashboardIds();
  const anterior = filtroMesDashboard.value;
  const meses = [...new Set(
    fechas
      .filter((f) => celulasIds.includes(f.celulaId))
      .map((f) => f.fecha.slice(0, 7))
  )]
    .sort((a, b) => a.localeCompare(b));

  filtroMesDashboard.innerHTML = "<option value=''>Todos los meses</option>";
  meses.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = formatearMes(m);
    filtroMesDashboard.appendChild(opt);
  });

  if (anterior && meses.includes(anterior)) {
    filtroMesDashboard.value = anterior;
  }
}

function renderDashboard() {
  sincronizarFiltrosDashboard();

  const celulasIds = obtenerCelulasDashboardIds();
  if (celulasIds.length === 0) {
    dashResumen.innerHTML = "";
    dashTarjetas.innerHTML = "<p class='dash-vacio'>No hay datos para los filtros seleccionados.</p>";
    return;
  }

  actualizarFiltroMesDashboard();
  actualizarFiltroFechaDashboard();

  const mes = filtroMesDashboard.value;
  const fechaExacta = filtroFechaDashboard.value;
  const miembrosCelula = miembros.filter((m) => celulasIds.includes(m.celulaId));
  let fechasCelula = fechas
    .filter((f) => celulasIds.includes(f.celulaId))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (mes) fechasCelula = fechasCelula.filter((f) => f.fecha.startsWith(mes));
  if (fechaExacta) fechasCelula = fechasCelula.filter((f) => f.fecha === fechaExacta);

  let totalAsistencias = 0;
  let totalFaltas = 0;
  let posibles = 0;
  fechasCelula.forEach((f) => {
    const miembrosFecha = miembrosCelula.filter((m) => {
      if (m.celulaId !== f.celulaId) return false;
      if (!m.ingreso) return true; // Si no tiene fecha de ingreso, cuenta
      return f.fecha >= m.ingreso; // Solo si la fecha es posterior o igual al ingreso
    });
    posibles += miembrosFecha.length;

    miembrosFecha.forEach((m) => {
      const estado = asistencias[keyAsistencia(f.celulaId, m.id, f.fecha)];
      if (estado === true) totalAsistencias += 1;
      else if (estado === false) totalFaltas += 1;
    });
  });

  const promedio = posibles > 0 ? `${((totalAsistencias / posibles) * 100).toFixed(1)}%` : "–";
  const totalOfrenda = fechasCelula.reduce((sum, f) => sum + Number(f.ofrenda || 0), 0);

  dashResumen.innerHTML = `
    <div class="dash-stat">
      <span class="dash-stat-valor">${miembrosCelula.length}</span>
      <span class="dash-stat-label">Integrantes</span>
    </div>
    <div class="dash-stat">
      <span class="dash-stat-valor">${fechasCelula.length}</span>
      <span class="dash-stat-label">Reuniones</span>
    </div>
    <div class="dash-stat">
      <span class="dash-stat-valor">${promedio}</span>
      <span class="dash-stat-label">Asistencia promedio</span>
    </div>
    <div class="dash-stat">
      <span class="dash-stat-valor">S/ ${totalOfrenda.toFixed(2)}</span>
      <span class="dash-stat-label">Ofrenda total</span>
    </div>
    <div class="dash-stat">
      <span class="dash-stat-valor">${totalFaltas}</span>
      <span class="dash-stat-label">Faltas registradas</span>
    </div>
  `;

  if (fechasCelula.length === 0) {
    dashTarjetas.innerHTML = "<p class='dash-vacio'>No hay datos para los filtros seleccionados.</p>";
    return;
  }

  dashTarjetas.innerHTML = "";
  fechasCelula.forEach((f) => {
    let asistio = 0;
    let falto = 0;
    const miembrosFecha = miembrosCelula.filter((m) => {
      if (m.celulaId !== f.celulaId) return false;
      if (!m.ingreso) return true;
      return m.ingreso <= f.fecha;
    });

    miembrosFecha.forEach((m) => {
      const estado = asistencias[keyAsistencia(f.celulaId, m.id, f.fecha)];
      if (estado === true) asistio += 1;
      else if (estado === false) falto += 1;
    });

    const pct = miembrosFecha.length > 0 ? ((asistio / miembrosFecha.length) * 100).toFixed(1) : "–";
    const barAncho = miembrosFecha.length > 0 ? (asistio / miembrosFecha.length) * 100 : 0;

    const tarjeta = document.createElement("div");
    tarjeta.className = "dash-tarjeta";
    tarjeta.innerHTML = `
      <div class="dash-tarjeta-fecha">${formatearFecha(f.fecha)}</div>
      <div class="dash-tarjeta-fila"><span>📌 ${obtenerNombreCelula(f.celulaId)}</span></div>
      <div class="dash-tarjeta-leccion">${f.leccion ? `📖 ${f.leccion}` : "<em>Sin lección registrada</em>"}</div>
      ${f.docente ? `<div class="dash-tarjeta-fila"><span>👤 Docente: <strong>${f.docente}</strong></span></div>` : ""}
      <div class="dash-tarjeta-fila">
        <span>✔ Asistentes: <strong>${asistio}</strong> / ${miembrosFecha.length}</span>
        <span>${pct}%</span>
      </div>
      <div class="dash-barra-fondo"><div class="dash-barra-relleno" style="width:${barAncho}%"></div></div>
      <div class="dash-tarjeta-fila">
        <span>✘ Faltas: <strong>${falto}</strong></span>
        <span>💰 Ofrenda: <strong>S/ ${Number(f.ofrenda || 0).toFixed(2)}</strong></span>
      </div>
    `;
    dashTarjetas.appendChild(tarjeta);
  });
}

function obtenerEtiquetaFiltrosDashboard() {
  const celulaTxt = filtroCelulaDashboard.options[filtroCelulaDashboard.selectedIndex]?.textContent || "—";
  const liderTxt = filtroLiderDashboard.options[filtroLiderDashboard.selectedIndex]?.textContent || "—";
  const mesTxt = filtroMesDashboard.options[filtroMesDashboard.selectedIndex]?.textContent || "Todos";
  const fechaTxt = filtroFechaDashboard.value ? formatearFecha(filtroFechaDashboard.value) : "Todas";

  return `Célula: ${celulaTxt} | Líder: ${liderTxt} | Mes: ${mesTxt} | Fecha: ${fechaTxt}`;
}

function obtenerDatosFiltradosDashboard() {
  sincronizarFiltrosDashboard();
  const celulasIds = obtenerCelulasDashboardIds();

  const mes = filtroMesDashboard.value;
  const fechaExacta = filtroFechaDashboard.value;

  const miembrosFiltrados = miembros.filter((m) => celulasIds.includes(m.celulaId));
  let fechasFiltradas = fechas
    .filter((f) => celulasIds.includes(f.celulaId))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (mes) fechasFiltradas = fechasFiltradas.filter((f) => f.fecha.startsWith(mes));
  if (fechaExacta) fechasFiltradas = fechasFiltradas.filter((f) => f.fecha === fechaExacta);

  return { miembrosFiltrados, fechasFiltradas };
}

function obtenerLideresDisponiblesReporte() {
  let lideres = users.filter((u) => u.rol === "lider");

  if (!esAdmin()) {
    return lideres.filter((u) => u.celulaId === sesion.celulaId);
  }

  const celSel = filtroCelulaReporte.value;
  if (celSel && celSel !== "all") {
    lideres = lideres.filter((u) => u.celulaId === celSel);
  }

  return lideres;
}

function obtenerCelulasReporteIds() {
  if (!sesion) return [];

  if (!esAdmin()) {
    return [sesion.celulaId];
  }

  let ids = celulas.map((c) => c.id);
  const celSel = filtroCelulaReporte.value;
  if (celSel && celSel !== "all") {
    ids = ids.filter((id) => id === celSel);
  }

  const liderSel = filtroLiderReporte.value;
  if (liderSel && liderSel !== "all") {
    const lider = users.find((u) => u.id === liderSel && u.rol === "lider");
    const celLider = lider?.celulaId;
    ids = celLider ? ids.filter((id) => id === celLider) : [];
  }

  return ids;
}

function actualizarFiltrosReporte() {
  if (!filtroCelulaReporte || !filtroLiderReporte || !filtroMesReporte || !filtroFechaReporte) {
    return;
  }

  const prevCel = filtroCelulaReporte.value;
  const prevLider = filtroLiderReporte.value;
  const prevMes = filtroMesReporte.value;

  filtroCelulaReporte.innerHTML = "";
  if (esAdmin()) {
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Todas las células";
    filtroCelulaReporte.appendChild(optAll);
    celulas.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nombre;
      filtroCelulaReporte.appendChild(opt);
    });
    filtroCelulaReporte.value = [...filtroCelulaReporte.options].some((o) => o.value === prevCel) ? prevCel : "all";
    filtroCelulaReporte.disabled = false;
  } else {
    const opt = document.createElement("option");
    opt.value = sesion.celulaId;
    opt.textContent = obtenerNombreCelula(sesion.celulaId);
    filtroCelulaReporte.appendChild(opt);
    filtroCelulaReporte.value = sesion.celulaId;
    filtroCelulaReporte.disabled = true;
  }

  const lideres = obtenerLideresDisponiblesReporte();
  filtroLiderReporte.innerHTML = "";
  if (esAdmin()) {
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Todos los líderes";
    filtroLiderReporte.appendChild(optAll);
    lideres.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `${u.nombre} (${obtenerNombreCelula(u.celulaId)})`;
      filtroLiderReporte.appendChild(opt);
    });
    filtroLiderReporte.value = [...filtroLiderReporte.options].some((o) => o.value === prevLider) ? prevLider : "all";
    filtroLiderReporte.disabled = false;
  } else {
    const selfLider = lideres[0];
    const opt = document.createElement("option");
    opt.value = selfLider?.id || "self";
    opt.textContent = selfLider?.nombre || "Mi liderazgo";
    filtroLiderReporte.appendChild(opt);
    filtroLiderReporte.value = opt.value;
    filtroLiderReporte.disabled = true;
  }

  const celulasIds = obtenerCelulasReporteIds();
  const meses = [...new Set(
    fechas
      .filter((f) => celulasIds.includes(f.celulaId))
      .map((f) => f.fecha.slice(0, 7))
  )].sort((a, b) => a.localeCompare(b));

  filtroMesReporte.innerHTML = "<option value=''>Todos los meses</option>";
  meses.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = formatearMes(m);
    filtroMesReporte.appendChild(opt);
  });
  if (prevMes && meses.includes(prevMes)) {
    filtroMesReporte.value = prevMes;
  }

  let fechasDisp = fechas
    .filter((f) => celulasIds.includes(f.celulaId))
    .map((f) => f.fecha);
  if (filtroMesReporte.value) {
    fechasDisp = fechasDisp.filter((f) => f.startsWith(filtroMesReporte.value));
  }
  if (filtroFechaReporte.value && !fechasDisp.includes(filtroFechaReporte.value)) {
    filtroFechaReporte.value = "";
  }
}

function obtenerEtiquetaFiltrosReporte() {
  const celulaTxt = filtroCelulaReporte.options[filtroCelulaReporte.selectedIndex]?.textContent || "—";
  const liderTxt = filtroLiderReporte.options[filtroLiderReporte.selectedIndex]?.textContent || "—";
  const mesTxt = filtroMesReporte.options[filtroMesReporte.selectedIndex]?.textContent || "Todos";
  const fechaTxt = filtroFechaReporte.value ? formatearFecha(filtroFechaReporte.value) : "Todas";

  return `Célula: ${celulaTxt} | Líder: ${liderTxt} | Mes: ${mesTxt} | Fecha: ${fechaTxt}`;
}

function obtenerDatosFiltradosReporte() {
  const celulasIds = obtenerCelulasReporteIds();
  const mes = filtroMesReporte.value;
  const fechaExacta = filtroFechaReporte.value;

  const miembrosFiltrados = miembros.filter((m) => celulasIds.includes(m.celulaId));
  let fechasFiltradas = fechas
    .filter((f) => celulasIds.includes(f.celulaId))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (mes) fechasFiltradas = fechasFiltradas.filter((f) => f.fecha.startsWith(mes));
  if (fechaExacta) fechasFiltradas = fechasFiltradas.filter((f) => f.fecha === fechaExacta);

  return { miembrosFiltrados, fechasFiltradas };
}

function obtenerResumenAsistenciaPorIntegrante(miembrosFiltrados, fechasFiltradas) {
  return miembrosFiltrados
    .map((m) => {
      const fechasIntegrante = fechasFiltradas.filter((f) => {
        if (f.celulaId !== m.celulaId) return false;
        if (!m.ingreso) return true; // Si no tiene fecha de ingreso, todas las fechas son válidas
        return f.fecha >= m.ingreso; // Solo fechas posteriores o iguales al ingreso
      });
      let asistio = 0;
      let falto = 0;
      let sinRegistro = 0;
      const detalleAsistencias = [];

      fechasIntegrante.forEach((f) => {
        const estado = asistencias[keyAsistencia(m.celulaId, m.id, f.fecha)];
        if (estado === true) {
          asistio += 1;
          detalleAsistencias.push({ fecha: f.fecha, estadoTexto: "Asistió" });
        } else if (estado === false) {
          falto += 1;
          detalleAsistencias.push({ fecha: f.fecha, estadoTexto: "Faltó" });
        } else {
          sinRegistro += 1;
          detalleAsistencias.push({ fecha: f.fecha, estadoTexto: "Sin registro" });
        }
      });

      const totalReuniones = fechasIntegrante.length;
      const porcentaje = totalReuniones > 0 ? (asistio / totalReuniones) * 100 : 0;
      const detalleHtml = detalleAsistencias.length
        ? detalleAsistencias
          .map((d) => `${formatearFecha(d.fecha)}: ${d.estadoTexto}`)
          .join("<br>")
        : "Sin reuniones";
      const detalleTexto = detalleAsistencias.length
        ? detalleAsistencias
          .map((d) => `${formatearFecha(d.fecha)}: ${d.estadoTexto}`)
          .join(" | ")
        : "Sin reuniones";

      return {
        integrante: m,
        totalReuniones,
        asistio,
        falto,
        sinRegistro,
        porcentaje,
        detalleHtml,
        detalleTexto
      };
    })
    .sort((a, b) => {
      const celA = obtenerNombreCelula(a.integrante.celulaId);
      const celB = obtenerNombreCelula(b.integrante.celulaId);
      if (celA !== celB) return celA.localeCompare(celB);
      return a.integrante.nombre.localeCompare(b.integrante.nombre);
    });
}

function renderReporte() {
  if (!resumenFiltrosReporte || !previewReporte) {
    return;
  }

  actualizarFiltrosReporte();
  const { miembrosFiltrados, fechasFiltradas } = obtenerDatosFiltradosReporte();

  resumenFiltrosReporte.textContent = `Filtros activos: ${obtenerEtiquetaFiltrosReporte()}`;

  let totalAsistencias = 0;
  let totalFaltas = 0;

  fechasFiltradas.forEach((f) => {
    const miembrosFecha = miembrosFiltrados.filter((m) => m.celulaId === f.celulaId);
    miembrosFecha.forEach((m) => {
      const estado = asistencias[keyAsistencia(f.celulaId, m.id, f.fecha)];
      if (estado === true) totalAsistencias += 1;
      else if (estado === false) totalFaltas += 1;
    });
  });

  const totalOfrenda = fechasFiltradas.reduce((sum, f) => sum + Number(f.ofrenda || 0), 0);
  const resumenIntegrantes = obtenerResumenAsistenciaPorIntegrante(miembrosFiltrados, fechasFiltradas);
  const mensajeSinDatos = (fechasFiltradas.length === 0 && resumenIntegrantes.length === 0)
    ? "<p class='dash-vacio'>No hay datos para generar reporte con los filtros actuales.</p>"
    : "";

  const filasIntegrantes = resumenIntegrantes.length
    ? resumenIntegrantes
      .map((r, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${r.integrante.nombre}</td>
          <td>${obtenerNombreCelula(r.integrante.celulaId)}</td>
          <td>${r.totalReuniones}</td>
          <td>${r.asistio}</td>
          <td>${r.falto}</td>
          <td>${r.sinRegistro}</td>
          <td>${r.porcentaje.toFixed(1)}%</td>
          <td>${r.detalleHtml}</td>
        </tr>
      `)
      .join("")
    : "<tr><td colspan='9'>No hay integrantes para mostrar con los filtros actuales.</td></tr>";

  previewReporte.innerHTML = `
    <h4>Vista previa del reporte</h4>
    ${mensajeSinDatos}
    <ul>
      <li>Reuniones incluidas: <strong>${fechasFiltradas.length}</strong></li>
      <li>Asistencias registradas: <strong>${totalAsistencias}</strong></li>
      <li>Faltas registradas: <strong>${totalFaltas}</strong></li>
      <li>Ofrenda total: <strong>S/ ${totalOfrenda.toFixed(2)}</strong></li>
    </ul>
    <h4>Asistencia por integrante</h4>
    <div class="tabla-integrantes-wrap">
      <table class="tabla-integrantes">
        <thead>
          <tr>
            <th>N°</th>
            <th>Integrante</th>
            <th>Célula</th>
            <th>Reuniones</th>
            <th>Asistió</th>
            <th>Faltó</th>
            <th>Sin registro</th>
            <th>% Asistencia</th>
            <th>Detalle de asistencias</th>
          </tr>
        </thead>
        <tbody>${filasIntegrantes}</tbody>
      </table>
    </div>
  `;
}

function exportarReportePdf() {
  const { miembrosFiltrados, fechasFiltradas } = obtenerDatosFiltradosReporte();
  const resumenIntegrantes = obtenerResumenAsistenciaPorIntegrante(miembrosFiltrados, fechasFiltradas);

  if (fechasFiltradas.length === 0 && resumenIntegrantes.length === 0) {
    alert("No hay datos para exportar con los filtros actuales.");
    return;
  }

  let filas = "";
  fechasFiltradas.forEach((f) => {
    const miembrosFecha = miembrosFiltrados.filter((m) => m.celulaId === f.celulaId);
    let asistio = 0;
    let falto = 0;

    miembrosFecha.forEach((m) => {
      const estado = asistencias[keyAsistencia(f.celulaId, m.id, f.fecha)];
      if (estado === true) asistio += 1;
      else if (estado === false) falto += 1;
    });

    filas += `
      <tr>
        <td>${formatearFecha(f.fecha)}</td>
        <td>${obtenerNombreCelula(f.celulaId)}</td>
        <td>${f.leccion || "-"}</td>
        <td>${asistio}</td>
        <td>${falto}</td>
        <td>S/ ${Number(f.ofrenda || 0).toFixed(2)}</td>
      </tr>
    `;
  });

  const fechasUnicas = [...new Set(fechasFiltradas.map((f) => f.fecha))]
    .sort((a, b) => a.localeCompare(b));

  let etiquetaMes = "Sin mes";
  if (filtroMesReporte.value) {
    etiquetaMes = formatearMes(filtroMesReporte.value);
  } else if (fechasUnicas[0]) {
    etiquetaMes = formatearMes(fechasUnicas[0].slice(0, 7));
  }

  const cabeceraFechas = fechasUnicas.length
    ? fechasUnicas.map((fecha) => `<th>${formatearFecha(fecha)}</th>`).join("")
    : "<th>Sin fechas</th>";

  const filasPlanilla = miembrosFiltrados.length
    ? miembrosFiltrados
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((m, index) => {
        const tipo = (m.tipo || "").toLowerCase();
        const esPleno = tipo === "pleno" ? "X" : "";
        const esParticipante = tipo === "participante" ? "X" : "";
        const esOyente = tipo === "oyente" ? "X" : "";

        const celdasAsistencia = fechasUnicas.length
          ? fechasUnicas.map((fecha) => {
            const registroFecha = fechasFiltradas.find((f) => f.fecha === fecha && f.celulaId === m.celulaId);
            if (!registroFecha) return "<td class='asistencia-celda'>—</td>";
            const estado = asistencias[keyAsistencia(m.celulaId, m.id, fecha)];
            if (estado === true) return "<td class='asistencia-celda asistencia-ok'>✓</td>";
            if (estado === false) return "<td class='asistencia-celda asistencia-no'>F</td>";
            return "<td class='asistencia-celda'>—</td>";
          }).join("")
          : "<td>—</td>";

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${m.nombre}</td>
            <td>${m.nacimiento ? formatearFecha(m.nacimiento) : ""}</td>
            <td>${m.celular || ""}</td>
            <td class='miembro-col'>${esPleno}</td>
            <td class='miembro-col'>${esParticipante}</td>
            <td class='miembro-col'>${esOyente}</td>
            ${celdasAsistencia}
          </tr>
        `;
      })
      .join("")
    : `<tr><td colspan='${7 + Math.max(fechasUnicas.length, 1)}'>No hay integrantes para mostrar con los filtros actuales.</td></tr>`;

  const html = `
    <html>
    <head>
      <title>Reporte Asistencia</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h2 { color: #d90429; margin-bottom: 6px; text-align: center; font-size: 38px; letter-spacing: 1px; }
        h3 { color: #2e7d32; margin: 18px 0 6px; }
        p { color: #444; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 2px solid #222; padding: 4px 6px; text-align: center; font-size: 12px; }
        th { background: #efe3ba; color: #111; }
        td:nth-child(2) { text-align: left; }
        .detalle-table th, .detalle-table td { border: 1px solid #ccc; text-align: left; padding: 8px; }
        .detalle-table th { background: #2e7d32; color: #fff; }
        .miembro-col { width: 38px; font-weight: 700; }
        .asistencia-celda { width: 48px; font-weight: 700; }
        .asistencia-ok { color: #0f6b1f; }
        .asistencia-no { color: #b71c1c; }
        .meta { margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <h2>ASISTENCIA MES DE: ${etiquetaMes.toUpperCase()}</h2>
      <p class="meta"><strong>Generado por:</strong> ${sesion?.nombre || "Sistema"} | <strong>Filtros:</strong> ${obtenerEtiquetaFiltrosReporte()} | <strong>Versión:</strong> ${APP_VERSION}</p>

      <h3>Detalle por reunión</h3>
      ${fechasFiltradas.length
        ? `<table class="detalle-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Célula</th>
            <th>Lección</th>
            <th>Asistencias</th>
            <th>Faltas</th>
            <th>Ofrenda</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>`
        : "<p>No hay reuniones para los filtros seleccionados.</p>"}

      <h3>Planilla mensual de integrantes</h3>
      <table>
        <thead>
          <tr>
            <th rowspan="2">N°</th>
            <th rowspan="2">Apellidos y Nombres</th>
            <th rowspan="2">Fecha de Nacimiento</th>
            <th rowspan="2">Celular</th>
            <th colspan="3">MIEMBRO</th>
            <th colspan="${Math.max(fechasUnicas.length, 1)}">ASISTENCIA A CULTOS EN HOGARES</th>
          </tr>
          <tr>
            <th>PLENO</th>
            <th>PARTICIPANTE</th>
            <th>OYENTE</th>
            ${cabeceraFechas}
          </tr>
        </thead>
        <tbody>${filasPlanilla}</tbody>
      </table>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `;

  const w = window.open("", "_blank");
  if (!w) {
    alert("El navegador bloqueó la ventana emergente. Permite pop-ups para exportar PDF.");
    return;
  }

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  w.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function renderIntegrantes() {
  const celulaId = obtenerCelulaOperacionId();
  if (!celulaId) {
    integranteCelulaActual.textContent = "Solo lectura: el administrador solo visualiza el dashboard.";
    bodyIntegrantes.innerHTML = "<tr><td colspan='8'>La gestión de integrantes está disponible solo para líderes.</td></tr>";
    return;
  }

  const lista = miembros.filter((m) => m.celulaId === celulaId);
  integranteCelulaActual.textContent = `Célula actual: ${obtenerNombreCelula(celulaId)}`;

  bodyIntegrantes.innerHTML = "";
  if (lista.length === 0) {
    bodyIntegrantes.innerHTML = "<tr><td colspan='8'>No hay integrantes registrados en esta célula.</td></tr>";
    return;
  }

  lista.forEach((integrante, index) => {
    const edad = calcularEdad(integrante.nacimiento);
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${index + 1}</td>
      <td class="col-nombre">${integrante.nombre}</td>
      <td><span class="badge-tipo badge-${integrante.tipo}">${integrante.tipo}</span></td>
      <td>${integrante.nacimiento ? formatearFecha(integrante.nacimiento) : "—"}</td>
      <td>${edad === null ? "—" : edad}</td>
      <td>${integrante.celular || "—"}</td>
      <td class="col-ingreso">${integrante.ingreso ? formatearFecha(integrante.ingreso) : "—"}</td>
      <td class="col-acciones">
        <div class="integrante-acciones">
          <button class="btn btn-editar" data-id="${integrante.id}">Editar</button>
          <button class="btn btn-eliminar" data-id="${integrante.id}">Eliminar</button>
        </div>
      </td>
    `;
    bodyIntegrantes.appendChild(fila);
  });
}

function renderFechas() {
  const celulaId = obtenerCelulaOperacionId();
  if (!celulaId) {
    fechaCelulaActual.textContent = "Solo lectura: el administrador solo visualiza el dashboard.";
    listaFechas.innerHTML = "<li>La gestión de fechas está disponible solo para líderes.</li>";
    return;
  }

  const lista = fechas
    .filter((f) => f.celulaId === celulaId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  fechaCelulaActual.textContent = `Célula actual: ${obtenerNombreCelula(celulaId)}`;
  listaFechas.innerHTML = "";

  if (lista.length === 0) {
    listaFechas.innerHTML = "<li>No hay fechas registradas en esta célula.</li>";
    return;
  }

  lista.forEach((f) => {
    const item = document.createElement("li");
    item.className = "lista-fecha-item";
    item.innerHTML = `
      <div class="fecha-info">
        <strong>${formatearFecha(f.fecha)}</strong>
        <input class="input-leccion" type="text" placeholder="Lección" value="${f.leccion || ""}" data-fecha="${f.fecha}">
        <input class="input-docente" type="text" placeholder="Docente" value="${f.docente || ""}" data-fecha="${f.fecha}">
        <input class="input-ofrenda" type="number" min="0" step="0.01" placeholder="Ofrenda S/" value="${f.ofrenda || ""}" data-fecha="${f.fecha}">
      </div>
      <button class="btn btn-eliminar" data-fecha="${f.fecha}">Eliminar</button>
    `;
    listaFechas.appendChild(item);
  });
}

function actualizarSelectorMesAsistencia() {
  const celulaId = obtenerCelulaOperacionId();
  if (!celulaId) {
    mesAsistencia.innerHTML = "<option value=''>No disponible</option>";
    return;
  }

  const previo = mesAsistencia.value;
  const meses = [...new Set(fechas
    .filter((f) => f.celulaId === celulaId)
    .map((f) => f.fecha.slice(0, 7)))]
    .sort((a, b) => a.localeCompare(b));

  mesAsistencia.innerHTML = "<option value=''>Seleccionar mes</option>";
  meses.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = formatearMes(m);
    mesAsistencia.appendChild(opt);
  });

  if (previo && meses.includes(previo)) {
    mesAsistencia.value = previo;
  }
}

function cargarTablaAsistencia() {
  const celulaId = obtenerCelulaOperacionId();
  if (!celulaId) {
    headTabla.innerHTML = "";
    bodyTabla.innerHTML = "<tr><td colspan='4'>El administrador solo puede visualizar dashboard global.</td></tr>";
    return;
  }

  const miembrosCelula = miembros.filter((m) => m.celulaId === celulaId);
  const fechasCelula = fechas
    .filter((f) => f.celulaId === celulaId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const mesSel = mesAsistencia.value;
  const fechasFiltradas = mesSel ? fechasCelula.filter((f) => f.fecha.startsWith(mesSel)) : [];

  headTabla.innerHTML = "";
  bodyTabla.innerHTML = "";

  if (miembrosCelula.length === 0 || fechasCelula.length === 0) {
    bodyTabla.innerHTML = "<tr><td colspan='4'>Registra integrantes y fechas en esta célula para comenzar.</td></tr>";
    return;
  }

  if (!mesSel) {
    bodyTabla.innerHTML = "<tr><td colspan='4'>Selecciona un mes para registrar asistencia.</td></tr>";
    return;
  }

  if (fechasFiltradas.length === 0) {
    bodyTabla.innerHTML = "<tr><td colspan='4'>No hay fechas en ese mes para la célula seleccionada.</td></tr>";
    return;
  }

  let head = "<tr><th>N°</th><th>Nombre</th><th>Tipo</th>";
  fechasFiltradas.forEach((f) => {
    head += `<th>${formatearFecha(f.fecha)}</th>`;
  });
  head += "</tr>";
  headTabla.innerHTML = head;

  miembrosCelula.forEach((m, index) => {
    let html = `<td>${index + 1}</td><td>${m.nombre}</td><td>${m.tipo}</td>`;
    fechasFiltradas.forEach((f) => {
      // Solo mostrar asistencia si la fecha es válida para este integrante
      const fechaValida = !m.ingreso || f.fecha >= m.ingreso;
      
      if (fechaValida) {
        const estado = asistencias[keyAsistencia(celulaId, m.id, f.fecha)];
        let clase = "";
        let texto = "";

        if (estado === true) {
          clase = "asistio";
          texto = "✔";
        } else if (estado === false) {
          clase = "falto";
          texto = "✘";
        }

        html += `<td><button data-id="${m.id}" data-fecha="${f.fecha}" class="${clase}">${texto}</button></td>`;
      } else {
        // Fecha anterior al ingreso del integrante - mostrar celda vacía
        html += `<td class="fecha-no-valida">—</td>`;
      }
    });

    const fila = document.createElement("tr");
    fila.innerHTML = html;
    bodyTabla.appendChild(fila);
  });
}

function actualizarFiltroMiembros() {
  if (!filtroMiembrosCelula || !filtroMiembrosLider) return;
  
  const prevCelula = filtroMiembrosCelula.value;
  const prevLider = filtroMiembrosLider.value;
  
  filtroMiembrosLider.innerHTML = "";
  const optTodosLideres = document.createElement("option");
  optTodosLideres.value = "";
  optTodosLideres.textContent = "Todos los líderes";
  filtroMiembrosLider.appendChild(optTodosLideres);

  users.filter((u) => u.rol === "lider").forEach((lider) => {
    const opt = document.createElement("option");
    opt.value = lider.id;
    opt.textContent = lider.nombre;
    filtroMiembrosLider.appendChild(opt);
  });
  
  filtroMiembrosCelula.innerHTML = "";
  const optTodasCelulas = document.createElement("option");
  optTodasCelulas.value = "";
  optTodasCelulas.textContent = "Todas las células";
  filtroMiembrosCelula.appendChild(optTodasCelulas);

  celulas.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre;
    filtroMiembrosCelula.appendChild(opt);
  });
  
  filtroMiembrosCelula.value = prevCelula ?? "";
  filtroMiembrosLider.value = prevLider ?? "";
}

function renderMiembrosTabla() {
  if (!bodyMiembros) return;
  
  bodyMiembros.innerHTML = "";
  
  const celulaId = filtroMiembrosCelula?.value;
  const liderId = filtroMiembrosLider?.value;
  
  let miembrosFiltrados = [...miembros];
  
  if (liderId) {
    const lider = users.find((u) => u.id === liderId);
    if (lider?.celulaId) {
      miembrosFiltrados = miembrosFiltrados.filter((m) => m.celulaId === lider.celulaId);
    } else {
      miembrosFiltrados = [];
    }
  }
  
  if (celulaId) {
    miembrosFiltrados = miembrosFiltrados.filter((m) => m.celulaId === celulaId);
  }
  
  if (miembrosFiltrados.length === 0) {
    bodyMiembros.innerHTML = "<tr><td colspan='6' style='text-align: center; padding: 20px;'>No hay miembros para esta selección.</td></tr>";
    return;
  }
  
  miembrosFiltrados.forEach((m) => {
    const fila = document.createElement("tr");
    const edad = calcularEdad(m.nacimiento);
    
    const acciones = `
      <div class="integrante-acciones">
        <button class='btn btn-editar' data-member-id='${m.id}' data-celula-id='${m.celulaId}'>Editar</button>
        <button class='btn btn-mover' data-member-id='${m.id}' data-celula-id='${m.celulaId}'>Mover</button>
        <button class='btn btn-eliminar' data-member-id='${m.id}' data-celula-id='${m.celulaId}'>Eliminar</button>
      </div>
    `;
    
    fila.innerHTML = `
      <td>${m.nombre}</td>
      <td><span class="badge-tipo">${m.tipo}</span></td>
      <td>${m.celular || "-"}</td>
      <td>${edad || "-"}</td>
      <td>${obtenerNombreCelula(m.celulaId)}</td>
      <td>${acciones}</td>
    `;
    bodyMiembros.appendChild(fila);
  });
}

function editarMiembroCelula(miembro, celulaId) {
  const nuevoNombre = prompt("Nuevo nombre:", miembro.nombre);
  if (nuevoNombre === null) return;
  
  if (!nuevoNombre.trim()) {
    alert("El nombre no puede estar vacío.");
    return;
  }
  
  const idx = miembros.findIndex((m) => m.id === miembro.id);
  if (idx === -1) return;
  
  miembros[idx].nombre = nuevoNombre.trim();
  
  guardarDatos();
  renderMiembrosTabla();
  renderDashboard();
  renderReporte();
}

function moverMiembroCelula(miembro, celulaActual) {
  const celulasOtras = celulas.filter((c) => c.id !== celulaActual);
  
  if (celulasOtras.length === 0) {
    alert("No hay otras células para mover este miembro.");
    return;
  }
  
  let mensaje = "Selecciona la nueva célula:\n\n";
  celulasOtras.forEach((c, idx) => {
    mensaje += `${idx + 1}. ${c.nombre}\n`;
  });
  
  const respuesta = prompt(mensaje);
  if (respuesta === null) return;
  
  const idx = parseInt(respuesta) - 1;
  if (idx < 0 || idx >= celulasOtras.length) {
    alert("Opción inválida.");
    return;
  }
  
  const nuevaCelulaId = celulasOtras[idx].id;
  
  const idxMiembro = miembros.findIndex((m) => m.id === miembro.id);
  if (idxMiembro === -1) return;
  
  miembros[idxMiembro].celulaId = nuevaCelulaId;
  
  guardarDatos();
  renderMiembrosTabla();
  renderDashboard();
  renderReporte();
  refrescarTodo();
}

function renderAdmin() {
  if (!esAdmin()) return;

  listaCelulas.innerHTML = "";
  ordenarCelulasLista(celulas).forEach((c) => {
    const item = document.createElement("li");
    const totalLideres = users.filter((u) => u.celulaId === c.id && u.rol === "lider").length;
    const enEdicion = editandoCelulaId?.value === c.id;
    item.innerHTML = `
      <span>${c.nombre} (${totalLideres} líder/es)</span>
      <div class="celula-acciones">
        <button class='btn btn-editar' data-celula-id='${c.id}' data-celula-action='editar'>Editar</button>
        <button class='btn btn-eliminar' data-celula-id='${c.id}' data-celula-action='eliminar'>Eliminar</button>
        ${enEdicion ? `<button class='btn btn-principal' data-celula-id='${c.id}' data-celula-action='guardar'>Guardar</button>` : ""}
      </div>
    `;
    listaCelulas.appendChild(item);
  });

  bodyUsuarios.innerHTML = "";
  ordenarUsuariosLista(users).forEach((u) => {
    const fila = document.createElement("tr");
    const celNombre = u.rol === "admin" ? "Todas" : obtenerNombreCelula(u.celulaId);
    const acciones = `
      <div class="integrante-acciones">
        <button class='btn btn-editar' data-user-id='${u.id}' data-user-action='editar'>Editar</button>
        ${u.id === sesion.id ? "" : `<button class='btn btn-eliminar' data-user-id='${u.id}' data-user-action='eliminar'>Eliminar</button>`}
      </div>
    `;

    fila.innerHTML = `
      <td>${u.nombre}</td>
      <td>${u.username}</td>
      <td>${u.rol}</td>
      <td>${celNombre}</td>
      <td>${acciones}</td>
    `;
    bodyUsuarios.appendChild(fila);
  });
}
    

function cancelarEdicionUsuario() {
  if (editandoUsuarioId) editandoUsuarioId.value = "";
  if (formUsuario) formUsuario.reset();
  if (btnGuardarUsuario) btnGuardarUsuario.textContent = "Crear usuario";
  if (btnCancelarUsuario) btnCancelarUsuario.classList.add("oculto");
  if (rolUsuarioNuevo) rolUsuarioNuevo.value = "lider";
  if (celulaUsuarioNuevo) celulaUsuarioNuevo.disabled = false;
}

function cancelarEdicionCelula() {
  if (editandoCelulaId) editandoCelulaId.value = "";
  if (formCelula) formCelula.reset();
  const botonCelula = formCelula.querySelector("button[type='submit']");
  if (botonCelula) botonCelula.textContent = "Crear célula";
  if (btnCancelarCelula) btnCancelarCelula.classList.add("oculto");
}

function modoEditarCelula(celulaId) {
  const celula = celulas.find((c) => c.id === celulaId);
  if (!celula) return;

  editandoCelulaId.value = celula.id;
  nombreCelula.value = celula.nombre;
  const botonCelula = formCelula.querySelector("button[type='submit']");
  if (botonCelula) botonCelula.textContent = "Guardar cambios";
  if (btnCancelarCelula) btnCancelarCelula.classList.remove("oculto");
}

function modoEditarUsuario(userId) {
  const usuario = users.find((u) => u.id === userId);
  if (!usuario) return;

  editandoUsuarioId.value = usuario.id;
  nombreUsuario.value = usuario.nombre;
  loginUsuarioNuevo.value = usuario.username;
  claveUsuarioNuevo.value = usuario.password;
  rolUsuarioNuevo.value = usuario.rol;
  celulaUsuarioNuevo.value = usuario.celulaId || celulas[0]?.id || "";
  celulaUsuarioNuevo.disabled = usuario.rol === "admin";
  btnGuardarUsuario.textContent = "Guardar cambios";
  btnCancelarUsuario.classList.remove("oculto");
}

function refrescarTodo() {
  refrescarEstadoSesionUI();
  actualizarFiltroCelulas();
  actualizarFiltroMiembros();
  renderIntegrantes();
  renderFechas();
  renderMiembrosTabla();
  actualizarSelectorMesAsistencia();
  cargarTablaAsistencia();
  renderDashboard();
  renderReporte();
  renderAdmin();
}

function escapeCsv(valor) {
  return `"${String(valor ?? "").replaceAll('"', '""')}"`;
}

function exportarCsv() {
  const celulaId = obtenerCelulaOperacionId();
  if (!celulaId) {
    alert("Solo los líderes pueden exportar registros de su célula.");
    return;
  }

  const miembrosCelula = miembros.filter((m) => m.celulaId === celulaId);
  const fechasCelula = fechas.filter((f) => f.celulaId === celulaId).sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (miembrosCelula.length === 0 || fechasCelula.length === 0) {
    alert("No hay datos para exportar en esta célula.");
    return;
  }

  const cabecera = ["N°", "Nombre", "Tipo", ...fechasCelula.map((f) => formatearFecha(f.fecha))];
  const lineas = [cabecera.map(escapeCsv).join(",")];

  miembrosCelula.forEach((m, idx) => {
    const fila = [idx + 1, m.nombre, m.tipo];
    fechasCelula.forEach((f) => {
      const estado = asistencias[keyAsistencia(celulaId, m.id, f.fecha)];

      if (estado === true) {
        fila.push("Asistió");
      } else if (estado === false) {
        fila.push("Faltó");
      } else {
        fila.push("");
      }
    });
    lineas.push(fila.map(escapeCsv).join(","));
  });

  const blob = new Blob(["\uFEFF" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asistencia_${obtenerNombreCelula(celulaId).replaceAll(" ", "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportarResumenCsv() {
  const celulaId = obtenerCelulaOperacionId();
  if (!celulaId) {
    alert("Solo los líderes pueden exportar registros de su célula.");
    return;
  }

  const miembrosCelula = miembros.filter((m) => m.celulaId === celulaId);
  const fechasCelula = fechas.filter((f) => f.celulaId === celulaId).sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (miembrosCelula.length === 0 || fechasCelula.length === 0) {
    alert("No hay datos para exportar en esta célula.");
    return;
  }

  const cabecera = ["N°", "Nombre", "Tipo", "Asistencias", "Faltas", "Sin marcar", "Total fechas", "% asistencia"];
  const lineas = [cabecera.map(escapeCsv).join(",")];

  miembrosCelula.forEach((m, idx) => {
    let a = 0;
    let f = 0;
    let s = 0;
    fechasCelula.forEach((fecha) => {
      const estado = asistencias[keyAsistencia(celulaId, m.id, fecha.fecha)];
      if (estado === true) a += 1;
      else if (estado === false) f += 1;
      else s += 1;
    });

    lineas.push([
      idx + 1,
      m.nombre,
      m.tipo,
      a,
      f,
      s,
      fechasCelula.length,
      `${((a / fechasCelula.length) * 100).toFixed(2)}%`
    ].map(escapeCsv).join(","));
  });

  const blob = new Blob(["\uFEFF" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resumen_${obtenerNombreCelula(celulaId).replaceAll(" ", "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function modoEditarIntegrante(id) {
  const integrante = miembros.find((m) => String(m.id) === String(id));
  if (!integrante) return;

  editandoId.value = integrante.id;
  nombreIntegrante.value = integrante.nombre;
  tipoIntegrante.value = integrante.tipo;
  nacimientoIntegrante.value = integrante.nacimiento || "";
  celularIntegrante.value = integrante.celular || "";
  ingresoIntegrante.value = integrante.ingreso || "";
  btnGuardarIntegrante.textContent = "Guardar cambios";
  btnCancelarEdicion.classList.remove("oculto");
}

function cancelarEdicionIntegrante() {
  editandoId.value = "";
  formIntegrante.reset();
  btnGuardarIntegrante.textContent = "Agregar integrante";
  btnCancelarEdicion.classList.add("oculto");
}

function inicializarSesion() {
  cargarDatosDesdeNube()
    .finally(() => {
      migrarAsistenciasAntiguas();
      guardarDatos();

      if (!sesion) {
        mostrarLogin();
        return;
      }

      refrescarTodo();
      mostrarInicio();
    })
    .catch((error) => {
      console.error("Error al iniciar sesión:", error);
      mostrarLogin();
    });
}

formLogin.addEventListener("submit", (e) => {
  e.preventDefault();
  const u = users.find((x) => x.username === loginUsuario.value.trim() && x.password === loginClave.value);

  if (!u) {
    loginError.classList.remove("oculto");
    return;
  }

  loginError.classList.add("oculto");
  sesion = { id: u.id, nombre: u.nombre, rol: u.rol, celulaId: u.celulaId };
  guardarDatos();
  refrescarTodo();
  mostrarInicio();
  formLogin.reset();
});

btnCerrarSesion.addEventListener("click", () => {
  sesion = null;
  guardarDatos();
  mostrarLogin();
});

btnNavDashboard.addEventListener("click", () => {
  activarSeccion("seccionDashboard", btnNavDashboard);
  renderDashboard();
});

btnNavReportes.addEventListener("click", () => {
  activarSeccion("seccionReportes", btnNavReportes);
  renderReporte();
});

btnNavIntegrantes.addEventListener("click", () => {
  if (!puedeRegistrar()) return;
  activarSeccion("seccionIntegrantes", btnNavIntegrantes);
  renderIntegrantes();
});

btnNavMiembros.addEventListener("click", () => {
  activarSeccion("seccionMiembros", btnNavMiembros);
  actualizarFiltroMiembros();
  renderMiembrosTabla();
});

btnNavFechas.addEventListener("click", () => {
  if (!puedeRegistrar()) return;
  activarSeccion("seccionFechas", btnNavFechas);
  renderFechas();
});

btnNavAsistencia.addEventListener("click", () => {
  if (!puedeRegistrar()) return;
  const celulaId = obtenerCelulaActivaId();
  const hayMiembros = miembros.some((m) => m.celulaId === celulaId);
  const hayFechas = fechas.some((f) => f.celulaId === celulaId);

  if (!hayMiembros || !hayFechas) {
    alert("Debes registrar al menos un integrante y una fecha en la célula actual.");
    return;
  }

  actualizarSelectorMesAsistencia();
  cargarTablaAsistencia();
  mostrarAsistencia();
});

btnNavAdmin.addEventListener("click", () => {
  if (!esAdmin()) return;
  activarSeccion("seccionAdmin", btnNavAdmin);
  renderAdmin();
});

btnVolverInicio.addEventListener("click", mostrarInicio);
btnExportarCsv.addEventListener("click", exportarCsv);
btnExportarResumenCsv.addEventListener("click", exportarResumenCsv);
btnExportarPdfReporte.addEventListener("click", exportarReportePdf);

filtroCelulaDashboard.addEventListener("change", () => {
  actualizarFiltroLideresDashboard();
  sincronizarFiltrosDashboard();
  actualizarFiltroMesDashboard();
  actualizarFiltroFechaDashboard();
  renderIntegrantes();
  renderFechas();
  actualizarSelectorMesAsistencia();
  cargarTablaAsistencia();
  renderDashboard();
  renderReporte();
});

filtroLiderDashboard.addEventListener("change", () => {
  sincronizarFiltrosDashboard();
  actualizarFiltroLideresDashboard();
  actualizarFiltroMesDashboard();
  actualizarFiltroFechaDashboard();
  renderDashboard();
  renderReporte();
});

filtroMesDashboard.addEventListener("change", () => {
  sincronizarFiltrosDashboard();
  actualizarFiltroLideresDashboard();
  actualizarFiltroFechaDashboard();
  renderDashboard();
  renderReporte();
});

filtroFechaDashboard.addEventListener("change", () => {
  renderDashboard();
  renderReporte();
});

filtroCelulaReporte.addEventListener("change", renderReporte);
filtroLiderReporte.addEventListener("change", renderReporte);
filtroMesReporte.addEventListener("change", renderReporte);
filtroFechaReporte.addEventListener("change", renderReporte);
mesAsistencia.addEventListener("change", cargarTablaAsistencia);

filtroMiembrosCelula.addEventListener("change", renderMiembrosTabla);
filtroMiembrosLider.addEventListener("change", renderMiembrosTabla);

formIntegrante.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!puedeRegistrar()) return;

  const celulaId = obtenerCelulaActivaId();
  const nombre = nombreIntegrante.value.trim();
  if (!nombre || !celulaId) return;

  if (editandoId.value) {
    const idx = miembros.findIndex((m) => String(m.id) === editandoId.value);
    if (idx !== -1) {
      miembros[idx] = {
        ...miembros[idx],
        nombre,
        tipo: tipoIntegrante.value,
        nacimiento: nacimientoIntegrante.value,
        celular: celularIntegrante.value.trim(),
        ingreso: ingresoIntegrante.value
      };
    }
    cancelarEdicionIntegrante();
  } else {
    miembros.push({
      id: Date.now(),
      celulaId,
      nombre,
      tipo: tipoIntegrante.value,
      nacimiento: nacimientoIntegrante.value,
      celular: celularIntegrante.value.trim(),
      ingreso: ingresoIntegrante.value
    });
    formIntegrante.reset();
  }

  guardarDatos();
  renderIntegrantes();
  renderDashboard();
  renderReporte();
  cargarTablaAsistencia();
});

btnCancelarEdicion.addEventListener("click", cancelarEdicionIntegrante);

bodyIntegrantes.addEventListener("click", (e) => {
  if (!puedeRegistrar()) return;

  const btn = e.target.closest("button[data-id]");
  if (!btn) return;

  const id = btn.dataset.id;
  if (btn.classList.contains("btn-editar")) {
    modoEditarIntegrante(id);
    return;
  }

  if (btn.classList.contains("btn-eliminar")) {
    const celulaId = obtenerCelulaActivaId();
    miembros = miembros.filter((m) => String(m.id) !== id);

    Object.keys(asistencias).forEach((k) => {
      if (k.startsWith(`${celulaId}-${id}-`)) delete asistencias[k];
    });

    guardarDatos();
    renderIntegrantes();
    renderDashboard();
    renderReporte();
    cargarTablaAsistencia();
  }
});

bodyMiembros.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-editar")) {
    const miembroId = e.target.dataset.memberId;
    const celulaidAct = e.target.dataset.celulaId;
    if (!miembroId) return;
    
    const miembro = miembros.find((m) => String(m.id) === miembroId);
    if (!miembro) return;
    
    editarMiembroCelula(miembro, celulaidAct);
    return;
  }
  
  if (e.target.classList.contains("btn-eliminar")) {
    const miembroId = e.target.dataset.memberId;
    if (!miembroId) return;
    
    const ok = confirm("¿Estás seguro de que deseas eliminar este miembro?");
    if (!ok) return;
    
    const celulaId = e.target.dataset.celulaId;
    miembros = miembros.filter((m) => String(m.id) !== miembroId);
    
    Object.keys(asistencias).forEach((k) => {
      if (k.startsWith(`${celulaId}-${miembroId}-`)) delete asistencias[k];
    });
    
    guardarDatos();
    renderMiembrosTabla();
    renderDashboard();
    renderReporte();
    cargarTablaAsistencia();
    return;
  }
  
  if (e.target.classList.contains("btn-mover")) {
    const miembroId = e.target.dataset.memberId;
    const celulaActual = e.target.dataset.celulaId;
    if (!miembroId) return;
    
    const miembro = miembros.find((m) => String(m.id) === miembroId);
    if (!miembro) return;
    
    moverMiembroCelula(miembro, celulaActual);
    return;
  }
});

formFecha.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!puedeRegistrar()) return;

  const celulaId = obtenerCelulaActivaId();
  const fecha = fechaAsistencia.value;

  if (!fecha || !celulaId) return;
  if (fechas.some((f) => f.celulaId === celulaId && f.fecha === fecha)) return;

  fechas.push({
    celulaId,
    fecha,
    leccion: leccionFecha.value.trim(),
    docente: docenteFecha.value.trim(),
    ofrenda: Number.parseFloat(ofrendaFecha.value) || 0
  });

  guardarDatos();
  renderFechas();
  actualizarSelectorMesAsistencia();
  renderDashboard();
  renderReporte();
  cargarTablaAsistencia();
  formFecha.reset();
});

listaFechas.addEventListener("click", (e) => {
  if (!puedeRegistrar()) return;

  if (!e.target.classList.contains("btn-eliminar")) return;
  const celulaId = obtenerCelulaActivaId();
  const fecha = e.target.dataset.fecha;
  if (!fecha) return;

  fechas = fechas.filter((f) => !(f.celulaId === celulaId && f.fecha === fecha));

  Object.keys(asistencias).forEach((k) => {
    if (k.startsWith(`${celulaId}-`) && k.endsWith(`-${fecha}`)) delete asistencias[k];
  });

  guardarDatos();
  renderFechas();
  actualizarSelectorMesAsistencia();
  renderDashboard();
  renderReporte();
  cargarTablaAsistencia();
});

listaFechas.addEventListener("change", (e) => {
  if (!puedeRegistrar()) return;

  const celulaId = obtenerCelulaActivaId();
  const fecha = e.target.dataset.fecha;
  if (!fecha) return;

  const idx = fechas.findIndex((f) => f.celulaId === celulaId && f.fecha === fecha);
  if (idx === -1) return;

  if (e.target.classList.contains("input-leccion")) {
    fechas[idx].leccion = e.target.value.trim();
  }

  if (e.target.classList.contains("input-docente")) {
    fechas[idx].docente = e.target.value.trim();
  }

  if (e.target.classList.contains("input-ofrenda")) {
    fechas[idx].ofrenda = Number.parseFloat(e.target.value) || 0;
  }

  guardarDatos();
  renderDashboard();
  renderReporte();
});

bodyTabla.addEventListener("click", (e) => {
  if (!puedeRegistrar()) return;

  const id = e.target.dataset.id;
  const fecha = e.target.dataset.fecha;
  if (!id || !fecha) return;

  // Verificar que la fecha sea válida para este integrante
  const integrante = miembros.find(m => String(m.id) === String(id));
  if (integrante && integrante.ingreso && fecha < integrante.ingreso) {
    alert("No se puede registrar asistencia en fechas anteriores al ingreso del integrante.");
    return;
  }

  const celulaId = obtenerCelulaActivaId();
  const key = keyAsistencia(celulaId, id, fecha);

  if (asistencias[key] === undefined) asistencias[key] = true;
  else if (asistencias[key] === true) asistencias[key] = false;
  else delete asistencias[key];

  guardarDatos();
  renderDashboard();
  renderReporte();
  cargarTablaAsistencia();
});

btnLimpiarTodo.addEventListener("click", () => {
  if (!puedeRegistrar()) return;

  const celulaId = obtenerCelulaActivaId();
  const ok = confirm(`Se borrarán datos de la célula: ${obtenerNombreCelula(celulaId)}. ¿Continuar?`);
  if (!ok) return;

  miembros = miembros.filter((m) => m.celulaId !== celulaId);
  fechas = fechas.filter((f) => f.celulaId !== celulaId);

  Object.keys(asistencias).forEach((k) => {
    if (k.startsWith(`${celulaId}-`)) delete asistencias[k];
  });

  guardarDatos();
  refrescarTodo();
  mostrarInicio();
});

formCelula.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!esAdmin()) return;

  const nombre = nombreCelula.value.trim();
  if (!nombre) return;

  const editId = editandoCelulaId.value;
  const existeOtra = celulas.some((c) => c.id !== editId && c.nombre.toLowerCase() === nombre.toLowerCase());
  if (existeOtra) {
    alert("Ya existe una célula con ese nombre.");
    return;
  }

  if (editId) {
    const idx = celulas.findIndex((c) => c.id === editId);
    if (idx === -1) return;
    celulas[idx].nombre = nombre;
  } else {
    celulas.push({ id: `cel-${Date.now()}`, nombre });
  }

  guardarDatos();
  cancelarEdicionCelula();
  refrescarTodo();
});

rolUsuarioNuevo.addEventListener("change", () => {
  celulaUsuarioNuevo.disabled = rolUsuarioNuevo.value === "admin";
});

formUsuario.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!esAdmin()) return;

  const nombre = nombreUsuario.value.trim();
  const username = loginUsuarioNuevo.value.trim();
  const editId = editandoUsuarioId.value;

  if (!nombre || !username || !claveUsuarioNuevo.value) {
    alert("Completa nombre, usuario y contraseña.");
    return;
  }

  if (users.some((u) => u.id !== editId && u.username.toLowerCase() === username.toLowerCase())) {
    alert("El usuario ya existe.");
    return;
  }

  const rol = rolUsuarioNuevo.value;
  const celulaId = rol === "admin" ? null : celulaUsuarioNuevo.value;
  if (rol === "lider" && !celulaId) {
    alert("Selecciona una célula para el líder.");
    return;
  }

  if (editId) {
    const idx = users.findIndex((u) => u.id === editId);
    if (idx === -1) return;

    users[idx] = {
      ...users[idx],
      nombre,
      username,
      password: claveUsuarioNuevo.value,
      rol,
      celulaId
    };

    if (sesion?.id === editId) {
      sesion = {
        ...sesion,
        nombre,
        rol,
        celulaId
      };
    }
  } else {
    users.push({
      id: `u-${Date.now()}`,
      nombre,
      username,
      password: claveUsuarioNuevo.value,
      rol,
      celulaId
    });
  }

  guardarDatos();
  cancelarEdicionUsuario();
  refrescarTodo();
});

btnCancelarUsuario.addEventListener("click", cancelarEdicionUsuario);

bodyUsuarios.addEventListener("click", (e) => {
  if (!esAdmin()) return;

  const btn = e.target.closest("button[data-user-id]");
  if (!btn) return;
  const userId = btn.dataset.userId;
  const accion = btn.dataset.userAction;
  if (!userId || !accion) return;

  if (accion === "editar") {
    modoEditarUsuario(userId);
    return;
  }

  if (accion !== "eliminar") return;
  if (userId === sesion?.id) {
    alert("No puedes eliminar tu propio usuario en sesión.");
    return;
  }

  users = users.filter((u) => u.id !== userId);
  if (editandoUsuarioId.value === userId) {
    cancelarEdicionUsuario();
  }
  guardarDatos();
  refrescarTodo();
});

if (listaCelulas) {
  listaCelulas.addEventListener("click", (e) => {
    if (!esAdmin()) return;
    const btn = e.target.closest("button[data-celula-id]");
    if (!btn) return;

    const celulaId = btn.dataset.celulaId;
    const accion = btn.dataset.celulaAction;
    if (!celulaId || !accion) return;

    if (accion === "editar") {
      modoEditarCelula(celulaId);
      return;
    }

    if (accion === "guardar") {
      if (formCelula) {
        formCelula.requestSubmit();
      }
      return;
    }

    if (accion !== "eliminar") return;
    if (!confirm("¿Eliminar esta célula? Esta acción también puede afectar asignaciones de usuarios y miembros.")) return;

    celulas = celulas.filter((c) => c.id !== celulaId);
    users = users.map((u) => (u.celulaId === celulaId ? { ...u, celulaId: null } : u));
    miembros = miembros.map((m) => (m.celulaId === celulaId ? { ...m, celulaId: null } : m));
    fechas = fechas.map((f) => (f.celulaId === celulaId ? { ...f, celulaId: null } : f));
    if (editandoCelulaId.value === celulaId) cancelarEdicionCelula();
    guardarDatos();
    refrescarTodo();
  });
}

if (btnCancelarCelula) {
  btnCancelarCelula.addEventListener("click", cancelarEdicionCelula);
}

inicializarSesion();
