// Guardar reservaciones
function guardarReserva(event) {
    event.preventDefault();

    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const fecha = document.getElementById('fecha').value;
    const habitacion = document.getElementById('habitacion').value;

    if (!nombre || !email || !fecha || !habitacion) {
        alert('Por favor completa todos los campos');
        return;
    }

    let reservas = JSON.parse(localStorage.getItem('reservas')) || [];

    reservas.push({ nombre, email, fecha, habitacion });
    localStorage.setItem('reservas', JSON.stringify(reservas));

    alert('¡Reservación guardada!');
    document.getElementById('reservaForm').reset();
}

// Mostrar reservaciones en recepción
function mostrarReservas() {
    let reservas = JSON.parse(localStorage.getItem('reservas')) || [];
    const tableBody = document.getElementById('tablaReservasBody');
    tableBody.innerHTML = '';

    reservas.forEach((reserva, index) => {
        const row = `<tr>
            <td>${index + 1}</td>
            <td>${reserva.nombre}</td>
            <td>${reserva.email}</td>
            <td>${reserva.fecha}</td>
            <td>${reserva.habitacion}</td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reservaForm');
    if(form) form.addEventListener('submit', guardarReserva);

    const table = document.getElementById('tablaReservasBody');
    if(table) mostrarReservas();
});
