// Loading libs
var assert = require('assert');
var bodyParser = require('body-parser');
var cookieSession = require('cookie-session');
var ent = require('ent'); // To escape html scripting
var express = require('express');
var http = require('http');
var fs = require('fs');
var app = express();

// Variables
const port = 8080;
const secret = '!_secret_todo-list';
const namespace = '/todo';

// Some values to test
let todolist = ['This', 'is', 'a', 'test'];

// Initiates the retrieval of POST's params
app.use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
// Initiates session's variables
  .use(cookieSession({secret: secret}));

// Retrieves the todolist
app.get('/', (req, res) => {
  res.render('todolist.ejs', {todolist: todolist});
});

// 404 - Not found
app.use(function(req, res, next){
  res.setHeader('Content-Type', 'text/plain');
  res.status(404).send("This page doesn''t exist !");
});

// Starts the server
var server = app.listen(port, () => console.log(`Server started on port ${port}`));

// Loading socket.io
var io = require('socket.io').listen(server);

// Loading sessions
var session = require('express-session')({
    secret: secret,
    resave: true,
    saveUninitialized: true
});

// Loadings sessions in socket.io
var sharedsession = require("express-socket.io-session");
 
// Attachs session
app.use(session);
 
// Shares session with io sockets
io.of(namespace).use(sharedsession(session, { autoSave:true }));

io.of(namespace).on('connection', function (socket) {
    // socket.handshake.session allows to access session's variables
    socket.on('new_arrival', function(username) {
      // Saving the username
      socket.handshake.session.username = ent.encode(username);
      console.log(`Connection of ${username}`);

      // Envoi d'un message de confirmation de connection
      socket.emit('confirm_connection', {
        message : `Welcolme ${socket.handshake.session.username} ! You're online !`,
        todolist : todolist
      });

      // Indicates the connection of the new client to others
      socket.emit('client_arrival', `Welcolme ${socket.handshake.session.username} !`);
      socket.broadcast.emit('client_arrival', `${socket.handshake.session.username} is now online !`);
    });
    
    // Dès qu'on reçoit un "update_todolist" d'un client, on traite l'information et on la diffuse
    socket.on('operation_on_todolist', function (data) {
      let {type, value} = data;

      let message;
      if(type === 'Adding') {
        type = ent.encode(type);
        value = ent.encode(value);
        
        // Adding a new value to the todolist
        todolist.push(value);

        message = `Adding of "${value}" to the todolist by ${socket.handshake.session.username}`;
      } else {
        // Deleting a value in the todolist
        const index = parseInt(value, 10);

        // Veriies that we are trying to remove an index which exists
        assert(index < todolist.length);
        message = `Deleting of  "${todolist[index]}" from the todolist by ${socket.handshake.session.username} !`;

        // Removes the index from the array
        todolist.splice(index, 1);
      }

      // Updating everyone's todolist
      console.log(message);
      io.of(namespace).emit('update_todolist', {todolist : todolist, history : message});
    }); 
});
