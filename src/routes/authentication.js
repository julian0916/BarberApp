// routes.js

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const { isLoggedIn, isNotLoggedIn } = require('../lib/auth');
const barberController = require('../lib/barberController');
const nodemailer = require('nodemailer');
const pool = require('../database');

// REGISTRARSE
router.get('/signup', isNotLoggedIn ,(req, res) => {
  res.render('auth/signup');
});


router.post('/signup', isNotLoggedIn, [
  body('username', 'Username is Required').notEmpty(),
  body('email', 'Email is Required').notEmpty(),
  body('password', 'Password is Required').notEmpty(),
  body('fullname', 'Full Name is Required').notEmpty(), 
  body('role', 'Role is Required').notEmpty() 
], passport.authenticate('local.signup', {
  successRedirect: '/profile',
  failureRedirect: '/signup',
  failureFlash: true
}));

// INICIAR SESION
router.get('/signin', isNotLoggedIn, (req, res) => {
  res.render('auth/signin');
});

router.post('/signin', isNotLoggedIn, [
  body('username', 'Username is Required').notEmpty(),
  body('password', 'Password is Required').notEmpty()
], (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    req.flash('message', errors.array()[0].msg);
    return res.redirect('/signin');
  }

  passport.authenticate('local.signin', {
    successRedirect: '/profile',
    failureRedirect: '/signin',
    failureFlash: true
  })(req, res, next);
});

// Obtener datos de los barberos
router.get('/barbers', async (req, res) => {
  try {
    const barbers = await barberController.getBarbers();
    res.render('barbers', { barbers });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener los barberos');
  }
});

// Obtener datos del barbero seleccionado
router.get('/bookBarber/:barberId', async (req, res) => {
  try {
    const barberId = req.params.barberId;
    const selectedBarber = await barberController.getBarberById(barberId);
    res.render('bookBarber', { selectedBarber });
  } catch (error) {
    console.error('Error al obtener el barbero seleccionado:', error);
    res.status(500).send('Error al obtener el barbero seleccionado');
  }
});

//CERRAR SESION
router.get('/logout', isLoggedIn, (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/');
  });
});

router.get('/profile', isLoggedIn, (req, res) => {
  res.render('profile');
});

//OLVIDO SU CONTRASEÑA
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password'); 
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  // Aquí deberías validar el correo electrónico y enviar el correo de restablecimiento de contraseña

  try {
    // Verificar si el correo electrónico existe en la base de datos
    const user = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (user.length === 0) {
      return res.render('auth/forgot-password', { message: 'Correo electrónico no encontrado' });
    }

    // Configurar Nodemailer para enviar el correo de restablecimiento de contraseña
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'pruebasena0916@gmail.com',
        pass: 'Juli@n202'
      }
    });

    const mailOptions = {
      from: 'pruebasena0916@gmail.com',
      to: email,
      subject: 'Restablecimiento de Contraseña',
      text: 'Para restablecer tu contraseña, haz clic en el siguiente enlace: http://localhost:3000/reset-password'
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        res.render('auth/forgot-password', { message: 'Error al enviar el correo electrónico' });
      } else {
        console.log('Correo enviado: ' + info.response);
        res.render('auth/forgot-password', { message: 'Correo electrónico enviado con instrucciones para restablecer la contraseña' });
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al procesar la solicitud');
  }
});

//ELIMINAR USUARIO
router.delete('/user/:userId', isLoggedIn, async (req, res) => {
  try {
    const userId = req.params.userId;
    await barberController.deleteUser(userId);
    res.status(200).send('Usuario eliminado correctamente');
  } catch (error) {
    console.error('Error al eliminar el usuario:', error);
    res.status(500).send('Error al eliminar el usuario');
  }
});

module.exports = router;
