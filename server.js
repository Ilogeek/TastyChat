var express = require('express'), app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var npid = require("npid");
var _ = require('underscore')._;
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var Entities = require('html-entities').XmlEntities;
var entities = new Entities();
/*var auth = require('http-auth');
var basic = auth.basic({
	realm: "Tasty Realm",
	file: __dirname + "/.htpasswd"
});*/
var unirest = require('unirest');

var databaseUrl = 'mongodb://localhost:27017/db';
var people = {};
var sockets = [];

/* Store process-id (as priviledged user) */
try {
    npid.create('tastychat.pid', true);
} catch (err) {
    console.log(err);
    //process.exit(1);
}

//app.use(auth.connect(basic));

app.use("/", express.static(__dirname + '/webroot/'));
app.use("/lib", express.static(__dirname + '/build/'));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/webroot/index.html');
});

http.listen(3000, function(){
	console.log('listening on *:3000');
	addChatHistory({name: 'Server', message: "Le serveur a reboot"});
});

function addChatHistory(message, callback) {
	message.date = new Date();
	MongoClient.connect(databaseUrl, function (err, db) {
	  if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
	    var collection = db.collection('message');

	    collection.insert([message], function (err, result) {
			if (err) {
				console.log(err);
			} else {
				if(callback){
					callback(result);
				}
			}
			db.close();
		});
	  }
	});
}

function getChatHistory(callback) {
	MongoClient.connect(databaseUrl, function (err, db) {
	  if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
	    var collection = db.collection('message');
	   	collection.find().toArray(function (err, result) {
			if (err) {
				console.log(err);
			} else {
				callback(result);
			} 
			db.close();	      
	    });	    	    
	  }
	});
}

function updateChatHistory(data, callback) {
	MongoClient.connect(databaseUrl, function (err, db) {
	  if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
	    var collection = db.collection('message');
   		collection.update({'_id': new mongodb.ObjectID(data.id), 'socketid': data.socketid}, {$set : {'message' : data.message}}, function (err, result) {
				if (err) {
					console.log(err);
				} else {
					callback();
				}
				db.close();
		});
	  }
	});
}

function cleanChatHistory() {
	MongoClient.connect(databaseUrl, function (err, db) {
	  if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
	    var collection = db.collection('message');
	    collection.remove();	    
		db.close();
	  }
	});
}

function praiseitCounter(callback) {
	MongoClient.connect(databaseUrl, function (err, db) {
	  if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
	    var collection = db.collection('message');
	   	collection.count({"message": /praiseit/}, function (err, result) {
			if (err) {
				console.log(err);
			} else {
				callback(result);
			} 
			db.close();	      
	    });	    	    
	  }
	});
}

function addFriendship(friendship, callback) {
	friendship.date = new Date();
	MongoClient.connect(databaseUrl, function (err, db) {
	  if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
	    var collection = db.collection('friendship');

	    collection.insert([friendship], function (err, result) {
			if (err) {
				console.log(err);
			} else {
				if(callback){
					callback(result);
				}
			}
			db.close();
		});
	  }
	});
}

function getFriendship(name, limit, callback) {
	MongoClient.connect(databaseUrl, function (err, db) {
	  if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
	    var collection = db.collection('friendship');
	   	collection.find({name: name}).limit(limit).toArray(function (err, result) {
			if (err) {
				console.log(err);
			} else {
				callback(result);
			} 
			db.close();	      
	    });	    	    
	  }
	});
}

function getFriendShipVictims(callback) {
	MongoClient.connect(databaseUrl, function (err, db) {
	  if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
	    var collection = db.collection('friendship');	    
	   	collection.aggregate([
				{$group : {
					_id: {name: "$name"},
					totalPoints : {$sum : "$points"}
				}}
			]).toArray(function (err, result) {
				if (err) {
					console.log(err);
				} else {
					callback(result);
				}
				db.close();
	    });	    
	  }
	});
}

function deleteFriendship(name) {
	MongoClient.connect(databaseUrl, function (err, db) {
	  if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
	    var collection = db.collection('friendship');
	    if(name !== 'all') {
		 	collection.remove({name: name});
		} else {
			collection.remove();
		}
		db.close();	      
	  }
	});
}

function purge(s) {
	io.emit("serverNotification", {message : people[s.id].name + " a quitté le canal", date : new Date()});
	io.emit("typing", {name : people[s.id].name, typing : false});
	delete people[s.id];
	io.emit("updatePeople", people);
	var o = _.findWhere(sockets, {'id': s.id});
	sockets = _.without(sockets, o);	
}

function validateName(name) {
	var valid = true
	var validNameRegex = /^([A-Za-z])*$/;
	if(validNameRegex.test(name)) {	
		_.find(people, function(key, value) {
			if (key.name.toLowerCase() === name.toLowerCase()) {
				return valid = false;
			}
		});
		return valid;
	}
	else {
		return false;
	}
}

function getSocketIdByName(name) {
	var result = false;
	_.find(people, function(key, value) {
		if (key.name.toLowerCase() === name.toLowerCase()) {
			return result = value;
		}
	});
	return result;
}

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function randHoroscope(times) {
	times = parseInt(times);
	if(isNaN(times) || times > 20) {
		times = 3;
	}
	var result = [];
	for(var i = 0; i < times; i++) {
		result.push(Math.floor(Math.random() * 3));
	}
	return result;
}

io.on('connection', function(socket){
  	
  	socket.on("joinserver", function(name) {
  		console.log(name + ' joined at '+ new Date());
  		if(name) {
  			if(validateName(name)) {
  				name = name.capitalizeFirstLetter();
  				people[socket.id] = {"name" : name, status : 'here'};
				socket.emit("validateName", name);				
				io.emit("updatePeople", people);
				sockets.push(socket);
				getChatHistory(function(result) {
					socket.emit("historique", result);
					socket.emit("serverNotification", {message : people[socket.id].name + " a rejoint le canal", date : new Date()});
				});
				praiseitCounter(function(result) {
					socket.emit("praisenesslevel", result);
				});
				getFriendShipVictims(function(result) {
					socket.emit("updateamitiescore", result);
					_.each(result, function(data) {
						getFriendship(data._id.name, 2, function(friendship) {
							socket.emit("updateamitielist", friendship);
						});
					});
				});
				socket.broadcast.emit("serverNotification", {message : people[socket.id].name + " a rejoint le canal", date : new Date()});
  			}
  			else {
  				socket.emit("changeName", "EthanTremblay");
  			}  			
		}
		else {
			socket.emit("changeName", "jesuisungrosgitan");
		}
	});

	socket.on("disconnect", function() {
		if (typeof people[socket.id] !== "undefined") { //this handles the refresh of the name screen
			purge(socket);
		}
	});

	socket.on("usermessage", function(data) {
		var message = {name : people[socket.id].name, message : entities.encodeNonUTF(data), socketid : socket.id};
		addChatHistory(message, function(result) {
			message.id = result.ops[0]._id;
			delete message.socketid;
			io.sockets.emit("usermessage", message);
			praiseitCounter(function(result) {
				io.sockets.emit("praisenesslevel", result);
			});
		});
	});

	socket.on("updateusermessage", function(data) {
		var message = {id: data.id, message : entities.encodeNonUTF(data.message), socketid : socket.id};
		updateChatHistory(message, function() {
			delete message.socketid;
			io.sockets.emit("updatedmessage", message);
			praiseitCounter(function(result) {
				io.sockets.emit("praisenesslevel", result);
			});
		});
	})

	socket.on("setcolor", function(color) {
		io.sockets.emit("color", {name: people[socket.id].name, color: color});
	});

	socket.on("command", function(data) {
		data = entities.encodeNonUTF(data).trim().substr(1).toLowerCase();
		var argv = data.split(" ");
		var argc = argv.length;
		if(argc >= 0) {
			var commandName = argv[0];
			switch(commandName) {
				case 'afk': case 'brb': 
					var message;
					argc >= 2 ? message = people[socket.id].name + " est absent (" + argv.slice(1).join(" ") + ")" : message = people[socket.id].name + " est absent";
					if(people[socket.id].status === 'here') {
						people[socket.id].status = 'away';
						io.emit("updatePeople", people);
						io.emit("serverNotification", {message : message, date : new Date()});
					}
					break;
				case 'ahahno':
					io.emit('playsound', 'ahahno');
					io.emit("serverNotification", {message : 'ahah no', date : new Date()});
					break;
				case 'amitie':
					if(argc === 1 || argc === 2) {
						if(argc === 1) {
							getFriendShipVictims(function(result) {								
								_.each(result, function(data) {
									socket.emit("serverNotification", {message : data._id.name + " a "+ data.totalPoints + " points d'amitié", date : new Date()});
									getFriendship(data._id.name, 0, function(friendship) {
										_.each(friendship, function(dataDetail) {											
											socket.emit("serverNotification", {message : dataDetail.name + " : " + dataDetail.points + " par "+ dataDetail.from + " : " + dataDetail.raison, date : new Date()});
										});
									});
								});
							});
						} else {
							getFriendship(argv[1], 0, function(friendship) {
								_.each(friendship, function(dataDetail) {											
									socket.emit("serverNotification", {message : dataDetail.name + " : " + dataDetail.points + " par "+ dataDetail.from + " : " + dataDetail.raison, date : new Date()});
								});
							});
						}									
					}
					else if (argc >= 4) {
						var to = argv[1];
						var points = parseInt(argv[2]);
						if(!isNaN(points)) {
							var raison = argv.slice(3).join(" ");
							addFriendship({name: to, from: people[socket.id].name, points: points, raison: raison}, function() {
								getFriendShipVictims(function(result) {
									socket.emit("updateamitiescore", result);
									_.each(result, function(data) {
										getFriendship(data._id.name, 2, function(friendship) {
											socket.emit("updateamitielist", friendship);
										});
									});
								});
							});
						}
					}
					break;
				case 'cb':
					if(people[socket.id].status === 'away') {
						people[socket.id].status = 'here';
						io.emit("updatePeople", people);
						io.emit("serverNotification", {message : people[socket.id].name + " est revenu", date : new Date()});
					}
					break;
				case 'clap':
					var message;
					argc >= 2 ? message = people[socket.id].name + " applaudit chaleureusement " + argv.slice(1).join(" ") + " pour sa vivacité d'esprit" : message = people[socket.id].name + " tente d'applaudir mais rate ses mains";					
					io.emit("serverNotification", {message : message, date : new Date()});
					break;
				case 'clear':
					if(argc === 1) {
						cleanChatHistory();
					} else {
						switch(argv[1]) {
							case 'amitie':
								if(argc === 3) {
									deleteFriendship(argv[2]);
								} else {
									deleteFriendship('all');
								}
								getFriendShipVictims(function(result) {
									socket.emit("updateamitiescore", result);
									_.each(result, function(data) {
										getFriendship(data._id.name, 2, function(friendship) {
											socket.emit("updateamitielist", friendship);
										});
									});
								});
								break;
							default:
								cleanChatHistory();
								break;
						}
					}
					break;
				case 'deni':
					if(argc === 2) {
						var target = argv[1];
						io.sockets.emit("color", {name: target, color: "#fff"});
						io.emit("serverNotification", {message : people[socket.id].name + " a mis " + target + " dans le tunnel du déni", date : new Date()});
					}
					break;
				case 'horoscope':
					var horoscope;
					if(argc === 1) {
						horoscope = randHoroscope(3);
					}
					else {
						horoscope = randHoroscope(argv[1]);
					}
					_.each(horoscope, function(item) {
						switch(item) {
							case 0:
								io.emit("serverNotification", {message : people[socket.id].name + " GOT LOLREKT", date : new Date()});
								break;
							case 1:
								io.emit("serverNotification", {message : people[socket.id].name + " GOT MEH", date : new Date()});
								break;
							case 2:
								io.emit("serverNotification", {message : people[socket.id].name + " GOT TEH JACKPOT", date : new Date()});
								break;
							default:
								break;
						}
					});
					break;
				case 'me': case 'action':
					var message;
					argc >= 2 ? message = people[socket.id].name + " " + argv.slice(1).join(" ") : message = people[socket.id].name + " bave sur son clavier";
					io.emit("serverNotification", {message : message, date : new Date()});
					break;
				case 'nick':
					if(argc >= 2) {
						var name = argv[1];
						var oldName = people[socket.id].name;
						if(name && name != oldName) {
				  			if(validateName(name)) {
				  				name = name.capitalizeFirstLetter();
				  				people[socket.id] = {"name" : name};
								socket.emit("validateName", name);				
								io.emit("updatePeople", people);						
								io.emit("serverNotification", {message : oldName + " a changé son nom en "+ name, date : new Date()});
				  			}			  			
				  			else {
				  				socket.emit("serverNotification", {message : "Ce nom est déjà pris", date : new Date()});
				  			}  			
						}
					}
					break;
				case 'ohnoes':
					io.emit('playsound', 'ohnoes');
					var message;
					argc >= 2 ? message = "OH NOES, " + argv.slice(1).join(" ").toUpperCase() + " :(" : message = "OH NOES :(";
					io.emit("serverNotification", {message : message, date : new Date()});
					break;				
				case 'praise':
					var message;
					argc >= 2 ? message = "༼ つ ◕_◕ ༽つ PRAISE  " + argv.slice(1).join(" ").toUpperCase() + " ༼ つ ◕_◕ ༽つ" : message = "༼ つ ◕_◕ ༽つ PRAISE THE CHAT ༼ つ ◕_◕ ༽つ";
					io.emit("serverNotification", {message : message, date : new Date()});
					break;
				case 'q': case 'bloodomen':
					var request = argv.slice(1).join(" ")
					unirest.get('http://yesno.wtf/api')
						.headers({'Accept': 'application/json'})
						.end(function(response) {
							var yesnoormaybe = response.body['answer'];
							var message;
							argc >= 2 ? message = people[socket.id].name.toUpperCase() + ' ASKED "' + request + '"" TEH ORACLE IZ RESPOND ' + yesnoormaybe.toUpperCase() : message = "TEH ORACLE IZ RESPOND " + yesnoormaybe.toUpperCase() +" TO " + people[socket.id].name.toUpperCase();
							io.emit("serverNotification", {message : message, date : new Date()});
						});
					break;				
				case 'therock':
					socket.emit('playsound', 'smell');
					io.emit("serverNotification", {message : "DO YOU SMELL WHAT THE ROCK IS COOKING ?", date : new Date()});
					break;
				case 'w':
					if(argc > 2) {
						var message = argv.slice(2).join(" ");
						var targetSocketId = getSocketIdByName(argv[1]);
						if(targetSocketId && io.sockets.connected[targetSocketId]) {
							io.to(targetSocketId).emit('incomingPrivateMessage', {from : people[socket.id].name, message : message, date : new Date()});
							socket.emit("privateMessageSent", {to : argv[1], message : message, date : new Date()});
						}
					}
					break;
				default:
					io.emit("serverNotification", {message : people[socket.id].name + " a échoué à utiliser la commande " + commandName, date : new Date()});
					break;
			}
		}
		else {
			//!help
		}
	});

	socket.on("typing", function(data) {
		socket.broadcast.emit("typing", {name : people[socket.id].name, typing : data});
	});

	socket.on('canvas', function(data) {
		io.emit('canvas', {name : people[socket.id].name, message : data, date: new Date()});
	})
});