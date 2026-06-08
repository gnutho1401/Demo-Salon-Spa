function validateRegister(body) {
  return body.fullName && body.email && body.password;
}

module.exports = { validateRegister };
