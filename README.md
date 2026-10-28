# MZ Peer
Peer to Peer Co-Op in RPG Maker MZ, powered by PeerJS!

## IMPORTANT DISCLAIMER:
This plugin is NOT ready for public use and I am aware I am an extremely sloppy user when it comes to git so I won't be accepting PRs. This repository is purely here to provide auto-update and document the instructions on using this plugin.

## Features
- No server setup required
- Support for private sessions
- Supports all battle systems that come with MZ.

## Project Setup

### Libraries
Copy the contents of the "libs" folder to js/libs.

Add the following line to index.html below the line containing "main.js" (or use the provided sample index.html)

```<script type="text/javascript" src="js/libs/peerjs.min.js"></script>```

### Plugin
1. Copy the contents of the plugins folder to js/plugins.
2. Enable the MZPeer plugin in your plugins menu at the BOTTOM of the list.


## Sample Setup
If you want to use the sample data provided to verify if MZPeer will work for you or to help
with development take the following steps:
1. Clone this repository or click "Code -> Download ZIP".
2. Create a new RPG Maker MZ Project.
3. Close RPG Maker MZ.
4. Copy the contents of this repository directly on to the new RPG Maker MZ Project
5. Replace files when prompted.
6. Enjoy!