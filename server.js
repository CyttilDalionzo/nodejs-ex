//  OpenShift sample Node application
var express = require('express'),
    fs      = require('fs'),
    app     = express(),
    eps     = require('ejs'),
    path    = require('path'),
    morgan  = require('morgan');
    
Object.assign=require('object-assign')

var papapapath = path.join(__dirname, 'public');
console.log("CURRENT DIRECTORY " + papapapath);
app.use(express.static(papapapath));

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
  });
};

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      res.render('index.html', { pageCountMessage : count, dbInfo: dbDetails });
    });
  } else {
    res.render('index.html', { pageCountMessage : null});
  }
});

app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
      res.send('{ pageCount: ' + count + '}');
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});

app.use(express.static('public'));

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

// This is where my shit appears

var server = app.listen(port, ip);
var io = require('socket.io').listen(server);

console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;

var roomID = 0;
var freeRoom = false;

// A user connects
io.on('connection', function(socket) {

  var myRoom = roomID;
  var player = 0;

  // If there's a free room (somebody is waiting for another player)
  if(freeRoom) {

    // Tell our user that he's the second player
    player = 1;

    // Join the room
    socket.join(roomID);

    // Close the room
    freeRoom = false;

    // Return game data to player (only sender)
    var dataObject = {room: myRoom, player: player};
    socket.emit('data', dataObject);

    // Tell both players the game can start
    io.in(roomID).emit("signal", "start");

    // Increase roomID (for next room)
    roomID++;
  } else {

    // Tell the user that he's the first player
    player = 0;
    
    // Create a new room (automatically done by joining it)
    socket.join(roomID);

    // Set this room to be open/free
    freeRoom = true;

    // Return game data to player (only sender)
    var dataObject = {room: myRoom, player: player};
    socket.emit('data', dataObject);

    // Tell the player it has to wait for another player
    io.in(roomID).emit("signal", "wait");
  }

  // When a player moves, tell the other player
  socket.on('input', function(msg) {
      socket.broadcast.to(myRoom).emit('input', msg);
      console.log('input ' + msg);
  });

  // And, of course, disconnect
  socket.on('disconnect', function(){
    socket.broadcast.to(myRoom).emit('signal', "disconnect");
    console.log('user disconnected');
  });
});

server.listen(8080, function(){
  console.log('listening on *:8080');
});

