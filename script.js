import { 
    db, 
    auth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    collection, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    doc, 
    updateDoc, 
    query, 
    orderBy, 
    serverTimestamp 
} from './firebase-config.js';

let registros = [];
let streamCamara = null;
let fotoCapturadaBase64 = "";
let usuarioAdminAutenticado = null;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const fotoPreview = document.getElementById('foto-preview');
const btnCapturar = document.getElementById('btn-capturar');
const btnRepetir = document.getElementById('btn-repetir');
const inputGaleria = document.getElementById('input-galeria');
const registroForm = document.getElementById('registro-form');

const radioTipos = document.querySelectorAll('input[name="tipo_id"]');
const groupVehiculoSelect = document.getElementById('group-vehiculo-select');
const vehiculoSelect = document.getElementById('vehiculo_select');

let adminStreamCamara = null;
let adminFotoBase64 = "";
const adminVideo = document.getElementById('admin-video');
const adminCanvas = document.getElementById('admin-canvas');
const adminFotoPreview = document.getElementById('admin-foto-preview');
const adminBtnCapturar = document.getElementById('admin-btn-capturar');
const adminBtnRepetir = document.getElementById('admin-btn-repetir');
const adminInputGaleria = document.getElementById('admin-input-galeria');
const adminRegistroForm = document.getElementById('admin-registro-form');
const adminRadioTipos = document.querySelectorAll('input[name="admin_tipo_id"]');
const adminGroupVehiculo = document.getElementById('admin-group-vehiculo-select');
const adminVehiculoSelect = document.getElementById('admin_vehiculo_select');

document.addEventListener('DOMContentLoaded', async () => {
    configurarEstadoAuthFirebase();
    await cargarRegistrosDesdeFirebase();
    iniciarCamara(video, s => streamCamara = s);
    configurarNavegacion();
    configurarEventosBusquedaFiltros();
    configurarCambioTipo(radioTipos, groupVehiculoSelect, vehiculoSelect);
    configurarCambioTipo(adminRadioTipos, adminGroupVehiculo, adminVehiculoSelect);
    configurarModalRegistroAdmin();
    configurarCierresModales();
});

// --- FIREBASE AUTHENTICATION ---
function configurarEstadoAuthFirebase() {
    onAuthStateChanged(auth, (user) => {
        const banner = document.getElementById('admin-session-banner');
        if (user) {
            usuarioAdminAutenticado = user;
            if (banner) banner.style.display = 'block';
        } else {
            usuarioAdminAutenticado = null;
            if (banner) banner.style.display = 'none';
        }
    });
}

// --- CAPTURA DE UBICACIÓN GPS ---
function obtenerUbicacionGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    precision: pos.coords.accuracy
                });
            },
            (err) => {
                console.warn("No se pudo obtener la geolocalización:", err.message);
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    });
}

// --- FUNCIONES DE BASE DE DATOS ---
async function cargarRegistrosDesdeFirebase() {
    try {
        const q = query(collection(db, "registros"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        registros = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            registros.push({
                firebaseId: docSnap.id,
                ...data,
                timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || Date.now())
            });
        });
        renderTablaUltimos();
        renderTablaAdmin();
    } catch (error) {
        console.error("Error al cargar registros de Firebase:", error);
    }
}

function configurarCambioTipo(radios, groupSelect, selectElem) {
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'CHASIS' || val === 'MOTOR') {
                groupSelect.style.display = 'block';
                selectElem.value = "";
                selectElem.required = true;
            } else {
                groupSelect.style.display = 'none';
                selectElem.value = "";
                selectElem.required = false;
            }
        });
    });
}

async function iniciarCamara(videoElem, setStreamCallback) {
    try {
        if (!videoElem) return;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setStreamCallback(stream);
        videoElem.srcObject = stream;
        videoElem.style.display = 'block';
    } catch (e) {
        console.warn("Cámara no disponible, use la galería.");
    }
}

function configurarCaptura(btnCap, btnRep, inpGal, vid, canv, prev, setFotoCb, getStreamCb, setStreamCb) {
    btnCap.addEventListener('click', () => {
        const currentStream = getStreamCb();
        if (!currentStream) {
            alert("⚠️ Cámara no activa. Seleccione una imagen desde la Galería.");
            inpGal.click();
            return;
        }
        canv.width = vid.videoWidth || 300;
        canv.height = vid.videoHeight || 300;
        const ctx = canv.getContext('2d');
        ctx.drawImage(vid, 0, 0, canv.width, canv.height);
        
        const base64 = canv.toDataURL('image/jpeg', 0.8);
        setFotoCb(base64);

        prev.src = base64;
        prev.style.display = 'block';
        vid.style.display = 'none';
        btnCap.style.display = 'none';
        btnRep.style.display = 'inline-flex';

        if (currentStream) {
            currentStream.getTracks().forEach(t => t.stop());
            setStreamCb(null);
        }
    });

    inpGal.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const base64 = event.target.result;
                setFotoCb(base64);

                prev.src = base64;
                prev.style.display = 'block';
                vid.style.display = 'none';
                btnCap.style.display = 'none';
                btnRep.style.display = 'inline-flex';

                const currentStream = getStreamCb();
                if (currentStream) {
                    currentStream.getTracks().forEach(t => t.stop());
                    setStreamCb(null);
                }
            }
            reader.readAsDataURL(file);
        }
    });
}

configurarCaptura(btnCapturar, btnRepetir, inputGaleria, video, canvas, fotoPreview, 
    (val) => fotoCapturadaBase64 = val, () => streamCamara, (s) => streamCamara = s);

btnRepetir.addEventListener('click', () => {
    fotoCapturadaBase64 = "";
    fotoPreview.src = "";
    fotoPreview.style.display = 'none';
    inputGaleria.value = "";
    video.style.display = 'block';
    btnRepetir.style.display = 'none';
    btnCapturar.style.display = 'inline-flex';
    iniciarCamara(video, s => streamCamara = s);
});

configurarCaptura(adminBtnCapturar, adminBtnRepetir, adminInputGaleria, adminVideo, adminCanvas, adminFotoPreview, 
    (val) => adminFotoBase64 = val, () => adminStreamCamara, (s) => adminStreamCamara = s);

adminBtnRepetir.addEventListener('click', () => {
    adminFotoBase64 = "";
    adminFotoPreview.src = "";
    adminFotoPreview.style.display = 'none';
    adminInputGaleria.value = "";
    adminVideo.style.display = 'block';
    adminBtnRepetir.style.display = 'none';
    adminBtnCapturar.style.display = 'inline-flex';
    iniciarCamara(adminVideo, s => adminStreamCamara = s);
});

function configurarModalRegistroAdmin() {
    const modal = document.getElementById('modal-nuevo-registro');
    const btnOpen = document.getElementById('btn-open-modal-registro');

    btnOpen.addEventListener('click', () => {
        modal.style.display = 'flex';
        iniciarCamara(adminVideo, s => adminStreamCamara = s);
    });
}

function configurarCierresModales() {
    document.querySelectorAll('.close-modal, .close-modal-edit, .close-modal-nuevo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = 'none';
            if (adminStreamCamara) {
                adminStreamCamara.getTracks().forEach(t => t.stop());
                adminStreamCamara = null;
            }
        });
    });
}

function validarYObtenerVehiculo(tipo, valor, selElem) {
    if (tipo === 'PLACA') {
        const regexAuto = /^[A-Z]{3}\d{3}$/;
        const regexMoto = /^[A-Z]{3}\d{2}([A-Z]{1})?$/;

        if (regexAuto.test(valor)) return 'AUTO';
        if (regexMoto.test(valor)) return 'MOTO';
        return null;
    } else {
        return selElem ? selElem.value : null;
    }
}

registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = document.querySelector('input[name="tipo_id"]:checked').value;
    const valorInput = document.getElementById('valor_id');
    const valor = valorInput.value.trim().toUpperCase();

    if (!fotoCapturadaBase64) return alert("⚠️ La fotografía es obligatoria.");
    if (!valor) return alert("⚠️ El dato del identificador es obligatorio.");
    if ((tipo === 'CHASIS' || tipo === 'MOTOR') && !vehiculoSelect.value) {
        return alert("⚠️ Por favor seleccione el Tipo de Vehículo.");
    }

    const vehiculo = validarYObtenerVehiculo(tipo, valor, vehiculoSelect);
    if (tipo === 'PLACA' && vehiculo === null) {
        alert(`❌ Formato de placa no válido.\nAuto: ABC123\nMoto: ABC12 o ABC12A`);
        valorInput.focus();
        return;
    }

    const ubicacion = await obtenerUbicacionGPS();
    await guardarNuevoRegistro(fotoCapturadaBase64, tipo, valor, vehiculo, ubicacion);
    registroForm.reset();
    document.getElementById('tipo-placa').checked = true;
    groupVehiculoSelect.style.display = 'none';
    btnRepetir.click();
});

adminRegistroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = document.querySelector('input[name="admin_tipo_id"]:checked').value;
    const valorInput = document.getElementById('admin_valor_id');
    const valor = valorInput.value.trim().toUpperCase();

    if (!adminFotoBase64) return alert("⚠️ La fotografía es obligatoria.");
    if (!valor) return alert("⚠️ El dato del identificador es obligatorio.");
    if ((tipo === 'CHASIS' || tipo === 'MOTOR') && !adminVehiculoSelect.value) {
        return alert("⚠️ Por favor seleccione el Tipo de Vehículo.");
    }

    const vehiculo = validarYObtenerVehiculo(tipo, valor, adminVehiculoSelect);
    if (tipo === 'PLACA' && vehiculo === null) {
        alert(`❌ Formato de placa no válido.\nAuto: ABC123\nMoto: ABC12 o ABC12A`);
        valorInput.focus();
        return;
    }

    const ubicacion = await obtenerUbicacionGPS();
    await guardarNuevoRegistro(adminFotoBase64, tipo, valor, vehiculo, ubicacion);
    
    document.getElementById('modal-nuevo-registro').style.display = 'none';
    adminRegistroForm.reset();
    document.getElementById('admin-tipo-placa').checked = true;
    adminGroupVehiculo.style.display = 'none';
    if (adminStreamCamara) { adminStreamCamara.getTracks().forEach(t => t.stop()); adminStreamCamara = null; }
    adminFotoBase64 = "";
    adminFotoPreview.src = "";
    adminFotoPreview.style.display = 'none';
    adminVideo.style.display = 'block';
    adminBtnRepetir.style.display = 'none';
    adminBtnCapturar.style.display = 'inline-flex';
});

async function guardarNuevoRegistro(foto, tipo, valor, vehiculo, ubicacion) {
    const existeDuplicado = registros.some(r => r.valor === valor);
    let estado = "NORMAL";

    if (existeDuplicado) {
        alert("⚠️ ALERTA: El dato ingresado ya se encuentra registrado. Se guardará marcado como DUPLICADO.");
        estado = "DUPLICADO";
    }

    const nuevoRegistro = {
        foto,
        tipo,
        valor,
        vehiculo,
        ubicacion: ubicacion || null,
        fecha: new Date().toLocaleString(),
        timestamp: serverTimestamp(),
        estado
    };

    try {
        const docRef = await addDoc(collection(db, "registros"), nuevoRegistro);
        registros.unshift({ 
            firebaseId: docRef.id, 
            ...nuevoRegistro, 
            timestamp: Date.now() 
        });
        renderTablaUltimos();
        renderTablaAdmin();
        alert("¡Registro guardado con éxito en Firebase!");
    } catch (e) {
        console.error("Error al guardar en Firebase:", e);
        alert("Error al guardar el registro.");
    }
}

// RENDER TABLA PÚBLICA (Sin datos de GPS)
function renderTablaUltimos(filtro = "") {
    const tbody = document.querySelector('#tabla-ultimos tbody');
    tbody.innerHTML = "";
    
    const filtroMayus = filtro.trim().toUpperCase();
    const filtrados = registros.filter(r => r.valor.includes(filtroMayus) || r.tipo.includes(filtroMayus) || r.vehiculo.includes(filtroMayus));
    const ultimos6 = filtrados.slice(0, 6);

    if (ultimos6.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Sin registros</td></tr>`;
        return;
    }

    ultimos6.forEach(item => {
        const tr = document.createElement('tr');
        if (item.estado === 'DUPLICADO') tr.classList.add('fila-duplicada');
        tr.innerHTML = `
            <td><img src="${item.foto}" class="table-img"></td>
            <td class="col-dato">${item.valor}</td>
            <td>${item.tipo}</td>
            <td>${item.vehiculo}</td>
            <td><span class="badge badge-${item.estado.toLowerCase()}">${item.estado}</span></td>
        `;
        tr.addEventListener('click', () => abrirModalDetalle(item, false));
        tbody.appendChild(tr);
    });
}

// RENDER TABLA ADMINISTRADOR (Incluye columna de Ubicación GPS)
function renderTablaAdmin() {
    const tbody = document.querySelector('#tabla-admin tbody');
    const busqueda = document.getElementById('buscador-admin').value.trim().toUpperCase();
    const tipo = document.getElementById('filtro-tipo').value;
    const vehiculoFiltro = document.getElementById('filtro-vehiculo').value;
    const estado = document.getElementById('filtro-estado').value;

    tbody.innerHTML = "";
    const filtrados = registros.filter(r => {
        const txt = r.valor.includes(busqueda) || r.fecha.includes(busqueda);
        const matchTipo = !tipo || r.tipo === tipo;
        const matchVehiculo = !vehiculoFiltro || r.vehiculo === vehiculoFiltro;
        const matchEstado = !estado || r.estado === estado;
        return txt && matchTipo && matchVehiculo && matchEstado;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">No hay resultados</td></tr>`;
        return;
    }

    filtrados.forEach(item => {
        const tr = document.createElement('tr');
        if (item.estado === 'DUPLICADO') tr.classList.add('fila-duplicada');
        
        let linkUbicacion = '<span style="color: var(--text-muted); font-size: 11px;">Sin GPS</span>';
        if (item.ubicacion && item.ubicacion.lat && item.ubicacion.lng) {
            linkUbicacion = `<a href="https://maps.google.com/?q=${item.ubicacion.lat},${item.ubicacion.lng}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;"><i class="fa-solid fa-location-dot"></i> Ver Mapa</a>`;
        }

        tr.innerHTML = `
            <td><img src="${item.foto}" class="table-img"></td>
            <td class="col-dato">${item.valor}</td>
            <td>${item.tipo}</td>
            <td>${item.vehiculo}</td>
            <td>${item.fecha}</td>
            <td>${linkUbicacion}</td>
            <td><span class="badge badge-${item.estado.toLowerCase()}">${item.estado}</span></td>
        `;
        tr.addEventListener('click', () => abrirModalDetalle(item, true));
        tbody.appendChild(tr);
    });
}

function configurarNavegacion() {
    const mainInterface = document.getElementById('main-interface');
    const loginInterface = document.getElementById('login-interface');
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');

    // Botón para acceder desde la vista pública
    document.getElementById('btn-goto-login').addEventListener('click', () => {
        mainInterface.classList.remove('active');
        loginInterface.classList.add('active');
        
        if (usuarioAdminAutenticado) {
            loginScreen.style.display = 'none';
            adminPanel.style.display = 'block';
            renderTablaAdmin();
        } else {
            loginScreen.style.display = 'flex';
            adminPanel.style.display = 'none';
        }
        if (streamCamara) { streamCamara.getTracks().forEach(t => t.stop()); streamCamara = null; }
    });

    // Volver de Login a Registro
    document.getElementById('btn-back-main').addEventListener('click', () => {
        loginInterface.classList.remove('active');
        mainInterface.classList.add('active');
        iniciarCamara(video, s => streamCamara = s);
    });

    // Ir de Admin Panel a Registro (Sin cerrar sesión)
    const btnGotoRegistro = document.getElementById('btn-goto-registro-from-admin');
    if (btnGotoRegistro) {
        btnGotoRegistro.addEventListener('click', () => {
            loginInterface.classList.remove('active');
            mainInterface.classList.add('active');
            iniciarCamara(video, s => streamCamara = s);
        });
    }

    // Báner superior para volver a Admin
    const btnReturnAdmin = document.getElementById('btn-return-admin');
    if (btnReturnAdmin) {
        btnReturnAdmin.addEventListener('click', () => {
            mainInterface.classList.remove('active');
            loginInterface.classList.add('active');
            loginScreen.style.display = 'none';
            adminPanel.style.display = 'block';
            renderTablaAdmin();
        });
    }

    // FORMULARIO DE LOGIN AUTENTICADO CON FIREBASE AUTH
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const pass = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            loginScreen.style.display = 'none';
            adminPanel.style.display = 'block';
            renderTablaAdmin();
        } catch (error) {
            console.error("Error al iniciar sesión:", error);
            alert("❌ Acceso denegado: Usuario no autorizado o credenciales incorrectas.");
        }
    });

    // CERRAR SESIÓN
    document.getElementById('btn-logout').addEventListener('click', async () => {
        try {
            await signOut(auth);
            adminPanel.style.display = 'none';
            loginScreen.style.display = 'flex';
            document.getElementById('login-form').reset();
            alert("Sesión cerrada correctamente.");
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        }
    });
}

function configurarEventosBusquedaFiltros() {
    document.getElementById('buscador-principal').addEventListener('input', (e) => renderTablaUltimos(e.target.value));
    document.getElementById('buscador-admin').addEventListener('input', renderTablaAdmin);
    document.getElementById('filtro-tipo').addEventListener('change', renderTablaAdmin);
    document.getElementById('filtro-vehiculo').addEventListener('change', renderTablaAdmin);
    document.getElementById('filtro-estado').addEventListener('change', renderTablaAdmin);
}

function abrirModalDetalle(item, esAdmin = false) {
    const modal = document.getElementById('modal-detalle');
    
    let htmlUbicacion = '';
    if (esAdmin) {
        if (item.ubicacion && item.ubicacion.lat && item.ubicacion.lng) {
            htmlUbicacion = `<p><strong>Ubicación GPS:</strong> <a href="https://maps.google.com/?q=${item.ubicacion.lat},${item.ubicacion.lng}" target="_blank" style="color: #2563eb; font-weight: bold;"><i class="fa-solid fa-location-dot"></i> Ver en Google Maps</a> (${item.ubicacion.lat.toFixed(5)}, ${item.ubicacion.lng.toFixed(5)})</p>`;
        } else {
            htmlUbicacion = `<p><strong>Ubicación GPS:</strong> No registrada</p>`;
        }
    }

    document.getElementById('modal-body-content').innerHTML = `
        <img src="${item.foto}">
        <p><strong>Dato:</strong> ${item.valor}</p>
        <p><strong>Tipo:</strong> ${item.tipo}</p>
        <p><strong>Vehículo:</strong> ${item.vehiculo}</p>
        <p><strong>Fecha:</strong> ${item.fecha}</p>
        ${htmlUbicacion}
        <p><strong>Estado:</strong> <span class="badge badge-${item.estado.toLowerCase()}">${item.estado}</span></p>
    `;

    const actionsContainer = document.getElementById('modal-actions-container');
    if (esAdmin) {
        actionsContainer.style.display = 'flex';
        actionsContainer.innerHTML = `
            <button class="btn btn-warning btn-block" onclick="abrirModalEditarDesdeDetalle('${item.firebaseId}')"><i class="fa-solid fa-pen"></i> Editar</button>
            <button class="btn btn-danger btn-block" onclick="eliminarRegistroDesdeDetalle('${item.firebaseId}')"><i class="fa-solid fa-trash"></i> Eliminar</button>
        `;
    } else {
        actionsContainer.style.display = 'none';
        actionsContainer.innerHTML = '';
    }

    modal.style.display = 'flex';
}

window.abrirModalEditarDesdeDetalle = function(firebaseId) {
    document.getElementById('modal-detalle').style.display = 'none';
    abrirModalEditar(firebaseId);
}

window.eliminarRegistroDesdeDetalle = async function(firebaseId) {
    if (confirm("¿Está seguro de eliminar este registro de Firebase?")) {
        try {
            await deleteDoc(doc(db, "registros", firebaseId));
            registros = registros.filter(r => r.firebaseId !== firebaseId);
            document.getElementById('modal-detalle').style.display = 'none';
            renderTablaAdmin();
            renderTablaUltimos();
            alert("Registro eliminado con éxito.");
        } catch (e) {
            console.error("Error al eliminar:", e);
            alert("No se pudo eliminar el registro.");
        }
    }
}

function abrirModalEditar(firebaseId) {
    const item = registros.find(r => r.firebaseId === firebaseId);
    if (!item) return;
    document.getElementById('edit-id').value = item.firebaseId;
    document.getElementById('edit-tipo').value = item.tipo;
    document.getElementById('edit-vehiculo').value = item.vehiculo;
    document.getElementById('edit-valor').value = item.valor;
    document.getElementById('modal-editar').style.display = 'flex';
}

document.getElementById('editar-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const firebaseId = document.getElementById('edit-id').value;
    const tipo = document.getElementById('edit-tipo').value;
    const vehiculoEdit = document.getElementById('edit-vehiculo').value;
    const valorInput = document.getElementById('edit-valor');
    const valor = valorInput.value.trim().toUpperCase();

    let vehiculoFinal = vehiculoEdit;

    if (tipo === 'PLACA') {
        const resultadoPlaca = validarYObtenerVehiculo(tipo, valor, null);
        if (resultadoPlaca === null) {
            alert(`❌ Formato de placa no válido.\nAuto: ABC123\nMoto: ABC12 o ABC12A`);
            valorInput.focus();
            return;
        }
        vehiculoFinal = resultadoPlaca;
    }

    const dupCount = registros.filter(r => r.valor === valor && r.firebaseId !== firebaseId).length;
    const nuevoEstado = dupCount > 0 ? 'DUPLICADO' : 'NORMAL';

    try {
        const docRef = doc(db, "registros", firebaseId);
        await updateDoc(docRef, {
            tipo,
            valor,
            vehiculo: vehiculoFinal,
            estado: nuevoEstado
        });

        const idx = registros.findIndex(r => r.firebaseId === firebaseId);
        if (idx !== -1) {
            registros[idx].tipo = tipo;
            registros[idx].valor = valor;
            registros[idx].vehiculo = vehiculoFinal;
            registros[idx].estado = nuevoEstado;
        }

        document.getElementById('modal-editar').style.display = 'none';
        renderTablaAdmin();
        renderTablaUltimos();
        alert("Registro actualizado correctamente en Firebase.");
    } catch (e) {
        console.error("Error al actualizar:", e);
        alert("Error al actualizar el registro.");
    }
});

// EXPORTACIÓN A EXCEL (Incluyendo coordenadas de GPS para el Admin)
document.getElementById('btn-exportar').addEventListener('click', () => {
    const busqueda = document.getElementById('buscador-admin').value.trim().toUpperCase();
    const tipoFiltro = document.getElementById('filtro-tipo').value;
    const vehiculoFiltro = document.getElementById('filtro-vehiculo').value;
    const estadoFiltro = document.getElementById('filtro-estado').value;

    const filtrados = registros.filter(r => {
        const txt = r.valor.includes(busqueda) || r.fecha.includes(busqueda);
        const matchTipo = !tipoFiltro || r.tipo === tipoFiltro;
        const matchVehiculo = !vehiculoFiltro || r.vehiculo === vehiculoFiltro;
        const matchEstado = !estadoFiltro || r.estado === estadoFiltro;
        return txt && matchTipo && matchVehiculo && matchEstado;
    });

    if (filtrados.length === 0) return alert("No hay datos para exportar.");

    const datosExportar = filtrados.map(item => ({
        "DATO": item.valor,
        "TIPO": item.tipo,
        "VEHÍCULO": item.vehiculo,
        "FECHA": item.fecha,
        "LATITUD": item.ubicacion ? item.ubicacion.lat : "N/A",
        "LONGITUD": item.ubicacion ? item.ubicacion.lng : "N/A",
        "ESTADO": item.estado
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registros CEGES");

    XLSX.writeFile(workbook, `reporte_registros_${new Date().toISOString().slice(0,10)}.xlsx`);
});