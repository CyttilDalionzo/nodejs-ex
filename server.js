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

// MY GAME CODE

var roomID = -1;
var amountInRoom = 0;
var games = {};

var GRAVITY_CONST = 1;
var PLAYER_RADIUS = 3;
var BALL_RADIUS = 1.5;

var WIDTH = 100;
var HEIGHT = 40;

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
    games[roomID] = { players: [createPlayers(0), createPlayers(1)], ball: createBall(), score: [0, 0] };
  }

  var myRoom = roomID;
  var player = 0;

  if(amountInRoom == 1) {
    player = 1;
  }

  socket.join(roomID);

  // Return game data to player (only sender)
  // Data includes: room number + player number + map + all other players 
  var dataObject = { room: roomID, player: player, game: games[roomID] };
  socket.emit('data', dataObject);

  // If the second player has joined, start the game!
  if(player == 1) {
    amountInRoom = 0;
    io.in(roomID).emit("signal", "start");
  } else {
    // increase amount of people in room
    amountInRoom++;
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

    // UPDATE PLAYERS
    for(var i = 0; i < 2; i++) {
      for(var j = 0; j < 3; j++) {
        var p = players[i][j];

        // GRAVITY
        p.velY += GRAVITY_CONST;

        // INPUT
        if(p.desiredInput == 1) {
          p.velY -= GRAVITY_CONST * 10;
        }

        p.desiredInput = 0;

        // ACTUALLY MOVING
        p.y += p.velY * dt;

        // USE TOP AND BOTTOM BOUNDS
        if(p.y > HEIGHT - PLAYER_RADIUS) {
          p.velY *= -0.5;
          p.y = HEIGHT - PLAYER_RADIUS;
        } else if(p.y < 0.0 + PLAYER_RADIUS) {
          p.velY *= -0.5;
          p.y = 0.0 + PLAYER_RADIUS;
        }
      }
    }

    // UPDATE BALL
    var ball = curGame.ball;

    ball.velY += GRAVITY_CONST;

    ball.y += ball.velY * dt;
    ball.x += ball.velX * dt;

    // TO PREVENT BALL STANDING STILL
    if(Math.abs(ball.velX) < 0.05) {
      ball.velX *= 3.5;
    }

    // BALL UPPER AND LOWER BOUNDS
    if(ball.y > HEIGHT - BALL_RADIUS) {
      ball.velY *= -1.3;

      if(ball.velY >= 0 && ball.velY < 0.5) {
        ball.velY *= 4;  
      }

      ball.y = HEIGHT - BALL_RADIUS;
    } else if(ball.y < 0.0 + BALL_RADIUS) {
      ball.velY *= -0.5;
      ball.y = 0.0 + BALL_RADIUS;
    }

    // BALL LEFT AND RIGHT BOUNDS ( = SCORING)
    if(ball.x < 0.0) {
      ball.x = 0.5 * WIDTH;
      ball.y = 0.5 * HEIGHT;
      ball.velY = -20;
      ball.velX = -10;
      curGame.score[1]++;
      io.in(myRoom).emit('score', curGame.score);
    } else if(ball.x > WIDTH) {
      ball.x = 0.5 * WIDTH;
      ball.y = 0.5 * HEIGHT;
      ball.velY = -20;
      ball.velX = 10;
      curGame.score[0]++;
      io.in(myRoom).emit('score', curGame.score);
    }

    var foundCollision = false;
    for(var i = 0; i < 2; i++) {
      for(var j = 0; j < 3; j++) {
        var p = players[i][j];

        // we "pretend" the player is a static circle, and the ball dynamic
        var depth = (BALL_RADIUS + PLAYER_RADIUS) - Math.sqrt(Math.pow(p.x - ball.x, 2) + Math.pow(p.y - ball.y, 2));
        if(depth >= 0) {
          foundCollision = true;

          var norm = depth + (BALL_RADIUS + PLAYER_RADIUS);
          var direction = [(ball.x - p.x) / norm, (ball.y - p.y) / norm];

          ball.x += direction[0] * depth;
          ball.y += direction[1] * depth;

          var BALL_SPEED = Math.sqrt(Math.pow(ball.velX, 2) + Math.pow(ball.velY, 2));
          var norm2 = Math.sqrt(Math.pow(p.x, 2) + Math.pow(p.y, 2));
          direction[0] += p.velX / norm2;
          direction[1] += p.velY / norm2;

          ball.velX = direction[0] * BALL_SPEED;
          ball.velY = direction[1] * BALL_SPEED;

          break;
        }
      }

      if(foundCollision) {
        break;
      }
    }

    // The new game state is relayed as an update to all players
    io.in(myRoom).emit('update', curGame);

  });

  // When something happens, input is send from player to server
  socket.on('input', function(msg) {

      // Shortcut to this player's room
      myRoom = msg.room;
      var myPlayers = games[myRoom].players[msg.num];

      // Update desired input for my players
      for(var i = 0; i < myPlayers.length; i++) {
        myPlayers[i].desiredInput = msg.input[i];
      }
  });

  // And, of course, disconnect
  socket.on('disconnect', function() {

    // tell the other player you've quit
    socket.broadcast.to(myRoom).emit('signal', "disconnect");

    console.log('user disconnected');
  });
});

server.listen(8080, function(){
  console.log('listening on *:8080');
});

function createPlayers(playerNum) {
  var positionArr = [0.1, 0.4, 0.75, 0.25, 0.6, 0.9];

  var arr = [];
  for(var i = 0; i < 3; i++) {
    arr[i] = createPlayer(WIDTH * positionArr[(i + playerNum * 3)]);
  }
  return arr;
}

function createPlayer(xPos) {
  var newPlayer = { x: xPos, y: HEIGHT * 0.5, velX: 0, velY: 0, desiredInput: 0 };
  return newPlayer;
}

function createBall() {
  return { x: WIDTH * 0.5, y: HEIGHT * 0.5, velX: 10, velY: -20 };
}

function intersect(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.height + rect1.y > rect2.y;
}

function closestpointonline(lx1, ly1, lx2, ly2, x0, y0){ 
     var A1 = ly2 - ly1; 
     var B1 = lx1 - lx2; 
     var C1 = (ly2 - ly1)*lx1 + (lx1 - lx2)*ly1; 
     var C2 = -B1*x0 + A1*y0; 
     var det = A1*A1 - -B1*B1; 
     var cx = 0; 
     var cy = 0; 
     
     if(det != 0) { 
      cx = ((A1*C1 - B1*C2) / det); 
      cy = ((A1*C2 - -B1*C1) / det); 
     } else { 
      cx = x0; 
      cy = y0; 
     } 

     return [cx, cy];
}

function clamp(low, val, high) {
  return Math.max(Math.min(val, high), low);
}
