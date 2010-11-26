var path = require('path');
require.paths.unshift(path.join(__dirname, './support'));
var app = require('./app').app;
var PORT = 3000;
app.listen(PORT);
console.log('Thingies started on port '+ PORT);
