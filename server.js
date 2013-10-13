// Initializing http server
var port = 1337;

var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs')

io.set('log level', 1);

app.listen(port, 'localhost');

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

var canvas = {
  width : 500,
  height : 500,
};

// Delay in ms before we send another update to connected players
var updateRate = 25;

// Array of Players connected to server
var players = [];

// Array of all the Bullets in the game.
var bullets = [];

// Array of all the Cookies in the game.
var cookies = [];

// a PhysicsObject is an object with:
// x (Number)
// y (Number)
// either radius (Number) OR width (Number) & height (Number)
// for objects with radii, the x, y are the center, otherwise they
// are the topleft corner.


// Object (:x, :y), Object (:x, :y) -> Number
function distance(obj1, obj2) {
  return Math.sqrt(Math.pow(obj2.x-obj1.x, 2) + Math.pow(obj2.y-obj1.y, 2));
}

// Object (:x, :y, :width, :height), Object (:x, :y, :width, :height) -> Boolean
function boxboxCollide(box1, box2) {
  return box1.x <= box2.x+box2.width &&
         box1.x+box1.width >= box2.x &&
         box1.y <= box2.y+box2.height &&
         box1.y+box1.height >= box2.y;
}

// Object (:x, :y, :width, :height), Object (:x, :y, :width, :height) -> Boolean
function circlecircleCollide(circle1, circle2) {
  return (distance(circle1, circle2) <= circle1.radius+circle2.radius);
}

// Object (:x, :y, :width, :height), Object (:x, :y, :radius) -> Boolean
function boxcircleCollide(box, circle) {
  // Corners
  if (circle.x < box.x && circle.y < box.y) {
    var point = {x : box.x, y : box.y};
    return distance(point, circle) <= circle.radius;
  }
  else if (circle.x > box.x+box.width && circle.y < box.y) {
    var point = {x : box.x+box.width, y : box.y};
    return distance(point, circle) <= circle.radius;
  }
  else if (circle.x < box.x && circle.y > box.y+box.height) {
    var point = {x : box.x, y : box.y+box.height};
    return distance(point, circle) <= circle.radius;
  }
  else if (circle.x > box.x+box.width && circle.y > box.y+box.height) {
    var point = {x : box.x+box.width, y : box.y+box.height};
    return distance(point, circle) <= circle.radius;
  }
  // Edges
  else if (circle.x >= box.x && circle.x <= box.x+box.width && circle.y <= box.y) {
    return box.y-circle.y <= circle.radius;
  }
  else if (circle.x >= box.x && circle.x <= box.x+box.width && circle.y >= box.y+box.height) {
    return circle.y-(box.y+box.height) <= circle.radius;
  }
  else if (circle.y >= box.y && circle.y <= box.y+box.height && circle.x <= box.x) {
    return box.x-circle.x <= circle.radius;
  }
  else if (circle.y >= box.y && circle.y <= box.y+box.height && circle.x >= box.x+box.width) {
    return circle.x-(box.x+box.width) <= circle.radius;
  }
  // Within the box!
  else {
    return true;
  }
}

// PhysicsObject, PhysicsObject -> Boolean
// Returns true if they are colliding, using box collision.
function collide(obj1, obj2) {
  if (obj1.radius && obj2.radius) return circlecircleCollide(obj1, obj2);
  else if (!obj1.radius && obj2.radius) return boxcircleCollide(obj1, obj2);
  else if (obj1.radius && !obj2.radius) return boxcircleCollide(obj2, obj1);
  else return boxboxCollide(obj1, obj2);
}


// a Cookie is an object with:
// x (Number), y (Number)
function Cookie() {
  this.x = 0;
  this.y = 0;
  this.radius = 16;

  // Spawn a new cookie on screen
  this.spawn = function() {
    this.x = Math.random() * (canvas.width  - this.radius*2);
    this.y = Math.random() * (canvas.height - this.radius*2);

    // If new cookie is colliding with player, generate a new one!
    for (var i = 0; i < players.length; i++) {
      if (collide(this, players[i])) {
        this.spawn();
        break;
      }
    }
  }
}

// a Bullet is an object with:
// - x (Number) The x coordinate of the bullet's position.
// - y (Number) The y coordinate of the bullet's position.
// - dx (Number) The velocity upon the x axis.
// - dy (Number) The velocity upon the y axis.
// - life (Number) The number of milliseconds this bullet will be active for.
// - playerId (Unique String) The player's id that fired the bullet.
function Bullet (player, aim) {
  this.x     = player.x + player.width/2;
  this.y     = player.y + player.height/2;
  this.radius = 2;
  this.speed = 12;

  var dx = aim.x - this.x;
  var dy = aim.y - this.y;

  var speed = Math.sqrt(dx*dx + dy*dy);

  this.dx    = (this.speed/speed) * dx;
  this.dy    = (this.speed/speed) * dy;
  this.life  = 1250;
  this.player   = player;

  this.move = function() {
    this.life -= updateRate;
    this.x += this.dx;
    this.y += this.dy;

    if (this.x < -this.radius) this.x = canvas.width+this.radius;
    if (this.x > canvas.width+this.radius) this.x = -this.radius;

    if (this.y < -this.radius) this.y = canvas.height+this.radius;
    if (this.y > canvas.height+this.radius) this.y = -this.radius;
  }
}

// a Player is an object with:
// - x (Number)
// - y (Number)
// - id (Unique String)
// - keys (Array of Number)
// - score (Number)
// - speed (Number)
// - color (String, form:"rgb(r,g,b)" with r,g,b being Number)
function Player (id) {
  this.id = id;
  this.x = 0;
  this.y = 0;
  this.width = 32;
  this.height = 32;
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

    if (this.x < -this.width) this.x = canvas.width;
    if (this.x > canvas.width) this.x = -this.width;

    if (this.y < -this.height) this.y = canvas.height;
    if (this.y > canvas.height) this.y = -this.height;
  }
}

// Update the game, move players, check for collision
function update() {
  for (var i = 0; i < players.length; i++) {
    players[i].move();
  }

  for (var i = 0; i < bullets.length; i++) {
    bullets[i].move();
    if (bullets[i].life <= 0) bullets.splice(i, 1);
  }

  for (var i = 0; i < players.length; i++) {
    for (var j = 0; j < cookies.length; j++) {
      if (collide(cookies[j], players[i])) {
        players[i].score++;
        cookies.splice(j, 1);
      }
    }
  }

  for (var i = 0; i < bullets.length; i++) {
    for (var j = 0; j < cookies.length; j++) {
      if (collide(cookies[j], bullets[i])) {
        bullets[i].player.score++;
        bullets.splice(i, 1);
        cookies.splice(j, 1);
      }
    }
  }

  if (cookies.length == 0) {
    var cookie = new Cookie();
    cookie.spawn();
    cookies.push(cookie);
  }
}

// On a new connection with given Socket
io.sockets.on('connection', function (socket) {
  // Log the new player's ID
  console.log("New Player: "+socket.id);

  // Generate a Player object from sockets id and add to players array
  var player = new Player(socket.id);
  players.push(player);

  // Emit the player's ID
  socket.emit('registration', {id : player.id});

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

  //
  socket.on('mouseEvent', function (data) {
    var bullet = new Bullet(player, data);
    bullets.push(bullet);
  });

  // Request to change color, set player's color to given color
  socket.on('changeColor', function (data) {
    for (var i = 0; i < players.length; i++) {
      if (players[i].id == socket.id) {
        players[i].color = data;
        break;
      }
    }
  });

  // Player has disconnected, remove him from array of players
  socket.on('disconnect', function (data) {
    console.log("Player Disconnected: "+socket.id);
    for (var i = 0; i < players.length; i++) {
      if (players[i].id == socket.id) {
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

  // all of the game data to everyone.
  var data = {
    players : players,
    bullets : bullets,
    cookies : cookies,
  };

  io.sockets.emit('update', data);
}, updateRate);




