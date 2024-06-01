const { format } = require('timeago.js');

const helpers = {};

helpers.timeago = (timestamp) => {
    return format(timestamp);
};

helpers.formatDate = (date, options) => {
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };

    const dateOptions = Object.assign({}, defaultOptions, options);
    return new Date(date).toLocaleDateString(undefined, dateOptions);
};

helpers.formatDateAux = (date) => {
    // Convertir la fecha a un objeto Date
    const formattedDate = new Date(date);

    // Obtener el año, mes y día
    const year = formattedDate.getFullYear();
    const month = (formattedDate.getMonth() + 1).toString().padStart(2, '0'); // Agregar cero inicial si es necesario
    const day = formattedDate.getDate().toString().padStart(2, '0'); // Agregar cero inicial si es necesario

    // Formatear la fecha en el formato "aaaa-mm-dd"
    return `${year}-${month}-${day}`;
};

module.exports = helpers;