const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../../data");

// Crear directorio de datos si no existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function createStore(filename) {
  const filePath = path.join(DATA_DIR, filename);

  // Cargar datos existentes o crear archivo vacío
  let data = {};
  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      data = {};
    }
  }

  function save() {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return {
    get(key) {
      return data[key] || null;
    },
    set(key, value) {
      data[key] = value;
      save();
    },
    delete(key) {
      delete data[key];
      save();
    },
    getAll() {
      return { ...data };
    },
  };
}

const warnings = createStore("warnings.json");
const announcements = createStore("announcements.json");
const settings = createStore("settings.json");
const verifications = createStore("verifications.json");
const tickets = createStore("tickets.json");
const ticketConfigs = createStore("ticketConfigs.json");

module.exports = { warnings, announcements, settings, verifications, tickets, ticketConfigs };
