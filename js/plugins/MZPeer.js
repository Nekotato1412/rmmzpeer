/*:
 * @target MZ
 * @plugindesc Provides peer to peer multiplayer functionality to RPG Maker MZ
 * @author Best Waifu
 * 
 * @help
 * 
 */
var BestWaifu = BestWaifu || {};
BestWaifu.MZPeer = BestWaifu.MZPeer || {};
BestWaifu.MZPeer.Version = 1;

BestWaifu.MZPeer.peerIdBase = "mzpeer-91fc5e8a3652ce-";
BestWaifu.MZPeer.lobbyIdCharacters = [
    '0','1','2','3','4', 
    '5','6','7','8','9',
    'A','B','C','D','E',
    'F','G','H','J','K',
    'L','M','N','O','P'
]

BestWaifu.MZPeer.lobbyIdLength = 10;

// Hard coded to work like Local Coop for now.
// TODO: Join prevention switch
BestWaifu.MZPeer.maxPlayers = 4;

//-----------------------------------------------------------------------------
// Network API
//
// Helper objects to interface with the network system.

BestWaifu.MZPeer.Sides = {
    Common: 0, // Everyone
    Local: 1, // Just me (Offline)
    Host: 2, // Just host
    Guest: 3 // Just me (Online)
}

$gameNetwork = {};
$gameNetwork.username = "";

$allPlayers = [];

$gameNetwork.reset = function() {
    $gameNetwork.peer = null; // Our Peer Object
    $gameNetwork.lobbyId = ""; // The current Lobby ID
    $gameNetwork.hostPeerId = ""; //  The peer ID of the host.
    $gameNetwork.side = BestWaifu.MZPeer.Sides.Local; // Our side


    // The game characters of all players in the session
    // Other players are a Remote_Player
    // The local player is Game_Player
    $allPlayers = [];

    // Used for opening/closing the lobby to automatically drop new peers that try to connect.
    // Also used by Guests to reject all other peer connections to enforce Host Authority P2P.
    $gameNetwork.open = false;

    $gameNetwork.peerConnections = []; // For juggling data connections and handling authorization as host
    $gameNetwork.hostConnection = null; // For letting the host knows things as guest
};

// Technically for initializing but I'm not a pedant and it makes sense in later usages
$gameNetwork.reset();

BestWaifu.MZPeer.Remote_Player = function() {
    this.initialize(...arguments);
}
BestWaifu.MZPeer.Remote_Player.prototype = Object.create(Game_Character.prototype);
BestWaifu.MZPeer.Remote_Player.prototype.constructor = BestWaifu.MZPeer.Remote_Player;


//-----------------------------------------------------------------------------
// Plugin Commands
//
// Provide plugin commands for:
// - Running an event on a certain side (e.g. for Global Events)
// - Disconnecting from session
// - Disconnecting all guests
// - Kicking a guest
// - Changing what actor a guest belongs to
// - Reconnecting to last session

//-----------------------------------------------------------------------------
// Script Calls
//
// Provide script calls for:
// - Redefining what "Player" refers to in a move route

//-----------------------------------------------------------------------------
// Common Event Hooks
//
// Provide hooks for:
// - A player joining the session
// - A player leaving the session
// - Being disconnected from the session

//-----------------------------------------------------------------------------
// Lobbies/PeerJS
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
    if (!$gameNetwork.username) return
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
    return peer;
};

$gameNetwork.createGuestSession = function() {
    if (!$gameNetwork.username) return
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
    return peer;
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

$gameNetwork.pushError = function(message) {
    SceneManager.push(BestWaifu.MZPeer.Scene_ErrorAlert);
    SceneManager.prepareNextScene(message);
};

$gameNetwork.onError = function(error) {
    $gameNetwork.destroySession();
    SceneManager.push(BestWaifu.MZPeer.Scene_ErrorAlert);
    let message = "";
    switch(error.type) {
        case "network":
        case "disconnected":
            message = "No connection to traversal server.";
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
            message = "A socket error occured. WTF?";
            break;
        case "socket-closed":
            message = "F*ck";
            break;
        case "unavailable-id":
            message = "Network ID already exists. Try again."
            break;
        default:
            message = "Something went wrong.";
            break;
    }
    SceneManager.prepareNextScene(message + "\n" + error.message);
    console.error(error);
};


$gameNetwork.onPeerConnection = function(dataConnection) {
    if (!$gameNetwork.open) {
        console.log("Rejecting connection from remote peer. Not accepting new connections.");
        dataConnection.close();
        return;
    }

    console.log("New peer connected.");
    dataConnection.on('data', $gameNetwork.onPeerData);
    dataConnection.on('close', $gameNetwork.onPeerDisconnection);

    $gameNetwork.peerConnections.push(dataConnection);
};

$gameNetwork.onPeerDisconnection = function() {
    console.log("Peer disconnected.");
    $gameNetwork.peerConnections = $gameNetwork.peerConnections.filter(c => c.open);
};

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

//-----------------------------------------------------------------------------
// Window_TextInput
BestWaifu.MZPeer.Window_TextInput = function() {
    this.initialize(...arguments);
}

BestWaifu.MZPeer.Window_TextInput.prototype = Object.create(Window_NameInput.prototype);
BestWaifu.MZPeer.Window_TextInput.prototype.constructor = BestWaifu.MZPeer.Window_TextInput;

BestWaifu.MZPeer.Window_TextInput.prototype.table = function() {
    return [Window_NameInput.LATIN1, Window_NameInput.LATIN2];
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
    $gameNetwork.side = BestWaifu.MZPeer.Sides.Guest;
    // May have a password system later, idk
    this.onAuthorized();
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onAuthorized = function() {
    DataManager.setupNewGame();
    $gameNetwork.hostConnection.send({ "message": "request-data" });
};

// Copy the initial data given by the server
BestWaifu.MZPeer.Scene_JoinLobby.prototype.onData = function(data) {
    if (typeof data === "object") {
        // Future proofing
        if (data["message"]) {
            if (data.message === "authorized") {
                this.onAuthorized();
            }
        }

        if (data["save"] && typeof data["save"] === "object") {
            for (const key of Object.keys(data.save)) {
                // I am aware this isn't super secure but it's the most compatible with plugins. 
                // Host should be a trusted party.
                if (DataManager._databaseFiles.some(e => e.name === key)) {
                    window[key] = data.save[key];
                }
            }
        }

        if (data["mapId"]) {
            const mapId = parseInt(data["mapId"]);
            DataManager.loadMapData(mapId);
            $gameMap.setup(mapId);
            SceneManager.goto(Scene_Map);
        }
    }
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onConnectionError = function(err) {
    $gameNetwork.pushError("Failed to connect to host.");
    console.error(err);
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onRejected = function() {
    console.error("Host rejected connection.");
    $gameNetwork.pushError("Host refused to connect.");
    this.popScene();
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createEditWindow();
    this.createInputWindow();
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.createEditWindow = function() {
    const rect = this.editWindowRect();
    this._editWindow = new BestWaifu.MZPeer.Window_TextEdit(rect);
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
        metadata: "rmmzpeer-v" + BestWaifu.MZPeer.Version + "-guest",
        reliable: true
    });

    // Apply the listeners
    $gameNetwork.hostConnection.on('open', this.onConnected.bind(this));
    $gameNetwork.hostConnection.on('close', this.onRejected.bind(this));
    $gameNetwork.hostConnection.on('error', this.onConnectionError.bind(this));
    $gameNetwork.hostConnection.on('data', this.onData.bind(this));
};

BestWaifu.MZPeer.Scene_JoinLobby.prototype.onInputOk = function() {
    if (this._editWindow.name().length < BestWaifu.MZPeer.lobbyIdLength) {
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
        this.addCommand("Enter Room Code", "join")
    }
    if ($gameNetwork.side === BestWaifu.MZPeer.Sides.Guest || $gameNetwork.side === BestWaifu.MZPeer.Sides.Host) {
        this.addCommand("Disconnect", "disconnect");
    }

    this.addCommand("Set Username", "username", this.userIdChangable());
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
    $gameNetwork.destroySession();
    this.popScene();
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
// Character Syncing
//
// Make the players visibly appear on screen and move around in real time

//-----------------------------------------------------------------------------
// Data Syncing
//
// Switches, variables, gold, exp, all of this should be synced

//-----------------------------------------------------------------------------
// Event Command Syncing
//
// When a player triggers an event command it 
// should run according to what side the current player is on.

//-----------------------------------------------------------------------------
// Battle Syncing
//
// The meat and potatos of it all. Complex syncing of battle mechanics and state.