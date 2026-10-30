// Relay allowlist and public, versioned discovery. This does not promise game support.
export const companionContract = {
  "contractVersion": "1.0.0",
  "protocol": 1,
  "status": "experimental",
  "transports": {
    "host": "/ws/host",
    "client": "/ws/client"
  },
  "commands": [
    "menu.up",
    "menu.down",
    "menu.left",
    "menu.right",
    "menu.select",
    "menu.back",
    "game.pause",
    "game.resume",
    "song.skipIntro",
    "song.restart",
    "continuous.start",
    "continuous.queue",
    "continuous.stop",
    "continuous.skip",
    "song.menu",
    "song.playlistMenu",
    "song.jumpTo",
    "song.random",
    "song.select",
    "song.start",
    "song.skip",
    "song.list",
    "preview.start",
    "preview.stop",
    "search.setText",
    "playlist.load",
    "playlist.create",
    "playlist.delete",
    "playlist.addSelected",
    "playlist.removeSelected",
    "playlist.removeItem",
    "playlist.addSongs",
    "playlist.removeSong",
    "playlist.moveItemUp",
    "playlist.moveItemDown",
    "playlist.toggleFixedOrder",
    "playlist.automation.set",
    "playlist.countdown.start",
    "playlist.next",
    "party.configure",
    "party.skip",
    "party.stop",
    "party.resetLeaderboard",
    "party.startMatchmaking",
    "player.kick"
  ],
  "discovery": {
    "gameCommands": "api.state.apiCapabilities",
    "transportFeatures": "host.hello.capabilities",
    "catalogSnapshot": "song.list ack.data.snapshotId"
  },
  "identities": {
    "songId": "Integer, valid only within a catalog snapshot",
    "catalogKey": "Opaque stable file identity; reject missing or ambiguous matches",
    "playerId": "Room-scoped identity, assigned by relay",
    "songSeq": "Game playback instance; not a song ID",
    "sessionSeq": "Native continuous playback session"
  },
  "authority": {
    "game": [
      "catalog",
      "scoring",
      "clock",
      "song transitions",
      "continuous playback"
    ],
    "relay": [
      "rooms",
      "authentication",
      "Party votes",
      "transport"
    ],
    "client": [
      "presentation",
      "capture"
    ]
  },
  "schemas": {
    "command": {
      "type": "object",
      "required": [
        "type",
        "protocol",
        "commandId",
        "command"
      ],
      "properties": {
        "type": {
          "const": "control.command"
        },
        "protocol": {
          "const": 1
        },
        "commandId": {
          "type": "integer"
        },
        "command": {
          "enum": [
            "menu.up",
            "menu.down",
            "menu.left",
            "menu.right",
            "menu.select",
            "menu.back",
            "game.pause",
            "game.resume",
            "song.skipIntro",
            "song.restart",
            "continuous.start",
            "continuous.queue",
            "continuous.stop",
            "continuous.skip",
            "song.menu",
            "song.playlistMenu",
            "song.jumpTo",
            "song.random",
            "song.select",
            "song.start",
            "song.skip",
            "song.list",
            "preview.start",
            "preview.stop",
            "search.setText",
            "playlist.load",
            "playlist.create",
            "playlist.delete",
            "playlist.addSelected",
            "playlist.removeSelected",
            "playlist.removeItem",
            "playlist.addSongs",
            "playlist.removeSong",
            "playlist.moveItemUp",
            "playlist.moveItemDown",
            "playlist.toggleFixedOrder",
            "playlist.automation.set",
            "playlist.countdown.start",
            "playlist.next",
            "party.configure",
            "party.skip",
            "party.stop",
            "party.resetLeaderboard",
            "party.startMatchmaking",
            "player.kick"
          ]
        },
        "args": {
          "type": "object"
        }
      },
      "additionalProperties": true
    },
    "ack": {
      "type": "object",
      "required": [
        "type",
        "accepted"
      ],
      "properties": {
        "type": {
          "const": "ack"
        },
        "commandId": {
          "type": "integer"
        },
        "accepted": {
          "type": "boolean"
        },
        "reason": {
          "type": [
            "string",
            "null"
          ]
        }
      },
      "additionalProperties": true
    }
  }
};
export const relayCommands = Object.freeze(companionContract.commands);
