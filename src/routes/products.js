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

router.post("/shop/:id", isLoggedIn, async (req, res) => {
  try {
    const productId = req.params.id;
    const quantity = parseInt(req.body.quantity, 10) || 1;
    const clientUserId = req.user.id;
    const paymentMethod = req.body.paymentMethod;
    const now = new Date();
    const formattedNow = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

    // Obtener el producto de la base de datos
    const [product] = await pool.query("SELECT * FROM products WHERE id = ?", [productId]);
    if (!product) {
      req.flash("message", "El producto no existe");
      return res.redirect("/products/barbers-with-products");
    }

    // Verificar stock
    if (product.stock < quantity) {
      req.flash("message", "No hay suficiente stock disponible");
      return res.redirect("/products/barbers-with-products");
    }

    // Reducir el stock del producto
    await pool.query("UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, productId]);

    // Insertar la compra en la tabla `purchases`
    const result = await pool.query(
      "INSERT INTO purchases (product_id, client_id, barber_id, quantity, payment_method) VALUES (?, ?, ?, ?, ?)",
      [productId, clientUserId, product.barber_id, quantity, paymentMethod]
    );

    // Obtener el ID de compra y verificar
    const purchaseId = result.insertId;
    if (!purchaseId) {
      throw new Error("No se pudo obtener el ID de la compra.");
    }

    // Generar el PDF de factura
    const PDFDocument = require("pdfkit");
    const fs = require("fs");
    const path = require("path");

    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, "..", "invoices", `factura-${purchaseId}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Encabezado
    doc.fontSize(10).text("Barber App", 200, 60);
    doc.text("Dirección: calle 123 avenida 45", 200, 75);
    doc.text("Teléfono: +57 234 567 890", 200, 90);
    doc.text("Email: contacto@empresa.com", 200, 105);
    doc.fontSize(18).text("Factura", 50, 150, { align: "center" });

    // Detalles del cliente y compra
    doc.fontSize(12).text(`Cliente: ${req.user.fullname}`, 50, 200);
    doc.text(`Fecha: ${formattedNow}`, 50, 215);
    doc.text(`ID de compra: ${purchaseId}`, 50, 230);

    // Tabla de productos
    doc.text("Producto", 60, 270);
    doc.text("Cantidad", 260, 270);
    doc.text("Precio Unitario", 360, 270);
    doc.text("Total", 460, 270);
    doc.moveTo(50, 290).lineTo(550, 290).stroke();

    doc.text(product.name, 60, 300);
    doc.text(quantity, 260, 300);
    doc.text(`$${product.price}`, 360, 300);
    doc.text(`$${product.price * quantity}`, 460, 300);

    // Total
    doc.fontSize(16).fillColor("blue").text(`Total: $${product.price * quantity}`, 50, 350, { align: "right" });

    // Pie de página
    doc.fontSize(10).fillColor("gray").text("Gracias por su compra.", 50, 700, { align: "center" });

    doc.end();
    await new Promise((resolve, reject) => writeStream.on("finish", resolve).on("error", reject));

    // Respuesta con URL del PDF
    res.json({ pdfUrl: `/invoices/factura-${purchaseId}.pdf` });

  } catch (error) {
    console.error("Error al procesar la compra del producto:", error);
    req.flash("message", "Ocurrió un error al procesar la compra del producto");
    res.redirect("/products/barbers-with-products");
  }
});

router.get("/sales-filter", isLoggedIn, async (req, res) => {
  try {
    let { startDate, endDate } = req.query;  
    const barberId = req.user.barber_id;  

    if (!startDate || !endDate || !barberId) {
      req.flash("message", "Por favor, proporciona ambas fechas y asegúrate de estar autenticado.");
      return res.redirect("/products/purchases");
    }

    startDate = startDate + " 00:00:00"; 
    endDate = endDate + " 23:59:59"; 

    let start = new Date(startDate);
    let end = new Date(endDate);

    const formatDateForSQL = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const formattedStartDate = formatDateForSQL(start);
    const formattedEndDate = formatDateForSQL(end);

    const query = `
      SELECT COUNT(*) AS total_sales, SUM(purchases.quantity * products.price) AS total_revenue 
      FROM purchases 
      INNER JOIN products ON purchases.product_id = products.id
      WHERE purchases.purchase_date BETWEEN ? AND ?
      AND purchases.barber_id = ?  -- Filtro por el barber_id
    `;
    
    const result = await pool.query(query, [formattedStartDate, formattedEndDate, barberId]);
      const totalSales = result[0].total_sales || 0;
      const totalRevenue = result[0].total_revenue || 0;
      res.render("products/purchases", {
        totalSales,
        totalRevenue,
        startDate,
        endDate,
      });
  } catch (error) {
    console.error("Error al filtrar ventas:", error);
    req.flash("message", "Ocurrió un error al filtrar las ventas.");
    res.redirect("/products/purchases");
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
      const { name, price, stock } = req.body; 
      const productId = req.params.id; 
      let imageUrl = ""; 

      if (req.file) {
        imageUrl = req.file.filename; 
      }

      const product = await pool.query(
        "SELECT image FROM products WHERE id = ?",
        [productId]
      );
      const currentImage = product[0].image;

      if (imageUrl) {
        await pool.query(
          "UPDATE products SET name = ?, price = ?, stock = ?, image = ? WHERE id = ?",
          [name, price, stock, imageUrl, productId]
        );
      } else {
        await pool.query(
          "UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?",
          [name, price, stock, productId]
        );
      }

      if (imageUrl && currentImage) {
        fs.unlinkSync(path.join(__dirname, "../uploads", currentImage)); 
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