import request from 'supertest';
import chai from 'chai';
import sinon from 'sinon';
import { getBarbers, getBarberById } from '../lib/barberController.js';
import app from '../app.js'; // Asegúrate de que apunte a tu archivo principal de la app

const expect = chai.expect;

// Mocks de datos
const mockBarbers = [
  { id: 1, name: 'Barber 1', experience: 5 },
  { id: 2, name: 'Barber 2', experience: 3 }
];
const mockBarber = { id: 1, name: 'Barber 1', experience: 5 };

describe('Auth Routes', () => {
  describe('GET /signup', () => {
    it('should render signup page', (done) => {
      request(app)
        .get('/signup')
        .expect('Content-Type', /html/)
        .expect(200, done);
    });
  });

  describe('POST /signup', () => {
    it('should redirect to profile on successful signup', (done) => {
      request(app)
        .post('/signup')
        .send({ username: 'testuser', password: 'testpass', fullname: 'Test User', role: 'user' })
        .expect('Location', '/profile')
        .expect(302, done);
    });

    it('should redirect back to signup with errors if fields are missing', (done) => {
      request(app)
        .post('/signup')
        .send({ username: '', password: '', fullname: '', role: '' })
        .expect('Location', '/signup')
        .expect(302, done);
    });
  });

  describe('GET /signin', () => {
    it('should render signin page', (done) => {
      request(app)
        .get('/signin')
        .expect('Content-Type', /html/)
        .expect(200, done);
    });
  });

  describe('POST /signin', () => {
    it('should redirect to profile on successful signin', (done) => {
      request(app)
        .post('/signin')
        .send({ username: 'testuser', password: 'testpass' })
        .expect('Location', '/profile')
        .expect(302, done);
    });

    it('should redirect back to signin with errors if fields are missing', (done) => {
      request(app)
        .post('/signin')
        .send({ username: '', password: '' })
        .expect('Location', '/signin')
        .expect(302, done);
    });
  });

  describe('GET /logout', () => {
    it('should redirect to home on logout', (done) => {
      request(app)
        .get('/logout')
        .expect('Location', '/')
        .expect(302, done);
    });
  });

  describe('GET /profile', () => {
    it('should render profile page for logged in user', (done) => {
      // Here you should mock a logged-in user. 
      // For simplicity, this example may not work directly.
      request(app)
        .get('/profile')
        .expect('Content-Type', /html/)
        .expect(200, done);
    });
  });
});

describe('Barber Routes', () => {
  let getBarbersStub;
  let getBarberByIdStub;

  before(() => {
    getBarbersStub = sinon.stub(getBarbers);
    getBarberByIdStub = sinon.stub(getBarberById);
  });

  after(() => {
    getBarbersStub.restore();
    getBarberByIdStub.restore();
  });

  describe('GET /barbers', () => {
    it('should return barbers list', (done) => {
      getBarbersStub.resolves(mockBarbers);

      request(app)
        .get('/barbers')
        .expect('Content-Type', /html/)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.text).to.include('Barber 1');
          expect(res.text).to.include('Barber 2');
          done();
        });
    });

    it('should handle errors', (done) => {
      getBarbersStub.rejects(new Error('Error al obtener los barberos'));

      request(app)
        .get('/barbers')
        .expect(500, done);
    });
  });

  describe('GET /bookBarber/:barberId', () => {
    it('should return selected barber details', (done) => {
      getBarberByIdStub.resolves(mockBarber);

      request(app)
        .get('/bookBarber/1')
        .expect('Content-Type', /html/)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.text).to.include('Barber 1');
          done();
        });
    });

    it('should handle errors', (done) => {
      getBarberByIdStub.rejects(new Error('Error al obtener el barbero seleccionado'));

      request(app)
        .get('/bookBarber/1')
        .expect(500, done);
    });
  });
});
