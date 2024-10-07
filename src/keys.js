module.exports = {
  database: {
    host: 'ep-red-river-a4p6aliu-pooler.us-east-1.aws.neon.tech',
    user: 'default',
    password: 'YBGzIov7K3PS',
    database: 'verceldb',
    port: 5432,  // Generalmente este es el puerto para PostgreSQL
    ssl: {
      rejectUnauthorized: false  // Importante si estás usando una conexión segura (SSL)
    }
  }
};
