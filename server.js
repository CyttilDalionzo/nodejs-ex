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

var roomID = -1;
var amountInRoom = 0;
var games = {};

var MAX_PLAYER_AMOUNT = 4;

// A user connects
io.on('connection', function(socket) {

  /*** 
    * If you're the first to start a game
    * Create the game on the server
   ***/
  if(amountInRoom == 0) {

    // Increase roomID
    roomID++;

    // Create the game on the server
    games[roomID] = { players: [], map: [], stats: [] };

    // Create the game map, assign it
    games[roomID].map = createMap();
  }

  var myRoom = roomID;
  var player = 0;

  /*** 
    * If there's already a game going on that has room, join it
   ***/
  if(amountInRoom < MAX_PLAYER_AMOUNT) {

    // Tell all players that somebody has joined
    io.in(roomID).emit("signal", "join");

    // Add player to room count
    amountInRoom++;

    // Tell our user which player he is
    player = amountInRoom;

    // Join the room
    socket.join(roomID);

    // Join the game
    createNewPlayer(roomID);

    // Return game data to player (only sender)
    // Data includes: room number + player number + map + all other players 
    var dataObject = { room: roomID, player: player, map: games[roomID].map, players: games[roomID].players };
    socket.emit('data', dataObject);
  }

  /*** 
    * One of the players (the first one) calls the update loop
    * The update loop does two things: 
    *   update the game world (according to latest input and state)
    *   relay this update to players
   ***/
  socket.on('update', function(msg) {

    // Shortcut to this player's room
    myRoom = msg;
    var curGame = games[myRoom];

    // TO DO
    // Actually run game code and update the world

    // TO DO
    // It's not necessary to send the whole game, so cherry-pick
    // For example, the map should be sent once and then forgotten about
    var updatedGame = { players: curGame.players };

    // The new game state is relayed as an update to all players
    io.in(myRoom).emit('update', updatedGame);
  });

  // When something happens, input is send from player to server
  socket.on('input', function(msg) {
      // Shortcut to this player's room
      myRoom = msg.room;
      var curGame = games[myRoom];
      var myPlayer = curGame.players[msg.num];

      var input = msg.input;

      // Update the position of this player
      myPlayer.x += input[0] * myPlayer.speed;
      myPlayer.y += input[1] * myPlayer.speed;

      // TO DO
      // Update the state of this player (alive, shooting, etc.)
  });

  // And, of course, disconnect
  socket.on('disconnect', function() {
    var curGame = games[myRoom];

    // Tell the other players you've quit
    socket.broadcast.to(myRoom).emit('signal', "disconnect");

    if(player == 0) {
      // If we are the first player...
      if(curGame.players.length < 2) {
        // If there's nobody else, simply delete the room
        curGame = {};
      } else {
        // If there are other players, find another one to control the update loop
        curGame.players[player] = null;

        for(var i = 0; i < curGame.players.length; i++) {
          if(curGame.players[i] != null) {
            io.in(myRoom).emit('boss change', i);
          }
        }
      }

    } else {
      // Simply delete yourself from the game
      curGame.players[player] = null;
    }

    console.log('user disconnected');
  });
});

server.listen(8080, function(){
  console.log('listening on *:8080');
});

function createNewPlayer(id) {
  var newPlayer = { x: 0, y: 0, lives: 3, health: 100, speed: 5 };
  games[id].players.push(newPlayer);
}

function createMap() {
  var WIDTH = 10;
  var HEIGHT = 10;

  var map = [];

  for(var i = 0; i < WIDTH; i++) {
    map[i] = [];
    for(var j = 0; j < HEIGHT; j++) {
      if(i == 0 || i == WIDTH-1 || j == 0 || j == HEIGHT-1) {
        map[i][j] = 1;
      } else {
        map[i][j] = Math.round(Math.random());
      }
    }
  }

  return map;
}

function intersect(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.height + rect1.y > rect2.y;
}

