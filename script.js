// ------------------- Configuración Supabase -------------------
const SUPABASE_URL = "https://uurwjqfawkeanmvafdxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cndqcWZhd2tlYW5tdmFmZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzcyNDQsImV4cCI6MjA3NjY1MzI0NH0.Qstjvg-GTTY0czItbjregsak7hKFXw40gqp92XPHFv8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
        contenedor.innerHTML = '';
        selectHabitacion.innerHTML = '<option value="">Seleccione habitación</option>';

        habitaciones.forEach(h => {
            contenedor.innerHTML += `
                <div>
                    <h3>${h.tipo}</h3>
                    <p>${h.descripcion}</p>
                    <p>Precio: $${h.precio}</p>
                    <p>Disponibles: ${h.disponible}</p>
                </div>
            `;

            if (h.disponible > 0) {
                selectHabitacion.innerHTML += `<option value="${h.id}" data-disponible="${h.disponible}">${h.tipo} (Disponibles: ${h.disponible})</option>`;
            }
        });

    } catch (err) {
        console.error("Error cargando habitaciones:", err.message);
        alert("No se pudieron cargar las habitaciones. Revisa la consola.");
    }
}

// ------------------- Función: Hacer reserva -------------------
async function hacerReserva(event) {
    event.preventDefault();

    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const idHabitacion = parseInt(document.getElementById('habitacion').value);
    const fechaCheckin = document.getElementById('checkin').value;
    const fechaCheckout = document.getElementById('checkout').value;
    const cantidad = parseInt(document.getElementById('cantidad').value);

    if (!idHabitacion) {
        alert("Seleccione una habitación disponible.");
        return;
    }

    // ------------------- Validar cantidad -------------------
    const optionSeleccionada = document.querySelector(`#habitacion option[value="${idHabitacion}"]`);
    const disponible = parseInt(optionSeleccionada.getAttribute('data-disponible'));

    if (cantidad > disponible) {
        alert(`Solo hay ${disponible} habitaciones disponibles para este tipo.`);
        return;
    }

    try {
        // 1️⃣ Crear cliente
        let { data: cliente, error: clienteError } = await supabaseClient
            .from('clientes')
            .insert([{ nombre, email }])
            .select()
            .single();

        if (clienteError) throw clienteError;

        // 2️⃣ Crear reserva
        const folio = "RES" + Date.now();
        let { data: reserva, error: reservaError } = await supabaseClient
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

        // 3️⃣ Actualizar disponibilidad
        let { data: habData } = await supabaseClient
            .from('habitaciones')
            .select('disponible')
            .eq('id', idHabitacion)
            .single();

        const nuevaDisponibilidad = habData.disponible - cantidad;

        await supabaseClient
            .from('habitaciones')
            .update({ disponible: nuevaDisponibilidad })
            .eq('id', idHabitacion);

        alert("Reserva realizada con éxito. Folio: " + folio);
        document.getElementById('formReserva').reset();
        cargarHabitaciones();

    } catch (err) {
        console.error("Error haciendo reserva:", err.message);
        alert("Ocurrió un error al realizar la reserva. Revisa la consola.");
    }
}

// ------------------- Inicializar -------------------
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('habitaciones')) {
        cargarHabitaciones();
        document.getElementById('formReserva').addEventListener('submit', hacerReserva);
    }
});
