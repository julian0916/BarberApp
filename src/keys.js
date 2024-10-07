module.exports = {
  database: {
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    port: 5432,  // Generalmente este es el puerto para PostgreSQL
    ssl: {
      rejectUnauthorized: false  // Importante si estás usando una conexión segura (SSL)
    }
  }
};
