var port = 1337;

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs')

app.listen(port, '10.0.0.7');

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
var updateRate = 50;

//
var nextID = 0;

// Array of Players connected to server
var players = [];

// a KeyEvent is a {Number : Boolean}
// {key : pressed}


// a Player is an object with:
// - x (Number), y (Number), id (Unique Number),
// - keys (Array of Number)
function Player () {
  this.id = nextID++;
  this.x = 0;
  this.y = 0;

  // Keys currently down by this player
  this.keys = {};

  this.move = function() {
    // 37 === LEFT
    // 38 === UP
    // 39 === RIGHT
    // 40 === DOWN
    if (37 in this.keys) {
      this.x -= 10;
    }
    if (38 in this.keys) {
      this.y -= 10;
    }
    if (39 in this.keys) {
      this.x += 10;
    }
    if (40 in this.keys) {
      this.y += 10;
    }
  }
}

// update the game
function update() {
  for(var i = 0; i < players.length; i++){
    players[i].move();
  }
}


io.sockets.on('connection', function (socket) {
  var player = new Player();
  players.push(player);

  socket.emit('registration', {id : player.id});

  // KeyEvent ->
  socket.on('keyEvent', function (data) {
    for (var keyCode in data) {
      if (data[keyCode]) {
        player.keys[keyCode] = true;
      } else {
        delete player.keys[keyCode];
      }
    }
  })

});

setInterval(function() {
  update();

  io.sockets.emit('update', {players : players});
}, updateRate);




