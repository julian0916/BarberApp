const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const pool = require("../database");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { promisify } = require('util');
const { isLoggedIn } = require("../lib/auth");

// Configurar multer para guardar archivos en la carpeta 'uploads'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// Crear el middleware de multer
const upload = multer({ storage: storage });

// Obtener la lista de productos
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const products = await pool.query("SELECT * FROM products");
    res.render("products/list", { products });
  } catch (error) {
    console.error("Error al obtener la lista de productos:", error);
    res.status(500).send("Error interno del servidor");
  }
});

// Mostrar el formulario para agregar un nuevo producto
router.get("/add", isLoggedIn, (req, res) => {
  res.render("products/add");
});

//Ruta para guardar un producto
router.post("/add", isLoggedIn, upload.single("image"), async (req, res) => {
  try {
    const { name, price, stock } = req.body; // Agregar stock desde el formulario
    const imageUrl = req.file.filename; // Ruta relativa a la carpeta de uploads
    const barberId = req.user.id; // ID del usuario autenticado (barbero)
    await pool.query(
      "INSERT INTO products (name, price, image, stock, barber_id) VALUES (?, ?, ?, ?, ?)",
      [name, price, imageUrl, stock, barberId]
    );
    req.flash("success", "Producto agregado con éxito");
    res.redirect("/products/barbers-with-products");
  } catch (error) {
    console.error("Error al agregar un nuevo producto:", error);
    req.flash("error", "Ocurrió un error al agregar el producto");
    res.redirect("/products/add");
  }
});

// Ir al carrito de compras
router.get("/shop/:id", isLoggedIn, async (req, res) => {
  try {
    const productId = req.params.id;
    // Obtener el producto de la base de datos
    const product = await pool.query("SELECT * FROM products WHERE id = ?", [productId]);

    if (!product || product.length === 0) {
      // Producto no encontrado
      req.flash("error", "El producto no existe");
      return res.redirect("/products/barbers-with-products");
    }

    // Renderizar la vista del carrito de compras con los detalles del producto
    res.render("products/shop", { product: product[0] });
  } catch (error) {
    console.error("Error al cargar el carrito de compras:", error);
    req.flash("error", "Ocurrió un error al cargar el carrito de compras");
    res.redirect("/products/barbers-with-products");
  }
});

// Ruta para enviar un producto al carrito
router.post("/cart/add/:id", isLoggedIn, async (req, res) => {
  try {
    const productId = req.params.id;
    const quantity = parseInt(req.body.quantity) || 1;

    // Obtener el producto de la base de datos
    const product = await pool.query("SELECT * FROM products WHERE id = ?", [productId]);
    if (!product || product.length === 0) {
      req.flash("message", "El producto no existe");
      return res.redirect("/products/barbers-with-products");
    }

    // Inicializar el carrito si no existe
    if (!req.session.cart) {
      req.session.cart = [];
    }

    // Verificar si el producto ya está en el carrito
    const existingProductIndex = req.session.cart.findIndex(item => item.id === productId);

    if (existingProductIndex !== -1) {
      // Si el producto ya está en el carrito, incrementar la cantidad
      req.session.cart[existingProductIndex].quantity += quantity;
    } else {
      // Si el producto no está en el carrito, agregarlo
      req.session.cart.push({ id: productId, name: product[0].name, price: product[0].price, quantity });
    }

    req.flash("success", "Producto agregado al carrito");
    res.redirect("/products/barbers-with-products");
  } catch (error) {
    console.error("Error al agregar el producto al carrito:", error);
    req.flash("error", "Ocurrió un error al agregar el producto al carrito");
    res.redirect("/products/barbers-with-products");
  }
});

// Ruta para procesar la compra de un producto desde el carrito
router.post("/shop/:id", isLoggedIn, async (req, res) => {
  try {
    const productId = req.params.id;
    const quantity = parseInt(req.body.quantity, 10) || 1;
    const clientUserId = req.user.id;
    const paymentMethod = req.body.paymentMethod;
    const now = new Date();
    const formattedNow = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

    // Obtener el producto de la base de datos
    const product = await pool.query("SELECT * FROM products WHERE id = ?", [productId]);
    if (!product || product.length === 0) {
      req.flash("message", "El producto no existe");
      return res.redirect("/products/barbers-with-products");
    }

    // Reducir el stock del producto
    await pool.query("UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, productId]);

    // Insertar la compra en la tabla `purchases`
    const result = await pool.query(
      "INSERT INTO purchases (product_id, client_id, barber_id, quantity, payment_method) VALUES (?, ?, ?, ?, ?)",
      [productId, clientUserId, product[0].barber_id, quantity, paymentMethod]
    );

    
    // Obtener el ID de compra y verificar
    const purchaseId = result.insertId;
    if (!purchaseId) {
      throw new Error("No se pudo obtener el ID de la compra.");
    }

    req.flash("success", "Compra realizada con éxito");
    // Generar el PDF
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, '..', 'invoices', `factura-${purchaseId}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    doc.fontSize(25).text('Factura de Compra', { align: 'center' });
    doc.text(`ID de compra: ${purchaseId}`);
    doc.text(`Producto: ${product[0].name}`);
    doc.text(`Cantidad: ${quantity}`);
    doc.text(`Precio total: $ ${product[0].price * quantity}`);
    doc.text(`Fecha de compra: ${formattedNow}`);
    doc.end();

    await promisify(writeStream.on.bind(writeStream))('finish');

    // Devuelve una respuesta JSON con una URL accesible
    res.json({ pdfUrl: `/invoices/factura-${purchaseId}.pdf` });

  } catch (error) {
    console.error("Error al procesar la compra del producto:", error);
    req.flash("message", "Ocurrió un error al procesar la compra del producto");
    res.redirect("/products/barbers-with-products");
  }
});

//Ruta para mostrar una imagen
router.get("/image/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await pool.query("SELECT image FROM products WHERE id = ?", [id]);

    if (product.length > 0 && product[0].image) {
      const imageName = product[0].image; // Nombre del archivo de imagen
      const imagePath = path.join(__dirname, "../uploads", imageName); // Ruta completa del archivo de imagen

      if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath); // Enviar el archivo de imagen al cliente
      } else {
        res.status(404).send("Imagen no encontrada");
      }
    } else {
      res.status(404).send("Imagen no encontrada");
    }
  } catch (error) {
    console.error("Error al obtener la imagen del producto:", error);
    res.status(500).send("Error interno del servidor");
  }
});

// Ruta para mostrar el formulario de edición de un producto por su ID
router.get("/edit/:id", isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await pool.query("SELECT * FROM products WHERE id = ?", [
      id,
    ]);
    console.log(product);
    res.render("products/edit", { productId: id, product: product[0] });
  } catch (error) {
    console.error(
      "Error al obtener los detalles del producto para editar:",
      error
    );
    req.flash("message", "Error al cargar el formulario de edición del producto");
    res.redirect("/products/barbers-with-products");
  }
});

// Ruta para editar un producto
router.post(
  "/edit/:id",
  isLoggedIn,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, price, stock } = req.body; // Obtener los nuevos datos del producto desde el formulario
      const productId = req.params.id; // ID del producto que se va a editar
      let imageUrl = ""; // Variable para almacenar la nueva ruta de la imagen

      // Verificar si se ha subido una nueva imagen
      if (req.file) {
        imageUrl = req.file.filename; // Si se subió una imagen, obtener la nueva ruta de la imagen
      }

      // Consultar la base de datos para obtener la imagen actual del producto
      const product = await pool.query(
        "SELECT image FROM products WHERE id = ?",
        [productId]
      );
      const currentImage = product[0].image;

      // Verificar si se ha subido una nueva imagen y actualizar la ruta de la imagen en la base de datos
      if (imageUrl) {
        await pool.query(
          "UPDATE products SET name = ?, price = ?, stock = ?, image = ? WHERE id = ?",
          [name, price, stock, imageUrl, productId]
        );
      } else {
        // Si no se subió una nueva imagen, mantener la imagen actual en la base de datos
        await pool.query(
          "UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?",
          [name, price, stock, productId]
        );
      }

      // Si se subió una nueva imagen, eliminar la imagen anterior
      if (imageUrl && currentImage) {
        fs.unlinkSync(path.join(__dirname, "../uploads", currentImage)); // Eliminar la imagen anterior
      }

      req.flash("success", "Producto actualizado con éxito");
      res.redirect("/products/barbers-with-products");
    } catch (error) {
      console.error("Error al editar el producto:", error);
      req.flash("message", "Ocurrió un error al editar el producto");
      res.redirect("/products/edit/" + req.params.id);
    }
  }
);

// Ruta para eliminar un producto
router.get("/delete/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM products WHERE ID = ?", [id]);
  req.flash("success", "Producto eliminado");
  res.redirect("/products/barbers-with-products");
});

// Ruta para mostrar la lista de barberos con productos
router.get("/barbers-with-products", isLoggedIn, async (req, res) => {
  try {
    // Obtener el usuario autenticado de la sesión
    const user = req.user;

    let barbersWithProducts;

    if (user.role === "barber") {
      // Si el usuario es un barbero, obtener solo los productos del barbero actual
      barbersWithProducts = await pool.query(
        `
        SELECT u.id AS barber_id, u.fullname AS barber_name, p.id AS product_id, p.name AS product_name, p.price AS product_price, p.stock AS product_stock
        FROM users u 
        INNER JOIN products p ON u.id = p.barber_id
        WHERE u.id = ?
      `,
        [user.id]
      );
    } else {
      // Si el usuario no es un barbero, obtener todos los productos de todos los barberos
      barbersWithProducts = await pool.query(`
        SELECT u.id AS barber_id, u.fullname AS barber_name, p.id AS product_id, p.name AS product_name, p.price AS product_price, p.stock AS product_stock 
        FROM users u 
        INNER JOIN products p ON u.id = p.barber_id
      `);
    }

    // Organizar los datos para agrupar los productos por barbero
    const barbers = {};
    barbersWithProducts.forEach((row) => {
      if (!barbers[row.barber_id]) {
        barbers[row.barber_id] = {
          id: row.barber_id,
          name: row.barber_name,
          products: [],
        };
      }
      barbers[row.barber_id].products.push({
        id: row.product_id,
        name: row.product_name,
        price: row.product_price,
        stock: row.product_stock,
      });
    });

    const barbersList = Object.values(barbers);
    // Renderizar la vista con la lista de barberos y sus productos, pasando el objeto user al contexto
    res.render("products/list", { barbersList, user });
  } catch (error) {
    console.error(
      "Error al obtener la lista de barberos con productos:",
      error
    );
    res.status(500).send("Error interno del servidor");
  }
});

// Ruta para mostrar los productos comprados del barbero actual
router.get("/purchases", isLoggedIn, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Define el filtro de usuario basado en el rol
    const filterCondition = userRole === 'barber'
      ? "purchases.barber_id = ?"
      : "purchases.client_id = ?";

    const purchases = await pool.query(
      `
      SELECT 
         products.name AS product_name,        
         products.price AS product_price,      
         purchases.quantity,                    
         client.fullname AS client_name,      
         barber.fullname AS barber_name,        
         purchases.purchase_date,
         purchases.payment_method,
         purchases.id AS purchases_id           
      FROM 
         purchases
      INNER JOIN 
          products ON purchases.product_id = products.id
      INNER JOIN 
          users AS client ON purchases.client_id = client.id 
      INNER JOIN 
          users AS barber ON purchases.barber_id = barber.id       
      WHERE 
          ${filterCondition}                       
      ORDER BY 
        purchases.purchase_date DESC;
      `,
      [userId]
    );

    res.render("products/purchases", { purchases });
  } catch (error) {
    console.error("Error al obtener los productos comprados:", error);
    res.status(500).send("Error interno del servidor");
  }
});

// Ruta para eliminar una compra
router.get("/delete-purchase/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener la información de la compra antes de eliminarla
    const [purchase] = await pool.query("SELECT product_id, quantity FROM purchases WHERE id = ?", [id]);

    if (purchase) {
      const { product_id: productId, quantity } = purchase;

      // Devolver el stock al producto
      await pool.query("UPDATE products SET stock = stock + ? WHERE id = ?", [quantity, productId]);

      // Eliminar la compra
      await pool.query("DELETE FROM purchases WHERE id = ?", [id]);

      req.flash("success", "Compra cancelada con exito");
    } else {
      req.flash("message", "La compra no existe o ya ha sido eliminada");
    }
  } catch (error) {
    console.error("Error al cancelar la compra:", error);
    req.flash("message", "Hubo un problema al cancelar la compra");
  }

  res.redirect("/products/purchases");
});

module.exports = router;