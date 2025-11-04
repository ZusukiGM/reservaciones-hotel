// ------------------- Configuración Supabase -------------------
const SUPABASE_URL = "https://uurwjqfawkeanmvafdxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cndqcWZhd2tlYW5tdmFmZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzcyNDQsImV4cCI6MjA3NjY1MzI0NH0.Qstjvg-GTTY0czItbjregsak7hKFXw40gqp92XPHFv8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------- FUNCIÓN: Inicializar y Limitar Fechas (index.HTML) -------------------
function inicializarFechas() {
    const checkinInput = document.getElementById('checkin');
    const checkoutInput = document.getElementById('checkout');
    
    if (!checkinInput || !checkoutInput) return;

    const today = new Date();
    
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayString = `${yyyy}-${mm}-${dd}`;

    checkinInput.min = todayString;

    checkinInput.addEventListener('change', () => {
        const checkinDate = new Date(checkinInput.value);
        
        if (!checkinInput.value) {
            checkoutInput.value = '';
            checkoutInput.min = '';
            return;
        }

        const nextDay = new Date(checkinDate);
        nextDay.setDate(checkinDate.getDate() + 1);

        const nextDayYyyy = nextDay.getFullYear();
        const nextDayMm = String(nextDay.getMonth() + 1).padStart(2, '0');
        const nextDayDd = String(nextDay.getDate()).padStart(2, '0');
        const nextDayString = `${nextDayYyyy}-${nextDayMm}-${nextDayDd}`;

        checkoutInput.min = nextDayString;

        if (checkoutInput.value && checkoutInput.value <= checkinInput.value) {
            checkoutInput.value = nextDayString;
        }
    });
}

// ------------------- FUNCIÓN: Actualizar lista de huéspedes (index.HTML) -------------------
function actualizarSelectHuespedes() {
    const selectHabitacion = document.getElementById('habitacion');
    const selectHuespedes = document.getElementById('cantidad');
    
    if (!selectHabitacion || !selectHuespedes) return;

    const selectedOption = selectHabitacion.options[selectHabitacion.selectedIndex];
    
    const capacidad = parseInt(selectedOption.getAttribute('data-capacidad') || 0);

    selectHuespedes.innerHTML = '<option value="">Seleccione cantidad de huéspedes...</option>';
    selectHuespedes.value = '';

    if (capacidad > 0) {
        for (let i = 1; i <= capacidad; i++) {
            selectHuespedes.innerHTML += `<option value="${i}">${i} Huésped${i > 1 ? 'es' : ''}</option>`;
        }
    }
}

// ------------------- Función: Cargar habitaciones (index.HTML) -------------------
async function cargarHabitaciones() {
    try {
        const { data: habitaciones, error } = await supabaseClient
            .from('habitaciones')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        const contenedor = document.getElementById('habitaciones');
        const selectHabitacion = document.getElementById('habitacion');
        
        if (!contenedor || !selectHabitacion) return;

        contenedor.innerHTML = '';
        selectHabitacion.innerHTML = '<option value="" data-capacidad="0">Seleccione tipo de habitación...</option>'; 

        habitaciones.forEach(h => {
            const capacidadMaxima = h.cantidad_total || 1;
            
            contenedor.innerHTML += `
                <div>
                    <h3>${h.tipo}</h3>
                    <p>Capacidad Máxima: ${capacidadMaxima} personas</p>
                    <p>Precio: $${h.precio}</p>
                    <p>Disponibles: <span>${h.disponible}</span></p>
                </div>
            `;

            if (h.disponible > 0) {
                selectHabitacion.innerHTML += `<option value="${h.id}" data-disponible="${h.disponible}" data-capacidad="${capacidadMaxima}">${h.tipo} (Máx: ${capacidadMaxima} pers.)</option>`;
            }
        });
        
        selectHabitacion.addEventListener('change', actualizarSelectHuespedes);
        actualizarSelectHuespedes(); 
        
    } catch (err) {
        console.error("Error cargando habitaciones:", err.message);
        const feedback = document.getElementById('feedbackMessage');
        if (feedback) feedback.textContent = "Error cargando habitaciones: " + err.message;
    }
}

// ------------------- Función: Hacer reserva (index.HTML) -------------------
async function hacerReserva(event) {
    event.preventDefault();

    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const idHabitacion = parseInt(document.getElementById('habitacion').value);
    const fechaCheckin = document.getElementById('checkin').value;
    const fechaCheckout = document.getElementById('checkout').value;
    const cantidad = parseInt(document.getElementById('cantidad').value); 
    const feedback = document.getElementById('feedbackMessage');

    if (!idHabitacion || !cantidad) {
        alert("Seleccione una habitación y la cantidad de huéspedes.");
        return;
    }

    const optionSeleccionada = document.querySelector(`#habitacion option[value="${idHabitacion}"]`);
    const disponible = parseInt(optionSeleccionada.getAttribute('data-disponible'));

    if (disponible < 1) { 
        alert(`La habitación ${optionSeleccionada.textContent} ya no tiene unidades disponibles.`);
        return;
    }

    try {
        // 1️⃣ Crear cliente
        let { data: cliente, error: clienteError } = await supabaseClient
            .from('clientes')
            .insert([{ nombre, email }])
            .select('id') 
            .single();

        if (clienteError) throw clienteError;

        // 2️⃣ Crear reserva
        const folio = "RES" + Date.now();
        let { error: reservaError } = await supabaseClient
            .from('reservas')
            .insert([{
                id_habitacion: idHabitacion,
                id_cliente: cliente.id,
                folio,
                fecha_checkin: fechaCheckin,
                fecha_checkout: fechaCheckout,
                cantidad 
            }]);

        if (reservaError) throw reservaError;

        // 3️⃣ Actualizar disponibilidad (Restar 1 unidad de habitación)
        const nuevaDisponibilidad = disponible - 1;

        await supabaseClient
            .from('habitaciones')
            .update({ disponible: nuevaDisponibilidad })
            .eq('id', idHabitacion);

        feedback.style.color = 'green';
        feedback.textContent = "✅ Reserva realizada con éxito. Folio: " + folio;
        document.getElementById('formReserva').reset();
        cargarHabitaciones(); 

    } catch (err) {
        console.error("Error haciendo reserva:", err.message);
        feedback.style.color = 'red';
        feedback.textContent = "❌ Ocurrió un error al realizar la reserva: " + err.message;
    }
}

// ------------------- Función auxiliar para renderizar la tabla -------------------
function renderReservas(reservas, tablaBody) {
    tablaBody.innerHTML = '';
    
    if (reservas.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="7">No se encontraron reservas.</td></tr>';
        return;
    }

    reservas.forEach(r => {
        const clienteNombre = r.clientes ? r.clientes.nombre : 'N/A';
        const clienteEmail = r.clientes ? r.clientes.email : 'N/A';
        const habitacionTipo = r.habitaciones ? r.habitaciones.tipo : 'ID: ' + r.id_habitacion;

        tablaBody.innerHTML += `
            <tr>
                <td>${r.folio}</td>
                <td>${clienteNombre}</td>
                <td>${clienteEmail}</td>
                <td>${habitacionTipo}</td>
                <td>${r.fecha_checkin}</td>
                <td>${r.fecha_checkout}</td>
                <td>${r.cantidad}</td>
            </tr>
        `;
    });
}

// ------------------- Función: Cargar reservas en Recepción (recepcion.HTML) -------------------
async function cargarReservasRecepcion(searchTerm = '') {
    const tablaBody = document.getElementById('tablaReservasBody');
    if (!tablaBody) return; 
    
    tablaBody.innerHTML = '<tr><td colspan="7">Cargando reservas...</td></tr>';

    try {
        let query = supabaseClient
            .from('reservas')
            .select(`
                folio,
                fecha_checkin,
                fecha_checkout,
                cantidad,
                clientes (nombre, email),
                habitaciones (tipo)
            `)
            .order('fecha_checkin', { ascending: false });

        const { data: allReservas, error } = await query;
        if (error) throw error;
        
        let reservasToRender = allReservas;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            
            reservasToRender = allReservas.filter(r => {
                const nombre = r.clientes?.nombre?.toLowerCase() || '';
                const email = r.clientes?.email?.toLowerCase() || '';
                const folio = r.folio?.toLowerCase() || '';
                
                return nombre.includes(term) || email.includes(term) || folio.includes(term);
            });
        }
        
        renderReservas(reservasToRender, tablaBody);

    } catch (err) {
        console.error("Error cargando reservas para recepción:", err.message);
        tablaBody.innerHTML = `<tr><td colspan="7">Error al cargar datos: ${err.message}</td></tr>`;
    }
}


// ------------------- FUNCIONES DE CONTROL DE FILTRO -------------------
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    cargarReservasRecepcion(searchTerm);
}

function handleClearFilter() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    cargarReservasRecepcion(''); // Recarga la tabla sin filtro
}


// ------------------- LÓGICA DE LOGIN Y LOGOUT -------------------

// Función para manejar el login
async function handleLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const loginFeedback = document.getElementById('loginFeedback');

    if (!emailInput || !passwordInput || !loginFeedback) return;

    const email = emailInput.value;
    const password = passwordInput.value;

    loginFeedback.style.color = 'gray';
    loginFeedback.textContent = 'Iniciando sesión...';
    
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            loginFeedback.style.color = 'red';
            loginFeedback.textContent = `Error: ${error.message}`;
            console.error("Login error:", error.message);
            return;
        }

        loginFeedback.style.color = 'green';
        loginFeedback.textContent = '¡Acceso concedido! Redirigiendo...';
        window.location.href = 'recepcion.HTML';

    } catch (err) {
        loginFeedback.style.color = 'red';
        loginFeedback.textContent = 'Ocurrió un error inesperado al conectar.';
        console.error("Unhandled login error:", err);
    }
}

// Función para manejar el logout
async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        alert('Sesión cerrada correctamente.');
        window.location.href = 'login.HTML'; // Redirige al login
    } catch (err) {
        console.error("Error al cerrar sesión:", err.message);
        alert('No se pudo cerrar la sesión: ' + err.message);
    }
}

// Función para verificar el estado de autenticación y proteger rutas
async function checkAuthAndProtectRoute() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const authContent = document.getElementById('authContent');
    const authMessage = document.getElementById('authMessage');
    const logoutBtn = document.getElementById('logoutBtn');
    const filterContainer = document.querySelector('.filter-container'); // También ocultar el filtro si no hay auth

    if (!authContent || !authMessage) return;

    if (user) {
        // Usuario autenticado, mostrar contenido
        authContent.style.display = 'block';
        if (filterContainer) filterContainer.style.display = 'flex'; // Mostrar el filtro
        authMessage.textContent = '';
        cargarReservasRecepcion(); // Cargar datos
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout); // Añadir listener de logout
    } else {
        // No autenticado, ocultar contenido y mostrar mensaje
        authContent.style.display = 'none';
        if (filterContainer) filterContainer.style.display = 'none'; // Ocultar el filtro
        authMessage.style.color = 'red';
        authMessage.textContent = 'Acceso denegado. Por favor, inicie sesión.';
        // Opcional: Redirigir directamente a login si no está autenticado
        // window.location.href = 'login.html';
    }
}


// ------------------- Inicializar -------------------
document.addEventListener('DOMContentLoaded', () => {
    // Si estamos en la página de reservas (index.HTML)
    if (document.getElementById('habitaciones')) {
        cargarHabitaciones();
        inicializarFechas(); 
        const formReserva = document.getElementById('formReserva');
        if (formReserva) formReserva.addEventListener('submit', hacerReserva);
    }
    // Si estamos en la página de login (login.HTML)
    else if (document.getElementById('loginForm')) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.addEventListener('submit', handleLogin);
    }
    // Si estamos en la página de recepción (recepcion.HTML)
    else if (document.getElementById('tablaReservasBody')) {
        checkAuthAndProtectRoute(); // Proteger la ruta de recepción
        
        const searchBtn = document.getElementById('searchBtn');
        const clearBtn = document.getElementById('clearBtn');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', handleSearch);
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', handleClearFilter);
        }
    }
});
