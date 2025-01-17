const express = require('express')
const http = require('http')
const socketIo = require('socket.io');
const dbconfig = require('./db/config');
const apiRoutes = require('./routes/index');
const { engine } = require('express-handlebars');
// const { ENV: { PORT } } = require('./config');
const config = require('./config');
const { normalize, schema } = require('normalizr')
const users = require('./data/users.json')
const MongoStore = require('connect-mongo')
const session = require('express-session');
const passport = require('./middlewares/passport');


// const contenedorProducto = require('./models/productos/contenedorProductos')
// const contenedorMensaje = require('./models/chat/contenedorChat')


//Instancia servidor, socket y api


const app = express()
const serverHttp = http.createServer(app)
const io = socketIo(serverHttp)

// const productosApi = new contenedorProducto(dbconfig.mariaDB, 'productos')
// const mensajesApi = new contenedorMensaje(dbconfig.sqlite, 'mensajes')

const productoControllers = require('./controllers/productosControllers')
const chatControllers = require('./controllers/chatControllers');

//-------------------

//Middleware
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(session({
    name: 'sesion1',
    secret: 'top-secret-123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 10000
    },
    rolling: true,
    store: MongoStore.create({
        // mongoUrl: `mongodb+srv://Matias1992:12345@cluster0.knh5m.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`,
        mongoUrl: `mongodb+srv://${config.USUARIO}:${config.PASSWORD}@cluster0.knh5m.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`,

    })

}))

app.use(passport.initialize());
app.use(passport.session());

//-------------------

//Routes


app.get('/', async (req, res) => {

    const user = await req.user;
    if (user) {
        return res.redirect('/public/index.html');
    }
    else {
        return res.sendFile(path.resolve(__dirname, '../public/login.html'));
    }

    // return res.sendFile(__dirname + '/public/index.html');
})



app.post('/registro', (req, res) => {

    console.log(req.body)

    const { mail, password } = req.body

    const user = users.find(user => user.name === usuario)

    if (!user) return res.redirect('/error')

    req.session.user = user;

    console.log("Usuario de sesion:" + req.session.user)

    req.session.save((err) => {
        if (err) {
            console.log('Error en sesion => ', err)
            res.redirect('/')
        }
    })


    console.log(usuario)

    return res.redirect('/gestionProducto');
});

app.get('/gestionProducto', (req, res) => {
    console.log(req.session.user)
    if (!req.session.user) {
        return res.redirect('/')
    }

    res.render("partials/gestionProducto", { nombre: req.session.user.name })

});


app.get('/error', (req, res) => {
    res.status(500).sendFile(__dirname + '/public/error.html');
});


app.use('/', apiRoutes)


//-------------------



app.engine(
    "hbs",
    engine({
        extname: ".hbs",
        defaultLayout: 'index.hbs',
    })
);

app.set("view engine", "hbs");
app.set("views", "./public/views");

//--------------------


//Configuración socket

io.on('connection', async (socket) => {
    console.log('Se conecto un nuevo cliente: ', socket.id)

    //Carga inicial productos

    const data = await (await productoControllers.getAllProducts()).products

    socket.emit('getProductos', data)


    //alta de producto

    socket.on('createProducto', (req) => {

        productoControllers.createProduct(req)
            .then((nuevoId) => {
                console.log('Se generó el id: ', nuevoId)
            })
            .then(async () => { io.sockets.emit('getProductos', await (await productoControllers.getAllProducts()).products) })
    });

    // carga inicial de mensajes

    let chatGetAll = await (await chatControllers.getAllChat()).Chat

    const schemaAuthor = new schema.Entity('author', {}, { idAttribute: 'id' });

    const schemaMensaje = new schema.Entity('post', { author: schemaAuthor }, { idAttribute: 'id' })

    const schemaMensajes = new schema.Entity('posts', { mensajes: [schemaMensaje] }, { idAttribute: 'id' })

    const normalizedChat = normalize({ id: 'mensajes', mensajes: chatGetAll }, schemaMensajes)

    const comprension = JSON.stringify(normalizedChat).length / JSON.stringify(chatGetAll).length * 100


    socket.emit('getMensajes', { comprension: comprension, mensajes: normalizedChat });

    // actualizacion de mensajes
    socket.on('createMensaje', (req) => {
        console.log(req)
        req.fecha = new Date().toLocaleString()
        chatControllers.createChat(req)
            .then((nuevoId) => {
                console.log('Se generó el id mensaje: ', nuevoId)
            })
            .then(async () => {

                let chatGetAll = await (await chatControllers.getAllChat()).Chat

                const schemaAuthor = new schema.Entity('author', {}, { idAttribute: 'id' });

                const schemaMensaje = new schema.Entity('post', { author: schemaAuthor }, { idAttribute: 'id' })

                const schemaMensajes = new schema.Entity('posts', { mensajes: [schemaMensaje] }, { idAttribute: 'id' })

                const normalizedChat = normalize({ id: 'mensajes', mensajes: chatGetAll }, schemaMensajes)

                const comprension = JSON.stringify(normalizedChat).length / JSON.stringify(chatGetAll).length * 100

                io.sockets.emit('getMensajes', { comprension: comprension, mensajes: normalizedChat })
            })
    });


})

//-------------------

//Inicio servidor

serverHttp.listen(config.PORT, () => {
    console.log("Server is up and runnion on port ", config.PORT)
})

serverHttp.on('error', (error) => { console.log(error.message) })
//-------------------


