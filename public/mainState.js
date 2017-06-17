var Scene = {};
var paddles = [];

Scene.Main = function (game) {

};

Scene.Main.prototype = {
	preload: function() {
		game.stage.backgroundColor = '#CCCCCC';

		game.load.image('player1', 'Player1.png');
		game.load.image('player2', 'Player2.png');
		game.load.image('ball', 'Ball.png');

		game.load.start();
	},

	create: function () {
		game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
		/*game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
		game.scale.setShowAll();*/
		game.scale.refresh();
	},

	// TO DO: Always make paddle the user is controlling show up at the bottom
	// TO DO: Make ball move, and bounce
	// TO DO: Restrict paddle movement, send paddle's x/y coordinates as ratio (as others may have different screen size)
	// TO DO: Actually score points, and finish the game
	// TO DO: Fix second player not loading images correctly

	update: function () {
		if(paddles.length != 2) {
			return;
		}

		var movementUpdate = false;
		var myPaddle = paddles[0];
		if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT))
	    {
	        myPaddle.x -= myPaddle.speed;
	        movementUpdate = true;
	    }
	    else if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT))
	    {
	        myPaddle.x += myPaddle.speed;
	        movementUpdate = true;
	    }

	    // if we have moved, inform the opponent
	    if(movementUpdate) {
	    	var inputData = {x: myPaddle.x, y: myPaddle.y};
	    	globalSocket.emit('input', inputData);
	    }
	},

	initialize: function(PLAYER_NUM) {
		paddles = [];

		// add paddles
		var paddleOrder = [game.height - 10, 10];
		if(PLAYER_NUM == 1) {
			paddleOrder = [10, game.height - 10];
		}

		this.createPaddle(game.width * 0.5, paddleOrder[0], 'player1');
		this.createPaddle(game.width * 0.5, paddleOrder[1], 'player2');

		// add ball
		this.ball = game.add.sprite(game.width * 0.5, game.height * 0.5, 'ball');
		this.ball.width = this.ball.height = 15;
		this.ball.anchor.setTo(0.5, 0.5);

	},

	createPaddle: function(x, y, sprite) {
		var sprite = game.add.sprite(x, y, sprite);
		sprite.speed = 10;
		sprite.width = 50;
		sprite.height = 20;
		sprite.anchor.setTo(0.5, 0.5);

		paddles.push(sprite);
	}
}