var groupManager = function(api_key, app_name, group_number) {
//	store the group number
	this.group_number = group_number;
//	reference to our messages collection...
	this.messagesRef = new Flybase(api_key, app_name, "messages");

//	reference to our group collection...
	this.groupRef = new Flybase(api_key, app_name, "groups");

	this.group_members = [];
};
groupManager.prototype.start = function(){
//	list group members if any
	var _this = this;

	this.groupRef.on("value", function( data ){
		if( data.count() ){
			data.forEach( function( snapshot ){
				var member = snapshot.value();
				_this.group_members[member._id] = member;
			});
		}
		_this.displayGroup();
	});
//	listen for new members being added
	this.groupRef.on("added", function( snapshot ){
		var member = snapshot.value();
		_this.group_members[member._id] = member;
		_this.displayGroup();
	});

//	save new group member to our app
	$("#group_form").submit( function(e){
		e.preventDefault();
		var member = {
			'groupNumber': _this.group_number,
			'memberName': $("#name").val(),
			'memberNumber': clean_phone( $("#phone").val() )
		};

console.log( member );

		_this.groupRef.push( member );
		$("#name").val('');
		$("#phone").val('');
		return false;
	});

//	listen for members being removed
	$('div').on('click','a.delete', function(e){
		var _id = e.target.id;
		_this.groupRef.remove(_id);
		return false;
	});

	this.groupRef.on("removed", function( snapshot ){
		var member = snapshot.value();
		_this.group_members[member._id] = undefined;
		_this.displayGroup();
	});

//	list any existing chat message
	this.messagesRef.on('value', function (data) {
		if( data.count() ){
			data.forEach( function(message){
				_this.displayChatMessage(message.value() );
			});
		}
	});
//	listen for incoming chat messages
	this.messagesRef.on('added', function (data) {
		var message = data.value();
		_this.displayChatMessage( message );
	});

//	listen for outgoing chat messages
	$('#msg_form').submit( function(e){
		e.preventDefault();
		var message = {
				"tstamp": new Date().toLocaleString(),
				"fromName": "Admin",
				"fromNumber": "",
				"message": $('#messageInput').val(),
				"fromCity": "",
				"fromState": "",
				"fromCountry": "",
				"groupNumber": _this.group_number
		}
		_this.messagesRef.push( message );
		$('#messageInput').val('');
		return false;
	});
};

//	Display group members
groupManager.prototype.displayGroup = function(){
	$('#group_wrapper').html('');
	for (var i in this.group_members ) {
		var member = this.group_members[i];
		if( member !== undefined ){
			var html = '';
			html = '<span>'+member.memberName+' ( ' + member.memberNumber + ' )</span> <a href="#delete" class="delete" id="' + member._id+'">[remove]</a>';
			$('<div/>').prepend( html ).appendTo($('#group_wrapper'));
		}
	}
};

//	Display chat messages
groupManager.prototype.displayChatMessage = function( message ){
	var _this = this;
	$('<li/>')
		.attr("id",message._id)
		.text(message.message)
		.prepend(
			$("<strong class='example-chat-username' />").text(message.fromName+': ')
			).appendTo( $('#messagesDiv') );
	$('#messagesDiv')[0].scrollTop = $('#messagesDiv')[0].scrollHeight;
};
