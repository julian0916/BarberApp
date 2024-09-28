const express = require("express");
const router = express.Router();

const pool = require("../database");
const { isLoggedIn } = require("../lib/auth");

// Ruta para mostrar el formulario de agregar cita desde el barbero
router.get("/add", isLoggedIn, async (req, res) => {
  try {
    // Obtener la lista de clientes desde la base de datos
    const clients = await pool.query(
      'SELECT id, fullname FROM users WHERE role = "client"'
    );
    res.render("appointments/add", { clients });
  } catch (error) {
    console.error("Error al obtener la lista de clientes:", error);
    // Manejar el error según sea necesario
    res.status(500).send("Error interno del servidor");
  }
});

// Ruta para mostrar la lista de citas del usuario
router.get("/", isLoggedIn, async (req, res) => {
  let appointments;
  if (req.user.role === "barber") {
    // Si el usuario es un barbero, mostrar citas reservadas con él
    appointments = await pool.query(
      "SELECT appointments.*, users.fullname AS client_name FROM appointments JOIN users ON appointments.client_id = users.id WHERE appointments.barber_id = ?",
      [req.user.id]
    );
  } else {
    // Si el usuario es un cliente, mostrar citas reservadas por él con el nombre del barbero
    appointments = await pool.query(
      "SELECT appointments.*, clients.fullname AS client_name, barbers.fullname AS barber_name FROM appointments JOIN users AS clients ON appointments.client_id = clients.id JOIN users AS barbers ON appointments.barber_id = barbers.id WHERE appointments.client_id = ?",
      [req.user.id]
    );
  }
  res.render("appointments/list", { appointments });
});

// Ruta para mostrar el formulario para reservar cita con un barbero
router.get("/book", isLoggedIn, async (req, res) => {
  try {
    // Obtener la lista de barberos disponibles desde la base de datos
    const barbers = await pool.query(
      'SELECT * FROM users WHERE role = "barber"'
    );

    // Comprobar si hay un barbero seleccionado en la sesión
    const selectedBarber = req.session.selectedBarber;

    // Renderizar la vista con la lista de barberos y el formulario para reservar cita
    res.render("appointments/book", { barbers, selectedBarber });
  } catch (error) {
    console.error("Error al obtener la lista de barberos:", error);
    // Manejar el error según sea necesario
    res.status(500).send("Error interno del servidor");
  }
});

// Ruta para procesar la reserva de cita con un barbero desde cliente
router.post("/book", isLoggedIn, async (req, res) => {
  console.log(req.body);
  const { barber_id, fecha, hora, descripcion } = req.body;

   // Verificar si ya existe una cita para la misma fecha y hora
   const existingAppointment = await pool.query(
    "SELECT * FROM appointments WHERE date = ? AND time = ? AND barber_id = ?",
    [fecha, hora, barber_id]
  );
  if (existingAppointment.length > 0) {
    req.flash(
      "message",
      "Ya hay una cita programada para esta fecha y hora."
    );
    return res.redirect("/appointments/add");
  }

  // Verificar el rol del usuario que está reservando la cita
  if (req.user.role === "barber") {
    // Si es un barbero, asignar el barber_id del usuario actual
    var newAppointment = {
      name: req.user.fullname,
      date: fecha,
      time: hora,
      description: descripcion,
      barber_id: req.user.id, // Usar el ID del barbero que está reservando la cita
    };
  } else {
    // Si es un cliente, asignar el client_id y verificar si barber_id es un número antes de asignarlo
    var newAppointment = {
      name: req.user.fullname,
      date: fecha,
      time: hora,
      description: descripcion,
      client_id: req.user.id, // Usar el ID del cliente que está reservando la cita
      barber_id: barber_id && !isNaN(barber_id) ? barber_id : null, // Verificar si barber_id es un número antes de asignarlo
    };
  }

  // Insertar la nueva cita en la base de datos
  await pool.query("INSERT INTO appointments SET ?", [newAppointment]);
  req.flash("success", "Cita reservada con éxito");
  res.redirect("/appointments");
});

// Ruta para procesar el formulario y agregar una cita desde barbero
router.post("/add", isLoggedIn, async (req, res) => {
  try {
    const { client_id, fecha, hora, descripcion } = req.body;

    // Obtener el nombre del cliente utilizando su ID
    const [client] = await pool.query(
      "SELECT fullname FROM users WHERE id = ?",
      [client_id]
    );

    // Verificar si ya existe una cita para la misma fecha y hora
    const existingAppointment = await pool.query(
      "SELECT * FROM appointments WHERE date = ? AND time = ? AND client_id = ?",
      [fecha, hora, client_id]
    );
    if (existingAppointment.length > 0) {
      req.flash(
        "message",
        "Ya hay una cita programada con el cliente para esta fecha y hora."
      );
      return res.redirect("/appointments/add");
    }

    // Construir el objeto newAppointment con los datos obtenidos
    const newAppointment = {
      name: client.fullname, // Verificar si client está definido y tiene al menos un elemento
      date: fecha,
      time: hora,
      description: descripcion,
      barber_id: req.user.id, // ID del barbero que envía el formulario
      client_id: client_id, // ID del cliente seleccionado
    };

    // Insertar la nueva cita en la base de datos
    await pool.query("INSERT INTO appointments SET ?", [newAppointment]);
    req.flash("success", "Cita reservada con éxito");
    res.redirect("/appointments");
  } catch (error) {
    console.error("Error al procesar el formulario de cita:", error);
    req.flash("error", "Ocurrió un error al procesar el formulario de cita");
    res.redirect("/appointments/add");
  }
});

//Ruta para mostrar la cita a editar por consola
router.get("/edit/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const appointment = await pool.query(
    "SELECT * FROM appointments WHERE id = ?",
    [id]
  );
  console.log(appointment);
  res.render("appointments/edit", { appointment: appointment[0] });
});

// Ruta para procesar la edición de una cita
router.post("/edit/:id", isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, hora, descripcion } = req.body;

    // Verificar si ya existe una cita para la misma fecha y hora, excluyendo la cita actual que se está editando
    const existingAppointment = await pool.query(
      "SELECT * FROM appointments WHERE date = ? AND time = ? AND id != ?",
      [fecha, hora, id]
    );
    if (existingAppointment.length > 0) {
      req.flash(
        "message",
        "Ya hay una cita programada para esta fecha y hora."
      );
      return res.redirect(`/appointments/edit/${id}`);
    }

    // Actualizar la cita en la base de datos
    await pool.query("UPDATE appointments SET date = ?, time = ?, description = ? WHERE id = ?", [fecha, hora, descripcion, id]);

    req.flash("success", "Cita editada con éxito");
    res.redirect("/appointments");
  } catch (error) {
    console.error("Error al procesar la edición de la cita:", error);
    req.flash("error", "Ocurrió un error al editar la cita");
    res.redirect(`/appointments/edit/${id}`);
  }
});

// Ruta para eliminar una cita
router.get("/delete/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM appointments WHERE ID = ?", [id]);
  req.flash("success", "Cita eliminada");
  res.redirect("/appointments");
});

module.exports = router;
