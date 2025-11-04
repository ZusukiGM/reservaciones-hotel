// ------------------- Configuración Supabase -------------------
const SUPABASE_URL = "https://uurwjqfawkeanmvafdxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cndqcWZhd2tlYW5tdmFmZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzcyNDQsImV4cCI6MjA3NjY1MzI0NH0.Qstjvg-GTTY0czItbjregsak7hKFXw40gqp92XPHFv8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------- Configuración de Capacidad Máxima -------------------
// Mapeo del tipo de habitación a la capacidad máxima de personas (Basado en información anterior)
const CAPACIDAD_MAXIMA_MAP = {
    // Los nombres deben coincidir exactamente con los tipos de la BD (columna 'tipo')
    "Habitación Sencilla": 1, 
    "Habitación Doble": 2, 
    "Suite": 4, // Asumiendo "Suite con terraza y jacuzzi"
    "Suite Deluxe": 6, 
    "Suite Sencilla": 2, 
    "Suite Doble": 4, 
    "Junior Suite": 4,
    "Master Suite": 6 
};

// ------------------- Utilidad: Feedback al usuario (Reemplazo de alert) -------------------
function showFeedback(message, isError = false) {
    const msgElement = document.getElementById('feedbackMessage');
    if (msgElement) {
        msgElement.textContent = message;
        msgElement.style.color = isError ? 'red' : 'green';
        setTimeout(() => msgElement.textContent = '', 5000); 
    } else if (isError) {
        console.error("Feedback Error:", message);
        alert(message); 
    }
}

// ------------------- Función: Cargar habitaciones -------------------
async function cargarHabitaciones() {
    try {
        const { data: habitaciones, error } = await supabaseClient
            .from('habitaciones')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        const contenedor = document.getElementById('habitaciones');
        const selectHabitacion = document.getElementById('habitacion');
        
        contenedor.innerHTML = habitaciones.map(h => {
            const maxHuespedes = CAPACIDAD_MAXIMA_MAP[h.tipo] || 'N/A';
            return `
                <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                    <h3>${h.tipo}</h3>
                    <p>Capacidad Máxima: ${maxHuespedes} personas</p> 
                    <p>Precio: $${h.precio}</p>
                    <p>Disponibles: ${h.disponible}</p>
                </div>
            `;
        }).join('');

        // Carga del selector de habitaciones, añadiendo 'data-max-huespedes'
        selectHabitacion.innerHTML = '<option value="">Seleccione tipo de habitación...</option>' + habitaciones
            .filter(h => h.disponible > 0)
            .map(h => {
                const maxHuespedes = CAPACIDAD_MAXIMA_MAP[h.tipo] || 1; 
                return `<option value="${h.id}" data-disponible="${h.disponible}" data-max-huespedes="${maxHuespedes}">${h.tipo} (Máx: ${maxHuespedes} pers.)</option>`;
            })
            .join('');

    } catch (err) {
        console.error("Error cargando habitaciones:", err.message);
        showFeedback("No se pudieron cargar las habitaciones.", true);
    }
}

// ------------------- Función: Generar Selector de Huéspedes (NUEVO) -------------------
function generarSelectorHuespedes() {
    const selectHabitacion = document.getElementById('habitacion');
    const selectCantidad = document.getElementById('cantidad');
    const selectedOption = selectHabitacion.options[selectHabitacion.selectedIndex];

    // Obtener la capacidad máxima
    const maxHuespedes = parseInt(selectedOption.getAttribute('data-max-huespedes')) || 0;

    // Limpiar opciones anteriores
    selectCantidad.innerHTML = '';
    
    if (maxHuespedes > 0) {
        selectCantidad.disabled = false;
        selectCantidad.innerHTML += '<option value="">Huéspedes</option>';
        
        // Crear opciones del 1 hasta la capacidad máxima
        for (let i = 1; i <= maxHuespedes; i++) {
            selectCantidad.innerHTML += `<option value="${i}">${i} Huésped${i > 1 ? 'es' : ''}</option>`;
        }
    } else {
        selectCantidad.disabled = true;
        selectCantidad.innerHTML += '<option value="">Seleccione habitación primero</option>';
    }
}


// ------------------- Función: Cargar Reservas en Recepción -------------------
async function cargarReservasRecepcion() {
    try {
        // Consulta para obtener reservas junto con datos del cliente y habitación
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

        const tbody = document.getElementById('tablaReservasBody');
        if (!tbody) return;

        tbody.innerHTML = ''; 

        if (reservas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay reservas registradas.</td></tr>';
            return;
        }

        reservas.forEach(r => {
            const row = tbody.insertRow();
            row.insertCell().textContent = r.folio;
            row.insertCell().textContent = r.clientes?.nombre || 'N/A';
            row.insertCell().textContent = r.clientes?.email || 'N/A';
            row.insertCell().textContent = r.habitaciones?.tipo || 'N/A';
            row.insertCell().textContent = r.fecha_checkin;
            row.insertCell().textContent = r.fecha_checkout;
            row.insertCell().textContent = r.cantidad; // Cantidad de Huéspedes
        });

    } catch (err) {
        console.error("Error cargando reservas para recepción:", err.message);
        document.getElementById('tablaReservasBody').innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error al cargar reservas. Revise la consola.</td></tr>';
    }
}

// ------------------- Función: Hacer reserva -------------------
async function hacerReserva(event) {
    event.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const idHabitacion = parseInt(document.getElementById('habitacion').value);
    const fechaCheckin = document.getElementById('checkin').value;
    const fechaCheckout = document.getElementById('checkout').value;
    // 'cantidad' es ahora el número de huéspedes (tomado del <select>)
    const cantidadHuespedes = parseInt(document.getElementById('cantidad').value); 
    const cantidadHabitaciones = 1; // ASUMIMOS solo 1 habitación por reserva para este modelo

    if (!idHabitacion || !cantidadHuespedes) {
        showFeedback("Seleccione tipo de habitación y número de huéspedes.", true);
        return;
    }

    // --- VALIDACIÓN DE DISPONIBILIDAD ---
    const optionSeleccionada = document.querySelector(`#habitacion option[value="${idHabitacion}"]`);
    const disponible = parseInt(optionSeleccionada.getAttribute('data-disponible'));

    if (cantidadHabitaciones > disponible) {
        showFeedback(`Solo hay ${disponible} habitaciones disponibles para este tipo.`, true);
        return;
    }

    try {
        // 1️⃣ Buscar o Crear Cliente
        let { data: cliente, error: clienteSearchError } = await supabaseClient
            .from('clientes')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (clienteSearchError) throw clienteSearchError;
        let idCliente;

        if (cliente) {
            idCliente = cliente.id; 
        } else {
            let { data: newCliente, error: clienteCreateError } = await supabaseClient
                .from('clientes')
                .insert([{ nombre, email }])
                .select('id')
                .single();
            if (clienteCreateError) throw clienteCreateError;
            idCliente = newCliente.id;
        }

        // 2️⃣ Crear reserva
        const folio = "RES" + Date.now();
        let { error: reservaError } = await supabaseClient
            .from('reservas')
            .insert([{
                id_habitacion: idHabitacion,
                id_cliente: idCliente,
                folio,
                fecha_checkin: fechaCheckin,
                fecha_checkout: fechaCheckout,
                cantidad: cantidadHuespedes // Guardamos los huéspedes
            }]);

        if (reservaError) throw reservaError;

        // 3️⃣ Actualizar disponibilidad (Restar 1 habitación)
        const nuevaDisponibilidad = disponible - 1; 

        await supabaseClient
            .from('habitaciones')
            .update({ disponible: nuevaDisponibilidad })
            .eq('id', idHabitacion);

        showFeedback("✅ Reserva realizada con éxito. Folio: " + folio);
        document.getElementById('formReserva').reset();
        document.getElementById('cantidad').disabled = true; // Deshabilitar después de reset
        generarSelectorHuespedes(); // Limpiar y deshabilitar el selector de huéspedes
        cargarHabitaciones(); 

    } catch (err) {
        console.error("Error haciendo reserva:", err.message);
        showFeedback("❌ Ocurrió un error al realizar la reserva.", true);
    }
}

// ------------------- Inicializar -------------------
function init() {
    const isReservaPage = document.getElementById('formReserva');
    const isRecepcionPage = document.getElementById('tablaReservasBody');

    if (isReservaPage) {
        // Lógica para index.HTML
        cargarHabitaciones();
        
        // Listener para actualizar el selector de huéspedes al cambiar la habitación
        document.getElementById('habitacion').addEventListener('change', generarSelectorHuespedes);
        
        // Configuración inicial del selector de huéspedes
        document.getElementById('cantidad').innerHTML = '<option value="">Seleccione habitación primero</option>';
        document.getElementById('cantidad').disabled = true;
        
        isReservaPage.addEventListener('submit', hacerReserva);
    } 
    
    if (isRecepcionPage) {
        // Lógica para recepcion.HTML
        cargarReservasRecepcion();
    }
}

document.addEventListener('DOMContentLoaded', init);
