var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var path = require('path');
var config = require('./config');

var app = express();
app.set('views', path.join(process.cwd(), 'views'));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({	extended: true	}));
app.use(express.static(__dirname + '/public')); // set the static files location /public/img will be /img for users

var port = process.env.PORT || 8080; // set our port

var twilio = require('twilio');
var client = twilio(config.twilio.sid, config.twilio.token );

var flybase = require('flybase');
var messagesRef = flybase.init(config.flybase.app_name, "messages", config.flybase.api_key);
var groupRef = flybase.init(config.flybase.app_name, "groups", config.flybase.api_key);

// listen for updates from Data McFly routes =========================================================

//	when a new message is added to the Data McFly app, send it via Twilio...
messagesRef.on("added", function (data ){
	var snapshot = data.value();
	sendMessage(
		snapshot.groupNumber,
		snapshot.fromName,
		snapshot.fromNumber,
		snapshot.message
	);
});

groupRef.on("added", function ( data ){
	var snapshot = data.value();
	var msg = snapshot.memberName + ' has joined the group';
	messagesRef.push({
		sid: "",
		type:'',
		tstamp: new Date().toLocaleString(),
		fromName:"Admin",
		fromNumber:"",
		message:msg,
		fromCity:"",
		fromState:"",
		fromCountry:"",
		groupNumber:snapshot.groupNumber
	});
});

groupRef.on("removed", function ( data ){
	var snapshot = data.value();
	var msg = snapshot.memberName + ' has left the group';
	//	send broadcast that a group member has been removed
	messagesRef.push({
		sid: "",
		type:'',
		tstamp: new Date().toLocaleString(),
		fromName:"Admin",
		fromNumber:"",
		message:msg,
		fromCity:"",
		fromState:"",
		fromCountry:"",
		groupNumber:snapshot.groupNumber
	});

});

//	broadcast a message to the group
function sendMessage( group_number, from_name, from_number, message ){
	var msg = from_name + ": " + message;
	groupRef.where( {"memberNumber":{"$not":from_number}} ).limit(100).on( "value", function ( data ){
		if( data.count() ){
			data.forEach( function( snapshot ){
				var member = snapshot.value();
				client.sendMessage( {
					to:member.memberNumber,
					from:group_number,
					body:msg
				}, function( err, data ) {
				});
			});
		}
	});
}


// backend routes =========================================================

//	listen for incoming sms messages
app.post('/message', function (request, response) {
	groupRef.where( {"memberNumber":request.param('From')} ).limit(1).on( "value", function ( data ){
		if( data.count() ){
			data.forEach( function( snapshot ){
				var member = snapshot.value();
				messagesRef.push({
					sid: request.param('MessageSid'),
					type:'text',
					tstamp: new Date().toLocaleString(),
					fromName:member.memberName,
					fromNumber:request.param('From'),
					message:request.param('Body'),
					fromCity:request.param('FromCity'),
					fromState:request.param('FromState'),
					fromCountry:request.param('FromCountry'),
					groupNumber:request.param('To')
				});
			});
		}
	});
	var resp = new twilio.TwimlResponse();
	resp.message('Message received.');
	response.writeHead(200, {
		'Content-Type':'text/xml'
	});
	response.end(resp.toString());
});

// frontend routes =========================================================

// Create basic auth middleware used to authenticate all admin requests
var auth = express.basicAuth(config.un, config.pw);

// route to handle all frontend requests, with a password to protect unauthorized access....
app.get('*', auth, function(req, res) {
	res.render('index', {
		api_key:config.flybase.api_key,
		app_name:config.flybase.app_name,
		group_number:config.twilio.from_number
	});
});

var server = app.listen(port, function() {
	console.log('Listening on port %d', server.address().port);
});
