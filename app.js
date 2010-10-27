// the thingies server

var express = require('express'),
    sys = require('sys'),
    fs = require('fs'),
    assert = require('assert'),
    path = require('path'),
    url = require('url'),
    connect = require('connect'), 
    form = require('connect-form'), 
    auth = require('connect-auth/lib/auth'),
    OAuth = require('oauth').OAuth,
    RedisStore = require('connect-redis')
    ;

try {
  var keys = require(path.join(process.env.HOME, 'tasks_secrets.js'));
  for(var key in keys) {
    global[key]= keys[key];
  }
} catch(e) {
  console.log('Unable to locate the tasks_secrets.js file.  Please copy and ammend the example_keys_file.js as appropriate, and put it in your HOME directory');
  sys.exit();
}

var redis = require('redis').createClient();
var app = express.createServer(
                        connect.cookieDecoder(), 
                        connect.bodyDecoder(), // must be before session
                        connect.session({ store: new RedisStore({ maxAge: 300000 }) }),
                        auth( [
                              auth.Anonymous(),
                              auth.Twitter({consumerKey: twitterConsumerKey, consumerSecret: twitterConsumerSecret}),
                              ])
                        );

var STATIC_DIR = path.join(process.cwd(), 'static');

app.use(express.favicon());  // XXX come up with our own favicon
app.use(express.logger({format: '":method :url" :status'}))
app.use(app.router);
app.use(express.bodyDecoder());

// Routes

app.get ('/auth/twitter', function(req, res, params) {
  // next is a query parameter which indicates where to redirect to.
  var q = url.parse(req.url, true).query;
  var next = '/';
  if (q && q.next) {
    next = q.next;
    // we'll store in the session, so that we can handle it when we get
    // redirected back from twitter.
    req.sessionStore.set('tasks', {'next': next});
  }
  req.authenticate(['twitter'], function(error, authenticated) { 
    if (authenticated) {
      var next = req.sessionStore.get('tasks', function(err, data, meta) {
        res.writeHead(303, {"Location": (data && data['next']) ? data['next'] : '/'});
        res.end();
      });
    } else {
      res.writeHead(200, {'Content-Type': 'text/html'})
      res.end("<html><h1>Twitter authentication failed :( </h1></html>")
    }
  });
})

// disable in production
app.get('/auth/anon', function(req, res, params) {
  req.authenticate(['anon'], function(error, authenticated) { 
    res.writeHead(303, { 'Location': '/'});
    res.end('');
  });
})

app.get ('/logout', function(req, res, params) {
  req.logout();
  var next = null
  var q = url.parse(req.url, true).query;
  if (q)
    next = q.next;
  res.writeHead(303, { 'Location': next ? next : '/'});
  res.end('');
})

function getUid(req) {
  return req.getAuthDetails().user.username;
}

// Get all current TODOs
app.get('/todos', function(req, res, next){
  assert.ok(req.isAuthenticated());
  // return all todos
  uid = getUid(req);
  redis.smembers(uid+"todos", function(err, todo_keys) {
    if (err) console.log("ERR:", err);
    keys = [];
    res.writeHead(200, {'Content-Type': 'application/json'})
    if (todo_keys) {
      for (i = 0; i < todo_keys.length; i++) {
        keys.push(todo_keys[i].toString());
      }
      redis.mget(keys, function(err, todos) {
        res.end('['+todos.toString()+']');
      });
    } else {
      res.end('');
    }
  });
});

// Add a new TODO
app.post('/todos', function(req, res, next){
  assert.ok(req.isAuthenticated());
  uid = getUid(req);
  redis.incr("ids::todos", function(err, id) {
    todo_key = uid+"todos::"+ id;
    // we need to store the ID in the model so that backbone knows the object
    // has been persisted.
    todo = JSON.parse(req.body.model);
    todo['id'] = id;
    todo = JSON.stringify(todo);
    redis.set(todo_key, todo, function(err, ok) {
      redis.sadd(uid+"todos", todo_key, function(err, ok) {
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(todo);
      });
    });
  });
});


// Update a TODO
app.put('/todos/(*)', function(req, res, next){
  assert.ok(req.isAuthenticated());
  todo_key = uid+"todos::" + req.params[0];
  redis.set(todo_key, req.body.model, function(err, ok) {
    res.writeHead(200, {'Content-Type': 'application/json'})
    res.end(req.body.model);
  });
});



// Remove a TODO
app.del('/todos/(*)', function(req, res, next){
  assert.ok(req.isAuthenticated());
  id = req.params[0];
  todo_key = uid+"todos::" + id;
  redis.del(todo_key, function(err, ok) {
    redis.srem(uid+"todos", todo_key, function(err, ok) {
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end('');
    });
  });
});


// add a tag to a TODO (JS)

// remove a tag from a TODO (JS)

// change 'order' of a TODO (JS)

app.get('/static/(*)$', function(req, res, next){
  var pathname = req.params[0];
  var filename = path.join(STATIC_DIR, pathname);
  res.sendfile(filename);
});

app.get('/$', function(req, res, next){
  var pathname;
  if (! req.isAuthenticated() ) {
    pathname = 'unauthenticated.html';
  } else {
    pathname = "index.html";
  }
  var filename = path.join(STATIC_DIR, pathname);
  res.sendfile(filename);
});

app.get('/config$', function(req, res, next){
  res.writeHead(200, {'Content-Type': 'application/json'})
  if (req.isAuthenticated() ) {
    res.end(JSON.stringify(req.getAuthDetails().user));
  } else {
    res.end('');
  }
});

module.exports = {
  'app': app,
  'redis': redis,
}
