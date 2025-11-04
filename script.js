// ------------------- Configuración Supabase -------------------
const SUPABASE_URL = "https://uurwjqfawkeanmvafdxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cndqcWZhd2tlYW5tdmFmZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzcyNDQsImV4cCI6MjA3NjY1MzI0NH0.Qstjvg-GTTY0czItbjregsak7hKFXw40gqp92XPHFv8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------- FUNCIÓN: Inicializar y Limitar Fechas (index.HTML) -------------------
function inicializarFechas() {
    const checkinInput = document.getElementById('checkin');
    const checkoutInput = document.getElementById('checkout');
    
    if (!checkinInput || !checkoutInput) return; // Asegurar que estamos en index.HTML

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
    
    // Obtener la capacidad máxima del atributo data-capacidad (cantidad_total en DB)
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
            const capacidadMaxima = h.cantidad_total || 1; // Usamos cantidad_total
            
            contenedor.innerHTML += `
                <div>
                    <h3>${h.tipo}</h3>
                    <p>Capacidad Máxima: ${capacidadMaxima} personas</p>
                    <p>Precio: $${h.precio}</p>
                    <p>Disponibles: <span style="color: #f39c12; font-weight: bold;">${h.disponible}</span></p>
                </div>
            `;

            if (h.disponible > 0) {
                // Se agrega el atributo data-capacidad para el select de huéspedes
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

// ------------------- LÓGICA DE LOGIN Y MODAL -------------------

const loginModal = document.getElementById('loginModal');
const loginBtn = document.getElementById('logo-recepcion-btn');
const closeBtn = document.querySelector('.close-btn');
const loginForm = document.getElementById('loginForm');
const loginFeedback = document.getElementById('loginFeedback');

// Función para abrir el modal al hacer clic en el logo
if (loginBtn) {
    loginBtn.onclick = function() {
        loginModal.style.display = 'flex'; // Usamos 'flex' para el centrado CSS
        if (loginFeedback) loginFeedback.textContent = ''; 
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    }
}

// Función para cerrar el modal al hacer clic en (x)
if (closeBtn) {
    closeBtn.onclick = function() {
        loginModal.style.display = 'none';
    }
}

// Función para cerrar el modal al hacer clic fuera
window.onclick = function(event) {
    if (event.target == loginModal) {
        loginModal.style.display = 'none';
    }
}

// Función principal de Login con Supabase Auth
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (loginFeedback) loginFeedback.textContent = 'Iniciando sesión...';
    
    try {
        // Usamos la autenticación de Supabase (debiste crear el usuario en el panel Auth)
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            if (loginFeedback) loginFeedback.textContent = `Error: Credenciales inválidas.`;
            console.error("Login error:", error.message);
            return;
        }

        // Si el login es exitoso
        if (loginFeedback) loginFeedback.textContent = '¡Acceso concedido! Redirigiendo...';
        // Redirigir a la página de recepción
        window.location.href = 'recepcion.HTML';

    } catch (err) {
        if (loginFeedback) loginFeedback.textContent = 'Ocurrió un error de conexión.';
        console.error("Unhandled login error:", err);
    }
}

// ------------------- Función: Cargar reservas en Recepción (recepcion.HTML) -------------------
async function cargarReservasRecepcion() {
    const tablaBody = document.getElementById('tablaReservasBody');
    if (!tablaBody) return; 
    
    tablaBody.innerHTML = '<tr><td colspan="7">Cargando reservas...</td></tr>';

    try {
        // SELECT con JOIN para obtener el nombre del cliente y el TIPO actual de la habitación (solución a cambio de nombres)
        const { data: reservas, error } = await supabaseClient
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

        if (error) throw error;

        tablaBody.innerHTML = ''; 

        reservas.forEach(r => {
            const clienteNombre = r.clientes ? r.clientes.nombre : 'N/A';
            const clienteEmail = r.clientes ? r.clientes.email : 'N/A';
            // Usa el campo 'tipo' de la tabla 'habitaciones'
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

        if (reservas.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="7">No hay reservas registradas.</td></tr>';
        }

    } catch (err) {
        console.error("Error cargando reservas para recepción:", err.message);
        tablaBody.innerHTML = `<tr><td colspan="7">Error al cargar datos: ${err.message}</td></tr>`;
    }
}

// ------------------- Inicializar -------------------
document.addEventListener('DOMContentLoaded', () => {
    // Si estamos en la página de reservas (index.HTML)
    if (document.getElementById('habitaciones')) {
        cargarHabitaciones();
        inicializarFechas(); 
        document.getElementById('formReserva').addEventListener('submit', hacerReserva);
        
        // Listener para el login
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
    }
    // Si estamos en la página de recepción (recepcion.HTML)
    if (document.getElementById('tablaReservasBody')) {
        cargarReservasRecepcion();
    }
});
