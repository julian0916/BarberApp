const bcrypt = require('bcryptjs');
const { format } = require('timeago.js');
const Handlebars = require('handlebars');

const helpers = {};

helpers.timeago = (timestamp) => {
    return format(timestamp);
};

helpers.encryptPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
};

helpers.matchPassword = async (password, savedPassword) => {
    try {
        return await bcrypt.compare(password, savedPassword);
    } catch (e) {
        console.log(e)
    }
};

helpers.isEqual = function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
};

Handlebars.registerHelper('isEqual', function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('eq', function (a, b, options) {
    return a === b;
});

// Helper para comparar si un valor es mayor que otro
Handlebars.registerHelper('gt', function (a, b) {
    return a > b;
});

// Helper para comparar si un valor es menor que otro
Handlebars.registerHelper('lt', function (a, b) {
    return a < b;
});

// Helper para calcular el valor anterior en la paginación
Handlebars.registerHelper('dec', function (value) {
    return value - 1;
});

// Helper para calcular el valor siguiente en la paginación
Handlebars.registerHelper('inc', function (value) {
    return value + 1;
});

// Helper para calcular el total de páginas
Handlebars.registerHelper('totalPages', function (totalItems, itemsPerPage) {
    return Math.ceil(totalItems / itemsPerPage);
});

module.exports = helpers;