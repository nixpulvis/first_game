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

//
var updateRate = 25;

// Array of Players connected to server
var players = [];

// a KeyEvent is a {Number : Boolean}
// {key : pressed}

var newCookie = false;

// a Cookie is delicious
function Cookie () {
  this.x = 0;
  this.y = 0;

  this.spawn = function() {
    this.x = Math.random()*(500-32);
    this.y = Math.random()*(500-32);
  }

  this.collide = function(player) {
    return (this.x <= player.x+32 && this.x+32 >= player.x &&
      this.y <= player.y+32 && this.y+32 >= player.y);
  }
}

var cookie = new Cookie();
cookie.spawn();

// a Player is an object with:
// - x (Number), y (Number), id (Unique Number),
// - keys (Array of Number)
function Player (id) {
  this.id = id;
  this.x = 0;
  this.y = 0;
  this.score = 0;

  this.speed = 5;

  this.color = "rgb("+
    Math.floor(Math.random()*255)+","+
    Math.floor(Math.random()*255)+","+
    Math.floor(Math.random()*255)+")";

  // Keys currently down by this player
  this.keys = {};

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

// update the game
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


io.sockets.on('connection', function (socket) {
  console.log("New Player: "+socket.id);

  var player = new Player(socket.id);
  players.push(player);

  socket.emit('registration', {id : player.id});
  socket.emit('cookie', {cookie : cookie});

  // KeyEvent ->
  socket.on('keyEvent', function (data) {
    for (var keyCode in data) {
      if (data[keyCode]) {
        player.keys[keyCode] = true;
      } else {
        delete player.keys[keyCode];
      }
    }
  });

  socket.on('changeColor', function (data) {
    for(var i = 0; i < players.length; i++) {
      if(players[i].id == socket.id) {
        players[i].color = data;
        break;
      }
    }
  });

  socket.on('disconnect', function(data) {
    console.log("Player Disconnected: "+socket.id);
    for(var i = 0; i < players.length; i++) {
      if(players[i].id == socket.id) {
        players.splice(i, 1);
        break;
      }
    }
  });

});

setInterval(function() {
  update();

  if(newCookie) {
    io.sockets.emit('cookie', {cookie : cookie});
    newCookie = false;
  }

  io.sockets.emit('update', {players : players});
}, updateRate);




