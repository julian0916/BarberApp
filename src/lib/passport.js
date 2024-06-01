const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const pool = require('../database');
const helpers = require('./helpers');

// Ruta para iniciar sesion
passport.use('local.signin', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true
}, async (req, username, password, done) => {
  const rows = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  if (rows.length > 0) {
    const user = rows[0];
    const validPassword = await helpers.matchPassword(password, user.password)
    if (validPassword) {
      done(null, user, req.flash('success', 'Welcome ' + user.username));
    } else {
      done(null, false, req.flash('message', 'Incorrect Password'));
    }
  } else {
    return done(null, false, req.flash('message', 'The Username does not exist.'));
  }
}));

// Ruta para registrarse
passport.use('local.signup', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true
}, async (req, username, password, done) => {
  const { fullname, role } = req.body;
  let newUser = {
    fullname,
    username,
    password,
    role
  };

  newUser.password = await helpers.encryptPassword(password);

  try {
    // Insertar el nuevo usuario en la tabla users
    const result = await pool.query('INSERT INTO users SET ?', newUser);
    newUser.id = result.insertId;

    // Determinar si el nuevo usuario es un cliente o un barbero
    if (role === 'client') {
      // Si es un cliente, asignar un client_id al nuevo usuario
      await pool.query('UPDATE users SET client_id = ? WHERE id = ?', [newUser.id, newUser.id]);
    } else if (role === 'barber') {
      // Si es un barbero, asignar un barber_id al nuevo usuario
      await pool.query('UPDATE users SET barber_id = ? WHERE id = ?', [newUser.id, newUser.id]);
    }

    return done(null, newUser);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  pool.query('SELECT * FROM users WHERE id = ?', [id], (err, result) => {
      if (err) {
          return done(err);
      } else {
          if (result.length > 0) {
              return done(null, result[0]);
          } else {
              return done(null, false);
          }
      }
  });
});

module.exports = passport;