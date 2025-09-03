let _ = require('lodash');
let mongoose = require('mongoose');
let redis = require('redis');

const roomsChannel = 'rooms_channel';
const usersChannel = 'users_channel';
const roomlistChannel = 'roomlist_channel';
let redisClient;
let redisSubscriberClient;

const chatService = {};

// A felhasználónk neve es az avatar cime
let myUsername;
let avatarImage;

// Az üzenet model leírása
const Message = mongoose.model('Message', new mongoose.Schema({
    user: String,
    date: Date,
    content: String,
    room: String,
    avatarURL: String,
}));

// A szoba model leírása
const Room = mongoose.model('Room', new mongoose.Schema({
    name: String,
}));


// Csatlakozáskor hívott függvény
chatService.connect = function (username, serverAddress, password, avatarURL, successCb, failCb, messageCallback, userCallback, roomlistCallback) {
    myUsername = username;
    avatarImage = avatarURL;
    let dbReady = false;
    let mqReady = false;

    let db = mongoose.connect('mongodb://' + serverAddress + ':27017/cubix?authSource=admin', { useNewUrlParser: true, useUnifiedTopology: true });
    redisClient = redis.createClient({
        host: serverAddress, port: 6379, retry_strategy: function () {
        }
    });

    // Ha minden kapcsolat felépült
    function connectionSuccesfull() {
        // Felvesszük magunkat az online user listára
        redisClient.ZADD(usersChannel, { score: 0, value: username });
        // Szólunk a channelen hogy bejelentkeztünk
        redisClient.publish(usersChannel, username);

        // Feliratkozunk az eseményekre amiket figyelnünk kell
        // A subscribehoz külön kliens kell, ezért lemásoljuk az eredetit
        redisSubscriberClient = redisClient.duplicate();
        redisSubscriberClient.connect()
        redisSubscriberClient.subscribe(roomsChannel, function (message, channel) { messageCallback(message); });
        redisSubscriberClient.subscribe(usersChannel, function (message, channel) { userCallback(); });
        redisSubscriberClient.subscribe(roomlistChannel, function (message, channel) { roomlistCallback(); });

        successCb();
    }

    // Nem tudjuk a kettő CB közül melyik hívódik meg előszőr, így a második után fogunk csak visszahívni
    db.then(function () {
        dbReady = true;
        if (mqReady === true) {
            connectionSuccesfull();
        }
    }, failCb);

    // Redis kliens eseményei
    redisClient.connect().then(function () {
        mqReady = true;
        if (dbReady === true) {
            // Ha a DB kapcsolatot is felépítettük bejelentkezünk
            connectionSuccesfull();
        }
    });
    redisClient.on('error', failCb);
};



// Lecsatlakozik a szerverről
chatService.disconnect = function () {
    if (!_.isUndefined(redisClient)) {
        redisClient.ZREM(usersChannel, myUsername);
        redisClient.DEL(roomlistChannel);
        redisClient.publish(usersChannel, myUsername);
    }
};

// Visszaadja a szobában található üzeneteket
chatService.getMessages = function (roomId, cb) {
    Message.find({ room: roomId }).then((msg) => {
        cb(msg)
    });
};

// Visszaadja a bejelentkezett usereket
chatService.getUsers = function (cb) {
    redisClient.ZRANGE(usersChannel, 0, -1).then(function (result) {
        cb(result);
    });
};

// Visszaadja a szobákat
chatService.getRooms = function (cb) {
    Room.find().sort({ _id: 1 }).then((result) => {
        cb(result.map(room => room.name));
    });
};

// Üzenetet küld
chatService.sendMessage = function (roomId, message) {
    let msg = new Message({
        user: myUsername,
        date: message.date,
        content: message.content,
        room: roomId,
        avatarURL: avatarImage
    });
    msg.save().then(function () {
        // Szólunk hogy frissítettük a szobában az üzeneteket
        redisClient.publish(roomsChannel, roomId)
    })
};

// Új szoba létrehozása mongodb-ben
chatService.createNewRoom = function (roomname) {
    let newroom = new Room({
        name: roomname
    })
    newroom.save();
    // Szólunk hogy új szoba jött létre, a cb function lefut
    redisClient.ZADD(roomlistChannel, { score: 0, value: roomname });
    redisClient.publish(roomlistChannel, roomname);
};


module.exports = chatService;