// routes.js

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const { isLoggedIn, isNotLoggedIn } = require('../lib/auth');
const barberController = require('../lib/barberController');

// SIGNUP
router.get('/signup', isNotLoggedIn ,(req, res) => {
  res.render('auth/signup');
});

router.post('/signup', isNotLoggedIn, [
  body('username', 'Username is Required').notEmpty(),
  body('password', 'Password is Required').notEmpty(),
  body('fullname', 'Full Name is Required').notEmpty(), 
  body('role', 'Role is Required').notEmpty() 
], passport.authenticate('local.signup', {
  successRedirect: '/profile',
  failureRedirect: '/signup',
  failureFlash: true
}));

// SINGIN
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

module.exports = router;
