var Scene = {};

var myNumber = -1;
var myRoom = -1;

var allPlayers = [];
var score = [0,0];
var ball = null;

var iShouldSend = 0;
var accumDeltaTime = 0;
var waitingForPlayer = true;

var globalSocket = null;

var GRAVITY_CONST = 1;
var PLAYER_RADIUS = 3;
var BALL_RADIUS = 1.5;

var SERVER_WIDTH = 100
var SERVER_HEIGHT = 40;
var GAME_SCALE = 1;


var buttons = [];



Scene.Main = function (game) {

};

Scene.Main.prototype = {
	preload: function() {
		game.stage.backgroundColor = '#a4c5f9';

		game.load.image('player1', 'Player1.png');
		game.load.image('player2', 'Player2.png');
		game.load.image('ball', 'Ball.png');

		game.load.start();

		game.stage.disableVisibilityChange = true; // to prevent pausing when inactive/out of focus
	},

	create: function () {
		// RESIZING & RESCALING
		game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
		game.scale.refresh();

		GAME_SCALE = Math.min(game.width / SERVER_WIDTH, game.height / SERVER_HEIGHT);

	    /*** 
	     * WEBSOCKET STUFF
	    ***/
		globalSocket = io();

	    // Retrieve room/game data
	    globalSocket.on('data', function(msg) {

	    	// Display some useful messages
	    	myNumber = msg.player;
	    	myRoom = msg.room;
	    	$("#roomNum").html("You are in room " + myRoom + " as player " + myNumber);

	    	if(myNumber == 0) {
	    		buttons = [Phaser.Keyboard.A, Phaser.Keyboard.S, Phaser.Keyboard.D];
	    	} else if(myNumber == 1) {
	    		buttons = [Phaser.Keyboard.D, Phaser.Keyboard.S, Phaser.Keyboard.A];
	    	}

	    	// Initialize game
	    	var myGame = msg.game;

	    	for(var i = 0; i < 2; i++) {
	    		allPlayers[i] = [];
	    		for(var j = 0; j < 3; j++) {
	    			var serverPlayer = myGame.players[i][j];
	    			allPlayers[i][j] = Scene.Main.prototype.createPlayer(serverPlayer.x, serverPlayer.y, i);
	    		}
	    	}

	    	ball = Scene.Main.prototype.createBall(myGame.ball.x, myGame.ball.y);
	    });

	    // Retrieve wait/start/stop signals
	    globalSocket.on('signal', function(msg) {
	    	var statusHTML = "";

	    	if(msg == "start") {
	    		statusHTML = "The games have begun!";
	    		$("#scoreStatus").html("Score: 0 - 0");
	    		waitingForPlayer = false;
				// game.world.setBounds(0, 0, (map.length * CELL_SIZE), (map.length[0] * CELL_SIZE));
	    	} else if(msg == "disconnect") {
	    		statusHTML = "A player disconnected!";
	    	}

	    	$("#gameStatus").html(statusHTML);
	    });

	    // Somebody scored!
	    globalSocket.on('score', function(msg) {
	    	$("#scoreStatus").html("Score: " + msg[0] + " - " + msg[1]);
	    });

	    // Retrieve updated world state FROM server
	    globalSocket.on('update', function(msg) {

	    	// Go through all players (even our own), and update them
	    	for(var i = 0; i < 2; i++) {
	    		for(var j = 0; j < 3; j++) {
	    			var cP = msg.players[i][j];
	    			if(myNumber == 1) { 
	    				cP.x = (SERVER_WIDTH - cP.x); 
	    			}

	    			var localP = allPlayers[i][j];

	    			localP.velX = cP.velX;
	    			localP.velY = cP.velY;
	    			localP.position.setTo(cP.x * GAME_SCALE, cP.y * GAME_SCALE);
	    		}
	    	}

	    	// Update the ball
	    	var ballX = msg.ball.x * GAME_SCALE
	    	if(myNumber == 1) {
	    		ballX = (SERVER_WIDTH - msg.ball.x) * GAME_SCALE;
	    	}
	    	ball.velX = msg.ball.x;
	    	ball.velY = msg.ball.y;
	    	ball.position.setTo(ballX, msg.ball.y * GAME_SCALE);
	    });
	},

	update: function () {
		if(waitingForPlayer) {
			return;
		}

		var deltaTime = game.time.elapsed / 1000;
		accumDeltaTime += deltaTime;

		var movementUpdate = [0, 0, 0];

		if(game.input.keyboard.isDown(buttons[0])) {
			movementUpdate[0] = 1;
		}

		if(game.input.keyboard.isDown(buttons[1])) {
			movementUpdate[1] = 1;
		}

		if(game.input.keyboard.isDown(buttons[2])) {
			movementUpdate[2] = 1;
		}

	    // Send input TO other players (iff something changed)
	    if(movementUpdate[0] != 0 || movementUpdate[1] != 0 || movementUpdate[2] != 0) {
	    	var inputData = { num: myNumber, room: myRoom, input: movementUpdate };
    		globalSocket.emit('input', inputData);
	    }


	    /**** 
	     * ACTUAL GAME LOGIC
	     * Same as on server, but simplified
	     * Used to make the game look smooth in the eyes of the player (everything is overwritten by server later anyway)
	     ****/

	    // UPDATE PLAYERS
	    var players = allPlayers;
	    var BOTTOM_BOUND = (SERVER_HEIGHT - PLAYER_RADIUS) * GAME_SCALE;
	    var TOP_BOUND = (0.0 + PLAYER_RADIUS) * GAME_SCALE;
	      for(var j = 0; j < 3; j++) {
	        var p = players[myNumber][j];

	        // GRAVITY
	        p.velY += GRAVITY_CONST * GAME_SCALE;

	        // INPUT
	        if(movementUpdate[j] == 1) {
	          p.velY -= GRAVITY_CONST * 10 * GAME_SCALE;
	        }

	        // ACTUALLY MOVING
	        p.y += p.velY * deltaTime;

	        // USE TOP AND BOTTOM BOUNDS
	        if(p.y > BOTTOM_BOUND) {
	          p.velY *= -0.5;
	          p.y = BOTTOM_BOUND;
	        } else if(p.y < TOP_BOUND) {
	          p.velY *= -0.5;
	          p.y = TOP_BOUND;
	        }
	      }

	    // UPDATE BALL
	    ball.velY += GRAVITY_CONST * GAME_SCALE;

	    ball.y += ball.velY * deltaTime;
	    ball.x += ball.velX * deltaTime;

	    // TO PREVENT BALL STANDING STILL
	    if(Math.abs(ball.velX) < 0.05) {
	      ball.velX *= 3.5;
	    }

	    // BALL UPPER AND LOWER BOUNDS
	    var BOTTOM_BOUND = (SERVER_HEIGHT - BALL_RADIUS) * GAME_SCALE;
	    var TOP_BOUND = (0.0 + BALL_RADIUS) * GAME_SCALE;
	    if(ball.y > BOTTOM_BOUND) {
	      ball.velY *= -1.3;

	      if(ball.velY >= 0 && ball.velY < 0.5) {
	        ball.velY *= 4;  
	      }

	      ball.y = BOTTOM_BOUND;
	    } else if(ball.y < TOP_BOUND) {
	      ball.velY *= -0.5;
	      ball.y = TOP_BOUND;
	    }

	    // BALL LEFT AND RIGHT BOUNDS ( = SCORING)
	    if(ball.x < 0.0) {
	      ball.x = 0.5 * SERVER_WIDTH * GAME_SCALE;
	      ball.y = 0.5 * SERVER_HEIGHT * GAME_SCALE;
	      ball.velY = -20;
	      ball.velX = -10;
	      score[(1 + myNumber) % 2]++;
	      $("#scoreStatus").html("Score: " + score[0] + " - " + score[1]);
	    } else if(ball.x > SERVER_WIDTH * GAME_SCALE) {
	      ball.x = 0.5 * SERVER_WIDTH * GAME_SCALE;
	      ball.y = 0.5 * SERVER_HEIGHT * GAME_SCALE;
	      ball.velY = -20;
	      ball.velX = 10;
	      score[(0 + myNumber)%2]++;
	      $("#scoreStatus").html("Score: " + score[0] + " - " + score[1]);
	    }

	    /*****
	     * END OF ACTUAL GAME LOGIC
	     ****/

	    // If we're the first player, activate update loop on server each frame
	    // Or, in fact, do it at a lower rate (like, 30 FPS at the moment)
	    if(myNumber == 0) {
	    	iShouldSend = (iShouldSend + 1) % 2;
	    	if(iShouldSend == 0) {
		    	globalSocket.emit('update', { room: myRoom, dt: accumDeltaTime });
		    	accumDeltaTime = 0;
		    }
	    }
	},

	createPlayer: function(x, y, team) {
		// convert to this specific game
		var teamString = "";
		if(team == 0) {
			teamString = 'player1';
		} else {
			teamString = 'player2';
		}

		x = x * GAME_SCALE;
		y = y * GAME_SCALE;

		if(myNumber == 1) {
			x = (SERVER_WIDTH * GAME_SCALE - x);
		}

		var temp = game.add.sprite(x, y, teamString);
		temp.width = temp.height = PLAYER_RADIUS * 2 * GAME_SCALE;
		temp.anchor.setTo(0.5, 0.5);

		// face the opponent's goal
		if(team != myNumber) {
			temp.width *= -1;
		}

		return temp;
	},

	createBall: function(x,y) {
		var temp = game.add.sprite(x * GAME_SCALE, y * GAME_SCALE, "ball");
		temp.width = temp.height = BALL_RADIUS * 2 * GAME_SCALE;
		temp.anchor.setTo(0.5, 0.5);
		return temp;
	}
}