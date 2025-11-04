// ------------------- Configuración Supabase -------------------
const SUPABASE_URL = "https://uurwjqfawkeanmvafdxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cndqcWZhd2tlYW5tdmFmZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzcyNDQsImV4cCI6MjA3NjY1MzI0NH0.Qstjvg-GTTY0czItbjregsak7hKFXw40gqp92XPHFv8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------- Configuración de Capacidad Máxima -------------------
// Mapeo del tipo de habitación a la capacidad máxima de personas (Basado en la información proporcionada)
const CAPACIDAD_MAXIMA_MAP = {
    // Los nombres deben coincidir exactamente con los tipos de la BD (columna 'tipo')
    "Habitación Sencilla": 1, 
    "Habitación Doble": 2, 
    "Suite": 4, // "Suite con terraza y jacuzzi" -> 4 personas (asumiendo)
    "Suite Deluxe": 6, // Asumiendo que esta es una de las suites grandes (4-6 personas)
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
        // Usamos alert como último recurso si el elemento no existe en la página
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
                const maxHuespedes = CAPACIDAD_MAXIMA_MAP[h.tipo] || 1; // Fallback seguro
                return `<option value="${h.id}" data-disponible="${h.disponible}" data-max-huespedes="${maxHuespedes}">${h.tipo} (Máx: ${maxHuespedes} pers.)</option>`;
            })
            .join('');

    } catch (err) {
        console.error("Error cargando habitaciones:", err.message);
        showFeedback("No se pudieron cargar las habitaciones.", true);
    }
}

// ------------------- Función: Manejar cambio de habitación (NUEVO) -------------------
function actualizarLimiteHuespedes() {
    const selectHabitacion = document.getElementById('habitacion');
    const inputCantidad = document.getElementById('cantidad');
    const selectedOption = selectHabitacion.options[selectHabitacion.selectedIndex];

    // Obtener la capacidad máxima del atributo de datos
    const maxHuespedes = parseInt(selectedOption.getAttribute('data-max-huespedes'));

    if (maxHuespedes > 0) {
        // Establecer el límite máximo en el input y actualizar el placeholder
        inputCantidad.max = maxHuespedes;
        inputCantidad.placeholder = `Cantidad de huéspedes (Máx: ${maxHuespedes})`;
    } else {
        // Si no hay habitación seleccionada o capacidad no definida
        inputCantidad.max = 99; // Restaurar un límite alto para no bloquear
        inputCantidad.placeholder = 'Cantidad de noches/huéspedes';
    }
    inputCantidad.value = 1; // Reseteamos a 1 para mayor claridad
}


// ------------------- Función: Cargar Reservas en Recepción -------------------
async function cargarReservasRecepcion() {
    try {
        // Consulta con JOIN implícito para obtener datos de Cliente y Habitación
        const { data: reservas, error } = await supabaseClient
            .from('reservas')
            .select(`
                folio,
                fecha_checkin,
                fecha_checkout,
                cantidad, // Ahora representa la cantidad de Huéspedes
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

        // Rellenar la tabla
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
    // La 'cantidad' ahora representa los Huéspedes (y también 1 habitación, en este modelo)
    const cantidadHuespedes = parseInt(document.getElementById('cantidad').value); 
    const cantidadHabitaciones = 1; // ASUMIMOS SOLO 1 HABITACIÓN POR RESERVA PARA ESTE MODELO

    if (!idHabitacion) {
        showFeedback("Seleccione un tipo de habitación.", true);
        return;
    }

    // --- VALIDACIÓN DE CAPACIDAD (Limitamos a 1 habitación) ---
    const optionSeleccionada = document.querySelector(`#habitacion option[value="${idHabitacion}"]`);
    const disponible = parseInt(optionSeleccionada.getAttribute('data-disponible'));
    const maxHuespedes = parseInt(optionSeleccionada.getAttribute('data-max-huespedes'));

    if (cantidadHabitaciones > disponible) {
        showFeedback(`Solo hay ${disponible} habitaciones disponibles para este tipo.`, true);
        return;
    }
    
    // Nueva validación: ¿Los huéspedes exceden la capacidad máxima de UNA habitación?
    if (cantidadHuespedes > maxHuespedes) {
        showFeedback(`El número de huéspedes (${cantidadHuespedes}) excede la capacidad máxima de esta habitación (${maxHuespedes}).`, true);
        return;
    }


    try {
        // 1️⃣ Buscar o Crear Cliente (Mejora: Evitar duplicados)
        let { data: cliente, error: clienteSearchError } = await supabaseClient
            .from('clientes')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (clienteSearchError) throw clienteSearchError;
        let idCliente;

        if (cliente) {
            idCliente = cliente.id; // Cliente encontrado
        } else {
            let { data: newCliente, error: clienteCreateError } = await supabaseClient
                .from('clientes')
                .insert([{ nombre, email }])
                .select('id')
                .single();
            if (clienteCreateError) throw clienteCreateError;
            idCliente = newCliente.id; // Cliente creado
        }

        // 2️⃣ Crear reserva
        const folio = "RES" + Date.now();
        // Usamos el campo 'cantidad' de la BD para guardar la cantidad de HUÉSPEDES
        let { error: reservaError } = await supabaseClient
            .from('reservas')
            .insert([{
                id_habitacion: idHabitacion,
                id_cliente: idCliente,
                folio,
                fecha_checkin: fechaCheckin,
                fecha_checkout: fechaCheckout,
                cantidad: cantidadHuespedes // Guardar los huéspedes
            }]);

        if (reservaError) throw reservaError;

        // 3️⃣ Actualizar disponibilidad (Restar 1 habitación, ya que la reserva es por 1)
        const nuevaDisponibilidad = disponible - 1; 

        await supabaseClient
            .from('habitaciones')
            .update({ disponible: nuevaDisponibilidad })
            .eq('id', idHabitacion);

        showFeedback("✅ Reserva realizada con éxito. Folio: " + folio);
        document.getElementById('formReserva').reset();
        document.getElementById('cantidad').placeholder = 'Cantidad de noches/huéspedes'; // Resetear placeholder
        cargarHabitaciones(); // Refrescar la lista

    } catch (err) {
        console.error("Error haciendo reserva:", err.message);
        showFeedback("❌ Ocurrió un error al realizar la reserva.", true);
    }
}

// ------------------- Inicializar (Adaptado a ambas páginas) -------------------
function init() {
    const isReservaPage = document.getElementById('formReserva');
    const isRecepcionPage = document.getElementById('tablaReservasBody');

    if (isReservaPage) {
        // Lógica de la página de reservas (index.HTML)
        cargarHabitaciones();
        // Listener para actualizar el límite de huéspedes al cambiar la habitación
        document.getElementById('habitacion').addEventListener('change', actualizarLimiteHuespedes);
        
        isReservaPage.addEventListener('submit', hacerReserva);
    } 
    
    if (isRecepcionPage) {
        // Lógica de la página de recepción (recepcion.HTML)
        cargarReservasRecepcion();
    }
}

document.addEventListener('DOMContentLoaded', init);