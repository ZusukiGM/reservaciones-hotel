// Supabase URL y Key proporcionados
const SUPABASE_URL = "https://uurwjqfawkeanmvafdxo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cndqcWZhd2tlYW5tdmFmZHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzcyNDQsImV4cCI6MjA3NjU0NjI0NH0.Qstjvg-GTTY0czItbjregsak7hKFXw40gqp92XPHFv8";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------- Index.html: Cargar habitaciones -------------------
async function cargarHabitaciones() {
    const { data: habitaciones, error } = await supabase
        .from('habitaciones')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error("Error al cargar habitaciones:", error);
        return;
    }

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

        if(h.disponible > 0) {
            selectHabitacion.innerHTML += `<option value="${h.id}" data-disponible="${h.disponible}">${h.tipo} (Disponibles: ${h.disponible})</option>`;
        }
    });
}

// ------------------- Index.html: Crear reserva -------------------
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

    // 1️⃣ Crear cliente
    let { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .insert([{ nombre, email }])
        .select()
        .single();

    if (clienteError) {
        console.error("Error al crear cliente:", clienteError);
        return;
    }

    // 2️⃣ Crear reserva
    const folio = "RES" + Date.now();
    let { data: reserva, error: reservaError } = await supabase
        .from('reservas')
        .insert([{
            id_habitacion: idHabitacion,
            id_cliente: cliente.id,
            folio,
            fecha_checkin: fechaCheckin,
            fecha_checkout: fechaCheckout,
            cantidad
        }]);

    if (reservaError) {
        console.error("Error al crear reserva:", reservaError);
        return;
    }

    // 3️⃣ Actualizar disponibilidad
    let { data: habData } = await supabase
        .from('habitaciones')
        .select('disponible')
        .eq('id', idHabitacion)
        .single();

    const nuevaDisponibilidad = habData.disponible - cantidad;

    await supabase
        .from('habitaciones')
        .update({ disponible: nuevaDisponibilidad })
        .eq('id', idHabitacion);

    alert("Reserva realizada con éxito. Folio: " + folio);
    document.getElementById('formReserva').reset();
    cargarHabitaciones();
}

// ------------------- Recepcion.html: Mostrar reservas -------------------
async function mostrarReservas() {
    const { data: reservas, error } = await supabase
        .from('reservas')
        .select(`
            id, folio, fecha_checkin, fecha_checkout, cantidad,
            clientes(nombre, email),
            habitaciones(tipo)
        `)
        .order('fecha_registro', { ascending: false });

    if (error) {
        console.error("Error al cargar reservas:", error);
        return;
    }

    const tbody = document.getElementById('tablaReservasBody');
    tbody.innerHTML = '';

    reservas.forEach(r => {
        tbody.innerHTML += `
            <tr>
                <td>${r.folio}</td>
                <td>${r.clientes.nombre}</td>
                <td>${r.clientes.email}</td>
                <td>${r.habitaciones.tipo}</td>
                <td>${r.fecha_checkin}</td>
                <td>${r.fecha_checkout}</td>
                <td>${r.cantidad}</td>
            </tr>
        `;
    });
}

// ------------------- Inicializar -------------------
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('habitaciones')) {
        cargarHabitaciones();
        document.getElementById('formReserva').addEventListener('submit', hacerReserva);
    }

    if(document.getElementById('tablaReservasBody')) {
        mostrarReservas();
    }
});
