const pool = require('../database');

exports.getBarbers = async () => {
    try {
        const barbers = await pool.query('SELECT * FROM barbers'); 
        return barbers;
    } catch (error) {
        throw new Error('Error al obtener los barberos: ' + error.message);
    }
};