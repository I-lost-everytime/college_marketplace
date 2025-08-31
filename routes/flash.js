// middleware/flash.js
function flashMiddleware(req, res, next) {
  if (!req.session.flash) {
    req.session.flash = {};
  }

  // req.flash(type, message)
  req.flash = (type, message) => {
    if (!req.session.flash[type]) {
      req.session.flash[type] = [];
    }
    if (message) {
      req.session.flash[type].push(message);
    }
    return req.session.flash[type];
  };

  // expose flash messages to views & clear them after use
  res.locals.getMessages = () => {
    const messages = req.session.flash;
    req.session.flash = {}; // clear after use
    return messages;
  };

  next();
}

module.exports = flashMiddleware;
