var Scene = {};
var paddles = [];
var myNumber = -1;
var globalSocket = null;
var ball = null;

var PADDLE_WIDTH = 0.1;
var PADDLE_HEIGHT = 0.01;
var BALL_RADIUS = 0.05;

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
	    // Also retrieve updated world state
	    globalSocket.on('update', function(msg) {
	    	if(myNumber == 0) {
		    	ball.position.setTo(msg.ball.x * game.width, msg.ball.y * game.height);	
		    	paddles[1].position.x = (1 - msg.players[1].x) * game.width;    		
	    	} else {
		    	ball.position.setTo((1 - msg.ball.x) * game.width, (1 - msg.ball.y) * game.height);
		    	paddles[0].position.x = (1 - msg.players[0].x) * game.width;
	    	}
	    	
	    });
	},

	update: function () {
		if(paddles.length != 2) {
			return;
		}

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

	    // Send input TO other player
	    // Position is sent as ratio (because screen sizes differ)
    	var inputData = {x: myPaddle.x/game.width, num: myNumber};
    	globalSocket.emit('input', inputData);
	},

	initialize: function() {
		paddles = [];

		// add paddles
		var paddleOrder = [game.height * 0.9, game.height * 0.1];
		if(myNumber == 1) {
			paddleOrder = [game.height * 0.1, game.height * 0.9];
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
		ball.width = BALL_RADIUS*game.width;
		ball.height = BALL_RADIUS*game.height;
		ball.anchor.setTo(0.5, 0.5);
	},

	createPaddle: function(x, y, sprite) {
		var sprite = game.add.sprite(x, y, sprite);
		sprite.speed = 10;
		sprite.width = PADDLE_WIDTH * game.width;
		sprite.height = PADDLE_HEIGHT * game.width;
		sprite.anchor.setTo(0.5, 0.5);

		paddles.push(sprite);
	}
}