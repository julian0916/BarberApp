module.exports = {
    isLoggedIn(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        return res.redirect('/signin');
    },

    isNotLoggedIn(req, res, next) {
        if (!req.isAuthenticated()) {
            return next();
        }
        return res.redirect('/profile');
    },

    isClient(req, res, next) {
        if (req.isAuthenticated() && req.user.role === 'client') {
            return next();
        }
        req.flash('error', 'Unauthorized access');
        return res.redirect('/home');
    }
};