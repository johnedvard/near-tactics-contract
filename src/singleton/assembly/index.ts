import { context, PersistentMap, logging } from 'near-sdk-core';
import { Game } from './game';
import { GameData } from './gameData';
import { JOINING, ENDED, PLAYING } from './gameState';
import { MsgCode } from './msgCode';
import { PlayerCommands } from './playerCommands';
import { TurnCommand } from './turnCommand';
import { Unit } from './unit';

@nearBindgen
export class Contract {
  games: PersistentMap<string, Game> = new PersistentMap<string, Game>('games');

  createGame(units: Unit[]): MsgCode {
    const existingGame = this.getGame(context.sender);
    if (existingGame.isNull() || existingGame.gameState == ENDED) {
      if (!units || units.length != 3) {
        return { code: 3, msg: 'Must pass exactly 3 units' };
      }
      if (!this.containsUniqueUnits(units)) {
        return { code: 4, msg: 'Must have three unique units' };
      }
      const game = new Game(context.sender, units);
      this.games.set(game.gameId, game);
      return { code: 0, msg: 'Game created with id: ' + context.sender };
    }
    if (!existingGame.isNull()) {
      if (existingGame.gameState == PLAYING)
        return { code: 2, msg: 'Game in progress' };
      if (existingGame.gameState == JOINING)
        return { code: 5, msg: 'Game created. p2 not joined yet' };
    }
    return {
      code: 1,
      msg: 'Game already created', // Can only create one game at a time
    };
  }

  joinGame(gameId: string, units: Unit[]): MsgCode {
    const game: Game = this.getGame(gameId);
    assert(!game.isNull(), 'Game does not exist');
    // TODO (johnedvard) Should we assert or return false?
    // assert(
    //   game.p1 != context.sender,
    //   'Cannot join a game we created ourselves'
    // );
    if (game.p1 == context.sender)
      return { code: 1, msg: 'Cannot join a game we created ourselves' };
    if (game.gameState == PLAYING) return { code: 2, msg: 'game in progress' };
    if (game.gameState == ENDED) return { code: 5, msg: 'game ended' };
    if (game.gameState == JOINING) {
      if (!units || units.length != 3) {
        return { code: 3, msg: 'Must pass exactly 3 units' };
      }
      if (!this.containsUniqueUnits(units)) {
        return { code: 4, msg: 'Must have three unique units' };
      }
      game.startGame(context.sender, units);
      this.games.set(game.gameId, game); // Need to actually update the game state to storage
      return { code: 0, msg: 'Joined game' };
    }
    return { code: 404, msg: 'Unhandled condition' };
  }

  /**
   * TODO (johnedvard) Maybe the clients should create the state based on a seed (a transaction hash)
   * Then both clients would get the same game state.
   */
  getInitialGameData(gameId: string): GameData {
    // Return the inital state before players make any commands
    const game: Game = this.getGame(gameId);
    assert(!game.isNull(), 'Game does not exist');
    if (game.p1 && game.p2 && game.gameState == PLAYING) {
      // TODO (johnedvard) return the actual initial state
      return {
        p1Units: game.p1Units,
        p2Units: game.p2Units,
        currentTurn: game.currentTurn,
      };
    }
    // Ended or not started
    return { p1Units: [], p2Units: [], currentTurn: 0 };
  }

  /**
   * TODO (johnedvard) consider renaming method, and always returning true if p2 asks if p1 joined.
   * TODO (johnedvard) consider returning an object with error code, message and data
   */
  hasPlayer2Joined(gameId: string): boolean {
    const game: Game = this.getGame(gameId);
    if (!game) return false;
    // Only p1 can ask if p2 joined the game
    if (context.sender == game.p2) return false; // TODO (johnedvard) Maybe use assert instead.
    if (game.p2 && game.gameState == PLAYING) return true;
    return false;
  }

  getGame(gameId: string): Game {
    if (this.games.contains(gameId)) {
      return this.games.getSome(gameId);
    }
    return new Game('', []);
  }

  /**
   * Usually the contract determines the winner and ends the game
   * If a player ends the game, they concede, and automatically loose
   */
  endGame(gameId: string): void {
    const game: Game = this.getGame(gameId);
    assert(!game.isNull(), 'Game does not exist');
    assert(
      game.p1 == context.sender || game.p2 == context.sender,
      'Can only concede own game'
    );
    if (game) {
      game.endGame();
      this.games.set(game.gameId, game); // Need to actually update the game state to storage
    }
  }

  /**
   * The contract remembers the state, and pass it along to the other player after they commit their commands.
   * The client needs to long poll, asking for the other player's next command if this function returns ''.
   * @param json the client state, such as moves and actions
   * @returns {string} the commands from the other player if they commited their commands already.
   */
  commitCommands(gameId: string, json: string): TurnCommand {
    const game: Game | null = this.getGame(gameId);
    let res: TurnCommand = {
      currentTurn: -1,
      p1Turn: -1,
      p2Turn: -1,
      json: '',
    };
    if (!game) return res;
    const turns = this.getPlayerTurns(game);
    const ownTurn = turns[0];
    if (ownTurn == game.currentTurn) {
      // can only commit one command each turn.
      game.storePlayerCommands(context.sender, json);
      game.advancePlayerTurn(context.sender);
      if (game.p1Turn == game.p2Turn) {
        // both players have committed their commands for the round
        const newTurn: i32 = game.advanceToNextRound();
        // return the other player's commited commands
        res = this.getOtherPlayerCommands(gameId, newTurn - 1);
      }
      this.games.set(game.gameId, game); // Need to actually update the game state to storage
    }
    return res;
  }

  /**
   * The client may need to long poll for the commands made by the other player
   * @param gameId
   * @param pTurn the action made on the other players turn
   * @returns
   */
  getOtherPlayerCommands(gameId: string, pTurn: i32): TurnCommand {
    const game: Game = this.getGame(gameId);
    this.assertOwnGame(
      game,
      'Can only get commands for game we are participating in'
    );
    if (game.isNull())
      return { currentTurn: -1, p1Turn: -1, p2Turn: -1, json: '' };
    let otherPlayerCommands: string[] = [];
    if (context.sender == game.p2) otherPlayerCommands = game.p1Commands;
    if (context.sender == game.p1) otherPlayerCommands = game.p2Commands;
    if (otherPlayerCommands.length > pTurn)
      return {
        currentTurn: game.currentTurn,
        p1Turn: game.p1Turn,
        p2Turn: game.p2Turn,
        json: otherPlayerCommands[pTurn],
      };
    return {
      currentTurn: game.currentTurn,
      p1Turn: game.p1Turn,
      p2Turn: game.p2Turn,
      json: '',
    };
  }

  /**
   * Get all commands up until the latest current turn.
   * Does not get the other player's last commands unless both has commited their moves on the same turn.
   * @param gameId
   * @returns
   */
  getAllCommands(gameId: string): PlayerCommands {
    const game: Game = this.getGame(gameId);
    this.assertOwnGame(
      game,
      'Can only get commands for game we are participating in'
    );
    let p1Commands = [''];
    let p2Commands = [''];
    if (game.isNull()) return { p1Commands, p2Commands };
    if (context.sender == game.p1) {
      p1Commands = game.p1Commands;
      p2Commands = game.p2Commands.slice(0, game.currentTurn);
    } else if (context.sender == game.p2) {
      p2Commands = game.p2Commands;
      p1Commands = game.p1Commands.slice(0, game.currentTurn);
    } else {
      // TODO (johnedvard) Figure out if non game participants should be allowed to get all commands, or only up to the current turn
      p1Commands = game.p1Commands.slice(0, game.currentTurn);
      p2Commands = game.p2Commands.slice(0, game.currentTurn);
    }
    return { p1Commands, p2Commands };
  }

  /**
   * Similar to {@see getOtherPlayerCommands}, but will always give correct command according to round and player's turn
   * Can only ask for other players next commands if we already commited our commands for the turn
   * If currentTurn:0, p1:1, p2:0, then p1 won't get any results (because p2 hasn't committed anything for this turn yet)
   * If currentTurn:1, p1:1, p2:1, then p1 will get p2s move for p2:0, (p2 can also get p1's moves from round 0. Client needs to understand what to do)
   * If currentTurn:1, p1:1, p2:2, then p1 will get nothing, because p2 is waiting for p1's moves, and p1 will get p2s moves after commiting to turn
   */
  getOtherPlayerNextCommands(gameId: string): TurnCommand {
    const game: Game | null = this.getGame(gameId);
    if (!game) return { currentTurn: -1, p1Turn: -1, p2Turn: -1, json: '' };
    const turns = this.getPlayerTurns(game);
    const ownTurn = turns[0];
    const otherTurn = turns[1];
    let turnToGet: i32 = ownTurn - 1;
    if (ownTurn == otherTurn && turnToGet >= 0)
      return this.getOtherPlayerCommands(gameId, turnToGet);
    return {
      currentTurn: game.currentTurn,
      p1Turn: game.p1Turn,
      p2Turn: game.p2Turn,
      json: '',
    };
  }

  /**
   * After a round is over, each player needs to commit their game states to make sure both are in sync.
   * Otherewise, there might be a bug in the front-end or someone is cheating
   */
  submitGameStateAfterRound(gameId: string, json: string): void {
    const game: Game | null = this.getGame(gameId);
    if (!game) return;
    // TODO (johnedvard) set game state and compare results
  }

  isGameInProgress(gameId: string): boolean {
    const game: Game = this.getGame(gameId);
    assert(!game.isNull(), 'Game does not exist');
    return game.gameState == PLAYING;
  }

  /**
   *
   * @param game
   * @returns {i32[]} always a tuple of two numbers where the first index is our own turn
   */
  private getPlayerTurns(game: Game): i32[] {
    this.assertOwnGame(game, 'Can only concede own game');
    let ownTurn = game.p1Turn;
    let otherTurn = game.p2Turn;
    if (context.sender == game.p2) {
      ownTurn = game.p2Turn;
      otherTurn = game.p1Turn;
    }
    return [ownTurn, otherTurn];
  }

  private assertOwnGame(
    game: Game,
    msg: string = 'Can only call functions on a game we are participating in'
  ): void {
    assert(game.p1 == context.sender || game.p2 == context.sender, msg);
  }

  private containsUniqueUnits(units: Unit[]): boolean {
    const unitMap: Map<string, i32> = new Map<string, i32>();
    for (let i = 0; i < units.length; i++) {
      if (!unitMap.has(units[i].unitType)) {
        unitMap.set(units[i].unitType, 1);
      } else {
        return false;
      }
    }
    return true;
  }
}
