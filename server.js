// Initializing http server
var port = 1337;

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs')

io.set('log level', 1);

app.listen(port, '10.0.0.2');

function handler(req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}

// Delay in ms before we send another update to connected players
var updateRate = 25;

// Array of Players connected to server
var players = [];

// True if a new cookie was spawned this tick, false otherwise.
// Determines whether or not to send a new cookie packet to players
// This avoids spamming cookie packets when the position doesn't change
var newCookie = false;

// a Cookie is an object with:
// x (Number), y (Number)
function Cookie () {
  this.x = 0;
  this.y = 0;

  // Spawn a new cookie on screen
  this.spawn = function() {
    this.x = Math.random()*(500-32);
    this.y = Math.random()*(500-32);

    // If new cookie is colliding with player, generate a new one!
    for(var i = 0; i < players.length; i++) {
      if(this.collide(players[i])) {
        this.spawn();
        return;
      }
    }
  }

  // Bounding box collision with player
  this.collide = function(player) {
    return (this.x <= player.x+32 && this.x+32 >= player.x &&
      this.y <= player.y+32 && this.y+32 >= player.y);
  }
}

// Initialize cookie for game
var cookie = new Cookie();
cookie.spawn();

// a Player is an object with:
// - x (Number), y (Number), id (Unique String),
// - keys (Array of Number), score (Number), speed (Number)
// - color (String, form:"rgb(r,g,b)" with r,g,b being Number)
function Player (id) {
  this.id = id;
  this.x = 0;
  this.y = 0;
  this.score = 0;

  this.speed = 5;

  // Randomly generate color
  this.color = "rgb("+
    Math.floor(Math.random()*255)+","+
    Math.floor(Math.random()*255)+","+
    Math.floor(Math.random()*255)+")";

  // Keys currently down by this player
  this.keys = {};

  // Moves player depending on keys down and keeps them on screen
  this.move = function() {
    // 37 === LEFT
    // 38 === UP
    // 39 === RIGHT
    // 40 === DOWN
    if (37 in this.keys) {
      this.x -= this.speed;
    }
    if (38 in this.keys) {
      this.y -= this.speed;
    }
    if (39 in this.keys) {
      this.x += this.speed;
    }
    if (40 in this.keys) {
      this.y += this.speed;
    }

    if(this.x < -32) this.x = 500;
    if(this.x > 500) this.x = -32;

    if(this.y < -32) this.y = 500;
    if(this.y > 500) this.y = -32;
  }
}

// Update the game, move players, check for collision
function update() {
  for(var i = 0; i < players.length; i++){
    players[i].move();
  }

  for(var i = 0; i < players.length; i++){
    if(cookie.collide(players[i])) {
      players[i].score++;
      cookie.spawn();
      newCookie = true;
      break;
    }
  }
}

// On a new connection with given Socket
io.sockets.on('connection', function (socket) {
  // Log the new player's ID
  console.log("New Player: "+socket.id);

  // Generate a Player object from sockets id and add to players array
  var player = new Player(socket.id);
  players.push(player);

  // Emit the player's ID and cookie location
  socket.emit('registration', {id : player.id});
  socket.emit('cookie', {cookie : cookie});

  // If key pressed down, add to player's keys array, otherwise remove it
  socket.on('keyEvent', function (data) {
    for (var keyCode in data) {
      if (data[keyCode]) {
        player.keys[keyCode] = true;
      } else {
        delete player.keys[keyCode];
      }
    }
  });

  // Request to change color, set player's color to given color
  socket.on('changeColor', function (data) {
    for(var i = 0; i < players.length; i++) {
      if(players[i].id == socket.id) {
        players[i].color = data;
        break;
      }
    }
  });

  // Player has disconnected, remove him from array of players
  socket.on('disconnect', function (data) {
    console.log("Player Disconnected: "+socket.id);
    for(var i = 0; i < players.length; i++) {
      if(players[i].id == socket.id) {
        players.splice(i, 1);
        break;
      }
    }
  });

});

// Game loop. Run every "updateRate" ms
setInterval(function() {
  // Update game
  update();

  // If we have a new cookie, emit information to everyone
  if(newCookie) {
    io.sockets.emit('cookie', {cookie : cookie});
    newCookie = false;
  }

  // Send array of player to everyone
  io.sockets.emit('update', {players : players});
}, updateRate);




