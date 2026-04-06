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
};

BestWaifu.MZPeer.NetworkHandshake.Statuses = {
    "UNRESOLVED": 0, // Handshake was just created
    "PENDING_ACK": 1, // Pending acknowledgement from the other side
    "RESOLVED": 2, // Handshake acknowledged
    "PURGED": 3 // Something went wrong with the handshake and we had to purge it
};

/** Handshakes expire after 1000ms and must be renewed. */
BestWaifu.MZPeer.NetworkHandshake.prototype.isExpired = function() {
    return (Date.now() - this.getField("timestamp")) >= 1000;
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

/** To be overriden with a function to call when a node is applied. */
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
    this._handshakes = {};
    this._handshakePollTimer = setInterval(this.pollHandshakes.bind(this), 1000);
};

/** Data recieved from a guest. */
BestWaifu.MZPeer.NetworkRouter.prototype.onPeerData = function (data) {
    if (typeof data !== "object") return;
    if (!data || !data["type"] || !data["username"]) return;
    BestWaifu.MZPeer.logDebug("Locating listeners for type  " + data.type);
    
    if (data.type === "handshake") {
        BestWaifu.MZPeer.logDebug("+ [HOST] Processing handshake.");
        this.onHandshakeData(data);
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

/** Clears logic related to the given peer from the router. */
BestWaifu.MZPeer.NetworkRouter.prototype.purgePeer = function(username) {
    for (const handshake of Object.values(this._handshakes)) {
        if (handshake.getField("owner") === username) handshake.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PURGED);
        if (handshake.getField("recipient") === username) handshake.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PURGED);
    }
};

/** Data recieved from the host. */
BestWaifu.MZPeer.NetworkRouter.prototype.onHostData = function(data) {
    if (typeof data !== "object") return;
    if (!data || !data["type"] || !data["username"]) return;
    BestWaifu.MZPeer.logDebug("Locating listeners for type  " + data.type);

    if (data.type === "handshake") {
        BestWaifu.MZPeer.logDebug("+ [GUEST] Processing handshake.");
        this.onHandshakeData(data);
        return;
    }

    for (const dataListener of this._dataListeners) {
        if (dataListener.side !== BestWaifu.MZPeer.Sides.Common && dataListener.side !== BestWaifu.MZPeer.Sides.Guest) continue;
        BestWaifu.MZPeer.logDebug("=> " + dataListener.type)
        if (dataListener.type === data.type) {
            BestWaifu.MZPeer.logDebug("+ Found listener for type: " + dataListener.type)
            dataListener.callback(data);
        }
    }
};

BestWaifu.MZPeer.NetworkRouter.hasHandshake = function(id) {
    return !!this._handshakes[id];
};

BestWaifu.MZPeer.NetworkRouter.getHandshake = function(id) {
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

    const handshake_id = handshake_data.getField("id");

    if (handshake_data.getField("recipient") !== $gameNetwork.username && 
        handshake_data.getField("owner") !== $gameNetwork.username &&
        $gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        console.warn("Handshake that wasn't ours was ignored.");
        return;
    }

    if (handshake_data.isExpired()) {
        console.warn("Expired handshake ignored.");
        return;
    };

    for (const handshakeListener of this._handshakeListeners) {
        if (handshakeListener.id === handshake_id) {
            switch (handshake_data.getField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.UNRESOLVED)) {
                
                case BestWaifu.MZPeer.NetworkHandshake.Statuses.UNRESOLVED: {
                    $gameNetwork.pushLog("Handling unresolved handshake: " + handshake_id);
                    this._handshakes[handshake_id] = handshake_data;

                    handshake_data.setField("network_data", handshakeListener.unresolved(handshake_data.networkData()));
                    
                    handshake_data.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PENDING_ACK);
                    this._handshakes[handshake_id].setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PENDING_ACK);

                    this.sendHandshake(handshake_data);
                    break;
                }

                case BestWaifu.MZPeer.NetworkHandshake.Statuses.PENDING_ACK: {
                    $gameNetwork.pushLog("Handling pending handshake: " + handshake_id);

                    handshake_data.setField("network_data", handshakeListener.pending(handshake_data.networkData()));
                    handshake_data.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.RESOLVED);
                    this._handshakes[handshake_id].setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.RESOLVED);

                    this.sendHandshake(handshake_data);
                    break;
                }

                case BestWaifu.MZPeer.NetworkHandshake.Statuses.RESOLVED: {
                    if (handshake_data.getField("owner") === $gameNetwork.username) {
                        $gameNetwork.pushLog("Handling resolved handshake: " + handshake_id);
                        handshakeListener.resolved(handshake_data.networkData());
                    } else {
                        console.warn("Ignoring a handshake we don't own.");
                    }
                    this._handshakes[handshake_id] = handshake_data;
                    this._handshakes[handshake_id].setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.RESOLVED);
                    
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

/** Where handshakes are renewed, retried and destroyed. */
BestWaifu.MZPeer.NetworkRouter.prototype.pollHandshakes = function() {
    for (const handshake of Object.values(this._handshakes)) {
        switch (handshake.getField("status")) {
            case BestWaifu.MZPeer.NetworkHandshake.Statuses.UNRESOLVED:
                // Only Handshake owner has authority to renew an unresolved handshake
                if (handshake.isExpired()) {
                    if (handshake.getField("owner") === $gameNetwork.username) {
                        handshake.renew();
                        $gameNetwork.pushLog("Retrying unresolved handshake: ", + handshake.getField("id"));
                        if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
                            this.sendToGuest(handshake.getField("recipient"), handshake);
                        } else if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
                            this.sendToHost(handshake);
                        }
                    } else {
                        $gameNetwork.pushLog("Attempted to renew an unresolved handshake we're not the owner of.");
                        handshake.setField("status", BestWaifu.MZPeer.NetworkHandshake.Statuses.PURGED);
                    }
                }
                break;

            case BestWaifu.MZPeer.NetworkHandshake.Statuses.PENDING_ACK:
                // Only handshake recipient has authority to renew a pending handshake
                if (handshake.isExpired()) {
                    if (handshake.getField("recipient") === $gameNetwork.username) {
                        handshake.renew();
                        $gameNetwork.pushLog("Retrying pending handshake: ", + handshake.getField("id"));
                        if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
                            this.sendToGuest(handshake.getField("recipient"), handshake);
                        } else if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
                            this.sendToHost(handshake);
                        }
                    } else {
                        $gameNetwork.pushLog("Attempted to renew a pending handshake we're not the recipient of.");
                    }
                }
                break;
            

            case BestWaifu.MZPeer.NetworkHandshake.Statuses.PURGED:
                $gameNetwork.pushLog("Deleting purged handshake: " + handshake.getField("id"));
                delete this._handshakes[handshake.getField("id")];
                break;

            case BestWaifu.MZPeer.NetworkHandshake.Statuses.RESOLVED:
                $gameNetwork.pushLog("Deleting resolved handshake: " + handshake.getField("id"));
                delete this._handshakes[handshake.getField("id")];
                break;
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
    this._handshakes[handshake.getField("id")] = handshake;
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        $gameNetwork.pushLog("[Host] Starting new handshake: " + handshake.getField("id"));
        this.sendToGuest(handshake.getField("recipient"), handshake);
    } else if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest) {
        $gameNetwork.pushLog("[Guest] Starting new handshake: " + handshake.getField("id"));
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
                console.error("Failed to send to guest:", e);
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

    // For routing data
    $gameNetwork.router = new BestWaifu.MZPeer.NetworkRouter();
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

// Destroy the current session
$gameNetwork.destroySession = function () {
    if ($gameNetwork.peer && !$gameNetwork.peer.destroyed) {
        $gameNetwork.peer.destroy();
    }
    $gameNetwork.reset();
    console.log("Successfully destroyed the session.");
};

// Drop a peer
$gameNetwork.dropPeer = function (username) {
    const connIndex = $gameNetwork.peerConnections.findIndex(c => c.metadata.username === username);
    if (connIndex >= 0) {
        $gameNetwork.peerConnections[connIndex].close();
        $gameNetwork.peerConnections.splice(connIndex, 1);
    }
    if ($gameNetwork.router) {
        $gameNetwork.router.purgePeer(username);
    }
};

$gameNetwork.makePlayerList = function () {
    $gameNetwork.playerList = [$gameNetwork.username];
    for (const peerConnection of $gameNetwork.peerConnections) {
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
        $gameNetwork.pushLog("Rejection connection: Lobby is full.");
        dataConnection.close();
        return;
    }

    $gameNetwork.pushLog(`${username} connected.`);
    $gameNetwork.peerConnections.push(dataConnection);
    dataConnection.on('data', $gameNetwork.router.onPeerData.bind($gameNetwork.router));
    dataConnection.on('close', $gameNetwork.onPeerDisconnection.bind(this, dataConnection));
};

$gameNetwork.onPeerDisconnection = function (peerConnection) {
    $gameNetwork.pushLog(`${peerConnection.metadata?.username} disconnected.`);
    $gameNetwork.peerConnections = $gameNetwork.peerConnections.filter(c => c.open);

    $gameNetwork.makePlayerList(); // Refresh the player list
    $gameNetwork.router.sendToGuests(new BestWaifu.MZPeer.SyncPlayerList($gameNetwork.playerList)); // Refresh the player list for guests

    if (BestWaifu.MZPeer.PlayerLeaveVar > 0) {
        $gameVariables.setValue(BestWaifu.MZPeer.PlayerLeaveVar, $gameSystem.numberForUser(peerConnection.metadata?.username));
    }
    if (BestWaifu.MZPeer.PlayerLeaveCE > 0) {
        $gameTemp.reserveCommonEvent(BestWaifu.MZPeer.PlayerLeaveCE);
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
            $gameNetwork.dropPeer(request.username());
            break;
        }

        /* case BestWaifu.MZPeer.NetworkRequest.Codes.INIT: {
            // Track the player in the numbering system
            $gameSystem.addPlayer(request.username());

            // Sync save data
            const save_sync = new BestWaifu.MZPeer.SyncSaveData();
            save_sync.makeSave();

            $gameNetwork.pushLog(`[Host] ${request.username()} was sent save data.`);
            $gameNetwork.sendResponse(request.username(), save_sync);
            break;
        } */

        /* case BestWaifu.MZPeer.NetworkRequest.Codes.POST_SAVE_LOAD: {
            $gameNetwork.pushLog(`[Host] ${request.username()} was sent the player list.`);
            // Send the player list
            $gameNetwork.makePlayerList();
            const player_list_data = new BestWaifu.MZPeer.SyncPlayerList();
            player_list_data.setField("list", $gameNetwork.playerList);
            $gameNetwork.sendResponse(request.username(), player_list_data);
            break;
        } */
        
        /* case BestWaifu.MZPeer.NetworkRequest.Codes.POST_PLAYER_LIST: {
            $gameNetwork.pushLog(`[Host] ${request.username()} was marked as spawnable.`);
            // Designate the player as spawnable/creatable
            $gameNetwork.spawnablePlayers.push(request.username());

            // Later: Spawn the player
            $gameNetwork.spawnLastPlayer($gamePlayer.x, $gamePlayer.y);

            break;
        } */

        case BestWaifu.MZPeer.NetworkRequest.Codes.INITIALIZE_PLAYERS: {
            // Sync Guests
            $gameNetwork.pushLog(`[Host] ${request.username()} requested initialization of players.`);
            for (const player of $remotePlayers) {
                const guest_player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();
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

/* $gameNetwork.router.addNetworkDataListener("sync_save_data", BestWaifu.MZPeer.Sides.Guest, data => {
    const save_data_sync = new BestWaifu.MZPeer.SyncSaveData();
    save_data_sync.fromData(data);
    save_data_sync.loadSave();
    $gameNetwork.pushLog("[Guest] Successfully loaded save.")
}); */

/* $gameNetwork.router.addNetworkDataListener("sync_player_list", BestWaifu.MZPeer.Sides.Guest, data => {
    const player_list_sync = new BestWaifu.MZPeer.SyncPlayerList();
    player_list_sync.fromData(data);
    $gameNetwork.playerList = player_list_sync.getField("list", [$gameNetwork.username]);
    $gameNetwork.pushLog("[Guest] Successfully loaded player list.");
    $gameNetwork.sendRequest(new BestWaifu.MZPeer.NetworkRequest(BestWaifu.MZPeer.NetworkRequest.Codes.POST_PLAYER_LIST));
}); */

$gameNetwork.router.addNetworkDataListener("sync_player_creation", BestWaifu.MZPeer.Sides.Guest, data => {
    const player_creation_sync = new BestWaifu.MZPeer.SyncPlayerCreation();
    player_creation_sync.fromData(data);
    $gameNetwork.pushLog(`[Guest] Creating player ${player_creation_sync.getField("username")}`);
    if (player_creation_sync.getField("username") == $gameNetwork.username) {
        // TOOD: Logic graph this so it doesn't fail
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
    const player_movement_sync = new BestWaifu.MZPeer.SyncPlayerMovement();
    player_movement_sync.fromData(data);

    $gameNetwork.pushLog(`[Common] syncing movement for ${player_movement_sync.getField("username")}`);

    for (const remotePlayer of $remotePlayers) {
        if (remotePlayer.username != player_movement_sync.getField("username")) continue;
        $gameNetwork.pushLog(`Incoming tick: ${player_movement_sync.getField("tick", 0)}`);
        remotePlayer.movementGraph.addNode(player_movement_sync);
        remotePlayer.movementGraph.applyLatest();
    }

    if ($gameNetwork.side == BestWaifu.MZPeer.Sides.Host) {
        $gameNetwork.router.sendToGuests(player_movement_sync);
    }
});

/** Graphless position syncing. Used only to ensure maximum truth and not to be confused with locate tracking. */
$gameNetwork.router.addNetworkDataListener("sync_player_orientation", BestWaifu.MZPeer.Sides.Common, data => {
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

    // DEBUG ONLY: Spawn the last player
    $gameNetwork.spawnLastPlayer($gamePlayer.x, $gamePlayer.y);

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
        if ($gameNetwork.username) {
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

Game_System.prototype.addPlayer = function (username) {
    if (Object.values(this._players).includes(username)) return;
    const currentPlayerCount = Object.keys(this._players).length;
    this._players[currentPlayerCount + 1] = username;
};

Game_System.prototype.players = function () {
    return this._players;
};

Game_System.prototype.numberForUser = function (username) {
    for (const N of Object.keys(this._players)) {
        if (this._players[N] == username) return N;
    }
    return -1;
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
    // TODO: Logic graph this
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
        reliable: true
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
    BestWaifu.MZPeer.Scene_Map_createAllWindows.call(this);
    this.createNetworkDebugConsoleWindow();
};

Scene_Map.prototype.createNetworkDebugConsoleWindow = function() {
    this._networkDebugConsoleWindow = new BestWaifu.MZPeer.Window_NetworkDataLog(this.networkDebugConsoleWindowRect());
    this.addWindow(this._networkDebugConsoleWindow);
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
    this.addCommand("Netplay", "netplay");
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
    Scene_Base.prototype.initialize.call(this);
};

BestWaifu.MZPeer.Scene_NetplayWaiting.prototype.create = function () {
    Scene_Base.prototype.create.call(this);
    this.createForeground();
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
    const N = $gameSystem.numberForUser(this.username) - 1;
    if (N < 0) return null;
    return $gameParty.members()[N] || null;
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
};

$gameNetwork.spawnLastPlayer = function (x, y) {
    const username = $gameNetwork.spawnablePlayers.pop();
    if (username) {
        this.createRemotePlayer(username, x, y);
    }
};

// Create a remote player. Only valid on a map scene.
$gameNetwork.createRemotePlayer = function (username, x, y) {
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
        player_creation_sync.setField("username", username);
        player_creation_sync.setField("x", x);
        player_creation_sync.setField("y", y);
        $gameNetwork.router.sendToGuests(player_creation_sync);
    }
};

// For instant creation of remote player sprites
$gameNetwork.addRemotePlayerSprite = function (spriteSet, remotePlayer) {
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
    for (const player of $remotePlayers) {
        const N = $gameSystem.numberForUser(player.username);
        if (this._memberIndex === N - 1) return false;
    }

    return BestWaifu.MZPeer.Game_Follower_isVisible.call(this);
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
        const actor = $gameParty.members()[N - 1];
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

    $gameNetwork.pushLog(`[CLIENT] Moved. NT: ${this.movementGraph.latestTick()} GT: ${this.movementGraph.getField("tick", 0)}`);

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

    $gameNetwork.pushLog(`[CLIENT] Located. NT: ${this.movementGraph.latestTick()} GT: ${this.movementGraph.getField("tick", 0)}`);

    $gameNetwork.sendData(player_locate_sync, BestWaifu.MZPeer.Sides.Common);
};

//#endregion

//-----------------------------------------------------------------------------
// #region Real Time Event Syncing
//
// When a player triggers an event it 
// should run according to what side the current player is on.

// Events should only be moved by the host


//#endregion

//-----------------------------------------------------------------------------
// #region Map Transfer Syncing
//
// When any player transfers all players should transfer with them.

//-----------------------------------------------------------------------------
// #region Game Data Syncing
//

// Switches

// Self Switches

// Variables

// Gold

// EXP

// Item Gain

// Item Loss

// HP gain

// HP loss

// MP gain

// MP loss

// TP gain

// TP loss

// Parameter Change

// Skill Change

// Equipment Change

// Name Change

// Class Change

// Nickname Change

// Profile Change


//#endregion

//#region Timer Syncing

//#endregion


//-----------------------------------------------------------------------------
// #region Battle Syncing
//
// The meat and potatos of it all. Complex syncing of battle mechanics and state.

//#region Standard Turn Battle

//#endregion

//#region Active Turn Battle (Wait)

//#endregion

//#region Active Turn Battle (Realtime)

//#endregion

//#endregion

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