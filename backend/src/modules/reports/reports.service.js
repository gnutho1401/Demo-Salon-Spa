async function getAll() {
  return [];
}
async function getById(id) {
  return { id };
}
async function create(data) {
  return data;
}
async function update(id, data) {
  return { id, ...data };
}
async function remove(id) {
  return { id };
}

module.exports = { getAll, getById, create, update, remove };
