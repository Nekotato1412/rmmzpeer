/*:
 * @target MZ
 * @plugindesc Provides peer to peer multiplayer functionality to RPG Maker MZ
 * @author Best Waifu
 * 
 * @param Enter Room Code Text
 * @type text
 * @default Enter Room Code
 *
 * @param Disconnect Text
 * @type text
 * @default Disconnect
 * 
 * @param Set Username Text
 * @type text
 * @default Set Username
 * 
 * @param Netplay Text
 * @type text
 * @default Multiplayer
 * 
 * @param Player Join Common Event
 * @desc The common event to call on player join.
 * @type number
 * @default 0
 * 
 * @param Player Joined Variable
 * @desc The variable to store the player number that joined.
 * @type variable
 * @default 0
 * 
 * @param Player Leave Common Event
 * @desc The common event to call on player leave.
 * @type number
 * @default 0
 * 
 * @param Player Count Variable
 * @desc The variable to store the player count.
 * @type variable
 * @default 0
 * 
 * @param Player Left Variable
 * @desc The variable to store the player number that left.
 * @type variable
 * @default 0
 * 
 * @param Auto Session Creation
 * @desc Automatically opens a session when the host gets to the starting position.
 * @type boolean
 * @default false
 * 
 * @param Auto Spawn Players
 * @desc Spawn players at the host's position as soon as they join. Turn off to use the plugin commands.
 * @type boolean
 * @default true
 *
 * @command spawnLastPlayer
 * @text Spawn Last Player
 * @desc Host only. Spawns the newest player waiting to enter.
 * @arg x
 * @type number
 * @arg y
 * @type number
 *
 * @command spawnAllPlayers
 * @text Spawn All Players
 * @arg x
 * @type number
 * @arg y
 * @type number
 *
 * @command storePlayerNumber
 * @text Store Local Player Number
 * @desc Each machine stores its own number. The variable is never synced.
 * @arg variable
 * @type variable
 *
 * @command setMoveRoutePlayer
 * @text Set Move Route Player
 * @desc Makes "Player" in move routes mean this player number. 0 resets it.
 * @arg player
 * @type number
 * @default 0
 * 
 * 
 * @command openSession
 * @text Open Session
 * @desc Opens a new multiplayer session as host if one hasn't been opened already. 
 * 
 * 
 * @help
 * 
 */
var BestWaifu = BestWaifu || {};
BestWaifu.MZPeer = BestWaifu.MZPeer || {};
BestWaifu.MZPeer.Version = 2;

BestWaifu.MZPeer.params = PluginManager.parameters("MZPeer");

BestWaifu.MZPeer.ENTER_ROOM_CODE = String(BestWaifu.MZPeer.params["Enter Room Code Text"] || "Enter Room Code");
BestWaifu.MZPeer.DISCONNECT = String(BestWaifu.MZPeer.params["Disconnect Text"] || "Disconnect");
BestWaifu.MZPeer.SET_USERNAME = String(BestWaifu.MZPeer.params["Set Username Text"] || "Set Username");
BestWaifu.MZPeer.NETPLAY = String(BestWaifu.MZPeer.params["Netplay Text"] || "Multiplayer");

BestWaifu.MZPeer.PlayerJoinCE = parseInt(BestWaifu.MZPeer.params["Player Join Common Event"]) || 0;
BestWaifu.MZPeer.PlayerJoinVar = parseInt(BestWaifu.MZPeer.params["Player Joined Variable"]) || 0;

BestWaifu.MZPeer.PlayerLeaveCE = parseInt(BestWaifu.MZPeer.params["Player Leave Common Event"]) || 0;
BestWaifu.MZPeer.PlayerLeaveVar = parseInt(BestWaifu.MZPeer.params["Player Left Variable"]) || 0;

BestWaifu.MZPeer.PlayerCountVar = parseInt(BestWaifu.MZPeer.params["Player Count Variable"]) || 0;

BestWaifu.MZPeer.shouldAutoCreateSession = BestWaifu.MZPeer.params["Auto Session Creation"] == "true";

BestWaifu.MZPeer.peerIdBase = "mzpeer-91fc5e8a3652ce-";
BestWaifu.MZPeer.lobbyIdCharacters = [
    'Q', 'R', 'S', 'T', 'Z',
    'U', 'V', 'W', 'X', 'Y',
    'A', 'B', 'C', 'D', 'E',
    'F', 'G', 'H', 'J', 'K',
    'L', 'M', 'N', 'O', 'P'
]

BestWaifu.MZPeer.logDebug = function(message) {
    console.log("[DEBUG] ", message);
};

BestWaifu.MZPeer.lobbyIdLength = 4;

// Hard coded to work like Local Coop for now.
BestWaifu.MZPeer.maxPlayers = 4;


/** Small fix to minimize client desync. */
SceneManager.isGameActive = function() {
    return true;
}


//-----------------------------------------------------------------------------
// #region Network Objects
//
// Helper objects to interface with the network system.

//#region Network Data
BestWaifu.MZPeer.NetworkData = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.NetworkData.prototype.constructor = BestWaifu.MZPeer.NetworkData;

BestWaifu.MZPeer.NetworkData.prototype.initialize = function (type) {
    this._data = { type, "username": $gameNetwork.username };
    this._fields = [
        {
            "type": BestWaifu.MZPeer.NetworkData.DataTypes.STRING,
            "name": "type"
        },
        {
            "type": BestWaifu.MZPeer.NetworkData.DataTypes.STRING,
            "name": "username"
        },
        {
            "type": BestWaifu.MZPeer.NetworkData.DataTypes.INT,
            "name": "tick"
        }
    ];
};

BestWaifu.MZPeer.NetworkData.prototype.type = function () {
    return this._data.type;
};

BestWaifu.MZPeer.NetworkData.prototype.tick = function() {
    return this._data.tick;
};

BestWaifu.MZPeer.NetworkData.prototype.username = function () {
    return this._data.username;
}

BestWaifu.MZPeer.NetworkData.DataTypes = {
    INT: 0,
    FLOAT: 1,
    STRING: 2,
    OBJECT: 3,
    ARRAY: 4
};

/**
 * 
 * @param {BestWaifu.MZPeer.NetworkData.DataTypes} type 
 * @param {String} key 
 * @returns {Object}
 */
BestWaifu.MZPeer.NetworkData.prototype.field = function (type, key) {
    return { "type": type, "name": key };
}

/**
 * Add a field to the NetworkData's schema with the provided type and key.
 * @param {BestWaifu.MZPeer.NetworkData.DataTypes} dataType 
 * @param {String} key 
 */
BestWaifu.MZPeer.NetworkData.prototype.addField = function (dataType, key) {
    if (this._data[key] !== undefined) throw new Error("Attempted to add a field that exists.");
    if (dataType < 0 || dataType > 4) {
        throw new Error("Attempted to add a field type that does not exist.");
    }
    this._fields.push(this.field(dataType, key));

    // Initialize the field to null
    this._data[key] = null;
};

/**
 * Get the field with the given key
 * @param {String} key 
 * @param {any} fallback 
 * @returns {any}
 */
BestWaifu.MZPeer.NetworkData.prototype.getField = function (key, fallback = undefined) {
    if (!this.hasField(key)) return fallback;
    if (this._data[key] === undefined) return fallback;
    if (this._data[key] === null) return fallback;
    return this._data[key];
};

BestWaifu.MZPeer.NetworkData.prototype.hasField = function (key) {
    return this._fields.some(f => f.name === key);
};

/**
 * Set the field with the given key to the value
 * @param {String} key 
 * @param {any} value 
 */
BestWaifu.MZPeer.NetworkData.prototype.setField = function (key, value) {
    const field = this._fields.find(f => f.name === key);
    if (!field) throw new Error("Attempted to set a field that does not exist.");

    if (value === null) {
        if (key !== "type") {
            this._data[key] = null;
        }
        return;
    }


    switch (field.type) {
        case BestWaifu.MZPeer.NetworkData.DataTypes.INT:
            if (!Number.isInteger(Number(value))) throw new Error("Type mismatch. Expected an Integer.");
            value = Number(value)
            break;
        case BestWaifu.MZPeer.NetworkData.DataTypes.FLOAT:
            if (isNaN(Number(value))) throw new Error("Type mismatch. Expected a float.");
            value = Number(value)
            break;
        case BestWaifu.MZPeer.NetworkData.DataTypes.ARRAY:
            if (!Array.isArray(value)) throw new Error("Type mismatch. Expected an array.");
            break;
        case BestWaifu.MZPeer.NetworkData.DataTypes.STRING:
            if (typeof value !== "string") throw new Error("Type mismatch. Expected a string.");
            break;
        case BestWaifu.MZPeer.NetworkData.DataTypes.OBJECT:
            if (typeof value !== "object") throw new Error("Type mismatch. Expected an object.");
            break;
    }
    this._data[key] = value;
};

/**
 * Get the data object for sending over the wire
 * @returns {Object}
 */
BestWaifu.MZPeer.NetworkData.prototype.data = function () {
    return this._data;
};

BestWaifu.MZPeer.NetworkData.fromType = function(type) {
    switch(type) {
        case "sync_save_data": return new BestWaifu.MZPeer.SyncSaveData();
        case "sync_player_movement": return new BestWaifu.MZPeer.SyncPlayerMovement();
        case "sync_player_orientation": return new BestWaifu.MZPeer.SyncPlayerOrientation();
        case "sync_player_locate": return new BestWaifu.MZPeer.SyncPlayerLocate();
        case "request": return new BestWaifu.MZPeer.NetworkRequest();
        case "response": return new BestWaifu.MZPeer.NetworkResponse();
        case "handshake": return new BestWaifu.MZPeer.NetworkHandshake();
        default: return new BestWaifu.MZPeer.NetworkData(type);
    }
};

/** For safely loading an object from the wire as network data. */
BestWaifu.MZPeer.NetworkData.prototype.fromData = function (data) {
    for (const key of Object.keys(data)) {
        if (!this.hasField(key)) continue;
        try {
            this.setField(key, data[key]);
        } catch (e) {
            console.error(e);
        }
    }

    return this;
};

//#endregion

//#region Network Request

/**
 * Data to send to the host to invoke a response
 * @param {BestWaifu.MZPeer.NetworkRequest.Codes} code 
 */
BestWaifu.MZPeer.NetworkRequest = function () {
    this.initialize(...arguments);
}

BestWaifu.MZPeer.NetworkRequest.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.NetworkRequest.prototype.constructor = BestWaifu.MZPeer.NetworkRequest;

// All valid network request codes.
// Network requests are sent to the host
// who should always send back a network
// response.
BestWaifu.MZPeer.NetworkRequest.Codes = {
    "INIT": 0, // Let the host know we're ready to recieve setup data
    "DISCONNECT": 1, // Used for a graceful disconnection,
    "POST_SAVE_LOAD": 2,
    "POST_PLAYER_LIST": 3,
    "INITIALIZE_PLAYERS": 4, // Let the host know we need to initialize players,
    "REORIENT": 6, // Let the host/guests know we need to collect new positions
};

BestWaifu.MZPeer.NetworkRequest.prototype.initialize = function (code = -1) {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "request");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "code");
    this.setField("code", code);
};

//#endregion

//#region Network Response

/**
 * Data sent to a guest to communicate
 * @param {BestWaifu.MZPeer.NetworkResponse.Codes} code
 */
BestWaifu.MZPeer.NetworkResponse = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.NetworkResponse.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.NetworkResponse.prototype.constructor = BestWaifu.MZPeer.NetworkResponse;

// All valid network response codes.
// Sent from Host -> Guest for one-off commands or state changes
BestWaifu.MZPeer.NetworkResponse.Codes = {
    "RESET": 0,       // Guest should reset their state because host reset the game state
    "DISCONNECT": 1,   // Host instructs guest to disconnect gracefully (kicked)
};

BestWaifu.MZPeer.NetworkResponse.prototype.initialize = function (code = -1) {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "response");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "code");
    this.setField("code", code);
};

//#endregion

//#region Network Handshake

BestWaifu.MZPeer.NetworkHandshake = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.NetworkHandshake.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.NetworkHandshake.prototype.constructor = BestWaifu.MZPeer.NetworkHandshake;

BestWaifu.MZPeer.NetworkHandshake.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "handshake");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "id");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "timestamp");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "status");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.OBJECT, "network_data");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "owner");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "recipient");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "retries");
};

BestWaifu.MZPeer.NetworkHandshake.Statuses = {
    "UNRESOLVED": 0, // Handshake was just created
    "PENDING_ACK": 1, // Pending acknowledgement from the other side
    "RESOLVED": 2, // Handshake acknowledged
    "PURGED": 3 // Something went wrong with the handshake and we had to purge it
};

/** Handshakes expire after 1000ms and must be renewed. */
BestWaifu.MZPeer.NetworkHandshake.prototype.isExpired = function() {
    return (Date.now() - this.getField("timestamp")) >= 10000;
};

/** Recreate the timestamp. */
BestWaifu.MZPeer.NetworkHandshake.prototype.renew = function() {
    this.setField("timestamp", Math.floor(Date.now())); // Assurance that this is an integer at runtime
};

/** The preferred method of instantiating a new handshake object. */
BestWaifu.MZPeer.NetworkHandshake.create = function(recipientUsername, handshake_id, networkData) {
    const network_handshake = new BestWaifu.MZPeer.NetworkHandshake();

    network_handshake.setField("id", String(handshake_id));
    network_handshake.setField("owner", $gameNetwork.username);
    network_handshake.setField("recipient", String(recipientUsername));
    network_handshake.setField("network_data", networkData.data());
    network_handshake.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.UNRESOLVED);
    network_handshake.renew();

    return network_handshake;
};

/** Get the raw network data */
BestWaifu.MZPeer.NetworkHandshake.prototype.networkData = function () {
    const data = this.getField("network_data");
    return data;
};

/** Get the id as a unique id in the format {recipient}_{id}. */
BestWaifu.MZPeer.NetworkHandshake.prototype.getUniqueId = function() {
    if (this.getField("id") === undefined) throw new Error("Cannot create a unique id when id is empty.");
    if (this.getField("owner") === undefined) throw new Error("Cannot create a unique id when owner is empty.");
    return this.getField("owner") + "_" + this.getField('id');
};

/** Get the handshake's actual id from a unique id. */
BestWaifu.MZPeer.NetworkHandshake.prototype.getIdFromUnique = function(unique_id) {
    return unique_id.split("_")[1];
};

/** Get the handshake's owner from a unique id. */
BestWaifu.MZPeer.NetworkHandshake.prototype.getOwnerfromUnique = function(unique_id) {
    return unique_id.split("_")[0];
};


//#endregion

//#region Reliable Packet
BestWaifu.MZPeer.ReliablePacket = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.ReliablePacket.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.ReliablePacket.prototype.constructor = BestWaifu.MZPeer.ReliablePacket;
BestWaifu.MZPeer.ReliablePacket.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "reliable_packet");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "packet_id");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "timestamp");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "status");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.OBJECT, "network_data");
};

BestWaifu.MZPeer.ReliablePacket.Statuses = {
    "UNACKNOWLEDGED": 0,
    "ACKNOWLEDGED": 1
};

BestWaifu.MZPeer.ReliablePacket.prototype.isExpired = function() {
    return (Date.now() - this.getField("timestamp", 0)) >= 5000;
};

BestWaifu.MZPeer.ReliablePacket.prototype.renew = function() {
    this.setField("timestamp", Math.floor(Date.now()));
};

BestWaifu.MZPeer.ReliablePacket.create = function(packet_id, networkData) {
    const packet = new BestWaifu.MZPeer.ReliablePacket();
    packet.setField("packet_id", String(packet_id));
    packet.setField("status", BestWaifu.MZPeer.ReliablePacket.Statuses.UNACKNOWLEDGED);
    packet.setField("network_data", networkData.data());
    packet.renew();
    return packet;
};

BestWaifu.MZPeer.ReliablePacket.prototype.networkData = function() {
    return this.getField("network_data");
};

//#endregion

//#region Syncing Data

BestWaifu.MZPeer.SyncSaveData = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncSaveData.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncSaveData.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_save_data");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "save_json");
};

BestWaifu.MZPeer.SyncSaveData.prototype.makeSave = function () {
    const contents = DataManager.makeSaveContents();
    this.setField("save_json", JsonEx.stringify(contents));
};

BestWaifu.MZPeer.SyncSaveData.prototype.loadSave = function () {
    const contents = JsonEx.parse(this.getField("save_json"));
    DataManager.extractSaveContents(contents);
    $gamePlayer.refresh();
    $gameMap.requestRefresh();
    $gamePlayer.movementGraph = new BestWaifu.MZPeer.NetworkGraph();

    // Let the host know we are ready for step 2
    $gameNetwork.sendRequest(new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.POST_SAVE_LOAD));
};

BestWaifu.MZPeer.SyncPlayerList = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerList.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerList.prototype.constructor = BestWaifu.MZPeer.SyncPlayerList;
BestWaifu.MZPeer.SyncPlayerList.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_list");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.ARRAY, "list");
};

BestWaifu.MZPeer.SyncPlayerCreation = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerCreation.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerCreation.prototype.constructor = BestWaifu.MZPeer.SyncPlayerCreation;
BestWaifu.MZPeer.SyncPlayerCreation.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_creation");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "x");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "y");
};

BestWaifu.MZPeer.SyncPlayerDestruction = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerDestruction.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerDestruction.prototype.constructor = BestWaifu.MZPeer.SyncPlayerDestruction;
BestWaifu.MZPeer.SyncPlayerDestruction.prototype.initialize = function(username="") {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_destruction");
    this.setField("username", username);
};


/** Used for syncing the movement of a player. */
BestWaifu.MZPeer.SyncPlayerMovement = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerMovement.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerMovement.prototype.constructor = BestWaifu.MZPeer.SyncPlayerMovement;
BestWaifu.MZPeer.SyncPlayerMovement.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_movement");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "direction");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "speed");
};

/** Used for syncing the movement of an event. */
BestWaifu.MZPeer.SyncEventMovement = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncEventMovement.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncEventMovement.prototype.constructor = BestWaifu.MZPeer.SyncEventMovement;
BestWaifu.MZPeer.SyncEventMovement.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_event_movement");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "event_id");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "direction");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "speed");
};

/** Used for hard syncing the orientation of a player. */
BestWaifu.MZPeer.SyncPlayerOrientation = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerOrientation.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerOrientation.prototype.constructor = BestWaifu.MZPeer.SyncPlayerOrientation;
BestWaifu.MZPeer.SyncPlayerOrientation.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_orientation");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "direction");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "x");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "y");
};

/** Used for hard syncing the orientation of an event. */
BestWaifu.MZPeer.SyncEventOrientation = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncEventOrientation.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncEventOrientation.prototype.constructor = BestWaifu.MZPeer.SyncEventOrientation;
BestWaifu.MZPeer.SyncEventOrientation.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_event_orientation");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "event_id");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "direction");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "x");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "y");
};

/** Used for tracking when an event teleports. */
BestWaifu.MZPeer.SyncEventLocate = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncEventLocate.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncEventLocate.prototype.constructor = BestWaifu.MZPeer.SyncEventLocate;
BestWaifu.MZPeer.SyncEventLocate.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_event_locate");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "event_id");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "x");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "y");
};


BestWaifu.MZPeer.SyncPlayerNumber = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerNumber.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerNumber.prototype.constructor = BestWaifu.MZPeer.SyncPlayerNumber;
BestWaifu.MZPeer.SyncPlayerNumber.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_number");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "player");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "order");
};


/** Used for tracking when a player teleports. */
BestWaifu.MZPeer.SyncPlayerLocate = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerLocate.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerLocate.prototype.constructor = BestWaifu.MZPeer.SyncPlayerLocate;
BestWaifu.MZPeer.SyncPlayerLocate.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_locate");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "x");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "y");
};


//#endregion

//#region Network Graph

/** Stores network data inside of itself and the time it was created in the form of ticks. */
BestWaifu.MZPeer.NetworkGraphNode = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.NetworkGraphNode.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.NetworkGraphNode.prototype.constructor = BestWaifu.MZPeer.NetworkGraphNode;
BestWaifu.MZPeer.NetworkGraphNode.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "network_graph_node");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.OBJECT, "network_data");
};

/** Used for creating new nodes to be added to a graph. */
BestWaifu.MZPeer.NetworkGraphNode.create = function (tick, network_data) {
    const network_graph_node = new BestWaifu.MZPeer.NetworkGraphNode();
    network_graph_node.setField("tick", tick);
    network_graph_node.setField("network_data", network_data.data());
    return network_graph_node;
};

/** Get the network data as a NetworkData object */
BestWaifu.MZPeer.NetworkGraphNode.prototype.networkData = function () {
    const data = this.getField("network_data");
    return data;
};

/** A continuous graph of networked actions taken since initialization. */
BestWaifu.MZPeer.NetworkGraph = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.NetworkGraph.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.NetworkGraph.prototype.constructor = BestWaifu.MZPeer.NetworkGraph;
BestWaifu.MZPeer.NetworkGraph.prototype.initialize = function () {
    this._nodes = [];
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "network_graph");
};

/** Get a slice of the network graph as a new network graph. */
BestWaifu.MZPeer.NetworkGraph.prototype.getSlice = function(size) {
    const slice_network_graph = new BestWaifu.MZPeer.NetworkGraph();
    if (this._nodes.length - size < 0) return slice_network_graph;
    for (const node of this._nodes.slice(this._nodes.length - size)) {
        slice_network_graph._nodes.push(node);
    }
    slice_network_graph.setField("tick", slice_network_graph.latestTick());
    return slice_network_graph;
};

/** Increment the graph's tick. */
BestWaifu.MZPeer.NetworkGraph.prototype.tick = function () {
    this.setField("tick", this.getField("tick", 0) + 1);
};

/** Get the latest node. Nodes are always ticked in order and you cannot have two nodes on the same tick. */
BestWaifu.MZPeer.NetworkGraph.prototype.latestNode = function () {
    if (this._nodes.length < 1) return null;
    return this._nodes[this._nodes.length - 1];
};

BestWaifu.MZPeer.NetworkGraph.prototype.latestTick = function () {
    const latestNode = this.latestNode();
    if (!latestNode) return 0;
    return latestNode.getField("tick", 0);
};

BestWaifu.MZPeer.NetworkGraph.prototype.applyLatest = function () {
    const latest = this.latestNode();
    if (latest) {
        const tick = latest.getField("tick", 0);
        if (tick <= this.getField("tick", 0)) {
            $gameNetwork.pushLog("Skipping old tick. Not applying.");
            return;
        };
        this.onApply(latest.networkData());
        this.setField("tick", tick);
    }
};

/** Apply the entire graph. Used for catching up or verifying sync. */
BestWaifu.MZPeer.NetworkGraph.prototype.apply = function () {
    for (const node of this._nodes) {
        const tick = node.getField("tick", 0);
        if (tick <= this.getField("tick", 0)) continue;
        this.onApply(node.networkData())
        this.setField("tick", tick);
    }
};

BestWaifu.MZPeer.NetworkGraph.SyncStatuses = {
    "NETWORK_BEHIND": 0,
    "NETWORK_SYNCED": 1,
    "NETWORK_AHEAD": 2
};

/** Used to quickly identify and fix types of desync. */
BestWaifu.MZPeer.NetworkGraph.prototype.syncStatus = function () {
    const latestNode = this.latestNode();
    if (!latestNode) return BestWaifu.MZPeer.NetworkGraph.SyncStatuses.NETWORK_SYNCED;
    const latestTick = latestNode.getField("tick", 0);
    if (this.getField("tick", 0) < latestTick) return BestWaifu.MZPeer.NetworkGraph.SyncStatuses.NETWORK_BEHIND;
    if (this.getField("tick", 0) > latestTick) return BestWaifu.MZPeer.NetworkGraph.SyncStatuses.NETWORK_AHEAD;
    return BestWaifu.MZPeer.NetworkGraph.SyncStatuses.NETWORK_SYNCED;
};

/** Completely clear the graph. Do this on re-initialization to avoid a stupid long history eating memory over time. */
BestWaifu.MZPeer.NetworkGraph.prototype.clear = function () {
    this.setField("tick", 0);
    this._nodes = [];
};

/** Merge in another graph with ours without ticking. Used for hard resync purposes. */
BestWaifu.MZPeer.NetworkGraph.prototype.merge = function (other_graph) {
    const existingTicks = new Set(this._nodes.map(n => n.getField("tick", 0)));
    for (const node of other_graph._nodes) {
        if (!existingTicks.has(node.getField("tick", 0))) {
            this._nodes.push(JsonEx.makeDeepCopy(node));
        }
    }
    this._nodes.sort((a, b) => a.getField("tick", 0) - b.getField("tick", 0));
};

/** To be overridden with a function to call when a node is applied. */
BestWaifu.MZPeer.NetworkGraph.prototype.onApply = function (data) { };

/** Add a node to the graph timeline holding the given network data. */
BestWaifu.MZPeer.NetworkGraph.prototype.addNode = function (network_data) {
    const new_node = BestWaifu.MZPeer.NetworkGraphNode.create(network_data.getField("tick", this.getField("tick", 0)), network_data);
    const new_tick = new_node.getField("tick", 0);
    
    // Insert from the back in the correct order
    let i = this._nodes.length - 1;
    while (i >= 0 && this._nodes[i].getField("tick", 0) > new_tick) {
        i--;
    }
    this._nodes.splice(i + 1, 0, new_node);
};


//#endregion

//#region Network Router
BestWaifu.MZPeer.NetworkRouter = function() {
    this.initialize(...arguments);
}

BestWaifu.MZPeer.NetworkRouter.prototype.constructor = BestWaifu.MZPeer.NetworkRouter;
BestWaifu.MZPeer.NetworkRouter.prototype.initialize = function() {
    this._dataListeners = [];
    this._handshakeListeners = [];

    /** The object used to store reliable packets. */
    this._reliablePackets = {};

    /** The object use to store active handshakes */
    this._handshakes = {};

    /** The rate in ms to poll handshakes */
    this._handshakePollingRate = 1000;
    
    /** The timer for polling handshakes  */
    this._pollTimer = setInterval(this.poll.bind(this), this._handshakePollingRate);
};

/** Where updates are made. */
BestWaifu.MZPeer.NetworkRouter.prototype.poll = function() {
    this.pollReliablePackets();
    this.pollHandshakes();
};


/**
 * Send data to all guests reliably.
 * @param {NetworkData} networkData 
 * @param {string} uniqueId 
 */
BestWaifu.MZPeer.NetworkRouter.prototype.sendReliableToGuests = function(networkData, uniqueId="") {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) throw new Error("Only host can send data to guests.");
    for (const dataConnection of $gameNetwork.peerConnections) {
        if (!dataConnection.open) continue;
        this.sendReliable(dataConnection.metadata?.username, networkData, uniqueId);
    }
};

/**
 * Send a packet to a given recipient reliably.
 * @param {string} username 
 * @param {NetworkData} networkData 
 * @param {string} uniqueId 
 */
BestWaifu.MZPeer.NetworkRouter.prototype.sendReliable = function(username, networkData, uniqueId="") {
    const packet_id = uniqueId ? `${username}_${networkData.type()}_${uniqueId}` : `${username}_${networkData.type()}`
    const packet = BestWaifu.MZPeer.ReliablePacket.create(packet_id, networkData);
    this._reliablePackets[packet_id] = packet;
    this._sendReliablePacket(username, packet);
};

BestWaifu.MZPeer.NetworkRouter.prototype._sendReliablePacket = function(username, packet) {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        this.sendToGuest(username, packet);
    } else if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        this.sendToHost(packet);
    }
};

/** Data recieved from a guest. */
BestWaifu.MZPeer.NetworkRouter.prototype.onPeerData = function (data) {
    if (typeof data !== "object") {
        console.warn("[HOST] Rejected data that was not an object.");
        console.log(data);
        return
    };
    if (!data || !data["type"] || !data["username"]) {
        console.warn("[HOST] Rejected malformed data.");
        console.log(data);
        return
    };
    BestWaifu.MZPeer.logDebug("Locating listeners for type  " + data.type);
    
    if (data.type === "handshake") {
        BestWaifu.MZPeer.logDebug("+ [HOST] Processing handshake.");
        this.onHandshakeData(data);
        return;
    }

    if (data.type === "reliable_packet") {
        BestWaifu.MZPeer.logDebug("+ [HOST] Processing reliable packet.");
        this.onReliablePacket(data);
        return;
    }

    for (const dataListener of this._dataListeners) {
        if (dataListener.side !== BestWaifu.MZPeer.Sides.Common && dataListener.side !== BestWaifu.MZPeer.Sides.Host) continue;
        BestWaifu.MZPeer.logDebug("=> " + dataListener.type)
        if (dataListener.type === data.type) {
            BestWaifu.MZPeer.logDebug("+ Found listener for type: " + dataListener.type)
            dataListener.callback(data);
        }
    }
};

/** Cancel all handshakes and reset the data. */
BestWaifu.MZPeer.NetworkRouter.prototype.reset = function() {
    // Clear the timer first to avoid calling the callbacks
    clearInterval(this._pollTimer);
    // Clear the handshakes object
    this._handshakes = {};
    // Clear the reliable packets object
    this._reliablePackets = {};
    // Reset the timer
    this._pollTimer = setInterval(this.poll.bind(this), this._handshakePollingRate);
};

/** Clears logic related to the given peer from the router. */
BestWaifu.MZPeer.NetworkRouter.prototype.purgePeer = function(username) {
    for (const handshake of Object.values(this._handshakes)) {
        if (handshake.getField("owner") === username) handshake.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PURGED);
        if (handshake.getField("recipient") === username) handshake.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PURGED);
    }
    for (const packet_id of Object.keys(this._reliablePackets)) {
        if (packet_id.startsWith(username + "_")) delete this._reliablePackets[packet_id];
    }
};

/** Data recieved from the host. */
BestWaifu.MZPeer.NetworkRouter.prototype.onHostData = function(data) {
    if (typeof data !== "object") {
        console.warn("[GUEST] Rejected data that was not an object.");
        console.log(data);
        return
    };
    if (!data || !data["type"] || !data["username"]) {
        console.warn("[GUEST] Rejected malformed data.");
        console.log(data);
        return
    };
    //BestWaifu.MZPeer.logDebug("Locating listeners for type  " + data.type);

    if (data.type === "handshake") {
        $gameNetwork.pushLog("[GUEST] Processing handshake from " + data.username)
        this.onHandshakeData(data);
        return;
    }

    if (data.type === "reliable_packet") {
        this.onReliablePacket(data);
        return;
    }

    for (const dataListener of this._dataListeners) {
        if (dataListener.side !== BestWaifu.MZPeer.Sides.Common && dataListener.side !== BestWaifu.MZPeer.Sides.Guest) continue;
        //BestWaifu.MZPeer.logDebug("=> " + dataListener.type)
        if (dataListener.type === data.type) {
            $gameNetwork.pushLog("Processing incoming data: " + dataListener.type);
            //BestWaifu.MZPeer.logDebug("+ Found listener for type: " + dataListener.type)
            dataListener.callback(data);
        }
    }
};

/** Do we have a valid, not expired handshake with this id?  */
BestWaifu.MZPeer.NetworkRouter.prototype.hasHandshake = function(id) {
    if (!this._handshakes[id]) return false;
    if (this._handshakes[id].isExpired()) return false;
    return true;
};

BestWaifu.MZPeer.NetworkRouter.prototype.getHandshake = function(id) {
    return this._handshakes[id];
};

BestWaifu.MZPeer.NetworkRouter.prototype.sendHandshake = function(handshake_data) {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        this.sendToGuest(handshake_data.username(), handshake_data);
    } else if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        this.sendToHost(handshake_data);
    }
};

/** For resolving handshake data. */
BestWaifu.MZPeer.NetworkRouter.prototype.onHandshakeData = function(data) {
    const handshake_data = new BestWaifu.MZPeer.NetworkHandshake();
    handshake_data.fromData(data);

    if (handshake_data.getField("recipient") !== $gameNetwork.username && 
        handshake_data.getField("owner") !== $gameNetwork.username &&
        $gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        console.log("Handshake that wasn't ours was ignored.");
        return;
    }

    if (handshake_data.isExpired()) {
        console.log("Expired handshake ignored.");
        return;
    };

    console.log(`
        HID:${handshake_data.getField("id")}
        Status:${handshake_data.getField("status")}
        `);

    for (const handshakeListener of this._handshakeListeners) {
        if (handshakeListener.id === handshake_data.getField("id", "unknown")) {
            switch (handshake_data.getField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.UNRESOLVED)) {
                case BestWaifu.MZPeer.NetworkHandshake.Statuses.UNRESOLVED: {
                    $gameNetwork.pushLog("Handling unresolved handshake: " + handshake_data.getUniqueId());

                    if (this.hasHandshake(handshake_data.getUniqueId()) &&
                        this._handshakes[handshake_data.getUniqueId()].getField("status") > BestWaifu.MZPeer.NetworkHandshake.Statuses.UNRESOLVED) {
                        $gameNetwork.pushLog("Ignoring a duplicated unresolved handshake.");
                        continue;
                    }

                    handshake_data.setField("network_data", handshakeListener.unresolved(handshake_data.networkData()));
                    handshake_data.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PENDING_ACK);
                    
                    this._handshakes[handshake_data.getUniqueId()] = handshake_data;

                    this.sendHandshake(handshake_data);
                    break;
                }

                case BestWaifu.MZPeer.NetworkHandshake.Statuses.PENDING_ACK: {
                    $gameNetwork.pushLog("Handling pending handshake: " + handshake_data.getUniqueId());
                    if (this.hasHandshake(handshake_data.getUniqueId()) 
                        && this._handshakes[handshake_data.getUniqueId()].getField("status") > BestWaifu.MZPeer.NetworkHandshake.Statuses.PENDING_ACK) {
                        $gameNetwork.pushLog("Ignoring a duplicated pending handshake.");
                        continue;
                    }

                    handshake_data.setField("network_data", handshakeListener.pending(handshake_data.networkData()));
                    handshake_data.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.RESOLVED);

                    this._handshakes[handshake_data.getUniqueId()] = handshake_data;

                    this.sendHandshake(handshake_data);
                    break;
                }

                case BestWaifu.MZPeer.NetworkHandshake.Statuses.RESOLVED: {
                    if (handshake_data.getField("owner") === $gameNetwork.username) {
                        $gameNetwork.pushLog("Handling resolved handshake: " + handshake_data.getUniqueId());
                        handshakeListener.resolved(handshake_data.networkData());
                    } else {
                        console.warn("Ignoring a handshake we don't own.");
                    }

                    handshake_data.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.RESOLVED);

                    this._handshakes[handshake_data.getUniqueId()] = handshake_data;
                    
                    // Send back the resolution confirmation to the owner
                    if (handshake_data.getField("owner") !== $gameNetwork.username) {
                        $gameNetwork.pushLog("Resolving handshake with: " + handshake_data.getField("owner"));
                        this.sendHandshake(handshake_data);
                    }
                    break;
                }
            }
        }
    }
};

/** Where reliable packets are acknowledged. */
BestWaifu.MZPeer.NetworkRouter.prototype.onReliablePacket = function(data) {
    const packet = new BestWaifu.MZPeer.ReliablePacket();
    packet.fromData(data);

    const packet_id = packet.getField("packet_id");
    const status = packet.getField("status");

    if (status === BestWaifu.MZPeer.ReliablePacket.Statuses.UNACKNOWLEDGED) {
        if (this._reliablePackets[packet_id] && 
            this._reliablePackets[packet_id].getField("status") === BestWaifu.MZPeer.ReliablePacket.Statuses.ACKNOWLEDGED) {
            $gameNetwork.pushLog("Duplicate reliable packet ignored: " + packet_id);
        } else {
            // Send it back through as regular data
            const data = packet.networkData();
            if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
                this.onPeerData(data);
            } else if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
                this.onHostData(data);
            }
        }

        packet.setField("status", BestWaifu.MZPeer.ReliablePacket.Statuses.ACKNOWLEDGED);
        this._reliablePackets[packet_id] = packet;
        this._sendReliablePacket(packet.username(), packet);
        return;
    }

    if (status === BestWaifu.MZPeer.ReliablePacket.Statuses.ACKNOWLEDGED) {
        $gameNetwork.pushLog("Reliable packet acknowledged: " + packet_id);
        delete this._reliablePackets[packet_id];
    }
};

/** Where handshakes are renewed, retried and destroyed. */
BestWaifu.MZPeer.NetworkRouter.prototype.pollHandshakes = function() {
    for (const handshake of Object.values(this._handshakes)) {
        if (!handshake) {
            console.warn("Skipping null or undefined handshake.")
            continue;
        }

        switch (handshake.getField("status")) {
            case BestWaifu.MZPeer.NetworkHandshake.Statuses.UNRESOLVED:
                // Only Handshake owner has authority to renew an unresolved handshake
                if (handshake.isExpired()) {
                    if (handshake.getField("owner") === $gameNetwork.username) {
                        handshake.renew();
                        $gameNetwork.pushLog("Retrying unresolved handshake: " + handshake.getUniqueId());
                        handshake.setField("retries", handshake.getField("retries", 0) + 1);
                        if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
                            this.sendToGuest(handshake.getField("recipient"), handshake);
                        } else if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
                            this.sendToHost(handshake);
                        }
                    } else {
                        $gameNetwork.pushLog("Purging unresolved handshake: " + handshake.getUniqueId());
                        handshake.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PURGED);
                    }
                }
                break;

            case BestWaifu.MZPeer.NetworkHandshake.Statuses.PENDING_ACK:
                // Only handshake recipient has authority to renew a pending handshake
                if (handshake.isExpired()) {
                    if (handshake.getField("recipient") === $gameNetwork.username) {
                        handshake.renew();
                        $gameNetwork.pushLog("Retrying pending handshake: " + handshake.getUniqueId());
                        handshake.setField("retries", handshake.getField("retries", 0) + 1);
                        if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
                            this.sendToGuest(handshake.getField("recipient"), handshake);
                        } else if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
                            this.sendToHost(handshake);
                        }
                    } else {
                        $gameNetwork.pushLog("Purging pending handshake: " + handshake.getUniqueId());
                        handshake.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PURGED);
                    }
                }
                break;
            

            case BestWaifu.MZPeer.NetworkHandshake.Statuses.PURGED:
                $gameNetwork.pushLog("Deleting purged handshake: " + handshake.getUniqueId());
                delete this._handshakes[handshake.getUniqueId()];
                break;

            case BestWaifu.MZPeer.NetworkHandshake.Statuses.RESOLVED:
                $gameNetwork.pushLog("Deleting resolved handshake: " + handshake.getUniqueId());
                delete this._handshakes[handshake.getUniqueId()];
                break;
        }
    }
};

/** Where reliable packets are renewed, retried and destroyed. */
BestWaifu.MZPeer.NetworkRouter.prototype.pollReliablePackets = function() {
    for (const packet of Object.values(this._reliablePackets)) {
        if (packet.getField("status") === BestWaifu.MZPeer.ReliablePacket.Statuses.UNACKNOWLEDGED) {
            if (packet.isExpired()) {
                $gameNetwork.pushLog("Retrying reliable packet: " + packet.getField("packet_id"));
                packet.renew();
                this._sendReliablePacket(packet.username(), packet);
            }
        } else {
            $gameNetwork.pushLog("Cleaning acknowledged packet: " + packet.getField("packet_id"));
            delete this._reliablePackets[packet.getField("packet_id")]
        }
    }
};

/**
 * Register a listener to recieve the given data type on the specified side.
 * @param {string} network_data_type
 * @param {int} listening_side
 * @param {function} listener 
 */
BestWaifu.MZPeer.NetworkRouter.prototype.addNetworkDataListener = function(network_data_type, listening_side, listener) {
    if (!listener) throw new Error("Cannot assign an empty listener.");
    this._dataListeners.push({ "type": network_data_type, "callback": listener, "side": listening_side });
};

/**
 * 
 * @param {string} id 
 * @param {function} unresolved A handshake that was just initiated. This must return an object representing network data to send.
 * @param {function} pending A handshake that is pending. This must return an object representing the manipulated network data.
 * @param {function} resolved Runs when the handshake fully resolves. No return value.
 */
BestWaifu.MZPeer.NetworkRouter.prototype.addHandshakeListener = function(id, unresolved, pending, resolved=function(){}) {
  if (!unresolved) throw new Error("Cannot assign an empty unresolved listener.");
  if (!pending) throw new Error("Cannot assign an empty pending listener.");
  // Resolved is optional
  this._handshakeListeners.push(
    { unresolved, pending, resolved, id }
  );
};

BestWaifu.MZPeer.NetworkRouter.prototype.addHandshake = function(handshake) {
    this._handshakes[handshake.getUniqueId()] = handshake;
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        $gameNetwork.pushLog("[Host] Starting new handshake: " + handshake.getUniqueId());
        this.sendToGuest(handshake.getField("recipient"), handshake);
    } else if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        $gameNetwork.pushLog("[Guest] Starting new handshake: " + handshake.getUniqueId());
        this.sendToHost(handshake);
    }
};

BestWaifu.MZPeer.NetworkRouter.prototype.sendToGuest = function(username, network_data) {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) {
        throw new Error("Only host can send data to guests.")
    }
    const payload = network_data.data();
    for (const dataConnection of $gameNetwork.peerConnections) {
        if (!dataConnection.open) continue;
        if (dataConnection.metadata?.username === username) {
            try {
                dataConnection.send(payload);
            } catch(e) {
                console.error("Failed to send to guest:" + e["message"]);
            }
            break;
        }
    }
};

BestWaifu.MZPeer.NetworkRouter.prototype.sendToHost = function(network_data) {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) {
        throw new Error("Only guest can send data to host.")
    }
    if (!$gameNetwork.hostConnection || !$gameNetwork.hostConnection.open) throw new Error("Attempted to send to a host that does not exist.");
    $gameNetwork.hostConnection.send(network_data.data());
};

BestWaifu.MZPeer.NetworkRouter.prototype.sendToGuests = function(network_data) {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) {
        throw new Error("Only host can send data to guests.")
    }
    const payload = network_data.data();
    for (const dataConnection of $gameNetwork.peerConnections) {
        if (!dataConnection.open) continue;
        try {
            dataConnection.send(payload);
        } catch (e) {
            console.error("Failed to send to guest:", e);
        }
    }
};

/** Send to every guest except the one that originated the data. */
BestWaifu.MZPeer.NetworkRouter.prototype.sendToGuestsExcept = function (excluded_username, network_data) {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) {
        throw new Error("Only host can send data to guests.");
    }
    const payload = network_data.data();
    for (const dataConnection of $gameNetwork.peerConnections) {
        if (!dataConnection.open) continue;
        if (dataConnection.metadata?.username === excluded_username) continue;
        try {
            dataConnection.send(payload);
        } catch (e) {
            console.error("Failed to send to guest:", e);
        }
    }
};

BestWaifu.MZPeer.NetworkRouter.prototype.sendData = function (network_data, target_side) {
    // Send to all guests if we're host
    if (target_side === BestWaifu.MZPeer.Sides.Guest) {
        if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) return;
        this.sendToGuests(network_data);
    }

    // Send to host if we're guest
    if (target_side === BestWaifu.MZPeer.Sides.Host) {
        if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) return;
        this.sendToHost(network_data);
    }

    // Send to either
    if (target_side === BestWaifu.MZPeer.Sides.Common) {
        // all guests
        if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
            this.sendToGuests(network_data);
        }

        // host
        if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
            this.sendToHost(network_data);
        }
    }
};

//#endregion


//#endregion

BestWaifu.MZPeer.Sides = {
    Common: 0, // Everyone
    Local: 1, // Just me (Offline)
    Host: 2, // Just host
    Guest: 3 // Just me (Online)
}

$gameNetwork = {};
$gameNetwork.username = "";
$gameNetwork.offlineMode = false; // Used if we cannot connect to the traversal server

// Contains player object references
$allPlayers = [];
// Contains remote player objects
$remotePlayers = [];

/** Completely reset the network. */
$gameNetwork.reset = function () {
    $gameNetwork.peer = null; // Our Peer Object
    $gameNetwork.lobbyId = ""; // The current Lobby ID
    $gameNetwork.hostPeerId = ""; //  The peer ID of the host.
    $gameNetwork.side = BestWaifu.MZPeer.Sides.Local; // Our side
    $gameNetwork.playerList = []; // A list of NetworkPlayers
    $gameNetwork.spawnablePlayers = []; // A queue of players waiting to spawn.
    $gameNetwork.hostUsername = ""


    // The game characters of all players in the session
    // Other players are a Remote_Player
    // The local player is Game_Player
    $remotePlayers = [];
    $allPlayers = [];

    // Used for opening/closing the lobby to automatically drop new peers that try to connect.
    // Also used by Guests to reject all other peer connections to enforce Host Authority P2P.
    $gameNetwork.open = false;

    $gameNetwork.peerConnections = []; // For juggling data connections and handling authorization as host
    $gameNetwork.hostConnection = null; // For letting the host know things as guest

    // Avoid double definition/timer overlapping by checking first
    if (!$gameNetwork["router"]) {
          // For routing data
        $gameNetwork.router = new BestWaifu.MZPeer.NetworkRouter();
    }
};

Object.defineProperty(window, "$allPlayers", {
    get: function () {
        return [$gamePlayer, ...$remotePlayers];
    }
});

// Technically for initializing but I'm not a pedant and it makes sense in later usages
$gameNetwork.reset();

//#region Network Helpers

/**
 * Do we have guest connections?
 * @returns bool
 */
$gameNetwork.hasGuestConnections = function() {
    return $gameNetwork.peerConnections.length > 0;
};

/** Safely destroy the connection on either side. */
$gameNetwork.disconnectSession = function() {
    if (this.side === BestWaifu.MZPeer.Sides.Host) {
        this.sendData(
            new BestWaifu.MZPeer.NetworkResponse(BestWaifu.MZPeer.NetworkResponse.Codes.DISCONNECT),
            BestWaifu.MZPeer.Sides.Guest);
        this.destroySession();
    }
    if (this.side === BestWaifu.MZPeer.Sides.Guest) {
        this.sendRequest(new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.DISCONNECT));
        this.destroySession();
    }
};

/**
 * Helper for sending data to all guests
 * @param {BestWaifu.MZPeer.NetworkData} network_data 
 */
$gameNetwork.sendToGuests = function (network_data) {
    this.router.sendToGuests(network_data);
};

/**
 * Helper for sending network data
 * @param {BestWaifu.MZPeer.NetworkData} network_data 
 * @param {BestWaifu.MZPeer.Sides} side 
 * @returns 
 */
$gameNetwork.sendData = function (network_data, side) {
    this.router.sendData(network_data, side);
};

/**
 * Convenience function for sending requests
 * @param {BestWaifu.MZPeer.NetworkRequest} networkRequest 
 */
$gameNetwork.sendRequest = function (networkRequest) {
    $gameNetwork.sendData(networkRequest, BestWaifu.MZPeer.Sides.Host);
};

/**
 * Convenience function for sending data to a guest
 * @param {BestWaifu.MZPeer.NetworkData} networkData 
 */
$gameNetwork.sendResponse = function (username, networkData) {
    this.router.sendToGuest(username, networkData);
};

$gameNetwork.showJoinLobby = function () {
    if (!$gameNetwork.username) return
    const peer = $gameNetwork.createGuestSession();
    SceneManager.push(BestWaifu.MZPeer.Scene_JoinLobby);
    SceneManager.prepareNextScene(peer, BestWaifu.MZPeer.lobbyIdLength);
};


// Destroy the current session (Common)
$gameNetwork.destroySession = function () {
    $gameNetwork.router.reset();
    if ($gameNetwork.peer && !$gameNetwork.peer.destroyed) {
        $gameNetwork.peer.destroy();
    }
    $gameNetwork.reset();
    console.log("Successfully destroyed the session.");
};

// Drop a peer (Host)
$gameNetwork.dropPeer = function (username) {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) {
        throw new Error("Only host can drop peers.");
    }

    const connIndex = $gameNetwork.peerConnections.findIndex(c => c.metadata.username === username);
    if (connIndex >= 0) {
        $gameNetwork.peerConnections[connIndex].close();
        $gameNetwork.peerConnections.splice(connIndex, 1);
    }

    $gameNetwork.purgePlayer(username);
    if ($gameNetwork.router) {
        $gameNetwork.router.purgePeer(username);
    }
};

/** For purging player objects. */
$gameNetwork.purgePlayer = function(username) {
    $remotePlayers = $remotePlayers.filter(p => p.username !== username);
    $allPlayers = $allPlayers.filter(p => p.username !== username);
    $gameNetwork.playerList = $gameNetwork.playerList.filter(u => u !== username);
    $gameNetwork.spawnablePlayers = $gameNetwork.spawnablePlayers.filter(u => u !== username);
};

/** Safe method to call on the guest for getting rid of a given player's data. */
$gameNetwork.destroyPlayer = function(username) {
    $gameNetwork.purgePlayer(username);
    if ($gameNetwork.router) {
        $gameNetwork.router.purgePeer(username);
    }
    $gameMap.requestRefresh();
    $gamePlayer.refresh();
};

$gameNetwork.makePlayerList = function () {
    $gameNetwork.playerList = [$gameNetwork.username];
    for (const peerConnection of $gameNetwork.peerConnections) {
        if (!peerConnection) throw new error("Undefined peer connection found when making player list.")
        $gameNetwork.playerList.push(peerConnection.metadata?.username);
    }
};

$gameNetwork.errorQueue = [];
$gameNetwork.pushError = function (message) {
    $gameNetwork.errorQueue.push(message);
};

$gameNetwork.pushLog = function(message) {
    console.log(message);
    if (SceneManager._scene && SceneManager._scene instanceof Scene_Map) {
        if (SceneManager._scene._networkDebugConsoleWindow) {
            SceneManager._scene._networkDebugConsoleWindow.pushLog(message);
        }
    }
};

//#endregion

//#region Connection Handlers

$gameNetwork.onHostConnectionError = function (error) {
    $gameNetwork.destroySession();
    SceneManager._scene.fadeOutAll();
    SceneManager.goto(Scene_Title);
    switch (error.type) {
        case "network":
            $gameNetwork.pushError("Lost connection to host.");
            break;
        case "disconnected":
            $gameNetwork.pushError("Disconnected from host.");
            break;
        default:
            $gameNetwork.pushError("Unknown netplay error.");
            break;
    }
    $gameNetwork.pushError(error.message);
};

$gameNetwork.onHostDisconnected = function () {
    $gameNetwork.destroySession();
    SceneManager._scene.fadeOutAll();
    SceneManager.goto(Scene_Title);
    $gameNetwork.pushError("Disconnected from session.");
};

$gameNetwork.onError = function (error) {
    $gameNetwork.destroySession();
    let message = "";
    switch (error.type) {
        case "network":
        case "disconnected":
            message = "No connection to traversal server.";
            $gameNetwork.offlineMode = true;
            break;
        case "invalid-id":
            message = "Invalid network ID detected.";
            break;
        case "invalid-key":
            message = "Invalid network key provided.";
            break;
        case "peer-unavailable":
        case "server-error":
            message = "Cannot connect to host.";
            break;
        case "socket-error":
            message = "A socket error occured.";
            break;
        case "socket-closed":
            message = "The socket closed.";
            break;
        case "unavailable-id":
            message = "Network ID already exists. Try again."
            break;
        default:
            message = "Something went wrong.";
            break;
    }
    $gameNetwork.pushError(message + "\n" + error.message);
};

$gameNetwork.onPeerConnection = function (dataConnection) {
    if (!$gameNetwork.open) {
        $gameNetwork.pushLog("Rejecting connection from remote peer. Not accepting new connections.");
        dataConnection.close();
        return;
    }

    const username = dataConnection.metadata?.username;
    if (!username) {
        $gameNetwork.pushLog("Rejecting connection: no username provided.");
        dataConnection.close();
        return;
    }

    if (username === $gameNetwork.username) {
        $gameNetwork.pushLog("Rejecting connection: username conflicts with host.");
        dataConnection.close();
        return;
    }

    // Check if we already have a peer with the same username
    const existingIndex = $gameNetwork.peerConnections.findIndex(conn => conn.metadata?.username === username);
    if (existingIndex >= 0) {
        const existingPeer = $gameNetwork.peerConnections[existingIndex];
        $gameNetwork.pushLog(`Replacing old connection for "${username}" with new peer.`);
        existingPeer.close(); // destroy the old connection
        $gameNetwork.peerConnections.splice(existingIndex, 1);
    }

    if ($gameNetwork.peerConnections.length + 1 > BestWaifu.MZPeer.maxPlayers) {
        $gameNetwork.pushLog("Rejected connection: Lobby is full.");
        dataConnection.close();
        return;
    }

    $gameNetwork.pushLog(`${username} connected.`);
    $gameNetwork.peerConnections.push(dataConnection);
    dataConnection.on('data', $gameNetwork.router.onPeerData.bind($gameNetwork.router));
    dataConnection.on('close', $gameNetwork.onPeerDisconnection.bind(this, dataConnection));
};

$gameNetwork.onPeerDisconnection = function (peerConnection) {
    if (peerConnection === undefined || peerConnection === null) {
        throw new Error("onPeerDisconnection: peerConnection cannot be null or undefined.");
    }
    $gameNetwork.pushLog(`${peerConnection.metadata?.username} disconnected.`);
    
    /** Drop them on our end. */
    $gameNetwork.dropPeer(peerConnection.metadata?.username);

    /** Let guests know the player is gone. */
    $gameNetwork.sendToGuests(
        new BestWaifu.MZPeer.SyncPlayerDestruction(peerConnection.metadata?.username)
    );

    if (BestWaifu.MZPeer.PlayerLeaveVar > 0) {
        $gameVariables.setValue(BestWaifu.MZPeer.PlayerLeaveVar, $gameSystem.numberForUser(peerConnection.metadata?.username));
    }

    if (SceneManager._scene && SceneManager._scene instanceof Scene_Map) {
        if (BestWaifu.MZPeer.PlayerLeaveCE > 0) {
            $gameTemp.reserveCommonEvent(BestWaifu.MZPeer.PlayerLeaveCE);
        }
        $gameMap.requestRefresh();
    }
};

//#endregion

//#region Host Data Listeners

$gameNetwork.router.addNetworkDataListener("request", BestWaifu.MZPeer.Sides.Host, data => {
    const request = new BestWaifu.MZPeer.NetworkRequest();
    request.fromData(data);
    switch (request.getField("code")) {

        case BestWaifu.MZPeer.NetworkRequest.Codes.DISCONNECT: {
            $gameNetwork.pushLog(`[Host] ${request.username()} disconnected.`);
            
            /** Drop them on our end. */
            $gameNetwork.dropPeer(request.username());

            /** Let guests know the player is gone. */
            $gameNetwork.sendToGuests(
                new BestWaifu.MZPeer.SyncPlayerDestruction(request.username())
            );

            break;
        }

        case BestWaifu.MZPeer.NetworkRequest.Codes.INITIALIZE_PLAYERS: {
            // Sync Guests
            $gameNetwork.pushLog(`[Host] ${request.username()} requested initialization of players.`);
            for (const player of $remotePlayers) {
                const guest_player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();
                guest_player_creation_sync.setField("tick", -1);
                guest_player_creation_sync.setField("username", player.username);
                guest_player_creation_sync.setField("x", player.x);
                guest_player_creation_sync.setField("y", player.y);
                $gameNetwork.sendResponse(request.username(), guest_player_creation_sync);
            }
            // Sync us (Host)
            const host_player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();

            host_player_creation_sync.setField("tick", -1);
            host_player_creation_sync.setField("username", $gameNetwork.username);
            host_player_creation_sync.setField("x", $gamePlayer.x);
            host_player_creation_sync.setField("y", $gamePlayer.y);
            $gameNetwork.sendResponse(request.username(), host_player_creation_sync);
            break;
        }

        case BestWaifu.MZPeer.NetworkRequest.Codes.REORIENT: {
            $gameNetwork.pushLog(`[Host] ${request.username()} requested reorientation of players.`);
            
            for (const player of $remotePlayers) {
                const guest_player_orientation_sync = new BestWaifu.MZPeer.SyncPlayerOrientation();
                
                guest_player_orientation_sync.setField("username", player.username);
                guest_player_orientation_sync.setField("x", player.x);
                guest_player_orientation_sync.setField("y", player.y);
                guest_player_orientation_sync.setField("direction", player.direction());

                $gameNetwork.sendResponse(request.username(), guest_player_orientation_sync);
            }
            
            const host_orientation_sync = new BestWaifu.MZPeer.SyncPlayerOrientation();
            
            host_orientation_sync.setField("x", $gamePlayer.x);
            host_orientation_sync.setField("y", $gamePlayer.y);
            host_orientation_sync.setField("direction", $gamePlayer.direction());

            $gameNetwork.sendResponse(request.username(), host_orientation_sync);
            break;
        }

        default:
            console.warn("Unhandled request code:", request.getField("code"));
            break;
    }
});

//#endregion

//#region Guest Data Listeners

$gameNetwork.router.addNetworkDataListener("sync_player_number", BestWaifu.MZPeer.Sides.Guest, data => {
    const player_number_sync = new BestWaifu.MZPeer.SyncPlayerNumber();
    player_number_sync.fromData(data);
    $gameNetwork.pushLog(`[Guest] Registering ${player_number_sync.getField("player", "unknown")} to number ${player_number_sync.getField("order", 2)}`);
    $gameSystem.registerPlayer(
        player_number_sync.getField("player"),
        player_number_sync.getField("order")
    )
});

$gameNetwork.router.addNetworkDataListener("response", BestWaifu.MZPeer.Sides.Guest, data => {
    const response = new BestWaifu.MZPeer.NetworkResponse();
    response.fromData(data);
    $gameNetwork.pushLog(`[Guest] Recieved response from ${response.username()}`)
    switch (response.getField("code")) {
        case BestWaifu.MZPeer.NetworkResponse.Codes.DISCONNECT:
            $gameNetwork.pushLog("[Guest] Disconnect signal recieved.");
            $gameNetwork.onHostDisconnected();
            break;

        case BestWaifu.MZPeer.NetworkResponse.Codes.RESET:
            $gameNetwork.pushLog("[Guest] Reset signal recieved.");
            SceneManager.goto(BestWaifu.MZPeer.Scene_NetplayWaiting);
            $gameNetwork.sendRequest(new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.INIT));
            break;

        default:
            console.warn(`Unhandled host response code: ${response.getField("code")}`);
            break;
    }
});

$gameNetwork.router.addNetworkDataListener("sync_player_creation", BestWaifu.MZPeer.Sides.Guest, data => {
    const player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();
    player_creation_sync.fromData(data);
    $gameNetwork.pushLog(`[Guest] Creating player ${player_creation_sync.getField("username")}`);
    if (player_creation_sync.getField("username") == $gameNetwork.username) {
        SceneManager.goto(Scene_Map);
    } else {
        $gameNetwork.createRemotePlayer(
            player_creation_sync.getField("username"),
            player_creation_sync.getField("x", $gamePlayer.x),
            player_creation_sync.getField("y", $gamePlayer.y)
        );
    }
    $gameNetwork.pushLog(`[Guest] Successfully synced ${$allPlayers.length - 1} players.`)
});

$gameNetwork.router.addNetworkDataListener("sync_player_list", BestWaifu.MZPeer.Sides.Guest, data => {
    const player_list_sync = new BestWaifu.MZPeer.SyncPlayerList();
    player_list_sync.fromData(data);
    $gameNetwork.pushLog("[Guest] Updating player list.");
    $gameNetwork.playerList = player_list_sync.getField("list", []);
});

$gameNetwork.router.addNetworkDataListener("sync_player_destruction", BestWaifu.MZPeer.Sides.Guest, data => {
    const player_destruction = new BestWaifu.MZPeer.SyncPlayerDestruction();
    player_destruction.fromData(data);
    if (player_destruction.getField("username", null) === null) throw new Error("Username must be defined.");
    
    if (BestWaifu.MZPeer.PlayerLeaveVar > 0) {
        $gameVariables.setValue(BestWaifu.MZPeer.PlayerLeaveVar, $gameSystem.numberForUser(player_destruction.getField("username")));
    }

    if (BestWaifu.MZPeer.PlayerLeaveCE > 0) {
        $gameTemp.reserveCommonEvent(BestWaifu.MZPeer.PlayerLeaveCE);
    }

    $gameNetwork.destroyPlayer(player_destruction.getField("username"));
});

$gameNetwork.router.addNetworkDataListener("request", BestWaifu.MZPeer.Sides.Guest, data => {
    const request = new BestWaifu.MZPeer.NetworkRequest();
    request.fromData(data);
    switch (request.getField("code", -1)) {
        case BestWaifu.MZPeer.NetworkRequest.Codes.REORIENT: {
            $gameNetwork.pushLog(`[Guest] Host requested reorientation.`);
            if ($gamePlayer) {
                $gamePlayer.sendOrientationData();
            }
            break;
        }
        default:
            $gameNetwork.pushLog(`Unhandled request from host: ${request.getField("code", -1)}`);
            break;
    }
});

//#endregion

//#region Common Data Listeners

$gameNetwork.router.addNetworkDataListener("sync_player_movement", BestWaifu.MZPeer.Sides.Common, data => {
    if (!(SceneManager._scene && SceneManager._scene instanceof Scene_Map && SceneManager._scene.isActive())) {
        $gameNetwork.pushLog("Rejecting movement sync data: Not on map.")
        return;
    }

    const player_movement_sync = new BestWaifu.MZPeer.SyncPlayerMovement();
    player_movement_sync.fromData(data);

    for (const remotePlayer of $remotePlayers) {
        if (remotePlayer.username != player_movement_sync.getField("username")) continue;
        //$gameNetwork.pushLog(`${player_movement_sync.getField("username")} <->`);
        remotePlayer.movementGraph.addNode(player_movement_sync);
        remotePlayer.movementGraph.applyLatest();
    }

    if ($gameNetwork.side == BestWaifu.MZPeer.Sides.Host) {
        //$gameNetwork.pushLog(`Routing ${player_movement_sync.getField("username")} <->`);
        $gameNetwork.router.sendToGuests(player_movement_sync);
    }
});

/** Graphless position syncing. Used only to ensure maximum truth and not to be confused with locate tracking. */
$gameNetwork.router.addNetworkDataListener("sync_player_orientation", BestWaifu.MZPeer.Sides.Common, data => {
    if (!(SceneManager._scene && SceneManager._scene instanceof Scene_Map && SceneManager._scene.isActive())) {
        $gameNetwork.pushLog("Rejecting orientation sync data: Not on map.")
        return;
    }
    
    
    const player_orientation_sync = new BestWaifu.MZPeer.SyncPlayerOrientation();
    player_orientation_sync.fromData(data);

    $gameNetwork.pushLog(`[Common] Syncing orientation for ${player_orientation_sync.getField("username")}`);

    for (const remotePlayer of $remotePlayers) {
        if (remotePlayer.username != player_orientation_sync.getField("username")) continue;
        remotePlayer.locate(player_orientation_sync.getField("x", 0), player_orientation_sync.getField("y", 0));
        remotePlayer.setDirection(player_orientation_sync.getField("direction", 2));
    }

    if ($gameNetwork.side == BestWaifu.MZPeer.Sides.Host) {
        $gameNetwork.router.sendToGuests(player_orientation_sync);
    }

});

/** Graphed teleportation syncing. */
$gameNetwork.router.addNetworkDataListener("sync_player_locate", BestWaifu.MZPeer.Sides.Common, data => {
    if (!(SceneManager._scene && SceneManager._scene instanceof Scene_Map && SceneManager._scene.isActive())) {
        $gameNetwork.pushLog("Rejecting locate sync data: Not on map.")
        return;
    }
    
    const player_locate_sync = new BestWaifu.MZPeer.SyncPlayerLocate();
    player_locate_sync.fromData(data);

    for (const remotePlayer of $remotePlayers) {
        if (remotePlayer.username != player_locate_sync.getField("username")) continue;

        remotePlayer.movementGraph.addNode(player_locate_sync);

        $gameNetwork.pushLog(`${remotePlayer.username} located. NT: ${player_locate_sync.getField("tick", -1)} GT:${remotePlayer.movementGraph.getField("tick", 0)}`);

        remotePlayer.movementGraph.applyLatest();
    }

    if ($gameNetwork.side == BestWaifu.MZPeer.Sides.Host) {
        $gameNetwork.router.sendToGuests(player_locate_sync)
    }

});

//#endregion

//#region Handshake Listeners

/** The initialization handshake. The guest sends it on a successful connection to the start the chain. */
$gameNetwork.router.addHandshakeListener("init", data => {
    // Unresolved
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) throw new Error("Attempted to call unresolved init logic on guest.");
    const network_data = new BestWaifu.MZPeer.NetworkData(data.type);
    network_data.fromData(data);
    if (!network_data.getField("username")) throw new Error("Nonexistent username provided.");

    $gameNetwork.pushLog("[Host] Handing username data to: " + network_data.getField("username"));

    // Reverse the username field
    network_data.setField("username", $gameNetwork.username);

    return network_data.data();
}, data => {
    // Pending
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) throw new Error("Attempted to call pending init logic on host.");
    
    const network_data = new BestWaifu.MZPeer.NetworkData(data.type);
    network_data.fromData(data);
    if (!network_data.getField("username")) throw new Error("Nonexistent username provided.");

    $gameNetwork.pushLog("[Guest] Now tracking host: " + network_data.getField("username"));

    $gameNetwork.hostUsername = network_data.getField("username");

    return network_data.data();
}, data => {
    // Resolved
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) throw new Error("Attempted to call resolved init logic on host.");

    $gameNetwork.pushLog("[Guest] Next init step: save_data");
    const save_handshake = BestWaifu.MZPeer.NetworkHandshake.create(
        $gameNetwork.hostUsername,
        "save_data",
        new BestWaifu.MZPeer.NetworkData("empty")
    );

    $gameNetwork.router.addHandshake(save_handshake);
});

$gameNetwork.router.addHandshakeListener("save_data", data => {
    // Unresolved
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) throw new Error("Attempted to call unresolved save_data logic on guest.");

    // Track the player in the numbering system
    $gameSystem.addPlayer(data.username);

    // Track them for existing players
    $gameNetwork.pushLog("[Host] Updating number system for existing players.");
    const player_number_sync = new BestWaifu.MZPeer.SyncPlayerNumber();
    player_number_sync.setField("player", data.username);
    const player_number = $gameSystem.numberForUser(data.username);
    player_number_sync.setField("order", player_number);
    $gameNetwork.router.sendReliableToGuests(player_number_sync, data.username);

    // Make save data
    const save_sync = new BestWaifu.MZPeer.SyncSaveData();
    save_sync.makeSave();
    $gameNetwork.pushLog(`[Host] ${data.username} was sent save data.`);

    return save_sync.data();
}, data => {
    // Pending
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) throw new Error("Attempted to call pending save_data logic on host.");
    const save_sync = new BestWaifu.MZPeer.SyncSaveData();
    save_sync.fromData(data);
    save_sync.loadSave();
    $gameNetwork.pushLog("[Guest] Successfully loaded save.")
    return save_sync.data();

}, data => {
    // Resolved
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) throw new Error("Attempted to call resolved save_data logic on host.");
    
    $gameNetwork.pushLog("[Guest] Next init step: player_list");
    const player_list_handshake = BestWaifu.MZPeer.NetworkHandshake.create(
        $gameNetwork.hostUsername,
        "player_list",
        new BestWaifu.MZPeer.NetworkData("empty")
    );

    $gameNetwork.router.addHandshake(player_list_handshake);
});

$gameNetwork.router.addHandshakeListener("player_list", data => {
    // Unresolved
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) throw new Error("Attempted to call unresolved player_list logic on guest.");

    $gameNetwork.pushLog(`[Host] ${data.username} was sent the player list.`);

    $gameNetwork.makePlayerList();
    const player_list_data = new BestWaifu.MZPeer.SyncPlayerList();
    player_list_data.setField("list", $gameNetwork.playerList);

    // Update the player list for existing guests
    $gameNetwork.router.sendReliableToGuests(player_list_data);

    return player_list_data.data();
}, data => {
    // Pending
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) throw new Error("Attempted to call pending player_list logic on host.");
    const player_list_data = new BestWaifu.MZPeer.SyncPlayerList();
    player_list_data.fromData(data);

    $gameNetwork.playerList = player_list_data.getField("list", []);
    $gameNetwork.pushLog("[Guest] Successfully loaded player list.");

    return player_list_data.data();
}, data => {
    // Resolved
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) throw new Error("Attempted to call resolved player_list logic on host.");

    $gameNetwork.pushLog("[Guest] Finalizing initialization.");
    const init_final = BestWaifu.MZPeer.NetworkHandshake.create(
        $gameNetwork.hostUsername,
        "init_final",
        new BestWaifu.MZPeer.NetworkData("empty")
    );
    $gameNetwork.router.addHandshake(init_final);
});

$gameNetwork.router.addHandshakeListener("init_final", data => {
    // Unresolved
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) throw new Error("Attempted to call unresolved init_final logic on guest.");

    $gameNetwork.pushLog(`[Host] ${data.username} was marked as spawnable.`);
    
    // Designate the player as spawnable/creatable
    $gameNetwork.spawnablePlayers.push(data.username);

    if (BestWaifu.MZPeer.AutoSpawn) $gameNetwork.spawnLastPlayer($gamePlayer.x, $gamePlayer.y);

    return data;
}, data => {
    // Pending
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) throw new Error("Attempted to call pending init_final logic on host.");
    $gameNetwork.pushLog(`[Guest] Initialization complete.`);
    return data;
});


//#endregion


//#region Network System Logic/hooks

$gameNetwork.onResync = function() {
    if (!window["$gameMap"]) return;
    if (SceneManager._scene && SceneManager._scene instanceof Scene_Map && SceneManager._scene.isActive()) {
        $gameMap.resyncRemotePlayers();
    }
};

BestWaifu.MZPeer.Scene_Map_start = Scene_Map.prototype.start;
Scene_Map.prototype.start = function () {
    // Session creation
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Local) {
        if ($gameNetwork.username && BestWaifu.MZPeer.shouldAutoCreateSession) {
            $gameNetwork.pushLog(`Session created successfully.`);
            $gameNetwork.createHostSession();
        }
    }

    BestWaifu.MZPeer.Scene_Map_start.call(this);

    // Player creation
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        if ($allPlayers.length < $gameNetwork.playerList.length) {
            $gameNetwork.pushLog(`[Scene_Map] Requesting player initialization.`);
            $gameNetwork.sendRequest(new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.INITIALIZE_PLAYERS));
        }
    }

    $gameMap.resyncRemotePlayers();
};

Game_Map.prototype.resyncRemotePlayers = function() {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Local) {
        $gameNetwork.pushLog(`[Scene_Map] Resyncing remote players.`);
        const reorient_request = new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.REORIENT);
        $gameNetwork.sendData(reorient_request, BestWaifu.MZPeer.Sides.Common);
    }
};

BestWaifu.MZPeer.Scene_Base_update = Scene_Base.prototype.update;
Scene_Base.prototype.update = function () {
    BestWaifu.MZPeer.Scene_Base_update.call(this);
    if (!this.isBusy() && !SceneManager.isSceneChanging()) {
        const error = $gameNetwork.errorQueue.pop();
        if (error) {
            SceneManager.push(BestWaifu.MZPeer.Scene_ErrorAlert);
            SceneManager.prepareNextScene(error);
        }
    }
}

// Disable saving as guest
BestWaifu.MZPeer.Scene_Map_shouldAutosave = Scene_Map.prototype.shouldAutosave;
Scene_Map.prototype.shouldAutosave = function () {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) return false;
    return BestWaifu.MZPeer.Scene_Map_shouldAutosave.call(this);
};

BestWaifu.MZPeer.Window_MenuCommand_isSaveEnabled = Window_MenuCommand.prototype.isSaveEnabled;
Window_MenuCommand.prototype.isSaveEnabled = function () {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) return false;
    return BestWaifu.MZPeer.Window_MenuCommand_isSaveEnabled.call(this);
};

// Make game end disconnect the session
BestWaifu.MZPeer.Scene_GameEnd_commandToTitle = Scene_GameEnd.prototype.commandToTitle;
Scene_GameEnd.prototype.commandToTitle = function() {
    $gameNetwork.disconnectSession();
    BestWaifu.MZPeer.Scene_GameEnd_commandToTitle.call(this);
};

//-----------------------------------------------------------------------------
// Bind Player Numbers to Usernames
//
BestWaifu.MZPeer.Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function () {
    this._players = { 1: $gameNetwork.username };
    BestWaifu.MZPeer.Game_System_initialize.call(this);
};

Game_System.prototype.addPlayer = function(username) {
    if (Object.values(this._players).includes(username)) return;
    const currentPlayerCount = Object.keys(this._players).length;
    this._players[currentPlayerCount + 1] = username;
};

Game_System.prototype.registerPlayer = function(username, number) {
    if (Object.values(this._players).includes(username)) return;
    if (Object.keys(this._players).includes(number)) return;
    this._players[number] = username;
};

Game_System.prototype.players = function () {
    return this._players;
};

/** Provides the number for the given username. */
Game_System.prototype.numberForUser = function (username) {
    for (const N of Object.keys(this._players)) {
        if (this._players[N] == username) return N;
    }
    return -1;
};

/** Provides the username for the given number. */
Game_System.prototype.userForNumber = function(playerNumber) {
    return this._players[playerNumber];
};

/** Provides the actor associated with the given player's number. */
Game_System.prototype.actorForNumber = function(playerNumber) {
    return $gameParty.members()[playerNumber - 1] || null;
};

//#endregion

//#region Common GUI Components

//-----------------------------------------------------------------------------
// Window_ErrorAlertCommand
//
BestWaifu.MZPeer.Window_ErrorAlertCommand = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Window_ErrorAlertCommand.prototype = Object.create(Window_HorzCommand.prototype);
BestWaifu.MZPeer.Window_ErrorAlertCommand.prototype.constructor = BestWaifu.MZPeer.Window_ErrorAlertCommand;

BestWaifu.MZPeer.Window_ErrorAlertCommand.prototype.makeCommandList = function () {
    this.addCommand("Ok", "ok");
};

//-----------------------------------------------------------------------------
// Scene_ErrorAlert
//
// A generic error scene
BestWaifu.MZPeer.Scene_ErrorAlert = function () {
    this.initialize(...arguments);
};
BestWaifu.MZPeer.Scene_ErrorAlert.prototype = Object.create(Scene_MenuBase.prototype);
BestWaifu.MZPeer.Scene_ErrorAlert.prototype.constructor = BestWaifu.MZPeer.Scene_ErrorAlert;

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.initialize = function () {
    Scene_MenuBase.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.prepare = function (message) {
    this._message = message;
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);
    this.createMessageWindow();
    this.createCommandWindow();
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.createMessageWindow = function () {
    this._messageWindow = new Window_Help(this.messageWindowRect());
    if (!this._message) { this.popScene(); return; }
    this._messageWindow.setText(this._message);
    this.addWindow(this._messageWindow);
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.createCommandWindow = function () {
    this._commandWindow = new BestWaifu.MZPeer.Window_ErrorAlertCommand(this.commandWindowRect());
    this._commandWindow.setHandler("ok", this.popScene.bind(this));
    this._commandWindow.setHandler("cancel", this.popScene.bind(this));
    this.addWindow(this._commandWindow);
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.messageWindowRect = function () {
    const wx = 0;
    const wy = this.mainAreaTop();
    const ww = Graphics.boxWidth;
    const wh = Graphics.boxHeight - this.calcWindowHeight(1, true);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.commandWindowRect = function () {
    const wx = 0;
    const wy = this._messageWindow.height;
    const ww = Graphics.boxWidth;
    const wh = this.calcWindowHeight(1, true);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.isAlphaNumeric = function (char) {
    const regex = /[a-z0-9]+/i
    return regex.test(char);
};

BestWaifu.MZPeer.isInviteCodeChar = function (char) {
    if (char.length > 1) return true;
    return BestWaifu.MZPeer.lobbyIdCharacters.includes(char);
};

//-----------------------------------------------------------------------------
// Window_TextInput
BestWaifu.MZPeer.Window_TextInput = function () {
    this.initialize(...arguments);
}

BestWaifu.MZPeer.Window_TextInput.prototype = Object.create(Window_NameInput.prototype);
BestWaifu.MZPeer.Window_TextInput.prototype.constructor = BestWaifu.MZPeer.Window_TextInput;

BestWaifu.MZPeer.Window_TextInput.prototype.table = function () {
    return [
        Window_NameInput.LATIN1,
        Window_NameInput.LATIN2
    ];
};

BestWaifu.MZPeer.Window_TextInput.prototype.drawItem = function (index) {
    const table = this.table();
    const character = table[this._page][index];
    const rect = this.itemLineRect(index);
    if (this._editWindow) {
        this.changePaintOpacity(this._editWindow.isValidChar(character));
        if (!this._editWindow.isValidChar(character)) {
            this.changeTextColor(ColorManager.textColor(7));
        }
    }
    this.drawText(character, rect.x, rect.y, rect.width, "center");
    this.resetTextColor();
};

BestWaifu.MZPeer.Window_TextInput.prototype.onNameOk = function () {
    this.playOkSound();
    this.callOkHandler();
};

//-----------------------------------------------------------------------------
// Window_TextEdit
BestWaifu.MZPeer.Window_TextEdit = function () {
    this.initialize(...arguments);
};
BestWaifu.MZPeer.Window_TextEdit.prototype = Object.create(Window_NameEdit.prototype);
BestWaifu.MZPeer.Window_TextEdit.prototype.constructor = BestWaifu.MZPeer.Window_TextEdit;

BestWaifu.MZPeer.Window_TextEdit.prototype.initialize = function (rect) {
    Window_StatusBase.prototype.initialize.call(this, rect);
    this._maxLength = 0;
    this._name = "";
    this.deactivate();
};

BestWaifu.MZPeer.Window_TextEdit.prototype.isValidChar = function (ch) {
    return BestWaifu.MZPeer.isAlphaNumeric(ch);
};

BestWaifu.MZPeer.Window_TextEdit.prototype.add = function (ch) {
    if (!this.isValidChar(ch)) return false;
    return Window_NameEdit.prototype.add.call(this, ch);
};

BestWaifu.MZPeer.Window_TextEdit.prototype.setup = function (maxLength) {
    this._maxLength = maxLength;
};

BestWaifu.MZPeer.Window_TextEdit.prototype.restoreDefault = function () {
    this._name = "";
};

BestWaifu.MZPeer.Window_TextEdit.prototype.refresh = function () {
    this.contents.clear();
    for (let i = 0; i < this._maxLength; i++) {
        this.drawUnderline(i);
    }
    for (let j = 0; j < this._name.length; j++) {
        this.drawChar(j);
    }
    const rect = this.itemRect(this._index);
    this.setCursorRect(rect.x, rect.y, rect.width, rect.height);
};
//#endregion

//#region Netplay Menus

//#region Title Screen Edit

Window_TitleCommand.prototype.makeCommandList = function() {
    const continueEnabled = this.isContinueEnabled();
    this.addCommand(TextManager.newGame, "newGame");
    this.addCommand(BestWaifu.MZPeer.NETPLAY, "netplay")
    this.addCommand(TextManager.continue_, "continue", continueEnabled);
    this.addCommand(TextManager.options, "options");
};

BestWaifu.MZPeer.Scene_Title_createCommandWindow = Scene_Title.prototype.createCommandWindow;
Scene_Title.prototype.createCommandWindow = function() {
    BestWaifu.MZPeer.Scene_Title_createCommandWindow.call(this);
    this._commandWindow.setHandler("netplay", this.commandNetplay.bind(this));
};

Scene_Title.prototype.commandNetplay = function() {
    this._commandWindow.close();
    SceneManager.push(BestWaifu.MZPeer.Scene_NetplayOptions);
};


//#endregion

//#region Joined Player Display


BestWaifu.MZPeer.Window_JoinedPlayerDisplay = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype = Object.create(Window_Selectable.prototype);
BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype.constructor = BestWaifu.MZPeer.Window_JoinedPlayerDisplay;

BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype.initialize = function(rect) {
    Window_Selectable.prototype.initialize.call(this, rect);
    this.deactivate();
    this.deselect();
    this.upArrowVisible = false;
    this.downArrowVisible = false;
    this.setBackgroundType(2);
};

BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype.maxCols = function() {
    return this.maxItems();
};

BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype.updateArrows = function() {};

BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype.maxItems = function() {
    return BestWaifu.MZPeer.maxPlayers;
};

BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype.maxRows = function() {
    return 1;
};

BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype.itemHeight = function() {
    return this.height;
};

BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype.maxPageRows = function() {
    return 1;
};

BestWaifu.MZPeer.Window_JoinedPlayerDisplay.prototype.drawItem = function(index) {
    const rect = this.itemRect(index);
    const playerNumber = index + 1;
    const actor = $gameSystem.actorForNumber(playerNumber);
    const user = $gameSystem.userForNumber(playerNumber) ?? ""
    this.resetTextColor();
    this.changePaintOpacity(user !== "");
    this.drawText(`P${playerNumber}`, rect.x + this.padding, rect.y + this.padding, rect.width, "left");
    if (!user) return;
    if (!actor) return;
    this.drawCharacter(actor.characterName(), actor.characterIndex(), rect.x + (rect.width / 2), rect.y + 32 + this.padding);
    this.drawText(user, rect.x, rect.y + this.lineHeight(), rect.width, "center")
};



//#endregion

//#region Pregame Lobby

BestWaifu.MZPeer.Window_LobbyCommand = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Window_LobbyCommand.prototype = Object.create(Window_HorzCommand.prototype);
BestWaifu.MZPeer.Window_LobbyCommand.prototype.constructor = BestWaifu.MZPeer.Window_LobbyCommand;

BestWaifu.MZPeer.Window_LobbyCommand.prototype.makeCommandList = function() {
    this.addCommand("Disconnect", "disconnect");
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        this.addCommand("Start Game", "start", this.startGameEnabled())
    }
};

BestWaifu.MZPeer.Window_LobbyCommand.prototype.startGameEnabled = function() {
    return $gameNetwork.hasGuestConnections();
};

BestWaifu.MZPeer.Window_PlayerList = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Window_PlayerList.prototype = Object.create(Window_Command.prototype);
BestWaifu.MZPeer.Window_PlayerList.prototype.constructor = BestWaifu.MZPeer.Window_PlayerList;

BestWaifu.MZPeer.Window_PlayerList.prototype.makeCommandList = function() {
    this.addCommand(`\\c[6]${$gameNetwork.username}\\c[0]`);
    for (const username of $gameNetwork.playerList) {
        this.addCommand(username);
    }
};

BestWaifu.MZPeer.Window_PlayerList.prototype.drawItem = function(index) {
    const rect = this.itemLineRect(index);
    const align = this.itemTextAlign();
    this.resetTextColor();
    this.changePaintOpacity(this.isCommandEnabled(index));
    this.drawTextEx(this.commandName(index), rect.x, rect.y, rect.width, align);
};


BestWaifu.MZPeer.Scene_PreGameLobby = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Scene_PreGameLobby.prototype = Object.create(Scene_MenuBase.prototype);
BestWaifu.MZPeer.Scene_PreGameLobby.prototype.constructor = BestWaifu.MZPeer.Scene_PreGameLobby;

BestWaifu.MZPeer.Scene_PreGameLobby.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createAllWindows();
};

BestWaifu.MZPeer.Scene_PreGameLobby.prototype.createAllWindows = function() {
    this._statusWindow = new Window_Help(this.statusWindowRect());
    this._statusWindow.setText(`Invite Code ${$gameNetwork.lobbyId.toUpperCase()}`);
    this.addWindow(this._statusWindow);


    this._playerListCommand = new BestWaifu.MZPeer.Window_PlayerList(this.playerListRect());
    this._playerListCommand.deselect();
    this._playerListCommand.deactivate();
    this.addWindow(this._playerListCommand);

    this._commandWindow = new BestWaifu.MZPeer.Window_LobbyCommand(this.commandWindowRect());
    this._commandWindow.setHandler('disconnect', this.onDisconnect.bind(this));


    this.addWindow(this._commandWindow);
};

BestWaifu.MZPeer.Scene_PreGameLobby.prototype.onDisconnect = function() {
    $gameNetwork.disconnectSession();
    this.fadeOutAll();
    SceneManager.goto(Scene_Title);
};

BestWaifu.MZPeer.Scene_Title_start = Scene_Title.prototype.start;
Scene_Title.prototype.start = function() {
    // Prevent maintaining a connection on the title screen (e.g. from Game Over or manual title returns)
    if ($gameNetwork.isSessionReady()) {
        $gameNetwork.disconnectSession();
    }
    BestWaifu.MZPeer.Scene_Title_start.call(this);
};

BestWaifu.MZPeer.Scene_PreGameLobby.prototype.onStart = function() {
    this.fadeOutAll();
    $gameNetwork.router.sendToGuests(new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.GOTO_MAP));
    this.popScene();
};

BestWaifu.MZPeer.Scene_PreGameLobby.prototype.statusWindowRect = function() {
    const wx = 0;
    const wy = 0;
    const ww = Graphics.boxWidth;
    const wh = this.calcWindowHeight(2, false);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_PreGameLobby.prototype.playerListRect = function() {
    const wx = 0;
    const wy = this.statusWindowRect().height;
    const ww = Graphics.boxWidth;
    const wh = Graphics.boxHeight - this.calcWindowHeight(1, true) - this.calcWindowHeight(2, false);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_PreGameLobby.prototype.commandWindowRect = function() {
    const wx = 0;
    const wy = this.playerListRect().height + this.statusWindowRect().height;
    const ww = Graphics.boxWidth;
    const wh = this.calcWindowHeight(1, true);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_PreGameLobby.prototype.update = function() {
    this._playerListCommand.refresh();
    this._commandWindow.refresh();
    Scene_Base.prototype.update.call(this);
};



//#endregion

//#region Join Lobby Scene

//-----------------------------------------------------------------------------
// Scene_JoinLobby
//
BestWaifu.MZPeer.Scene_JoinLobby = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype = Object.create(Scene_MenuBase.prototype);
BestWaifu.MZPeer.Scene_JoinLobby.prototype.constructor = BestWaifu.MZPeer.Scene_JoinLobby;

BestWaifu.MZPeer.Scene_JoinLobby.prototype.initialize = function () {
    Scene_MenuBase.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.prepare = function (peer, maxLength) {
    this._maxLength = maxLength;
    this._peer = peer;
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onConnected = function () {
    // May have a password system later, idk
    this.onAuthorized();
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onAuthorized = function () {
    this.fadeOutAll();
    SceneManager.goto(BestWaifu.MZPeer.Scene_NetplayWaiting);
    
    const net_data = new BestWaifu.MZPeer.NetworkData("empty");
    net_data.setField("username", $gameNetwork.username);

    const init_handshake = BestWaifu.MZPeer.NetworkHandshake.create(
        "", // Recipient blank, host shouldn't care
        "init",
        net_data
    );

    $gameNetwork.pushLog("Initiating connection handshake as:  " + net_data.getField("username"))

    $gameNetwork.router.addHandshake(init_handshake);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onConnectionError = function (err) {
    $gameNetwork.pushError("Failed to connect to host.");
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onRejected = function () {
    $gameNetwork.pushError("Lost connection to host.");
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);
    this.createEditWindow();
    this.createInputWindow();
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.createEditWindow = function () {
    const rect = this.editWindowRect();
    this._editWindow = new BestWaifu.MZPeer.Window_TextEdit(rect);
    this._editWindow.isValidChar = BestWaifu.MZPeer.isInviteCodeChar;
    this._editWindow.setup(this._maxLength);
    this.addWindow(this._editWindow);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.createInputWindow = function () {
    const rect = this.inputWindowRect();
    this._inputWindow = new BestWaifu.MZPeer.Window_TextInput(rect);
    this._inputWindow.setEditWindow(this._editWindow);
    this._inputWindow.setHandler("ok", this.onInputOk.bind(this));
    this.addWindow(this._inputWindow);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.editWindowRect = function () {
    const inputWindowHeight = this.calcWindowHeight(9, true);
    const padding = $gameSystem.windowPadding();
    const ww = 600;
    const wh = ImageManager.standardFaceHeight + padding * 2;
    const wx = (Graphics.boxWidth - ww) / 2;
    const wy = (Graphics.boxHeight - (wh + inputWindowHeight + 8)) / 2;
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.inputWindowRect = function () {
    const wx = this._editWindow.x;
    const wy = this._editWindow.y + this._editWindow.height + 8;
    const ww = this._editWindow.width;
    const wh = this.calcWindowHeight(9, true);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.makeConnection = function (lobbyId) {
    // Construct the Peer ID from the Lobby ID
    const hostPeerId = $gameNetwork.makePeerId(lobbyId);
    $gameNetwork.lobbyId = lobbyId;

    // Connect to host
    $gameNetwork.hostConnection = this._peer.connect(hostPeerId, {
        label: "host",
        metadata: {
            "rmmzpeer-guest": true,
            "version": BestWaifu.MZPeer.Version,
            "username": $gameNetwork.username,
        },
        reliable: false
    });

    // Apply the listeners
    $gameNetwork.hostConnection.on('open', this.onConnected.bind(this));
    $gameNetwork.hostConnection.on('close', $gameNetwork.onHostDisconnected);
    $gameNetwork.hostConnection.on('error', $gameNetwork.onHostConnectionError);
    $gameNetwork.hostConnection.on('data', $gameNetwork.router.onHostData.bind($gameNetwork.router));
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onInputOk = function () {
    if (this._editWindow.name().length < BestWaifu.MZPeer.lobbyIdLength) {
        $gameNetwork.destroySession();
        this.popScene();
        return;
    };

    const lobbyId = this._editWindow.name().toLowerCase();
    if (lobbyId) {
        this.makeConnection(lobbyId);
    }

    this.popScene();
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.start = function () {
    Scene_MenuBase.prototype.start.call(this);
    this._editWindow.refresh();
};
//#endregion

//#region Network Debug Windows

BestWaifu.MZPeer.Window_NetworkDataLog = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Window_NetworkDataLog.prototype = Object.create(Window_Command.prototype);
BestWaifu.MZPeer.Window_NetworkDataLog.prototype.constructor = BestWaifu.MZPeer.Window_NetworkDataLog;

BestWaifu.MZPeer.Window_NetworkDataLog.prototype.initialize = function(rect) {
    this._logMessages = [];
    Window_Command.prototype.initialize.call(this, rect);
    this.deselect();
    this.deactivate();
};

BestWaifu.MZPeer.Window_NetworkDataLog.prototype.makeCommandList = function() {
    for (const message of this._logMessages.slice(this._logMessages.length - 4)) {
        this.addCommand(message);
    }
};

BestWaifu.MZPeer.Window_NetworkDataLog.prototype.pushLog = function(message) {
    this._logMessages.push(message);
    this.refresh();
    this.forceSelect(this.maxItems());
    this.deselect();
    this.deactivate();
};

BestWaifu.MZPeer.Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
Scene_Map.prototype.createAllWindows = function() {
    this.createJoinedPlayerWindow();
    BestWaifu.MZPeer.Scene_Map_createAllWindows.call(this);
    this.createNetworkDebugConsoleWindow();
};

Scene_Map.prototype.createNetworkDebugConsoleWindow = function() {
    if ($gameTemp.isPlaytest()) {
        this._networkDebugConsoleWindow = new BestWaifu.MZPeer.Window_NetworkDataLog(this.networkDebugConsoleWindowRect());
        this.addWindow(this._networkDebugConsoleWindow);
    }
};

Scene_Map.prototype.createJoinedPlayerWindow = function() {
    this._joinedPlayerDisplay = new BestWaifu.MZPeer.Window_JoinedPlayerDisplay(this.joinedPlayerDisplayRect());
    this.addWindow(this._joinedPlayerDisplay);
    this._joinedPlayerDisplay.refresh();
};

Scene_Map.prototype.joinedPlayerDisplayRect = function() {
    const wx = 0;
    const wh = this.calcWindowHeight(2, true);
    const wy = Graphics.boxHeight - wh;
    const ww = Graphics.boxWidth;
    return new Rectangle(wx, wy, ww, wh);
};

Scene_Map.prototype.networkDebugConsoleWindowRect = function() {
    const wx = 0;
    const wy = 0;
    const ww = Graphics.boxWidth;
    const wh = this.calcWindowHeight(2, true);
    return new Rectangle(wx, wy, ww, wh);
};


//#endregion

//-----------------------------------------------------------------------------
// #region Network Options
//
// By default the username is blank and online play won't be possible without it being set
Object.defineProperty(ConfigManager, "username", {
    get: function () {
        return $gameNetwork.username;
    },
    set: function (value) {
        $gameNetwork.username = value;
    },
    configurable: true
});

BestWaifu.MZPeer.ConfigManager_makeData = ConfigManager.makeData;
ConfigManager.makeData = function () {
    const config = BestWaifu.MZPeer.ConfigManager_makeData.call(this);
    config.username = this.username;
    return config;
};

BestWaifu.MZPeer.ConfigManager_applyData = ConfigManager.applyData;
ConfigManager.applyData = function (config) {
    this.username = this.readString(config, "username");
    BestWaifu.MZPeer.ConfigManager_applyData.call(this);
};

ConfigManager.readString = function (config, name) {
    if (name in config) {
        return String(config[name])
    } else {
        return ""
    }
};


BestWaifu.MZPeer.Window_Options_makeCommandList = Window_Options.prototype.makeCommandList;
Window_Options.prototype.makeCommandList = function () {
    BestWaifu.MZPeer.Window_Options_makeCommandList.call(this);
    this.addNetworkOptions();
};

Window_Options.prototype.addNetworkOptions = function () {
    this.addCommand(BestWaifu.MZPeer.NETPLAY, "netplay");
};

Window_Options.prototype.isNetworkSymbol = function (symbol) {
    return symbol === "netplay";
};

BestWaifu.MZPeer.Window_Options_statusText = Window_Options.prototype.statusText;
Window_Options.prototype.statusText = function (index) {
    const symbol = this.commandSymbol(index);
    if (this.isNetworkSymbol(symbol)) {
        return this.booleanStatusText($gameNetwork.username != "");
    }
    return BestWaifu.MZPeer.Window_Options_statusText.call(this, index);
};

BestWaifu.MZPeer.Window_Options_processOk = Window_Options.prototype.processOk;
Window_Options.prototype.processOk = function () {
    const index = this.index();
    const symbol = this.commandSymbol(index);
    if (this.isNetworkSymbol(symbol)) {
        SceneManager.push(BestWaifu.MZPeer.Scene_NetplayOptions);
    } else {
        BestWaifu.MZPeer.Window_Options_processOk.call(this);
    }
};

BestWaifu.MZPeer.Scene_Options_maxCommands = Scene_Options.prototype.maxCommands;
Scene_Options.prototype.maxCommands = function () {
    return BestWaifu.MZPeer.Scene_Options_maxCommands.call(this) + 1;
};

//-----------------------------------------------------------------------------
// Window_NetPlayOptions
//
BestWaifu.MZPeer.Window_NetplayOptions = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Window_NetplayOptions.prototype = Object.create(Window_Command.prototype);
BestWaifu.MZPeer.Window_NetplayOptions.prototype.constructor = BestWaifu.MZPeer.Window_NetplayOptions;

BestWaifu.MZPeer.Window_NetplayOptions.prototype.userIdChangable = function () {
    return $gameNetwork.side === BestWaifu.MZPeer.Sides.Local;
};

BestWaifu.MZPeer.Window_NetplayOptions.prototype.makeCommandList = function () {
    if ($gameNetwork.username && $gameNetwork.side === BestWaifu.MZPeer.Sides.Local) {
        this.addCommand(BestWaifu.MZPeer.ENTER_ROOM_CODE, "join")
    }
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest || $gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        this.addCommand(BestWaifu.MZPeer.DISCONNECT, "disconnect");
    }

    this.addCommand(BestWaifu.MZPeer.SET_USERNAME, "username", this.userIdChangable());
};


//-----------------------------------------------------------------------------
// #region Scene_UsernameInput
//
BestWaifu.MZPeer.Scene_UsernameInput = function () {
    this.initialize(...arguments);
};
BestWaifu.MZPeer.Scene_UsernameInput.prototype = Object.create(Scene_MenuBase.prototype);
BestWaifu.MZPeer.Scene_UsernameInput.prototype.constructor = BestWaifu.MZPeer.Scene_UsernameInput;

BestWaifu.MZPeer.Scene_UsernameInput.prototype.initialize = function () {
    Scene_MenuBase.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);
    this.createEditWindow();
    this.createInputWindow();
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.prepare = function (maxLength) {
    this._maxLength = maxLength;
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.createEditWindow = function () {
    const rect = this.editWindowRect();
    this._editWindow = new BestWaifu.MZPeer.Window_TextEdit(rect);
    this._editWindow.setup(this._maxLength);
    this.addWindow(this._editWindow);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.createInputWindow = function () {
    const rect = this.inputWindowRect();
    this._inputWindow = new BestWaifu.MZPeer.Window_TextInput(rect);
    this._inputWindow.setEditWindow(this._editWindow);
    this._inputWindow.setHandler("ok", this.onInputOk.bind(this));
    this.addWindow(this._inputWindow);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.editWindowRect = function () {
    const inputWindowHeight = this.calcWindowHeight(9, true);
    const padding = $gameSystem.windowPadding();
    const ww = 600;
    const wh = ImageManager.standardFaceHeight + padding * 2;
    const wx = (Graphics.boxWidth - ww) / 2;
    const wy = (Graphics.boxHeight - (wh + inputWindowHeight + 8)) / 2;
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.inputWindowRect = function () {
    const wx = this._editWindow.x;
    const wy = this._editWindow.y + this._editWindow.height + 8;
    const ww = this._editWindow.width;
    const wh = this.calcWindowHeight(9, true);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.onInputOk = function () {
    ConfigManager.username = this._editWindow.name() || "";
    this.popScene();
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.start = function () {
    Scene_MenuBase.prototype.start.call(this);
    this._editWindow.refresh();
};
//#endregion

//-----------------------------------------------------------------------------
// #region Scene_NetplayOptions
//
BestWaifu.MZPeer.Scene_NetplayOptions = function () {
    this.initialize(...arguments);
};
BestWaifu.MZPeer.Scene_NetplayOptions.prototype = Object.create(Scene_MenuBase.prototype);
BestWaifu.MZPeer.Scene_NetplayOptions.prototype.constructor = BestWaifu.MZPeer.Scene_NetplayOptions;

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.initialize = function () {
    Scene_MenuBase.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);
    this.createAllWindows();
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.createAllWindows = function () {
    this.createLobbyStatusWindow();
    this.createCommandWindow();
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.sideText = function () {
    switch ($gameNetwork.side) {
        case BestWaifu.MZPeer.Sides.Guest:
            return "\\c[4]Guest\\c[0]";
        case BestWaifu.MZPeer.Sides.Host:
            return "\\c[6]Host\\c[0]";
        default:
            return "\\c[7]Not connected\\c[0]"
    }
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.lobbyText = function () {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Local) {
        return "";
    }
    return "| Lobby ID " + $gameNetwork.lobbyId.toUpperCase();
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.helpText = function () {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Local) {
        if (!$gameNetwork.username) {
            return "\\c[10]A username must be set to use netplay.\\c[0]";
        } else {
            return "Username: " + $gameNetwork.username + "\nThe game will automatically be set to host when \ncreating or loading a save. To disable, set to blank.";
        }
    }
    return "Username: " + $gameNetwork.username;
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.createLobbyStatusWindow = function () {
    this._lobbyStatusWindow = new Window_Help(this.lobbyStatusRect());
    this._lobbyStatusWindow.setText(
        this.sideText()
        + this.lobbyText()
        + "\n"
        + this.helpText()
    );
    this.addWindow(this._lobbyStatusWindow);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.createCommandWindow = function () {
    this._commandWindow = new BestWaifu.MZPeer.Window_NetplayOptions(this.commandWindowRect());
    this._commandWindow.setHandler("cancel", this.popScene.bind(this));

    this._commandWindow.setHandler("disconnect", this.onDisconnect.bind(this));
    this._commandWindow.setHandler("join", this.onJoin.bind(this));
    this._commandWindow.setHandler("username", this.onUsername.bind(this));

    this.addWindow(this._commandWindow);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.onDisconnect = function () {
    $gameNetwork.disconnectSession();
    this.fadeOutAll();
    SceneManager.goto(Scene_Title);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.onJoin = function () {
    $gameNetwork.showJoinLobby();
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.onUsername = function () {
    SceneManager.push(BestWaifu.MZPeer.Scene_UsernameInput);
    SceneManager.prepareNextScene(8);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.lobbyStatusRect = function () {
    const wx = 0;
    const wy = this.mainAreaTop();
    const ww = Graphics.boxWidth;
    const wh = this.calcWindowHeight(4, false);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.commandWindowRect = function () {
    const wx = 0;
    let wy = this.mainAreaTop();
    const ww = Graphics.boxWidth;
    let wh = Graphics.boxHeight;

    if (this["_lobbyStatusWindow"]) {
        wh -= this._lobbyStatusWindow.height;
        wy += this._lobbyStatusWindow.height;
    }

    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.start = function () {
    Scene_MenuBase.prototype.start.call(this);
    this._commandWindow.refresh();
};

//#endregion

//-----------------------------------------------------------------------------
// #region Scene_NetplayWaiting
//
// A scene to send the guest to while things are loading.
BestWaifu.MZPeer.Scene_NetplayWaiting = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype = Object.create(Scene_Base.prototype);
BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.constructor = BestWaifu.MZPeer.Scene_NetplayWaiting;

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.initialize = function () {
    this._animationFrames = 0;
    this._timeoutTimer = null;
    Scene_Base.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.create = function () {
    Scene_Base.prototype.create.call(this);
    this.createForeground();
    this.startTimeout();
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.startTimeout = function() {
    this._timeoutTimer = setTimeout(this.onTimeout.bind(this), 10000) // 10000ms = 10 seconds
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.stopTimeout = function() {
    if (this._timeoutTimer) {
        clearTimeout(this._timeoutTimer);
        this._timeoutTimer = null;
    }
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.onTimeout = function() {
    $gameNetwork.pushError("Connection timed out.");
    $gameNetwork.disconnectSession();
    SceneManager.goto(Scene_Title);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.createForeground = function () {
    this._loadingSprite = new Sprite(
        new Bitmap(Graphics.width, Graphics.height)
    );
    this.addChild(this._loadingSprite);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.update = function () {
    if (!this.isBusy()) {
        this.animate();
    }
    Scene_Base.prototype.update.call(this);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.circleX = function (order, bitmap, radius) {
    const diameter = (radius * 2) * 1.25;
    return ((bitmap.width / 2) - diameter) + (diameter * order)
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.circleY = function (order, bitmap, radius) {
    const diameter = radius * 2;

    let y = bitmap.height / 2;

    if (this.activeCircleOrder() === order) {
        y -= (this._animationFrames / 4);
    }

    return y;
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.activeCircleOrder = function () {
    return Math.floor(this._animationFrames / 24);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.animate = function () {
    if (!this._loadingSprite) return;
    if (this._animationFrames > 71) this._animationFrames = 0;

    const bitmap = this._loadingSprite.bitmap;
    const circleRadius = 18;

    bitmap.clear();

    for (let i = 0; i < 3; i++) {
        bitmap.drawCircle(
            this.circleX(i, bitmap, circleRadius),
            this.circleY(i, bitmap, circleRadius),
            circleRadius,
            this.activeCircleOrder() === i ? "white" : "gray");
    }

    this._animationFrames++;
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.start = function () {
    Scene_Base.prototype.start.call(this);
    SceneManager.clearStack();
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.terminate = function () {
    this.stopTimeout();
    Scene_Base.prototype.terminate.call(this);
    if (this._loadingSprite) {
        this._loadingSprite.bitmap.destroy();
    }
};

//#endregion


//#endregion

//#endregion

//-----------------------------------------------------------------------------
// #region Lobbies/PeerJS
//
// Hosting, joining, and leaving lobbies. 
// * The player that created the lobby is designated host.
// * Host save data is the data that is loaded and synced.

$gameNetwork.makeLobbyId = function () {
    let id = "";
    for (let i = 0; i < BestWaifu.MZPeer.lobbyIdLength; i++) {
        id += BestWaifu.MZPeer.lobbyIdCharacters[Math.randomInt(BestWaifu.MZPeer.lobbyIdCharacters.length - 1)];
    }
    return id;
};

// Use the provided base + the lobby ID to make a reconstructable but compact ID
// that shouldn't clash with the server's IDs.
$gameNetwork.makePeerId = function (lobby_id) {
    return BestWaifu.MZPeer.peerIdBase + lobby_id.toLowerCase();
};

$gameNetwork.createHostSession = function () {
    if (!$gameNetwork.username) return;
    if ($gameNetwork.offlineMode) return;

    // We make an ID of our own here for user friendliness
    $gameNetwork.lobbyId = $gameNetwork.makeLobbyId();

    const peer = new Peer($gameNetwork.makePeerId($gameNetwork.lobbyId));
    $gameNetwork.open = true;

    peer.on('open', function (id) {
        $gameNetwork.pushLog(`Successfully opened session with id ${id}`);
    });

    peer.on('connection', $gameNetwork.onPeerConnection);
    peer.on('error', $gameNetwork.onError);

    $gameNetwork.peer = peer;
    $gameNetwork.side = BestWaifu.MZPeer.Sides.Host;

    return peer;
};

$gameNetwork.createGuestSession = function () {
    if (!$gameNetwork.username) return;
    if ($gameNetwork.offlineMode) return;
    // We don't generate an ID here because we only need the host's id to be
    // user friendly. The peer server will automatically generate the ID.
    const peer = new Peer();
    $gameNetwork.open = false;

    peer.on('open', function (id) {
        $gameNetwork.pushLog(`Successfully connected to traversal server with id ${id}`);
    });

    peer.on('connection', $gameNetwork.onPeerConnection);
    peer.on('error', $gameNetwork.onError);

    $gameNetwork.peer = peer;
    $gameNetwork.side = BestWaifu.MZPeer.Sides.Guest;
    return peer;
};

//#endregion

//#region Synced Game Character Objects

BestWaifu.MZPeer.Remote_Player = function () {
    this.initialize(...arguments);
}
BestWaifu.MZPeer.Remote_Player.prototype = Object.create(Game_Character.prototype);
BestWaifu.MZPeer.Remote_Player.prototype.constructor = BestWaifu.MZPeer.Remote_Player;

BestWaifu.MZPeer.Remote_Player.prototype.initialize = function (username) {
    this.username = username; // Used to identify remote players
    this.movementGraph = new BestWaifu.MZPeer.NetworkGraph();
    this.movementGraph.onApply = this.onMovementApply.bind(this);
    this._remoteMoveQueue = [];
    this._remoteLocateQueue = [];
    Game_Character.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Remote_Player.prototype.actor = function () {
    const N = $gameSystem.numberForUser(this.username);
    if (N < 0) {
        $gameNetwork.pushLog(`[ERROR] Cannot determine actor for ${this.username}`);
        return null;
    }
    return $gameSystem.actorForNumber(N);
};

BestWaifu.MZPeer.Remote_Player.prototype.refresh = function () {
    const actor = this.actor();
    const characterName = actor ? actor.characterName() : "";
    const characterIndex = actor ? actor.characterIndex() : 0;
    this.setImage(characterName, characterIndex);
};

BestWaifu.MZPeer.Remote_Player.prototype.onMovementApply = function (data) {
    if (!data || !data["type"]) {
        throw new Error("Applied data cannot be undefined or null.");
    };
    switch (data.type) {
        case "sync_player_movement": {
            const move_sync_data = new BestWaifu.MZPeer.SyncPlayerMovement();
            move_sync_data.fromData(data);
            this._remoteMoveQueue.push(move_sync_data);
            break;
        }

        case "sync_player_locate": {
            const locate_sync_data = new BestWaifu.MZPeer.SyncPlayerLocate();
            locate_sync_data.fromData(data);
            this._remoteLocateQueue.push(locate_sync_data);
            break;
        }
    }
};


BestWaifu.MZPeer.Remote_Player.prototype.update = function () {
    this.locateByNetwork();
    this.moveByNetwork();
    Game_Character.prototype.update.call(this);
};

BestWaifu.MZPeer.Remote_Player.prototype.discardRemoteActions = function() {
    this._remoteLocateQueue = [];
    this._remoteMoveQueue = [];
};

BestWaifu.MZPeer.Remote_Player.prototype.locateByNetwork = function() {
    if (!this._remoteLocateQueue.length) return;
     const queueSize = this._remoteLocateQueue.length;

    // If behind too far, discard and reorient.
    if (queueSize >= 10) {
        $gameNetwork.pushLog(`${this.username} is too far behind. Forcing reorientation.`);
        const reorient_request = new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.REORIENT);
        $gameNetwork.router.sendData(reorient_request, BestWaifu.MZPeer.Sides.Common);
        this.discardRemoteActions();
        return;
    }

    const locate_sync_data = this._remoteLocateQueue.shift();
    this.locate(locate_sync_data.getField("x", this.x), locate_sync_data.getField("y", this.y));
};

BestWaifu.MZPeer.Remote_Player.prototype.moveByNetwork = function () {
    if (!this._remoteMoveQueue.length) return;
    const queueSize = this._remoteMoveQueue.length;

    // If behind too far, discard and reorient.
    if (queueSize >= 10) {
        $gameNetwork.pushLog(`${this.username} is too far behind. Forcing reorientation.`);
        const reorient_request = new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.REORIENT);
        $gameNetwork.router.sendData(reorient_request, BestWaifu.MZPeer.Sides.Common);
        this.discardRemoteActions();
        return;
    }

    // Check if behind threshold and adjust speed accordingly
    if (queueSize >= 5) {
        $gameNetwork.pushLog(`${this.username} is too far behind. Speeding up..`);
        this.setMoveSpeed(5);
    }

    if (!this.isMoving()) {
        const move_sync_data = this._remoteMoveQueue.shift();
        if (queueSize < 5) {
            this.setMoveSpeed(move_sync_data.getField("speed", this.moveSpeed()));
        }
        this.moveStraight(move_sync_data.getField("direction"));
    }
};

// #endregion

//-----------------------------------------------------------------------------
// #region Real Time Character Syncing
//
// Make the players visibly appear on screen and move around in real time

BestWaifu.MZPeer.Scene_Map_updateMain = Scene_Map.prototype.updateMain;
Scene_Map.prototype.updateMain = function () {
    BestWaifu.MZPeer.Scene_Map_updateMain.call(this);
    for (const remotePlayer of $remotePlayers) {
        remotePlayer.update();
    }
    if (this._joinedPlayerDisplay) {
        this._joinedPlayerDisplay.refresh();
    }
};

$gameNetwork.spawnLastPlayer = function (x, y) {
    const username = $gameNetwork.spawnablePlayers.pop();
    if (username) {
        this.createRemotePlayer(username, x, y);
    } else {
        $gameNetwork.pushLog("No latest player to spawn.")
    }
};

// Create a remote player. Only valid on a map scene.
$gameNetwork.createRemotePlayer = function (username, x, y) {
    if (!(SceneManager._scene instanceof Scene_Map)) {
        throw new Error(`Attempted to create ${username}'s doll at ${x},${y} while not on the map.`)
    };

    // Avoid creating a remote player that already exists
    for (const remotePlayer of $remotePlayers) {
        if (remotePlayer.username === username) {
            $gameNetwork.pushLog(`${username}'s doll is already created.`);
            return
        }
    }

    // Track the new remote player
    const new_player = new BestWaifu.MZPeer.Remote_Player(username);
    $remotePlayers.push(new_player);

    // Add their sprite instantly (will be auto-added on map change)
    $gameNetwork.addRemotePlayerSprite(SceneManager._scene._spriteset, new_player);

    // Initialize their location
    new_player.locate(x, y);
    new_player.refresh();

    // Refresh the map and player
    $gameMap.requestRefresh();
    $gamePlayer.refresh();

    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        $gameNetwork.pushLog(`[Host] Creating ${username} for guests.`)
        const player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();
        player_creation_sync.setField("tick", -1);
        player_creation_sync.setField("username", username);
        player_creation_sync.setField("x", x);
        player_creation_sync.setField("y", y);
        $gameNetwork.router.sendReliableToGuests(player_creation_sync);
    }
};

// For instant creation of remote player sprites
$gameNetwork.addRemotePlayerSprite = function (spriteSet, remotePlayer) {
    $gameNetwork.pushLog(`Creating ${remotePlayer.username}'s sprite`)
    if (!spriteSet || !remotePlayer) return;
    const sprite = new Sprite_Character(remotePlayer);
    spriteSet._characterSprites.push(sprite);
    spriteSet._tilemap.addChild(sprite);
};

// Create the sprites for remote players automatically on the map's spriteset
Spriteset_Map.prototype.createCharacters = function () {
    this._characterSprites = [];
    for (const event of $gameMap.events()) {
        this._characterSprites.push(new Sprite_Character(event));
    }

    for (const vehicle of $gameMap.vehicles()) {
        this._characterSprites.push(new Sprite_Character(vehicle));
    }

    for (const follower of $gamePlayer.followers().reverseData()) {
        this._characterSprites.push(new Sprite_Character(follower));
    }

    for (const remotePlayer of $remotePlayers) {
        this._characterSprites.push(new Sprite_Character(remotePlayer));
    }

    this._characterSprites.push(new Sprite_Character($gamePlayer));

    for (const sprite of this._characterSprites) {
        this._tilemap.addChild(sprite);
    }
};

// Only show followers that don't have a player associated with them
BestWaifu.MZPeer.Game_Follower_isVisible = Game_Follower.prototype.isVisible;
Game_Follower.prototype.isVisible = function () {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) return false;
    if ($remotePlayers.length > 0) return false;
    return BestWaifu.MZPeer.Game_Follower_isVisible.call(this);
};


// Add collisions to remote players
Game_CharacterBase.prototype.isCollidedWithRemotePlayers = function (x, y) {
    return $remotePlayers.some(function (p) {
        return p !== this && !p.isThrough() && p.isNormalPriority() && p.pos(x, y);
    }, this);
};

BestWaifu.MZPeer.Game_CharacterBase_isCollidedWithCharacters = Game_CharacterBase.prototype.isCollidedWithCharacters;
Game_CharacterBase.prototype.isCollidedWithCharacters = function (x, y) {
    return BestWaifu.MZPeer.Game_CharacterBase_isCollidedWithCharacters.call(this, x, y) ||
        this.isCollidedWithRemotePlayers(x, y);
};

BestWaifu.MZPeer.Game_Player_initialize = Game_Player.prototype.initialize;
Game_Player.prototype.initialize = function() {
    this.createMovementGraph();
    BestWaifu.MZPeer.Game_Player_initialize.call(this);
};

BestWaifu.MZPeer.Game_Player_refresh = Game_Player.prototype.refresh;
Game_Player.prototype.refresh = function () {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        const N = $gameSystem.numberForUser($gameNetwork.username);
        const actor = $gameSystem.actorForNumber(N);
        const characterName = actor ? actor.characterName() : "";
        const characterIndex = actor ? actor.characterIndex() : 0;
        this.setImage(characterName, characterIndex);
        this._followers.refresh();
    } else {
        BestWaifu.MZPeer.Game_Player_refresh.call(this);
    }
};

BestWaifu.MZPeer.Game_Player_executeMove = Game_Player.prototype.executeMove;
Game_Player.prototype.executeMove = function (dir) {
    BestWaifu.MZPeer.Game_Player_executeMove.call(this, dir);
    
    const move_sync_data = new BestWaifu.MZPeer.SyncPlayerMovement();
    move_sync_data.setField("direction", dir);
    move_sync_data.setField("speed", this.realMoveSpeed());

    if (!this.movementGraph) this.createMovementGraph();

    this.movementGraph.tick();
    this.movementGraph.addNode(move_sync_data);
    move_sync_data.setField("tick", this.movementGraph.latestTick());

    //$gameNetwork.pushLog(`[CLIENT] Moved. NT: ${this.movementGraph.latestTick()} GT: ${this.movementGraph.getField("tick", 0)}`);

    $gameNetwork.sendData(move_sync_data, BestWaifu.MZPeer.Sides.Common);
};


Game_Player.prototype.sendOrientationData = function() {
    const player_orientation_sync = new BestWaifu.MZPeer.SyncPlayerOrientation();
    player_orientation_sync.setField("x", this.x);
    player_orientation_sync.setField("y", this.y);
    player_orientation_sync.setField("direction", this.direction());
    $gameNetwork.sendData(player_orientation_sync, BestWaifu.MZPeer.Sides.Common);
};

Game_Player.prototype.createMovementGraph = function() {
    this.movementGraph = new BestWaifu.MZPeer.NetworkGraph();
};

BestWaifu.MZPeer.Game_Player_locate = Game_Player.prototype.locate;
Game_Player.prototype.locate = function (x, y) {
    BestWaifu.MZPeer.Game_Player_locate.call(this, x, y);

    const player_locate_sync = new BestWaifu.MZPeer.SyncPlayerLocate();
    player_locate_sync.setField("x", x);
    player_locate_sync.setField("y", y);

    if (!this.movementGraph) this.createMovementGraph();

    this.movementGraph.tick();
    this.movementGraph.addNode(player_locate_sync);
    player_locate_sync.setField("tick", this.movementGraph.latestTick());

    //$gameNetwork.pushLog(`[CLIENT] Located. NT: ${this.movementGraph.latestTick()} GT: ${this.movementGraph.getField("tick", 0)}`);

    $gameNetwork.sendData(player_locate_sync, BestWaifu.MZPeer.Sides.Common);
};

//#endregion

// #region Game Sync Infrastructure

/** Define a property that JsonEx will not serialize into save files. */
BestWaifu.MZPeer.defineHiddenProperty = function (object, name, value) {
    Object.defineProperty(object, name, {
        value: value,
        writable: true,
        enumerable: false,
        configurable: true
    });
};

/** Keep only the newest nodes. Prevents the graph from growing forever. */
BestWaifu.MZPeer.NetworkGraph.prototype.trim = function (maxNodes) {
    if (this._nodes.length > maxNodes) {
        this._nodes.splice(0, this._nodes.length - maxNodes);
    }
};

/**
 * The graph holds prototype-based objects JsonEx cannot restore, so it must
 * never be written to a save file. Overrides the earlier definition.
 */
Game_Player.prototype.createMovementGraph = function () {
    BestWaifu.MZPeer.defineHiddenProperty(this, "movementGraph", new BestWaifu.MZPeer.NetworkGraph());
};

BestWaifu.MZPeer.isMapActive = function () {
    return SceneManager._scene instanceof Scene_Map && SceneManager._scene.isActive();
};

BestWaifu.MZPeer.AutoSpawn = String(BestWaifu.MZPeer.params["Auto Spawn Players"] || "true") === "true";

//#region Sync Data Types

/** Generic absolute-state change of the game. See BestWaifu.MZPeer.GameSync. */
BestWaifu.MZPeer.SyncGameData = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncGameData.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncGameData.prototype.constructor = BestWaifu.MZPeer.SyncGameData;
BestWaifu.MZPeer.SyncGameData.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_game_data");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "kind");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "key");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.OBJECT, "payload");
};

/** Used for syncing an event being locked (talked to) or unlocked. */
BestWaifu.MZPeer.SyncEventLock = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncEventLock.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncEventLock.prototype.constructor = BestWaifu.MZPeer.SyncEventLock;
BestWaifu.MZPeer.SyncEventLock.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_event_lock");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "map_id");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "event_id");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "locked");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "direction");
};

/** Host -> Guest. One ordered, reliable event of the battle stream. tick is the order. */
BestWaifu.MZPeer.SyncBattleEvent = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncBattleEvent.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncBattleEvent.prototype.constructor = BestWaifu.MZPeer.SyncBattleEvent;
BestWaifu.MZPeer.SyncBattleEvent.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_battle_event");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "kind");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "battle");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.OBJECT, "payload");
};

/** Host -> Guest. Unreliable snapshot of every battler. Newest tick wins. */
BestWaifu.MZPeer.SyncBattleState = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncBattleState.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncBattleState.prototype.constructor = BestWaifu.MZPeer.SyncBattleState;
BestWaifu.MZPeer.SyncBattleState.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_battle_state");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.OBJECT, "payload");
};

/** Guest -> Host. The actions a guest chose for the actor they own. */
BestWaifu.MZPeer.SyncBattleCommand = function () {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncBattleCommand.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncBattleCommand.prototype.constructor = BestWaifu.MZPeer.SyncBattleCommand;
BestWaifu.MZPeer.SyncBattleCommand.prototype.initialize = function () {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_battle_command");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "actor_id");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "serial");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.ARRAY, "actions");
};

/** Event sync data carries the map it belongs to so late packets can be rejected. */
for (const SyncClass of [
    BestWaifu.MZPeer.SyncEventMovement,
    BestWaifu.MZPeer.SyncEventOrientation,
    BestWaifu.MZPeer.SyncEventLocate
]) {
    const baseInitialize = SyncClass.prototype.initialize;
    SyncClass.prototype.initialize = function () {
        baseInitialize.apply(this, arguments);
        this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "map_id");
    };
}

//#endregion

//#region Sync State and Helpers

$gameNetwork.resetBattleSync = function () {
    this.battleId = 0;             // Host: id of the hosted battle. Guest: id of the mirrored battle.
    this.battleOrder = 0;          // Host: last order number sent on the battle stream.
    this.battleExpected = 1;       // Guest: next order number to process.
    this.battleBuffer = {};        // Guest: out of order events waiting on earlier ones.
    this.battleInbox = [];         // Guest: ordered events waiting for the scene to be ready.
    this.battleHosting = false;    // Host: are we forwarding a battle to guests?
    this.battleMirror = false;     // Guest: are we mirroring the host's battle?
    this.battleInputSerial = 0;    // Host: counts actor inputs. Guest: serial of the input in progress.
    this.battleInputHandled = 0;   // Guest: newest input serial we have opened.
    this.battleSnapshotTick = 0;   // Guest: newest snapshot applied.
    this.battleSnapshotDirty = false;
    this.battleSnapshotTimer = 0;
};

$gameNetwork.resetGameSync = function () {
    this.syncSeq = 0;              // Our own ever increasing tick for outgoing sync data
    this.syncQueue = {};           // key -> { kind, builder }, coalesced and flushed once per frame
    this.syncLastTicks = {};       // "sender:key" -> newest tick seen
    this.applyingRemote = false;   // True while applying data from the network. Hooks must not re-send.
    this.mapQueue = [];            // Functions waiting for the map to be active
    this.moveRoutePlayer = 0;      // Which player "Player" means in a move route. 0 is the default.
    this.battleResultCallback = null;
    this.resetBattleSync();
};

BestWaifu.MZPeer.gameNetwork_reset = $gameNetwork.reset;
$gameNetwork.reset = function () {
    BestWaifu.MZPeer.gameNetwork_reset.call(this);
    this.resetGameSync();
};
$gameNetwork.resetGameSync();

/** Is there a live connection we can actually send through? */
$gameNetwork.isSessionReady = function () {
    if (this.side === BestWaifu.MZPeer.Sides.Host) {
        return this.peerConnections.some(c => c.open);
    }
    if (this.side === BestWaifu.MZPeer.Sides.Guest) {
        return !!this.hostConnection && this.hostConnection.open && this.hostUsername !== "";
    }
    return false;
};

/** Run a function while hooks know the change came from the network. */
$gameNetwork.applyRemote = function (callback) {
    const previous = this.applyingRemote;
    this.applyingRemote = true;
    try {
        callback();
    } catch (e) {
        console.error(e);
    } finally {
        this.applyingRemote = previous;
    }
};

$gameNetwork.canSyncGameData = function () {
    return this.side !== BestWaifu.MZPeer.Sides.Local && !this.applyingRemote && this.isSessionReady();
};

/** Run now if the map is active, otherwise as soon as it is. */
$gameNetwork.whenOnMap = function (callback) {
    if (BestWaifu.MZPeer.isMapActive() && !$gamePlayer.isTransferring()) {
        callback();
    } else {
        this.mapQueue.push(callback);
    }
};

$gameNetwork.drainMapQueue = function () {
    while (this.mapQueue.length > 0 && BestWaifu.MZPeer.isMapActive() && !$gamePlayer.isTransferring()) {
        const callback = this.mapQueue.shift();
        try {
            callback();
        } catch (e) {
            console.error(e);
        }
    }
};

/** Send reliably to the other side (guests if host, host if guest). */
$gameNetwork.sendReliableCommon = function (network_data, uniqueId) {
    if (this.side === BestWaifu.MZPeer.Sides.Host) {
        this.router.sendReliableToGuests(network_data, uniqueId);
    } else if (this.side === BestWaifu.MZPeer.Sides.Guest) {
        this.router.sendReliable(this.hostUsername, network_data, uniqueId);
    }
};

/** Send a game data change right now. Prefer queueSync for things that can change many times per frame. */
$gameNetwork.sendGameData = function (key, kind, payload) {
    if (!this.isSessionReady()) return;
    const game_sync = new BestWaifu.MZPeer.SyncGameData();
    this.syncSeq++;
    game_sync.setField("tick", this.syncSeq);
    game_sync.setField("kind", kind);
    game_sync.setField("key", key);
    game_sync.setField("payload", payload);
    this.sendReliableCommon(game_sync, `${this.username}-${this.syncSeq}`);
};

/**
 * Ask for a game data change to be sent at the end of this frame. Queueing the
 * same key twice in a frame sends only the latest value, because the builder
 * is run when the queue is flushed.
 * @param {string} key Unique per thing being synced, e.g. "variable:12"
 * @param {string} kind Name of the BestWaifu.MZPeer.GameSync handler
 * @param {function} builder Returns the payload object
 */
$gameNetwork.queueSync = function (key, kind, builder) {
    if (!this.canSyncGameData()) return;
    this.syncQueue[key] = { kind, builder };
};

$gameNetwork.flushSync = function () {
    const keys = Object.keys(this.syncQueue);
    if (keys.length === 0) return;
    if (!this.isSessionReady()) {
        this.syncQueue = {};
        return;
    }
    for (const key of keys) {
        const entry = this.syncQueue[key];
        delete this.syncQueue[key];
        let payload = null;
        try {
            payload = entry.builder();
        } catch (e) {
            console.error(e);
        }
        if (payload) this.sendGameData(key, entry.kind, payload);
    }
};

/** Handlers for "sync_game_data" keyed by kind. Each receives the payload. */
BestWaifu.MZPeer.GameSync = { handlers: {} };

BestWaifu.MZPeer.GameSync.register = function (kind, handler) {
    this.handlers[kind] = handler;
};

BestWaifu.MZPeer.GameSync.receive = function (game_sync) {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Local) return;

    const kind = game_sync.getField("kind", "");
    const key = game_sync.getField("key", "");
    const tick = game_sync.getField("tick", 0);
    const payload = game_sync.getField("payload", {});
    const handler = this.handlers[kind];
    if (!handler) {
        console.warn("Unhandled game sync kind:", kind);
        return;
    }

    // Retried reliable packets can arrive late. Drop anything older than what we already have.
    const tickKey = game_sync.username() + ":" + key;
    const lastTick = $gameNetwork.syncLastTicks[tickKey];
    if (lastTick !== undefined && tick < lastTick) {
        $gameNetwork.pushLog("Dropping stale game sync: " + key);
        return;
    }
    $gameNetwork.syncLastTicks[tickKey] = tick;

    $gameNetwork.applyRemote(() => handler(payload));

    // The host puts everything in one order and tells everyone, including the originator.
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        $gameNetwork.sendGameData(key, kind, payload);
    }
};

$gameNetwork.router.addNetworkDataListener("sync_game_data", BestWaifu.MZPeer.Sides.Common, data => {
    const game_sync = new BestWaifu.MZPeer.SyncGameData();
    game_sync.fromData(data);
    BestWaifu.MZPeer.GameSync.receive(game_sync);
});

/** Once per frame: send queued data and run anything waiting on the network. */
BestWaifu.MZPeer.Scene_Base_update_sync = Scene_Base.prototype.update;
Scene_Base.prototype.update = function () {
    BestWaifu.MZPeer.Scene_Base_update_sync.call(this);
    $gameNetwork.flushSync();
    $gameNetwork.processBattleInbox();
};

BestWaifu.MZPeer.Scene_Map_updateMain_sync = Scene_Map.prototype.updateMain;
Scene_Map.prototype.updateMain = function () {
    BestWaifu.MZPeer.Scene_Map_updateMain_sync.call(this);
    $gameNetwork.drainMapQueue();
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host && Graphics.frameCount % 30 === 0) {
        $gameMap.syncEventOrientations();
    }
};

//#endregion

// #endregion

//-----------------------------------------------------------------------------
// #region Real Time Event Syncing
//
// The host is the authority over events. Guests never move events on their
// own; they only mirror what the host sends.

BestWaifu.MZPeer.findEvent = function (sync_data) {
    if (sync_data.getField("map_id", 0) !== $gameMap.mapId()) return null;
    const event = $gameMap.event(sync_data.getField("event_id", 0));
    if (!event) return null;
    if (!event.movementGraph) event.createNetworkState();
    return event;
};

BestWaifu.MZPeer.Game_Event_initialize = Game_Event.prototype.initialize;
Game_Event.prototype.initialize = function (mapId, eventId) {
    this._locatingByNetwork = false;
    this._movingByNetwork = false;
    this._netReady = false;
    this._netOrientationDirty = false;
    this.createNetworkState();
    BestWaifu.MZPeer.Game_Event_initialize.call(this, mapId, eventId);
    this._netReady = true;
};

/** Network state is hidden so it is never written to a save file. */
Game_Event.prototype.createNetworkState = function () {
    BestWaifu.MZPeer.defineHiddenProperty(this, "movementGraph", new BestWaifu.MZPeer.NetworkGraph());
    this.movementGraph.onApply = this.onMovementApply.bind(this);
    BestWaifu.MZPeer.defineHiddenProperty(this, "_remoteMoveQueue", []);
    BestWaifu.MZPeer.defineHiddenProperty(this, "_remoteLocateQueue", []);
};

/** Guests only do what the network tells them to. */
Game_Event.prototype.isNetworkControlled = function () {
    return this._netReady && $gameNetwork.side === BestWaifu.MZPeer.Sides.Guest;
};

Game_Event.prototype.canSendNetworkData = function () {
    return this._netReady && $gameNetwork.side === BestWaifu.MZPeer.Sides.Host && $gameNetwork.isSessionReady();
};

Game_Event.prototype.onMovementApply = function (data) {
    if (!data || !data["type"]) {
        throw new Error("Applied data cannot be undefined or null.");
    };
    switch (data.type) {
        case "sync_event_movement": {
            const move_sync_data = new BestWaifu.MZPeer.SyncEventMovement();
            move_sync_data.fromData(data);
            this._remoteMoveQueue.push(move_sync_data);
            break;
        }

        case "sync_event_locate": {
            const locate_sync_data = new BestWaifu.MZPeer.SyncEventLocate();
            locate_sync_data.fromData(data);
            this._remoteLocateQueue.push(locate_sync_data);
            break;
        }
    }
};

Game_Event.prototype.discardRemoteActions = function () {
    this._remoteLocateQueue = [];
    this._remoteMoveQueue = [];
};

Game_Event.prototype.locateByNetwork = function () {
    if (!this._remoteLocateQueue.length) return;

    // If behind too far, discard and ask the host for the truth.
    if (this._remoteLocateQueue.length >= 10) {
        $gameNetwork.pushLog(`EV${this._eventId} is too far behind. Forcing reorientation.`);
        this.discardRemoteActions();
        $gameMap.resyncRemotePlayers();
        return;
    }

    const locate_sync_data = this._remoteLocateQueue.shift();
    this._locatingByNetwork = true;
    this.locate(locate_sync_data.getField("x", this.x), locate_sync_data.getField("y", this.y));
};

Game_Event.prototype.moveByNetwork = function () {
    if (!this._remoteMoveQueue.length) return;
    const queueSize = this._remoteMoveQueue.length;

    // If behind too far, discard and ask the host for the truth.
    if (queueSize >= 10) {
        $gameNetwork.pushLog(`EV${this._eventId} is too far behind. Forcing reorientation.`);
        this.discardRemoteActions();
        $gameMap.resyncRemotePlayers();
        return;
    }

    // Check if behind threshold and adjust speed accordingly
    if (queueSize >= 5) {
        this.setMoveSpeed(5);
    }

    if (!this.isMoving()) {
        const move_sync_data = this._remoteMoveQueue.shift();
        if (queueSize < 5) {
            this.setMoveSpeed(move_sync_data.getField("speed", this.moveSpeed()));
        }
        this._movingByNetwork = true;
        this.moveStraight(move_sync_data.getField("direction"));
    }
};

BestWaifu.MZPeer.Game_Event_update = Game_Event.prototype.update;
Game_Event.prototype.update = function () {
    if (!this.movementGraph) this.createNetworkState();
    this.moveByNetwork();
    this.locateByNetwork();
    BestWaifu.MZPeer.Game_Event_update.call(this);
};

Game_Event.prototype.sendLocateData = function () {
    if (!this.canSendNetworkData()) return;
    const locate_sync = new BestWaifu.MZPeer.SyncEventLocate();
    locate_sync.setField("map_id", $gameMap.mapId());
    locate_sync.setField("event_id", this.eventId());
    locate_sync.setField("x", this.x);
    locate_sync.setField("y", this.y);
    this.movementGraph.tick();
    locate_sync.setField("tick", this.movementGraph.getField("tick", 0));
    $gameNetwork.sendData(locate_sync, BestWaifu.MZPeer.Sides.Guest);
};

Game_Event.prototype.sendMovementData = function (direction) {
    if (!this.canSendNetworkData() || !this.isMovementSucceeded()) return;
    const move_sync = new BestWaifu.MZPeer.SyncEventMovement();
    move_sync.setField("map_id", $gameMap.mapId());
    move_sync.setField("event_id", this.eventId());
    move_sync.setField("direction", direction);
    move_sync.setField("speed", this.realMoveSpeed());
    this.movementGraph.tick();
    move_sync.setField("tick", this.movementGraph.getField("tick", 0));
    $gameNetwork.sendData(move_sync, BestWaifu.MZPeer.Sides.Guest);
};

/** Hard sync of position and direction. Sent to one guest if a recipient is given. */
Game_Event.prototype.sendOrientationData = function (recipient = "") {
    if (!this.canSendNetworkData()) return;
    const orientation_sync = new BestWaifu.MZPeer.SyncEventOrientation();
    orientation_sync.setField("map_id", $gameMap.mapId());
    orientation_sync.setField("event_id", this.eventId());
    orientation_sync.setField("x", this.x);
    orientation_sync.setField("y", this.y);
    orientation_sync.setField("direction", this.direction());
    if (recipient) {
        $gameNetwork.sendResponse(recipient, orientation_sync);
    } else {
        $gameNetwork.sendData(orientation_sync, BestWaifu.MZPeer.Sides.Guest);
    }
};

BestWaifu.MZPeer.Game_Event_locate = Game_Event.prototype.locate;
Game_Event.prototype.locate = function (x, y) {
    const byNetwork = this._locatingByNetwork;
    this._locatingByNetwork = false;
    if (this.isNetworkControlled() && !byNetwork) return;
    BestWaifu.MZPeer.Game_Event_locate.call(this, x, y);
    this._netOrientationDirty = true;
    if (!byNetwork) this.sendLocateData();
};

BestWaifu.MZPeer.Game_Event_moveStraight = Game_Event.prototype.moveStraight;
Game_Event.prototype.moveStraight = function (direction) {
    const byNetwork = this._movingByNetwork;
    this._movingByNetwork = false;
    if (this.isNetworkControlled() && !byNetwork) return;
    BestWaifu.MZPeer.Game_Event_moveStraight.call(this, direction);
    this._netOrientationDirty = true;
    if (!byNetwork) this.sendMovementData(direction);
};

BestWaifu.MZPeer.Game_Event_setDirection = Game_Event.prototype.setDirection;
Game_Event.prototype.setDirection = function (d) {
    BestWaifu.MZPeer.Game_Event_setDirection.call(this, d);
    this._netOrientationDirty = true;
};

/** Lock (an event stops to be talked to). Synced on the common side. */
Game_Event.prototype.sendLockData = function (locked) {
    if (!this._netReady || !$gameNetwork.isSessionReady()) return;
    const lock_sync = new BestWaifu.MZPeer.SyncEventLock();
    lock_sync.setField("map_id", $gameMap.mapId());
    lock_sync.setField("event_id", this.eventId());
    lock_sync.setField("locked", locked ? 1 : 0);
    lock_sync.setField("direction", this.direction());
    $gameNetwork.sendData(lock_sync, BestWaifu.MZPeer.Sides.Common);
};

/** Apply a lock or unlock from the network without turning toward the local player. */
Game_Event.prototype.applyNetworkLock = function (locked, direction) {
    if (locked) {
        if (!this._locked) {
            this._prelockDirection = this.direction();
            this._locked = true;
        }
        this.setDirection(direction);
    } else if (this._locked) {
        this._locked = false;
        this.setDirection(this._prelockDirection);
    }
};

BestWaifu.MZPeer.Game_Event_lock = Game_Event.prototype.lock;
Game_Event.prototype.lock = function () {
    const wasLocked = this._locked;
    BestWaifu.MZPeer.Game_Event_lock.call(this);
    if (!wasLocked && this._locked) this.sendLockData(true);
};

BestWaifu.MZPeer.Game_Event_unlock = Game_Event.prototype.unlock;
Game_Event.prototype.unlock = function () {
    const wasLocked = this._locked;
    BestWaifu.MZPeer.Game_Event_unlock.call(this);
    if (wasLocked && !this._locked) this.sendLockData(false);
};

/** Events that settled somewhere get a hard sync so small drift never builds up. */
Game_Map.prototype.syncEventOrientations = function () {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host || !$gameNetwork.isSessionReady()) return;
    for (const event of this.events()) {
        if (!event._netOrientationDirty || event.isMoving()) continue;
        event._netOrientationDirty = false;
        event.sendOrientationData();
    }
};

// Erasing an event is temporary state that only the map holds, so sync it as game data.
BestWaifu.MZPeer.Game_Event_erase = Game_Event.prototype.erase;
Game_Event.prototype.erase = function () {
    const wasErased = this._erased;
    BestWaifu.MZPeer.Game_Event_erase.call(this);
    if (!wasErased) {
        const mapId = this._mapId;
        const eventId = this._eventId;
        $gameNetwork.queueSync(`erase:${mapId}:${eventId}`, "erase_event", () => ({ mapId, eventId }));
    }
};

BestWaifu.MZPeer.GameSync.register("erase_event", payload => {
    if (payload.mapId !== $gameMap.mapId()) return;
    const event = $gameMap.event(payload.eventId);
    if (event) event.erase();
});

//#region Event Data Listeners

$gameNetwork.router.addNetworkDataListener("sync_event_movement", BestWaifu.MZPeer.Sides.Guest, data => {
    if (!BestWaifu.MZPeer.isMapActive()) return;
    const move_sync = new BestWaifu.MZPeer.SyncEventMovement();
    move_sync.fromData(data);
    const event = BestWaifu.MZPeer.findEvent(move_sync);
    if (!event) return;
    event.movementGraph.addNode(move_sync);
    event.movementGraph.applyLatest();
    event.movementGraph.trim(32);
});

$gameNetwork.router.addNetworkDataListener("sync_event_locate", BestWaifu.MZPeer.Sides.Guest, data => {
    if (!BestWaifu.MZPeer.isMapActive()) return;
    const locate_sync = new BestWaifu.MZPeer.SyncEventLocate();
    locate_sync.fromData(data);
    const event = BestWaifu.MZPeer.findEvent(locate_sync);
    if (!event) return;
    event.movementGraph.addNode(locate_sync);
    event.movementGraph.applyLatest();
    event.movementGraph.trim(32);
});

$gameNetwork.router.addNetworkDataListener("sync_event_orientation", BestWaifu.MZPeer.Sides.Guest, data => {
    if (!BestWaifu.MZPeer.isMapActive()) return;
    const orientation_sync = new BestWaifu.MZPeer.SyncEventOrientation();
    orientation_sync.fromData(data);
    const event = BestWaifu.MZPeer.findEvent(orientation_sync);
    if (!event) return;
    // Anything still queued is now out of date.
    event.discardRemoteActions();
    event._locatingByNetwork = true;
    event.locate(orientation_sync.getField("x", event.x), orientation_sync.getField("y", event.y));
    event.setDirection(orientation_sync.getField("direction", event.direction()));
});

$gameNetwork.router.addNetworkDataListener("sync_event_lock", BestWaifu.MZPeer.Sides.Common, data => {
    if (!BestWaifu.MZPeer.isMapActive()) return;
    const lock_sync = new BestWaifu.MZPeer.SyncEventLock();
    lock_sync.fromData(data);
    const event = BestWaifu.MZPeer.findEvent(lock_sync);
    if (!event) return;
    event.applyNetworkLock(lock_sync.getField("locked", 0) === 1, lock_sync.getField("direction", 2));
    // Tell everyone but whoever told us.
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        $gameNetwork.router.sendToGuestsExcept(lock_sync.username(), lock_sync);
    }
});

/** Hosts also answer reorientation requests with the position of every event. */
$gameNetwork.router.addNetworkDataListener("request", BestWaifu.MZPeer.Sides.Host, data => {
    const request = new BestWaifu.MZPeer.NetworkRequest();
    request.fromData(data);
    if (request.getField("code", -1) !== BestWaifu.MZPeer.NetworkRequest.Codes.REORIENT) return;
    if (!BestWaifu.MZPeer.isMapActive()) return;
    for (const event of $gameMap.events()) {
        event.sendOrientationData(request.username());
    }
});

//#endregion

//#endregion

//-----------------------------------------------------------------------------
// #region Forced Move Route Syncing
//
// Moves made by a forced move route on the local player do not go through
// executeMove, so they were never being sent.

Game_Player.prototype.sendMovementData = function (dir) {
    const move_sync_data = new BestWaifu.MZPeer.SyncPlayerMovement();
    move_sync_data.setField("direction", dir);
    move_sync_data.setField("speed", this.realMoveSpeed());

    if (!this.movementGraph) this.createMovementGraph();

    this.movementGraph.tick();
    this.movementGraph.addNode(move_sync_data);
    move_sync_data.setField("tick", this.movementGraph.latestTick());
    this.movementGraph.trim(64);

    $gameNetwork.sendData(move_sync_data, BestWaifu.MZPeer.Sides.Common);
};

BestWaifu.MZPeer.Game_Player_moveStraight = Game_Player.prototype.moveStraight;
Game_Player.prototype.moveStraight = function (d) {
    BestWaifu.MZPeer.Game_Player_moveStraight.call(this, d);
    if (this._moveRouteForcing && this.isMovementSucceeded() && $gameNetwork.isSessionReady()) {
        this.sendMovementData(d);
    }
};

//#endregion

//-----------------------------------------------------------------------------
// #region Map Transfer Syncing
//
// When any player transfers all players should transfer with them.

BestWaifu.MZPeer.Game_Player_reserveTransfer = Game_Player.prototype.reserveTransfer;
Game_Player.prototype.reserveTransfer = function (mapId, x, y, d, fadeType) {
    BestWaifu.MZPeer.Game_Player_reserveTransfer.call(this, mapId, x, y, d, fadeType);
    if ($gameNetwork.canSyncGameData()) {
        $gameNetwork.sendGameData("transfer", "transfer", {
            origin: $gameNetwork.username,
            mapId, x, y, d, fadeType
        });
    }
};

BestWaifu.MZPeer.GameSync.register("transfer", payload => {
    // The host echoes transfers back to whoever started them. They are already there.
    if (payload.origin === $gameNetwork.username) return;
    $gameNetwork.whenOnMap(() => {
        $gameNetwork.applyRemote(() => {
            $gamePlayer.reserveTransfer(payload.mapId, payload.x, payload.y, payload.d, payload.fadeType);
        });
    });
});

//#endregion

//-----------------------------------------------------------------------------
// #region Game Data Syncing
//
// Everything is synced as absolute values through $gameNetwork.queueSync.

/** Variables the plugin itself sets per machine must never be synced. */
BestWaifu.MZPeer.localVariables = new Set();

BestWaifu.MZPeer.isLocalVariable = function (variableId) {
    return variableId > 0 && (
        variableId === BestWaifu.MZPeer.PlayerJoinVar ||
        variableId === BestWaifu.MZPeer.PlayerLeaveVar ||
        BestWaifu.MZPeer.localVariables.has(variableId)
    );
};

BestWaifu.MZPeer.itemClass = function (item) {
    if (DataManager.isItem(item)) return "item";
    if (DataManager.isWeapon(item)) return "weapon";
    if (DataManager.isArmor(item)) return "armor";
    return "";
};

BestWaifu.MZPeer.itemFromData = function (dataClass, id) {
    switch (dataClass) {
        case "item": return $dataItems[id];
        case "weapon": return $dataWeapons[id];
        case "armor": return $dataArmors[id];
        default: return null;
    }
};

// Switches
BestWaifu.MZPeer.Game_Switches_setValue = Game_Switches.prototype.setValue;
Game_Switches.prototype.setValue = function (switchId, value) {
    const old_value = this.value(switchId);
    BestWaifu.MZPeer.Game_Switches_setValue.call(this, switchId, value);
    if (this.value(switchId) !== old_value) {
        $gameNetwork.queueSync(`switch:${switchId}`, "switch",
            () => ({ id: switchId, value: $gameSwitches.value(switchId) }));
    }
};

BestWaifu.MZPeer.GameSync.register("switch", payload => {
    $gameSwitches.setValue(payload.id, payload.value);
});

// Self Switches
BestWaifu.MZPeer.Game_SelfSwitches_setValue = Game_SelfSwitches.prototype.setValue;
Game_SelfSwitches.prototype.setValue = function (key, value) {
    const old_value = this.value(key);
    BestWaifu.MZPeer.Game_SelfSwitches_setValue.call(this, key, value);
    if (this.value(key) !== old_value) {
        const key_copy = key.slice();
        $gameNetwork.queueSync(`self_switch:${key_copy}`, "self_switch",
            () => ({ key: key_copy, value: $gameSelfSwitches.value(key_copy) }));
    }
};

BestWaifu.MZPeer.GameSync.register("self_switch", payload => {
    $gameSelfSwitches.setValue(payload.key, payload.value);
});


BestWaifu.MZPeer.Game_Variables_value = Game_Variables.prototype.value;
Game_Variables.prototype.value = function(variableId) {
    if (variableId == BestWaifu.MZPeer.PlayerCountVar) return $gameNetwork.playerCount();
    return BestWaifu.MZPeer.Game_Variables_value.call(this, variableId);
};

// Variables
BestWaifu.MZPeer.Game_Variables_setValue = Game_Variables.prototype.setValue;
Game_Variables.prototype.setValue = function (variableId, value) {
    const old_value = this.value(variableId);
    BestWaifu.MZPeer.Game_Variables_setValue.call(this, variableId, value);
    if (BestWaifu.MZPeer.isLocalVariable(variableId)) return;
    if (this.value(variableId) !== old_value) {
        $gameNetwork.queueSync(`variable:${variableId}`, "variable",
            () => ({ id: variableId, value: $gameVariables.value(variableId) }));
    }
};

BestWaifu.MZPeer.GameSync.register("variable", payload => {
    $gameVariables.setValue(payload.id, payload.value);
});

// Gold
BestWaifu.MZPeer.Game_Party_gainGold = Game_Party.prototype.gainGold;
Game_Party.prototype.gainGold = function (amount) {
    const old_gold = this._gold;
    BestWaifu.MZPeer.Game_Party_gainGold.call(this, amount);
    if (this._gold !== old_gold) {
        $gameNetwork.queueSync("gold", "gold", () => ({ value: $gameParty.gold() }));
    }
};

BestWaifu.MZPeer.GameSync.register("gold", payload => {
    $gameParty._gold = payload.value;
});

// Item Gain / Item Loss (items, weapons and armors). Synced as the resulting count.
BestWaifu.MZPeer.Game_Party_gainItem = Game_Party.prototype.gainItem;
Game_Party.prototype.gainItem = function (item, amount, includeEquip) {
    const old_count = this.numItems(item);
    BestWaifu.MZPeer.Game_Party_gainItem.call(this, item, amount, includeEquip);
    if (item && this.numItems(item) !== old_count) {
        const dc = BestWaifu.MZPeer.itemClass(item);
        $gameNetwork.queueSync(`item:${dc}:${item.id}`, "item",
            () => ({ dc, id: item.id, count: $gameParty.numItems(item) }));
    }
};

BestWaifu.MZPeer.GameSync.register("item", payload => {
    const item = BestWaifu.MZPeer.itemFromData(payload.dc, payload.id);
    if (!item) return;
    $gameParty.gainItem(item, payload.count - $gameParty.numItems(item), false);
});

//#region Actor Syncing
//
// EXP, HP, MP, TP, parameters, skills, equipment, name, class, nickname and
// profile all live on the actor, so they travel together as one snapshot.

BestWaifu.MZPeer.makeActorPayload = function (actor) {
    return {
        id: actor.actorId(),
        name: actor._name,
        nickname: actor._nickname,
        profile: actor._profile,
        classId: actor._classId,
        level: actor._level,
        exp: Object.assign({}, actor._exp),
        skills: actor._skills.slice(),
        paramPlus: actor._paramPlus.slice(),
        equips: actor._equips.map(e => ({ dc: e._dataClass, id: e._itemId })),
        hp: actor._hp,
        mp: actor._mp,
        tp: actor._tp,
        states: actor._states.slice(),
        stateTurns: Object.assign({}, actor._stateTurns),
        buffs: actor._buffs.slice(),
        buffTurns: actor._buffTurns.slice()
    };
};

BestWaifu.MZPeer.applyActorPayload = function (p) {
    const actor = $gameActors.actor(p.id);
    if (!actor) return;
    actor._name = p.name;
    actor._nickname = p.nickname;
    actor._profile = p.profile;
    actor._classId = p.classId;
    actor._level = p.level;
    actor._exp = Object.assign({}, p.exp);
    actor._skills = p.skills.slice();
    actor._paramPlus = p.paramPlus.slice();
    for (let i = 0; i < p.equips.length; i++) {
        if (!actor._equips[i]) actor._equips[i] = new Game_Item();
        actor._equips[i]._dataClass = p.equips[i].dc;
        actor._equips[i]._itemId = p.equips[i].id;
    }
    actor._hp = p.hp;
    actor._mp = p.mp;
    actor._tp = p.tp;
    actor._states = p.states.slice();
    actor._stateTurns = Object.assign({}, p.stateTurns);
    actor._buffs = p.buffs.slice();
    actor._buffTurns = p.buffTurns.slice();
    actor.refresh();
    if ($gamePlayer) $gamePlayer.refresh();
    if ($gameMap) $gameMap.requestRefresh();
};

/**
 * Queue an actor to be synced.
 * @param {Game_Actor} actor
 * @param {boolean} fromVitals Skip these in battle, the battle snapshots cover them.
 */
BestWaifu.MZPeer.markActorDirty = function (actor, fromVitals = false) {
    if (!actor || typeof actor.isActor !== "function" || !actor.isActor()) return;
    if (!$gameNetwork.canSyncGameData()) return;
    if (fromVitals && $gameParty && $gameParty.inBattle()) return;
    const id = actor.actorId();
    $gameNetwork.queueSync(`actor:${id}`, "actor", () => {
        const current = $gameActors.actor(id);
        return current ? BestWaifu.MZPeer.makeActorPayload(current) : null;
    });
};

/** Wrap a method so that calling it marks the actor as needing a sync. */
BestWaifu.MZPeer.aliasActorMethod = function (klass, className, methodName, fromVitals) {
    const aliasName = `${className}_${methodName}_actor`;
    BestWaifu.MZPeer[aliasName] = klass.prototype[methodName];
    klass.prototype[methodName] = function () {
        const result = BestWaifu.MZPeer[aliasName].apply(this, arguments);
        BestWaifu.MZPeer.markActorDirty(this, fromVitals);
        return result;
    };
};

// HP, MP, TP, states and buffs all end in a refresh
BestWaifu.MZPeer.aliasActorMethod(Game_BattlerBase, "Game_BattlerBase", "refresh", true);
BestWaifu.MZPeer.aliasActorMethod(Game_BattlerBase, "Game_BattlerBase", "setHp", true);
BestWaifu.MZPeer.aliasActorMethod(Game_BattlerBase, "Game_BattlerBase", "setMp", true);
BestWaifu.MZPeer.aliasActorMethod(Game_BattlerBase, "Game_BattlerBase", "setTp", true);

// EXP and level
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "changeExp", false);

// Name, nickname, profile and class
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "setName", false);
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "setNickname", false);
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "setProfile", false);
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "changeClass", false);

// Skills and parameters
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "learnSkill", false);
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "forgetSkill", false);
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "addParam", false);
// Equipment
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "changeEquip", false);
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "forceChangeEquip", false);
BestWaifu.MZPeer.aliasActorMethod(Game_Actor, "Game_Actor", "discardEquip", false);

BestWaifu.MZPeer.GameSync.register("actor", payload => {
    BestWaifu.MZPeer.applyActorPayload(payload);
});

//#endregion

//#endregion

//#region Timer Syncing
//
// The host is the authority. Both sides tick the timer locally and the host
// periodically corrects drift.

BestWaifu.MZPeer.queueTimerSync = function () {
    $gameNetwork.queueSync("timer", "timer", () => ({
        working: $gameTimer._working,
        frames: $gameTimer._frames
    }));
};

BestWaifu.MZPeer.Game_Timer_start = Game_Timer.prototype.start;
Game_Timer.prototype.start = function (count) {
    BestWaifu.MZPeer.Game_Timer_start.call(this, count);
    BestWaifu.MZPeer.queueTimerSync();
};

BestWaifu.MZPeer.Game_Timer_stop = Game_Timer.prototype.stop;
Game_Timer.prototype.stop = function () {
    BestWaifu.MZPeer.Game_Timer_stop.call(this);
    BestWaifu.MZPeer.queueTimerSync();
};

BestWaifu.MZPeer.Game_Timer_update = Game_Timer.prototype.update;
Game_Timer.prototype.update = function (sceneActive) {
    BestWaifu.MZPeer.Game_Timer_update.call(this, sceneActive);
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host && this._working && Graphics.frameCount % 300 === 0) {
        BestWaifu.MZPeer.queueTimerSync();
    }
};

BestWaifu.MZPeer.GameSync.register("timer", payload => {
    $gameTimer._frames = payload.frames;
    $gameTimer._working = payload.working;
});

//#endregion

//-----------------------------------------------------------------------------
// #region Battle Syncing
//

//#region Battle Helpers

BestWaifu.MZPeer.resultKeys = [
    "used", "missed", "evaded", "physical", "drain", "critical", "success",
    "hpAffected", "hpDamage", "mpDamage", "tpDamage",
    "addedStates", "removedStates", "addedBuffs", "addedDebuffs", "removedBuffs"
];

/** Who controls this actor? The username of its player, or the host if nobody owns it. */
BestWaifu.MZPeer.actorOwner = function (actor) {
    if (!actor) return "";
    const hostName = $gameNetwork.side === BestWaifu.MZPeer.Sides.Guest ? $gameNetwork.hostUsername : $gameNetwork.username;
    const players = $gameSystem.players();
    for (const N of Object.keys(players)) {
        if ($gameSystem.actorForNumber(N) !== actor) continue;
        const owner = players[N];
        if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host && owner !== $gameNetwork.username) {
            const connected = $gameNetwork.peerConnections.some(c => c.open && c.metadata?.username === owner);
            if (!connected) return hostName;
        }
        return owner;
    }
    return hostName;
};

BestWaifu.MZPeer.isLocalActor = function (actor) {
    return !!actor && BestWaifu.MZPeer.actorOwner(actor) === $gameNetwork.username;
};

BestWaifu.MZPeer.isRemoteActor = function (actor) {
    return !!actor && $gameNetwork.side !== BestWaifu.MZPeer.Sides.Local && !BestWaifu.MZPeer.isLocalActor(actor);
};

/** Is the host waiting on a guest to choose commands? */
BestWaifu.MZPeer.isWaitingOnRemoteInput = function () {
    return $gameNetwork.side === BestWaifu.MZPeer.Sides.Host &&
        BattleManager.isInputting() &&
        BestWaifu.MZPeer.isRemoteActor(BattleManager.actor());
};

BestWaifu.MZPeer.battlerRef = function (battler) {
    return battler.isActor() ? { "actor": battler.actorId() } : { "enemy": battler.index() };
};

BestWaifu.MZPeer.resolveBattler = function (ref) {
    if (!ref) return null;
    if (ref.actor !== undefined) return $gameActors.actor(ref.actor);
    if (ref.enemy !== undefined) return $gameTroop.members()[ref.enemy] || null;
    return null;
};

/** Turn an argument of a battle log method into something that can cross the wire. */
BestWaifu.MZPeer.serializeBattleParam = function (value) {
    if (value instanceof Game_Battler) {
        const result = {};
        for (const key of BestWaifu.MZPeer.resultKeys) {
            const v = value.result()[key];
            result[key] = Array.isArray(v) ? v.slice() : v;
        }
        return {
            "battler": BestWaifu.MZPeer.battlerRef(value),
            "vitals": { hp: value.hp, mp: value.mp, tp: value.tp },
            "result": result
        };
    }
    if (value instanceof Game_Action) {
        return {
            "action": {
                "subject": BestWaifu.MZPeer.battlerRef(value.subject()),
                "dc": value._item._dataClass,
                "id": value._item._itemId,
                "forcing": !!value._forcing
            }
        };
    }
    if (Array.isArray(value)) return value.map(BestWaifu.MZPeer.serializeBattleParam);
    if (value === null || value === undefined) return null;
    if (["number", "string", "boolean"].includes(typeof value)) return value;
    return null;
};

BestWaifu.MZPeer.deserializeBattleParam = function (value) {
    if (Array.isArray(value)) return value.map(BestWaifu.MZPeer.deserializeBattleParam);
    if (value && typeof value === "object") {
        if (value.battler) {
            const battler = BestWaifu.MZPeer.resolveBattler(value.battler);
            if (!battler) return null;
            battler._hp = value.vitals.hp;
            battler._mp = value.vitals.mp;
            battler._tp = value.vitals.tp;
            for (const key of BestWaifu.MZPeer.resultKeys) {
                const v = value.result[key];
                battler.result()[key] = Array.isArray(v) ? v.slice() : v;
            }
            return battler;
        }
        if (value.action) {
            const subject = BestWaifu.MZPeer.resolveBattler(value.action.subject);
            if (!subject) return null;
            const action = new Game_Action(subject, value.action.forcing);
            if (value.action.dc === "skill") action.setSkill(value.action.id);
            if (value.action.dc === "item") action.setItem(value.action.id);
            return action;
        }
        return null;
    }
    return value;
};

BestWaifu.MZPeer.battlerState = function (battler) {
    return {
        hp: battler._hp,
        mp: battler._mp,
        tp: battler._tp,
        states: battler._states.slice(),
        stateTurns: Object.assign({}, battler._stateTurns),
        buffs: battler._buffs.slice(),
        buffTurns: battler._buffTurns.slice(),
        tpbState: battler._tpbState,
        tpbChargeTime: battler._tpbChargeTime,
        tpbCastTime: battler._tpbCastTime,
        tpbIdleTime: battler._tpbIdleTime,
        hidden: !!battler._hidden
    };
};

/** Returns true if anything the player can see changed. */
BestWaifu.MZPeer.applyBattlerState = function (battler, s) {
    if (!battler || !s) return false;
    const before = [battler._hp, battler._mp, battler._tp, battler._states.join(",")].join("|");
    battler._hp = s.hp;
    battler._mp = s.mp;
    battler._tp = s.tp;
    battler._states = s.states.slice();
    battler._stateTurns = Object.assign({}, s.stateTurns);
    battler._buffs = s.buffs.slice();
    battler._buffTurns = s.buffTurns.slice();
    if (s.tpbState !== undefined) battler._tpbState = s.tpbState;
    if (s.tpbChargeTime !== undefined) battler._tpbChargeTime = s.tpbChargeTime;
    if (s.tpbCastTime !== undefined) battler._tpbCastTime = s.tpbCastTime;
    if (s.tpbIdleTime !== undefined) battler._tpbIdleTime = s.tpbIdleTime;
    if (battler.isEnemy()) battler._hidden = s.hidden;
    if (typeof battler.requestMotionRefresh === "function") battler.requestMotionRefresh();
    const after = [battler._hp, battler._mp, battler._tp, battler._states.join(",")].join("|");
    return before !== after;
};

BestWaifu.MZPeer.makeBattleSnapshot = function () {
    const actor = BattleManager._currentActor;
    return {
        turn: $gameTroop.turnCount(),
        inputting: !!BattleManager._inputting,
        actor: actor ? actor.actorId() : 0,
        serial: $gameNetwork.battleInputSerial,
        actors: $gameParty.battleMembers().map(a => Object.assign({ id: a.actorId() }, BestWaifu.MZPeer.battlerState(a))),
        enemies: $gameTroop.members().map(BestWaifu.MZPeer.battlerState)
    };
};

//#endregion

//#region Host Battle Streaming

/** Called when a battle scene is created on the host. Tells guests to join it. */
$gameNetwork.beginHostBattle = function () {
    if (!this.isSessionReady()) return;
    this.battleId++;
    this.battleOrder = 0;
    this.battleInputSerial = 0;
    this.battleSnapshotDirty = false;
    this.battleSnapshotTimer = 0;
    this.battleHosting = true;
    this.sendBattleEvent("start", {
        troopId: $gameTroop._troopId,
        canEscape: !!BattleManager._canEscape,
        canLose: !!BattleManager._canLose,
        preemptive: !!BattleManager._preemptive,
        surprise: !!BattleManager._surprise
    });
    this.pushLog(`[Host] Battle ${this.battleId} started for guests.`);
};

/** Add an event to the ordered, reliable battle stream. */
$gameNetwork.sendBattleEvent = function (kind, payload) {
    if (!this.isSessionReady()) return;
    const battle_event = new BestWaifu.MZPeer.SyncBattleEvent();
    this.battleOrder++;
    battle_event.setField("tick", this.battleOrder);
    battle_event.setField("kind", kind);
    battle_event.setField("battle", this.battleId);
    battle_event.setField("payload", payload);
    this.router.sendReliableToGuests(battle_event, `${this.battleId}-${this.battleOrder}`);
};

$gameNetwork.sendBattleLog = function (methodName, params) {
    if (!this.battleHosting) return;
    this.sendBattleEvent("log", {
        name: methodName,
        params: params.map(BestWaifu.MZPeer.serializeBattleParam)
    });
};

$gameNetwork.sendBattleSnapshot = function () {
    this.battleSnapshotDirty = false;
    this.battleSnapshotTimer = 0;
    if (!this.battleHosting || !this.isSessionReady()) return;
    const state_sync = new BestWaifu.MZPeer.SyncBattleState();
    this.syncSeq++;
    state_sync.setField("tick", this.syncSeq);
    state_sync.setField("payload", BestWaifu.MZPeer.makeBattleSnapshot());
    this.router.sendToGuests(state_sync);
};

$gameNetwork.updateBattleSync = function () {
    this.battleSnapshotTimer++;
    const interval = BattleManager.isTpb() ? 10 : 60;
    if (this.battleSnapshotDirty || this.battleSnapshotTimer >= interval) {
        this.sendBattleSnapshot();
    }
};

$gameNetwork.sendBattleEnd = function () {
    if (!this.battleHosting) return;
    this.sendBattleEvent("end", {
        escaped: !!BattleManager._escaped,
        snapshot: BestWaifu.MZPeer.makeBattleSnapshot()
    });
    this.battleHosting = false;
};

// Forward everything the host's battle log is told to do.
BestWaifu.MZPeer.Window_BattleLog_push = Window_BattleLog.prototype.push;
Window_BattleLog.prototype.push = function (methodName) {
    // Guests only run what the host sent them.
    if ($gameNetwork.battleMirror && !$gameNetwork.applyingRemote) return;
    BestWaifu.MZPeer.Window_BattleLog_push.apply(this, arguments);
    if ($gameNetwork.battleHosting) {
        $gameNetwork.sendBattleLog(methodName, Array.prototype.slice.call(arguments, 1));
    }
};

BestWaifu.MZPeer.Scene_Battle_create = Scene_Battle.prototype.create;
Scene_Battle.prototype.create = function () {
    BestWaifu.MZPeer.Scene_Battle_create.call(this);
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host && !$gameNetwork.battleMirror) {
        // Prevents mid-battle joining
        $gameNetwork.open = false;
        $gameNetwork.beginHostBattle();
    }
};

BestWaifu.MZPeer.Window_PeerWaiting = function() {
    this.initialize.apply(this, arguments);
}

BestWaifu.MZPeer.Window_PeerWaiting.prototype = Object.create(Window_Base.prototype);
BestWaifu.MZPeer.Window_PeerWaiting.prototype.constructor = BestWaifu.MZPeer.Window_PeerWaiting;

BestWaifu.MZPeer.Window_PeerWaiting.prototype.initialize = function () {
    var width = 240;
    var height = 36 + $gameSystem.windowPadding() * 2;
    var x = (Graphics.boxWidth - width) / 2;
    var y = (Graphics.boxHeight - height) / 2;
    Window_Base.prototype.initialize.call(this, new Rectangle(x, y, width, height));
    this.openness = 0;
    this.refresh();
};

BestWaifu.MZPeer.Window_PeerWaiting.prototype.refresh = function () {
    this.contents.clear();
    this.drawText("Waiting..", 0, 0, this.contentsWidth(), "center");
};

BestWaifu.MZPeer.Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
Scene_Battle.prototype.createAllWindows = function () {
    BestWaifu.MZPeer.Scene_Battle_createAllWindows.call(this);
    this._peerWaitingWindow = new BestWaifu.MZPeer.Window_PeerWaiting();
    this.addWindow(this._peerWaitingWindow);
};

BestWaifu.MZPeer.Scene_Battle_update = Scene_Battle.prototype.update;
Scene_Battle.prototype.update = function () {
    BestWaifu.MZPeer.Scene_Battle_update.call(this);
    if ($gameNetwork.battleHosting) $gameNetwork.updateBattleSync();
    var win = this._peerWaitingWindow;
    if (!win) return;
    if (BestWaifu.MZPeer.isWaitingOnRemoteInput()) {
        if (!win.isOpen() && !win.isOpening()) win.open();
    } else if (!win.isClosed() && !win.isClosing()) {
        win.close();
    }
};

BestWaifu.MZPeer.Scene_Battle_terminate = Scene_Battle.prototype.terminate;
Scene_Battle.prototype.terminate = function () {
    BestWaifu.MZPeer.Scene_Battle_terminate.call(this);
    const wasHost = $gameNetwork.battleHosting || $gameNetwork.side === BestWaifu.MZPeer.Sides.Host;
    $gameNetwork.battleHosting = false;
    $gameNetwork.battleMirror = false;
    // Battle is over, so the out-of-battle actor sync can carry the final state to guests.
    if (wasHost) {
        // Re-allow joining
        $gameNetwork.open = true;
        for (const actor of $gameParty.members()) BestWaifu.MZPeer.markActorDirty(actor);
    }
};

// Snapshot whenever the battle moves to a new step.
for (const methodName of ["endAction", "startTurn", "endTurn", "startInput"]) {
    const aliasName = `BattleManager_${methodName}_net`;
    BestWaifu.MZPeer[aliasName] = BattleManager[methodName];
    BattleManager[methodName] = function () {
        BestWaifu.MZPeer[aliasName].apply(this, arguments);
        if ($gameNetwork.battleHosting) $gameNetwork.battleSnapshotDirty = true;
    };
}

BestWaifu.MZPeer.BattleManager_updateBattleEnd = BattleManager.updateBattleEnd;
BattleManager.updateBattleEnd = function () {
    $gameNetwork.sendBattleEnd();
    BestWaifu.MZPeer.BattleManager_updateBattleEnd.call(this);
};

BestWaifu.MZPeer.BattleManager_abort = BattleManager.abort;
BattleManager.abort = function () {
    if ($gameNetwork.battleHosting) {
        $gameNetwork.sendBattleEvent("abort", {});
        $gameNetwork.battleHosting = false;
    }
    BestWaifu.MZPeer.BattleManager_abort.call(this);
};

//#endregion

//#region Guest Battle Mirroring

$gameNetwork.router.addNetworkDataListener("sync_battle_event", BestWaifu.MZPeer.Sides.Guest, data => {
    const battle_event = new BestWaifu.MZPeer.SyncBattleEvent();
    battle_event.fromData(data);
    $gameNetwork.receiveBattleEvent(battle_event);
});

/** Puts the battle stream back in order and drops duplicates. */
$gameNetwork.receiveBattleEvent = function (battle_event) {
    const battle = battle_event.getField("battle", 0);
    const order = battle_event.getField("tick", 0);

    if (battle < this.battleId) return; // A battle that is already over
    if (battle > this.battleId) {
        this.battleId = battle;
        this.battleExpected = 1;
        this.battleBuffer = {};
    }
    if (order < this.battleExpected) return; // Duplicate

    this.battleBuffer[order] = battle_event;
    while (this.battleBuffer[this.battleExpected]) {
        const next = this.battleBuffer[this.battleExpected];
        delete this.battleBuffer[this.battleExpected];
        this.battleExpected++;
        this.battleInbox.push(next);
    }
};

$gameNetwork.router.addNetworkDataListener("sync_battle_state", BestWaifu.MZPeer.Sides.Guest, data => {
    const state_sync = new BestWaifu.MZPeer.SyncBattleState();
    state_sync.fromData(data);
    const tick = state_sync.getField("tick", 0);
    if (tick <= $gameNetwork.battleSnapshotTick) return;
    $gameNetwork.battleSnapshotTick = tick;
    $gameNetwork.applyBattleSnapshot(state_sync.getField("payload", {}));
});

/** Starts the same battle the host started. */
$gameNetwork.startMirrorBattle = function (payload) {
    this.pushLog(`[Guest] Joining host battle with troop ${payload.troopId}.`);
    this.battleMirror = true;
    this.battleInputHandled = 0;
    this.battleInputSerial = 0;
    BattleManager.setup(payload.troopId, payload.canEscape, payload.canLose);
    BattleManager._preemptive = payload.preemptive;
    BattleManager._surprise = payload.surprise;
    $gamePlayer.makeEncounterCount();
    SceneManager.push(Scene_Battle);
};

$gameNetwork.endMirrorBattle = function (payload) {
    this.applyBattleSnapshot(payload.snapshot, true);
    BattleManager._escaped = !!payload.escaped;
    BattleManager._phase = "battleEnd";
    BattleManager._inputting = false;
    BattleManager._currentActor = null;
    BattleManager.updateBattleEnd();
};

/** Runs the ordered stream once the scenes are ready for it. */
$gameNetwork.processBattleInbox = function () {
    while (this.battleInbox.length > 0) {
        const battle_event = this.battleInbox[0];
        const kind = battle_event.getField("kind", "");
        const payload = battle_event.getField("payload", {});

        if (kind === "start") {
            if (!(SceneManager._scene instanceof Scene_Map) || SceneManager.isSceneChanging()) return;
            this.battleInbox.shift();
            this.startMirrorBattle(payload);
            return;
        }

        // Anything else belongs to a battle we are not in.
        if (!this.battleMirror) {
            this.battleInbox.shift();
            continue;
        }

        const scene = SceneManager._scene;
        if (!(scene instanceof Scene_Battle) || !scene.isActive() || SceneManager.isSceneChanging()) return;

        switch (kind) {
            case "log": {
                this.battleInbox.shift();
                const params = (payload.params || []).map(BestWaifu.MZPeer.deserializeBattleParam);
                const logWindow = scene._logWindow;
                if (logWindow && typeof logWindow[payload.name] === "function") {
                    this.applyRemote(() => logWindow.push(payload.name, ...params));
                }
                break;
            }
            case "end":
                // Let the last animations and messages finish first.
                if (BattleManager.isBusy()) return;
                this.battleInbox.shift();
                this.endMirrorBattle(payload);
                return;
            case "abort":
                this.battleInbox.shift();
                BattleManager.abort();
                break;
            default:
                this.battleInbox.shift();
                break;
        }
    }
};

$gameNetwork.applyBattleSnapshot = function (s, force = false) {
    const scene = SceneManager._scene;
    if (!this.battleMirror || !(scene instanceof Scene_Battle) || !s) return;

    let changed = false;
    for (const actorState of s.actors || []) {
        if (BestWaifu.MZPeer.applyBattlerState($gameActors.actor(actorState.id), actorState)) changed = true;
    }
    const enemies = $gameTroop.members();
    (s.enemies || []).forEach((enemyState, index) => {
        if (BestWaifu.MZPeer.applyBattlerState(enemies[index], enemyState)) changed = true;
    });
    $gameTroop._turnCount = s.turn;

    if (changed && scene._statusWindow) scene._statusWindow.refresh();
    if (!force) this.mirrorBattleInput(s);
};

/** Opens the command window for a guest's own actor when the host says it is their turn. */
$gameNetwork.mirrorBattleInput = function (s) {
    if (BattleManager.isBattleEnd()) return;
    const actor = s.actor > 0 ? $gameActors.actor(s.actor) : null;
    const mine = s.inputting && actor && BestWaifu.MZPeer.isLocalActor(actor);

    if (mine) {
        if (s.serial > this.battleInputHandled) {
            this.battleInputHandled = s.serial;
            this.battleInputSerial = s.serial;
            actor.makeActions();
            BattleManager._phase = "input";
            BattleManager._inputting = true;
            BattleManager._currentActor = actor;
            BattleManager.startActorInput();
        }
    } else if (BattleManager._currentActor && s.serial > this.battleInputSerial) {
        // The host moved on without us (for example the input was cancelled).
        BattleManager._currentActor.setActionState("waiting");
        BattleManager._currentActor = null;
        BattleManager._inputting = false;
    }
};

// Guests never run battle logic.
BestWaifu.MZPeer.BattleManager_update = BattleManager.update;
BattleManager.update = function (timeActive) {
    if ($gameNetwork.battleMirror) {
        this.updateMirror();
        return;
    }
    BestWaifu.MZPeer.BattleManager_update.call(this, timeActive);
};

BattleManager.updateMirror = function () {
    $gameParty.requestMotionRefresh();
    if (this.isBusy()) return;
    this.checkAbort();
};

//#endregion

//#region Standard Turn Battle
//
// Input phase: each actor is commanded by its owner.
// * Guest: when the host's snapshot says it is the guest's actor, open the
//   command window locally. When the guest finishes, send the actions.
// * Host: no command window for actors owned by guests. Wait for their
//   command, then carry on exactly as if a local player had finished.

/** Host: remember a new input started, so late commands and snapshots can be told apart. */
BestWaifu.MZPeer.BattleManager_startActorInput = BattleManager.startActorInput;
BattleManager.startActorInput = function () {
    BestWaifu.MZPeer.BattleManager_startActorInput.call(this);
    if ($gameNetwork.battleHosting && this._currentActor) {
        $gameNetwork.battleInputSerial++;
        $gameNetwork.sendBattleSnapshot();
    }
};

/** Guest: send the finished actions to the host instead of moving on locally. */
BestWaifu.MZPeer.BattleManager_selectNextCommand = BattleManager.selectNextCommand;
BattleManager.selectNextCommand = function () {
    if (!$gameNetwork.battleMirror) {
        BestWaifu.MZPeer.BattleManager_selectNextCommand.call(this);
        return;
    }
    const actor = this._currentActor;
    if (!actor) return;
    if (actor.selectNextCommand()) return;
    actor.setActionState("waiting");
    $gameNetwork.sendBattleCommand(actor);
    this._currentActor = null;
    this._inputting = false;
};

/** Guests can only step back through their own actor's actions. */
BestWaifu.MZPeer.BattleManager_selectPreviousCommand = BattleManager.selectPreviousCommand;
BattleManager.selectPreviousCommand = function () {
    if (!$gameNetwork.battleMirror) {
        BestWaifu.MZPeer.BattleManager_selectPreviousCommand.call(this);
        return;
    }
    if (this._currentActor) this._currentActor.selectPreviousCommand();
};

$gameNetwork.sendBattleCommand = function (actor) {
    const command_sync = new BestWaifu.MZPeer.SyncBattleCommand();
    command_sync.setField("actor_id", actor.actorId());
    command_sync.setField("serial", this.battleInputSerial);
    command_sync.setField("actions", actor._actions.map(a => ({
        dc: a._item._dataClass,
        id: a._item._itemId,
        target: a._targetIndex
    })));
    this.router.sendReliable(this.hostUsername, command_sync,
        `${this.username}-${actor.actorId()}-${this.battleInputSerial}`);
};

$gameNetwork.router.addNetworkDataListener("sync_battle_command", BestWaifu.MZPeer.Sides.Host, data => {
    const command_sync = new BestWaifu.MZPeer.SyncBattleCommand();
    command_sync.fromData(data);
    if (!$gameNetwork.battleHosting) return;

    const actor = $gameActors.actor(command_sync.getField("actor_id", 0));
    if (!actor || BattleManager._currentActor !== actor) {
        $gameNetwork.pushLog("[Host] Ignoring a command for an actor that is not inputting.");
        return;
    }
    if (command_sync.getField("serial", -1) !== $gameNetwork.battleInputSerial) {
        $gameNetwork.pushLog("[Host] Ignoring a stale battle command.");
        return;
    }
    if (BestWaifu.MZPeer.actorOwner(actor) !== command_sync.username()) {
        $gameNetwork.pushLog(`[Host] ${command_sync.username()} tried to command an actor they do not own.`);
        return;
    }

    const actions = [];
    for (const entry of command_sync.getField("actions", [])) {
        const action = new Game_Action(actor);
        if (entry.dc === "skill") action.setSkill(entry.id);
        else if (entry.dc === "item") action.setItem(entry.id);
        else continue;
        action.setTarget(entry.target);
        actions.push(action);
    }
    if (actions.length > 0) {
        actor._actions = actions;
        actor._actionInputIndex = actions.length - 1;
    }
    // Carries on exactly as if a local player finished choosing.
    BattleManager.selectNextCommand();
    $gameNetwork.battleSnapshotDirty = true;
});

/** Host: no command window for actors a guest controls. */
BestWaifu.MZPeer.Scene_Battle_changeInputWindow = Scene_Battle.prototype.changeInputWindow;
Scene_Battle.prototype.changeInputWindow = function () {
    if (BestWaifu.MZPeer.isWaitingOnRemoteInput()) {
        this.hideSubInputWindows();
        this.endCommandSelection();
        return;
    }
    BestWaifu.MZPeer.Scene_Battle_changeInputWindow.call(this);
};

// Guests do not roll their own random encounters. The host's steps decide.
BestWaifu.MZPeer.Game_Player_canEncounter = Game_Player.prototype.canEncounter;
Game_Player.prototype.canEncounter = function () {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) return false;
    return BestWaifu.MZPeer.Game_Player_canEncounter.call(this);
};

//#endregion

//#region Active Turn Battle (Wait)
//
// In Wait mode time stops while somebody is choosing a command. The host
// cannot see a guest's windows, so it stops time while it waits for them.

BestWaifu.MZPeer.Scene_Battle_isTimeActive = Scene_Battle.prototype.isTimeActive;
Scene_Battle.prototype.isTimeActive = function () {
    if (BattleManager.isTpb() && !BattleManager.isActiveTpb() && BestWaifu.MZPeer.isWaitingOnRemoteInput()) {
        return false;
    }
    return BestWaifu.MZPeer.Scene_Battle_isTimeActive.call(this);
};

//#endregion

//#region Active Turn Battle (Realtime)
//
// In Realtime mode time keeps flowing while a guest decides. Nothing extra is
// needed on the host. Guests get TPB gauges from the snapshots, which are sent
// every 10 frames in any TPB mode (see $gameNetwork.updateBattleSync).

//#endregion

//#region Battle Processing From Events
//
// Guests do not start battles themselves. "Battle Processing" on a guest asks
// the host to start it, then waits for the host to report the result so the
// Win/Escape/Lose branches still work.

BestWaifu.MZPeer.Game_Interpreter_command301 = Game_Interpreter.prototype.command301;
Game_Interpreter.prototype.command301 = function (params) {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest || $gameParty.inBattle() || $gameNetwork.battleMirror) {
        return BestWaifu.MZPeer.Game_Interpreter_command301.call(this, params);
    }
    let troopId;
    if (params[0] === 0) {
        troopId = params[1];
    } else if (params[0] === 1) {
        troopId = $gameVariables.value(params[1]);
    } else {
        troopId = $gamePlayer.makeEncounterTroopId();
    }
    if ($dataTroops[troopId] && $gameNetwork.isSessionReady()) {
        $gameNetwork.battleResultCallback = n => {
            this._branchData[this._indent] = n;
        };
        $gameNetwork.sendGameData("battle_request", "battle_request", {
            origin: $gameNetwork.username,
            troopId: troopId,
            canEscape: !!params[2],
            canLose: !!params[3]
        });
        this.setWaitMode("net_battle");
    }
    return true;
};

BestWaifu.MZPeer.Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
Game_Interpreter.prototype.updateWaitMode = function () {
    if (this._waitMode === "net_battle") {
        if ($gameNetwork.battleResultCallback) return true;
        this._waitMode = "";
        return false;
    }
    return BestWaifu.MZPeer.Game_Interpreter_updateWaitMode.call(this);
};

BestWaifu.MZPeer.GameSync.register("battle_request", payload => {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) return;
    $gameNetwork.whenOnMap(() => {
        if ($gameParty.inBattle() || $gameNetwork.battleHosting) {
            // Cannot start one now. -1 matches no branch.
            $gameNetwork.sendGameData("battle_result", "battle_result", { target: payload.origin, result: -1 });
            return;
        }
        BattleManager.setup(payload.troopId, payload.canEscape, payload.canLose);
        BattleManager.setEventCallback(n => {
            $gameNetwork.sendGameData("battle_result", "battle_result", { target: payload.origin, result: n });
        });
        $gamePlayer.makeEncounterCount();
        SceneManager.push(Scene_Battle);
    });
});

BestWaifu.MZPeer.GameSync.register("battle_result", payload => {
    if (payload.target !== $gameNetwork.username) return;
    const callback = $gameNetwork.battleResultCallback;
    $gameNetwork.battleResultCallback = null;
    if (callback) callback(payload.result);
});

//#endregion

//#endregion

//-----------------------------------------------------------------------------
// #region Plugin Commands
//
// Needs the @command blocks added to the plugin header.

/** Run the player join variable and common event for a freshly created remote player. */
BestWaifu.MZPeer.gameNetwork_createRemotePlayer = $gameNetwork.createRemotePlayer;
$gameNetwork.createRemotePlayer = function (username, x, y) {
    const count = $remotePlayers.length;
    BestWaifu.MZPeer.gameNetwork_createRemotePlayer.call(this, username, x, y);
    if ($remotePlayers.length <= count) return;
    if (BestWaifu.MZPeer.PlayerJoinVar > 0) {
        $gameVariables.setValue(BestWaifu.MZPeer.PlayerJoinVar, Number($gameSystem.numberForUser(username)));
    }
    if (BestWaifu.MZPeer.PlayerJoinCE > 0) {
        $gameTemp.reserveCommonEvent(BestWaifu.MZPeer.PlayerJoinCE);
    }
};

$gameNetwork.spawnAllPlayers = function (x, y) {
    while (this.spawnablePlayers.length > 0) {
        this.spawnLastPlayer(x, y);
    }
};

/** Read a plugin command number, falling back to the host player's position. */
BestWaifu.MZPeer.commandNumber = function (value, fallback) {
    const n = Number(value);
    return value === undefined || value === "" || isNaN(n) ? fallback : n;
};

PluginManager.registerCommand("MZPeer", "spawnLastPlayer", args => {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) return;
    $gameNetwork.spawnLastPlayer(
        BestWaifu.MZPeer.commandNumber(args.x, $gamePlayer.x),
        BestWaifu.MZPeer.commandNumber(args.y, $gamePlayer.y)
    );
});

PluginManager.registerCommand("MZPeer", "openSession", args => {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Local) return;
    $gameNetwork.pushLog(`Session created successfully.`);
    $gameNetwork.createHostSession();
});

PluginManager.registerCommand("MZPeer", "spawnAllPlayers", args => {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) return;
    $gameNetwork.spawnAllPlayers(
        BestWaifu.MZPeer.commandNumber(args.x, $gamePlayer.x),
        BestWaifu.MZPeer.commandNumber(args.y, $gamePlayer.y)
    );
});

PluginManager.registerCommand("MZPeer", "storePlayerNumber", args => {
    const variableId = Number(args.variable);
    if (!(variableId > 0)) return;
    // Every machine stores its own number, so this variable must not sync.
    BestWaifu.MZPeer.localVariables.add(variableId);
    $gameVariables.setValue(variableId, Math.max(0, $gameNetwork.localPlayerNumber()));
});

PluginManager.registerCommand("MZPeer", "setMoveRoutePlayer", args => {
    $gameNetwork.setMoveRoutePlayer(Number(args.player));
});

//#endregion

//-----------------------------------------------------------------------------
// #region Script Calls
//
// $gameNetwork.setMoveRoutePlayer(2)   "Player" in move routes now means player 2
// $gameNetwork.resetMoveRoutePlayer()  "Player" means the local player again
// $gameNetwork.localPlayerNumber()     This machine's player number (-1 if none)
// $gameNetwork.playerCount()           How many players are in the session
// $gameNetwork.isHost()                True on the host

/** Get the game character that represents the given player number. */
$gameNetwork.characterForPlayer = function (playerNumber) {
    const username = $gameSystem.userForNumber(playerNumber);
    if (!username) return null;
    if (username === this.username) return $gamePlayer;
    return $remotePlayers.find(p => p.username === username) || null;
};

$gameNetwork.setMoveRoutePlayer = function (playerNumber) {
    this.moveRoutePlayer = playerNumber > 0 ? playerNumber : 0;
};

$gameNetwork.resetMoveRoutePlayer = function () {
    this.moveRoutePlayer = 0;
};

$gameNetwork.localPlayerNumber = function () {
    return Number($gameSystem.numberForUser(this.username));
};

$gameNetwork.playerCount = function () {
    return Object.keys($gameSystem.players()).length;
};

$gameNetwork.isHost = function () {
    return this.side === BestWaifu.MZPeer.Sides.Host;
};

// Redefine what "Player" refers to in a move route
BestWaifu.MZPeer.Game_Interpreter_character = Game_Interpreter.prototype.character;
Game_Interpreter.prototype.character = function (param) {
    if (param < 0 && $gameNetwork.moveRoutePlayer > 0 && !$gameParty.inBattle()) {
        const target = $gameNetwork.characterForPlayer($gameNetwork.moveRoutePlayer);
        if (target) return target;
    }
    return BestWaifu.MZPeer.Game_Interpreter_character.call(this, param);
};

//#endregion