const express = require('express');
const mongoose = require('mongoose');
const app = express();
const session = require('express-session')
const mc = require("mongodb").MongoClient;
const ObjectID = require('mongodb').ObjectID;
const User = require('./UserSchema')
const Friend = require('./FriendSchema')
const Trade = require('./tradeSchema')
const crypto = require('crypto');
let db;


let generate_key = function() {
    return crypto.randomBytes(16).toString('base64');
};

app.use(express.urlencoded({extended: true}));
app.set("view engine", "pug");

app.use(session({ secret: 'some secret here'}))

app.use(express.urlencoded({extended: true}));

//All the gets for the webpage
app.get("/logout", logout);
app.get("/users", listUser);
app.get("/profile",profile);
app.get("/users/:username",auth, readuser);
app.get("/", mainPage);
app.get("/trade/:user2",trade);

//All the posting to receive data and update database information
app.post("/register", createNewUser);
app.post("/addfriend", addfriend);
app.post("/login", login);
app.post("/search", auth, searching);
app.post("/answerfriend", addorReject);
app.post("/trade", tradereq);
app.post("/tradeANSWER", tradeANSWER);

//Logging out
app.delete("/sessions", logout);


function mainPage(req,res,next){
  if (req.session.loggedin) {
      console.log("logged in");
      profile(req,res,next);
   }else {
      console.log("not logged in");
      res.render("index");
  }
}


/*
Main profile page, contains multiple functions and
database entries to obtain necessary information to load the page
*/
async function profile(req, res, next){

	db.collection("users").findOne({"username": req.session.username}, async function(err, result){ //Will first look for the user in the database
		if(err){
			res.status(500).send("Error reading database.");
			return;
		}
		if(!result){
			res.status(404).send("That ID does not exist in the database.");
			return;
		} else { //Once user is found, initalize requests,friends,trades which will then be appended on to provided information to the webpage
      let requests = [];
      let friends = [];
      let trades = [];

      //Checking friendship requests and adding accordingly to the requests array
     await db.collection("friends").find({"requestTO" : req.session.username}, async function(err, result2){
      if(err){
        res.status(500).send("Error reading db");
        return;
      }
      if(!result2){
        res.status(404).send("No requests");
        return;
      } else {
        await result2.forEach(function(friendship) {
          if(friendship.currentstatus === 0){
            requests.push(friendship);
          }
        })

      }
    });

    //Checking trade requests and adding to the trade requests accordingly
    await db.collection("trades").find({"requestTO" : req.session.username}, async function(err, result4){
     if(err){
       res.status(500).send("Error reading db");
       return;
     }
     if(!result4){
       res.status(404).send("No requests");
       return;
     } else {
       await result4.forEach(function(trade) {
         if(trade.currentstatus === 0){
           trades.push(trade);
         }
       });

     }
   });

   //Checking friendship relationships where there is a confirmed status of being friends
    await db.collection("friends").find({ $or: [{"requestTO" : req.session.username},{"requestFROM" : req.session.username}]}, async function(err, result3){
      await result3.forEach(function(friendship) {
        if(friendship.requestTO === req.session.username){
          if(friendship.currentstatus === 1){
            friends.push(friendship.requestFROM);
          }
        } else {
          if(friendship.currentstatus === 1){
            friends.push(friendship.requestTO);
          }
        }

      });
      //After everything runs due to the await functions, the profile page will render with all necessary information to load it
      res.status(200).render("profile", {trades: trades, friendships: friends, requests: requests, user: result});
    });


    }

	});

}

//Checks to see if logged in
function auth(req, res, next) {
	if(!req.session.loggedin){
		res.status(401).send("<a href='/'>Not Logged in. Click here to login or register</a><br>");
		return;
	}

	next();
};

/*
Checks user and password and then
Logs in and creates a session if valid
*/
function login(req, res, next){
	if(req.session.loggedin){
		res.status(200).send("Already logged in.");
		return;
	}
	let username = req.body.username;
	let password = req.body.password;
	db.collection("users").findOne({username: username}, function(err, result){
		if(err)throw err;

		if(result){
			if(result.password === password){
				req.session.loggedin = true;
				req.session.username = username;
				res.send("<a href='/'>Logged in, click here to go to your profile</a><br>");
			}else{
				res.status(401).send("<a href='/'>Not authorized. Invalid Username or Password. Click here to try again</a><br>");
			}
		}else{
			res.status(401).send("<a href='/'>Not authorized. Invalid Username or Password. Click here to try again</a><br>");
			return;
		}

	});
}

/*
Logs out of the session
*/
function logout(req, res, next){
	if(req.session.loggedin){
		req.session.loggedin = false;
		res.send("<p> Logged out </p> <br> <a href='/'>Click here to go back to login page</a>");
	}else{
		res.status(200).send("You cannot log out because you aren't logged in.");
	}
}


/*
Function to create a new user based off the inputs on the
webpage. Also checks for duplicates and creates a random set of 10 Cards
for ecah user successfuly created
*/
async function createNewUser(req, res, next){

  await db.collection("cards").aggregate(
     [ { $sample: { size: 10 } } ]

  ).toArray(async (err, cards) => {
    let user = new User({
      username: req.body.username,
      password: req.body.password,
      cards: cards,
    });

    db.collection("users").insertOne(user, {unique: true}, function(err, result){
      if(err){
        console.log(err);
        res.send("<a href='/'>That Username Has been Taken, Click here to try again</a><br>");
        return;
      }
      let newID = result.insertedId;


      res.send("<a href='/'>User Created, Click here to login</a><br>");
    });
    }
  );

}

/*
Used to create a friend request but first checks current relationships to see
that there is no duplcates
*/
async function addfriend(req,res,next){

  if(req.session.loggedin){
    let friend = new Friend({
      requestFROM: req.session.username,
      requestTO: req.body.username,
      currentstatus: 0,
    });

    db.collection("friends").findOne({requestFROM:req.body.username, requestTO:req.session.username}, async function(err, check){
      if(check){
        res.status(200).send("<p>There is already a request being sent, or you're already friends.</p> <br> <a href='/'> Click here to go back to profile page </a>");
      } else {
        db.collection("friends").insertOne(friend, {unique: true}, function(err, result){
          if(err){
            console.log(err);
            res.status(200).send("<p>There is already a request being sent, or you're already friends.</p> <br> <a href='/'> Click here to go back to profile page </a>");
            return;
          }

          res.send("<p> Friend Request Sent! </p> <br> <a href='/'>Click here to back to your profile</a>");
          });
        };
      });

      }else{
        res.status(200).send("<p>You cannot add anyone because you're not logged in.</p> <br> <a href='/'> Click here to login or register </a>");
      }
}

/*
Function to update the relationship between the two users depending on whether or not
the receiving user has accepted the request
*/
async function addorReject(req,res,next){
  if(req.body.choice != "1" && req.body.choice != "2"){
    profile(req,res,next);
  } else {
  let id = req.body.friendshipID;
  let oid;

  try{
    oid = new ObjectID(id);
  }catch{
    res.status(404).send("That ID does not exist.");
    return;
  }

  if(req.body.choice === "1"){
    await db.collection("friends").updateOne(
      { "_id" : oid },
      { $set: {"currentstatus" : 1}},
    );
  } else {
    await db.collection("friends").deleteOne(
      { "_id" : oid }
    );
  }

  }
  profile(req,res,next);

}

/*
Function to look for a certain user based off the information
from the seach bar and then redirects to the user page if it exists
*/
function searching(req,res,next){
  db.collection("users").findOne({username: req.body.searchbar}, function(err, result){
    if(err){
			res.status(500).send("Error reading database.");
			return;
		}
		if(!result){
			res.status(404).send("<p>That user does not exist.</p> <br> <a href='/'> Click here to go back to your profile to try again </a>");
			return;
		}

		res.status(200).render("searchedUser", {user: result});
  });
}

/*
Loads the trading page based off the user logged in and the friend
the logged in user decided to attempt to trade to
*/
function trade(req,res,next){
  if (req.session.loggedin) {
      db.collection("users").findOne({username: req.session.username}, function(err, result){
        db.collection("users").findOne({username: req.params.user2}, function(err, result2){
          res.status(200).render("trade", {user: result, user2: result2});
        });
      });
   }else {
      console.log("not logged in");
      res.status(200).send("Not logged in");
  }
}

/*
Requests a trade based off the information off of the trading page
*/
function tradereq(req,res,next){
  if(req.body.offer == null || req.body.receive == null){
    res.status(200).send("<p>That trade is not possible to offer.</p> <br> <a href='/'> Click here to go back to your profile </a>");
  } else {
    let trade = new Trade({
      cardOFFER: req.body.offer,
      cardRECEIVE: req.body.receive,
      requestFROM: req.body.user,
      requestTO: req.body.user2,
      currentstatus: 0,
    });

    db.collection("trades").insertOne(trade, {unique: true}, function(err, result){
      if(err){
        console.log(err);
        res.send("<a href='/'>That Username Has been Taken, Click here to try again</a><br>");
        return;
      }

      res.send("<p> Trade Request Sent! </p> <br> <a href='/'>Click here to back to your profile</a>");

      });
    }
}

/*
A way to look at all the users on the webpage (localhost:3000/users)
*/
function listUser(req, res, next){
	db.collection("users").find({}).toArray(function(err, result){
		if(err){
			res.status(500).send("Error reading database.");
			return;
		}
		res.status(200).render("userlist", {users: result});
	});
}

/*
Redirects to a user profile page
*/
function readuser(req, res, next){
	let user = req.params.username;

	db.collection("users").findOne({"username": user}, function(err, result){
		if(err){
			res.status(500).send("Error reading database.");
			return;
		}
		if(!result){
			res.status(404).send("That ID does not exist in the database.");
			return;
		}
		res.status(200).render("user", {user: result});
	});
}

/*
Handles whether or not the trade has been accepted or not and makes
sure to check all the cards of each user to make sure that the trade is valid if accepted otherwise, will delete the relationship
*/
async function tradeANSWER(req,res,next){
  if(req.body.choiceT != "1" && req.body.choiceT != "2"){ //Makes sure a choice was chosen
    profile(req,res,next);
  } else {
  let id = req.body.tradeID;
  let oid;

  try{
    oid = new ObjectID(id);
  }catch{
    res.status(404).send("That ID does not exist.");
    return;
  }

  if(req.body.choiceT === "2"){ //Rejeceted
    db.collection("trades").deleteOne({_id: oid});
    res.status(200).send("<p>You have successfuly denied the trade</p> <br> <a href='/'> Click here to go back to your profile </a>");
  } else {
        await db.collection("cards").findOne({name: req.body.cardoffer}, async function(err, result){ //Looks for the first card

          await db.collection("users").findOne({username: req.body.userOffering}, async function(err, userOff){ //Checks if the first user still has the card
            let found = false;
            for(let i = 0; i < userOff.cards.length ; i++){ //For loop here to make sure await works as forEach, it does not work
              if(userOff.cards[i].name == result.name){
                found = await true;
                break;
              } else {
                found = await false;
              }
            }
            if(!found){ //Does nto have the card
              db.collection("trades").deleteOne({_id:oid});
              res.status(200).send("<p>This trade is now invalid as one of the two users do not have their respective card</p> <br> <a href='/'> Click here to go back to your profile </a>");

            } else {
              await db.collection("cards").findOne({name: req.body.cardreceive}, async function(err, result2){ //Looks for the second card
                await db.collection("users").findOne({username: req.body.userRespond}, async function(err, userRec){ //Checks if the second(receiving) user still has their card
                  let found2 = false;
                  for(let i = 0; i < userRec.cards.length ; i++){ //For loop here to make sure await works as forEach, it does not work
                    if(userRec.cards[i].name == result2.name){
                      found2 = await true;
                      break;
                    } else {
                      found2 = await false;
                    }
                  }
                  if(!found2){ //Does not have the card
                    db.collection("trades").deleteOne({_id:oid});
                    res.status(200).send("<p>This trade is now invalid as one of the two users do not have their respective card</p> <br> <a href='/'> Click here to go back to your profile </a>");
                  } else {
                    await db.collection("users").updateOne( //If both players have the card, both users and their cards end up being updated
                      {username : req.body.userOffering},
                      { $set: {"cards.$[element]" : result2}},
                      { arrayFilters: [ {element: result}],
                      upsert: true},
                    )
                    await db.collection("users").updateOne(
                      {username : req.body.userRespond},
                      { $set: {"cards.$[element]" : result}},
                      { arrayFilters: [ {element: result2}],
                      upsert: true},
                    )

                    db.collection("trades").deleteOne({_id: oid}); //Will always delete the relationship once trade is complete (eithr accepted or rejceted or invalid)
                    res.status(200).send("<p>You have successfuly accepted the trade</p> <br> <a href='/'> Click here to go back to your profile </a>");
                  };
                });
              });
            };
        });
      })



  }


}

}

mc.connect("mongodb://localhost:27017", function(err, client) {
	if (err) {
		console.log("Error in connecting to database");
		console.log(err);
		return;
	}

	//Set the app.locals.db variale to be the 'data' database
	db = client.db("myFinal");
	app.listen(3000);
	console.log("Server listening on port 3000");
})
