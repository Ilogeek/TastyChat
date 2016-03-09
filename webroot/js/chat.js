$(document).ready(function() {
	var socket = io();
	var name;
	var shiftPressed = false;
	var SHIFT_KEY_CODE = 16;
	var ENTER_KEY_CODE = 13;
	var UP_ARROW_KEY_CODE = 38;
	var localHistory = [];
	var indexLocalHistory = 1;
	var LOCAL_HISTORY_MAX_LENGTH = 20;
	var typingEventOn = false;
	var timer;
	var playNotif = false;
	var playSound = false;
	var messageArea = $("#msg");
	var typingZone = $('#typing-zone');
	var userListArea = $("#user-list");	
	var lc = LC.init(document.getElementsByClassName('literally')[0], {
		imageURLPrefix: '/img/literallycanvas', 
		backgroundColor: 'white'
	});
	var drawingArea = $('#drawingArea');
	var firstSidebarArea = $("#firstSidebar");
	var praisenessLevelSpan = firstSidebarArea.find("#praiseness-level");
	var playNotifInput = $("#playNotif");
	var playSoundInput = $("#playSound");
	var secondSidebarArea = $("#secondSidebar");
	var amitieListArea = secondSidebarArea.find("#amitie-list");
	var smileyArea = firstSidebarArea.find("#smileyArea");

	socket.on("connect", function() {
		messageArea.html("");
		if(Cookies.get("name") !== undefined && Cookies.get("name") !== 'null') {
			name = Cookies.get("name");
		}
		else {
			name = prompt('Pseudo :')
		}
		socket.emit("joinserver", name);
	});

	socket.on("validateName", function(validatedName) {
		Cookies.set("name", validatedName);
		name = validatedName;
	});

	socket.on("changeName", function(name) {
		name = prompt("Ce pseudo est déjà pris : ", name);
		socket.emit("joinserver", name);
	});

	socket.on("serverNotification", function(data) {
		addServerNotification(data);
	});

	socket.on("historique", function(messages) {
		for (var i = 0; i < messages.length; i++) {
			addMessage(messages[i]);
		}	
	});

	typingZone.keydown(function(e) {
	    if (e.keyCode === SHIFT_KEY_CODE) {
	        shiftPressed = true;
	    }
	    if (e.keyCode === ENTER_KEY_CODE) {
	        if (!shiftPressed) {
	            e.preventDefault();
	        }
	    }
	}).keyup(function(e) {	    	    
	    var text;
	    if (e.keyCode === UP_ARROW_KEY_CODE) {
	    	text = $(this).val().replace(/\n/g, "[br]");
	        if (text.length === 0 || localHistory.indexOf(text) !== -1) {
	            $(this).val(localHistory[localHistory.length - indexLocalHistory]);
	            indexLocalHistory++;
	        }
	    }
	    else {
	        indexLocalHistory = 1;
	        if (e.keyCode === SHIFT_KEY_CODE) {
		        shiftPressed = false;
		    }
	        else if (e.keyCode === ENTER_KEY_CODE) {
		        if (!shiftPressed) {
		        	text = $(this).val().replace(/\n/g, "[br]");
		            if (text.length > 0) {
		                localHistory.push(text);
		                if (localHistory.length === LOCAL_HISTORY_MAX_LENGTH) {
		                    localHistory.shift();
		                }
		                if (text[0] === "!") {
		                    socket.emit('command', text);
		                }
		                else {
		                    socket.emit('usermessage', text);
		                }
		            }
		            $(this).val("");
		        }		        
		    }
		    text = $(this).val();
	    	if (text !== "" && text.length > 3) {
		        if (text.indexOf('!') !== 0 && !typingEventOn) {
		            socket.emit('typing', true);
		            typingEventOn = true;
		        }
		    }
		    else if (typingEventOn) {
		        socket.emit('typing', false);
		        typingEventOn = false;
		    }	    
	    }  
	});	

	socket.on('usermessage', addMessage);

	socket.on('updatePeople', function(data) {
		userListArea.html("");
		$.each(data, function(a, obj) {
			var name = obj.name;
			if(obj.status === 'away') {
				name = '[ABS] ' + name;
			}

			$("<div class='user-name " + obj.name.toLowerCase() + "'>" + name + "</div>").appendTo(userListArea);
		});
	});

	socket.on('typing', function(data) {
		var typingNotifications = $("#typing-notifications");
		if(data.typing && typingNotifications.children("." + data.name).length === 0) {
			$("<span class='" + data.name + "'>" + data.name + " is typing</span>").appendTo(typingNotifications);
		} else if (!data.typing && typingNotifications.children("." + data.name).length >= 0) {
			typingNotifications.children("." + data.name).remove();
		}
	});

	socket.on('incomingPrivateMessage', function(data) {
		var isScrolled = isMessageAreaScrolledToBottom();

		data.date = new Date(data.date);
		var message = $("<div class='message col-md-11'><span class='sender-name'>Message privé de "+ data.from +" : </span><span class='message-content'>"+ data.message +"</span></div>");
		var date = $("<div class='date col-md-1'>"+ data.date.toTimeString().substr(0,5) +"</div>");
		var messageRow = $("<div class='messageRow "+ data.from.toLowerCase() +"'></div>");

		message.appendTo(messageRow);
		date.appendTo(messageRow);
		messageRow.appendTo(messageArea);

		if(isScrolled) {
			scrollMessageAreaToBottom();
		}
	});

	socket.on('privateMessageSent', function(data) {
		var isScrolled = isMessageAreaScrolledToBottom();

		data.date = new Date(data.date);
		var message = $("<div class='message col-md-11'><span class='sender-name'>Message privé à "+ data.to +" : </span><span class='message-content'>"+ data.message +"</span></div>");
		var date = $("<div class='date col-md-1'>"+ data.date.toTimeString().substr(0,5) +"</div>");
		var messageRow = $("<div class='messageRow "+ data.to.toLowerCase() +"'></div>");

		message.appendTo(messageRow);
		date.appendTo(messageRow);
		messageRow.appendTo(messageArea);

		if(isScrolled) {
			scrollMessageAreaToBottom();
		}
	});

	messageArea.on("dblclick", ".messageRow .date", function (){
		var messageRow = $(this).parent();
		var messageId = messageRow.attr('id');
		var messageToEdit = messageArea.find("#"+ messageId +" .message-content");
		if(messageRow.hasClass(name.toLowerCase())) {
		    var input = $("<input class='messageInEditing' type='text' value=''/>");
		    input.val(messageToEdit.text());
		    messageToEdit.html(input);
		} else {
			var messageFrom = messageRow.find(".sender-name").text();
			if(typingZone.val() === "") {
				var messageId = messageRow.attr('id');
		    	var messageToEdit = messageArea.find("#"+ messageId +" .message-content");
				typingZone.val(messageFrom + '"'+ messageToEdit.text() + '"');
				focusToEndOfInput('typing-zone');
			} else {
				typingZone.val(typingZone.val() + ' "'+ messageToEdit.text() + '" ');
				focusToEndOfInput('typing-zone');
			}
		}
	});

	messageArea.on("keyup", ".messageRow .messageInEditing", function (e){
		if(e.keyCode === ENTER_KEY_CODE) {
			var messageId = $(this).parent().parent().parent().attr('id');
			var messageToEdit = messageArea.find("#"+ messageId +" .message-content");
			var newMessage = $(this).val();
			socket.emit("updateusermessage", {id: messageId, message: newMessage});
		}
	});

	socket.on("updatedmessage", function(data) {
		$("#" + data.id +" .message-content").html(data.message);
	});

	messageArea.on("click", ".sender-name", function (){
		if(typingZone.val() === "") {
			typingZone.val("!w " + $(this).text().replace(" :", ""));
			focusToEndOfInput('typing-zone');
		}
	});

	$(document).on("click", ".user-name", function (){
		if(typingZone.val() === "") {
			typingZone.val("!w " + $(this).text() + " ");
			focusToEndOfInput('typing-zone');
		}
	});

	$('#colorpicker').colorpicker().on('changeColor.colorpicker', function(e){
		socket.emit('setcolor', $(this).val());
	});

	socket.on("color", function(data) {
		$("."+data.name.toLowerCase()).css('color', data.color);
	});

	socket.on("praisenesslevel", function(data) {
		praisenessLevelSpan.text(data);
	});

	socket.on("updateamitiescore", function(data) {
		amitieListArea.html("");
		$.each(data, function(a, obj) {
			$("<fieldset class='amitie " + obj._id.name.toLowerCase() + "'><legend>" + obj._id.name.capitalizeFirstLetter() + " : " + obj.totalPoints  + "</legend><div class='detail'></div></div>").appendTo(amitieListArea);
		});		
	});

	socket.on("updateamitielist", function(data) {
		var detailArea = amitieListArea.find('.amitie.'+data[0].name.toLowerCase()+' .detail');
		detailArea.html("");
		$.each(data, function(a, obj) {
			$("<div>"+obj.from+" : "+obj.points+" : "+obj.raison+"</div>").appendTo(detailArea);
		});
	});

	drawingArea.hide();

	drawingArea.on("click", "#exportImage", function (e){
		e.preventDefault();
		socket.emit('canvas', lc.getSVGString());
	});

	socket.on("canvas", addMessage);

	firstSidebarArea.on("change", "#displayLiterally", function (){
		($(this).is(':checked')) ? drawingArea.show() : drawingArea.hide();		
	});
	
	if(Cookies.get("playNotif") !== undefined && Cookies.get("playNotif") !== 'null') {
		playNotif = Cookies.get("playNotif") === 'true';
		playNotifInput.is(':checked') !== playNotif ? playNotifInput.prop('checked', 'checked') : playNotifInput.removeProp('checked');
	}

	firstSidebarArea.on("change", "#playNotif", function (){
		playNotif = !playNotif;
		Cookies.set('playNotif', playNotif);
	});

	if(Cookies.get("playSound") !== undefined && Cookies.get("playSound") !== 'null') {
		playSound = Cookies.get("playSound") === 'true';
		playSoundInput.is(':checked') !== playSound ? playSoundInput.prop('checked', 'checked') : playSoundInput.removeProp('checked');
	}

	firstSidebarArea.on("change", "#playSound", function (){
		playSound = !playSound;
		Cookies.set('playSound', playSound);
	});

	socket.on('playsound', function(data) {
		$.playSound('/sounds/'+data);
	});

	smileyArea.on('click', 'img', function() {
		typingZone.val(typingZone.val() + $(this).attr('title') + " ");
		focusToEndOfInput('typing-zone');
	});

	messageArea.on('click', 'img.cropped', function(){
	    ($(this).css('height') === '150px') ? $(this).addClass('nocropped') : $(this).removeClass('nocropped');    
	});

	function addMessage(data) {
		var isScrolled = isMessageAreaScrolledToBottom();

		data.date = new Date(data.date);
		var message = $("<div class='message col-md-11'><span class='sender-name'>"+ data.name +" : </span><span class='message-content'>"+ parseText(data.message) +"</span></div>");
		var date = $("<div class='date col-md-1' title='"+ data.date.toLocaleString() +"'>"+ data.date.toTimeString().substr(0,5) +"</div>");
		var messageRow = $("<div id='"+ data._id +"' class='messageRow "+ data.name.toLowerCase() +"'></div>");

		message.appendTo(messageRow);
		date.appendTo(messageRow);
		messageRow.appendTo(messageArea);

		if(isScrolled) {
			scrollMessageAreaToBottom();
		}

		if(playNotif && !vis()) {
			$.playSound('/sounds/notify');
		}
	}

	function isMessageAreaScrolledToBottom() {
		return messageArea.get(0).scrollTop === (messageArea.get(0).scrollHeight - messageArea.get(0).offsetHeight) + 1;
	}

	function scrollMessageAreaToBottom() {
		messageArea.get(0).scrollTop = (messageArea.get(0).scrollHeight - messageArea.get(0).offsetHeight) + 1;
	}

	function focusToEndOfInput(id){
	    var inputField = document.getElementById(id);
	    if (inputField != null && inputField.value.length != 0){
	        if (inputField.createTextRange){
	            var FieldRange = inputField.createTextRange();
	            FieldRange.moveStart('character',inputField.value.length);
	            FieldRange.collapse();
	            FieldRange.select();
	        }else if (inputField.selectionStart || inputField.selectionStart == '0') {
	            var elemLen = inputField.value.length;
	            inputField.selectionStart = elemLen;
	            inputField.selectionEnd = elemLen;
	            inputField.focus();
	        }
	    }else{
	        inputField.focus();
	    }
	}

	function addServerNotification(data) {
		var isScrolled = isMessageAreaScrolledToBottom();

		data.date = new Date(data.date);
		var message = $("<div class='message col-md-11'>"+ data.message +"</div>");
		var date = $("<div class='date col-md-1' title='"+ data.date.toLocaleString() +"'>"+ data.date.toTimeString().substr(0,5) +"</div>");
		var messageRow = $("<div class='messageRow serverNotification'></div>");

		message.appendTo(messageRow);
		date.appendTo(messageRow);
		messageRow.appendTo(messageArea);

		if(isScrolled) {
			scrollMessageAreaToBottom();
		}
	}

	String.prototype.capitalizeFirstLetter = function() {
	    return this.charAt(0).toUpperCase() + this.slice(1);
	};

	var vis = (function() {
	    var stateKey,
	            eventKey,
	            keys = {
	                hidden: "visibilitychange",
	                webkitHidden: "webkitvisibilitychange",
	                mozHidden: "mozvisibilitychange",
	                msHidden: "msvisibilitychange"
	            };
	    for (stateKey in keys) {
	        if (stateKey in document) {
	            eventKey = keys[stateKey];
	            break;
	        }
	    }
	    return function(c) {
	        if (c)
	            document.addEventListener(eventKey, c);
	        return !document[stateKey];
	    }
	})();

	function dontEvenBlink() {		
	    if (vis()) {
	        document.title = 'HREF DANS UN';
	        clearInterval(timer);
	        timer = "";
	    } else {
	        if (timer <= 0) {
	            //console.log('start '+timer);
	            timer = setInterval(function() {
	                document.title = document.title === "HREF DANS UN" ? "TITLE" : "HREF DANS UN";
	            }, 1000);
	        }
	    }
	}

	setInterval(function() {
	    if (vis()) {
	        document.title = 'HREF DANS UN';
	        clearInterval(timer);
	    }
	}, 1000);
	messageArea.bind("DOMSubtreeModified", dontEvenBlink);

	function parseText(data) {
		data = data.replace(/\/\/([^\/]*)\/\//gi, "<em>$1</em>");
		data = data.replace(/\*\*([^\*]*)\*\*/gi, "<strong>$1</strong>");
		data = data.replace(/\_\_([^\_]*)\_\_/gi, "<u>$1</u>");
		data = data.replace(/(\b(?:https?|ftp):\/\/[a-z0-9-+&@$#\/%?=~_|!:,.;]*[a-z0-9-+&@$#\/%=~_|])/gim, function(str) {
			if (str.match(/\.(png|jpg|jpeg|gif)$/i)) {
				return('<img class="cropped" src="' + str + '"/>');
			} else {
				if(str.match(/youtu\.?be/)) {
					var url_youtube = str.replace('https://www.youtube.com/watch?v=', '');
					url_youtube = url_youtube.replace('&feature=youtu.be', '');
					return('<iframe width="200" height="113" src="https://www.youtube.com/embed/' + url_youtube + '" frameborder="0" allowfullscreen></iframe>')
				} else {
					return('<a href="' + str + '" target="_blank">' + str + '</a>');
				}
			}
		});
		data = data.replace(/\[br\]/gi, '<br/>');
		data = data.replace(/:\)$/gi, ' <img src="/img/emotes/smile.png"/> ');
		data = data.replace(/:\)[^)]+/gi, ' <img src="/img/emotes/smile.png"/> ');
		data = data.replace(/&lt;3/gi, ' <img src="/img/emotes/heart.png"/> ');
		data = data.replace(/&lt;poil3/gi, ' <img src="/img/emotes/heartpoilu.png"/> ');
		data = data.replace(/&lt;poilu3/gi, ' <img src="/img/emotes/heartpoilu.png"/> ');
		data = data.replace(/poulpy/gi, ' <img src="/img/emotes/poulpy.png"/> ');
		data = data.replace(/ohyou/gi, ' <img class="cropped" src="/img/emotes/Oh_you.jpg"/> ');
		data = data.replace(/biblethump/gi, ' <img src="/img/emotes/biblethump.png"/> ');
		data = data.replace(/okcool/gi, ' <img src="/img/emotes/okcool.png"/> ');
		data = data.replace(/praiseit/gi, ' ༼ つ ◕_◕ ༽つ ');
		data = data.replace(/giff/gi, ' ༼ つ ◕_◕ ༽つ ');
		data = data.replace(/lenny/gi, ' ( ͡° ͜ʖ ͡° ) ');
		data = data.replace(/(fa(-\w+)+)/gi, '<i class="fa $1"></i>');
		data = data.replace(/\(TM\)/gi, '<i class="fa fa-trademark"></i>');
		data = data.replace(/@u@/gi, '<i class="fa fa-tripadvisor fa-5x"></i>');
		data = data.replace(/permis/gi, 'space rock opera');
		data = data.replace(/ (\/r\/[^ ]+)/gi, ' <a href="https://www.reddit.com$1">$1</a>');
		return data;
	}
});