## Near Tactics Game Server

Server for a 1v1 turned based game. This server is configured to make players take turns at the same time. The server can be modified to have a more traditional turned based game where each player take actual turns.

The client need to long poll the contract to get updates, such as knowing that the other player has in fact made their turn.

### Singleton

This server is written in the Æsingelton styleÆ.

We say that an AssemblyScript contract is written in the "singleton style" when the `index.ts` file (the contract entry point) has a single exported class (the name of the class doesn't matter) that is decorated with `@nearBindgen`.

In this case, all methods on the class become public contract methods unless marked `private`. Also, all instance variables are stored as a serialized instance of the class under a special storage key named `STATE`. AssemblyScript uses JSON for storage serialization (as opposed to Rust contracts which use a custom binary serialization format called borsh).

### Getting started

(see below for video recordings of each of the following steps)

INSTALL `NEAR CLI` first like this: `npm i -g near-cli`

1. clone this repo to a local folder
2. run `npm install`
3. run `./scripts/1.dev-deploy.sh`
4. run `./scripts/2.use-contract.sh`
5. run `./scripts/2.use-contract.sh` (yes, run it to see changes)
6. run `./scripts/3.cleanup.sh`
