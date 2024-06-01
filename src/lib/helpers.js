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

module.exports = helpers;