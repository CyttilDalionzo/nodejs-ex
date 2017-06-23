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
var GRAVITY_CONST = 10;

var CELL_SIZE = 50;
var MAP_WIDTH = 50;
var MAP_HEIGHT = 50;

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

    // Get deltatime
    var dt = msg.dt;

    // Shortcut to this player's room
    myRoom = msg.room;
    var curGame = games[myRoom];
    var players = curGame.players;

    // TO DO
    // Actually run game code and update the world

    // For all players ...
    for(var i = 0; i < players.length; i++) {
      var cp = players[i];

      // ignore players who have quit
      if(cp == null) {
        continue;
      }

      // apply gravity
      cp.velY += GRAVITY_CONST * dt;

      // CHECK FOR COLLISIONS
      // essentially, we calculate a square of grid positions that could possibly have been hit
      var startGrids = worldToGrid(cp.x, cp.y);
      var endGrids = worldToGrid(cp.x + cp.velX * dt, cp.y + cp.velY * dt); 
      var bounds = [ [Math.min(startGrids[0], endGrids[0]) - 1, Math.max(startGrids[0], endGrids[0]) + 1 ], [Math.min(startGrids[1], endGrids[1]) - 1, Math.max(startGrids[1], endGrids[1]) + 1] ];

      var nearestHit = 1;
      var startC = [cp.x, cp.y];
      var endC = [cp.x + cp.velX * dt, cp.y + cp.velY * dt];

      // go through this square of squares, and calculate hit positions
      for(var i = bounds[0][0]; i <= bounds[0][1]; i++) {
        for(var j = bounds[1][0]; j <= bounds[1][1]; j++) {

          // if there's no square here, continue
          if(i < 0 || j < 0 || i > MAP_WIDTH || j > MAP_HEIGHT || curGame.map[i][j] == 0) {
            continue;
          }

          var hit = false;

          // pad the square with the size of our player
          var square = { x: (i + 0.5) * CELL_SIZE, y: (j + 0.5) * CELL_SIZE, halfWidth: CELL_SIZE * 0.5, halfHeight: CELL_SIZE * 0.5};

          var paddingX = CELL_SIZE * 0.5;
          var paddingY = CELL_SIZE * 0.5;
          var deltaX = (endC[0] - startC[0]);
          var deltaY = (endC[1] - startC[1]);

          // test the movement segment against this padded square
          var scaleX = 1.0 / deltaX;
          var scaleY = 1.0 / deltaY;

          console.log(scaleX + " || " + scaleY);

          var signX = (scaleX > 0) ? 1 : -1;
          var signY = (scaleY > 0) ? 1 : -1;

          console.log(signX + " || " + signY);
          console.log(square);

          var nearTimeX = 0, farTimeX = 0, nearTimeY = 0, farTimeY = 0;

          if(deltaX == 0) {
            nearTimeX = Infinity;
            farTimeX = Infinity;
          } else {
            nearTimeX = (square.x - signX * (square.halfWidth + paddingX) - startC[0]) * scaleX;
            farTimeX = (square.x + signX * (square.halfWidth + paddingX) - startC[0]) * scaleX;
          }

          if(deltaY == 0) {
            nearTimeY = Infinity;
            farTimeY = Infinity;
          } else {
            nearTimeY = (square.y - signY * (square.halfHeight + paddingY) - startC[1]) * scaleY;
            farTimeY = (square.y + signY * (square.halfHeight + paddingY) - startC[1]) * scaleY;
          }

          // if no hit at all, ignore and move on
          if(nearTimeX > farTimeY || nearTimeY > farTimeX) {
            continue;
          }

          console.log(nearTimeX + " || " + farTimeX + " || " + nearTimeY + " || " + farTimeY);

          var nearTime = Math.max(nearTimeX, nearTimeY);
          var farTime = Math.max(farTimeX, farTimeY);

          if(nearTime >= 1 || farTime <= 0) {
            continue;
          }

          console.log(nearTime + " .. " + farTime);

          var hitTime = Math.min(Math.max(nearTime, 0), 1);
          var hitNormals = [0, -signY];
          if(nearTimeX > nearTimeY) {
            hitNormals = [-signX, 0];
          }

          var epsilon = 0.000001;
          // if hit, check collision axis (x or y), and check if this is the nearest for that axis
          if(nearTime < nearestHit) {
            nearestHit = hitTime - epsilon;
          }
        }
      }

      // if nothing was hit, simply apply speed to position
      cp.x += cp.velX * nearestHit * dt;
      cp.y += cp.velY * nearestHit * dt;

      // reset x-speed
      cp.velX = 0;

    }


    // TO DO
    // It's not necessary to send the whole game, so cherry-pick
    // For example, the map should be sent once and then forgotten about
    var updatedGame = { players: players };

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

      // Update the velocity of this player (and thus its position)
      myPlayer.velX = input[0] * myPlayer.speed;

      if(input[1] == -1) {
         myPlayer.velY = input[1] * myPlayer.speed;
      }


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
  var newPlayer = { x: 100, y: 100, velX: 0, velY: 0, lives: 3, health: 100, speed: 5 };
  games[id].players.push(newPlayer);
}

function createMap() {
  var map = [];

  for(var i = 0; i < MAP_WIDTH; i++) {
    map[i] = [];
    for(var j = 0; j < MAP_HEIGHT; j++) {
      // create border
      if(i == 0 || i == MAP_WIDTH-1 || j == 0 || j == MAP_HEIGHT-1) {
        map[i][j] = 1;
      } else {
        map[i][j] = 0;
      }
    }
  }

  return map;
}

function worldToGrid(x, y) {
  x = Math.floor(x / CELL_SIZE);
  y = Math.floor(y / CELL_SIZE);
  return [x, y];
}

function intersect(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.height + rect1.y > rect2.y;
}

