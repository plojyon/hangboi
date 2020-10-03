/************************
 * DISCORD HANGMAN BOT  *
 * 	    "HANGBOI"       *
 * **********************/
// Invite link:
// https://discordapp.com/oauth2/authorize?client_id=[BOT_ID]&scope=bot

// Syntax:
// `A` | O O O o o o o o o o o o
// \_ \_ \_ \_    R U \_ \_

// Use h!help to get a list of commands


const Discord = require('discord.js');
const bot = new Discord.Client();
const MAX_STRIKES = 10;

// FILE SYSTEM
var fs = require('fs');


words = ["hangboi crashed and didnt recover properly; please let me know about this"];

games = {};

pending = {};

stats = {};

alphabet = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

helpText = "**HANGBOI HELP** *(in DMs, the `h!` prefix may be ommited)*\n \* `h!new [strikes]` - start a new game (I'll ask you for a word in private)\n \* `h!random` - start a new game with a random word\n \* `h!help` - display help\n \* `h!statistics` - check statistics\n \* `h!source` - view source code\n \* `status` - (only if a game is running) checks the game status [does not require the `h!` prefix]";

source_code = "[error reading source]";

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


// load statistics
fs.readFile("./stats.json", function(err, data) {
	if (err) {
		console.log(err);
		return;
	};
	stats = JSON.parse(data);
	console.log("Stats loaded");
	console.log(stats);
});


// load own code
fs.readFile("./index.js", function(err, data) {
	if (err) {
		console.log(err);
		return;
	};

	source_code = data.toString().replace(/[BOT_ID]/g, "[BOT_ID]").replace(/[PRIVATE_KEY]/g, "[PRIVATE_KEY]");
	console.log("Source code loaded");
	
	fs.writeFile("./hangboi.js", source_code, function(err) {
		if (err) console.log(err);
		lastError = err;

		console.log("Source code rewritten");
	});
});




bot.on("message", function(message) {
	var msg = message.content.toUpperCase(); // case insensitive

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


	// "h!help" in guilds, or "help" in private
	if (msg === "H!HELP" || (msg === "HELP" && message.guild === null)) {
		message.channel.send(helpText);
		return;
	}
	// "h!statistics" in guilds, or "statistics in private
	if (msg === "H!STATISTICS" || (msg === "STATISTICS" && message.guild === null)) {
		message.channel.send(getStats());
		return;
	}
	if (msg === "H!SOURCE" || (msg === "SOURCE" && message.guild === null)) {
		message.channel.send("Hangboi source code.", {files: ["./hangboi.js"]});
		return;
	}


	/////////////////////////////////////////////
	// PRIVATE MESSAGES
	/////////////////////////////////////////////
	if (message.guild === null) {

		// if the user has a pending game being created, accept the input for that
		if (pending.hasOwnProperty(user)) {
			prop = pending[user]; // game proposition

			clearTimeout(prop.timeout); // don't tell the user "request timed out" (because it didnt)

			word = message.content.toUpperCase();
			game = newGame(prop.channel, "public",  word, prop.strikes); // create the game

			message.react("👌"); // react with :ok_hand:
			bot.channels.get(prop.channel).send("New game started by <@"+user+">!\n"+getStatus(game)); // notify the users
			if (stats.hasOwnProperty(word))
				stats[word].count++;
			else
				stats[word] = {"count": 1, "hung": []};

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


			delete pending[user]; // delete the proposition
			return; // ignore the input for anything else
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


		// request a new game (random) in a guild
		if (message.content.match(/^h!random( \d*)?/i) != null) { // message follows format "h!random <strikeCount> [mentions]"
			if (pending.hasOwnProperty(channel) || games.hasOwnProperty(channel)) {
				mesage.channel.send("A game already exists.");
				return;
			}

			args = message.content.split(" ");
			strikes = args[1];
			if (isNaN(strikes)) strikes = MAX_STRIKES;

			g = newGame(channel, "public", null, strikes);
			message.channel.send("New game started by <@"+user+">!\n"+getStatus(g));
		}

		// request a new game (custom) in a guild
		else if (message.content.match(/^h!new( \d*)?/i) != null) { // message follows format "h!new <strikeCount> [mentions]"

			if (pendingInChannel(channel)) {
				message.channel.send("You're already pending another game");
				return;
			}
			if (pending.hasOwnProperty(channel)) {
				message.channel.send("There's a game already pending in this channel. I guess I'm deleting that.");
				//return;
				delete pending[guild]
			}
			if (games.hasOwnProperty(channel)) {
				message.channel.send("There was already a game being played in this channel. *Not anymore*. The answer was **"+games[channel].word+"**");
				delete games[guild];
			}

			args = message.content.split(" ");
			strikes = args[1];
			if (isNaN(strikes)) strikes = MAX_STRIKES;

			message.author.send("Yo, what word do you want them to guess?");
			timeout = setTimeout(expire, 60*1000, user);

			pending[user] = {
				"strikes": strikes,
				"channel": channel,
				"timeout": timeout,
				"messageId": message.id
			}
			message.react("🕑"); // react with :clock-2:
			return;
		}


		// create a new game if a new user mentions the bot
		if (message.isMentioned(bot.user) && !games.hasOwnProperty(user)) {
			message.author.send("Hello! I'm Hangboi. I've already started a private game (here, in the DMs) for you, just start guessing.\n:bulb:Protip: you can start a new game by saying `new`, or check your game state with `status`. For more info, type `help`.");
			message.react("👋"); // react with :wave:
			return;
		}
	}



	currentGame = games[channel];
	if (!currentGame) return;

	// matches any single non-whitespace character (take a guess)
	if (message.content.match(/^\S$/i) != null) {
		message.channel.send(play(msg, currentGame, user));
	}
	// "status", prints game status
	else if (msg === "STATUS" || msg === "H!STATUS") {
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
	for (userId in pending) {
		if (pending[userId].channel == channel) return true;
	}
	return false;
}


// delete a user's request for inactivity (called from setTimeout)
function expire(user) {
	bot.users.get(user).send("Game timed out.");
	delete pending[user];
}



// perform a move "letter" on "game" (either reveal "letter" or return strike)
function play(letter, game, author) {
	// verify if it's a valid play
	if (game.letters.includes(letter)) return "You've already tried that one (check by using `status`)";
	if (!alphabet.includes(letter)) return ""; // invalid character

	// count the letter to prevent duplicate plays
	game.letters.push(letter);

	// if the word contains the letter, reveal it, otherwise shoot a strike
	if (game.word.indexOf(letter) != -1) {
		return reveal(letter, game);
	}
	else return strike(letter, game, author);
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
function strike(letter, game, author) {
	// Format:
	// `A` | O O O o o o o o o o
	game.strikes++;
	var resp = "`" + letter + "` |";
	for (var i = 0; i < game.strikes; i++) {
		resp = resp + " O";
	}
	for (var j = 0; j < game.maxStrikes-game.strikes; j++) {
		resp = resp + " o";
	}

	if (game.strikes >= game.maxStrikes) {
		resp = resp + "\n**GAME OVER**\n" + game.word + "\n\n";
		game.finished = true;

		if (stats.hasOwnProperty(word))
			stats[word].hung.push(author);

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
	game.maxStrikes = strikes || MAX_STRIKES;

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

// returns game statistics
function getStats() {
	// TODO: get mostHung, hungCount, wordList
	var mostHung = "489390925886521344"; // TODO
	var mostActive = "356393895216545803"; // TODO
	var hungCount = 1;
	var resp = "**== STATISTICS ==**\n";
	resp = resp + "TODO: add statistics\n\n"
	//resp = resp + " Most hung user: `" + bot.users.get(mostHung).username +"` (hung `"+hungCount+"` time(s))\n";
	//resp = resp + " Most active user: `" + bot.users.get(mostActive).username + "`\n";
	//resp = resp + " Most popular words: ```" + getPopWords() +"```\n\n";
	resp = resp + "Made with ❤️ by <@356393895216545803>\n";
	resp = resp + "Thank you for playing Hangboi!\n";
	return resp;
}

// gets a list of popular words
//function getPopWords() {
//	var resp = [""];
//	for (var name in stats) resp = resp+"\n ("+stats[name].count+") "+name;
//	return resp;
//}

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
	lastError = "Still saving...";
	fs.writeFile("./gameData.json", JSON.stringify(games, null, '\t'), function(err) {
		if (err) console.log(err);
		lastError = err;
	});

	fs.writeFile("./stats.json", JSON.stringify(stats, null, '\t'), function(err) {
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

bot.login("[PRIVATE_KEY]");
console.log("Hangboi remembers his password!"); // successfully performed login()



function random(min, max) {
	return Math.floor(Math.random() * (max-min)) + min;
}


String.prototype.replaceAt=function(index, replacement) {
	return this.substr(0, index) + replacement + this.substr(index + replacement.length);
}

function s(obj) {
	return JSON.stringify(obj, null, "\t");
}

function getGames() {
	return s(games);
}

function crash(code) {
	process.exit(code)
}


// made with <3 by @Jatan
// yon.ploj@gmail.com
