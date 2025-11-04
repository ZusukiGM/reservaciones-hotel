// ------------------- Configuración Supabase -------------------
const SUPABASE_URL = "https://uurwjqfawkeanmvafdxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cndqcWZhd2tlYW5tdmFmZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzcyNDQsImV4cCI6MjA3NjY1MzI0NH0.Qstjvg-GTTY0czItbjregsak7hKFXw40gqp92XPHFv8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------- Utilidad: Feedback al usuario (Reemplazo de alert) -------------------
// Utiliza el elemento <p id="feedbackMessage"> en index.html
function showFeedback(message, isError = false) {
    const msgElement = document.getElementById('feedbackMessage');
    if (msgElement) {
        msgElement.textContent = message;
        msgElement.style.color = isError ? 'red' : 'green';
        // Limpia el mensaje después de 5 segundos
        setTimeout(() => msgElement.textContent = '', 5000); 
    } else if (isError) {
        // Fallback si no hay elemento (por ejemplo, en recepcion.html si no se agregó)
        console.error("Feedback Error:", message);
        alert(message); 
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
        
        // Carga eficiente de la lista de habitaciones (Mejora de rendimiento)
        contenedor.innerHTML = habitaciones.map(h => `
            <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                <h3>${h.tipo}</h3>
                <p>Precio: $${h.precio}</p>
                <p>Disponibles: ${h.disponible}</p>
            </div>
        `).join('');

        // Carga del selector de habitaciones
        selectHabitacion.innerHTML = '<option value="">Seleccione tipo de habitación...</option>' + habitaciones
            .filter(h => h.disponible > 0)
            .map(h => `<option value="${h.id}" data-disponible="${h.disponible}">${h.tipo} (Disp.: ${h.disponible})</option>`)
            .join('');

    } catch (err) {
        console.error("Error cargando habitaciones:", err.message);
        showFeedback("No se pudieron cargar las habitaciones.", true);
    }
}

// ------------------- Función: Cargar Reservas en Recepción (recepcion.HTML) -------------------
async function cargarReservasRecepcion() {
    try {
        // Consulta para obtener reservas junto con datos del cliente y habitación (JOIN implícito)
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

        tbody.innerHTML = ''; // Limpiar tabla

        if (reservas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay reservas registradas.</td></tr>';
            return;
        }

        // Rellenar la tabla de recepción
        reservas.forEach(r => {
            const row = tbody.insertRow();
            row.insertCell().textContent = r.folio;
            // Uso de operador de encadenamiento opcional para datos relacionados
            row.insertCell().textContent = r.clientes?.nombre || 'N/A';
            row.insertCell().textContent = r.clientes?.email || 'N/A';
            row.insertCell().textContent = r.habitaciones?.tipo || 'N/A';
            row.insertCell().textContent = r.fecha_checkin;
            row.insertCell().textContent = r.fecha_checkout;
            row.insertCell().textContent = r.cantidad;
        });

    } catch (err) {
        console.error("Error cargando reservas para recepción:", err.message);
        document.getElementById('tablaReservasBody').innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Error al cargar reservas. Revise la consola.</td></tr>';
    }
}


// ------------------- Función: Hacer reserva (index.HTML) -------------------
async function hacerReserva(event) {
    event.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const idHabitacion = parseInt(document.getElementById('habitacion').value);
    const fechaCheckin = document.getElementById('checkin').value;
    const fechaCheckout = document.getElementById('checkout').value;
    const cantidad = parseInt(document.getElementById('cantidad').value);

    if (!idHabitacion) {
        showFeedback("Seleccione una habitación disponible.", true);
        return;
    }

    // --- Validación estricta para prevenir Disponibles negativos (CORRECCIÓN) ---
    const optionSeleccionada = document.querySelector(`#habitacion option[value="${idHabitacion}"]`);
    const disponible = parseInt(optionSeleccionada.getAttribute('data-disponible'));

    if (cantidad <= 0 || cantidad > disponible) {
        showFeedback(`Cantidad inválida. Solo hay ${disponible} habitaciones disponibles para este tipo.`, true);
        return;
    }

    try {
        // 1️⃣ Buscar o Crear Cliente (MEJORA: Evitar duplicados por email)
        let { data: cliente, error: clienteSearchError } = await supabaseClient
            .from('clientes')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (clienteSearchError) throw clienteSearchError;
        let idCliente;

        if (cliente) {
            idCliente = cliente.id; // Cliente encontrado, usar ID existente
        } else {
            // Cliente no existe, crearlo
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
                cantidad
            }]);

        if (reservaError) throw reservaError;

        // 3️⃣ Actualizar disponibilidad
        const nuevaDisponibilidad = disponible - cantidad;

        await supabaseClient
            .from('habitaciones')
            .update({ disponible: nuevaDisponibilidad })
            .eq('id', idHabitacion);

        showFeedback("✅ Reserva realizada con éxito. Folio: " + folio);
        document.getElementById('formReserva').reset();
        cargarHabitaciones(); // Refrescar la lista para ver la nueva disponibilidad

    } catch (err) {
        console.error("Error haciendo reserva:", err.message);
        showFeedback("❌ Ocurrió un error al realizar la reserva.", true);
    }
}

// ------------------- Inicializar (Ejecuta la función correcta según la página) -------------------
function init() {
    const isReservaPage = document.getElementById('formReserva');
    const isRecepcionPage = document.getElementById('tablaReservasBody');

    if (isReservaPage) {
        // Lógica para index.HTML
        cargarHabitaciones();
        isReservaPage.addEventListener('submit', hacerReserva);
    } 
    
    if (isRecepcionPage) {
        // Lógica para recepcion.HTML
        cargarReservasRecepcion();
    }
}

document.addEventListener('DOMContentLoaded', init);