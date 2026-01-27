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
 * @param Player Left Variable
 * @desc The variable to store the player number that left.
 * @type variable
 * @default 0
 *
 * @help
 * 
 */
var BestWaifu = BestWaifu || {};
BestWaifu.MZPeer = BestWaifu.MZPeer || {};
BestWaifu.MZPeer.Version = 1;

BestWaifu.MZPeer.params = PluginManager.parameters("MZPeer");

BestWaifu.MZPeer.ENTER_ROOM_CODE = String(BestWaifu.MZPeer.params["Enter Room Code Text"] || "Enter Room Code");
BestWaifu.MZPeer.DISCONNECT = String(BestWaifu.MZPeer.params["Disconnect Text"] || "Disconnect");
BestWaifu.MZPeer.SET_USERNAME = String(BestWaifu.MZPeer.params["Set Username Text"] || "Set Username");

BestWaifu.MZPeer.PlayerJoinCE = parseInt(BestWaifu.MZPeer.params["Player Join Common Event"]) || 0;
BestWaifu.MZPeer.PlayerJoinVar = parseInt(BestWaifu.MZPeer.params["Player Joined Variable"]) || 0;

BestWaifu.MZPeer.PlayerLeaveCE = parseInt(BestWaifu.MZPeer.params["Player Leave Common Event"]) || 0;
BestWaifu.MZPeer.PlayerLeaveVar = parseInt(BestWaifu.MZPeer.params["Player Left Variable"]) || 0;


BestWaifu.MZPeer.peerIdBase = "mzpeer-91fc5e8a3652ce-";
BestWaifu.MZPeer.lobbyIdCharacters = [
    'Q','R','S','T','Z',
    'U','V','W','X','Y',
    'A','B','C','D','E',
    'F','G','H','J','K',
    'L','M','N','O','P'
]

BestWaifu.MZPeer.lobbyIdLength = 10;

// Hard coded to work like Local Coop for now.
BestWaifu.MZPeer.maxPlayers = 4;

//-----------------------------------------------------------------------------
// #region Network API
//
// Helper objects to interface with the network system.

// Generic class for building data to send over the network
BestWaifu.MZPeer.NetworkData = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.NetworkData.prototype.constructor = BestWaifu.MZPeer.NetworkData;

BestWaifu.MZPeer.NetworkData.prototype.initialize = function(type, username="") {
    this._data = { type, "username": username || $gameNetwork.username };
    this._fields = [
        {
            "type": BestWaifu.MZPeer.NetworkData.DataTypes.STRING,
            "name": "type"
        },
        {
            "type": BestWaifu.MZPeer.NetworkData.DataTypes.STRING,
            "name": "username"
        }
    ];
};

BestWaifu.MZPeer.NetworkData.prototype.type = function() {
    return this._data.type;
};

BestWaifu.MZPeer.NetworkData.prototype.username = function() {
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
BestWaifu.MZPeer.NetworkData.prototype.field = function(type, key) {
    return { "type": type, "name": key };
}

/**
 * Add a field to the NetworkData's schema with the provided type and key.
 * @param {BestWaifu.MZPeer.NetworkData.DataTypes} dataType 
 * @param {String} key 
 */
BestWaifu.MZPeer.NetworkData.prototype.addField = function(dataType, key) {
    if (this._data[key]) throw new Error("Attempted to add a field that exists.");
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
BestWaifu.MZPeer.NetworkData.prototype.getField = function(key, fallback=undefined) {
    if (!this.hasField(key)) return fallback;
    if (this._data[key] === undefined) return fallback;
    if (this._data[key] === null) return fallback;
    return this._data[key];
};

BestWaifu.MZPeer.NetworkData.prototype.hasField = function(key) {
    return this._fields.some(f => f.name === key);
};

/**
 * Set the field with the given key to the value
 * @param {String} key 
 * @param {any} value 
 */
BestWaifu.MZPeer.NetworkData.prototype.setField = function(key, value) {
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
            if (!Number.isInteger(value)) throw new Error("Type mismatch. Expected an Integer.");
            break;
        case BestWaifu.MZPeer.NetworkData.DataTypes.FLOAT:
            if (isNaN(Number(value))) throw new Error("Type mismatch. Expected a float.");
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
BestWaifu.MZPeer.NetworkData.prototype.data = function() {
    return this._data;
};

/** For safely loading an object from the wire as network data. */
BestWaifu.MZPeer.NetworkData.prototype.fromData = function(data) {
    for (const key of Object.keys(data)) {
        if (!this.hasField(key)) continue;
        try {
            this.setField(key, data[key]);
        } catch(e) {
            console.error(e);
        }
    }

    return this;
};


// NetworkDataSubTypes

/**
 * Data to send to the host to invoke a response
 * @param {BestWaifu.MZPeer.NetworkRequest.Codes} code 
 */
BestWaifu.MZPeer.NetworkRequest = function() {
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
    "POST_SAVE_LOAD": 2, // Take us to the next init step
    "INITIALIZE_PLAYERS": 3 // Let the host know we need to initialize players
};

BestWaifu.MZPeer.NetworkRequest.prototype.initialize = function(code=-1) {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "request");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "code");
    this.setField("code", code);
};

/**
 * Data sent to a guest to communicate
 * @param {BestWaifu.MZPeer.NetworkResponse.Codes} code
 */
BestWaifu.MZPeer.NetworkResponse = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.NetworkResponse.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.NetworkResponse.prototype.constructor = BestWaifu.MZPeer.NetworkResponse;

// All valid network response codes.
// Sent from Host -> Guest for one-off commands or state changes
BestWaifu.MZPeer.NetworkResponse.Codes = {
    "RESET": 0,       // Guest should reset their state because host reset the game state
    "DISCONNECT": 1   // Host instructs guest to disconnect gracefully (kicked)
};

BestWaifu.MZPeer.NetworkResponse.prototype.initialize = function(code=-1) {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "response");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "code");
    this.setField("code", code);
};


BestWaifu.MZPeer.SyncSaveData = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncSaveData.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncSaveData.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_save_data");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.STRING, "save_json");
};

BestWaifu.MZPeer.SyncSaveData.prototype.makeSave = function() {
    const contents = DataManager.makeSaveContents();
    this.setField("save_json", JsonEx.stringify(contents));
};

BestWaifu.MZPeer.SyncSaveData.prototype.loadSave = function() {
    const contents = JsonEx.parse(this.getField("save_json"));
    DataManager.extractSaveContents(contents);
    $gamePlayer.refresh();
    $gameMap.requestRefresh();
    $gamePlayer.movementGraph = new BestWaifu.MZPeer.NetworkGraph();

    // Let the host know we are ready for step 2
    $gameNetwork.sendRequest(new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.POST_SAVE_LOAD));
};

BestWaifu.MZPeer.SyncPlayerList = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerList.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerList.prototype.constructor = BestWaifu.MZPeer.SyncPlayerList;
BestWaifu.MZPeer.SyncPlayerList.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_list");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.ARRAY, "list");
};

BestWaifu.MZPeer.SyncPlayerCreation = function() {
    this.initialize(...arguments);
}

BestWaifu.MZPeer.SyncPlayerCreation.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerCreation.prototype.constructor = BestWaifu.MZPeer.SyncPlayerCreation;
BestWaifu.MZPeer.SyncPlayerCreation.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_creation");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "tick");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "x");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "y");
};


BestWaifu.MZPeer.SyncPlayerMovement = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerMovement.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerMovement.prototype.constructor = BestWaifu.MZPeer.SyncPlayerMovement;
BestWaifu.MZPeer.SyncPlayerMovement.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_movement");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "direction");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "speed");
};

/** Used for syncing the orientation of a player. */
BestWaifu.MZPeer.SyncPlayerOrientation = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.SyncPlayerOrientation.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.SyncPlayerOrientation.prototype.constructor = BestWaifu.MZPeer.SyncPlayerOrientation;
BestWaifu.MZPeer.SyncPlayerOrientation.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "sync_player_position");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "direction");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "x");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "y");
};


/** Stores network data inside of itself and the time it was created in the form of ticks. */
BestWaifu.MZPeer.NetworkGraphNode = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.NetworkGraphNode.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.NetworkGraphNode.prototype.constructor = BestWaifu.MZPeer.NetworkGraphNode;
BestWaifu.MZPeer.NetworkGraphNode.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "network_graph_node");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.OBJECT, "network_data");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "tick");
};

/** Used for creating new nodes to be added to a graph. */
BestWaifu.MZPeer.NetworkGraphNode.create = function(tick, network_data) {
    const network_graph_node = new BestWaifu.MZPeer.NetworkGraphNode();
    network_graph_node.setField("tick", tick);
    network_graph_node.setField("network_data", network_data.data());
    return network_graph_node;
};

/** Use to apply the state for this part of the graph's history. */
BestWaifu.MZPeer.NetworkGraphNode.prototype.apply = function() {
    this.handleApply(this.getField("network_data"));
};

/** Get the network data as a NetworkData object */
BestWaifu.MZPeer.NetworkGraphNode.prototype.networkData = function() {
    const data = this.getField("network_data");
    const networkData = new BestWaifu.MZPeer.NetworkData(data.type);
    networkData.fromData(data);
    return networkData;
};

/** Callback function for defining this node's apply behavior. */
BestWaifu.MZPeer.NetworkGraphNode.prototype.handleApply = function(data) {}

/** A continuous graph of networked actions taken since initialization. */
BestWaifu.MZPeer.NetworkGraph = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.NetworkGraph.prototype = Object.create(BestWaifu.MZPeer.NetworkData.prototype);
BestWaifu.MZPeer.NetworkGraph.prototype.constructor = BestWaifu.MZPeer.NetworkGraph;
BestWaifu.MZPeer.NetworkGraph.prototype.initialize = function() {
    BestWaifu.MZPeer.NetworkData.prototype.initialize.call(this, "network_graph");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.INT, "tick");
    this.addField(BestWaifu.MZPeer.NetworkData.DataTypes.ARRAY, "history");
    this._nodes = [];
};

BestWaifu.MZPeer.NetworkGraph.prototype.tick = function() {
    this.setField("tick", $gameNetwork.tick + 1);
    $gameNetwork.tick = this.getField("tick");
};

/** Apply the entire graph. Used for catching up or verifying sync. */
BestWaifu.MZPeer.NetworkGraph.prototype.apply = function() {
    for (const node of this._nodes) {
        const tick = node.getField("tick", 0);
        if (tick <= $gameNetwork.tick) continue;
        if (tick > $gameNetwork.tick) {
            node.apply();
            this.tick();
        }
    }
};

/** Get the latest node. Nodes are always ticked in order and you cannot have two nodes on the same tick. */
BestWaifu.MZPeer.NetworkGraph.prototype.latestNode = function() {
    if (this._nodes.length < 1) return null;
    return this._nodes[this._nodes.length - 1];
};

BestWaifu.MZPeer.NetworkGraph.prototype.latestTick = function() {
    const latestNode = this.latestNode();
    if (!latestNode) return 0;
    return latestNode.getField("tick", 0);
};

BestWaifu.MZPeer.NetworkGraph.prototype.applyLatest = function() {
    const latest = this.latestNode();
    if (latest) {
        latest.apply();
    }
};

BestWaifu.MZPeer.NetworkGraph.SyncStatuses = {
    "NETWORK_BEHIND": 0,
    "NETWORK_SYNCED": 1,
    "NETWORK_AHEAD": 2
};

/** Used to quickly identify and fix types of desync. */
BestWaifu.MZPeer.NetworkGraph.prototype.syncStatus = function() {
    const latestNode = this.latestNode();
    if (!latestNode) return BestWaifu.MZPeer.NetworkGraph.SyncStatuses.NETWORK_SYNCED;
    const latestTick = latestNode.getField("tick", 0);
    if ($gameNetwork.tick < latestTick) return BestWaifu.MZPeer.NetworkGraph.SyncStatuses.NETWORK_BEHIND;
    if ($gameNetwork.tick > latestTick) return BestWaifu.MZPeer.NetworkGraph.SyncStatuses.NETWORK_AHEAD;
    return BestWaifu.MZPeer.NetworkGraph.SyncStatuses.NETWORK_SYNCED;
};

/** Completely clear the graph. Do this on re-initialization to avoid a stupid long history eating memory over time. */
BestWaifu.MZPeer.NetworkGraph.prototype.clear = function() {
    this.setField("tick", 0);
    $gameNetwork.tick = 0;
    this._nodes = [];
};

/** Merge in another graph with ours with the given apply function for each node merged. */
BestWaifu.MZPeer.NetworkGraph.prototype.merge = function(other_graph, onApply=function(data){}) {
    for (const node of other_graph._nodes) {
        if (node.tick <= this.latestTick()) continue;
        this.addNode(node.networkData(), onApply);
    }
};

/** To be overriden with a function to call when a node is applied. */
BestWaifu.MZPeer.NetworkGraph.prototype.onApply = function(data) {};

/** Add a node to the graph timeline holding the given network data with the given callback function. */
BestWaifu.MZPeer.NetworkGraph.prototype.addNode = function(network_data) {
    this.tick();
    const new_node = new BestWaifu.MZPeer.NetworkGraphNode.create(this.getField("tick"), network_data);
    new_node.handleApply = this.onApply;
    this._nodes.push(new_node);
};

/** Load an entire graph from history data. */
BestWaifu.MZPeer.NetworkGraph.prototype.fromHistory = function(history) {
    for (const data of history) {
        const node = new BestWaifu.MZPeer.NetworkGraphNode();
        node.fromData(data);
        this._nodes.push(node);
    }
};

BestWaifu.MZPeer.NetworkGraph.prototype.data = function() {
    // Make the node data raw before storing it in the history field.
    const history = [];
    for (const node of this._nodes) {
        history.push(node.data());
    }
    this.setField("history", history);
    return BestWaifu.MZPeer.NetworkData.prototype.data.call(this);
};



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

$gameNetwork.reset = function() {
    $gameNetwork.peer = null; // Our Peer Object
    $gameNetwork.lobbyId = ""; // The current Lobby ID
    $gameNetwork.hostPeerId = ""; //  The peer ID of the host.
    $gameNetwork.side = BestWaifu.MZPeer.Sides.Local; // Our side
    $gameNetwork.playerList = []; // A list of connected players by username. Not ordered.
    $gameNetwork.spawnablePlayers = []; // A queue of players waiting to spawn.
    $gameNetwork.tick = 0; // Used to track the current time


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
};

Object.defineProperty(window, "$allPlayers", {
    get: function() {
        return [$gamePlayer, ...$remotePlayers];
    }
});

// Technically for initializing but I'm not a pedant and it makes sense in later usages
$gameNetwork.reset();


BestWaifu.MZPeer.Game_Character_initMembers = Game_Character.prototype.initMembers;
Game_Character.prototype.initMembers = function() {
    this.movementGraph = new BestWaifu.MZPeer.NetworkGraph(); // Used to track movement history
    this.movementGraph.onApply = this.onMovementApply.bind(this);
    this._remoteMoveQueue = [];
    BestWaifu.MZPeer.Game_Character_initMembers.call(this);
};

Game_Character.prototype.onMovementApply = function(data) {
    if (!data["type"]) return;
    if (!data["type"] === "sync_player_movement") return;
    const move_sync_data = new BestWaifu.MZPeer.SyncPlayerMovement();
    move_sync_data.fromData(data);
    this._remoteMoveQueue.push(move_sync_data);
};

BestWaifu.MZPeer.Game_Character_update = Game_Character.prototype.update;
Game_Character.prototype.update = function() {
    this.moveByNetwork();
    BestWaifu.MZPeer.Game_Character_update.call(this);
};

Game_Character.prototype.moveByNetwork = function() {
    if (!this._remoteMoveQueue.length) return;
    if (!this.isMoving()) {
        const move_sync_data = this._remoteMoveQueue.pop();
        this.setMoveSpeed(move_sync_data.getField("speed", this.moveSpeed()));
        this.moveStraight(move_sync_data.getField("direction"));
    }
};

BestWaifu.MZPeer.Remote_Player = function() {
    this.initialize(...arguments);
}
BestWaifu.MZPeer.Remote_Player.prototype = Object.create(Game_Character.prototype);
BestWaifu.MZPeer.Remote_Player.prototype.constructor = BestWaifu.MZPeer.Remote_Player;

BestWaifu.MZPeer.Remote_Player.prototype.initialize = function(username) {
    this.username = username; // Used to identify remote players
    Game_Character.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Remote_Player.prototype.actor = function() {
    const N = $gameSystem.numberForUser(this.username) - 1;
    if (N < 0) return null;
    return $gameParty.members()[N] || null;
};

BestWaifu.MZPeer.Remote_Player.prototype.refresh = function() {
    const actor = this.actor();
    const characterName = actor ? actor.characterName() : "";
    const characterIndex = actor ? actor.characterIndex() : 0;
    this.setImage(characterName, characterIndex);
};

// #endregion

//-----------------------------------------------------------------------------
// #region Plugin Commands
//
// Provide plugin commands for:
// - Spawning the last pending player at a given position
// #endregion


//-----------------------------------------------------------------------------
// #region Script Calls
//
// Provide script calls for:
// - Redefining what "Player" refers to in a move route




//#endregion


//-----------------------------------------------------------------------------
// #region Lobbies/PeerJS
//
// Hosting, joining, and leaving lobbies. 
// * The player that created the lobby is designated host.
// * Host save data is the data that is loaded and synced.

$gameNetwork.makeLobbyId = function() {
    let id = "";
    for (let i = 0; i < BestWaifu.MZPeer.lobbyIdLength; i++) {
        id += BestWaifu.MZPeer.lobbyIdCharacters[Math.randomInt(BestWaifu.MZPeer.lobbyIdCharacters.length - 1)];
    }
    return id;
};

// Use the provided base + the lobby ID to make a reconstructable but compact ID
// that shouldn't clash with the server's IDs.
$gameNetwork.makePeerId = function(lobby_id) {
    return BestWaifu.MZPeer.peerIdBase + lobby_id.toLowerCase();
};

$gameNetwork.createHostSession = function() {
    if (!$gameNetwork.username) return;
    if ($gameNetwork.offlineMode) return;
    // We make an ID of our own here for user friendliness
    $gameNetwork.lobbyId = $gameNetwork.makeLobbyId();
    const peer = new Peer($gameNetwork.makePeerId($gameNetwork.lobbyId));
    $gameNetwork.open = true;

    peer.on('open', function(id) {
        console.log(`Successfully opened session with id ${id}`);
    });

    peer.on('connection', $gameNetwork.onPeerConnection);
    peer.on('error', $gameNetwork.onError);

    $gameNetwork.peer = peer;
    $gameNetwork.side = BestWaifu.MZPeer.Sides.Host;

    return peer;
};

$gameNetwork.createGuestSession = function() {
    if (!$gameNetwork.username) return;
    if ($gameNetwork.offlineMode) return;
    // We don't generate an ID here because we only need the host's id to be
    // user friendly. The peer server will automatically generate the ID.
    const peer = new Peer(); 
    $gameNetwork.open = false;

    peer.on('open', function(id) {
        console.log(`Successfully connected to traversal server with id ${id}`);
    });

    peer.on('connection', $gameNetwork.onPeerConnection);
    peer.on('error', $gameNetwork.onError);

    $gameNetwork.peer = peer;
    $gameNetwork.side = BestWaifu.MZPeer.Sides.Guest;
    return peer;
};

/**
 * Helper for sending data to all guests
 * @param {BestWaifu.MZPeer.NetworkData} network_data 
 */
$gameNetwork.sendToGuests = function(network_data) {
    // Forward to all peers
    for (const dataConnection of $gameNetwork.peerConnections) {
        dataConnection.send(network_data.data());
    }
};

/**
 * Helper for sending network data
 * @param {BestWaifu.MZPeer.NetworkData} network_data 
 * @param {BestWaifu.MZPeer.Sides} side 
 * @returns 
 */
$gameNetwork.sendData = function(network_data, side) {

    // Send to all guests if we're host
    if (side === BestWaifu.MZPeer.Sides.Guest) {
        if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) return;
        $gameNetwork.sendToGuests(network_data);
    }

    // Send to host if we're guest
    if (side === BestWaifu.MZPeer.Sides.Host) {
        if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Guest) return;
        if ($gameNetwork.hostConnection) {
            $gameNetwork.hostConnection.send(network_data.data());
        }
    }

    // Send to either
    if (side === BestWaifu.MZPeer.Sides.Common) {
        // all guests
        if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
            $gameNetwork.sendToGuests(network_data);
        }

        // host
        if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
            $gameNetwork.hostConnection.send(network_data.data());
        }
    }
};

/**
 * Convenience function for sending requests
 * @param {BestWaifu.MZPeer.NetworkRequest} networkRequest 
 */
$gameNetwork.sendRequest = function(networkRequest) {
    $gameNetwork.sendData(networkRequest, BestWaifu.MZPeer.Sides.Host);
};

/**
 * Convenience function for sending data to a guest
 * @param {BestWaifu.MZPeer.NetworkData} networkData 
 */
$gameNetwork.sendResponse = function(username, networkData) {
    if ($gameNetwork.side !== BestWaifu.MZPeer.Sides.Host) return; // Only host can send responses
    for (const peer of $gameNetwork.peerConnections) {
        if (peer.metadata?.username === username) {
            peer.send(networkData.data());
        }
    }
};

$gameNetwork.showJoinLobby = function() {
    if (!$gameNetwork.username) return
    const peer = $gameNetwork.createGuestSession();
    SceneManager.push(BestWaifu.MZPeer.Scene_JoinLobby);
    SceneManager.prepareNextScene(peer, BestWaifu.MZPeer.lobbyIdLength);
};

// Destroy the current session
$gameNetwork.destroySession = function() {
    if ($gameNetwork.peer && !$gameNetwork.peer.destroyed) {
        $gameNetwork.peer.destroy();
    }
    $gameNetwork.reset();
    console.log("Successfully destroyed the session.");
};

// Drop a peer
$gameNetwork.dropPeer = function(username) {
    const connIndex = $gameNetwork.peerConnections.findIndex(c => c.metadata.username === username);
    if (connIndex >= 0) {
        $gameNetwork.peerConnections[connIndex].close();
        $gameNetwork.peerConnections.splice(connIndex, 1);
    }
};

$gameNetwork.makePlayerList = function() {
    $gameNetwork.playerList = [$gameNetwork.username];
    for (const peerConnection of $gameNetwork.peerConnections) {
        $gameNetwork.playerList.push(peerConnection.metadata?.username);
    }
};

$gameNetwork.errorQueue = [];
$gameNetwork.pushError = function(message) {
    $gameNetwork.errorQueue.push(message);
};

//#region General Connection Handling

$gameNetwork.onHostConnectionError = function(error) {
    $gameNetwork.destroySession();
    SceneManager._scene.fadeOutAll();
    SceneManager.goto(Scene_Title);
    switch(error.type) {
        case "network":
            $gameNetwork.pushError("Lost connection to host.");
            break;
        case "disconnected":
            $gameNetwork.pushError("Disconnected from host.");
            break;
        default:
            $gameNetwork.pushError("Unknown netplay error.");
    }
    $gameNetwork.pushError(error.message);
};

$gameNetwork.onHostDisconnected = function() {
    $gameNetwork.destroySession();
    SceneManager._scene.fadeOutAll();
    SceneManager.goto(Scene_Title);
    $gameNetwork.pushError("Disconnected by host.");
};

$gameNetwork.onError = function(error) {
    $gameNetwork.destroySession();
    let message = "";
    switch(error.type) {
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
//#endregion

//#region Host Handling
$gameNetwork.onPeerConnection = function(dataConnection) {
    if (!$gameNetwork.open) {
        console.log("Rejecting connection from remote peer. Not accepting new connections.");
        dataConnection.close();
        return;
    }

    const username = dataConnection.metadata?.username;
    if (!username) {
        console.log("Rejecting connection: no username provided.");
        dataConnection.close();
        return;
    }

    if (username === $gameNetwork.username) {
        console.log("Rejecting connection: username conflicts with host.");
        dataConnection.close();
        return; 
    }

    // Check if we already have a peer with the same username
    const existingIndex = $gameNetwork.peerConnections.findIndex(conn => conn.metadata?.username === username);
    if (existingIndex >= 0) {
        const existingPeer = $gameNetwork.peerConnections[existingIndex];
        console.log(`Replacing old connection for "${username}" with new peer.`);
        existingPeer.close(); // destroy the old connection
        $gameNetwork.peerConnections.splice(existingIndex, 1);
    }

    if ($gameNetwork.peerConnections.length + 1 > BestWaifu.MZPeer.maxPlayers) {
        console.log("Rejection connection: Lobby is full.");
        dataConnection.close();
        return;
    }

    console.log(`${username} connected.`);
    $gameNetwork.peerConnections.push(dataConnection);
    dataConnection.on('data', $gameNetwork.onPeerData);
    dataConnection.on('close', $gameNetwork.onPeerDisconnection.bind(this, dataConnection));
};

$gameNetwork.onPeerDisconnection = function(peerConnection) {

    console.log(`${peerConnection.metadata?.username} disconnected.`);
    $gameNetwork.peerConnections = $gameNetwork.peerConnections.filter(c => c.open);

    $gameNetwork.makePlayerList(); // Refresh the player list
    $gameNetwork.sendToGuests(new BestWaifu.MZPeer.SyncPlayerList($gameNetwork.playerList)); // Refresh the player list for guests

    if (BestWaifu.MZPeer.PlayerLeaveVar > 0) {
        $gameVariables.setValue(BestWaifu.MZPeer.PlayerLeaveVar, $gameSystem.numberForUser(peerConnection.metadata?.username));
    }
    if (BestWaifu.MZPeer.PlayerLeaveCE > 0) {
        $gameTemp.reserveCommonEvent(BestWaifu.MZPeer.PlayerLeaveCE);
    }
};

$gameNetwork.handleMovementSync = function(data) {
    const player_movement_sync = new BestWaifu.MZPeer.SyncPlayerMovement();
    player_movement_sync.fromData(data);
    for (const remotePlayer of $remotePlayers) {
        if (remotePlayer.username != player_movement_sync.getField("username")) continue;
        remotePlayer.movementGraph.addNode(player_movement_sync);
        remotePlayer.movementGraph.applyLatest();
    }
    if ($gameNetwork.side == BestWaifu.MZPeer.Sides.Host) {
         $gameNetwork.sendToGuests(player_movement_sync);
    }
};

$gameNetwork.onPeerData = function(data) {
    if (typeof data !== "object") return;
    if (!data || !data.type || !data.username) return;

    switch (data.type) {
        case "request":
            const request = new BestWaifu.MZPeer.NetworkRequest();
            request.fromData(data);
            $gameNetwork.handleRequest(request);
            break;

        case "response":
            console.warn("Received unexpected response from peer:", data);
            break;
        
        case "sync_player_movement":
            $gameNetwork.handleMovementSync(data);
            break;

        default:
            console.warn("Unknown data type:", data.type);
            break;
    }
};

$gameNetwork.handleRequest = function(request) {
    switch (request.getField("code")) {

        case BestWaifu.MZPeer.NetworkRequest.Codes.DISCONNECT:
            $gameNetwork.dropPeer(request.username());
            break;

        
        case BestWaifu.MZPeer.NetworkRequest.Codes.INIT:
            // Track the player in the numbering system
            $gameSystem.addPlayer(request.username());

            // Sync save data
            const save_sync = new BestWaifu.MZPeer.SyncSaveData();
            save_sync.makeSave();
            $gameNetwork.sendResponse(request.username(), save_sync);
            break;
        
        case BestWaifu.MZPeer.NetworkRequest.Codes.POST_SAVE_LOAD:
            // Send the player list
            $gameNetwork.makePlayerList();
            const player_list_data = new BestWaifu.MZPeer.SyncPlayerList();
            player_list_data.setField("list", $gameNetwork.playerList);
            $gameNetwork.sendResponse(request.username(), player_list_data);

            // Designate the player as spawnable/creatable
            $gameNetwork.spawnablePlayers.push(request.username());

            if (BestWaifu.MZPeer.PlayerJoinVar > 0) {
                $gameVariables.setValue(BestWaifu.MZPeer.PlayerJoinVar, $gameSystem.numberForUser(request.username()));
            }
            
            if (BestWaifu.MZPeer.PlayerJoinCE > 0) {
                $gameTemp.reserveCommonEvent(BestWaifu.MZPeer.PlayerJoinCE);
            }
            break;
        
        case BestWaifu.MZPeer.NetworkRequest.Codes.INITIALIZE_PLAYERS:
            // Sync Guests
            for (const player of $allPlayers.filter(p => p instanceof BestWaifu.MZPeer.Remote_Player)) {
                const guest_player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();
                guest_player_creation_sync.setField("username", player.username);
                guest_player_creation_sync.setField("x", player.x);
                guest_player_creation_sync.setField("y", player.y);
                $gameNetwork.sendResponse(request.username(), guest_player_creation_sync);
            }
            // Sync us (Host)
            const host_player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();
            host_player_creation_sync.setField("username", $gameNetwork.username);
            host_player_creation_sync.setField("x", $gamePlayer.x);
            host_player_creation_sync.setField("y", $gamePlayer.y);
            $gameNetwork.sendResponse(request.username(), host_player_creation_sync);
            break;
        
        default:
            console.warn("Unhandled request code:", request.getField("code"));
            break;
    }
};

//#endregion


//#region Guest Handling
$gameNetwork.onHostData = function(data) {
    if (typeof data !== "object") return;
    if (!data || !data.type) return;

    switch (data.type) {
        case "response":
            const response = new BestWaifu.MZPeer.NetworkResponse();
            response.fromData(data);
            $gameNetwork.handleResponse(response);
            break;
        
        case "sync_save_data":
            const save_data_sync = new BestWaifu.MZPeer.SyncSaveData();
            save_data_sync.fromData(data);
            save_data_sync.loadSave();
            console.log("Successfully loaded save.")
            break;
        
        case "sync_player_list":
            const player_list_sync = new BestWaifu.MZPeer.SyncPlayerList();
            player_list_sync.fromData(data);
            $gameNetwork.playerList = player_list_sync.getField("list", [$gameNetwork.username]);
            console.log("Successfully loaded player list.");
            break;
        
        case "sync_player_creation":
            const player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();
            player_creation_sync.fromData(data);
            if (player_creation_sync.getField("username") == $gameNetwork.username) {
                $gameNetwork.tick = player_creation_sync.getField("tick", 0);
                SceneManager.goto(Scene_Map);
            } else {
                $gameNetwork.createRemotePlayer(
                    player_creation_sync.getField("username"),
                    player_creation_sync.getField("x"),
                    player_creation_sync.getField("y")
                );
            }
            console.log(`Successfully synced ${$allPlayers.length - 1} players.`)
            break;
        
        case "sync_player_movement":
            $gameNetwork.handleMovementSync(data);
            break;

        case "request":
            console.warn("Unexpected request from host:", data);
            break;

        default:
            console.warn("Unknown host data type:", data.type);
            break;
    }
};

$gameNetwork.handleResponse = function(response) {
    console.log(`Recieved response from ${response.username()}`)
    switch (response.getField("code")) {
        case BestWaifu.MZPeer.NetworkResponse.Codes.DISCONNECT:
            console.log("Disconnect signal recieved.");
            this.onHostDisconnected();
            break;

        case BestWaifu.MZPeer.NetworkResponse.Codes.RESET:
            console.log("Reset signal recieved.");
            this.fadeOutAll();
            SceneManager.goto(BestWaifu.MZPeer.Scene_NetplayWaiting);
            const req = new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.INIT);
            $gameNetwork.sendRequest(req);
            break;

        default:
            console.warn(`Unhandled host response code: ${response.getField("code")}`);
            break;
    }
};
//#endregion



//#region Common GUI Components

//-----------------------------------------------------------------------------
// Window_ErrorAlertCommand
//
BestWaifu.MZPeer.Window_ErrorAlertCommand = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Window_ErrorAlertCommand.prototype = Object.create(Window_HorzCommand.prototype);
BestWaifu.MZPeer.Window_ErrorAlertCommand.prototype.constructor = BestWaifu.MZPeer.Window_ErrorAlertCommand;

BestWaifu.MZPeer.Window_ErrorAlertCommand.prototype.makeCommandList = function() {
    this.addCommand("Ok", "ok");
};

//-----------------------------------------------------------------------------
// Scene_ErrorAlert
//
// A generic error scene
BestWaifu.MZPeer.Scene_ErrorAlert = function() {
    this.initialize(...arguments);
};
BestWaifu.MZPeer.Scene_ErrorAlert.prototype = Object.create(Scene_MenuBase.prototype);
BestWaifu.MZPeer.Scene_ErrorAlert.prototype.constructor = BestWaifu.MZPeer.Scene_ErrorAlert;

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.initialize = function() {
    Scene_MenuBase.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.prepare = function(message) {
    this._message = message;
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createMessageWindow();
    this.createCommandWindow();
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.createMessageWindow = function() {
    this._messageWindow = new Window_Help(this.messageWindowRect());
    if (!this._message) { this.popScene(); return; }
    this._messageWindow.setText(this._message);
    this.addWindow(this._messageWindow);
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.createCommandWindow = function() {
    this._commandWindow = new BestWaifu.MZPeer.Window_ErrorAlertCommand(this.commandWindowRect());
    this._commandWindow.setHandler("ok", this.popScene.bind(this));
    this._commandWindow.setHandler("cancel", this.popScene.bind(this));
    this.addWindow(this._commandWindow);
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.messageWindowRect = function() {
    const wx = 0;
    const wy = this.mainAreaTop();
    const ww = Graphics.boxWidth;
    const wh = Graphics.boxHeight - this.calcWindowHeight(1, true);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_ErrorAlert.prototype.commandWindowRect = function() {
    const wx = 0;
    const wy = this._messageWindow.height;
    const ww = Graphics.boxWidth;
    const wh = this.calcWindowHeight(1, true);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.isAlphaNumeric = function(char) {
    const regex = /[a-z0-9]+/i
    return regex.test(char);
};

BestWaifu.MZPeer.isInviteCodeChar = function(char) {
    if (char.length > 1) return true;
    return BestWaifu.MZPeer.lobbyIdCharacters.includes(char);
};

//-----------------------------------------------------------------------------
// Window_TextInput
BestWaifu.MZPeer.Window_TextInput = function() {
    this.initialize(...arguments);
}

BestWaifu.MZPeer.Window_TextInput.prototype = Object.create(Window_NameInput.prototype);
BestWaifu.MZPeer.Window_TextInput.prototype.constructor = BestWaifu.MZPeer.Window_TextInput;

BestWaifu.MZPeer.Window_TextInput.prototype.table = function() {
    return [
        Window_NameInput.LATIN1,
        Window_NameInput.LATIN2
    ];
};

BestWaifu.MZPeer.Window_TextInput.prototype.drawItem = function(index) {
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

BestWaifu.MZPeer.Window_TextInput.prototype.onNameOk = function() {
    this.playOkSound();
    this.callOkHandler();
};

//-----------------------------------------------------------------------------
// Window_TextEdit
BestWaifu.MZPeer.Window_TextEdit = function() {
    this.initialize(...arguments);
};
BestWaifu.MZPeer.Window_TextEdit.prototype = Object.create(Window_NameEdit.prototype);
BestWaifu.MZPeer.Window_TextEdit.prototype.constructor = BestWaifu.MZPeer.Window_TextEdit;

BestWaifu.MZPeer.Window_TextEdit.prototype.initialize = function(rect) {
    Window_StatusBase.prototype.initialize.call(this, rect);
    this._maxLength = 0;
    this._name = "";
    this.deactivate();
};

BestWaifu.MZPeer.Window_TextEdit.prototype.isValidChar = function(ch) {
    return BestWaifu.MZPeer.isAlphaNumeric(ch);
};

BestWaifu.MZPeer.Window_TextEdit.prototype.add = function(ch) {
    if (!this.isValidChar(ch)) return false;
    return Window_NameEdit.prototype.add.call(this, ch);
};

BestWaifu.MZPeer.Window_TextEdit.prototype.setup = function(maxLength) {
    this._maxLength = maxLength;
};

BestWaifu.MZPeer.Window_TextEdit.prototype.restoreDefault = function() {
    this._name = "";
};

BestWaifu.MZPeer.Window_TextEdit.prototype.refresh = function() {
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
//-----------------------------------------------------------------------------
// Scene_JoinLobby
//
BestWaifu.MZPeer.Scene_JoinLobby = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype = Object.create(Scene_MenuBase.prototype);
BestWaifu.MZPeer.Scene_JoinLobby.prototype.constructor = BestWaifu.MZPeer.Scene_JoinLobby;

BestWaifu.MZPeer.Scene_JoinLobby.prototype.initialize = function() {
    Scene_MenuBase.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.prepare = function(peer, maxLength) {
    this._maxLength = maxLength;
    this._peer = peer;
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onConnected = function() {
    // May have a password system later, idk
    this.onAuthorized();
};


BestWaifu.MZPeer.Scene_JoinLobby.prototype.onAuthorized = function() {
    this.fadeOutAll();
    SceneManager.goto(BestWaifu.MZPeer.Scene_NetplayWaiting);
    const req = new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.INIT);
    $gameNetwork.sendRequest(req);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onConnectionError = function(err) {
    $gameNetwork.pushError("Failed to connect to host.");
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onRejected = function() {
    $gameNetwork.pushError("Lost connection to host.");
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createEditWindow();
    this.createInputWindow();
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.createEditWindow = function() {
    const rect = this.editWindowRect();
    this._editWindow = new BestWaifu.MZPeer.Window_TextEdit(rect);
    this._editWindow.isValidChar = BestWaifu.MZPeer.isInviteCodeChar;
    this._editWindow.setup(this._maxLength);
    this.addWindow(this._editWindow);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.createInputWindow = function() {
    const rect = this.inputWindowRect();
    this._inputWindow = new BestWaifu.MZPeer.Window_TextInput(rect);
    this._inputWindow.setEditWindow(this._editWindow);
    this._inputWindow.setHandler("ok", this.onInputOk.bind(this));
    this.addWindow(this._inputWindow);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.editWindowRect = function() {
    const inputWindowHeight = this.calcWindowHeight(9, true);
    const padding = $gameSystem.windowPadding();
    const ww = 600;
    const wh = ImageManager.standardFaceHeight + padding * 2;
    const wx = (Graphics.boxWidth - ww) / 2;
    const wy = (Graphics.boxHeight - (wh + inputWindowHeight + 8)) / 2;
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.inputWindowRect = function() {
    const wx = this._editWindow.x;
    const wy = this._editWindow.y + this._editWindow.height + 8;
    const ww = this._editWindow.width;
    const wh = this.calcWindowHeight(9, true);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.makeConnection = function(lobbyId) {
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
        reliable: true
    });

    // Apply the listeners
    $gameNetwork.hostConnection.on('open', this.onConnected.bind(this));
    $gameNetwork.hostConnection.on('close', $gameNetwork.onHostDisconnected);
    $gameNetwork.hostConnection.on('error', $gameNetwork.onHostConnectionError);
    $gameNetwork.hostConnection.on('data', $gameNetwork.onHostData);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onInputOk = function() {
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

BestWaifu.MZPeer.Scene_JoinLobby.prototype.start = function() {
    Scene_MenuBase.prototype.start.call(this);
    this._editWindow.refresh();
};


//-----------------------------------------------------------------------------
// Network Options
//
// By default the username is blank and online play won't be possible without it being set
Object.defineProperty(ConfigManager, "username", {
    get: function() {
        return $gameNetwork.username;
    },
    set: function(value) {
        $gameNetwork.username = value;
    },
    configurable: true
});

BestWaifu.MZPeer.ConfigManager_makeData = ConfigManager.makeData;
ConfigManager.makeData = function() {
    const config = BestWaifu.MZPeer.ConfigManager_makeData.call(this);
    config.username = this.username;
    return config;
};

BestWaifu.MZPeer.ConfigManager_applyData = ConfigManager.applyData;
ConfigManager.applyData = function(config) {
    this.username = this.readString(config, "username");
    BestWaifu.MZPeer.ConfigManager_applyData.call(this);
};

ConfigManager.readString = function(config, name) {
    if (name in config) {
        return String(config[name])
    } else {
        return ""
    }
};


BestWaifu.MZPeer.Window_Options_makeCommandList = Window_Options.prototype.makeCommandList;
Window_Options.prototype.makeCommandList = function() {
    BestWaifu.MZPeer.Window_Options_makeCommandList.call(this);
    this.addNetworkOptions();
};

Window_Options.prototype.addNetworkOptions = function() {
    this.addCommand("Netplay", "netplay");
};

Window_Options.prototype.isNetworkSymbol = function(symbol) {
    return symbol === "netplay";
};

BestWaifu.MZPeer.Window_Options_statusText = Window_Options.prototype.statusText;
Window_Options.prototype.statusText = function(index) {
    const symbol = this.commandSymbol(index);
    if (this.isNetworkSymbol(symbol)) {
        return this.booleanStatusText($gameNetwork.username != "");
    }
    return BestWaifu.MZPeer.Window_Options_statusText.call(this, index);
};

BestWaifu.MZPeer.Window_Options_processOk = Window_Options.prototype.processOk;
Window_Options.prototype.processOk = function() {
    const index = this.index();
    const symbol = this.commandSymbol(index);
    if (this.isNetworkSymbol(symbol)) {
        SceneManager.push(BestWaifu.MZPeer.Scene_NetplayOptions);
    } else {
        BestWaifu.MZPeer.Window_Options_processOk.call(this);
    }
};

BestWaifu.MZPeer.Scene_Options_maxCommands = Scene_Options.prototype.maxCommands;
Scene_Options.prototype.maxCommands = function() {
    return BestWaifu.MZPeer.Scene_Options_maxCommands.call(this) + 1;
};

//-----------------------------------------------------------------------------
// Window_NetPlayOptions
//
BestWaifu.MZPeer.Window_NetplayOptions = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Window_NetplayOptions.prototype = Object.create(Window_Command.prototype);
BestWaifu.MZPeer.Window_NetplayOptions.prototype.constructor = BestWaifu.MZPeer.Window_NetplayOptions;

BestWaifu.MZPeer.Window_NetplayOptions.prototype.userIdChangable = function() {
    return $gameNetwork.side === BestWaifu.MZPeer.Sides.Local;
};

BestWaifu.MZPeer.Window_NetplayOptions.prototype.makeCommandList = function() {
    if ($gameNetwork.username && $gameNetwork.side === BestWaifu.MZPeer.Sides.Local) {
        this.addCommand(BestWaifu.MZPeer.ENTER_ROOM_CODE, "join")
    }
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest || $gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        this.addCommand(BestWaifu.MZPeer.DISCONNECT, "disconnect");
    }

    this.addCommand(BestWaifu.MZPeer.SET_USERNAME, "username", this.userIdChangable());
};


//-----------------------------------------------------------------------------
// Scene_UsernameInput
//
BestWaifu.MZPeer.Scene_UsernameInput = function() {
    this.initialize(...arguments);
};
BestWaifu.MZPeer.Scene_UsernameInput.prototype = Object.create(Scene_MenuBase.prototype);
BestWaifu.MZPeer.Scene_UsernameInput.prototype.constructor = BestWaifu.MZPeer.Scene_UsernameInput;

BestWaifu.MZPeer.Scene_UsernameInput.prototype.initialize = function() {
    Scene_MenuBase.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createEditWindow();
    this.createInputWindow();
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.prepare = function(maxLength) {
    this._maxLength = maxLength;
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.createEditWindow = function() {
    const rect = this.editWindowRect();
    this._editWindow = new BestWaifu.MZPeer.Window_TextEdit(rect);
    this._editWindow.setup(this._maxLength);
    this.addWindow(this._editWindow);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.createInputWindow = function() {
    const rect = this.inputWindowRect();
    this._inputWindow = new BestWaifu.MZPeer.Window_TextInput(rect);
    this._inputWindow.setEditWindow(this._editWindow);
    this._inputWindow.setHandler("ok", this.onInputOk.bind(this));
    this.addWindow(this._inputWindow);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.editWindowRect = function() {
    const inputWindowHeight = this.calcWindowHeight(9, true);
    const padding = $gameSystem.windowPadding();
    const ww = 600;
    const wh = ImageManager.standardFaceHeight + padding * 2;
    const wx = (Graphics.boxWidth - ww) / 2;
    const wy = (Graphics.boxHeight - (wh + inputWindowHeight + 8)) / 2;
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.inputWindowRect = function() {
    const wx = this._editWindow.x;
    const wy = this._editWindow.y + this._editWindow.height + 8;
    const ww = this._editWindow.width;
    const wh = this.calcWindowHeight(9, true);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.onInputOk = function() {
    ConfigManager.username = this._editWindow.name() || "";
    this.popScene();
};

BestWaifu.MZPeer.Scene_UsernameInput.prototype.start = function() {
    Scene_MenuBase.prototype.start.call(this);
    this._editWindow.refresh();
};

//-----------------------------------------------------------------------------
// Scene_NetplayOptions
//
BestWaifu.MZPeer.Scene_NetplayOptions = function() {
    this.initialize(...arguments);
};
BestWaifu.MZPeer.Scene_NetplayOptions.prototype = Object.create(Scene_MenuBase.prototype);
BestWaifu.MZPeer.Scene_NetplayOptions.prototype.constructor = BestWaifu.MZPeer.Scene_NetplayOptions;

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.initialize = function() {
    Scene_MenuBase.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createAllWindows();
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.createAllWindows = function() {
    this.createLobbyStatusWindow();
    this.createCommandWindow();
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.sideText = function() {
    switch($gameNetwork.side) {
        case BestWaifu.MZPeer.Sides.Guest:
            return "\\c[4]Guest\\c[0]";
        case BestWaifu.MZPeer.Sides.Host:
            return "\\c[6]Host\\c[0]";
        default:
            return "\\c[7]Not connected\\c[0]"
    }
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.lobbyText = function() {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Local) {
        return "";
    }
    return "| Lobby ID " + $gameNetwork.lobbyId.toUpperCase();
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.helpText = function() {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Local) {
        if (!$gameNetwork.username) {
            return "\\c[10]A username must be set to use netplay.\\c[0]";
        } else {
            return "Username: " + $gameNetwork.username + "\nThe game will automatically be set to host when \ncreating or loading a save. To disable, set to blank.";
        }
    }
    return "Username: " + $gameNetwork.username;
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.createLobbyStatusWindow = function() {
    this._lobbyStatusWindow = new Window_Help(this.lobbyStatusRect());
    this._lobbyStatusWindow.setText(
        this.sideText() 
        + this.lobbyText()
        + "\n"
        + this.helpText()
        );
    this.addWindow(this._lobbyStatusWindow);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.createCommandWindow = function() {
    this._commandWindow = new BestWaifu.MZPeer.Window_NetplayOptions(this.commandWindowRect());
    this._commandWindow.setHandler("cancel", this.popScene.bind(this));
    
    this._commandWindow.setHandler("disconnect", this.onDisconnect.bind(this));
    this._commandWindow.setHandler("join", this.onJoin.bind(this));
    this._commandWindow.setHandler("username", this.onUsername.bind(this));

    this.addWindow(this._commandWindow);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.onDisconnect = function() {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        $gameNetwork.sendData(
            new BestWaifu.MZPeer.NetworkResponse(BestWaifu.MZPeer.NetworkResponse.Codes.DISCONNECT), 
            BestWaifu.MZPeer.Sides.Guest);
        $gameNetwork.destroySession();
    }
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        $gameNetwork.sendRequest(new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.DISCONNECT));
        $gameNetwork.destroySession();
    }
    this.fadeOutAll();
    SceneManager.goto(Scene_Title);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.onJoin = function() {
    $gameNetwork.showJoinLobby();
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.onUsername = function() {
    SceneManager.push(BestWaifu.MZPeer.Scene_UsernameInput);
    SceneManager.prepareNextScene(8);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.lobbyStatusRect = function() {
    const wx = 0;
    const wy = this.mainAreaTop();
    const ww = Graphics.boxWidth;
    const wh = this.calcWindowHeight(4, false);
    return new Rectangle(wx, wy, ww, wh);
};

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.commandWindowRect = function() {
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

BestWaifu.MZPeer.Scene_NetplayOptions.prototype.start = function() {
    Scene_MenuBase.prototype.start.call(this);
    this._commandWindow.refresh();
};


 //-----------------------------------------------------------------------------
 // Scene_NetplayWaiting
 //
 // A scene to send the guest to while things are loading.
BestWaifu.MZPeer.Scene_NetplayWaiting = function() {
    this.initialize(...arguments);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype = Object.create(Scene_Base.prototype);
BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.constructor = BestWaifu.MZPeer.Scene_NetplayWaiting;

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.initialize = function() {
    this._animationFrames = 0;
    Scene_Base.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.create = function() {
    Scene_Base.prototype.create.call(this);
    this.createForeground();
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.createForeground = function() {
    this._loadingSprite = new Sprite(
        new Bitmap(Graphics.width, Graphics.height)
    );
    this.addChild(this._loadingSprite);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.update = function() {
    if (!this.isBusy()) {
        this.animate();
    }
    Scene_Base.prototype.update.call(this);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.circleX = function(order, bitmap, radius) {
    const diameter = (radius * 2) * 1.25;
    return ((bitmap.width / 2) - diameter) + (diameter * order)
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.circleY = function(order, bitmap, radius) {
    const diameter = radius * 2;

    let y = bitmap.height / 2;

    if (this.activeCircleOrder() === order) {
        y -= (this._animationFrames / 4);
    }

    return y;
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.activeCircleOrder = function() {
    return Math.floor(this._animationFrames / 24);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.animate = function() {
    if (!this._loadingSprite) return;
    if (this._animationFrames > 71) this._animationFrames = 0;

    if (this._animationFrames === 0) {
        AudioManager.playSe({name:"Ice1", pitch:100, volume:25})
    }

    if (this._animationFrames === 24) {
        AudioManager.playSe({name:"Ice1", pitch:125, volume:25})
    }

    if (this._animationFrames === 48) {
        AudioManager.playSe({name:"Ice1", pitch:135, volume:25})
    }

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

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.start = function() {
    Scene_Base.prototype.start.call(this);
    SceneManager.clearStack();
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.terminate = function() {
    Scene_Base.prototype.terminate.call(this);
    if (this._loadingSprite) {
        this._loadingSprite.bitmap.destroy();
    }
    AudioManager.playSe({ "name": "Decision3", pitch: 200, volume: 25 })
};


//#endregion


//#region Network System Logic/hooks

BestWaifu.MZPeer.Scene_Map_start = Scene_Map.prototype.start;
Scene_Map.prototype.start = function() {
    BestWaifu.MZPeer.Scene_Map_start.call(this);
    
    // Session creation
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Local) {
        if ($gameNetwork.username) {
            $gameNetwork.createHostSession();
        }
    }

    // Player creation
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        if ($allPlayers.length < $gameNetwork.playerList.length) {
            $gameNetwork.sendRequest(new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.INITIALIZE_PLAYERS));
        }
    }
};

BestWaifu.MZPeer.Scene_Base_update = Scene_Base.prototype.update;
Scene_Base.prototype.update = function() {
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
Scene_Map.prototype.shouldAutosave = function() {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) return false;
    return BestWaifu.MZPeer.Scene_Map_shouldAutosave.call(this);
};

BestWaifu.MZPeer.Window_MenuCommand_isSaveEnabled = Window_MenuCommand.prototype.isSaveEnabled;
Window_MenuCommand.prototype.isSaveEnabled = function() {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) return false;
    return BestWaifu.MZPeer.Window_MenuCommand_isSaveEnabled.call(this);
};

// Disable game end as guest
BestWaifu.MZPeer.Window_MenuCommand_isGameEndEnabled = Window_MenuCommand.prototype.isGameEndEnabled;
Window_MenuCommand.prototype.isGameEndEnabled = function() {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) return false;
    return BestWaifu.MZPeer.Window_MenuCommand_isGameEndEnabled.call(this);
};

//-----------------------------------------------------------------------------
// Bind Player Numbers to Usernames
//
BestWaifu.MZPeer.Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() {
    this._players = {1: $gameNetwork.username };
    BestWaifu.MZPeer.Game_System_initialize.call(this);
};

Game_System.prototype.addPlayer = function(username) {
    if (Object.values(this._players).includes(username)) return;
    const currentPlayerCount = Object.keys(this._players).length;
    this._players[currentPlayerCount + 1] = username;
};

Game_System.prototype.players = function() {
    return this._players;
};

Game_System.prototype.numberForUser = function(username) {
    for (const N of Object.keys(this._players)) {
        if (this._players[N] == username) return N;
    }
    return -1;
};
//#endregion


//-----------------------------------------------------------------------------
// RMMZ Core Changes
//

//-----------------------------------------------------------------------------
// #region Real Time Character Syncing
//
// Make the players visibly appear on screen and move around in real time

BestWaifu.MZPeer.Scene_Map_updateMain = Scene_Map.prototype.updateMain;
Scene_Map.prototype.updateMain = function() {
    BestWaifu.MZPeer.Scene_Map_updateMain.call(this);
    for (const remotePlayer of $remotePlayers) {
        remotePlayer.update();
    }
};

$gameNetwork.spawnLastPlayer = function(x, y) {
    const username = $gameNetwork.spawnablePlayers.pop();
    if (username) {
        this.createRemotePlayer(username, x, y);
    }
};

// Create a remote player. Only valid on a map scene.
$gameNetwork.createRemotePlayer = function(username, x, y) {
    if (!(SceneManager._scene instanceof Scene_Map)) return;
    
    // Avoid creating a remote player that already exists
    for (const remotePlayer of $remotePlayers) {
        if (remotePlayer.username === username) return;
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
        const player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();
        player_creation_sync.setField("tick", $gameNetwork.tick);
        player_creation_sync.setField("username", username);
        player_creation_sync.setField("x", x);
        player_creation_sync.setField("y", y);
        $gameNetwork.sendToGuests(player_creation_sync);
    }
};

// For instant creation of remote player sprites
$gameNetwork.addRemotePlayerSprite = function(spriteSet, remotePlayer) {
    if (!spriteSet || !remotePlayer) return;
    const sprite = new Sprite_Character(remotePlayer);
    spriteSet._characterSprites.push(sprite);
    spriteSet._tilemap.addChild(sprite);
};

// Create the sprites for remote players automatically on the map's spriteset
Spriteset_Map.prototype.createCharacters = function() {
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
Game_Follower.prototype.isVisible = function() {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) return false;
    for (const player of $remotePlayers) {
        const N = $gameSystem.numberForUser(player.username);
        if (this._memberIndex === N - 1) return false;
    }

    return BestWaifu.MZPeer.Game_Follower_isVisible.call(this);
};

BestWaifu.MZPeer.Game_Player_refresh = Game_Player.prototype.refresh;
Game_Player.prototype.refresh = function() {
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        const N = $gameSystem.numberForUser($gameNetwork.username);
        const actor = $gameParty.members()[N - 1];
        const characterName = actor ? actor.characterName() : "";
        const characterIndex = actor ? actor.characterIndex() : 0;
        this.setImage(characterName, characterIndex);
        this._followers.refresh();
    } else {
        BestWaifu.MZPeer.Game_Player_refresh.call(this);
    }
};

// TODO: Add functionality for destroying remote players on disconnect

BestWaifu.MZPeer.Game_Player_executeMove = Game_Player.prototype.executeMove;
Game_Player.prototype.executeMove = function(dir) {
    BestWaifu.MZPeer.Game_Player_executeMove.call(this, dir);
    const move_sync_data = new BestWaifu.MZPeer.SyncPlayerMovement();
    move_sync_data.setField("direction", dir);
    move_sync_data.setField("speed", this.realMoveSpeed());
    this.movementGraph.addNode(move_sync_data);
    $gameNetwork.sendData(move_sync_data, BestWaifu.MZPeer.Sides.Common);
};

// TODO: Sync event movements for guests
BestWaifu.MZPeer.Game_Event_canMove = Game_Event.prototype.canMove;
Game_Event.prototype.canMove = function() {
    if ($gameNetwork.side == BestWaifu.MZPeer.Sides.Guest) return false;
    return BestWaifu.MZPeer.Game_Event_canMove.call(this);
};

//#endregion

//-----------------------------------------------------------------------------
// #region Real Time Data Syncing
//
// Switches, variables, gold, exp, etc. all of this should be synced both ways


//#endregion

//-----------------------------------------------------------------------------
// #region Real Time Event Syncing
//
// When a player triggers an event it 
// should run according to what side the current player is on.

// Events should only be moved by the host

//#endregion

//-----------------------------------------------------------------------------
// #region Battle Syncing
//
// The meat and potatos of it all. Complex syncing of battle mechanics and state.

//#endregion