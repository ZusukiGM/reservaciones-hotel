// ------------------- Configuración Supabase -------------------
const SUPABASE_URL = "https://uurwjqfawkeanmvafdxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cndqcWZhd2tlYW5tdmFmZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzcyNDQsImV4cCI6MjA3NjY1MzI0NH0.Qstjvg-GTTY0czItbjregsak7hKFXw40gqp92XPHFv8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------- FUNCIÓN: Inicializar y Limitar Fechas (index.HTML) -------------------
function inicializarFechas() {
    const checkinInput = document.getElementById('checkin');
    const checkoutInput = document.getElementById('checkout');
    const today = new Date();
    
    // Formatea la fecha a YYYY-MM-DD
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayString = `${yyyy}-${mm}-${dd}`;

    // 1. Limitar Check-in: No puede ser antes de hoy
    checkinInput.min = todayString;

    // 2. Establecer listener para Check-in
    checkinInput.addEventListener('change', () => {
        const checkinDate = new Date(checkinInput.value);
        
        if (!checkinInput.value) {
            checkoutInput.value = '';
            checkoutInput.min = '';
            return;
        }

        // Check-out debe ser al menos un día después del check-in
        const nextDay = new Date(checkinDate);
        nextDay.setDate(checkinDate.getDate() + 1);

        const nextDayYyyy = nextDay.getFullYear();
        const nextDayMm = String(nextDay.getMonth() + 1).padStart(2, '0');
        const nextDayDd = String(nextDay.getDate()).padStart(2, '0');
        const nextDayString = `${nextDayYyyy}-${nextDayMm}-${nextDayDd}`;

        checkoutInput.min = nextDayString;

        // Si la fecha de salida seleccionada es igual o anterior a la de llegada, la reseteamos
        if (checkoutInput.value && checkoutInput.value <= checkinInput.value) {
            checkoutInput.value = nextDayString;
        }
    });
}

// ------------------- FUNCIÓN: Actualizar lista de huéspedes (index.HTML) -------------------
function actualizarSelectHuespedes() {
    const selectHabitacion = document.getElementById('habitacion');
    const selectHuespedes = document.getElementById('cantidad');
    const selectedOption = selectHabitacion.options[selectHabitacion.selectedIndex];
    
    // Obtener la capacidad máxima del atributo data-capacidad que se inyecta en cargarHabitaciones
    const capacidad = parseInt(selectedOption.getAttribute('data-capacidad') || 0);

    // Limpiar y resetear el select de huéspedes
    selectHuespedes.innerHTML = '<option value="">Seleccione cantidad de huéspedes...</option>';
    selectHuespedes.value = '';

    if (capacidad > 0) {
        // Generar opciones desde 1 hasta la capacidad máxima
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
        contenedor.innerHTML = '';
        selectHabitacion.innerHTML = '<option value="" data-capacidad="0">Seleccione tipo de habitación...</option>'; 

        habitaciones.forEach(h => {
            // Usamos 'cantidad_total' para la capacidad máxima de huéspedes
            const capacidadMaxima = h.cantidad_total || 1;
            
            // Renderizar la tarjeta 
            contenedor.innerHTML += `
                <div>
                    <h3>${h.tipo}</h3>
                    <p>Capacidad Máxima: ${capacidadMaxima} personas</p>
                    <p>Precio: $${h.precio}</p>
                    <p>Disponibles: <span style="color: #f39c12; font-weight: bold;">${h.disponible}</span></p>
                </div>
            `;

            if (h.disponible > 0) {
                // Se agrega el atributo data-capacidad al <option> para el select de huéspedes
                selectHabitacion.innerHTML += `<option value="${h.id}" data-disponible="${h.disponible}" data-capacidad="${capacidadMaxima}">${h.tipo} (Máx: ${capacidadMaxima} pers.)</option>`;
            }
        });
        
        // Asignar el listener para actualizar huéspedes al cambiar la habitación
        selectHabitacion.addEventListener('change', actualizarSelectHuespedes);
        actualizarSelectHuespedes(); // Llamada inicial
        
    } catch (err) {
        console.error("Error cargando habitaciones:", err.message);
        document.getElementById('feedbackMessage').textContent = "Error cargando habitaciones: " + err.message;
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

    if (!idHabitacion || !cantidad) {
        alert("Seleccione una habitación y la cantidad de huéspedes.");
        return;
    }

    // ------------------- Validar disponibilidad (Unidad de Habitación) -------------------
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
                cantidad // Cantidad de huéspedes
            }]);

        if (reservaError) throw reservaError;

        // 3️⃣ Actualizar disponibilidad (Restar 1 unidad de habitación)
        const nuevaDisponibilidad = disponible - 1;

        await supabaseClient
            .from('habitaciones')
            .update({ disponible: nuevaDisponibilidad })
            .eq('id', idHabitacion);

        document.getElementById('feedbackMessage').style.color = 'green';
        document.getElementById('feedbackMessage').textContent = "✅ Reserva realizada con éxito. Folio: " + folio;
        document.getElementById('formReserva').reset();
        cargarHabitaciones(); 

    } catch (err) {
        console.error("Error haciendo reserva:", err.message);
        document.getElementById('feedbackMessage').style.color = 'red';
        document.getElementById('feedbackMessage').textContent = "❌ Ocurrió un error al realizar la reserva: " + err.message;
    }
}

// ------------------- Función: Cargar reservas en Recepción (recepcion.HTML) -------------------
async function cargarReservasRecepcion() {
    const tablaBody = document.getElementById('tablaReservasBody');
    tablaBody.innerHTML = '<tr><td colspan="7">Cargando reservas...</td></tr>';

    try {
        // Hacemos un JOIN (select con JOIN) para obtener el nombre del cliente y el tipo de habitación.
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

        tablaBody.innerHTML = ''; // Limpiar el mensaje de carga

        reservas.forEach(r => {
            const clienteNombre = r.clientes ? r.clientes.nombre : 'N/A';
            const clienteEmail = r.clientes ? r.clientes.email : 'N/A';
            // Usamos r.habitaciones.tipo para obtener el nombre actual de la habitación (e.g., Suite Sencilla)
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

        // Si no hay reservas
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
        inicializarFechas(); // Limitar las fechas
        document.getElementById('formReserva').addEventListener('submit', hacerReserva);
    }
    // Si estamos en la página de recepción (recepcion.HTML)
    if (document.getElementById('tablaReservasBody')) {
        cargarReservasRecepcion();
    }
});
