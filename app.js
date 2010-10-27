// the thingies server

var express = require('express'),
    sys = require('sys'),
    fs = require('fs'),
    assert = require('assert'),
    path = require('path'),
    url = require('url'),
    connect = require('connect'), 
    form = require('connect-form'), 
    RedisStore = require('connect-redis')
    ;

var redis = require('redis').createClient();
var app = express.createServer(connect.bodyDecoder());
var STATIC_DIR = path.join(process.cwd(), 'static');

app.use(express.favicon());  // XXX come up with our own favicon
app.use(express.logger({format: '":method :url" :status'}))
app.use(app.router);
app.use(express.bodyDecoder());

// Routes

// Get all current TODOs
app.get('/todos', function(req, res, next){
  // return all todos
  redis.smembers("todos", function(err, todo_keys) {
    if (err) {
      console.log("ERR:", err);
    }
    keys = [];
    if (todo_keys) {
      for (i = 0; i < todo_keys.length; i++) {
        keys.push(todo_keys[i].toString());
      }
    } else {
      console.log("THERE IS NOTHING IN THE DATABASE!");
    }
    if (keys) {
      redis.mget(keys, function(err, todos) {
        if (todos) {
          res.writeHead(200, {'Content-Type': 'application/json'})
          //console.log("RETURNING: ", '['+todos.toString()+']');
          res.end('['+todos.toString()+']');
        } else {
          //console.log("MGET returned nothing!");
          res.writeHead(200, {'Content-Type': 'application/json'})
          res.end('');
        }
      });
    }
  });
});

// Add a new TODO
app.post('/todos', function(req, res, next){
  redis.incr("ids::todos", function(err, id) {
    todo_key = "todos::"+ id;
    // we need to store the ID in the model so that backbone knows the object
    // has been persisted.
    todo = JSON.parse(req.body.model);
    todo['id'] = id;
    todo = JSON.stringify(todo);
    redis.set(todo_key, todo, function(err, ok) {
      redis.sadd("todos", todo_key, function(err, ok) {
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(todo);
      });
    });
  });
});


// Update a TODO
app.put('/todos/(*)', function(req, res, next){
  todo_key = "todos::" + req.params[0];
  redis.set(todo_key, req.body.model, function(err, ok) {
    res.writeHead(200, {'Content-Type': 'application/json'})
    res.end(req.body.model);
  });
});



// Update a TODO
app.del('/todos/(*)', function(req, res, next){
  id = req.params[0];
  todo_key = "todos::" + id;
  redis.del(todo_key, function(err, ok) {
    redis.srem("todos", todo_key, function(err, ok) {
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end('');
    });
  });
});


// add a tag to a TODO (JS)

// remove a tag from a TODO (JS)

// change 'done' status of a TODO (JS)

// change 'order' of a TODO (JS)

app.get('/static/(*)$', function(req, res, next){
  var pathname = req.params[0];
  var filename = path.join(STATIC_DIR, pathname);
  res.sendfile(filename);
});

app.get('/$', function(req, res, next){
  var pathname = "index.html";
  var filename = path.join(STATIC_DIR, pathname);
  res.sendfile(filename);
});

module.exports = {
  'app': app,
  'redis': redis,
}
