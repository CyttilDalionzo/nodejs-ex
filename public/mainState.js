var Scene = {};
var paddles = [];
var myNumber = -1;
var globalSocket = null;
var ball = null;

var PADDLE_WIDTH = 0.09;
var PADDLE_HEIGHT = PADDLE_WIDTH * 0.33;
var BALL_RADIUS = 15;
var BALL_VELOCITY = 0.3;

var score = [0,0];

Scene.Main = function (game) {

};

Scene.Main.prototype = {
	preload: function() {
		game.stage.backgroundColor = '#CCCCCC';

		game.load.image('player1', 'Player1.png');
		game.load.image('player2', 'Player2.png');
		game.load.image('ball', 'Ball.png');

		game.load.start();

		game.stage.disableVisibilityChange = true; // to prevent pausing when inactive/out of focus
	},

	create: function () {
		game.physics.startSystem(Phaser.Physics.ARCADE);

		// // RESIZING & RESCALING
		game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
		/*game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
		game.scale.setShowAll();*/
		game.scale.refresh();

		// // WEBSOCKET STUFF
		globalSocket = io();

	    // Retrieve room/game data
	    globalSocket.on('data', function(msg) {
	    	myNumber = msg.player;
	    	$("#roomNum").html("You are in room " + msg.room + " as player " + msg.player);
	    });

	    // Somebody scored a point
	    globalSocket.on('score', function(msg) {
	    	score[msg]++;
	    	Scene.Main.prototype.createBall();

	    	$("#inputUpdate").html("Score: " + score[0] + " - " + score[1]);
	    });

	    // Retrieve wait/start/stop signals
	    globalSocket.on('signal', function(msg) {
	    	var statusHTML = "";

	    	if(msg == "wait") {
	    		statusHTML = "Waiting for another player";
	    	} else if(msg == "start") {
	    		statusHTML = "Starting the game!";

	    		Scene.Main.prototype.initialize();
	    	} else if(msg == "disconnect") {
	    		statusHTML = "Oh noes! The opponent disconnected!";
	    	}

	    	$("#gameStatus").html(statusHTML);
	    });

	    // Retrieve input FROM other player
	    globalSocket.on('input', function(msg) {
	    	paddles[(myNumber + 1) % 2].position.x = (1 - msg.x) * game.width;
	    });
	},

	// TO DO: Make ball move, and bounce
	// TO DO: Actually score points, and finish the game

	update: function () {
		if(paddles.length != 2) {
			return;
		}

		var movementUpdate = false;
		var myPaddle = paddles[myNumber];
		if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT))
	    {
	        myPaddle.x -= myPaddle.speed;
	        var edge = game.width * (PADDLE_WIDTH * 0.5);
	        if(myPaddle.x <= edge) {
	        	myPaddle.x = edge;
	        }
	        movementUpdate = true;
	    }
	    else if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT))
	    {
	        myPaddle.x += myPaddle.speed;
	        var edge = game.width * (1 - PADDLE_WIDTH * 0.5);
	        if(myPaddle.x >= edge) {
	        	myPaddle.x = edge;
	        }
	        movementUpdate = true;
	    }

	    // If we have moved, send input TO other player
	    // Position is sent as ratio (because screen sizes differ)
	    if(movementUpdate) {
	    	var inputData = {x: myPaddle.x/game.width, y: myPaddle.y/game.height};
	    	globalSocket.emit('input', inputData);
	    }

	    game.physics.arcade.collide(ball, paddles[0]);
	    game.physics.arcade.collide(ball, paddles[1]);

	    // Check x-bounds of the world
	    if(ball.x < BALL_RADIUS) {
	    	ball.x = BALL_RADIUS;
	    	ball.body.velocity.x = BALL_VELOCITY * game.width;
	    } else if(ball.x > game.width - BALL_RADIUS) {
	    	ball.x = game.width - BALL_RADIUS;
	    	ball.body.velocity.x = -BALL_VELOCITY * game.width;
	    }

	    // Check y-bounds (the first player is the authority on scoring points)
	    if(myNumber == 0) {
		    if(ball.y > game.height) {
		    	// opponent scored, point for them!
		    	globalSocket.emit('score', (myNumber + 1) % 2);
		    } else if(ball.y < 0 ) {
		    	// we scored
		    	globalSocket.emit('score', myNumber);
		    }
		}
	},

	initialize: function() {
		paddles = [];

		// add paddles
		var paddleOrder = [game.height - 30, 30];
		if(myNumber == 1) {
			paddleOrder = [30, game.height - 30];
		}

		this.createPaddle(game.width * 0.5, paddleOrder[0], 'player1');
		this.createPaddle(game.width * 0.5, paddleOrder[1], 'player2');
		this.createBall();
	},

	createBall: function() {
		if(ball != null) {
			ball.destroy();
			ball = null;
		}

		// add ball
		ball = game.add.sprite(game.width * 0.5, game.height * 0.5, 'ball');
		ball.width = ball.height = BALL_RADIUS;
		ball.anchor.setTo(0.5, 0.5);

		game.physics.arcade.enable(ball);
		ball.body.setCircle(BALL_RADIUS);
		ball.body.velocity.x = BALL_VELOCITY * game.width;
		ball.body.velocity.y = BALL_VELOCITY * game.width;
		if(myNumber == 1) {
			ball.body.velocity.y *= -1;
			ball.body.velocity.x *= -1;
		}

		ball.body.bounce.set(1, 1);
	},

	createPaddle: function(x, y, sprite) {
		var sprite = game.add.sprite(x, y, sprite);
		sprite.speed = 10;
		sprite.width = PADDLE_WIDTH * game.width;
		sprite.height = PADDLE_HEIGHT * game.width;
		sprite.anchor.setTo(0.5, 0.5);

		game.physics.arcade.enable(sprite);
		sprite.body.immovable = true;

		paddles.push(sprite);
	}
}