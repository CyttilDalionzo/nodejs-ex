var Scene = {};

var myNumber = -1;
var myRoom = -1;
var allPlayers = [];
var myPlayer = null;

var iAmTheBoss = false;
var iShouldSend = 0;
var accumDeltaTime = 0;

var globalSocket = null;

var CELL_SIZE = 50;
var MAP = null;

Scene.Main = function (game) {

};

Scene.Main.prototype = {
	preload: function() {
		game.stage.backgroundColor = '#555';

		game.load.image('player1', 'Player1.png');
		game.load.image('player2', 'Player2.png');
		game.load.image('ball', 'Ball.png');

		game.load.start();

		game.stage.disableVisibilityChange = true; // to prevent pausing when inactive/out of focus
	},

	create: function () {
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

	    	// Determine who's boss
	    	if(myNumber == 1) {
	    		iAmTheBoss = true;
	    	}

	    	// Load the map
	    	var map = msg.map;
	    	for(var i = 0; i < map.length; i++) {
	    		for(var j = 0; j < map[i].length; j++) {
	    			Scene.Main.prototype.createTile(i, j, map[i][j]);
	    		}
	    	}
	    	game.world.setBounds(0, 0, (map.length * CELL_SIZE), (map.length[0] * CELL_SIZE));
	    	MAP = map;

	    	// Create all players
	    	var p = msg.players;
	    	for(var i = 0; i < p.length; i++) {
	    		var cP = p[i];
	    		Scene.Main.prototype.createPlayer(cP.x, cP.y);
	    	}

	    	// Assign the right player to ourselves
	    	myPlayer = allPlayers[(myNumber-1)];
	    	game.camera.follow(myPlayer, Phaser.Camera.FOLLOW_PLATFORMER);
	    });

	    globalSocket.on('boss change', function(msg) {
	    	if(msg == myNumber) {
	    		iAmTheBoss = true;
	    	}
	    });

	    // Retrieve wait/start/stop signals
	    globalSocket.on('signal', function(msg) {
	    	var statusHTML = "";

	    	if(msg == "join") {
	    		statusHTML = "A new player joined!";
	    		Scene.Main.prototype.createPlayer(0, 0);
	    	} else if(msg == "disconnect") {
	    		statusHTML = "A player disconnected!";
	    	}

	    	$("#gameStatus").html(statusHTML);
	    });

	    // Retrieve updated world state FROM server
	    globalSocket.on('update', function(msg) {
	    	// Go through all players (even our own), and update them
	    	for(var i = 0; i < allPlayers.length; i++) {
	    		var cP = msg.players[i];
	    		allPlayers[i].position.setTo(cP.x, cP.y);
	    	}
	    });
	},

	update: function () {
		var deltaTime = game.time.elapsed / 1000;
		accumDeltaTime += deltaTime;

		var movementUpdate = [0, 0];

		// left/right movement
		if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT))
	    {
	        movementUpdate[0] = -1;
	    }
	    else if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT))
	    {
	        movementUpdate[0] = 1;
	    }

	    // jump movement
	    if (game.input.keyboard.isDown(Phaser.Keyboard.UP))
	    {
	        movementUpdate[1] = -1;
	    }
	    /*else if (game.input.keyboard.isDown(Phaser.Keyboard.DOWN))
	    {
	        movementUpdate[1] = 1;
	    }*/

	    // Send input TO other players (iff something changed)
	    if(movementUpdate[0] != 0 || movementUpdate[1] != 0) {
	    	var inputData = { num: (myNumber - 1), room: myRoom, input: movementUpdate };
    		globalSocket.emit('input', inputData);
	    }

	    // If we're the first player, activate update loop on server each frame
	    // Or, in fact, do it at a lower rate (like, 30 FPS)
	    if(iAmTheBoss) {
	    	iShouldSend = (iShouldSend + 1) % 2;
	    	if(iShouldSend == 0) {
		    	globalSocket.emit('update', { room: myRoom, dt: accumDeltaTime });
		    	accumDeltaTime = 0;
		    }
	    }
	},

	createPlayer: function(x, y) {
		var temp = game.add.sprite(x, y, 'player1');
		temp.width = temp.height = CELL_SIZE;
		temp.anchor.setTo(0.5, 0.5);
		allPlayers.push(temp);
	},

	createTile: function(i, j, what) {
		if(what == 0) {
			return;
		}
		var temp = game.add.sprite(i * CELL_SIZE, j * CELL_SIZE, 'player2');
		temp.width = temp.height = CELL_SIZE;
	}
}